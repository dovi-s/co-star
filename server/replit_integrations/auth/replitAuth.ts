import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { db } from "../../db";
import { users, passwordResetTokens } from "@shared/models/auth";
import { eq, and, gt } from "drizzle-orm";
import { sendPasswordResetEmail } from "../email/resend";
import { OAuth2Client } from "google-auth-library";

const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

function rateLimit(windowMs: number, maxRequests: number): RequestHandler {
  return (req, res, next) => {
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    const key = `${req.path}:${ip}`;
    const now = Date.now();
    const entry = rateLimitStore.get(key);

    if (!entry || now > entry.resetAt) {
      rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (entry.count >= maxRequests) {
      return res.status(429).json({ message: "Too many requests. Please try again later." });
    }

    entry.count++;
    return next();
  };
}

setInterval(() => {
  const now = Date.now();
  rateLimitStore.forEach((entry, key) => {
    if (now > entry.resetAt) rateLimitStore.delete(key);
  });
}, 60 * 1000);

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: true,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: true,
      sameSite: "lax" as const,
      maxAge: sessionTtl,
    },
  });
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());

  const authLimiter = rateLimit(15 * 60 * 1000, 10);
  const forgotLimiter = rateLimit(15 * 60 * 1000, 5);

  app.post("/api/register", authLimiter, async (req, res) => {
    try {
      const { email, password, firstName, lastName } = req.body;

      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        return res.status(400).json({ message: "Please enter a valid email address" });
      }

      if (password.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters" });
      }

      const [existing] = await db.select().from(users).where(eq(users.email, email.toLowerCase().trim()));
      if (existing) {
        return res.status(409).json({ message: "An account with this email already exists" });
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const [user] = await db
        .insert(users)
        .values({
          email: email.toLowerCase().trim(),
          passwordHash,
          firstName: firstName?.trim() || null,
          lastName: lastName?.trim() || null,
        })
        .returning();

      req.session.regenerate((err) => {
        if (err) {
          console.error("Session regenerate error:", err);
          return res.status(500).json({ message: "Failed to create account" });
        }
        (req.session as any).userId = user.id;
        (req.session as any).claims = { sub: user.id };
        res.json({ id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName });
      });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({ message: "Failed to create account" });
    }
  });

  app.post("/api/login", authLimiter, async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }

      const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase().trim()));
      if (!user || !user.passwordHash) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      if (user.blocked === "true") {
        return res.status(403).json({ message: "This account has been suspended" });
      }

      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      req.session.regenerate((err) => {
        if (err) {
          console.error("Session regenerate error:", err);
          return res.status(500).json({ message: "Failed to sign in" });
        }
        (req.session as any).userId = user.id;
        (req.session as any).claims = { sub: user.id };
        res.json({ id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName });
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Failed to sign in" });
    }
  });

  app.post("/api/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        console.error("Logout error:", err);
        return res.status(500).json({ message: "Failed to sign out" });
      }
      res.clearCookie("connect.sid");
      res.json({ success: true });
    });
  });

  app.post("/api/forgot-password", forgotLimiter, async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }

      const normalizedEmail = email.toLowerCase().trim();
      res.json({ message: "If an account with that email exists, we sent a reset link." });

      const [user] = await db.select().from(users).where(eq(users.email, normalizedEmail));
      if (!user) return;
      if (user.googleId && !user.passwordHash) return;

      const token = crypto.randomBytes(32).toString("hex");
      const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

      await db.insert(passwordResetTokens).values({
        email: normalizedEmail,
        tokenHash,
        expiresAt,
      });

      try {
        await sendPasswordResetEmail(normalizedEmail, token);
      } catch (emailErr) {
        console.error("Failed to send reset email:", emailErr);
      }
    } catch (error) {
      console.error("Forgot password error:", error);
      res.status(500).json({ message: "Something went wrong" });
    }
  });

  app.post("/api/reset-password", authLimiter, async (req, res) => {
    try {
      const { token, password } = req.body;
      if (!token || !password) {
        return res.status(400).json({ message: "Token and password are required" });
      }

      if (password.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters" });
      }

      const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
      const [resetToken] = await db
        .select()
        .from(passwordResetTokens)
        .where(
          and(
            eq(passwordResetTokens.tokenHash, tokenHash),
            eq(passwordResetTokens.used, false),
            gt(passwordResetTokens.expiresAt, new Date())
          )
        );

      if (!resetToken) {
        return res.status(400).json({ message: "This reset link is invalid or has expired" });
      }

      const passwordHashValue = await bcrypt.hash(password, 10);
      await db
        .update(users)
        .set({ passwordHash: passwordHashValue, updatedAt: new Date() })
        .where(eq(users.email, resetToken.email));

      await db
        .update(passwordResetTokens)
        .set({ used: true })
        .where(eq(passwordResetTokens.id, resetToken.id));

      res.json({ message: "Password has been reset" });
    } catch (error) {
      console.error("Reset password error:", error);
      res.status(500).json({ message: "Something went wrong" });
    }
  });

  app.post("/api/auth/google", authLimiter, async (req, res) => {
    try {
      const { credential } = req.body;
      if (!credential) {
        return res.status(400).json({ message: "Google credential is required" });
      }

      const clientId = process.env.GOOGLE_CLIENT_ID;
      if (!clientId) {
        return res.status(500).json({ message: "Google sign-in is not configured" });
      }

      const client = new OAuth2Client(clientId);
      const ticket = await client.verifyIdToken({
        idToken: credential,
        audience: clientId,
      });

      const payload = ticket.getPayload();
      if (!payload || !payload.sub || !payload.email) {
        return res.status(400).json({ message: "Invalid Google token" });
      }

      if (!payload.email_verified) {
        return res.status(400).json({ message: "Google email is not verified" });
      }

      const googleId = payload.sub;
      const googleEmail = payload.email.toLowerCase().trim();

      let [user] = await db.select().from(users).where(eq(users.googleId, googleId));

      if (!user) {
        [user] = await db.select().from(users).where(eq(users.email, googleEmail));
        if (user) {
          await db
            .update(users)
            .set({ googleId, authProvider: user.passwordHash ? "both" : "google", updatedAt: new Date() })
            .where(eq(users.id, user.id));
          user = { ...user, googleId };
        }
      }

      if (!user) {
        [user] = await db
          .insert(users)
          .values({
            email: googleEmail,
            googleId,
            authProvider: "google",
            firstName: payload.given_name || null,
            lastName: payload.family_name || null,
            profileImageUrl: payload.picture || null,
          })
          .returning();
      }

      if (user.blocked === "true") {
        return res.status(403).json({ message: "This account has been suspended" });
      }

      req.session.regenerate((err) => {
        if (err) {
          console.error("Session regenerate error:", err);
          return res.status(500).json({ message: "Failed to sign in" });
        }
        (req.session as any).userId = user.id;
        (req.session as any).claims = { sub: user.id };
        res.json({ id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName });
      });
    } catch (error: any) {
      console.error("Google auth error:", error);
      if (error.message?.includes("Token used too late") || error.message?.includes("Invalid token")) {
        return res.status(400).json({ message: "Google sign-in failed. Please try again." });
      }
      res.status(500).json({ message: "Google sign-in failed" });
    }
  });

  app.get("/api/auth/google/client-id", (_req, res) => {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      return res.status(404).json({ message: "Google sign-in is not configured" });
    }
    res.json({ clientId });
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  const session = req.session as any;

  if (!session.userId || !session.claims?.sub) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const [user] = await db.select({ blocked: users.blocked }).from(users).where(eq(users.id, session.userId));
  if (user?.blocked === "true") {
    req.session.destroy(() => {});
    return res.status(403).json({ message: "This account has been suspended" });
  }

  (req as any).user = { claims: session.claims };
  return next();
};

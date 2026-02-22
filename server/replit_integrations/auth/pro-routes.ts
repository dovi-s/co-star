import type { Express, RequestHandler } from "express";
import { isAuthenticated } from "./replitAuth";
import { db } from "../../db";
import { savedScripts, performanceRuns, users, featureRequests, featureVotes, recentScripts } from "@shared/models/auth";
import { eq, desc, and, sql, inArray } from "drizzle-orm";
import crypto from "crypto";

function scriptFingerprint(rawScript: string): string {
  return crypto.createHash("sha256").update(rawScript || "").digest("hex").substring(0, 32);
}

export function registerProRoutes(app: Express): void {
  // --- Saved Scripts ---

  app.get("/api/scripts", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const scripts = await db
        .select({
          id: savedScripts.id,
          name: savedScripts.name,
          userRoleId: savedScripts.userRoleId,
          lastPosition: savedScripts.lastPosition,
          lastScene: savedScripts.lastScene,
          createdAt: savedScripts.createdAt,
          updatedAt: savedScripts.updatedAt,
        })
        .from(savedScripts)
        .where(eq(savedScripts.userId, userId))
        .orderBy(desc(savedScripts.updatedAt));
      res.json(scripts);
    } catch (error) {
      console.error("Error fetching scripts:", error);
      res.status(500).json({ message: "Failed to fetch scripts" });
    }
  });

  app.get("/api/scripts/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const [script] = await db
        .select()
        .from(savedScripts)
        .where(and(eq(savedScripts.id, req.params.id), eq(savedScripts.userId, userId)));

      if (!script) {
        return res.status(404).json({ message: "Script not found" });
      }
      res.json(script);
    } catch (error) {
      console.error("Error fetching script:", error);
      res.status(500).json({ message: "Failed to fetch script" });
    }
  });

  app.post("/api/scripts", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { name, rawScript, rolesJson, scenesJson, userRoleId } = req.body;

      if (!name) {
        return res.status(400).json({ message: "Name is required" });
      }

      const [script] = await db
        .insert(savedScripts)
        .values({
          userId,
          name,
          rawScript: rawScript || "",
          rolesJson: rolesJson || null,
          scenesJson: scenesJson || null,
          userRoleId: userRoleId || null,
        })
        .returning();

      res.json(script);
    } catch (error) {
      console.error("Error saving script:", error);
      res.status(500).json({ message: "Failed to save script" });
    }
  });

  app.patch("/api/scripts/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { name, userRoleId, lastPosition, lastScene, rolesJson, scenesJson } = req.body;

      const updateData: Record<string, any> = { updatedAt: new Date() };
      if (name !== undefined) updateData.name = name;
      if (userRoleId !== undefined) updateData.userRoleId = userRoleId;
      if (lastPosition !== undefined) updateData.lastPosition = lastPosition;
      if (lastScene !== undefined) updateData.lastScene = lastScene;
      if (rolesJson !== undefined) updateData.rolesJson = rolesJson;
      if (scenesJson !== undefined) updateData.scenesJson = scenesJson;

      const [script] = await db
        .update(savedScripts)
        .set(updateData)
        .where(and(eq(savedScripts.id, req.params.id), eq(savedScripts.userId, userId)))
        .returning();

      if (!script) {
        return res.status(404).json({ message: "Script not found" });
      }
      res.json(script);
    } catch (error) {
      console.error("Error updating script:", error);
      res.status(500).json({ message: "Failed to update script" });
    }
  });

  app.delete("/api/scripts/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const [deleted] = await db
        .delete(savedScripts)
        .where(and(eq(savedScripts.id, req.params.id), eq(savedScripts.userId, userId)))
        .returning();

      if (!deleted) {
        return res.status(404).json({ message: "Script not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting script:", error);
      res.status(500).json({ message: "Failed to delete script" });
    }
  });

  // --- Performance Runs ---

  app.get("/api/performance", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const runs = await db
        .select()
        .from(performanceRuns)
        .where(eq(performanceRuns.userId, userId))
        .orderBy(desc(performanceRuns.createdAt))
        .limit(100);
      res.json(runs);
    } catch (error) {
      console.error("Error fetching performance:", error);
      res.status(500).json({ message: "Failed to fetch performance history" });
    }
  });

  app.post("/api/performance", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { scriptName, savedScriptId, accuracy, linesTotal, linesCorrect, linesSkipped, durationSeconds, memorizationMode } = req.body;

      if (!scriptName || accuracy === undefined || !linesTotal || linesCorrect === undefined) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      const [run] = await db
        .insert(performanceRuns)
        .values({
          userId,
          scriptName,
          savedScriptId: savedScriptId || null,
          accuracy: Number(accuracy),
          linesTotal: Number(linesTotal),
          linesCorrect: Number(linesCorrect),
          linesSkipped: Number(linesSkipped || 0),
          durationSeconds: durationSeconds ? Number(durationSeconds) : null,
          memorizationMode: memorizationMode || "off",
        })
        .returning();

      res.json(run);
    } catch (error) {
      console.error("Error saving performance:", error);
      res.status(500).json({ message: "Failed to save performance run" });
    }
  });

  // --- User subscription status ---

  app.get("/api/auth/subscription", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const [user] = await db
        .select({ subscriptionTier: users.subscriptionTier })
        .from(users)
        .where(eq(users.id, userId));
      res.json({ tier: user?.subscriptionTier || "free" });
    } catch (error) {
      res.json({ tier: "free" });
    }
  });

  // --- Feature Requests Board ---

  const optionalAuth: RequestHandler = (req: any, res, next) => {
    const session = req.session as any;
    if (session?.userId && session?.claims?.sub) {
      req.user = { claims: session.claims };
      next();
    } else {
      req.user = null;
      next();
    }
  };

  app.get("/api/features", optionalAuth, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || `anon_${req.sessionID}`;
      const sort = req.query.sort === "newest" ? "newest" : "top";

      const requests = await db
        .select()
        .from(featureRequests)
        .orderBy(sort === "newest" ? desc(featureRequests.createdAt) : desc(featureRequests.voteCount));

      const votes = await db
        .select({ featureRequestId: featureVotes.featureRequestId, value: featureVotes.value })
        .from(featureVotes)
        .where(eq(featureVotes.userId, userId));
      const userVotes: Record<string, number> = Object.fromEntries(votes.map(v => [v.featureRequestId, v.value]));

      res.json({
        requests: requests.map(r => ({
          ...r,
          userVote: userVotes[r.id] || 0,
        })),
      });
    } catch (error) {
      console.error("Error fetching features:", error);
      res.status(500).json({ message: "Failed to fetch feature requests" });
    }
  });

  app.post("/api/features", optionalAuth, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || `anon_${req.sessionID}`;
      const { title, description, category, authorName: providedName } = req.body;

      if (!title || title.trim().length < 3) {
        return res.status(400).json({ message: "Title must be at least 3 characters" });
      }

      let authorName = "Anonymous";
      if (req.user?.claims?.sub) {
        const [user] = await db
          .select({ firstName: users.firstName, lastName: users.lastName })
          .from(users)
          .where(eq(users.id, req.user.claims.sub));
        authorName = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || "Anonymous";
      } else if (providedName?.trim()) {
        authorName = providedName.trim();
      }

      const [request] = await db
        .insert(featureRequests)
        .values({
          userId,
          authorName,
          title: title.trim(),
          description: description?.trim() || null,
          category: category || "general",
          voteCount: 1,
        })
        .returning();

      await db.insert(featureVotes).values({
        userId,
        featureRequestId: request.id,
        value: 1,
      });

      res.json({ ...request, userVote: 1 });
    } catch (error) {
      console.error("Error creating feature:", error);
      res.status(500).json({ message: "Failed to create feature request" });
    }
  });

  app.post("/api/features/:id/vote", optionalAuth, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || `anon_${req.sessionID}`;
      const featureId = req.params.id;
      const { value } = req.body;

      if (value !== 1 && value !== -1 && value !== 0) {
        return res.status(400).json({ message: "Vote must be 1, -1, or 0" });
      }

      const [existing] = await db
        .select()
        .from(featureVotes)
        .where(and(eq(featureVotes.userId, userId), eq(featureVotes.featureRequestId, featureId)));

      const oldValue = existing?.value || 0;
      const diff = value - oldValue;

      if (existing) {
        if (value === 0) {
          await db.delete(featureVotes).where(eq(featureVotes.id, existing.id));
        } else {
          await db.update(featureVotes).set({ value }).where(eq(featureVotes.id, existing.id));
        }
      } else if (value !== 0) {
        await db.insert(featureVotes).values({ userId, featureRequestId: featureId, value });
      }

      if (diff !== 0) {
        await db
          .update(featureRequests)
          .set({ voteCount: sql`COALESCE(${featureRequests.voteCount}, 0) + ${diff}` })
          .where(eq(featureRequests.id, featureId));
      }

      const [updated] = await db
        .select({ voteCount: featureRequests.voteCount })
        .from(featureRequests)
        .where(eq(featureRequests.id, featureId));

      res.json({ voteCount: updated?.voteCount || 0, userVote: value });
    } catch (error) {
      console.error("Error voting:", error);
      res.status(500).json({ message: "Failed to vote" });
    }
  });

  // --- Recent Scripts (per-account) ---

  app.get("/api/recent-scripts", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const scripts = await db
        .select()
        .from(recentScripts)
        .where(eq(recentScripts.userId, userId))
        .orderBy(desc(recentScripts.lastUsed))
        .limit(8);
      res.json(scripts);
    } catch (error) {
      console.error("Error fetching recent scripts:", error);
      res.status(500).json({ message: "Failed to fetch recent scripts" });
    }
  });

  app.post("/api/recent-scripts", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { name, rawScript, roleCount, lineCount, lastRole } = req.body;

      if (!name || typeof name !== "string") {
        return res.status(400).json({ message: "Name is required" });
      }

      const fp = scriptFingerprint(rawScript || "");

      const [match] = await db
        .select()
        .from(recentScripts)
        .where(and(eq(recentScripts.userId, userId), eq(recentScripts.scriptFingerprint, fp)));

      if (match) {
        const [updated] = await db
          .update(recentScripts)
          .set({
            name,
            roleCount: roleCount ?? match.roleCount,
            lineCount: lineCount ?? match.lineCount,
            lastRole: lastRole || match.lastRole,
            lastUsed: new Date(),
          })
          .where(eq(recentScripts.id, match.id))
          .returning();
        return res.json(updated);
      }

      const [script] = await db
        .insert(recentScripts)
        .values({
          userId,
          name,
          rawScript: rawScript || "",
          scriptFingerprint: fp,
          roleCount: roleCount || 0,
          lineCount: lineCount || 0,
          lastRole: lastRole || null,
        })
        .returning();

      const allScripts = await db
        .select({ id: recentScripts.id })
        .from(recentScripts)
        .where(eq(recentScripts.userId, userId))
        .orderBy(desc(recentScripts.lastUsed));

      if (allScripts.length > 8) {
        const toDelete = allScripts.slice(8).map(s => s.id);
        await db.delete(recentScripts).where(inArray(recentScripts.id, toDelete));
      }

      res.json(script);
    } catch (error) {
      console.error("Error saving recent script:", error);
      res.status(500).json({ message: "Failed to save recent script" });
    }
  });

  app.patch("/api/recent-scripts/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { name, lastRole } = req.body;

      const updateData: Record<string, any> = {};
      if (name !== undefined) updateData.name = name;
      if (lastRole !== undefined) updateData.lastRole = lastRole;

      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ message: "Nothing to update" });
      }

      const [updated] = await db
        .update(recentScripts)
        .set(updateData)
        .where(and(eq(recentScripts.id, req.params.id), eq(recentScripts.userId, userId)))
        .returning();

      if (!updated) {
        return res.status(404).json({ message: "Script not found" });
      }
      res.json(updated);
    } catch (error) {
      console.error("Error updating recent script:", error);
      res.status(500).json({ message: "Failed to update recent script" });
    }
  });

  app.delete("/api/recent-scripts/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const [deleted] = await db
        .delete(recentScripts)
        .where(and(eq(recentScripts.id, req.params.id), eq(recentScripts.userId, userId)))
        .returning();

      if (!deleted) {
        return res.status(404).json({ message: "Script not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting recent script:", error);
      res.status(500).json({ message: "Failed to delete recent script" });
    }
  });
}

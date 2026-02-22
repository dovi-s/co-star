import type { Express } from "express";
import { isAuthenticated } from "./replitAuth";
import { db } from "../../db";
import { users } from "@shared/models/auth";
import { eq } from "drizzle-orm";

export function registerAuthRoutes(app: Express): void {
  app.get("/api/auth/user", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const [user] = await db
        .select({
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          profileImageUrl: users.profileImageUrl,
          stageName: users.stageName,
          pronouns: users.pronouns,
          ageRange: users.ageRange,
          height: users.height,
          eyeColor: users.eyeColor,
          hairColor: users.hairColor,
          location: users.location,
          unionStatus: users.unionStatus,
          specialSkills: users.specialSkills,
          onboardingComplete: users.onboardingComplete,
          subscriptionTier: users.subscriptionTier,
          subscriptionExpiresAt: users.subscriptionExpiresAt,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
        })
        .from(users)
        .where(eq(users.id, userId));
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  app.patch("/api/auth/profile", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const {
        firstName, lastName, stageName, pronouns, ageRange,
        height, eyeColor, hairColor, location, unionStatus,
        specialSkills, profileImageUrl, onboardingComplete,
      } = req.body;

      const updateData: Record<string, any> = { updatedAt: new Date() };
      if (firstName !== undefined) updateData.firstName = firstName;
      if (lastName !== undefined) updateData.lastName = lastName;
      if (stageName !== undefined) updateData.stageName = stageName;
      if (pronouns !== undefined) updateData.pronouns = pronouns;
      if (ageRange !== undefined) updateData.ageRange = ageRange;
      if (height !== undefined) updateData.height = height;
      if (eyeColor !== undefined) updateData.eyeColor = eyeColor;
      if (hairColor !== undefined) updateData.hairColor = hairColor;
      if (location !== undefined) updateData.location = location;
      if (unionStatus !== undefined) updateData.unionStatus = unionStatus;
      if (specialSkills !== undefined) updateData.specialSkills = specialSkills;
      if (profileImageUrl !== undefined) updateData.profileImageUrl = profileImageUrl;
      if (onboardingComplete !== undefined) updateData.onboardingComplete = onboardingComplete;

      const [updated] = await db
        .update(users)
        .set(updateData)
        .where(eq(users.id, userId))
        .returning();

      if (!updated) {
        return res.status(404).json({ message: "User not found" });
      }

      const { passwordHash, ...safeUser } = updated;
      res.json(safeUser);
    } catch (error) {
      console.error("Error updating profile:", error);
      res.status(500).json({ message: "Failed to update profile" });
    }
  });
}

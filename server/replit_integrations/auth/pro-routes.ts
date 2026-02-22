import type { Express } from "express";
import { isAuthenticated } from "./replitAuth";
import { db } from "../../db";
import { savedScripts, performanceRuns, users } from "@shared/models/auth";
import { eq, desc, and } from "drizzle-orm";

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
}

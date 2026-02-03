import { Router } from "express";
import { db } from "../db/index";
import { financials } from "../../shared/schema";
import { eq } from "drizzle-orm";
import { calculateProjectPricing } from "../services/pricingEngine";

const router = Router();

// ---------------------------------------------------------------------------
// FINANCIALS
// ---------------------------------------------------------------------------

router.get("/projects/:projectId/financials", async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId);
    const [financial] = await db.select().from(financials).where(eq(financials.projectId, projectId));
    res.json(financial || null);
  } catch (error) {
    console.error("Failed to fetch financials:", error);
    res.status(500).json({ error: "Failed to fetch financials" });
  }
});

router.post("/projects/:projectId/financials", async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId);
    const [existing] = await db.select().from(financials).where(eq(financials.projectId, projectId));
    if (existing) {
      const [result] = await db
        .update(financials)
        .set(req.body)
        .where(eq(financials.projectId, projectId))
        .returning();
      res.json(result);
    } else {
      const [result] = await db.insert(financials).values({ ...req.body, projectId }).returning();
      res.json(result);
    }
  } catch (error) {
    console.error("Failed to create/update financials:", error);
    res.status(500).json({ error: "Failed to create/update financials" });
  }
});

router.patch("/projects/:projectId/financials", async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId);
    const [existing] = await db.select().from(financials).where(eq(financials.projectId, projectId));
    if (existing) {
      const [result] = await db
        .update(financials)
        .set(req.body)
        .where(eq(financials.projectId, projectId))
        .returning();
      res.json(result);
    } else {
      const [result] = await db.insert(financials).values({ ...req.body, projectId }).returning();
      res.json(result);
    }
  } catch (error) {
    console.error("Failed to update financials:", error);
    res.status(500).json({ error: "Failed to update financials" });
  }
});

// Lock pricing
router.post("/projects/:projectId/financials/lock", async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId);
    const { lockedBy } = req.body;
    
    const [result] = await db
      .update(financials)
      .set({
        isLocked: true,
        lockedAt: new Date().toISOString(),
        lockedBy: lockedBy || "system",
      })
      .where(eq(financials.projectId, projectId))
      .returning();
    
    if (!result) {
      return res.status(404).json({ error: "Financials not found for project" });
    }
    
    res.json(result);
  } catch (error) {
    console.error("Failed to lock pricing:", error);
    res.status(500).json({ error: "Failed to lock pricing" });
  }
});

// Get pricing summary (calculated from units, models, and financials)
router.get("/projects/:projectId/pricing-summary", async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId);
    const summary = await calculateProjectPricing(projectId);
    res.json(summary);
  } catch (error) {
    console.error("Failed to calculate pricing summary:", error);
    res.status(500).json({ error: "Failed to calculate pricing summary" });
  }
});

export default router;

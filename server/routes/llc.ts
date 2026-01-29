import { Router } from "express";
import { db } from "../db/index";
import { llcs } from "../../shared/schema";
import { eq, desc } from "drizzle-orm";

const router = Router();

// ---------------------------------------------------------------------------
// LLCs (Entity Management)
// ---------------------------------------------------------------------------

router.get("/llcs", async (req, res) => {
  try {
    const allLlcs = await db.select().from(llcs).orderBy(desc(llcs.createdAt));
    res.json(allLlcs);
  } catch (error) {
    console.error("Failed to fetch LLCs:", error);
    res.status(500).json({ error: "Failed to fetch LLCs" });
  }
});

router.get("/llcs/:id", async (req, res) => {
  try {
    const llcId = parseInt(req.params.id);
    const [llc] = await db.select().from(llcs).where(eq(llcs.id, llcId));
    if (!llc) {
      return res.status(404).json({ error: "LLC not found" });
    }
    res.json(llc);
  } catch (error) {
    console.error("Failed to fetch LLC:", error);
    res.status(500).json({ error: "Failed to fetch LLC" });
  }
});

router.get("/projects/:projectId/llc", async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId);
    const [llc] = await db.select().from(llcs).where(eq(llcs.projectId, projectId));
    res.json(llc || null);
  } catch (error) {
    console.error("Failed to fetch project LLC:", error);
    res.status(500).json({ error: "Failed to fetch project LLC" });
  }
});

router.post("/llcs", async (req, res) => {
  try {
    const [result] = await db.insert(llcs).values(req.body).returning();
    res.json(result);
  } catch (error) {
    console.error("Failed to create LLC:", error);
    res.status(500).json({ error: "Failed to create LLC" });
  }
});

router.post("/projects/:projectId/llc", async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId);
    const [existing] = await db.select().from(llcs).where(eq(llcs.projectId, projectId));
    if (existing) {
      const [result] = await db
        .update(llcs)
        .set(req.body)
        .where(eq(llcs.projectId, projectId))
        .returning();
      res.json(result);
    } else {
      const [result] = await db.insert(llcs).values({ ...req.body, projectId }).returning();
      res.json(result);
    }
  } catch (error) {
    console.error("Failed to create/update project LLC:", error);
    res.status(500).json({ error: "Failed to create/update project LLC" });
  }
});

router.patch("/llcs/:id", async (req, res) => {
  try {
    const llcId = parseInt(req.params.id);
    const [result] = await db
      .update(llcs)
      .set(req.body)
      .where(eq(llcs.id, llcId))
      .returning();
    res.json(result);
  } catch (error) {
    console.error("Failed to update LLC:", error);
    res.status(500).json({ error: "Failed to update LLC" });
  }
});

router.delete("/llcs/:id", async (req, res) => {
  try {
    const llcId = parseInt(req.params.id);
    await db.delete(llcs).where(eq(llcs.id, llcId));
    res.json({ success: true });
  } catch (error) {
    console.error("Failed to delete LLC:", error);
    res.status(500).json({ error: "Failed to delete LLC" });
  }
});

export default router;

import { Router } from "express";
import { db } from "../db";
import { stateDisclosures, insertStateDisclosureSchema } from "@shared/schema";
import { eq, asc, and } from "drizzle-orm";

const router = Router();

router.get("/state-disclosures", async (req, res) => {
  try {
    const allDisclosures = await db
      .select()
      .from(stateDisclosures)
      .orderBy(asc(stateDisclosures.state), asc(stateDisclosures.code));
    
    res.json(allDisclosures);
  } catch (error) {
    console.error("Error fetching state disclosures:", error);
    res.status(500).json({ error: "Failed to fetch state disclosures" });
  }
});

router.get("/state-disclosures/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [disclosure] = await db
      .select()
      .from(stateDisclosures)
      .where(eq(stateDisclosures.id, id));
    
    if (!disclosure) {
      return res.status(404).json({ error: "State disclosure not found" });
    }
    
    res.json(disclosure);
  } catch (error) {
    console.error("Error fetching state disclosure:", error);
    res.status(500).json({ error: "Failed to fetch state disclosure" });
  }
});

router.get("/state-disclosures/by-state/:state", async (req, res) => {
  try {
    const { state } = req.params;
    const disclosures = await db
      .select()
      .from(stateDisclosures)
      .where(eq(stateDisclosures.state, state.toUpperCase()))
      .orderBy(asc(stateDisclosures.code));
    
    res.json(disclosures);
  } catch (error) {
    console.error("Error fetching state disclosures by state:", error);
    res.status(500).json({ error: "Failed to fetch state disclosures" });
  }
});

router.get("/state-disclosures/lookup/:code/:state", async (req, res) => {
  try {
    const { code, state } = req.params;
    const [disclosure] = await db
      .select()
      .from(stateDisclosures)
      .where(
        and(
          eq(stateDisclosures.code, code.toUpperCase()),
          eq(stateDisclosures.state, state.toUpperCase())
        )
      );
    
    if (!disclosure) {
      return res.status(404).json({ error: "State disclosure not found" });
    }
    
    res.json(disclosure);
  } catch (error) {
    console.error("Error looking up state disclosure:", error);
    res.status(500).json({ error: "Failed to lookup state disclosure" });
  }
});

router.post("/state-disclosures", async (req, res) => {
  try {
    const parsed = insertStateDisclosureSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid state disclosure data", details: parsed.error.errors });
    }
    
    const [newDisclosure] = await db
      .insert(stateDisclosures)
      .values(parsed.data)
      .returning();
    
    console.log(`Created state disclosure: ${newDisclosure.state} - ${newDisclosure.code}`);
    res.status(201).json(newDisclosure);
  } catch (error) {
    console.error("Error creating state disclosure:", error);
    res.status(500).json({ error: "Failed to create state disclosure" });
  }
});

router.put("/state-disclosures/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const parsed = insertStateDisclosureSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid state disclosure data", details: parsed.error.errors });
    }
    
    const [updated] = await db
      .update(stateDisclosures)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(stateDisclosures.id, id))
      .returning();
    
    if (!updated) {
      return res.status(404).json({ error: "State disclosure not found" });
    }
    
    console.log(`Updated state disclosure: ${updated.state} - ${updated.code}`);
    res.json(updated);
  } catch (error) {
    console.error("Error updating state disclosure:", error);
    res.status(500).json({ error: "Failed to update state disclosure" });
  }
});

router.delete("/state-disclosures/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [deleted] = await db
      .delete(stateDisclosures)
      .where(eq(stateDisclosures.id, id))
      .returning();
    
    if (!deleted) {
      return res.status(404).json({ error: "State disclosure not found" });
    }
    
    console.log(`Deleted state disclosure: ${deleted.state} - ${deleted.code}`);
    res.json({ success: true, deleted });
  } catch (error) {
    console.error("Error deleting state disclosure:", error);
    res.status(500).json({ error: "Failed to delete state disclosure" });
  }
});

router.post("/state-disclosures/bulk", async (req, res) => {
  try {
    const { disclosures } = req.body;
    if (!Array.isArray(disclosures) || disclosures.length === 0) {
      return res.status(400).json({ error: "Disclosures array is required" });
    }
    
    const validDisclosures = [];
    for (const d of disclosures) {
      const parsed = insertStateDisclosureSchema.safeParse(d);
      if (parsed.success) {
        validDisclosures.push(parsed.data);
      }
    }
    
    if (validDisclosures.length === 0) {
      return res.status(400).json({ error: "No valid disclosures to insert" });
    }
    
    const inserted = await db
      .insert(stateDisclosures)
      .values(validDisclosures)
      .returning();
    
    console.log(`Bulk inserted ${inserted.length} state disclosures`);
    res.status(201).json({ inserted: inserted.length, disclosures: inserted });
  } catch (error) {
    console.error("Error bulk creating state disclosures:", error);
    res.status(500).json({ error: "Failed to bulk create state disclosures" });
  }
});

export default router;

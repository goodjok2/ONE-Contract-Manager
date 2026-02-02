import { Router } from "express";
import { db } from "../db";
import { exhibits, insertExhibitSchema } from "@shared/schema";
import { eq, asc } from "drizzle-orm";

const router = Router();

router.get("/exhibits", async (req, res) => {
  try {
    const allExhibits = await db
      .select()
      .from(exhibits)
      .orderBy(asc(exhibits.sortOrder), asc(exhibits.letter));
    
    res.json(allExhibits);
  } catch (error) {
    console.error("Error fetching exhibits:", error);
    res.status(500).json({ error: "Failed to fetch exhibits" });
  }
});

router.get("/exhibits/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [exhibit] = await db
      .select()
      .from(exhibits)
      .where(eq(exhibits.id, id));
    
    if (!exhibit) {
      return res.status(404).json({ error: "Exhibit not found" });
    }
    
    res.json(exhibit);
  } catch (error) {
    console.error("Error fetching exhibit:", error);
    res.status(500).json({ error: "Failed to fetch exhibit" });
  }
});

router.post("/exhibits", async (req, res) => {
  try {
    const parsed = insertExhibitSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid exhibit data", details: parsed.error.errors });
    }
    
    const [newExhibit] = await db
      .insert(exhibits)
      .values(parsed.data)
      .returning();
    
    console.log(`Created exhibit: ${newExhibit.letter} - ${newExhibit.title}`);
    res.status(201).json(newExhibit);
  } catch (error) {
    console.error("Error creating exhibit:", error);
    res.status(500).json({ error: "Failed to create exhibit" });
  }
});

router.put("/exhibits/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const parsed = insertExhibitSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid exhibit data", details: parsed.error.errors });
    }
    
    const [updated] = await db
      .update(exhibits)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(exhibits.id, id))
      .returning();
    
    if (!updated) {
      return res.status(404).json({ error: "Exhibit not found" });
    }
    
    console.log(`Updated exhibit: ${updated.letter} - ${updated.title}`);
    res.json(updated);
  } catch (error) {
    console.error("Error updating exhibit:", error);
    res.status(500).json({ error: "Failed to update exhibit" });
  }
});

router.delete("/exhibits/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [deleted] = await db
      .delete(exhibits)
      .where(eq(exhibits.id, id))
      .returning();
    
    if (!deleted) {
      return res.status(404).json({ error: "Exhibit not found" });
    }
    
    console.log(`Deleted exhibit: ${deleted.letter} - ${deleted.title}`);
    res.json({ success: true, deleted });
  } catch (error) {
    console.error("Error deleting exhibit:", error);
    res.status(500).json({ error: "Failed to delete exhibit" });
  }
});

router.get("/exhibits/by-contract/:contractType", async (req, res) => {
  try {
    const { contractType } = req.params;
    const allExhibits = await db
      .select()
      .from(exhibits)
      .orderBy(asc(exhibits.sortOrder), asc(exhibits.letter));
    
    const filteredExhibits = allExhibits.filter(exhibit => 
      exhibit.isActive && 
      exhibit.contractTypes?.includes(contractType.toUpperCase())
    );
    
    res.json(filteredExhibits);
  } catch (error) {
    console.error("Error fetching exhibits by contract type:", error);
    res.status(500).json({ error: "Failed to fetch exhibits" });
  }
});

export default router;

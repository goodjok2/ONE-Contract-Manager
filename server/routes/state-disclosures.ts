import { Router, Request, Response } from "express";
import { Pool } from "pg";
import { requireAuth } from "../middleware/auth";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const router = Router();

router.use(requireAuth);

router.get("/state-disclosures", async (req: Request, res: Response) => {
  try {
    const { state, disclosureType } = req.query;
    
    let query = `SELECT * FROM state_disclosures WHERE organization_id = $1 AND is_active = true`;
    const params: any[] = [req.organizationId];
    let paramIdx = 2;
    
    if (state) {
      query += ` AND state = $${paramIdx}`;
      params.push(state);
      paramIdx++;
    }
    
    if (disclosureType) {
      query += ` AND disclosure_type = $${paramIdx}`;
      params.push(disclosureType);
    }
    
    query += ` ORDER BY state, disclosure_type`;
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error: any) {
    console.error("Error fetching state disclosures:", error);
    res.status(500).json({ error: "Failed to fetch state disclosures" });
  }
});

router.get("/state-disclosures/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT * FROM state_disclosures 
       WHERE id = $1 AND organization_id = $2`,
      [id, req.organizationId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "State disclosure not found" });
    }
    
    res.json(result.rows[0]);
  } catch (error: any) {
    console.error("Error fetching state disclosure:", error);
    res.status(500).json({ error: "Failed to fetch state disclosure" });
  }
});

router.post("/state-disclosures", async (req: Request, res: Response) => {
  try {
    const { state, disclosureType, title, content, requiresInitials } = req.body;
    
    const result = await pool.query(
      `INSERT INTO state_disclosures (organization_id, state, disclosure_type, title, content, requires_initials)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [req.organizationId, state, disclosureType, title, content, requiresInitials]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    console.error("Error creating state disclosure:", error);
    res.status(500).json({ error: "Failed to create state disclosure" });
  }
});

router.patch("/state-disclosures/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { state, disclosureType, title, content, requiresInitials, isActive } = req.body;
    
    const result = await pool.query(
      `UPDATE state_disclosures SET 
       state = COALESCE($3, state),
       disclosure_type = COALESCE($4, disclosure_type),
       title = COALESCE($5, title),
       content = COALESCE($6, content),
       requires_initials = COALESCE($7, requires_initials),
       is_active = COALESCE($8, is_active),
       updated_at = NOW()
       WHERE id = $1 AND organization_id = $2
       RETURNING *`,
      [id, req.organizationId, state, disclosureType, title, content, requiresInitials, isActive]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "State disclosure not found" });
    }
    
    res.json(result.rows[0]);
  } catch (error: any) {
    console.error("Error updating state disclosure:", error);
    res.status(500).json({ error: "Failed to update state disclosure" });
  }
});

router.delete("/state-disclosures/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      `UPDATE state_disclosures SET is_active = false, updated_at = NOW()
       WHERE id = $1 AND organization_id = $2
       RETURNING *`,
      [id, req.organizationId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "State disclosure not found" });
    }
    
    res.json({ message: "State disclosure deactivated" });
  } catch (error: any) {
    console.error("Error deleting state disclosure:", error);
    res.status(500).json({ error: "Failed to delete state disclosure" });
  }
});

export default router;

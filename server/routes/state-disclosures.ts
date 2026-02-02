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
      query += ` AND code = $${paramIdx}`;
      params.push(disclosureType);
    }
    
    query += ` ORDER BY state, code`;
    
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
    const { state, code, content } = req.body;
    
    const result = await pool.query(
      `INSERT INTO state_disclosures (organization_id, state, code, content, is_active)
       VALUES ($1, $2, $3, $4, true)
       RETURNING *`,
      [req.organizationId, state, code, content]
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
    const { state, code, content, isActive } = req.body;
    
    const result = await pool.query(
      `UPDATE state_disclosures SET 
       state = COALESCE($3, state),
       code = COALESCE($4, code),
       content = COALESCE($5, content),
       is_active = COALESCE($6, is_active),
       updated_at = NOW()
       WHERE id = $1 AND organization_id = $2
       RETURNING *`,
      [id, req.organizationId, state, code, content, isActive]
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

import { Router, Request, Response } from "express";
import { Pool } from "pg";
import { requireAuth } from "../middleware/auth";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const router = Router();

router.use(requireAuth);

router.get("/exhibits", async (req: Request, res: Response) => {
  try {
    const { contractType } = req.query;
    
    let query = `SELECT * FROM exhibits WHERE organization_id = $1 AND is_active = true`;
    const params: any[] = [req.organizationId];
    
    if (contractType) {
      query += ` AND contract_types @> ARRAY[$2]::text[]`;
      params.push(contractType);
    }
    
    query += ` ORDER BY exhibit_code`;
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error: any) {
    console.error("Error fetching exhibits:", error);
    res.status(500).json({ error: "Failed to fetch exhibits" });
  }
});

router.get("/exhibits/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT * FROM exhibits 
       WHERE id = $1 AND organization_id = $2`,
      [id, req.organizationId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Exhibit not found" });
    }
    
    res.json(result.rows[0]);
  } catch (error: any) {
    console.error("Error fetching exhibit:", error);
    res.status(500).json({ error: "Failed to fetch exhibit" });
  }
});

router.post("/exhibits", async (req: Request, res: Response) => {
  try {
    const { exhibitCode, name, description, content, contractTypes } = req.body;
    
    const result = await pool.query(
      `INSERT INTO exhibits (organization_id, exhibit_code, name, description, content, contract_types)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [req.organizationId, exhibitCode, name, description, content, JSON.stringify(contractTypes)]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    console.error("Error creating exhibit:", error);
    res.status(500).json({ error: "Failed to create exhibit" });
  }
});

router.patch("/exhibits/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { exhibitCode, name, description, content, contractTypes, isActive } = req.body;
    
    const result = await pool.query(
      `UPDATE exhibits SET 
       exhibit_code = COALESCE($3, exhibit_code),
       name = COALESCE($4, name),
       description = COALESCE($5, description),
       content = COALESCE($6, content),
       contract_types = COALESCE($7, contract_types),
       is_active = COALESCE($8, is_active),
       updated_at = NOW()
       WHERE id = $1 AND organization_id = $2
       RETURNING *`,
      [id, req.organizationId, exhibitCode, name, description, content, contractTypes ? JSON.stringify(contractTypes) : null, isActive]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Exhibit not found" });
    }
    
    res.json(result.rows[0]);
  } catch (error: any) {
    console.error("Error updating exhibit:", error);
    res.status(500).json({ error: "Failed to update exhibit" });
  }
});

router.delete("/exhibits/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      `UPDATE exhibits SET is_active = false, updated_at = NOW()
       WHERE id = $1 AND organization_id = $2
       RETURNING *`,
      [id, req.organizationId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Exhibit not found" });
    }
    
    res.json({ message: "Exhibit deactivated" });
  } catch (error: any) {
    console.error("Error deleting exhibit:", error);
    res.status(500).json({ error: "Failed to delete exhibit" });
  }
});

export default router;

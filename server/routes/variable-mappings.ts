import { Router, Request, Response } from "express";
import { Pool } from "pg";
import { requireAuth } from "../middleware/auth";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const router = Router();

router.use(requireAuth);

router.get("/variable-mappings", async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT * FROM variable_mappings WHERE organization_id = $1 ORDER BY variable_name`,
      [req.organizationId]
    );
    res.json(result.rows);
  } catch (error: any) {
    console.error("Error fetching variable mappings:", error);
    res.status(500).json({ error: "Failed to fetch variable mappings" });
  }
});

router.get("/variable-mappings/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT * FROM variable_mappings 
       WHERE id = $1 AND organization_id = $2`,
      [id, req.organizationId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Variable mapping not found" });
    }
    
    res.json(result.rows[0]);
  } catch (error: any) {
    console.error("Error fetching variable mapping:", error);
    res.status(500).json({ error: "Failed to fetch variable mapping" });
  }
});

router.post("/variable-mappings", async (req: Request, res: Response) => {
  try {
    const { variableName, sourcePath, description } = req.body;
    
    if (!variableName || !sourcePath) {
      return res.status(400).json({ error: "variableName and sourcePath are required" });
    }
    
    const result = await pool.query(
      `INSERT INTO variable_mappings (organization_id, variable_name, source_path, description)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [req.organizationId, variableName, sourcePath, description]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    console.error("Error creating variable mapping:", error);
    res.status(500).json({ error: "Failed to create variable mapping" });
  }
});

router.patch("/variable-mappings/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { variableName, sourcePath, description } = req.body;
    
    const result = await pool.query(
      `UPDATE variable_mappings SET 
       variable_name = COALESCE($3, variable_name),
       source_path = COALESCE($4, source_path),
       description = COALESCE($5, description),
       updated_at = NOW()
       WHERE id = $1 AND organization_id = $2
       RETURNING *`,
      [id, req.organizationId, variableName, sourcePath, description]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Variable mapping not found" });
    }
    
    res.json(result.rows[0]);
  } catch (error: any) {
    console.error("Error updating variable mapping:", error);
    res.status(500).json({ error: "Failed to update variable mapping" });
  }
});

router.delete("/variable-mappings/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      `DELETE FROM variable_mappings 
       WHERE id = $1 AND organization_id = $2
       RETURNING *`,
      [id, req.organizationId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Variable mapping not found" });
    }
    
    res.json({ message: "Variable mapping deleted" });
  } catch (error: any) {
    console.error("Error deleting variable mapping:", error);
    res.status(500).json({ error: "Failed to delete variable mapping" });
  }
});

export default router;

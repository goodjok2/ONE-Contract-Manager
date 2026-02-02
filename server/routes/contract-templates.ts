import { Router, Request, Response } from "express";
import { Pool } from "pg";
import { requireAuth } from "../middleware/auth";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const router = Router();

router.use(requireAuth);

router.get("/contract-templates", async (req: Request, res: Response) => {
  try {
    const { contractType } = req.query;
    
    let query = `SELECT * FROM contract_templates WHERE organization_id = $1 AND is_active = true`;
    const params: any[] = [req.organizationId];
    
    if (contractType) {
      query += ` AND contract_type = $2`;
      params.push(contractType);
    }
    
    query += ` ORDER BY name`;
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error: any) {
    console.error("Error fetching contract templates:", error);
    res.status(500).json({ error: "Failed to fetch contract templates" });
  }
});

router.get("/contract-templates/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT * FROM contract_templates 
       WHERE id = $1 AND organization_id = $2`,
      [id, req.organizationId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Contract template not found" });
    }
    
    res.json(result.rows[0]);
  } catch (error: any) {
    console.error("Error fetching contract template:", error);
    res.status(500).json({ error: "Failed to fetch contract template" });
  }
});

router.post("/contract-templates", async (req: Request, res: Response) => {
  try {
    const { name, contractType, version, content } = req.body;
    
    const result = await pool.query(
      `INSERT INTO contract_templates (organization_id, name, contract_type, version, content)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [req.organizationId, name, contractType, version, content]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    console.error("Error creating contract template:", error);
    res.status(500).json({ error: "Failed to create contract template" });
  }
});

router.patch("/contract-templates/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, contractType, version, content, isActive } = req.body;
    
    const result = await pool.query(
      `UPDATE contract_templates SET 
       name = COALESCE($3, name),
       contract_type = COALESCE($4, contract_type),
       version = COALESCE($5, version),
       content = COALESCE($6, content),
       is_active = COALESCE($7, is_active),
       updated_at = NOW()
       WHERE id = $1 AND organization_id = $2
       RETURNING *`,
      [id, req.organizationId, name, contractType, version, content, isActive]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Contract template not found" });
    }
    
    res.json(result.rows[0]);
  } catch (error: any) {
    console.error("Error updating contract template:", error);
    res.status(500).json({ error: "Failed to update contract template" });
  }
});

router.delete("/contract-templates/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      `UPDATE contract_templates SET is_active = false, updated_at = NOW()
       WHERE id = $1 AND organization_id = $2
       RETURNING *`,
      [id, req.organizationId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Contract template not found" });
    }
    
    res.json({ message: "Contract template deactivated" });
  } catch (error: any) {
    console.error("Error deleting contract template:", error);
    res.status(500).json({ error: "Failed to delete contract template" });
  }
});

export default router;

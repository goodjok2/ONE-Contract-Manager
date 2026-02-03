import { Router, Request, Response } from "express";
import { Pool } from "pg";
import { requireAuth } from "../middleware/auth";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const router = Router();

router.use(requireAuth);

router.get("/contract-variables", async (req: Request, res: Response) => {
  try {
    const { category } = req.query;
    
    let query = `SELECT * FROM contract_variables WHERE organization_id = $1`;
    const params: any[] = [req.organizationId];
    
    if (category) {
      query += ` AND category = $2`;
      params.push(category);
    }
    
    query += ` ORDER BY category, variable_name`;
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error: any) {
    console.error("Error fetching contract variables:", error);
    res.status(500).json({ error: "Failed to fetch contract variables" });
  }
});

router.get("/contract-variables/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT * FROM contract_variables 
       WHERE id = $1 AND organization_id = $2`,
      [id, req.organizationId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Contract variable not found" });
    }
    
    res.json(result.rows[0]);
  } catch (error: any) {
    console.error("Error fetching contract variable:", error);
    res.status(500).json({ error: "Failed to fetch contract variable" });
  }
});

router.post("/contract-variables", async (req: Request, res: Response) => {
  try {
    const { variableName, displayName, category, dataType, defaultValue, description, isRequired } = req.body;
    
    const result = await pool.query(
      `INSERT INTO contract_variables (organization_id, variable_name, display_name, category, data_type, default_value, description, is_required)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [req.organizationId, variableName, displayName, category, dataType, defaultValue, description, isRequired]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    console.error("Error creating contract variable:", error);
    res.status(500).json({ error: "Failed to create contract variable" });
  }
});

router.patch("/contract-variables/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { variableName, displayName, category, dataType, defaultValue, description, isRequired } = req.body;
    
    const result = await pool.query(
      `UPDATE contract_variables SET 
       variable_name = COALESCE($3, variable_name),
       display_name = COALESCE($4, display_name),
       category = COALESCE($5, category),
       data_type = COALESCE($6, data_type),
       default_value = COALESCE($7, default_value),
       description = COALESCE($8, description),
       is_required = COALESCE($9, is_required)
       WHERE id = $1 AND organization_id = $2
       RETURNING *`,
      [id, req.organizationId, variableName, displayName, category, dataType, defaultValue, description, isRequired]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Contract variable not found" });
    }
    
    res.json(result.rows[0]);
  } catch (error: any) {
    console.error("Error updating contract variable:", error);
    res.status(500).json({ error: "Failed to update contract variable" });
  }
});

router.delete("/contract-variables/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      `DELETE FROM contract_variables 
       WHERE id = $1 AND organization_id = $2
       RETURNING *`,
      [id, req.organizationId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Contract variable not found" });
    }
    
    res.json({ message: "Contract variable deleted" });
  } catch (error: any) {
    console.error("Error deleting contract variable:", error);
    res.status(500).json({ error: "Failed to delete contract variable" });
  }
});

export default router;

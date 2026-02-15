import { Router, Request, Response } from "express";
import { Pool } from "pg";
import { requireAuth } from "../middleware/auth";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const router = Router();

router.use(requireAuth);

router.get("/components", async (req: Request, res: Response) => {
  try {
    const { serviceModel } = req.query;
    
    let query = `SELECT * FROM component_library WHERE organization_id = $1`;
    const params: any[] = [req.organizationId];
    
    if (serviceModel) {
      query += ` AND (service_model = $2 OR service_model IS NULL)`;
      params.push(serviceModel);
    }
    
    query += ` ORDER BY tag_name, service_model`;
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error: any) {
    console.error("Error fetching components:", error);
    res.status(500).json({ error: "Failed to fetch components" });
  }
});

router.get("/components/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT * FROM component_library 
       WHERE id = $1 AND organization_id = $2`,
      [id, req.organizationId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Component not found" });
    }
    
    res.json(result.rows[0]);
  } catch (error: any) {
    console.error("Error fetching component:", error);
    res.status(500).json({ error: "Failed to fetch component" });
  }
});

router.post("/components", async (req: Request, res: Response) => {
  try {
    const { tagName, content, description, serviceModel, isSystem } = req.body;
    
    if (!tagName || !content) {
      return res.status(400).json({ error: "tagName and content are required" });
    }
    
    const result = await pool.query(
      `INSERT INTO component_library (organization_id, tag_name, content, description, service_model, is_system)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [req.organizationId, tagName, content, description, serviceModel || null, isSystem || false]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    console.error("Error creating component:", error);
    res.status(500).json({ error: "Failed to create component" });
  }
});

router.patch("/components/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { tagName, content, description, serviceModel, isSystem, isActive } = req.body;
    
    const existingResult = await pool.query(
      `SELECT is_system FROM component_library WHERE id = $1 AND organization_id = $2`,
      [id, req.organizationId]
    );
    
    if (existingResult.rows.length === 0) {
      return res.status(404).json({ error: "Component not found" });
    }
    
    const result = await pool.query(
      `UPDATE component_library SET 
       tag_name = COALESCE($3, tag_name),
       content = COALESCE($4, content),
       description = COALESCE($5, description),
       service_model = COALESCE($6, service_model),
       is_system = COALESCE($7, is_system),
       is_active = COALESCE($8, is_active),
       updated_at = NOW()
       WHERE id = $1 AND organization_id = $2
       RETURNING *`,
      [id, req.organizationId, tagName, content, description, serviceModel, isSystem, isActive]
    );
    
    res.json(result.rows[0]);
  } catch (error: any) {
    console.error("Error updating component:", error);
    res.status(500).json({ error: "Failed to update component" });
  }
});

router.put("/components/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { tagName, content, description, serviceModel, isSystem, isActive } = req.body;
    
    const existingResult = await pool.query(
      `SELECT * FROM component_library WHERE id = $1 AND organization_id = $2`,
      [id, req.organizationId]
    );
    
    if (existingResult.rows.length === 0) {
      return res.status(404).json({ error: "Component not found" });
    }
    
    const result = await pool.query(
      `UPDATE component_library SET 
       tag_name = $3,
       content = $4,
       description = $5,
       service_model = $6,
       is_system = COALESCE($7, is_system),
       is_active = COALESCE($8, is_active),
       updated_at = NOW()
       WHERE id = $1 AND organization_id = $2
       RETURNING *`,
      [id, req.organizationId, tagName, content, description, serviceModel || null, isSystem, isActive]
    );
    
    res.json(result.rows[0]);
  } catch (error: any) {
    console.error("Error updating component:", error);
    res.status(500).json({ error: "Failed to update component" });
  }
});

router.delete("/components/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const checkResult = await pool.query(
      `SELECT is_system FROM component_library WHERE id = $1 AND organization_id = $2`,
      [id, req.organizationId]
    );
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: "Component not found" });
    }
    
    if (checkResult.rows[0].is_system) {
      return res.status(403).json({ error: "Cannot delete system components" });
    }
    
    await pool.query(
      `DELETE FROM component_library 
       WHERE id = $1 AND organization_id = $2`,
      [id, req.organizationId]
    );
    
    res.json({ message: "Component deleted" });
  } catch (error: any) {
    console.error("Error deleting component:", error);
    res.status(500).json({ error: "Failed to delete component" });
  }
});

export default router;

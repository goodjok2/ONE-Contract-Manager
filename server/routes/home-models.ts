import { Router, Request, Response } from "express";
import { Pool } from "pg";
import { requireAuth } from "../middleware/auth";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const router = Router();

router.use(requireAuth);

router.get("/home-models", async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT * FROM home_models 
       WHERE organization_id = $1 AND is_active = true 
       ORDER BY name`,
      [req.organizationId]
    );
    res.json(result.rows);
  } catch (error: any) {
    console.error("Error fetching home models:", error);
    res.status(500).json({ error: "Failed to fetch home models" });
  }
});

router.get("/home-models/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT * FROM home_models 
       WHERE id = $1 AND organization_id = $2`,
      [id, req.organizationId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Home model not found" });
    }
    
    res.json(result.rows[0]);
  } catch (error: any) {
    console.error("Error fetching home model:", error);
    res.status(500).json({ error: "Failed to fetch home model" });
  }
});

router.post("/home-models", async (req: Request, res: Response) => {
  try {
    const { name, modelCode, description, sqFt, bedrooms, bathrooms, stories, designFee, offsiteBasePrice, onsiteEstPrice } = req.body;
    
    const result = await pool.query(
      `INSERT INTO home_models (organization_id, name, model_code, description, sq_ft, bedrooms, bathrooms, stories, design_fee, offsite_base_price, onsite_est_price)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [req.organizationId, name, modelCode, description, sqFt, bedrooms, bathrooms, stories, designFee, offsiteBasePrice, onsiteEstPrice]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    console.error("Error creating home model:", error);
    res.status(500).json({ error: "Failed to create home model" });
  }
});

router.patch("/home-models/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, modelCode, description, sqFt, bedrooms, bathrooms, stories, designFee, offsiteBasePrice, onsiteEstPrice, isActive } = req.body;
    
    const result = await pool.query(
      `UPDATE home_models SET 
       name = COALESCE($3, name),
       model_code = COALESCE($4, model_code),
       description = COALESCE($5, description),
       sq_ft = COALESCE($6, sq_ft),
       bedrooms = COALESCE($7, bedrooms),
       bathrooms = COALESCE($8, bathrooms),
       stories = COALESCE($9, stories),
       design_fee = COALESCE($10, design_fee),
       offsite_base_price = COALESCE($11, offsite_base_price),
       onsite_est_price = COALESCE($12, onsite_est_price),
       is_active = COALESCE($13, is_active),
       updated_at = NOW()
       WHERE id = $1 AND organization_id = $2
       RETURNING *`,
      [id, req.organizationId, name, modelCode, description, sqFt, bedrooms, bathrooms, stories, designFee, offsiteBasePrice, onsiteEstPrice, isActive]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Home model not found" });
    }
    
    res.json(result.rows[0]);
  } catch (error: any) {
    console.error("Error updating home model:", error);
    res.status(500).json({ error: "Failed to update home model" });
  }
});

router.delete("/home-models/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      `UPDATE home_models SET is_active = false, updated_at = NOW()
       WHERE id = $1 AND organization_id = $2
       RETURNING *`,
      [id, req.organizationId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Home model not found" });
    }
    
    res.json({ message: "Home model deactivated" });
  } catch (error: any) {
    console.error("Error deleting home model:", error);
    res.status(500).json({ error: "Failed to delete home model" });
  }
});

export default router;

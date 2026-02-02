import { Router, Request, Response } from "express";
import { Pool } from "pg";
import { requireAuth } from "../middleware/auth";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const router = Router();

router.use(requireAuth);

router.get("/llcs-v3", async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT * FROM llcs 
       WHERE organization_id = $1 
       ORDER BY name`,
      [req.organizationId]
    );
    res.json(result.rows);
  } catch (error: any) {
    console.error("Error fetching LLCs:", error);
    res.status(500).json({ error: "Failed to fetch LLCs" });
  }
});

router.get("/llcs-v3/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT * FROM llcs 
       WHERE id = $1 AND organization_id = $2`,
      [id, req.organizationId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "LLC not found" });
    }
    
    res.json(result.rows[0]);
  } catch (error: any) {
    console.error("Error fetching LLC:", error);
    res.status(500).json({ error: "Failed to fetch LLC" });
  }
});

export default router;

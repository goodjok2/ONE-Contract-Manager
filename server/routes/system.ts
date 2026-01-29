import { Router } from "express";
import { db } from "../db/index";
import { pool } from "../db";
import { contracts, llcs, financials, projects } from "../../shared/schema";
import { eq, or, count, countDistinct, sql } from "drizzle-orm";

const router = Router();

// ---------------------------------------------------------------------------
// DASHBOARD
// ---------------------------------------------------------------------------

router.get("/dashboard/stats", async (req, res) => {
  try {
    const totalPackagesResult = await db
      .select({ count: countDistinct(contracts.projectId) })
      .from(contracts);
    
    const allContracts = await db
      .select({
        projectId: contracts.projectId,
        contractType: contracts.contractType,
        status: contracts.status,
      })
      .from(contracts);
    
    const packagesByProject = new Map<number, { status: string }>();
    allContracts.forEach(c => {
      if (c.projectId && c.contractType === 'one_agreement') {
        packagesByProject.set(c.projectId, { status: c.status || 'Draft' });
      }
    });
    
    let draftsCount = 0;
    let pendingCount = 0;
    let signedCount = 0;
    
    packagesByProject.forEach(pkg => {
      const status = pkg.status.toLowerCase();
      if (status === 'draft') {
        draftsCount++;
      } else if (status === 'pendingreview' || status === 'pending_review' || status === 'pending') {
        pendingCount++;
      } else if (status === 'executed' || status === 'signed') {
        signedCount++;
      }
    });
    
    const pendingLLCsResult = await db
      .select({ count: count() })
      .from(llcs)
      .where(or(
        eq(llcs.status, 'pending'),
        eq(llcs.status, 'forming')
      ));
    
    const activeProjectsCount = packagesByProject.size - draftsCount;
    
    const financialsData = await db.select().from(financials);
    const projectValues = new Map<number, number>();
    financialsData.forEach(f => {
      const value = ((f.designFee || 0) + (f.prelimOffsite || 0) + (f.prelimOnsite || 0)) / 100;
      projectValues.set(f.projectId, value);
    });
    
    let totalValue = 0;
    let draftsValue = 0;
    let pendingValue = 0;
    let signedValue = 0;
    
    packagesByProject.forEach((pkg, projectId) => {
      const value = projectValues.get(projectId) || 0;
      totalValue += value;
      const status = pkg.status.toLowerCase();
      if (status === 'draft') {
        draftsValue += value;
      } else if (status === 'pendingreview' || status === 'pending_review' || status === 'pending') {
        pendingValue += value;
      } else if (status === 'executed' || status === 'signed') {
        signedValue += value;
      }
    });
    
    res.json({
      totalContracts: totalPackagesResult[0]?.count ?? 0,
      drafts: draftsCount,
      pendingReview: pendingCount,
      signed: signedCount,
      pendingLLCs: pendingLLCsResult[0]?.count ?? 0,
      activeProjects: activeProjectsCount,
      totalContractValue: totalValue,
      draftsValue,
      pendingValue,
      signedValue,
    });
  } catch (error) {
    console.error("Failed to fetch dashboard stats:", error);
    res.status(500).json({ error: "Failed to fetch dashboard stats" });
  }
});

// ---------------------------------------------------------------------------
// VARIABLES ENDPOINTS
// ---------------------------------------------------------------------------

router.get("/variables", async (_req, res) => {
  try {
    const { VARIABLE_CATEGORIES, ALL_VARIABLES } = await import("../lib/mapper");
    
    const variables = Object.entries(VARIABLE_CATEGORIES).map(([category, vars]) => ({
      category,
      variables: (vars as string[]).map((name: string) => ({
        name,
        category,
      }))
    }));
    
    res.json({
      categories: variables,
      allVariables: ALL_VARIABLES,
      totalCount: ALL_VARIABLES.length
    });
  } catch (error) {
    console.error("Failed to fetch variables:", error);
    res.status(500).json({ error: "Failed to fetch variables" });
  }
});

// ---------------------------------------------------------------------------
// VARIABLE MAPPINGS API (for Contract Variable Management)
// ---------------------------------------------------------------------------

router.get("/variable-mappings", async (req, res) => {
  try {
    const { search } = req.query;
    
    let variablesQuery = `
      SELECT * FROM contract_variables
      ORDER BY category, variable_name
    `;
    
    const variablesResult = await pool.query(variablesQuery);
    let variables = variablesResult.rows;
    
    if (search && typeof search === 'string') {
      const searchLower = search.toLowerCase();
      variables = variables.filter((v: any) => 
        v.variable_name?.toLowerCase().includes(searchLower) ||
        v.display_name?.toLowerCase().includes(searchLower) ||
        v.category?.toLowerCase().includes(searchLower)
      );
    }
    
    const clauseUsageQuery = `
      SELECT id, clause_code, name, content, contract_type, hierarchy_level
      FROM clauses
      WHERE content LIKE '%{{%'
    `;
    const clausesResult = await pool.query(clauseUsageQuery);
    const clausesWithVariables = clausesResult.rows;
    
    const variableToClausesMap: Record<string, any[]> = {};
    
    for (const clause of clausesWithVariables) {
      const variablePattern = /\{\{([A-Z0-9_]+)\}\}/gi;
      let match;
      while ((match = variablePattern.exec(clause.content)) !== null) {
        const varName = match[1];
        if (!variableToClausesMap[varName]) {
          variableToClausesMap[varName] = [];
        }
        if (!variableToClausesMap[varName].some((c: any) => c.id === clause.id)) {
          variableToClausesMap[varName].push({
            id: clause.id,
            clauseCode: clause.clause_code,
            name: clause.name,
            contractType: clause.contract_type,
            hierarchyLevel: clause.hierarchy_level
          });
        }
      }
    }
    
    const enrichedVariables = variables.map((v: any) => ({
      id: v.id,
      variableName: v.variable_name,
      displayName: v.display_name,
      category: v.category,
      dataType: v.data_type,
      defaultValue: v.default_value,
      isRequired: v.is_required,
      description: v.description,
      erpSource: v.erp_source,
      usedInContracts: v.used_in_contracts,
      clauseUsage: variableToClausesMap[v.variable_name] || [],
      clauseCount: (variableToClausesMap[v.variable_name] || []).length
    }));
    
    const stats = {
      totalFields: enrichedVariables.length,
      erpMapped: enrichedVariables.filter((v: any) => v.erpSource).length,
      required: enrichedVariables.filter((v: any) => v.isRequired).length
    };
    
    res.json({
      variables: enrichedVariables,
      stats
    });
  } catch (error) {
    console.error("Failed to fetch variable mappings:", error);
    res.status(500).json({ error: "Failed to fetch variable mappings" });
  }
});

router.post("/variable-mappings", async (req, res) => {
  try {
    const { variableName, displayName, category, dataType, defaultValue, isRequired, description, erpSource } = req.body;
    
    if (!variableName) {
      return res.status(400).json({ error: "variableName is required" });
    }
    
    const insertQuery = `
      INSERT INTO contract_variables (variable_name, display_name, category, data_type, default_value, is_required, description, erp_source)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;
    
    const result = await pool.query(insertQuery, [
      variableName,
      displayName || null,
      category || null,
      dataType || 'text',
      defaultValue || null,
      isRequired || false,
      description || null,
      erpSource || null
    ]);
    
    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    if (error.code === '23505') {
      return res.status(409).json({ error: "Variable name already exists" });
    }
    console.error("Failed to create variable:", error);
    res.status(500).json({ error: "Failed to create variable" });
  }
});

router.patch("/variable-mappings/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { variableName, displayName, category, dataType, defaultValue, isRequired, description, erpSource } = req.body;
    
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;
    
    if (variableName !== undefined) { updates.push(`variable_name = $${paramIndex++}`); values.push(variableName); }
    if (displayName !== undefined) { updates.push(`display_name = $${paramIndex++}`); values.push(displayName); }
    if (category !== undefined) { updates.push(`category = $${paramIndex++}`); values.push(category); }
    if (dataType !== undefined) { updates.push(`data_type = $${paramIndex++}`); values.push(dataType); }
    if (defaultValue !== undefined) { updates.push(`default_value = $${paramIndex++}`); values.push(defaultValue); }
    if (isRequired !== undefined) { updates.push(`is_required = $${paramIndex++}`); values.push(isRequired); }
    if (description !== undefined) { updates.push(`description = $${paramIndex++}`); values.push(description); }
    if (erpSource !== undefined) { updates.push(`erp_source = $${paramIndex++}`); values.push(erpSource); }
    
    if (updates.length === 0) {
      return res.status(400).json({ error: "No fields to update" });
    }
    
    values.push(parseInt(id));
    const updateQuery = `
      UPDATE contract_variables
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;
    
    const result = await pool.query(updateQuery, values);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Variable not found" });
    }
    
    res.json(result.rows[0]);
  } catch (error: any) {
    if (error.code === '23505') {
      return res.status(409).json({ error: "Variable name already exists" });
    }
    console.error("Failed to update variable:", error);
    res.status(500).json({ error: "Failed to update variable" });
  }
});

router.delete("/variable-mappings/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    const deleteQuery = `DELETE FROM contract_variables WHERE id = $1 RETURNING *`;
    const result = await pool.query(deleteQuery, [parseInt(id)]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Variable not found" });
    }
    
    res.json({ message: "Variable deleted successfully", deleted: result.rows[0] });
  } catch (error) {
    console.error("Failed to delete variable:", error);
    res.status(500).json({ error: "Failed to delete variable" });
  }
});

// ---------------------------------------------------------------------------
// ADMIN ENDPOINTS
// ---------------------------------------------------------------------------

router.post("/admin/cleanup-duplicate-drafts", async (req, res) => {
  try {
    const duplicatesQuery = `
      WITH ranked_drafts AS (
        SELECT 
          id, 
          name, 
          project_number,
          created_at,
          ROW_NUMBER() OVER (PARTITION BY name ORDER BY created_at DESC) as rn
        FROM projects
        WHERE status = 'Draft'
      )
      SELECT id, name, project_number, created_at
      FROM ranked_drafts
      WHERE rn > 1
      ORDER BY name, created_at DESC
    `;
    
    const duplicates = await pool.query(duplicatesQuery);
    
    if (duplicates.rows.length === 0) {
      return res.json({ 
        message: "No duplicate drafts found", 
        deleted: [] 
      });
    }
    
    const idsToDelete = duplicates.rows.map(r => r.id);
    await db.delete(projects).where(
      sql`id = ANY(${idsToDelete})`
    );
    
    res.json({
      message: `Cleaned up ${duplicates.rows.length} duplicate drafts`,
      deleted: duplicates.rows.map(r => ({
        id: r.id,
        name: r.name,
        projectNumber: r.project_number
      }))
    });
  } catch (error: any) {
    console.error("Failed to cleanup duplicate drafts:", error);
    res.status(500).json({ 
      error: "Failed to cleanup duplicates",
      details: error?.message 
    });
  }
});

export default router;

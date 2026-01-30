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

// ---------------------------------------------------------------------------
// DEBUG: MIGRATE CLAUSES FOR HTML TABLES
// ---------------------------------------------------------------------------

router.post("/debug/migrate-clauses", async (req, res) => {
  try {
    const results: { clause: string; action: string }[] = [];
    
    // Find and update Payment Terms clause
    const paymentTermsResult = await pool.query(`
      SELECT id, clause_code, name, category, content 
      FROM clauses 
      WHERE LOWER(name) LIKE '%payment%' 
         OR LOWER(category) LIKE '%payment%'
         OR LOWER(clause_code) LIKE '%payment%'
      LIMIT 5
    `);
    
    if (paymentTermsResult.rows.length > 0) {
      for (const clause of paymentTermsResult.rows) {
        // Check if already has the table variable
        if (clause.content && clause.content.includes('{{PAYMENT_SCHEDULE_TABLE}}')) {
          results.push({ 
            clause: `${clause.clause_code} (${clause.name})`, 
            action: 'Already has PAYMENT_SCHEDULE_TABLE - skipped' 
          });
        } else {
          results.push({ 
            clause: `${clause.clause_code} (${clause.name})`, 
            action: 'Found - manual update recommended to add {{PAYMENT_SCHEDULE_TABLE}}' 
          });
        }
      }
    } else {
      results.push({ 
        clause: 'Payment Terms', 
        action: 'Not found - manual update required via Clause Library UI' 
      });
    }
    
    // Find and update Contract Price / Recital H clause
    const pricingResult = await pool.query(`
      SELECT id, clause_code, name, category, content 
      FROM clauses 
      WHERE LOWER(name) LIKE '%price%' 
         OR LOWER(name) LIKE '%recital%'
         OR LOWER(clause_code) LIKE '%price%'
         OR LOWER(clause_code) LIKE '%recital%h%'
      LIMIT 5
    `);
    
    if (pricingResult.rows.length > 0) {
      for (const clause of pricingResult.rows) {
        // Check if already has the table variable
        if (clause.content && clause.content.includes('{{PRICING_BREAKDOWN_TABLE}}')) {
          results.push({ 
            clause: `${clause.clause_code} (${clause.name})`, 
            action: 'Already has PRICING_BREAKDOWN_TABLE - skipped' 
          });
        } else {
          results.push({ 
            clause: `${clause.clause_code} (${clause.name})`, 
            action: 'Found - manual update recommended to add {{PRICING_BREAKDOWN_TABLE}}' 
          });
        }
      }
    } else {
      results.push({ 
        clause: 'Contract Price / Recital H', 
        action: 'Not found - manual update required via Clause Library UI' 
      });
    }
    
    console.log('📋 Clause Migration Results:', results);
    
    res.json({
      message: 'Clause migration scan complete',
      note: 'Automatic updates disabled for safety. Please use the Clause Library UI to update clause text with the new table variables.',
      variables: {
        PRICING_BREAKDOWN_TABLE: 'Renders pricing breakdown as HTML table',
        PAYMENT_SCHEDULE_TABLE: 'Renders payment schedule milestones as HTML table'
      },
      results
    });
  } catch (error: any) {
    console.error("Failed to scan clauses for migration:", error);
    res.status(500).json({ 
      error: "Failed to scan clauses",
      details: error?.message 
    });
  }
});

// POST /api/debug/apply-table-variables - Apply dynamic table variables to specific clauses
router.post("/debug/apply-table-variables", async (req, res) => {
  try {
    const updated: string[] = [];
    const errors: string[] = [];

    // 1. Update ONE-EXHIBIT-C with Payment Schedule Table
    const exhibitCResult = await pool.query(`
      UPDATE clauses 
      SET content = $1
      WHERE clause_code = 'ONE-EXHIBIT-C'
      RETURNING clause_code, name
    `, ['{{PAYMENT_SCHEDULE_TABLE}}']);

    if (exhibitCResult.rowCount && exhibitCResult.rowCount > 0) {
      updated.push(`ONE-EXHIBIT-C (${exhibitCResult.rows[0].name})`);
      console.log('✓ Updated ONE-EXHIBIT-C with PAYMENT_SCHEDULE_TABLE');
    } else {
      errors.push('ONE-EXHIBIT-C not found');
    }

    // 2. Update ONE-RECITAL-H with Pricing Breakdown Table (or search for "total preliminary project cost")
    const recitalHResult = await pool.query(`
      UPDATE clauses 
      SET content = $1
      WHERE clause_code = 'ONE-RECITAL-H'
      RETURNING clause_code, name
    `, ['<p>The total preliminary project cost breakdown is as follows:</p>{{PRICING_BREAKDOWN_TABLE}}']);

    if (recitalHResult.rowCount && recitalHResult.rowCount > 0) {
      updated.push(`ONE-RECITAL-H (${recitalHResult.rows[0].name})`);
      console.log('✓ Updated ONE-RECITAL-H with PRICING_BREAKDOWN_TABLE');
    } else {
      // Fallback: search for clause containing "total preliminary project cost"
      const fallbackResult = await pool.query(`
        UPDATE clauses 
        SET content = $1
        WHERE LOWER(content) LIKE '%total preliminary project cost%'
        RETURNING clause_code, name
      `, ['<p>The total preliminary project cost breakdown is as follows:</p>{{PRICING_BREAKDOWN_TABLE}}']);

      if (fallbackResult.rowCount && fallbackResult.rowCount > 0) {
        for (const row of fallbackResult.rows) {
          updated.push(`${row.clause_code} (${row.name}) [fallback match]`);
          console.log(`✓ Updated ${row.clause_code} with PRICING_BREAKDOWN_TABLE (fallback)`);
        }
      } else {
        errors.push('ONE-RECITAL-H not found and no fallback clause with "total preliminary project cost" found');
      }
    }

    // 3. Update ONE-EXHIBIT-A with Unit Details Table
    const exhibitAResult = await pool.query(`
      UPDATE clauses 
      SET content = $1
      WHERE clause_code = 'ONE-EXHIBIT-A'
      RETURNING clause_code, name
    `, ['<p><strong>Unit Breakdown</strong></p>{{UNIT_DETAILS_TABLE}}']);

    if (exhibitAResult.rowCount && exhibitAResult.rowCount > 0) {
      updated.push(`ONE-EXHIBIT-A (${exhibitAResult.rows[0].name})`);
      console.log('✓ Updated ONE-EXHIBIT-A with UNIT_DETAILS_TABLE');
    } else {
      // Fallback: search for clause containing "unit breakdown" or similar
      const fallbackAResult = await pool.query(`
        UPDATE clauses 
        SET content = $1
        WHERE LOWER(name) LIKE '%exhibit a%' OR LOWER(content) LIKE '%unit breakdown%'
        RETURNING clause_code, name
      `, ['<p><strong>Unit Breakdown</strong></p>{{UNIT_DETAILS_TABLE}}']);

      if (fallbackAResult.rowCount && fallbackAResult.rowCount > 0) {
        for (const row of fallbackAResult.rows) {
          updated.push(`${row.clause_code} (${row.name}) [fallback match]`);
          console.log(`✓ Updated ${row.clause_code} with UNIT_DETAILS_TABLE (fallback)`);
        }
      } else {
        errors.push('ONE-EXHIBIT-A not found and no fallback clause for Unit Breakdown found');
      }
    }

    console.log('📋 Apply Table Variables Results:', { updated, errors });

    res.json({
      message: 'Table variables applied',
      updated,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error: any) {
    console.error("Failed to apply table variables:", error);
    res.status(500).json({ 
      error: "Failed to apply table variables",
      details: error?.message 
    });
  }
});

// ---------------------------------------------------------------------------
// MIGRATION: Add schedule duration columns to projects table
// ---------------------------------------------------------------------------
router.post("/debug/migrate-schedule-columns", async (req, res) => {
  try {
    const migrationSql = `
      ALTER TABLE projects 
      ADD COLUMN IF NOT EXISTS design_duration INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS permitting_duration INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS production_duration INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS delivery_duration INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS completion_duration INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS estimated_delivery_date TIMESTAMP,
      ADD COLUMN IF NOT EXISTS estimated_completion_date TIMESTAMP;
    `;
    
    await pool.query(migrationSql);
    
    res.json({
      success: true,
      message: 'Schedule duration columns added to projects table',
      columnsAdded: [
        'design_duration',
        'permitting_duration', 
        'production_duration',
        'delivery_duration',
        'completion_duration',
        'estimated_delivery_date',
        'estimated_completion_date'
      ]
    });
  } catch (error: any) {
    console.error("Migration failed:", error);
    res.status(500).json({ 
      error: "Migration failed",
      details: error?.message 
    });
  }
});

// ---------------------------------------------------------------------------
// DEBUG: Fix Contract Content (Ghost Headers, Renumbering, Redundant Tables)
// ---------------------------------------------------------------------------

router.post("/debug/fix-content", async (req, res) => {
  try {
    console.log('\n========================================');
    console.log('  CONTRACT CONTENT FIX SCRIPT');
    console.log('========================================\n');

    const deleted: string[] = [];
    const updated: string[] = [];
    const errors: string[] = [];

    // STEP 1: Delete Ghost Headers
    console.log('STEP 1: Deleting ghost/duplicate section headers...\n');

    const ghostHeaderPatterns = [
      { pattern: 'Section 7. Intellectual Property', reason: 'Duplicate of Section 12' },
      { pattern: 'Section 8. Limitation of Liability', reason: 'Duplicate of Section 9' },
      { pattern: 'Section 9. No Obligation to Purchase', reason: 'Conflicting header' },
      { pattern: 'Section 12. Default', reason: 'Conflicting header' },
      { pattern: 'Section 13. Miscellaneous Provisions', reason: 'Duplicate of General Provisions' },
    ];

    for (const { pattern, reason } of ghostHeaderPatterns) {
      try {
        const result = await db.execute(sql`
          DELETE FROM clauses 
          WHERE name LIKE ${pattern + '%'} 
          AND contract_type = 'ONE Agreement'
          RETURNING id, clause_code, name
        `);
        
        if (result.rows && result.rows.length > 0) {
          for (const row of result.rows as any[]) {
            const msg = `Deleted [${row.id}] ${row.clause_code}: "${row.name}" (${reason})`;
            console.log(`  ✗ ${msg}`);
            deleted.push(msg);
          }
        }
      } catch (err: any) {
        const errMsg = `Failed to delete "${pattern}": ${err.message}`;
        console.error(`  ⚠️ ${errMsg}`);
        errors.push(errMsg);
      }
    }

    // STEP 2: Renumber Section 3.4 Financial Obligations to 3.5
    console.log('\nSTEP 2: Renumbering Section 3.4 Financial Obligations to 3.5...\n');

    try {
      const result = await db.execute(sql`
        UPDATE clauses 
        SET 
          clause_code = 'ONE-3.5-FIN',
          name = '3.5. Financial Obligations',
          sort_order = 355
        WHERE id = 285 
          AND contract_type = 'ONE Agreement'
        RETURNING id, clause_code, name
      `);
      
      if (result.rows && result.rows.length > 0) {
        const row = (result.rows as any[])[0];
        const msg = `Renumbered [${row.id}] to ${row.clause_code}: "${row.name}"`;
        console.log(`  ✓ ${msg}`);
        updated.push(msg);
      }
    } catch (err: any) {
      errors.push(`Failed to renumber Section 3.4: ${err.message}`);
    }

    // STEP 3: Simplify Section 2.4
    console.log('\nSTEP 3: Simplifying Section 2.4 (removing redundant table)...\n');

    try {
      const newContent24 = `2.4. TOTAL PRELIMINARY PROJECT COST

TOTAL PRELIMINARY PROJECT COST (At Signing): {{PRELIMINARY_CONTRACT_PRICE}}

The Total Preliminary Project Cost breakdown is set forth in **Recital H**.

This preliminary estimate is subject to adjustment as provided in Section 2.6 (Pricing Adjustments and Final Contract Price).`;

      const result = await db.execute(sql`
        UPDATE clauses 
        SET content = ${newContent24}
        WHERE clause_code = 'ONE-2.4' 
          AND contract_type = 'ONE Agreement'
        RETURNING id, clause_code, name
      `);
      
      if (result.rows && result.rows.length > 0) {
        const row = (result.rows as any[])[0];
        const msg = `Simplified [${row.id}] ${row.clause_code}: "${row.name}"`;
        console.log(`  ✓ ${msg}`);
        updated.push(msg);
      }
    } catch (err: any) {
      errors.push(`Failed to simplify Section 2.4: ${err.message}`);
    }

    // STEP 4: Simplify Section 2.8
    console.log('\nSTEP 4: Simplifying Section 2.8 (removing redundant table)...\n');

    try {
      const newContent28 = `2.8. PAYMENT SCHEDULE

All payments under this Agreement shall be made according to the Payment Schedule set forth in **Exhibit C**.

Payment terms, milestone triggers, and amounts are detailed in the Payment Schedule exhibit attached hereto.`;

      const result = await db.execute(sql`
        UPDATE clauses 
        SET content = ${newContent28}
        WHERE clause_code = 'ONE-2.8' 
          AND contract_type = 'ONE Agreement'
        RETURNING id, clause_code, name
      `);
      
      if (result.rows && result.rows.length > 0) {
        const row = (result.rows as any[])[0];
        const msg = `Simplified [${row.id}] ${row.clause_code}: "${row.name}"`;
        console.log(`  ✓ ${msg}`);
        updated.push(msg);
      }
    } catch (err: any) {
      errors.push(`Failed to simplify Section 2.8: ${err.message}`);
    }

    console.log('\n========================================');
    console.log(`  SUMMARY: Deleted ${deleted.length}, Updated ${updated.length}, Errors ${errors.length}`);
    console.log('========================================\n');

    res.json({
      success: errors.length === 0,
      deleted,
      updated,
      errors,
      summary: {
        deletedCount: deleted.length,
        updatedCount: updated.length,
        errorCount: errors.length
      }
    });

  } catch (error: any) {
    console.error("Fix content script failed:", error);
    res.status(500).json({ 
      error: "Fix content script failed",
      details: error?.message 
    });
  }
});

// ---------------------------------------------------------------------------
// DYNAMIC RESET - Symmetric CRC/CMOS slot ordering
// ---------------------------------------------------------------------------
router.post("/debug/reset-dynamic", async (req, res) => {
  try {
    const { runDynamicReset } = await import('../scripts/reset-contract-structure-dynamic');
    const result = await runDynamicReset();
    
    res.json({
      success: true,
      message: "Dynamic reset completed",
      summary: {
        updated: result.updated.length,
        created: result.created.length,
        deleted: result.deleted.length,
        errors: result.errors.length
      },
      details: result
    });
  } catch (error: any) {
    console.error("Dynamic reset failed:", error);
    res.status(500).json({ 
      error: "Dynamic reset failed",
      details: error?.message 
    });
  }
});

// ---------------------------------------------------------------------------
// FORCE CONTRACT ORDER - Fix numbering collisions
// ---------------------------------------------------------------------------
router.post("/debug/force-order", async (req, res) => {
  try {
    const { runForceOrder } = await import('../scripts/force-contract-order');
    const result = await runForceOrder();
    
    res.json({
      success: true,
      message: "Force order completed",
      summary: {
        updated: result.updated.length,
        created: result.created.length,
        errors: result.errors.length
      },
      details: result
    });
  } catch (error: any) {
    console.error("Force order failed:", error);
    res.status(500).json({ 
      error: "Force order failed",
      details: error?.message 
    });
  }
});

// ---------------------------------------------------------------------------
// GRANDMASTER CONTENT REPAIR - Comprehensive clause cleanup
// ---------------------------------------------------------------------------
router.post("/debug/fix-grandmaster", async (req, res) => {
  try {
    const { runGrandmasterRepair } = await import('../scripts/fix-content-master');
    const result = await runGrandmasterRepair();
    
    res.json({
      success: true,
      message: "Grandmaster repair completed",
      summary: {
        renamed: result.renamed.length,
        deleted: result.deleted.length,
        created: result.created.length,
        errors: result.errors.length
      },
      details: result
    });
  } catch (error: any) {
    console.error("Grandmaster repair failed:", error);
    res.status(500).json({ 
      error: "Grandmaster repair failed",
      details: error?.message 
    });
  }
});

export default router;

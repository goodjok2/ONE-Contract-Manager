import { Router } from "express";
import { db } from "../db/index";
import { pool } from "../db";
import { contracts, financials, projects } from "../../shared/schema";
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
    
    // LLC stats temporarily disabled (Phase A refactoring - llcs table removed)
    const pendingLLCsCount = 0;
    
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
      pendingLLCs: pendingLLCsCount,
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
    
    // Use atomic clause structure (body_html contains variables)
    const clauseUsageQuery = `
      SELECT id, slug, header_text, body_html, contract_types, level
      FROM clauses
      WHERE body_html LIKE '%{{%'
    `;
    const clausesResult = await pool.query(clauseUsageQuery);
    const clausesWithVariables = clausesResult.rows;
    
    const variableToClausesMap: Record<string, any[]> = {};
    
    for (const clause of clausesWithVariables) {
      const variablePattern = /\{\{([A-Z0-9_]+)\}\}/gi;
      let match;
      const content = clause.body_html || '';
      while ((match = variablePattern.exec(content)) !== null) {
        const varName = match[1];
        if (!variableToClausesMap[varName]) {
          variableToClausesMap[varName] = [];
        }
        if (!variableToClausesMap[varName].some((c: any) => c.id === clause.id)) {
          variableToClausesMap[varName].push({
            id: clause.id,
            clauseCode: clause.slug,
            name: clause.header_text,
            contractType: clause.contract_types,
            hierarchyLevel: clause.level
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
      clauseCount: (variableToClausesMap[v.variable_name] || []).length,
      isRegistered: true
    }));
    
    // Find unregistered variables (used in clauses but not in registry)
    const registeredVarNames = new Set(variables.map((v: any) => v.variable_name));
    const unregisteredVariables: any[] = [];
    
    for (const [varName, clauses] of Object.entries(variableToClausesMap)) {
      if (!registeredVarNames.has(varName)) {
        unregisteredVariables.push({
          id: null,
          variableName: varName,
          displayName: null,
          category: null,
          dataType: 'text',
          defaultValue: null,
          isRequired: false,
          description: null,
          erpSource: null,
          usedInContracts: null,
          clauseUsage: clauses,
          clauseCount: clauses.length,
          isRegistered: false
        });
      }
    }
    
    // Filter unregistered variables by search if applicable
    let filteredUnregistered = unregisteredVariables;
    if (search && typeof search === 'string') {
      const searchLower = search.toLowerCase();
      filteredUnregistered = unregisteredVariables.filter((v: any) => 
        v.variableName.toLowerCase().includes(searchLower)
      );
    }
    
    const stats = {
      totalFields: enrichedVariables.length,
      erpMapped: enrichedVariables.filter((v: any) => v.erpSource).length,
      required: enrichedVariables.filter((v: any) => v.isRequired).length,
      unregistered: unregisteredVariables.length
    };
    
    res.json({
      variables: enrichedVariables,
      unregisteredVariables: filteredUnregistered,
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
    
    // Find and update Payment Terms clause (using atomic clause structure)
    const paymentTermsResult = await pool.query(`
      SELECT id, slug, header_text, body_html, tags 
      FROM clauses 
      WHERE LOWER(header_text) LIKE '%payment%' 
         OR LOWER(slug) LIKE '%payment%'
      LIMIT 5
    `);
    
    if (paymentTermsResult.rows.length > 0) {
      for (const clause of paymentTermsResult.rows) {
        const bodyHtml = clause.body_html || '';
        // Check if already has the table variable
        if (bodyHtml.includes('{{PAYMENT_SCHEDULE_TABLE}}')) {
          results.push({ 
            clause: `${clause.slug} (${clause.header_text})`, 
            action: 'Already has PAYMENT_SCHEDULE_TABLE - skipped' 
          });
        } else {
          results.push({ 
            clause: `${clause.slug} (${clause.header_text})`, 
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
    
    // Find and update Contract Price / Recital H clause (using atomic clause structure)
    const pricingResult = await pool.query(`
      SELECT id, slug, header_text, body_html, tags 
      FROM clauses 
      WHERE LOWER(header_text) LIKE '%price%' 
         OR LOWER(header_text) LIKE '%recital%'
         OR LOWER(slug) LIKE '%price%'
         OR LOWER(slug) LIKE '%recital%h%'
      LIMIT 5
    `);
    
    if (pricingResult.rows.length > 0) {
      for (const clause of pricingResult.rows) {
        const bodyHtml = clause.body_html || '';
        // Check if already has the table variable
        if (bodyHtml.includes('{{PRICING_BREAKDOWN_TABLE}}')) {
          results.push({ 
            clause: `${clause.slug} (${clause.header_text})`, 
            action: 'Already has PRICING_BREAKDOWN_TABLE - skipped' 
          });
        } else {
          results.push({ 
            clause: `${clause.slug} (${clause.header_text})`, 
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
// TEMPLATE DIAGNOSTICS AND REPAIR
// ---------------------------------------------------------------------------

router.get("/system/diagnose-templates", async (req, res) => {
  try {
    console.log("🔍 RUNNING TEMPLATE DIAGNOSTICS...");
    const client = await pool.connect();
    
    try {
      const report: any = {
        timestamp: new Date().toISOString(),
        clauseCounts: {},
        templateStatus: [],
        templateClausesCounts: {},
        repairActions: [],
        errors: []
      };

      // 1. Count clauses in clauses table
      const clauseCountResult = await client.query(`
        SELECT COUNT(*) as total FROM clauses
      `);
      report.clauseCounts.total = parseInt(clauseCountResult.rows[0].total);
      console.log(`📋 Total clauses in database: ${report.clauseCounts.total}`);

      // 2. Count rows in contract_templates
      const templatesResult = await client.query(`
        SELECT id, contract_type, name, 
               COALESCE(array_length(base_clause_ids, 1), 0) as base_ids_count,
               conditional_rules IS NOT NULL as has_rules,
               is_active
        FROM contract_templates
        ORDER BY contract_type
      `);
      
      console.log(`📄 Found ${templatesResult.rows.length} templates`);

      // 3. Count template_clauses entries per template
      const templateClausesResult = await client.query(`
        SELECT template_id, COUNT(*) as clause_count 
        FROM template_clauses 
        GROUP BY template_id
      `);
      
      const templateClausesMap = new Map();
      for (const row of templateClausesResult.rows) {
        templateClausesMap.set(row.template_id, parseInt(row.clause_count));
      }

      // 4. Process each template
      for (const template of templatesResult.rows) {
        const junctionCount = templateClausesMap.get(template.id) || 0;
        const templateInfo = {
          id: template.id,
          contractType: template.contract_type,
          name: template.name,
          baseClauseIdsCount: template.base_ids_count,
          templateClausesCount: junctionCount,
          hasConditionalRules: template.has_rules,
          isActive: template.is_active,
          status: 'healthy'
        };

        // Check health
        if (junctionCount === 0) {
          templateInfo.status = 'empty_junction';
        } else if (template.base_ids_count === 0) {
          templateInfo.status = 'empty_base_ids';
        }

        report.templateStatus.push(templateInfo);
        report.templateClausesCounts[template.contract_type] = junctionCount;
        console.log(`  Template ${template.contract_type}: ${junctionCount} clauses via junction, ${template.base_ids_count} in base_clause_ids`);
      }

      // 5. Check if we need to create missing templates
      const requiredTypes = ['ONE', 'MANUFACTURING', 'ONSITE'];
      const existingTypes = templatesResult.rows.map((r: any) => r.contract_type);
      
      for (const type of requiredTypes) {
        if (!existingTypes.includes(type)) {
          report.repairActions.push({
            action: 'create_template',
            type,
            status: 'pending',
            message: `Template for ${type} does not exist`
          });
        }
      }

      // 6. Offer repair if auto-repair query param is set
      const autoRepair = req.query.repair === 'true';
      
      if (autoRepair) {
        console.log("🔧 AUTO-REPAIR MODE ENABLED");
        
        // Sync base_clause_ids from template_clauses junction table
        for (const template of templatesResult.rows) {
          const junctionCount = templateClausesMap.get(template.id) || 0;
          
          if (junctionCount > 0 && template.base_ids_count !== junctionCount) {
            // Update base_clause_ids from template_clauses
            const syncResult = await client.query(`
              UPDATE contract_templates
              SET base_clause_ids = (
                SELECT ARRAY_AGG(clause_id ORDER BY order_index)
                FROM template_clauses
                WHERE template_id = $1
              )
              WHERE id = $1
              RETURNING array_length(base_clause_ids, 1) as new_count
            `, [template.id]);
            
            const newCount = syncResult.rows[0]?.new_count || 0;
            report.repairActions.push({
              action: 'sync_base_clause_ids',
              templateId: template.id,
              contractType: template.contract_type,
              previousCount: template.base_ids_count,
              newCount,
              status: 'completed'
            });
            console.log(`  ✅ Synced ${template.contract_type}: ${template.base_ids_count} → ${newCount} base_clause_ids`);
          }
        }
      }

      // Summary
      report.summary = {
        totalClauses: report.clauseCounts.total,
        totalTemplates: templatesResult.rows.length,
        healthyTemplates: report.templateStatus.filter((t: any) => t.status === 'healthy').length,
        templatesNeedingRepair: report.templateStatus.filter((t: any) => t.status !== 'healthy').length,
        repairActionsCompleted: report.repairActions.filter((a: any) => a.status === 'completed').length,
        repairActionsPending: report.repairActions.filter((a: any) => a.status === 'pending').length
      };

      console.log("✅ TEMPLATE DIAGNOSTICS COMPLETE");
      console.log(`  Healthy: ${report.summary.healthyTemplates}, Needs Repair: ${report.summary.templatesNeedingRepair}`);

      res.json(report);
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error("Template diagnostics failed:", error);
    res.status(500).json({ 
      error: "Template diagnostics failed",
      details: error?.message 
    });
  }
});

export default router;

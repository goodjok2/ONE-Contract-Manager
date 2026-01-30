import { Router } from "express";
import { db } from "../db/index";
import { pool } from "../db";
import { contracts, projects, clauses, projectUnits, homeModels, financials } from "../../shared/schema";
import { eq, count, desc } from "drizzle-orm";
import { getProjectWithRelations } from "./helpers";
import { mapProjectToVariables } from "../lib/mapper";
import { calculateProjectPricing } from "../services/pricingEngine";
import path from "path";
import fs from "fs";

const router = Router();

// ---------------------------------------------------------------------------
// CONTRACT CRUD
// ---------------------------------------------------------------------------

router.get("/contracts/download/:fileName", async (req, res) => {
  try {
    const fileName = req.params.fileName;
    const outputDir = path.join(process.cwd(), "generated");
    const filePath = path.join(outputDir, fileName);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "File not found" });
    }

    res.download(filePath, fileName);
  } catch (error) {
    console.error("Failed to download contract:", error);
    res.status(500).json({ error: "Failed to download contract" });
  }
});

router.get("/projects/:projectId/contracts", async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId);
    const projectContracts = await db
      .select()
      .from(contracts)
      .where(eq(contracts.projectId, projectId));
    res.json(projectContracts);
  } catch (error) {
    console.error("Failed to fetch contracts:", error);
    res.status(500).json({ error: "Failed to fetch contracts" });
  }
});

// ---------------------------------------------------------------------------
// DEBUG ENDPOINT: Variable X-Ray
// ---------------------------------------------------------------------------

router.get("/projects/:projectId/debug-variables", async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId);
    
    console.log(`\n========== DEBUG VARIABLES for Project ${projectId} ==========`);
    
    // 1. Fetch project with all relations
    const projectData = await getProjectWithRelations(projectId);
    
    if (!projectData.project) {
      return res.status(404).json({ error: "Project not found" });
    }
    
    // 2. Run the pricing engine
    let pricingSummary = null;
    try {
      pricingSummary = await calculateProjectPricing(projectId);
      console.log(`✓ Pricing calculated: contractValue=${pricingSummary.contractValue}, projectBudget=${pricingSummary.projectBudget}`);
    } catch (pricingError) {
      console.warn(`⚠️ Pricing engine error (using fallback):`, pricingError);
    }
    
    // 3. Call mapProjectToVariables to generate the variable map
    const variableMap = mapProjectToVariables(projectData, pricingSummary || undefined);
    
    // Extract service model
    const serviceModel = pricingSummary?.serviceModel || projectData.project.onSiteSelection || 'CRC';
    
    // Log key variables for debugging
    console.log(`\n📋 Key Variables:`);
    console.log(`  - UNIT_MODEL_LIST: ${variableMap.UNIT_MODEL_LIST}`);
    console.log(`  - TOTAL_CONTRACT_PRICE: ${variableMap.TOTAL_CONTRACT_PRICE}`);
    console.log(`  - TOTAL_PROJECT_BUDGET: ${variableMap.TOTAL_PROJECT_BUDGET}`);
    console.log(`  - PRICING_SERVICE_MODEL: ${variableMap.PRICING_SERVICE_MODEL}`);
    console.log(`  - OFFSITE_MANUFACTURING_COST: ${variableMap.OFFSITE_MANUFACTURING_COST}`);
    console.log(`  - ON_SITE_SELECTION: ${variableMap.ON_SITE_SELECTION}`);
    console.log(`==========================================================\n`);
    
    // 4. Return comprehensive debug info
    res.json({
      projectId,
      projectName: projectData.project.name,
      serviceModel,
      variableMap,
      pricing: pricingSummary ? {
        breakdown: pricingSummary.breakdown,
        grandTotal: pricingSummary.grandTotal,
        projectBudget: pricingSummary.projectBudget,
        contractValue: pricingSummary.contractValue,
        unitCount: pricingSummary.unitCount,
        unitModelSummary: pricingSummary.unitModelSummary,
        paymentSchedule: pricingSummary.paymentSchedule,
      } : null,
      units: projectData.units || [],
      _debug: {
        hasFinancials: !!projectData.financials,
        hasMilestones: (projectData.milestones || []).length,
        hasChildLlc: !!projectData.childLlc,
        hasClient: !!projectData.client,
      }
    });
    
  } catch (error) {
    console.error("Failed to fetch debug variables:", error);
    res.status(500).json({ error: "Failed to fetch debug variables", details: String(error) });
  }
});

router.get("/contracts", async (req, res) => {
  try {
    const allContracts = await db
      .select({
        id: contracts.id,
        projectId: contracts.projectId,
        contractType: contracts.contractType,
        version: contracts.version,
        status: contracts.status,
        generatedAt: contracts.generatedAt,
        generatedBy: contracts.generatedBy,
        templateVersion: contracts.templateVersion,
        fileName: contracts.fileName,
        notes: contracts.notes,
        projectName: projects.name,
        projectNumber: projects.projectNumber,
      })
      .from(contracts)
      .leftJoin(projects, eq(contracts.projectId, projects.id))
      .orderBy(contracts.generatedAt);
    
    const draftProjects = await db
      .select({
        id: projects.id,
        name: projects.name,
        projectNumber: projects.projectNumber,
        status: projects.status,
        createdAt: projects.createdAt,
      })
      .from(projects)
      .where(eq(projects.status, 'Draft'));
    
    const financialsData = await db.select().from(financials);
    const projectValues = new Map<number, number>();
    financialsData.forEach(f => {
      const value = ((f.designFee || 0) + (f.prelimOffsite || 0) + (f.prelimOnsite || 0)) / 100;
      projectValues.set(f.projectId, value);
    });
    
    const normalizeStatus = (status: string | null): string => {
      if (!status) return 'draft';
      const normalized = status.toLowerCase().replace(/\s+/g, '_');
      const statusMap: Record<string, string> = {
        'draft': 'draft',
        'pendingreview': 'pending_review',
        'pending_review': 'pending_review',
        'pending': 'pending_review',
        'approved': 'approved',
        'signed': 'signed',
        'executed': 'signed',
        'expired': 'expired',
      };
      return statusMap[normalized] || 'draft';
    };
    
    const packageMap = new Map<number, {
      packageId: number;
      projectId: number;
      projectName: string;
      projectNumber: string;
      status: string;
      contractValue: number;
      generatedAt: string;
      isDraft: boolean;
      contracts: Array<{
        id: number;
        contractType: string;
        fileName: string;
        status: string;
        generatedAt: string;
      }>;
    }>();
    
    const projectsWithContracts = new Set(allContracts.map(c => c.projectId));
    draftProjects.forEach(p => {
      if (!projectsWithContracts.has(p.id)) {
        packageMap.set(p.id, {
          packageId: p.id,
          projectId: p.id,
          projectName: p.name || 'Untitled Draft',
          projectNumber: p.projectNumber || '',
          status: 'draft',
          contractValue: projectValues.get(p.id) || 0,
          generatedAt: p.createdAt?.toISOString() || '',
          isDraft: true,
          contracts: [],
        });
      }
    });
    
    allContracts.forEach(c => {
      if (!c.projectId) return;
      
      const existing = packageMap.get(c.projectId);
      const contractInfo = {
        id: c.id,
        contractType: c.contractType || '',
        fileName: c.fileName || '',
        status: normalizeStatus(c.status),
        generatedAt: c.generatedAt?.toISOString() || '',
      };
      
      if (existing) {
        existing.contracts.push(contractInfo);
        existing.isDraft = false;
        if (c.contractType === 'one_agreement') {
          existing.status = normalizeStatus(c.status);
        }
      } else {
        packageMap.set(c.projectId, {
          packageId: c.projectId,
          projectId: c.projectId,
          projectName: c.projectName || 'Unknown Project',
          projectNumber: c.projectNumber || '',
          status: normalizeStatus(c.status),
          contractValue: projectValues.get(c.projectId) || 0,
          generatedAt: c.generatedAt?.toISOString() || '',
          isDraft: false,
          contracts: [contractInfo],
        });
      }
    });
    
    const packages = Array.from(packageMap.values()).map(pkg => ({
      ...pkg,
      title: `${pkg.projectName} Contract Package`,
      clientName: pkg.projectName,
      contractCount: pkg.contracts.length,
    }));
    
    packages.sort((a, b) => {
      if (a.isDraft && !b.isDraft) return -1;
      if (!a.isDraft && b.isDraft) return 1;
      return new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime();
    });
    
    res.json(packages);
  } catch (error) {
    console.error("Failed to fetch contracts:", error);
    res.status(500).json({ error: "Failed to fetch contracts" });
  }
});

router.post("/contracts", async (req, res) => {
  try {
    const [result] = await db.insert(contracts).values(req.body).returning();
    res.json(result);
  } catch (error) {
    console.error("Failed to create contract:", error);
    res.status(500).json({ error: "Failed to create contract" });
  }
});

router.get("/contracts/:id", async (req, res) => {
  try {
    const contractId = parseInt(req.params.id);
    const [contract] = await db
      .select({
        id: contracts.id,
        projectId: contracts.projectId,
        contractType: contracts.contractType,
        version: contracts.version,
        status: contracts.status,
        generatedAt: contracts.generatedAt,
        generatedBy: contracts.generatedBy,
        templateVersion: contracts.templateVersion,
        fileName: contracts.fileName,
        filePath: contracts.filePath,
        notes: contracts.notes,
        projectName: projects.name,
        projectNumber: projects.projectNumber,
      })
      .from(contracts)
      .leftJoin(projects, eq(contracts.projectId, projects.id))
      .where(eq(contracts.id, contractId));
    if (!contract) {
      return res.status(404).json({ error: "Contract not found" });
    }
    res.json(contract);
  } catch (error) {
    console.error("Failed to fetch contract:", error);
    res.status(500).json({ error: "Failed to fetch contract" });
  }
});

router.get("/contracts/:id/clauses", async (req, res) => {
  try {
    const contractId = parseInt(req.params.id);
    const [contract] = await db.select().from(contracts).where(eq(contracts.id, contractId));
    
    if (!contract) {
      return res.status(404).json({ error: "Contract not found" });
    }

    const contractTypeMap: Record<string, string> = {
      'one_agreement': 'ONE Agreement',
      'ONE': 'ONE Agreement',
      'ONE Agreement': 'ONE Agreement',
      'manufacturing_sub': 'MANUFACTURING',
      'MANUFACTURING': 'MANUFACTURING',
      'onsite_sub': 'ONSITE',
      'ONSITE': 'ONSITE',
    };
    
    const templateType = contractTypeMap[contract.contractType] || 'ONE Agreement';
    
    const clauseQuery = `
      SELECT c.id, c.name, c.content, c.hierarchy_level, c.risk_level, c.clause_code as section_number
      FROM clauses c
      WHERE c.contract_type = $1 OR c.contract_type = 'ALL'
      ORDER BY c.sort_order, c.clause_code
    `;
    
    const result = await pool.query(clauseQuery, [templateType]);
    
    let variables: Record<string, string | number | boolean | null> = {};
    if (contract.projectId) {
      const projectData = await getProjectWithRelations(contract.projectId);
      if (projectData) {
        const { mapProjectToVariables } = await import('../lib/mapper');
        const { calculateProjectPricing } = await import('../services/pricingEngine');
        
        // Calculate pricing to populate table variables
        let pricingSummary = null;
        try {
          pricingSummary = await calculateProjectPricing(contract.projectId);
        } catch (e) {
          console.warn('Pricing calculation failed for clause preview:', e);
        }
        
        variables = mapProjectToVariables(projectData, pricingSummary || undefined);
      }
    }
    
    const clausesWithValues = result.rows.map((clause: any) => {
      let content = clause.content || '';
      
      content = content.replace(/\{\{([A-Z0-9_]+)\}\}/g, (match: string, varName: string) => {
        const value = variables[varName];
        if (value !== null && value !== undefined && value !== '') {
          return String(value);
        }
        return match;
      });
      
      return {
        ...clause,
        content
      };
    });
    
    res.json(clausesWithValues);
  } catch (error) {
    console.error("Failed to fetch contract clauses:", error);
    res.status(500).json({ error: "Failed to fetch clauses" });
  }
});

router.patch("/contracts/:id", async (req, res) => {
  try {
    const contractId = parseInt(req.params.id);
    const [result] = await db
      .update(contracts)
      .set(req.body)
      .where(eq(contracts.id, contractId))
      .returning();
    res.json(result);
  } catch (error) {
    console.error("Failed to update contract:", error);
    res.status(500).json({ error: "Failed to update contract" });
  }
});

router.post("/contracts/:id/send", async (req, res) => {
  try {
    const contractId = parseInt(req.params.id);
    const { sentTo } = req.body;
    
    const [result] = await db
      .update(contracts)
      .set({
        status: "Sent",
        sentAt: new Date(),
        sentTo,
      })
      .where(eq(contracts.id, contractId))
      .returning();
    
    res.json(result);
  } catch (error) {
    console.error("Failed to mark contract as sent:", error);
    res.status(500).json({ error: "Failed to mark contract as sent" });
  }
});

router.post("/contracts/:id/execute", async (req, res) => {
  try {
    const contractId = parseInt(req.params.id);
    const { executedFilePath } = req.body;
    
    const [result] = await db
      .update(contracts)
      .set({
        status: "Executed",
        executedAt: new Date(),
        executedFilePath,
      })
      .where(eq(contracts.id, contractId))
      .returning();
    
    res.json(result);
  } catch (error) {
    console.error("Failed to mark contract as executed:", error);
    res.status(500).json({ error: "Failed to mark contract as executed" });
  }
});

// ---------------------------------------------------------------------------
// CONTRACT GENERATION
// ---------------------------------------------------------------------------

router.get("/contracts/variables/:contractType", async (req, res) => {
  try {
    const { contractType } = req.params;
    
    const query = `
      SELECT DISTINCT 
        cv.variable_name,
        cv.display_name,
        cv.data_type,
        cv.category,
        cv.description,
        cv.default_value,
        cv.is_required
      FROM contract_variables cv
      WHERE $1 = ANY(cv.used_in_contracts)
      ORDER BY cv.category, cv.variable_name
    `;
    
    const result = await pool.query(query, [contractType.toUpperCase()]);
    
    const byCategory = result.rows.reduce((acc: Record<string, any[]>, variable: any) => {
      const category = variable.category || 'other';
      if (!acc[category]) acc[category] = [];
      acc[category].push(variable);
      return acc;
    }, {});
    
    res.json({
      contractType: contractType.toUpperCase(),
      totalVariables: result.rows.length,
      categories: Object.keys(byCategory),
      variablesByCategory: byCategory,
      allVariables: result.rows
    });
    
  } catch (error) {
    console.error("Error fetching required variables:", error);
    res.status(500).json({ 
      error: "Failed to fetch required variables",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

router.post("/contracts/preview-clauses", async (req, res) => {
  try {
    const { contractType, projectData } = req.body;
    
    if (!contractType || !projectData) {
      return res.status(400).json({ 
        error: "Both contractType and projectData are required" 
      });
    }
    
    const templateQuery = `
      SELECT * FROM contract_templates
      WHERE contract_type = $1 AND status = 'active'
      LIMIT 1
    `;
    
    const templateResult = await pool.query(templateQuery, [contractType.toUpperCase()]);
    
    if (templateResult.rows.length === 0) {
      return res.status(404).json({ 
        error: `No active template found for: ${contractType}` 
      });
    }
    
    const template = templateResult.rows[0];
    
    let clauseIds = [...(template.base_clause_ids || [])];
    
    const conditionalRules = template.conditional_rules || {};
    for (const [conditionKey, ruleSet] of Object.entries(conditionalRules)) {
      const projectValue = projectData[conditionKey];
      const rules = ruleSet as Record<string, number[]>;
      if (projectValue !== undefined && rules[String(projectValue)]) {
        clauseIds.push(...rules[String(projectValue)]);
      }
    }
    
    if (clauseIds.length === 0) {
      return res.json({
        contractType: contractType.toUpperCase(),
        template: template.display_name,
        summary: { totalClauses: 0, sections: 0, subsections: 0, paragraphs: 0 },
        allClauses: []
      });
    }
    
    const clausesQuery = `
      SELECT 
        id, clause_code, parent_clause_id, hierarchy_level, sort_order,
        name, category, contract_type, content, variables_used, conditions,
        risk_level, negotiable
      FROM clauses
      WHERE id = ANY($1)
      ORDER BY sort_order
    `;
    
    const clausesResult = await pool.query(clausesQuery, [clauseIds]);
    const clausesList = clausesResult.rows;
    
    const sections = clausesList.filter((c: any) => c.hierarchy_level === 1);
    const subsections = clausesList.filter((c: any) => c.hierarchy_level === 2);
    const paragraphs = clausesList.filter((c: any) => c.hierarchy_level === 3);
    const conditionalIncluded = clausesList.filter((c: any) => c.conditions !== null);
    
    res.json({
      contractType: contractType.toUpperCase(),
      template: template.display_name,
      summary: {
        totalClauses: clausesList.length,
        sections: sections.length,
        subsections: subsections.length,
        paragraphs: paragraphs.length,
        conditionalIncluded: conditionalIncluded.length
      },
      conditionalClauses: conditionalIncluded.map((c: any) => ({
        code: c.clause_code,
        name: c.name,
        conditions: c.conditions,
        category: c.category
      })),
      allClauses: clausesList.map((c: any) => ({
        code: c.clause_code,
        level: c.hierarchy_level,
        name: c.name,
        category: c.category,
        variablesUsed: c.variables_used,
        conditional: c.conditions !== null
      }))
    });
    
  } catch (error) {
    console.error("Error previewing clauses:", error);
    res.status(500).json({ 
      error: "Failed to preview clauses",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

router.post("/contracts/generate-package", async (req, res) => {
  try {
    const { projectData } = req.body;
    
    if (!projectData) {
      return res.status(400).json({ 
        error: "Project data is required",
        message: "Please provide projectData object with all required variables"
      });
    }
    
    console.log('\n=== WIZARD DATA RECEIVED ===');
    console.log(JSON.stringify(projectData, null, 2));
    console.log('=== END WIZARD DATA ===\n');
    
    console.log("Generating contract package for project:", projectData.PROJECT_NAME);
    
    const enrichedData = {
      ...projectData,
      IS_CRC: projectData.SERVICE_MODEL === "CRC",
      IS_CMOS: projectData.SERVICE_MODEL === "CMOS",
      CONTRACT_DATE: projectData.CONTRACT_DATE || new Date().toISOString().split("T")[0]
    };
    
    const generateSingleContract = async (contractType: string) => {
      const templateQuery = `
        SELECT * FROM contract_templates
        WHERE contract_type = $1 AND status = 'active'
        LIMIT 1
      `;
      
      const templateResult = await pool.query(templateQuery, [contractType]);
      
      if (templateResult.rows.length === 0) {
        throw new Error(`No active template found for contract type: ${contractType}`);
      }
      
      const template = templateResult.rows[0];
      
      let clauseIds = [...(template.base_clause_ids || [])];
      const conditionalRules = template.conditional_rules || {};
      
      for (const [conditionKey, ruleSet] of Object.entries(conditionalRules)) {
        const projectValue = enrichedData[conditionKey];
        const rules = ruleSet as Record<string, number[]>;
        if (projectValue !== undefined && rules[String(projectValue)]) {
          clauseIds.push(...rules[String(projectValue)]);
        }
      }
      
      if (clauseIds.length === 0) {
        return { content: "", filename: `${contractType}_empty.docx`, clauseCount: 0 };
      }
      
      const clausesQuery = `
        SELECT clause_code, hierarchy_level, name, content, variables_used
        FROM clauses
        WHERE id = ANY($1)
        ORDER BY sort_order
      `;
      
      const clausesResult = await pool.query(clausesQuery, [clauseIds]);
      const clausesList = clausesResult.rows;
      
      let documentText = "";
      for (const clause of clausesList) {
        if (clause.hierarchy_level === 1) {
          documentText += `\n\n${clause.name.toUpperCase()}\n\n`;
        } else if (clause.hierarchy_level === 2) {
          documentText += `\n${clause.name}\n\n`;
        } else {
          documentText += "\n";
        }
        documentText += clause.content + "\n";
      }
      
      documentText = documentText.replace(/\{\{([A-Z_]+)\}\}/g, (match, varName) => {
        const value = enrichedData[varName];
        if (value === undefined || value === null) {
          return `[${varName}]`;
        }
        if (typeof value === "boolean") return value ? "Yes" : "No";
        if (typeof value === "number") return value.toLocaleString();
        return String(value);
      });
      
      const projectName = enrichedData.PROJECT_NAME || "Unnamed";
      const sanitizedName = projectName.replace(/[^a-z0-9]/gi, "_");
      const filename = `${sanitizedName}_${contractType}_${Date.now()}.docx`;
      
      return {
        content: documentText,
        filename,
        clauseCount: clausesList.length
      };
    };
    
    const [oneAgreement, manufacturing, onsite] = await Promise.all([
      generateSingleContract("ONE"),
      generateSingleContract("MANUFACTURING"),
      generateSingleContract("ONSITE")
    ]);
    
    res.json({
      success: true,
      message: "Contract package generated successfully",
      projectName: enrichedData.PROJECT_NAME,
      serviceModel: enrichedData.SERVICE_MODEL,
      contracts: {
        one_agreement: {
          filename: oneAgreement.filename,
          content: oneAgreement.content,
          clauseCount: oneAgreement.clauseCount
        },
        manufacturing_subcontract: {
          filename: manufacturing.filename,
          content: manufacturing.content,
          clauseCount: manufacturing.clauseCount
        },
        onsite_subcontract: {
          filename: onsite.filename,
          content: onsite.content,
          clauseCount: onsite.clauseCount
        }
      },
      generatedAt: new Date().toISOString()
    });
    
  } catch (error) {
    console.error("Error generating contract package:", error);
    res.status(500).json({ 
      error: "Failed to generate contract package",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

router.post("/contracts/download-docx", async (req, res) => {
  res.redirect(307, '/api/contracts/download-pdf');
});

router.post("/contracts/download-all-zip", async (req, res) => {
  try {
    const { projectId } = req.body;
    
    if (!projectId) {
      return res.status(400).json({ error: "projectId is required" });
    }
    
    const fullProject = await getProjectWithRelations(projectId);
    if (!fullProject) {
      return res.status(404).json({ error: "Project not found" });
    }
    
    const { mapProjectToVariables, formatCentsAsCurrency, centsToDollars } = await import('../lib/mapper');
    const { calculateProjectPricing } = await import('../services/pricingEngine');
    
    // Calculate pricing FIRST so we can pass it to mapProjectToVariables
    let pricingSummary: any = null;
    try {
      pricingSummary = await calculateProjectPricing(projectId);
      console.log(`✓ Pricing calculated for ZIP: contractValue=${pricingSummary.contractValue}, paymentSchedule=${pricingSummary.paymentSchedule?.length || 0} items`);
    } catch (pricingError) {
      console.warn(`⚠️ Pricing engine error (using fallback):`, pricingError);
    }
    
    // Now call mapProjectToVariables WITH the pricingSummary so tables are populated
    const projectData = mapProjectToVariables(fullProject, pricingSummary || undefined);
    
    console.log(`\n=== Generating ALL contracts as ZIP for project ${projectId} ===`);
    console.log(`Project: ${projectData.PROJECT_NUMBER} - ${projectData.PROJECT_NAME}`);
    
    try {
      const projectUnitsData = await db
        .select({
          unitLabel: projectUnits.unitLabel,
          modelName: homeModels.name,
        })
        .from(projectUnits)
        .innerJoin(homeModels, eq(projectUnits.modelId, homeModels.id))
        .where(eq(projectUnits.projectId, projectId));
      
      if (pricingSummary && pricingSummary.unitCount > 0) {
        projectData.DESIGN_FEE = centsToDollars(pricingSummary.breakdown.totalDesignFee);
        projectData.DESIGN_FEE_WRITTEN = formatCentsAsCurrency(pricingSummary.breakdown.totalDesignFee);
        projectData.PRELIM_OFFSITE = centsToDollars(pricingSummary.breakdown.totalOffsite);
        projectData.PRELIM_OFFSITE_WRITTEN = formatCentsAsCurrency(pricingSummary.breakdown.totalOffsite);
        projectData.PRELIMINARY_OFFSITE_PRICE = formatCentsAsCurrency(pricingSummary.breakdown.totalOffsite);
        projectData.PRELIM_ONSITE = centsToDollars(pricingSummary.breakdown.totalOnsite);
        projectData.PRELIM_ONSITE_WRITTEN = formatCentsAsCurrency(pricingSummary.breakdown.totalOnsite);
        projectData.PRELIMINARY_ONSITE_PRICE = formatCentsAsCurrency(pricingSummary.breakdown.totalOnsite);
        projectData.PRELIM_CONTRACT_PRICE = centsToDollars(pricingSummary.grandTotal);
        projectData.PRELIM_CONTRACT_PRICE_WRITTEN = formatCentsAsCurrency(pricingSummary.grandTotal);
        projectData.PRELIMINARY_CONTRACT_PRICE = formatCentsAsCurrency(pricingSummary.grandTotal);
        projectData.PRELIMINARY_TOTAL_PRICE = formatCentsAsCurrency(pricingSummary.grandTotal);
        projectData.FINAL_CONTRACT_PRICE = centsToDollars(pricingSummary.grandTotal);
        projectData.FINAL_CONTRACT_PRICE_WRITTEN = formatCentsAsCurrency(pricingSummary.grandTotal);
        projectData.CONTRACT_PRICE = formatCentsAsCurrency(pricingSummary.grandTotal);
        
        pricingSummary.paymentSchedule.forEach((milestone: { name: string; percentage: number; amount: number; phase?: string }, index: number) => {
          const num = index + 1;
          projectData[`MILESTONE_${num}_NAME`] = milestone.name;
          projectData[`MILESTONE_${num}_PERCENT`] = `${milestone.percentage}%`;
          projectData[`MILESTONE_${num}_AMOUNT`] = formatCentsAsCurrency(milestone.amount);
          projectData[`MILESTONE_${num}_PHASE`] = milestone.phase;
          projectData[`CLIENT_MILESTONE_${num}_NAME`] = milestone.name;
          projectData[`CLIENT_MILESTONE_${num}_PERCENT`] = `${milestone.percentage}%`;
          projectData[`CLIENT_MILESTONE_${num}_AMOUNT`] = formatCentsAsCurrency(milestone.amount);
          
          if (milestone.name === 'Retainage' || milestone.name.toLowerCase().includes('retainage')) {
            projectData.RETAINAGE_PERCENT = `${milestone.percentage}%`;
            projectData.RETAINAGE_AMOUNT = formatCentsAsCurrency(milestone.amount);
          }
        });
        
        const unitCounts: Record<string, { count: number; labels: string[] }> = {};
        projectUnitsData.forEach(unit => {
          if (!unitCounts[unit.modelName]) {
            unitCounts[unit.modelName] = { count: 0, labels: [] };
          }
          unitCounts[unit.modelName].count++;
          unitCounts[unit.modelName].labels.push(unit.unitLabel);
        });
        
        const unitSummaryParts = Object.entries(unitCounts).map(([model, data]) => 
          `${data.count}x ${model} (${data.labels.join(', ')})`
        );
        const unitSummary = `${pricingSummary.unitCount} Unit${pricingSummary.unitCount !== 1 ? 's' : ''}: ${unitSummaryParts.join(', ')}`;
        
        projectData.HOME_MODEL = unitSummary;
        projectData.UNIT_MODEL_LIST = pricingSummary.unitModelSummary || unitSummary;
        projectData.TOTAL_UNITS = pricingSummary.unitCount;
        
        projectData.TOTAL_PROJECT_BUDGET = centsToDollars(pricingSummary.projectBudget);
        projectData.TOTAL_PROJECT_BUDGET_WRITTEN = formatCentsAsCurrency(pricingSummary.projectBudget);
        projectData.TOTAL_CONTRACT_PRICE = centsToDollars(pricingSummary.contractValue);
        projectData.TOTAL_CONTRACT_PRICE_WRITTEN = formatCentsAsCurrency(pricingSummary.contractValue);
        projectData.PRICING_SERVICE_MODEL = pricingSummary.serviceModel;
        
        projectData.CONTRACT_PRICE = formatCentsAsCurrency(pricingSummary.contractValue);
        projectData.PRELIM_CONTRACT_PRICE = centsToDollars(pricingSummary.contractValue);
        projectData.PRELIM_CONTRACT_PRICE_WRITTEN = formatCentsAsCurrency(pricingSummary.contractValue);
        projectData.PRELIMINARY_CONTRACT_PRICE = formatCentsAsCurrency(pricingSummary.contractValue);
        projectData.PRELIMINARY_TOTAL_PRICE = formatCentsAsCurrency(pricingSummary.contractValue);
        projectData.FINAL_CONTRACT_PRICE = centsToDollars(pricingSummary.contractValue);
        projectData.FINAL_CONTRACT_PRICE_WRITTEN = formatCentsAsCurrency(pricingSummary.contractValue);
        
        console.log(`Pricing Engine injected: Contract Value = ${formatCentsAsCurrency(pricingSummary.contractValue)}, Project Budget = ${formatCentsAsCurrency(pricingSummary.projectBudget)}, Service Model = ${pricingSummary.serviceModel}, Units = ${pricingSummary.unitCount}`);
      }
    } catch (pricingError) {
      console.warn('Pricing engine calculation failed, using legacy values:', pricingError);
    }
    
    const { generateContract, getContractFilename } = await import('../lib/contractGenerator');
    const archiver = (await import('archiver')).default;
    
    const contractTypes: Array<'ONE' | 'MANUFACTURING' | 'ONSITE'> = ['ONE', 'MANUFACTURING', 'ONSITE'];
    
    const generatedContracts: Array<{ buffer: Buffer; filename: string }> = [];
    
    for (const contractType of contractTypes) {
      try {
        const buffer = await generateContract({
          contractType,
          projectData,
          format: 'pdf'
        });
        const filename = getContractFilename(contractType, projectData, 'pdf');
        generatedContracts.push({ buffer, filename });
        console.log(`Generated ${contractType}: ${filename} (${buffer.length} bytes)`);
      } catch (err) {
        console.error(`Failed to generate ${contractType}:`, err);
      }
    }
    
    if (generatedContracts.length === 0) {
      return res.status(500).json({ error: "Failed to generate any contracts" });
    }
    
    const archive = archiver('zip', { zlib: { level: 9 } });
    
    const zipFilename = `${projectData.PROJECT_NUMBER || 'Contracts'}_Package.zip`;
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${zipFilename}"`);
    
    archive.pipe(res);
    
    for (const contract of generatedContracts) {
      archive.append(contract.buffer, { name: contract.filename });
    }
    
    await archive.finalize();
    
    console.log(`ZIP archive created with ${generatedContracts.length} contracts`);
    
  } catch (error) {
    console.error("Error generating ZIP:", error);
    res.status(500).json({ 
      error: "Failed to generate contract package",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

router.post("/contracts/download-pdf", async (req, res) => {
  try {
    const { contractType, projectId, projectData: legacyProjectData } = req.body;
    
    if (!contractType) {
      return res.status(400).json({ error: "contractType is required" });
    }
    
    let projectData: any;
    
    if (projectId) {
      const fullProject = await getProjectWithRelations(projectId);
      if (!fullProject) {
        return res.status(404).json({ error: "Project not found" });
      }
      
      const { mapProjectToVariables, formatCentsAsCurrency, centsToDollars } = await import('../lib/mapper');
      const { calculateProjectPricing } = await import('../services/pricingEngine');
      
      // Calculate pricing FIRST so we can pass it to mapProjectToVariables
      let pricingSummary: any = null;
      try {
        pricingSummary = await calculateProjectPricing(projectId);
        console.log(`✓ Pricing calculated for PDF: contractValue=${pricingSummary.contractValue}, paymentSchedule=${pricingSummary.paymentSchedule?.length || 0} items`);
      } catch (pricingError) {
        console.warn(`⚠️ Pricing engine error (using fallback):`, pricingError);
      }
      
      // Now call mapProjectToVariables WITH the pricingSummary so tables are populated
      projectData = mapProjectToVariables(fullProject, pricingSummary || undefined);
      
      console.log(`\n=== Generating ${contractType} contract for project ${projectId} ===`);
      console.log(`Project: ${projectData.PROJECT_NUMBER} - ${projectData.PROJECT_NAME}`);
      console.log(`Service Model: ${projectData.ON_SITE_SELECTION}`);
      
      try {
        const projectUnitsData = await db
          .select({
            unitLabel: projectUnits.unitLabel,
            modelName: homeModels.name,
          })
          .from(projectUnits)
          .innerJoin(homeModels, eq(projectUnits.modelId, homeModels.id))
          .where(eq(projectUnits.projectId, projectId));
        
        if (pricingSummary && pricingSummary.unitCount > 0) {
          projectData.DESIGN_FEE = centsToDollars(pricingSummary.breakdown.totalDesignFee);
          projectData.DESIGN_FEE_WRITTEN = formatCentsAsCurrency(pricingSummary.breakdown.totalDesignFee);
          projectData.PRELIM_OFFSITE = centsToDollars(pricingSummary.breakdown.totalOffsite);
          projectData.PRELIM_OFFSITE_WRITTEN = formatCentsAsCurrency(pricingSummary.breakdown.totalOffsite);
          projectData.PRELIMINARY_OFFSITE_PRICE = formatCentsAsCurrency(pricingSummary.breakdown.totalOffsite);
          projectData.PRELIM_ONSITE = centsToDollars(pricingSummary.breakdown.totalOnsite);
          projectData.PRELIM_ONSITE_WRITTEN = formatCentsAsCurrency(pricingSummary.breakdown.totalOnsite);
          projectData.PRELIMINARY_ONSITE_PRICE = formatCentsAsCurrency(pricingSummary.breakdown.totalOnsite);
          projectData.PRELIM_CONTRACT_PRICE = centsToDollars(pricingSummary.grandTotal);
          projectData.PRELIM_CONTRACT_PRICE_WRITTEN = formatCentsAsCurrency(pricingSummary.grandTotal);
          projectData.PRELIMINARY_CONTRACT_PRICE = formatCentsAsCurrency(pricingSummary.grandTotal);
          projectData.PRELIMINARY_TOTAL_PRICE = formatCentsAsCurrency(pricingSummary.grandTotal);
          projectData.FINAL_CONTRACT_PRICE = centsToDollars(pricingSummary.grandTotal);
          projectData.FINAL_CONTRACT_PRICE_WRITTEN = formatCentsAsCurrency(pricingSummary.grandTotal);
          projectData.CONTRACT_PRICE = formatCentsAsCurrency(pricingSummary.grandTotal);
          
          pricingSummary.paymentSchedule.forEach((milestone: { name: string; percentage: number; amount: number; phase?: string }, index: number) => {
            const num = index + 1;
            projectData[`MILESTONE_${num}_NAME`] = milestone.name;
            projectData[`MILESTONE_${num}_PERCENT`] = `${milestone.percentage}%`;
            projectData[`MILESTONE_${num}_AMOUNT`] = formatCentsAsCurrency(milestone.amount);
            projectData[`MILESTONE_${num}_PHASE`] = milestone.phase;
            projectData[`CLIENT_MILESTONE_${num}_NAME`] = milestone.name;
            projectData[`CLIENT_MILESTONE_${num}_PERCENT`] = `${milestone.percentage}%`;
            projectData[`CLIENT_MILESTONE_${num}_AMOUNT`] = formatCentsAsCurrency(milestone.amount);
            
            if (milestone.name === 'Retainage' || milestone.name.toLowerCase().includes('retainage')) {
              projectData.RETAINAGE_PERCENT = `${milestone.percentage}%`;
              projectData.RETAINAGE_AMOUNT = formatCentsAsCurrency(milestone.amount);
            }
          });
          
          const unitCounts: Record<string, { count: number; labels: string[] }> = {};
          projectUnitsData.forEach(unit => {
            if (!unitCounts[unit.modelName]) {
              unitCounts[unit.modelName] = { count: 0, labels: [] };
            }
            unitCounts[unit.modelName].count++;
            unitCounts[unit.modelName].labels.push(unit.unitLabel);
          });
          
          const unitSummaryParts = Object.entries(unitCounts).map(([model, data]) => 
            `${data.count}x ${model} (${data.labels.join(', ')})`
          );
          const unitSummary = `${pricingSummary.unitCount} Unit${pricingSummary.unitCount !== 1 ? 's' : ''}: ${unitSummaryParts.join(', ')}`;
          
          projectData.HOME_MODEL = unitSummary;
          projectData.UNIT_MODEL_LIST = pricingSummary.unitModelSummary || unitSummary;
          projectData.TOTAL_UNITS = pricingSummary.unitCount;
          
          projectData.TOTAL_PROJECT_BUDGET = centsToDollars(pricingSummary.projectBudget);
          projectData.TOTAL_PROJECT_BUDGET_WRITTEN = formatCentsAsCurrency(pricingSummary.projectBudget);
          projectData.TOTAL_CONTRACT_PRICE = centsToDollars(pricingSummary.contractValue);
          projectData.TOTAL_CONTRACT_PRICE_WRITTEN = formatCentsAsCurrency(pricingSummary.contractValue);
          projectData.PRICING_SERVICE_MODEL = pricingSummary.serviceModel;
          
          projectData.CONTRACT_PRICE = formatCentsAsCurrency(pricingSummary.contractValue);
          projectData.PRELIM_CONTRACT_PRICE = centsToDollars(pricingSummary.contractValue);
          projectData.PRELIM_CONTRACT_PRICE_WRITTEN = formatCentsAsCurrency(pricingSummary.contractValue);
          projectData.PRELIMINARY_CONTRACT_PRICE = formatCentsAsCurrency(pricingSummary.contractValue);
          projectData.PRELIMINARY_TOTAL_PRICE = formatCentsAsCurrency(pricingSummary.contractValue);
          projectData.FINAL_CONTRACT_PRICE = centsToDollars(pricingSummary.contractValue);
          projectData.FINAL_CONTRACT_PRICE_WRITTEN = formatCentsAsCurrency(pricingSummary.contractValue);
          
          console.log(`Pricing Engine injected: Contract Value = ${formatCentsAsCurrency(pricingSummary.contractValue)}, Project Budget = ${formatCentsAsCurrency(pricingSummary.projectBudget)}, Service Model = ${pricingSummary.serviceModel}, Units = ${pricingSummary.unitCount}`);
        }
      } catch (pricingError) {
        console.warn('Pricing engine calculation failed, using legacy values:', pricingError);
      }
    } else if (legacyProjectData) {
      projectData = legacyProjectData;
      console.log(`\n=== Generating ${contractType} contract (legacy mode) ===`);
    } else {
      return res.status(400).json({ error: "Either projectId or projectData is required" });
    }

    const { generateContract, getContractFilename } = await import('../lib/contractGenerator');
    
    const buffer = await generateContract({
      contractType: contractType as 'ONE' | 'MANUFACTURING' | 'ONSITE',
      projectData,
      format: 'pdf'
    });

    const filename = getContractFilename(contractType, projectData, 'pdf');
    
    console.log(`Generated ${contractType} contract: ${buffer.length} bytes`);
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
    
  } catch (error) {
    console.error("Error generating PDF:", error);
    res.status(500).json({ 
      error: "Failed to generate document",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

router.post("/contracts/compare-service-models", async (req, res) => {
  try {
    const { projectData } = req.body;
    
    if (!projectData) {
      return res.status(400).json({ error: "projectData is required" });
    }
    
    const getClauses = async (serviceModel: string) => {
      const modifiedData = { ...projectData, serviceModel };
      
      const templateQuery = `
        SELECT id, base_clause_ids, conditional_rules, display_name FROM contract_templates
        WHERE contract_type = 'ONE'
      `;
      const templateResult = await pool.query(templateQuery);
      
      if (templateResult.rows.length === 0) {
        return { clauses: [], clauseIds: [] };
      }
      
      const template = templateResult.rows[0];
      const clauseIds = template.base_clause_ids || [];
      
      if (clauseIds.length === 0) {
        return { clauses: [], clauseIds: [] };
      }
      
      const clausesQuery = `
        SELECT id, clause_code, name, category, conditions, hierarchy_level
        FROM clauses
        WHERE id = ANY($1)
        ORDER BY sort_order
      `;
      
      const clausesResult = await pool.query(clausesQuery, [clauseIds]);
      
      const filteredClauses = clausesResult.rows.filter((clause: any) => {
        if (!clause.conditions) return true;
        const conditions = clause.conditions;
        if (conditions.service_model) {
          return conditions.service_model === serviceModel || conditions.service_model === "BOTH";
        }
        return true;
      });
      
      return { clauses: filteredClauses, clauseIds: filteredClauses.map((c: any) => c.id) };
    };
    
    const [crcResult, cmosResult] = await Promise.all([
      getClauses("CRC"),
      getClauses("CMOS")
    ]);
    
    const crcOnly = crcResult.clauses.filter(
      (c: any) => !cmosResult.clauseIds.includes(c.id)
    );
    const cmosOnly = cmosResult.clauses.filter(
      (c: any) => !crcResult.clauseIds.includes(c.id)
    );
    const shared = crcResult.clauses.filter(
      (c: any) => cmosResult.clauseIds.includes(c.id)
    );
    
    res.json({
      crc: {
        totalClauses: crcResult.clauses.length,
        clauses: crcResult.clauses
      },
      cmos: {
        totalClauses: cmosResult.clauses.length,
        clauses: cmosResult.clauses
      },
      comparison: {
        crcOnly: crcOnly.map((c: any) => ({ id: c.id, code: c.clause_code, name: c.name })),
        cmosOnly: cmosOnly.map((c: any) => ({ id: c.id, code: c.clause_code, name: c.name })),
        shared: shared.length,
        crcTotal: crcResult.clauses.length,
        cmosTotal: cmosResult.clauses.length
      }
    });
  } catch (error) {
    console.error("Failed to compare service models:", error);
    res.status(500).json({ error: "Failed to compare service models" });
  }
});

// ---------------------------------------------------------------------------
// CLAUSES
// ---------------------------------------------------------------------------

router.get("/clauses", async (req, res) => {
  try {
    const { contractType, category, search, hierarchyLevel } = req.query;
    
    let query = `
      SELECT 
        id, clause_code, parent_clause_id, hierarchy_level, sort_order,
        name, category, contract_type, content, variables_used, conditions,
        risk_level, negotiable, created_at, updated_at
      FROM clauses
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramCount = 1;
    
    if (contractType && contractType !== 'ALL') {
      query += ` AND contract_type = $${paramCount}`;
      params.push(contractType);
      paramCount++;
    }
    
    if (category) {
      query += ` AND category = $${paramCount}`;
      params.push(category);
      paramCount++;
    }
    
    if (hierarchyLevel) {
      query += ` AND hierarchy_level = $${paramCount}`;
      params.push(parseInt(hierarchyLevel as string));
      paramCount++;
    }
    
    if (search) {
      query += ` AND (name ILIKE $${paramCount} OR content ILIKE $${paramCount} OR clause_code ILIKE $${paramCount})`;
      params.push(`%${search}%`);
      paramCount++;
    }
    
    query += ` ORDER BY sort_order, clause_code`;
    
    const result = await pool.query(query, params);
    
    const statsQuery = `
      SELECT 
        COUNT(*) as total,
        COUNT(DISTINCT contract_type) as contract_types,
        COUNT(DISTINCT category) as categories,
        COUNT(*) FILTER (WHERE conditions IS NOT NULL) as conditional
      FROM clauses
    `;
    const statsResult = await pool.query(statsQuery);
    
    res.json({
      clauses: result.rows,
      stats: statsResult.rows[0]
    });
  } catch (error) {
    console.error("Failed to fetch clauses:", error);
    res.status(500).json({ error: "Failed to fetch clauses" });
  }
});

router.get("/clauses/meta/categories", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT DISTINCT category, COUNT(*) as count
      FROM clauses
      GROUP BY category
      ORDER BY category
    `);
    res.json(result.rows);
  } catch (error) {
    console.error("Failed to fetch clause categories:", error);
    res.status(500).json({ error: "Failed to fetch categories" });
  }
});

router.get("/clauses/meta/contract-types", async (req, res) => {
  try {
    const result = await db
      .select({
        contractType: clauses.contractType,
        count: count(),
      })
      .from(clauses)
      .groupBy(clauses.contractType)
      .orderBy(clauses.contractType);
    res.json(result.map(r => ({ contract_type: r.contractType, count: Number(r.count) })));
  } catch (error) {
    console.error("Failed to fetch contract types:", error);
    res.status(500).json({ error: "Failed to fetch contract types" });
  }
});

router.get("/clauses/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`
      SELECT 
        id, clause_code, parent_clause_id, hierarchy_level, sort_order,
        name, category, contract_type, content, variables_used, conditions,
        risk_level, negotiable, created_at, updated_at
      FROM clauses
      WHERE id = $1
    `, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Clause not found" });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error("Failed to fetch clause:", error);
    res.status(500).json({ error: "Failed to fetch clause" });
  }
});

router.patch("/clauses/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, content, conditions, riskLevel, negotiable, variablesUsed } = req.body;
    
    const updateFields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;
    
    if (name !== undefined) {
      updateFields.push(`name = $${paramCount}`);
      values.push(name);
      paramCount++;
    }
    if (content !== undefined) {
      updateFields.push(`content = $${paramCount}`);
      values.push(content);
      paramCount++;
    }
    if (conditions !== undefined) {
      updateFields.push(`conditions = $${paramCount}`);
      values.push(JSON.stringify(conditions));
      paramCount++;
    }
    if (riskLevel !== undefined) {
      updateFields.push(`risk_level = $${paramCount}`);
      values.push(riskLevel);
      paramCount++;
    }
    if (negotiable !== undefined) {
      updateFields.push(`negotiable = $${paramCount}`);
      values.push(negotiable);
      paramCount++;
    }
    if (variablesUsed !== undefined) {
      updateFields.push(`variables_used = $${paramCount}`);
      values.push(variablesUsed);
      paramCount++;
    }
    
    if (updateFields.length === 0) {
      return res.status(400).json({ error: "No fields to update" });
    }
    
    updateFields.push(`updated_at = NOW()`);
    values.push(id);
    
    const result = await pool.query(`
      UPDATE clauses SET ${updateFields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `, values);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Clause not found" });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error("Failed to update clause:", error);
    res.status(500).json({ error: "Failed to update clause" });
  }
});

// ---------------------------------------------------------------------------
// DEBUG ENDPOINTS
// ---------------------------------------------------------------------------

router.get('/debug/variables-in-clauses', async (req, res) => {
  try {
    const clausesResult = await pool.query('SELECT content FROM clauses');
    const clausesList = clausesResult.rows;
    
    const variableSet = new Set<string>();
    
    clausesList.forEach((clause: any) => {
      const content = clause.content || '';
      const matches = content.match(/\{\{([A-Z_0-9]+)\}\}/g);
      if (matches) {
        matches.forEach((match: string) => {
          const varName = match.replace(/[{}]/g, '');
          variableSet.add(varName);
        });
      }
    });
    
    const variables = Array.from(variableSet).sort();
    
    res.json({
      totalVariables: variables.length,
      variables: variables,
      clausesChecked: clausesList.length
    });
    
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;

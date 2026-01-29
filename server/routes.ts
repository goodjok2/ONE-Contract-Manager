import type { Express } from "express";
import type { Server } from "http";
import { db } from "./db/index";
import { pool } from "./db";
import {
  projects,
  clients,
  projectDetails,
  financials,
  milestones,
  warrantyTerms,
  contractors,
  contractorEntities,
  contracts,
  llcs,
  clauses,
  homeModels,
  projectUnits,
} from "../shared/schema";
import { eq, and, sql, desc, count, ne } from "drizzle-orm";
import Docxtemplater from "docxtemplater";
import PizZip from "pizzip";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { 
  mapProjectToVariables, 
  validateVariablesForContract, 
  extractTemplateVariables,
  getVariableCoverage,
  type ProjectWithRelations 
} from "./lib/mapper";
import { generateContract as generateContractFromTemplate, getContractFilename } from "./lib/contractGenerator";
import { calculateProjectPricing } from "./services/pricingEngine";

// =============================================================================
// HELPER: Fetch project with all relations
// =============================================================================

async function getProjectWithRelations(projectId: number): Promise<ProjectWithRelations | null> {
  const [project] = await db.select().from(projects).where(eq(projects.id, projectId));
  if (!project) return null;

  const [client] = await db.select().from(clients).where(eq(clients.projectId, projectId));
  // Use the consolidated PostgreSQL llcs table
  const [llcRecord] = await db.select().from(llcs).where(eq(llcs.projectId, projectId));
  const [projectDetail] = await db.select().from(projectDetails).where(eq(projectDetails.projectId, projectId));
  const [financial] = await db.select().from(financials).where(eq(financials.projectId, projectId));
  const [warranty] = await db.select().from(warrantyTerms).where(eq(warrantyTerms.projectId, projectId));
  const projectMilestones = await db.select().from(milestones).where(eq(milestones.projectId, projectId));
  const projectContractors = await db.select().from(contractors).where(eq(contractors.projectId, projectId));

  // Map llcs fields to childLlc format for backwards compatibility
  const childLlc = llcRecord ? {
    id: llcRecord.id,
    projectId: llcRecord.projectId,
    legalName: llcRecord.name,
    formationState: llcRecord.stateOfFormation,
    entityType: 'LLC',
    ein: llcRecord.einNumber,
    formationDate: llcRecord.formationDate,
    registeredAgent: llcRecord.registeredAgent,
    registeredAgentAddress: llcRecord.registeredAgentAddress,
    address: llcRecord.address,
    city: llcRecord.city,
    state: llcRecord.state,
    zip: llcRecord.zip,
    status: llcRecord.status,
  } : null;

  return {
    project,
    client: client || null,
    childLlc: childLlc,
    projectDetails: projectDetail || null,
    financials: financial || null,
    warrantyTerms: warranty || null,
    milestones: projectMilestones,
    contractors: projectContractors,
  };
}

// =============================================================================
// HELPER: Generate contract from template
// =============================================================================

interface GenerateContractOptions {
  projectId: number;
  contractType: "one_agreement" | "manufacturing_sub" | "onsite_sub";
  templatePath?: string;
  outputDir?: string;
  generatedBy?: string;
}

interface GenerateContractResult {
  success: boolean;
  filePath?: string;
  fileName?: string;
  contractId?: number;
  errors?: string[];
  warnings?: string[];
}

async function generateContract(options: GenerateContractOptions): Promise<GenerateContractResult> {
  const { projectId, contractType, generatedBy = "system" } = options;
  
  // Default template paths - adjust to your project structure
  const templateDir = options.templatePath || path.join(process.cwd(), "templates");
  const outputDir = options.outputDir || path.join(process.cwd(), "generated");
  
  // Template file mapping
  const templateFiles: Record<string, string> = {
    one_agreement: "ONE_Agreement_Template.docx",
    manufacturing_sub: "Manufacturing_Subcontract_Template.docx",
    onsite_sub: "OnSite_Subcontract_Template.docx",
  };

  const templateFile = templateFiles[contractType];
  const templatePath = path.join(templateDir, templateFile);

  // Check template exists
  if (!fs.existsSync(templatePath)) {
    return {
      success: false,
      errors: [`Template not found: ${templatePath}`],
    };
  }

  // Fetch project data
  const projectData = await getProjectWithRelations(projectId);
  if (!projectData) {
    return {
      success: false,
      errors: [`Project not found: ${projectId}`],
    };
  }

  // Map to variables
  const variables = mapProjectToVariables(projectData);

  // Validate
  const validation = validateVariablesForContract(variables, contractType);
  if (validation.missing.length > 0) {
    return {
      success: false,
      errors: [`Missing required variables: ${validation.missing.join(", ")}`],
      warnings: validation.warnings,
    };
  }

  try {
    // Load template
    const content = fs.readFileSync(templatePath, "binary");
    const zip = new PizZip(content);
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      nullGetter: () => "", // Return empty string for missing variables
    });

    // Render with variables
    doc.render(variables);

    // Generate output
    const buf = doc.getZip().generate({
      type: "nodebuffer",
      compression: "DEFLATE",
    });

    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Create output filename
    const timestamp = new Date().toISOString().slice(0, 10);
    const safeProjectNumber = projectData.project.projectNumber.replace(/[^a-zA-Z0-9-]/g, "_");
    const fileName = `${safeProjectNumber}_${contractType}_${timestamp}.docx`;
    const outputPath = path.join(outputDir, fileName);

    // Write file
    fs.writeFileSync(outputPath, buf);

    // Calculate file hash for integrity
    const fileHash = crypto.createHash("sha256").update(buf).digest("hex");

    // Delete existing contract of the same type for this project (replace instead of duplicate)
    await db
      .delete(contracts)
      .where(and(
        eq(contracts.projectId, projectId),
        eq(contracts.contractType, contractType)
      ));

    // Record in database (always version 1 since we replace)
    const [result] = await db.insert(contracts).values({
      projectId,
      contractType,
      version: 1,
      status: "Draft",
      generatedBy,
      filePath: outputPath,
      fileName,
      fileHash,
      variablesSnapshot: JSON.stringify(variables),
    }).returning();

    return {
      success: true,
      filePath: outputPath,
      fileName,
      contractId: result?.id,
      warnings: validation.warnings,
    };
  } catch (error) {
    return {
      success: false,
      errors: [`Generation failed: ${error instanceof Error ? error.message : "Unknown error"}`],
    };
  }
}

// =============================================================================
// ROUTES
// =============================================================================

export async function registerRoutes(httpServer: Server, app: Express): Promise<void> {
  
  // ---------------------------------------------------------------------------
  // DEBUG - Variable Audit (temporary)
  // ---------------------------------------------------------------------------
  
  app.get('/api/debug/audit-variables', async (req, res) => {
    try {
      console.log('Starting variable audit...');
      
      // Fetch all clauses directly from database
      const clauseResult = await pool.query('SELECT * FROM clauses');
      const clauseList = clauseResult.rows || [];
      
      console.log(`Fetched ${clauseList.length} clauses`);
      
      // Extract all {{VARIABLE_NAME}} patterns
      const variableSet = new Set<string>();
      const variablesByContract: Record<string, Set<string>> = {
        ONE: new Set(),
        MANUFACTURING: new Set(),
        ONSITE: new Set()
      };
      
      clauseList.forEach((clause: any) => {
        const content = (clause.content || '') + ' ' + (clause.name || '');
        const matches = content.match(/\{\{([A-Z_0-9]+)\}\}/g);
        
        if (matches) {
          matches.forEach((match: string) => {
            const varName = match.replace(/[{}]/g, '');
            variableSet.add(varName);
            
            // Track by contract type
            const contractType = (clause.contract_type || '').toLowerCase();
            if (contractType.includes('one')) {
              variablesByContract.ONE.add(varName);
            } else if (contractType.includes('manufacturing') || contractType.includes('offsite')) {
              variablesByContract.MANUFACTURING.add(varName);
            } else if (contractType.includes('onsite') || contractType.includes('installation')) {
              variablesByContract.ONSITE.add(varName);
            }
          });
        }
      });
      
      const allVariables = Array.from(variableSet).sort();
      
      // Find common vs unique variables
      const oneVars = Array.from(variablesByContract.ONE);
      const mfgVars = Array.from(variablesByContract.MANUFACTURING);
      const onsiteVars = Array.from(variablesByContract.ONSITE);
      
      const commonVars = allVariables.filter(v => 
        variablesByContract.ONE.has(v) && 
        variablesByContract.MANUFACTURING.has(v) && 
        variablesByContract.ONSITE.has(v)
      );
      
      const oneOnly = allVariables.filter(v => 
        variablesByContract.ONE.has(v) && 
        !variablesByContract.MANUFACTURING.has(v) && 
        !variablesByContract.ONSITE.has(v)
      );
      
      const mfgOnly = allVariables.filter(v => 
        !variablesByContract.ONE.has(v) && 
        variablesByContract.MANUFACTURING.has(v) && 
        !variablesByContract.ONSITE.has(v)
      );
      
      const onsiteOnly = allVariables.filter(v => 
        !variablesByContract.ONE.has(v) && 
        !variablesByContract.MANUFACTURING.has(v) && 
        variablesByContract.ONSITE.has(v)
      );
      
      console.log('\n=== VARIABLE AUDIT COMPLETE ===');
      console.log(`Total unique variables: ${allVariables.length}`);
      console.log(`Common across all three: ${commonVars.length}`);
      console.log(`ONE only: ${oneOnly.length}`);
      console.log(`MANUFACTURING only: ${mfgOnly.length}`);
      console.log(`ONSITE only: ${onsiteOnly.length}`);
      
      res.json({
        summary: {
          totalVariables: allVariables.length,
          clausesChecked: clauseList.length,
          commonVariables: commonVars.length,
          oneOnlyVariables: oneOnly.length,
          manufacturingOnlyVariables: mfgOnly.length,
          onsiteOnlyVariables: onsiteOnly.length
        },
        allVariables: allVariables,
        byContract: {
          ONE: {
            total: oneVars.length,
            variables: oneVars.sort()
          },
          MANUFACTURING: {
            total: mfgVars.length,
            variables: mfgVars.sort()
          },
          ONSITE: {
            total: onsiteVars.length,
            variables: onsiteVars.sort()
          }
        },
        analysis: {
          commonToAll: commonVars.sort(),
          oneOnly: oneOnly.sort(),
          manufacturingOnly: mfgOnly.sort(),
          onsiteOnly: onsiteOnly.sort()
        }
      });
      
    } catch (error: any) {
      console.error('Variable audit error:', error);
      res.status(500).json({ 
        error: 'Failed to audit variables', 
        message: error.message 
      });
    }
  });

  // ---------------------------------------------------------------------------
  // DEBUG - Seed Home Models (temporary)
  // ---------------------------------------------------------------------------
  
  app.get('/api/debug/seed-models', async (req, res) => {
    try {
      // Check if home_models table already has data
      const existingModels = await db.select().from(homeModels);
      
      if (existingModels.length > 0) {
        return res.json({
          message: 'Home models already seeded',
          count: existingModels.length,
          models: existingModels
        });
      }
      
      // Seed the three example models (prices stored in cents)
      const seedData = [
        {
          name: 'Trinity',
          modelCode: 'TRINITY-3000',
          bedrooms: 4,
          bathrooms: 3.5,
          sqFt: 3000,
          designFee: 5000000,      // $50,000 in cents
          offsiteBasePrice: 85000000,  // $850,000 in cents
          onsiteEstPrice: 45000000,    // $450,000 in cents
          isActive: true
        },
        {
          name: 'Salt Point',
          modelCode: 'SALTPOINT-1800',
          bedrooms: 3,
          bathrooms: 2.0,
          sqFt: 1800,
          designFee: 3500000,      // $35,000 in cents
          offsiteBasePrice: 55000000,  // $550,000 in cents
          onsiteEstPrice: 30000000,    // $300,000 in cents
          isActive: true
        },
        {
          name: 'Mini-Mod',
          modelCode: 'MINIMOD-600',
          bedrooms: 1,
          bathrooms: 1.0,
          sqFt: 600,
          designFee: 1000000,      // $10,000 in cents
          offsiteBasePrice: 18000000,  // $180,000 in cents
          onsiteEstPrice: 10000000,    // $100,000 in cents
          isActive: true
        }
      ];
      
      const insertedModels = await db.insert(homeModels).values(seedData).returning();
      
      console.log(`Seeded ${insertedModels.length} home models`);
      
      res.json({
        message: 'Home models seeded successfully',
        count: insertedModels.length,
        models: insertedModels
      });
      
    } catch (error: any) {
      console.error('Seed models error:', error);
      res.status(500).json({ 
        error: 'Failed to seed home models', 
        message: error.message 
      });
    }
  });

  // ---------------------------------------------------------------------------
  // HOME MODELS - Catalog Management
  // ---------------------------------------------------------------------------

  app.get('/api/home-models', async (req, res) => {
    try {
      const models = await db
        .select()
        .from(homeModels)
        .where(eq(homeModels.isActive, true));
      res.json(models);
    } catch (error: any) {
      console.error('Failed to fetch home models:', error);
      res.status(500).json({ error: 'Failed to fetch home models' });
    }
  });

  // ---------------------------------------------------------------------------
  // PROJECT UNITS - Multi-Unit Management
  // ---------------------------------------------------------------------------

  app.get('/api/projects/:projectId/units', async (req, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      
      const units = await db
        .select({
          id: projectUnits.id,
          projectId: projectUnits.projectId,
          modelId: projectUnits.modelId,
          unitLabel: projectUnits.unitLabel,
          basePriceSnapshot: projectUnits.basePriceSnapshot,
          customizationTotal: projectUnits.customizationTotal,
          createdAt: projectUnits.createdAt,
          model: {
            id: homeModels.id,
            name: homeModels.name,
            modelCode: homeModels.modelCode,
            bedrooms: homeModels.bedrooms,
            bathrooms: homeModels.bathrooms,
            sqFt: homeModels.sqFt,
            designFee: homeModels.designFee,
            offsiteBasePrice: homeModels.offsiteBasePrice,
            onsiteEstPrice: homeModels.onsiteEstPrice,
          }
        })
        .from(projectUnits)
        .innerJoin(homeModels, eq(projectUnits.modelId, homeModels.id))
        .where(eq(projectUnits.projectId, projectId));

      res.json(units);
    } catch (error: any) {
      console.error('Failed to fetch project units:', error);
      res.status(500).json({ error: 'Failed to fetch project units' });
    }
  });

  app.post('/api/projects/:projectId/units', async (req, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      const { modelId, unitLabel } = req.body;

      if (!modelId) {
        return res.status(400).json({ error: 'modelId is required' });
      }

      const [model] = await db
        .select()
        .from(homeModels)
        .where(eq(homeModels.id, modelId));

      if (!model) {
        return res.status(404).json({ error: 'Home model not found' });
      }

      const existingUnits = await db
        .select()
        .from(projectUnits)
        .where(eq(projectUnits.projectId, projectId));

      const label = unitLabel || `Unit ${existingUnits.length + 1}`;

      const [newUnit] = await db
        .insert(projectUnits)
        .values({
          projectId,
          modelId,
          unitLabel: label,
          basePriceSnapshot: model.offsiteBasePrice,
          customizationTotal: 0,
        })
        .returning();

      res.json(newUnit);
    } catch (error: any) {
      console.error('Failed to create project unit:', error);
      res.status(500).json({ error: 'Failed to create project unit' });
    }
  });

  app.delete('/api/project-units/:id', async (req, res) => {
    try {
      const unitId = parseInt(req.params.id);
      
      const [deleted] = await db
        .delete(projectUnits)
        .where(eq(projectUnits.id, unitId))
        .returning();

      if (!deleted) {
        return res.status(404).json({ error: 'Unit not found' });
      }

      res.json({ success: true, deleted });
    } catch (error: any) {
      console.error('Failed to delete project unit:', error);
      res.status(500).json({ error: 'Failed to delete project unit' });
    }
  });
  
  // ---------------------------------------------------------------------------
  // DASHBOARD
  // ---------------------------------------------------------------------------
  
  // Get dashboard stats
  app.get("/api/dashboard/stats", async (req, res) => {
    try {
      const { count, countDistinct, or, and, sql } = await import("drizzle-orm");
      
      // Count CONTRACT PACKAGES (unique projects with contracts) instead of individual contracts
      // A package = 1 project with potentially multiple contracts (ONE, Manufacturing, OnSite)
      const totalPackagesResult = await db
        .select({ count: countDistinct(contracts.projectId) })
        .from(contracts);
      
      // Get all contracts with their project IDs for status-based counting
      const allContracts = await db
        .select({
          projectId: contracts.projectId,
          contractType: contracts.contractType,
          status: contracts.status,
        })
        .from(contracts);
      
      // Group by project and determine package status based on ONE Agreement status
      const packagesByProject = new Map<number, { status: string }>();
      allContracts.forEach(c => {
        if (c.projectId && c.contractType === 'one_agreement') {
          packagesByProject.set(c.projectId, { status: c.status || 'Draft' });
        }
      });
      
      // Count packages by status
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
      
      // Pending LLCs (forming status) - use llcs table which has status column
      const pendingLLCsResult = await db
        .select({ count: count() })
        .from(llcs)
        .where(or(
          eq(llcs.status, 'pending'),
          eq(llcs.status, 'forming')
        ));
      
      // Active projects = packages not in draft status
      const activeProjectsCount = packagesByProject.size - draftsCount;
      
      // Get contract values from financials (design fee + prelim costs as proxy for total value)
      const financialsData = await db.select().from(financials);
      const projectValues = new Map<number, number>();
      financialsData.forEach(f => {
        const value = ((f.designFee || 0) + (f.prelimOffsite || 0) + (f.prelimOnsite || 0)) / 100;
        projectValues.set(f.projectId, value);
      });
      
      // Calculate total contract value from packages
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
  // PROJECTS
  // ---------------------------------------------------------------------------
  
  // Get next available project number (format: YYYY-###)
  app.get("/api/projects/next-number", async (req, res) => {
    try {
      const currentYear = new Date().getFullYear();
      const yearPrefix = `${currentYear}-`;
      
      // Get all project numbers for the current year
      const allProjects = await db.select({ projectNumber: projects.projectNumber }).from(projects);
      
      // Filter for current year and find the highest number
      let maxNumber = 0;
      allProjects.forEach(p => {
        if (p.projectNumber && p.projectNumber.startsWith(yearPrefix)) {
          const numPart = parseInt(p.projectNumber.split('-')[1]);
          if (!isNaN(numPart) && numPart > maxNumber) {
            maxNumber = numPart;
          }
        }
      });
      
      const nextNumber = maxNumber + 1;
      const nextProjectNumber = `${currentYear}-${String(nextNumber).padStart(3, '0')}`;
      
      res.json({ projectNumber: nextProjectNumber });
    } catch (error) {
      console.error("Failed to generate project number:", error);
      res.status(500).json({ error: "Failed to generate project number" });
    }
  });

  // Check if project number is unique
  app.get("/api/projects/check-number/:projectNumber", async (req, res) => {
    try {
      const projectNumber = req.params.projectNumber;
      const excludeId = req.query.excludeId ? parseInt(req.query.excludeId as string) : null;
      
      // Build query - exclude current project if editing
      const conditions = excludeId 
        ? and(eq(projects.projectNumber, projectNumber), ne(projects.id, excludeId))
        : eq(projects.projectNumber, projectNumber);
      
      const existingProjects = await db
        .select({ id: projects.id })
        .from(projects)
        .where(conditions);
      
      res.json({ 
        isUnique: existingProjects.length === 0,
        exists: existingProjects.length > 0 
      });
    } catch (error) {
      console.error("Failed to check project number:", error);
      res.status(500).json({ error: "Failed to check project number" });
    }
  });

  // List all projects
  app.get("/api/projects", async (req, res) => {
    try {
      const allProjects = await db.select().from(projects);
      res.json(allProjects);
    } catch (error) {
      console.error("Failed to fetch projects:", error);
      res.status(500).json({ error: "Failed to fetch projects" });
    }
  });

  // Get single project with all relations
  app.get("/api/projects/:id", async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      const data = await getProjectWithRelations(projectId);
      if (!data) {
        return res.status(404).json({ error: "Project not found" });
      }
      res.json(data);
    } catch (error) {
      console.error("Failed to fetch project:", error);
      res.status(500).json({ error: "Failed to fetch project" });
    }
  });

  // Create project (with duplicate prevention)
  app.post("/api/projects", async (req, res) => {
    try {
      const { name, projectNumber, status } = req.body;
      
      // Check for existing draft with same name to prevent duplicates
      if (name && status === 'Draft') {
        const [existingDraft] = await db
          .select()
          .from(projects)
          .where(and(
            eq(projects.name, name),
            eq(projects.status, 'Draft')
          ))
          .limit(1);
        
        if (existingDraft) {
          // Update existing draft instead of creating duplicate
          console.log(`Found existing draft for "${name}" (ID: ${existingDraft.id}), updating instead of creating new`);
          const [updated] = await db
            .update(projects)
            .set({ ...req.body, updatedAt: new Date() })
            .where(eq(projects.id, existingDraft.id))
            .returning();
          return res.json(updated);
        }
      }
      
      // No existing draft found, create new project
      const [result] = await db.insert(projects).values(req.body).returning();
      res.json(result);
    } catch (error: any) {
      console.error("Failed to create project:", error);
      res.status(500).json({ 
        error: "Failed to create project",
        details: error?.message || String(error)
      });
    }
  });

  // Update project
  app.patch("/api/projects/:id", async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      const [result] = await db
        .update(projects)
        .set({ ...req.body, updatedAt: new Date() })
        .where(eq(projects.id, projectId))
        .returning();
      res.json(result);
    } catch (error) {
      console.error("Failed to update project:", error);
      res.status(500).json({ error: "Failed to update project" });
    }
  });

  // Delete project
  app.delete("/api/projects/:id", async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      await db.delete(projects).where(eq(projects.id, projectId));
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete project:", error);
      res.status(500).json({ error: "Failed to delete project" });
    }
  });

  // ---------------------------------------------------------------------------
  // CLIENTS
  // ---------------------------------------------------------------------------

  app.get("/api/projects/:projectId/client", async (req, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      const [client] = await db.select().from(clients).where(eq(clients.projectId, projectId));
      res.json(client || null);
    } catch (error) {
      console.error("Failed to fetch client:", error);
      res.status(500).json({ error: "Failed to fetch client" });
    }
  });

  app.post("/api/projects/:projectId/client", async (req, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      const [result] = await db.insert(clients).values({ ...req.body, projectId }).returning();
      res.json(result);
    } catch (error) {
      console.error("Failed to create client:", error);
      res.status(500).json({ error: "Failed to create client" });
    }
  });

  app.patch("/api/projects/:projectId/client", async (req, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      const [existing] = await db.select().from(clients).where(eq(clients.projectId, projectId));
      if (existing) {
        const [result] = await db
          .update(clients)
          .set(req.body)
          .where(eq(clients.projectId, projectId))
          .returning();
        res.json(result);
      } else {
        const [result] = await db.insert(clients).values({ ...req.body, projectId }).returning();
        res.json(result);
      }
    } catch (error) {
      console.error("Failed to update client:", error);
      res.status(500).json({ error: "Failed to update client" });
    }
  });

  // ---------------------------------------------------------------------------
  // CHILD LLC (uses consolidated PostgreSQL llcs table)
  // ---------------------------------------------------------------------------

  // Helper to map wizard childLlc format to llcs table format
  const mapChildLlcToLlcs = (data: any, projectId: number) => {
    return {
      name: data.legalName || data.name || '',
      projectName: data.projectName || '',
      projectId: projectId,
      clientLastName: data.clientLastName || '',
      deliveryAddress: data.deliveryAddress || data.address || '',
      status: data.status || 'forming',
      stateOfFormation: data.formationState || data.stateOfFormation || 'Delaware',
      einNumber: data.ein || data.einNumber || null,
      registeredAgent: data.registeredAgent || null,
      registeredAgentAddress: data.registeredAgentAddress || null,
      formationDate: data.formationDate || null,
      address: data.address || null,
      city: data.city || null,
      state: data.state || null,
      zip: data.zip || null,
      members: data.members || null,
    };
  };

  // Helper to map llcs record to childLlc format for backwards compatibility
  const mapLlcsToChildLlc = (record: any) => {
    if (!record) return null;
    return {
      id: record.id,
      projectId: record.projectId,
      legalName: record.name,
      formationState: record.stateOfFormation,
      entityType: 'LLC',
      ein: record.einNumber,
      formationDate: record.formationDate,
      registeredAgent: record.registeredAgent,
      registeredAgentAddress: record.registeredAgentAddress,
      address: record.address,
      city: record.city,
      state: record.state,
      zip: record.zip,
      status: record.status,
    };
  };

  app.get("/api/projects/:projectId/child-llc", async (req, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      const [llcRecord] = await db.select().from(llcs).where(eq(llcs.projectId, projectId));
      res.json(mapLlcsToChildLlc(llcRecord));
    } catch (error) {
      console.error("Failed to fetch child LLC:", error);
      res.status(500).json({ error: "Failed to fetch child LLC" });
    }
  });

  app.post("/api/projects/:projectId/child-llc", async (req, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      const llcData = mapChildLlcToLlcs(req.body, projectId);
      
      // Check if LLC with same name already exists
      const [existingLlc] = await db.select().from(llcs).where(eq(llcs.name, llcData.name));
      if (existingLlc) {
        // Update existing LLC to link to this project instead of creating duplicate
        const [updated] = await db.update(llcs)
          .set({ projectId, projectName: llcData.projectName })
          .where(eq(llcs.id, existingLlc.id))
          .returning();
        return res.json(mapLlcsToChildLlc(updated));
      }
      
      const [result] = await db.insert(llcs).values(llcData).returning();
      res.json(mapLlcsToChildLlc(result));
    } catch (error) {
      console.error("Failed to create child LLC:", error);
      res.status(500).json({ error: "Failed to create child LLC" });
    }
  });

  app.patch("/api/projects/:projectId/child-llc", async (req, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      const [existing] = await db.select().from(llcs).where(eq(llcs.projectId, projectId));
      
      // Map incoming fields to llcs format (handle both old and new field names)
      const updateData: any = {};
      if (req.body.legalName !== undefined) updateData.name = req.body.legalName;
      if (req.body.name !== undefined) updateData.name = req.body.name;
      if (req.body.formationState !== undefined) updateData.stateOfFormation = req.body.formationState;
      if (req.body.stateOfFormation !== undefined) updateData.stateOfFormation = req.body.stateOfFormation;
      if (req.body.ein !== undefined) updateData.einNumber = req.body.ein;
      if (req.body.einNumber !== undefined) updateData.einNumber = req.body.einNumber;
      if (req.body.formationDate !== undefined) updateData.formationDate = req.body.formationDate;
      if (req.body.registeredAgent !== undefined) updateData.registeredAgent = req.body.registeredAgent;
      if (req.body.registeredAgentAddress !== undefined) updateData.registeredAgentAddress = req.body.registeredAgentAddress;
      if (req.body.address !== undefined) updateData.address = req.body.address;
      if (req.body.city !== undefined) updateData.city = req.body.city;
      if (req.body.state !== undefined) updateData.state = req.body.state;
      if (req.body.zip !== undefined) updateData.zip = req.body.zip;
      if (req.body.status !== undefined) updateData.status = req.body.status;
      if (req.body.members !== undefined) updateData.members = req.body.members;
      if (req.body.projectName !== undefined) updateData.projectName = req.body.projectName;
      
      if (existing) {
        const [result] = await db
          .update(llcs)
          .set(updateData)
          .where(eq(llcs.projectId, projectId))
          .returning();
        res.json(mapLlcsToChildLlc(result));
      } else {
        const llcData = mapChildLlcToLlcs(req.body, projectId);
        const [result] = await db.insert(llcs).values(llcData).returning();
        res.json(mapLlcsToChildLlc(result));
      }
    } catch (error) {
      console.error("Failed to update child LLC:", error);
      res.status(500).json({ error: "Failed to update child LLC" });
    }
  });

  // ---------------------------------------------------------------------------
  // PROJECT DETAILS
  // ---------------------------------------------------------------------------

  app.get("/api/projects/:projectId/details", async (req, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      const [details] = await db.select().from(projectDetails).where(eq(projectDetails.projectId, projectId));
      res.json(details || null);
    } catch (error) {
      console.error("Failed to fetch project details:", error);
      res.status(500).json({ error: "Failed to fetch project details" });
    }
  });

  app.patch("/api/projects/:projectId/details", async (req, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      const [existing] = await db.select().from(projectDetails).where(eq(projectDetails.projectId, projectId));
      if (existing) {
        const [result] = await db
          .update(projectDetails)
          .set(req.body)
          .where(eq(projectDetails.projectId, projectId))
          .returning();
        res.json(result);
      } else {
        const [result] = await db.insert(projectDetails).values({ ...req.body, projectId }).returning();
        res.json(result);
      }
    } catch (error) {
      console.error("Failed to update project details:", error);
      res.status(500).json({ error: "Failed to update project details" });
    }
  });

  // ---------------------------------------------------------------------------
  // FINANCIALS
  // ---------------------------------------------------------------------------

  app.get("/api/projects/:projectId/financials", async (req, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      const [financial] = await db.select().from(financials).where(eq(financials.projectId, projectId));
      res.json(financial || null);
    } catch (error) {
      console.error("Failed to fetch financials:", error);
      res.status(500).json({ error: "Failed to fetch financials" });
    }
  });

  app.post("/api/projects/:projectId/financials", async (req, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      const [existing] = await db.select().from(financials).where(eq(financials.projectId, projectId));
      if (existing) {
        const [result] = await db
          .update(financials)
          .set(req.body)
          .where(eq(financials.projectId, projectId))
          .returning();
        res.json(result);
      } else {
        const [result] = await db.insert(financials).values({ ...req.body, projectId }).returning();
        res.json(result);
      }
    } catch (error) {
      console.error("Failed to create/update financials:", error);
      res.status(500).json({ error: "Failed to create/update financials" });
    }
  });

  // ---------------------------------------------------------------------------
  // PRICING ENGINE - Multi-Unit Pricing Summary
  // ---------------------------------------------------------------------------

  app.get("/api/projects/:id/pricing-summary", async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      
      if (isNaN(projectId)) {
        return res.status(400).json({ error: "Invalid project ID" });
      }

      const pricingSummary = await calculateProjectPricing(projectId);
      res.json(pricingSummary);
    } catch (error: any) {
      console.error("Failed to calculate pricing summary:", error);
      
      if (error.message?.includes('not found')) {
        return res.status(404).json({ error: error.message });
      }
      
      res.status(500).json({ error: "Failed to calculate pricing summary" });
    }
  });

  app.patch("/api/projects/:projectId/financials", async (req, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      const [existing] = await db.select().from(financials).where(eq(financials.projectId, projectId));
      if (existing) {
        const [result] = await db
          .update(financials)
          .set(req.body)
          .where(eq(financials.projectId, projectId))
          .returning();
        res.json(result);
      } else {
        const [result] = await db.insert(financials).values({ ...req.body, projectId }).returning();
        res.json(result);
      }
    } catch (error) {
      console.error("Failed to update financials:", error);
      res.status(500).json({ error: "Failed to update financials" });
    }
  });

  // Lock pricing
  app.post("/api/projects/:projectId/financials/lock", async (req, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      const { lockedBy } = req.body;
      
      const [result] = await db
        .update(financials)
        .set({
          isLocked: true,
          lockedAt: new Date(),
          lockedBy: lockedBy || "system",
        })
        .where(eq(financials.projectId, projectId))
        .returning();
      
      if (!result) {
        return res.status(404).json({ error: "Financials not found for project" });
      }
      
      res.json(result);
    } catch (error) {
      console.error("Failed to lock pricing:", error);
      res.status(500).json({ error: "Failed to lock pricing" });
    }
  });

  // ---------------------------------------------------------------------------
  // WARRANTY TERMS
  // ---------------------------------------------------------------------------

  app.get("/api/projects/:projectId/warranty-terms", async (req, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      const [warranty] = await db.select().from(warrantyTerms).where(eq(warrantyTerms.projectId, projectId));
      res.json(warranty || null);
    } catch (error) {
      console.error("Failed to fetch warranty terms:", error);
      res.status(500).json({ error: "Failed to fetch warranty terms" });
    }
  });

  app.patch("/api/projects/:projectId/warranty-terms", async (req, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      const [existing] = await db.select().from(warrantyTerms).where(eq(warrantyTerms.projectId, projectId));
      if (existing) {
        const [result] = await db
          .update(warrantyTerms)
          .set(req.body)
          .where(eq(warrantyTerms.projectId, projectId))
          .returning();
        res.json(result);
      } else {
        const [result] = await db.insert(warrantyTerms).values({ ...req.body, projectId }).returning();
        res.json(result);
      }
    } catch (error) {
      console.error("Failed to update warranty terms:", error);
      res.status(500).json({ error: "Failed to update warranty terms" });
    }
  });

  // ---------------------------------------------------------------------------
  // MILESTONES
  // ---------------------------------------------------------------------------

  app.get("/api/projects/:projectId/milestones", async (req, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      const projectMilestones = await db.select().from(milestones).where(eq(milestones.projectId, projectId));
      res.json(projectMilestones);
    } catch (error) {
      console.error("Failed to fetch milestones:", error);
      res.status(500).json({ error: "Failed to fetch milestones" });
    }
  });

  // Get milestones by type
  app.get("/api/projects/:projectId/milestones/:type", async (req, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      const milestoneType = req.params.type;
      const projectMilestones = await db
        .select()
        .from(milestones)
        .where(eq(milestones.projectId, projectId));
      const filtered = projectMilestones.filter(m => m.milestoneType === milestoneType);
      res.json(filtered);
    } catch (error) {
      console.error("Failed to fetch milestones:", error);
      res.status(500).json({ error: "Failed to fetch milestones" });
    }
  });

  app.post("/api/projects/:projectId/milestones", async (req, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      const [result] = await db.insert(milestones).values({ ...req.body, projectId }).returning();
      res.json(result);
    } catch (error) {
      console.error("Failed to create milestone:", error);
      res.status(500).json({ error: "Failed to create milestone" });
    }
  });

  app.patch("/api/milestones/:id", async (req, res) => {
    try {
      const milestoneId = parseInt(req.params.id);
      const [result] = await db
        .update(milestones)
        .set(req.body)
        .where(eq(milestones.id, milestoneId))
        .returning();
      res.json(result);
    } catch (error) {
      console.error("Failed to update milestone:", error);
      res.status(500).json({ error: "Failed to update milestone" });
    }
  });

  // Mark milestone as paid
  app.post("/api/milestones/:id/pay", async (req, res) => {
    try {
      const milestoneId = parseInt(req.params.id);
      const { paidAmount, invoiceNumber } = req.body;
      
      const [result] = await db
        .update(milestones)
        .set({
          status: "Paid",
          paidDate: new Date().toISOString(),
          paidAmount,
          invoiceNumber,
        })
        .where(eq(milestones.id, milestoneId))
        .returning();
      
      res.json(result);
    } catch (error) {
      console.error("Failed to mark milestone as paid:", error);
      res.status(500).json({ error: "Failed to mark milestone as paid" });
    }
  });

  app.delete("/api/milestones/:id", async (req, res) => {
    try {
      const milestoneId = parseInt(req.params.id);
      await db.delete(milestones).where(eq(milestones.id, milestoneId));
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete milestone:", error);
      res.status(500).json({ error: "Failed to delete milestone" });
    }
  });

  // Bulk create default milestones for a project
  app.post("/api/projects/:projectId/milestones/create-defaults", async (req, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      const { milestoneType } = req.body; // 'client', 'manufacturing', or 'onsite'
      
      const defaults: Record<string, Array<{ name: string; percentage: number; dueUpon: string }>> = {
        client: [
          { name: "Deposit", percentage: 10, dueUpon: "Contract Execution" },
          { name: "Design Completion", percentage: 15, dueUpon: "Design Approval" },
          { name: "Green Light", percentage: 25, dueUpon: "Green Light Approval" },
          { name: "Production Start", percentage: 20, dueUpon: "Production Commencement" },
          { name: "Delivery", percentage: 20, dueUpon: "Module Delivery" },
          { name: "Final", percentage: 10, dueUpon: "Final Inspection" },
        ],
        manufacturing: [
          { name: "Production Start", percentage: 30, dueUpon: "Production Commencement" },
          { name: "Mid-Production", percentage: 30, dueUpon: "50% Production Complete" },
          { name: "Production Complete", percentage: 30, dueUpon: "Production Complete" },
          { name: "Delivery", percentage: 10, dueUpon: "Module Delivery" },
        ],
        onsite: [
          { name: "Site Prep Start", percentage: 20, dueUpon: "Site Work Commencement" },
          { name: "Foundation Complete", percentage: 25, dueUpon: "Foundation Inspection" },
          { name: "Set Complete", percentage: 25, dueUpon: "Module Set Complete" },
          { name: "Systems Complete", percentage: 20, dueUpon: "MEP Rough Complete" },
          { name: "Final", percentage: 10, dueUpon: "Certificate of Occupancy" },
        ],
      };
      
      const milestonesToCreate = defaults[milestoneType] || [];
      const results = [];
      
      for (let i = 0; i < milestonesToCreate.length; i++) {
        const m = milestonesToCreate[i];
        const [result] = await db.insert(milestones).values({
          projectId,
          milestoneType,
          milestoneNumber: i + 1,
          name: m.name,
          percentage: m.percentage,
          dueUpon: m.dueUpon,
          status: "Pending",
        }).returning();
        results.push(result);
      }
      
      res.json(results);
    } catch (error) {
      console.error("Failed to create default milestones:", error);
      res.status(500).json({ error: "Failed to create default milestones" });
    }
  });

  // ---------------------------------------------------------------------------
  // CONTRACTORS
  // ---------------------------------------------------------------------------

  app.get("/api/projects/:projectId/contractors", async (req, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      const projectContractors = await db.select().from(contractors).where(eq(contractors.projectId, projectId));
      res.json(projectContractors);
    } catch (error) {
      console.error("Failed to fetch contractors:", error);
      res.status(500).json({ error: "Failed to fetch contractors" });
    }
  });

  // Get contractor by type
  app.get("/api/projects/:projectId/contractors/:type", async (req, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      const contractorType = req.params.type;
      const projectContractors = await db
        .select()
        .from(contractors)
        .where(eq(contractors.projectId, projectId));
      const filtered = projectContractors.filter(c => c.contractorType === contractorType);
      res.json(filtered[0] || null);
    } catch (error) {
      console.error("Failed to fetch contractor:", error);
      res.status(500).json({ error: "Failed to fetch contractor" });
    }
  });

  // Upsert contractor - create or update based on projectId and contractorType
  app.post("/api/projects/:projectId/contractors", async (req, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      const { contractorType, ...otherData } = req.body;
      
      // Check if contractor of this type already exists for this project
      const existing = await db
        .select()
        .from(contractors)
        .where(and(
          eq(contractors.projectId, projectId),
          eq(contractors.contractorType, contractorType)
        ));
      
      if (existing.length > 0) {
        // Update existing contractor
        const [result] = await db
          .update(contractors)
          .set(otherData)
          .where(eq(contractors.id, existing[0].id))
          .returning();
        res.json(result);
      } else {
        // Create new contractor
        const [result] = await db.insert(contractors).values({ ...req.body, projectId }).returning();
        res.json(result);
      }
    } catch (error) {
      console.error("Failed to create/update contractor:", error);
      res.status(500).json({ error: "Failed to create/update contractor" });
    }
  });

  app.patch("/api/contractors/:id", async (req, res) => {
    try {
      const contractorId = parseInt(req.params.id);
      const [result] = await db
        .update(contractors)
        .set(req.body)
        .where(eq(contractors.id, contractorId))
        .returning();
      res.json(result);
    } catch (error) {
      console.error("Failed to update contractor:", error);
      res.status(500).json({ error: "Failed to update contractor" });
    }
  });

  app.delete("/api/contractors/:id", async (req, res) => {
    try {
      const contractorId = parseInt(req.params.id);
      await db.delete(contractors).where(eq(contractors.id, contractorId));
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete contractor:", error);
      res.status(500).json({ error: "Failed to delete contractor" });
    }
  });

  // ---------------------------------------------------------------------------
  // CONTRACTOR ENTITIES (Reusable across projects)
  // ---------------------------------------------------------------------------

  // Get all contractor entities (optionally filter by type)
  app.get("/api/contractor-entities", async (req, res) => {
    try {
      const { type } = req.query;
      let query = db.select().from(contractorEntities).where(eq(contractorEntities.isActive, true));
      
      const allEntities = await query;
      
      // Filter by type if specified
      const filtered = type 
        ? allEntities.filter(e => e.contractorType === type)
        : allEntities;
      
      res.json(filtered);
    } catch (error) {
      console.error("Failed to fetch contractor entities:", error);
      res.status(500).json({ error: "Failed to fetch contractor entities" });
    }
  });

  // Get contractor entities by type
  app.get("/api/contractor-entities/type/:type", async (req, res) => {
    try {
      const contractorType = req.params.type;
      const entities = await db
        .select()
        .from(contractorEntities)
        .where(and(
          eq(contractorEntities.contractorType, contractorType),
          eq(contractorEntities.isActive, true)
        ));
      res.json(entities);
    } catch (error) {
      console.error("Failed to fetch contractor entities by type:", error);
      res.status(500).json({ error: "Failed to fetch contractor entities" });
    }
  });

  // Create new contractor entity
  app.post("/api/contractor-entities", async (req, res) => {
    try {
      const [result] = await db.insert(contractorEntities).values(req.body).returning();
      res.json(result);
    } catch (error) {
      console.error("Failed to create contractor entity:", error);
      res.status(500).json({ error: "Failed to create contractor entity" });
    }
  });

  // Update contractor entity
  app.patch("/api/contractor-entities/:id", async (req, res) => {
    try {
      const entityId = parseInt(req.params.id);
      const [result] = await db
        .update(contractorEntities)
        .set(req.body)
        .where(eq(contractorEntities.id, entityId))
        .returning();
      res.json(result);
    } catch (error) {
      console.error("Failed to update contractor entity:", error);
      res.status(500).json({ error: "Failed to update contractor entity" });
    }
  });

  // ---------------------------------------------------------------------------
  // CONTRACT GENERATION
  // ---------------------------------------------------------------------------

  // Preview variables for a project (without generating)
  app.get("/api/projects/:projectId/contract-variables", async (req, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      const data = await getProjectWithRelations(projectId);
      if (!data) {
        return res.status(404).json({ error: "Project not found" });
      }
      const variables = mapProjectToVariables(data);
      res.json(variables);
    } catch (error) {
      console.error("Failed to get contract variables:", error);
      res.status(500).json({ error: "Failed to get contract variables" });
    }
  });

  // Validate variables for a specific contract type
  app.get("/api/projects/:projectId/validate/:contractType", async (req, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      const contractType = req.params.contractType as "one_agreement" | "manufacturing_sub" | "onsite_sub";
      
      const data = await getProjectWithRelations(projectId);
      if (!data) {
        return res.status(404).json({ error: "Project not found" });
      }
      
      const variables = mapProjectToVariables(data);
      const validation = validateVariablesForContract(variables, contractType);
      
      res.json({
        valid: validation.missing.length === 0,
        missing: validation.missing,
        warnings: validation.warnings,
      });
    } catch (error) {
      console.error("Failed to validate:", error);
      res.status(500).json({ error: "Failed to validate" });
    }
  });

  // Analyze a template file
  app.post("/api/templates/analyze", async (req, res) => {
    try {
      const { templatePath: reqTemplatePath } = req.body;
      
      if (!fs.existsSync(reqTemplatePath)) {
        return res.status(404).json({ error: "Template not found" });
      }
      
      const content = fs.readFileSync(reqTemplatePath, "binary");
      const zip = new PizZip(content);
      const doc = zip.file("word/document.xml")?.asText() || "";
      
      const templateVars = extractTemplateVariables(doc);
      const coverage = getVariableCoverage(templateVars);
      
      res.json({
        templatePath: reqTemplatePath,
        variables: templateVars,
        coverage,
      });
    } catch (error) {
      console.error("Failed to analyze template:", error);
      res.status(500).json({ error: "Failed to analyze template" });
    }
  });

  // Generate a single contract
  app.post("/api/projects/:projectId/generate/:contractType", async (req, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      const contractType = req.params.contractType as "one_agreement" | "manufacturing_sub" | "onsite_sub";
      const { generatedBy } = req.body;
      
      const result = await generateContract({ projectId, contractType, generatedBy });
      
      if (result.success) {
        res.json({
          success: true,
          fileName: result.fileName,
          contractId: result.contractId,
          downloadUrl: `/api/contracts/download/${encodeURIComponent(result.fileName!)}`,
          warnings: result.warnings,
        });
      } else {
        res.status(400).json({
          success: false,
          errors: result.errors,
          warnings: result.warnings,
        });
      }
    } catch (error) {
      console.error("Failed to generate contract:", error);
      res.status(500).json({ error: "Failed to generate contract" });
    }
  });

  // Generate all contracts for a project
  app.post("/api/projects/:projectId/generate-all", async (req, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      const { generatedBy } = req.body;
      
      const data = await getProjectWithRelations(projectId);
      
      if (!data) {
        return res.status(404).json({ error: "Project not found" });
      }

      const contractTypes: ("one_agreement" | "manufacturing_sub" | "onsite_sub")[] = [
        "one_agreement",
        "manufacturing_sub",
      ];

      // Only include onsite_sub if CMOS selected
      if (data.project.onSiteSelection === "CMOS") {
        contractTypes.push("onsite_sub");
      }

      const results: Record<string, GenerateContractResult> = {};
      
      for (const contractType of contractTypes) {
        results[contractType] = await generateContract({ projectId, contractType, generatedBy });
      }

      const allSuccessful = Object.values(results).every(r => r.success);
      const successfulContracts = Object.entries(results)
        .filter(([_, r]) => r.success)
        .map(([type, r]) => ({
          type,
          fileName: r.fileName,
          contractId: r.contractId,
          downloadUrl: `/api/contracts/download/${encodeURIComponent(r.fileName!)}`,
        }));
      
      res.json({
        success: allSuccessful,
        contracts: successfulContracts,
        results,
        summary: {
          total: contractTypes.length,
          successful: Object.values(results).filter(r => r.success).length,
          failed: Object.values(results).filter(r => !r.success).length,
        },
      });
    } catch (error) {
      console.error("Failed to generate contracts:", error);
      res.status(500).json({ error: "Failed to generate contracts" });
    }
  });

  // Download generated contract
  app.get("/api/contracts/download/:fileName", async (req, res) => {
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

  // List generated contracts for a project
  app.get("/api/projects/:projectId/contracts", async (req, res) => {
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

  // Get all contract packages (grouped by project)
  app.get("/api/contracts", async (req, res) => {
    try {
      // Get all generated contracts
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
      
      // Get all draft projects (status = 'Draft') that haven't generated contracts yet
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
      
      // Get financials for contract values
      const financialsData = await db.select().from(financials);
      const projectValues = new Map<number, number>();
      financialsData.forEach(f => {
        const value = ((f.designFee || 0) + (f.prelimOffsite || 0) + (f.prelimOnsite || 0)) / 100;
        projectValues.set(f.projectId, value);
      });
      
      // Normalize status to lowercase for UI StatusBadge compatibility
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
      
      // Group contracts by project into packages
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
      
      // First, add draft projects that don't have contracts yet
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
      
      // Then add projects with generated contracts
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
          // Update package status from ONE Agreement
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
      
      // Convert to array and add computed fields
      const packages = Array.from(packageMap.values()).map(pkg => ({
        ...pkg,
        title: `${pkg.projectName} Contract Package`,
        clientName: pkg.projectName,
        contractCount: pkg.contracts.length,
      }));
      
      // Sort: drafts first (by createdAt desc), then contracts (by generatedAt desc)
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

  // Create new contract
  app.post("/api/contracts", async (req, res) => {
    try {
      const [result] = await db.insert(contracts).values(req.body).returning();
      res.json(result);
    } catch (error) {
      console.error("Failed to create contract:", error);
      res.status(500).json({ error: "Failed to create contract" });
    }
  });

  // Get single contract with project info
  app.get("/api/contracts/:id", async (req, res) => {
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

  // Get clauses for a contract based on contract type (with variable substitution)
  app.get("/api/contracts/:id/clauses", async (req, res) => {
    try {
      const contractId = parseInt(req.params.id);
      const [contract] = await db.select().from(contracts).where(eq(contracts.id, contractId));
      
      if (!contract) {
        return res.status(404).json({ error: "Contract not found" });
      }

      // Map contract type to template type (match database values)
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
      
      // Get clauses for this contract type
      const clauseQuery = `
        SELECT c.id, c.name, c.content, c.hierarchy_level, c.risk_level, c.clause_code as section_number
        FROM clauses c
        WHERE c.contract_type = $1 OR c.contract_type = 'ALL'
        ORDER BY c.sort_order, c.clause_code
      `;
      
      const result = await pool.query(clauseQuery, [templateType]);
      
      // Get project data for variable substitution
      let variables: Record<string, string | number | boolean | null> = {};
      if (contract.projectId) {
        const projectData = await getProjectWithRelations(contract.projectId);
        if (projectData) {
          variables = mapProjectToVariables(projectData);
        }
      }
      
      // Replace variables in clause content
      const clausesWithValues = result.rows.map((clause: any) => {
        let content = clause.content || '';
        
        // Replace all {{VARIABLE_NAME}} patterns with actual values
        content = content.replace(/\{\{([A-Z0-9_]+)\}\}/g, (match: string, varName: string) => {
          const value = variables[varName];
          if (value !== null && value !== undefined && value !== '') {
            return String(value);
          }
          // Keep the placeholder if no value (will be highlighted in UI)
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

  // Update contract status
  app.patch("/api/contracts/:id", async (req, res) => {
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

  // Mark contract as sent
  app.post("/api/contracts/:id/send", async (req, res) => {
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

  // Mark contract as executed
  app.post("/api/contracts/:id/execute", async (req, res) => {
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
  // CONTRACT PACKAGE GENERATION (Clause-based)
  // ---------------------------------------------------------------------------

  // Get required variables for a contract type
  app.get("/api/contracts/variables/:contractType", async (req, res) => {
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
      
      // Group by category
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

  // Preview which clauses will be included for given project parameters
  app.post("/api/contracts/preview-clauses", async (req, res) => {
    try {
      const { contractType, projectData } = req.body;
      
      if (!contractType || !projectData) {
        return res.status(400).json({ 
          error: "Both contractType and projectData are required" 
        });
      }
      
      // Get the template
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
      
      // Get base clause IDs
      let clauseIds = [...(template.base_clause_ids || [])];
      
      // Process conditional rules
      const conditionalRules = template.conditional_rules || {};
      for (const [conditionKey, ruleSet] of Object.entries(conditionalRules)) {
        const projectValue = projectData[conditionKey];
        const rules = ruleSet as Record<string, number[]>;
        if (projectValue !== undefined && rules[String(projectValue)]) {
          clauseIds.push(...rules[String(projectValue)]);
        }
      }
      
      // Fetch the clauses
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
      const clauses = clausesResult.rows;
      
      // Organize by hierarchy
      const sections = clauses.filter((c: any) => c.hierarchy_level === 1);
      const subsections = clauses.filter((c: any) => c.hierarchy_level === 2);
      const paragraphs = clauses.filter((c: any) => c.hierarchy_level === 3);
      const conditionalIncluded = clauses.filter((c: any) => c.conditions !== null);
      
      res.json({
        contractType: contractType.toUpperCase(),
        template: template.display_name,
        summary: {
          totalClauses: clauses.length,
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
        allClauses: clauses.map((c: any) => ({
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

  // Generate full contract package (ONE + Manufacturing + OnSite)
  app.post("/api/contracts/generate-package", async (req, res) => {
    try {
      const { projectData } = req.body;
      
      if (!projectData) {
        return res.status(400).json({ 
          error: "Project data is required",
          message: "Please provide projectData object with all required variables"
        });
      }
      
      // LOG THE ACTUAL DATA BEING SENT
      console.log('\n=== WIZARD DATA RECEIVED ===');
      console.log(JSON.stringify(projectData, null, 2));
      console.log('=== END WIZARD DATA ===\n');
      
      console.log("Generating contract package for project:", projectData.PROJECT_NAME);
      
      // Add calculated/derived fields
      const enrichedData = {
        ...projectData,
        IS_CRC: projectData.SERVICE_MODEL === "CRC",
        IS_CMOS: projectData.SERVICE_MODEL === "CMOS",
        CONTRACT_DATE: projectData.CONTRACT_DATE || new Date().toISOString().split("T")[0]
      };
      
      // Helper function to generate a single contract
      const generateSingleContract = async (contractType: string) => {
        // Get the template
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
        
        // Get clause IDs
        let clauseIds = [...(template.base_clause_ids || [])];
        const conditionalRules = template.conditional_rules || {};
        
        for (const [conditionKey, ruleSet] of Object.entries(conditionalRules)) {
          const projectValue = enrichedData[conditionKey];
          const rules = ruleSet as Record<string, number[]>;
          if (projectValue !== undefined && rules[String(projectValue)]) {
            clauseIds.push(...rules[String(projectValue)]);
          }
        }
        
        // Fetch clauses
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
        const clauses = clausesResult.rows;
        
        // Build document text
        let documentText = "";
        for (const clause of clauses) {
          if (clause.hierarchy_level === 1) {
            documentText += `\n\n${clause.name.toUpperCase()}\n\n`;
          } else if (clause.hierarchy_level === 2) {
            documentText += `\n${clause.name}\n\n`;
          } else {
            documentText += "\n";
          }
          documentText += clause.content + "\n";
        }
        
        // Replace variables
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
          clauseCount: clauses.length
        };
      };
      
      // Generate all three contracts
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

  // Download contract as properly formatted Word document
  // Uses clause library to dynamically generate contracts
  // Legacy endpoint for backward compatibility
  app.post("/api/contracts/download-docx", async (req, res) => {
    res.redirect(307, '/api/contracts/download-pdf');
  });

  // Download all contracts as a single ZIP file
  app.post("/api/contracts/download-all-zip", async (req, res) => {
    try {
      const { projectId } = req.body;
      
      if (!projectId) {
        return res.status(400).json({ error: "projectId is required" });
      }
      
      // Fetch project data
      const fullProject = await getProjectWithRelations(projectId);
      if (!fullProject) {
        return res.status(404).json({ error: "Project not found" });
      }
      
      // Map to flat variable structure
      const { mapProjectToVariables, formatCentsAsCurrency, centsToDollars } = await import('./lib/mapper');
      const projectData = mapProjectToVariables(fullProject);
      
      console.log(`\n=== Generating ALL contracts as ZIP for project ${projectId} ===`);
      console.log(`Project: ${projectData.PROJECT_NUMBER} - ${projectData.PROJECT_NAME}`);
      
      // =====================================================================
      // PHASE 4: Inject Pricing Engine Data
      // =====================================================================
      const { calculateProjectPricing } = await import('./services/pricingEngine');
      
      try {
        const pricingSummary = await calculateProjectPricing(projectId);
        
        // Fetch project units for unit summary
        const projectUnitsData = await db
          .select({
            unitLabel: projectUnits.unitLabel,
            modelName: homeModels.name,
          })
          .from(projectUnits)
          .innerJoin(homeModels, eq(projectUnits.modelId, homeModels.id))
          .where(eq(projectUnits.projectId, projectId));
        
        if (pricingSummary.unitCount > 0) {
          // Override financial variables with pricing engine data
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
          
          // Inject milestone data from payment schedule
          pricingSummary.paymentSchedule.forEach((milestone, index) => {
            const num = index + 1;
            projectData[`MILESTONE_${num}_NAME`] = milestone.name;
            projectData[`MILESTONE_${num}_PERCENT`] = `${milestone.percentage}%`;
            projectData[`MILESTONE_${num}_AMOUNT`] = formatCentsAsCurrency(milestone.amount);
            projectData[`MILESTONE_${num}_PHASE`] = milestone.phase;
            projectData[`CLIENT_MILESTONE_${num}_NAME`] = milestone.name;
            projectData[`CLIENT_MILESTONE_${num}_PERCENT`] = `${milestone.percentage}%`;
            projectData[`CLIENT_MILESTONE_${num}_AMOUNT`] = formatCentsAsCurrency(milestone.amount);
            
            // Handle retainage specifically (last milestone)
            if (milestone.name === 'Retainage' || milestone.name.toLowerCase().includes('retainage')) {
              projectData.RETAINAGE_PERCENT = `${milestone.percentage}%`;
              projectData.RETAINAGE_AMOUNT = formatCentsAsCurrency(milestone.amount);
            }
          });
          
          // Create unit summary string
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
          
          // Inject new pricing engine totals (Phase B: Financial Engine Calibration)
          projectData.TOTAL_PROJECT_BUDGET = centsToDollars(pricingSummary.projectBudget);
          projectData.TOTAL_PROJECT_BUDGET_WRITTEN = formatCentsAsCurrency(pricingSummary.projectBudget);
          projectData.TOTAL_CONTRACT_PRICE = centsToDollars(pricingSummary.contractValue);
          projectData.TOTAL_CONTRACT_PRICE_WRITTEN = formatCentsAsCurrency(pricingSummary.contractValue);
          projectData.PRICING_SERVICE_MODEL = pricingSummary.serviceModel;
          
          // Update contract price to use contractValue (what Dvele actually charges)
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
      
      const { generateContract, getContractFilename } = await import('./lib/contractGenerator');
      const archiver = (await import('archiver')).default;
      
      // Determine which contracts to generate based on service model
      const contractTypes: Array<'ONE' | 'MANUFACTURING' | 'ONSITE'> = ['ONE', 'MANUFACTURING', 'ONSITE'];
      
      // Generate all contracts
      const contracts: Array<{ buffer: Buffer; filename: string }> = [];
      
      for (const contractType of contractTypes) {
        try {
          const buffer = await generateContract({
            contractType,
            projectData,
            format: 'pdf'
          });
          const filename = getContractFilename(contractType, projectData, 'pdf');
          contracts.push({ buffer, filename });
          console.log(`Generated ${contractType}: ${filename} (${buffer.length} bytes)`);
        } catch (err) {
          console.error(`Failed to generate ${contractType}:`, err);
          // Continue with other contracts even if one fails
        }
      }
      
      if (contracts.length === 0) {
        return res.status(500).json({ error: "Failed to generate any contracts" });
      }
      
      // Create zip archive
      const archive = archiver('zip', { zlib: { level: 9 } });
      
      // Set response headers
      const zipFilename = `${projectData.PROJECT_NUMBER || 'Contracts'}_Package.zip`;
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${zipFilename}"`);
      
      // Pipe archive to response
      archive.pipe(res);
      
      // Add each contract to the archive
      for (const contract of contracts) {
        archive.append(contract.buffer, { name: contract.filename });
      }
      
      // Finalize the archive
      await archive.finalize();
      
      console.log(`ZIP archive created with ${contracts.length} contracts`);
      
    } catch (error) {
      console.error("Error generating ZIP:", error);
      res.status(500).json({ 
        error: "Failed to generate contract package",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // PDF download endpoint - accepts projectId and fetches data server-side
  app.post("/api/contracts/download-pdf", async (req, res) => {
    try {
      const { contractType, projectId, projectData: legacyProjectData } = req.body;
      
      if (!contractType) {
        return res.status(400).json({ error: "contractType is required" });
      }
      
      // Support both new projectId approach and legacy projectData for backwards compatibility
      let projectData: any;
      
      if (projectId) {
        // New approach: fetch and map data server-side
        const fullProject = await getProjectWithRelations(projectId);
        if (!fullProject) {
          return res.status(404).json({ error: "Project not found" });
        }
        
        // Map to flat variable structure using the mapper
        const { mapProjectToVariables, formatCentsAsCurrency, centsToDollars } = await import('./lib/mapper');
        projectData = mapProjectToVariables(fullProject);
        
        console.log(`\n=== Generating ${contractType} contract for project ${projectId} ===`);
        console.log(`Project: ${projectData.PROJECT_NUMBER} - ${projectData.PROJECT_NAME}`);
        console.log(`Service Model: ${projectData.ON_SITE_SELECTION}`);
        
        // =====================================================================
        // PHASE 4: Inject Pricing Engine Data
        // =====================================================================
        const { calculateProjectPricing } = await import('./services/pricingEngine');
        
        try {
          const pricingSummary = await calculateProjectPricing(projectId);
          
          // Fetch project units for unit summary
          const projectUnitsData = await db
            .select({
              unitLabel: projectUnits.unitLabel,
              modelName: homeModels.name,
            })
            .from(projectUnits)
            .innerJoin(homeModels, eq(projectUnits.modelId, homeModels.id))
            .where(eq(projectUnits.projectId, projectId));
          
          if (pricingSummary.unitCount > 0) {
            // Override financial variables with pricing engine data
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
            
            // Inject milestone data from payment schedule
            pricingSummary.paymentSchedule.forEach((milestone, index) => {
              const num = index + 1;
              projectData[`MILESTONE_${num}_NAME`] = milestone.name;
              projectData[`MILESTONE_${num}_PERCENT`] = `${milestone.percentage}%`;
              projectData[`MILESTONE_${num}_AMOUNT`] = formatCentsAsCurrency(milestone.amount);
              projectData[`MILESTONE_${num}_PHASE`] = milestone.phase;
              // Also set for CLIENT_ prefixed milestones
              projectData[`CLIENT_MILESTONE_${num}_NAME`] = milestone.name;
              projectData[`CLIENT_MILESTONE_${num}_PERCENT`] = `${milestone.percentage}%`;
              projectData[`CLIENT_MILESTONE_${num}_AMOUNT`] = formatCentsAsCurrency(milestone.amount);
              
              // Handle retainage specifically (last milestone)
              if (milestone.name === 'Retainage' || milestone.name.toLowerCase().includes('retainage')) {
                projectData.RETAINAGE_PERCENT = `${milestone.percentage}%`;
                projectData.RETAINAGE_AMOUNT = formatCentsAsCurrency(milestone.amount);
              }
            });
            
            // Create unit summary string
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
            
            // Inject new pricing engine totals (Phase B: Financial Engine Calibration)
            projectData.TOTAL_PROJECT_BUDGET = centsToDollars(pricingSummary.projectBudget);
            projectData.TOTAL_PROJECT_BUDGET_WRITTEN = formatCentsAsCurrency(pricingSummary.projectBudget);
            projectData.TOTAL_CONTRACT_PRICE = centsToDollars(pricingSummary.contractValue);
            projectData.TOTAL_CONTRACT_PRICE_WRITTEN = formatCentsAsCurrency(pricingSummary.contractValue);
            projectData.PRICING_SERVICE_MODEL = pricingSummary.serviceModel;
            
            // Update contract price to use contractValue (what Dvele actually charges)
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
        // Legacy approach: use provided projectData directly
        projectData = legacyProjectData;
        console.log(`\n=== Generating ${contractType} contract (legacy mode) ===`);
      } else {
        return res.status(400).json({ error: "Either projectId or projectData is required" });
      }

      const { generateContract, getContractFilename } = await import('./lib/contractGenerator');
      
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

  // =============================================================================
  // LLC ADMINISTRATION
  // =============================================================================

  app.get("/api/llcs", async (req, res) => {
    try {
      const result = await db.select().from(llcs).orderBy(desc(llcs.createdAt));
      res.json(result);
    } catch (error) {
      console.error("Failed to fetch LLCs:", error);
      res.status(500).json({ error: "Failed to fetch LLCs" });
    }
  });

  app.get("/api/llcs/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const result = await pool.query(`SELECT * FROM llcs WHERE id = $1`, [id]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: "LLC not found" });
      }
      res.json(result.rows[0]);
    } catch (error) {
      console.error("Failed to fetch LLC:", error);
      res.status(500).json({ error: "Failed to fetch LLC" });
    }
  });

  app.post("/api/llcs", async (req, res) => {
    try {
      const { 
        name, projectName, projectId, clientLastName, deliveryAddress,
        status, stateOfFormation, einNumber, registeredAgent, registeredAgentAddress,
        formationDate, address, city, state, zip, members, 
        annualReportDueDate, annualReportStatus
      } = req.body;
      
      // Check if LLC with same name already exists
      const existing = await pool.query('SELECT * FROM llcs WHERE name = $1', [name]);
      if (existing.rows.length > 0) {
        return res.status(409).json({ 
          error: "An LLC with this name already exists",
          existingLlc: existing.rows[0]
        });
      }
      
      const result = await pool.query(`
        INSERT INTO llcs (
          name, project_name, project_id, client_last_name, delivery_address,
          status, state_of_formation, ein_number, registered_agent, registered_agent_address,
          formation_date, address, city, state, zip, members,
          annual_report_due_date, annual_report_status, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, NOW(), NOW()
        ) RETURNING *
      `, [
        name, projectName, projectId, clientLastName, deliveryAddress,
        status || 'forming', stateOfFormation || 'Delaware', einNumber, registeredAgent, registeredAgentAddress,
        formationDate, address, city, state, zip, members,
        annualReportDueDate, annualReportStatus || 'pending'
      ]);
      
      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error("Failed to create LLC:", error);
      res.status(500).json({ error: "Failed to create LLC" });
    }
  });

  app.patch("/api/llcs/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      
      // Build dynamic SET clause
      const updateFields: string[] = [];
      const values: any[] = [];
      let paramCount = 1;
      
      const fieldMapping: Record<string, string> = {
        name: 'name',
        projectName: 'project_name',
        projectId: 'project_id',
        clientLastName: 'client_last_name',
        deliveryAddress: 'delivery_address',
        status: 'status',
        stateOfFormation: 'state_of_formation',
        einNumber: 'ein_number',
        registeredAgent: 'registered_agent',
        registeredAgentAddress: 'registered_agent_address',
        formationDate: 'formation_date',
        address: 'address',
        city: 'city',
        state: 'state',
        zip: 'zip',
        members: 'members',
        annualReportDueDate: 'annual_report_due_date',
        annualReportStatus: 'annual_report_status',
      };
      
      for (const [key, value] of Object.entries(updates)) {
        const dbField = fieldMapping[key];
        if (dbField) {
          updateFields.push(`${dbField} = $${paramCount}`);
          values.push(value);
          paramCount++;
        }
      }
      
      if (updateFields.length === 0) {
        return res.status(400).json({ error: "No valid fields to update" });
      }
      
      updateFields.push(`updated_at = NOW()`);
      values.push(id);
      
      const result = await pool.query(`
        UPDATE llcs SET ${updateFields.join(', ')} 
        WHERE id = $${paramCount}
        RETURNING *
      `, values);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: "LLC not found" });
      }
      
      res.json(result.rows[0]);
    } catch (error) {
      console.error("Failed to update LLC:", error);
      res.status(500).json({ error: "Failed to update LLC" });
    }
  });

  app.delete("/api/llcs/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const result = await pool.query(`DELETE FROM llcs WHERE id = $1 RETURNING *`, [id]);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: "LLC not found" });
      }
      
      res.json({ success: true, deleted: result.rows[0] });
    } catch (error) {
      console.error("Failed to delete LLC:", error);
      res.status(500).json({ error: "Failed to delete LLC" });
    }
  });

  // ==========================================
  // DEBUG ENDPOINTS
  // ==========================================
  
  // Debug endpoint - get all unique variables used in clauses
  app.get('/api/debug/variables-in-clauses', async (req, res) => {
    try {
      const clausesResult = await pool.query('SELECT content FROM clauses');
      const clauses = clausesResult.rows;
      
      // Extract all {{VARIABLE_NAME}} patterns
      const variableSet = new Set<string>();
      
      clauses.forEach((clause: any) => {
        const content = clause.content || '';
        const matches = content.match(/\{\{([A-Z_0-9]+)\}\}/g);
        if (matches) {
          matches.forEach((match: string) => {
            // Remove {{ and }}
            const varName = match.replace(/[{}]/g, '');
            variableSet.add(varName);
          });
        }
      });
      
      const variables = Array.from(variableSet).sort();
      
      res.json({
        totalVariables: variables.length,
        variables: variables,
        clausesChecked: clauses.length
      });
      
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==========================================
  // CLAUSES ENDPOINTS
  // ==========================================
  
  // Get all clauses with optional filtering
  app.get("/api/clauses", async (req, res) => {
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
      
      // Get summary stats
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
  
  // Get single clause by ID
  app.get("/api/clauses/:id", async (req, res) => {
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
  
  // Update clause (for legal team editing)
  app.patch("/api/clauses/:id", async (req, res) => {
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
  
  // Get clause categories
  app.get("/api/clauses/meta/categories", async (req, res) => {
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
  
  // Get clause contract types
  app.get("/api/clauses/meta/contract-types", async (req, res) => {
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
  
  // ==========================================
  // VARIABLES ENDPOINTS
  // ==========================================
  
  // Get all variable definitions with categories
  app.get("/api/variables", async (_req, res) => {
    try {
      // Import the variable categories from mapper
      const { VARIABLE_CATEGORIES, ALL_VARIABLES } = await import("./lib/mapper");
      
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
  
  // Compare CRC vs CMOS clause differences
  app.post("/api/contracts/compare-service-models", async (req, res) => {
    try {
      const { projectData } = req.body;
      
      if (!projectData) {
        return res.status(400).json({ error: "projectData is required" });
      }
      
      // Get clauses for both CRC and CMOS versions
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
        
        // Filter based on conditions
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
      
      // Find differences
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

  // =============================================================================
  // VARIABLE MAPPINGS API (for Contract Variable Management)
  // =============================================================================

  // Get all variable mappings with stats and clause usage
  app.get("/api/variable-mappings", async (req, res) => {
    try {
      const { search } = req.query;
      
      // Get all variables from contract_variables table
      let variablesQuery = `
        SELECT * FROM contract_variables
        ORDER BY category, variable_name
      `;
      
      const variablesResult = await pool.query(variablesQuery);
      let variables = variablesResult.rows;
      
      // Apply search filter if provided
      if (search && typeof search === 'string') {
        const searchLower = search.toLowerCase();
        variables = variables.filter((v: any) => 
          v.variable_name?.toLowerCase().includes(searchLower) ||
          v.display_name?.toLowerCase().includes(searchLower) ||
          v.category?.toLowerCase().includes(searchLower)
        );
      }
      
      // Get clause usage for each variable by searching for {{VARIABLE_NAME}} patterns
      const clauseUsageQuery = `
        SELECT id, clause_code, name, content, contract_type, hierarchy_level
        FROM clauses
        WHERE content LIKE '%{{%'
      `;
      const clausesResult = await pool.query(clauseUsageQuery);
      const clausesWithVariables = clausesResult.rows;
      
      // Build a map of variable -> clauses that use it
      const variableToClausesMap: Record<string, any[]> = {};
      
      for (const clause of clausesWithVariables) {
        // Extract all variable names from the clause content (support uppercase, numbers, underscores)
        const variablePattern = /\{\{([A-Z0-9_]+)\}\}/gi;
        let match;
        while ((match = variablePattern.exec(clause.content)) !== null) {
          const varName = match[1];
          if (!variableToClausesMap[varName]) {
            variableToClausesMap[varName] = [];
          }
          // Add clause if not already in the list
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
      
      // Enrich variables with clause usage
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
      
      // Calculate stats
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

  // Create a new variable
  app.post("/api/variable-mappings", async (req, res) => {
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

  // Update a variable
  app.patch("/api/variable-mappings/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { variableName, displayName, category, dataType, defaultValue, isRequired, description, erpSource } = req.body;
      
      // Build dynamic update query
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

  // Delete a variable
  app.delete("/api/variable-mappings/:id", async (req, res) => {
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

  // Clean up duplicate draft projects - keeps most recent, deletes older duplicates
  app.post("/api/admin/cleanup-duplicate-drafts", async (req, res) => {
    try {
      // Find all draft projects grouped by name, keeping track of duplicates
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
      
      // Delete the duplicates
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

  // Routes registered successfully
}

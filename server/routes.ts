import type { Express } from "express";
import type { Server } from "http";
import { db } from "./db/index";
import { pool } from "./db";
import {
  projects,
  clients,
  childLlcs,
  projectDetails,
  financials,
  milestones,
  warrantyTerms,
  contractors,
  contracts,
  erpFieldMappings,
} from "../shared/schema";
import { eq } from "drizzle-orm";
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

// =============================================================================
// HELPER: Fetch project with all relations
// =============================================================================

async function getProjectWithRelations(projectId: number): Promise<ProjectWithRelations | null> {
  const [project] = await db.select().from(projects).where(eq(projects.id, projectId));
  if (!project) return null;

  const [client] = await db.select().from(clients).where(eq(clients.projectId, projectId));
  const [childLlc] = await db.select().from(childLlcs).where(eq(childLlcs.projectId, projectId));
  const [projectDetail] = await db.select().from(projectDetails).where(eq(projectDetails.projectId, projectId));
  const [financial] = await db.select().from(financials).where(eq(financials.projectId, projectId));
  const [warranty] = await db.select().from(warrantyTerms).where(eq(warrantyTerms.projectId, projectId));
  const projectMilestones = await db.select().from(milestones).where(eq(milestones.projectId, projectId));
  const projectContractors = await db.select().from(contractors).where(eq(contractors.projectId, projectId));

  return {
    project,
    client: client || null,
    childLlc: childLlc || null,
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

    // Get current version number for this contract type
    const existingContracts = await db
      .select()
      .from(contracts)
      .where(eq(contracts.projectId, projectId));
    const sameTypeContracts = existingContracts.filter(c => c.contractType === contractType);
    const newVersion = sameTypeContracts.length + 1;

    // Record in database
    const [result] = await db.insert(contracts).values({
      projectId,
      contractType,
      version: newVersion,
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
      const existingProjects = await db
        .select({ id: projects.id })
        .from(projects)
        .where(eq(projects.projectNumber, projectNumber));
      
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

  // Create project
  app.post("/api/projects", async (req, res) => {
    try {
      const [result] = await db.insert(projects).values(req.body).returning();
      res.json(result);
    } catch (error) {
      console.error("Failed to create project:", error);
      res.status(500).json({ error: "Failed to create project" });
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
  // CHILD LLC
  // ---------------------------------------------------------------------------

  app.get("/api/projects/:projectId/child-llc", async (req, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      const [llc] = await db.select().from(childLlcs).where(eq(childLlcs.projectId, projectId));
      res.json(llc || null);
    } catch (error) {
      console.error("Failed to fetch child LLC:", error);
      res.status(500).json({ error: "Failed to fetch child LLC" });
    }
  });

  app.post("/api/projects/:projectId/child-llc", async (req, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      const [result] = await db.insert(childLlcs).values({ ...req.body, projectId }).returning();
      res.json(result);
    } catch (error) {
      console.error("Failed to create child LLC:", error);
      res.status(500).json({ error: "Failed to create child LLC" });
    }
  });

  app.patch("/api/projects/:projectId/child-llc", async (req, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      const [existing] = await db.select().from(childLlcs).where(eq(childLlcs.projectId, projectId));
      if (existing) {
        const [result] = await db
          .update(childLlcs)
          .set(req.body)
          .where(eq(childLlcs.projectId, projectId))
          .returning();
        res.json(result);
      } else {
        const [result] = await db.insert(childLlcs).values({ ...req.body, projectId }).returning();
        res.json(result);
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

  app.post("/api/projects/:projectId/contractors", async (req, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      const [result] = await db.insert(contractors).values({ ...req.body, projectId }).returning();
      res.json(result);
    } catch (error) {
      console.error("Failed to create contractor:", error);
      res.status(500).json({ error: "Failed to create contractor" });
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

  // Get single contract
  app.get("/api/contracts/:id", async (req, res) => {
    try {
      const contractId = parseInt(req.params.id);
      const [contract] = await db.select().from(contracts).where(eq(contracts.id, contractId));
      if (!contract) {
        return res.status(404).json({ error: "Contract not found" });
      }
      res.json(contract);
    } catch (error) {
      console.error("Failed to fetch contract:", error);
      res.status(500).json({ error: "Failed to fetch contract" });
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
  // ERP FIELD MAPPINGS
  // ---------------------------------------------------------------------------

  app.get("/api/erp-mappings", async (req, res) => {
    try {
      const mappings = await db.select().from(erpFieldMappings);
      res.json(mappings);
    } catch (error) {
      console.error("Failed to fetch ERP mappings:", error);
      res.status(500).json({ error: "Failed to fetch ERP mappings" });
    }
  });

  // Get mappings by category
  app.get("/api/erp-mappings/category/:category", async (req, res) => {
    try {
      const category = req.params.category;
      const mappings = await db.select().from(erpFieldMappings);
      const filtered = mappings.filter(m => m.variableCategory === category);
      res.json(filtered);
    } catch (error) {
      console.error("Failed to fetch ERP mappings:", error);
      res.status(500).json({ error: "Failed to fetch ERP mappings" });
    }
  });

  app.post("/api/erp-mappings", async (req, res) => {
    try {
      const [result] = await db.insert(erpFieldMappings).values(req.body).returning();
      res.json(result);
    } catch (error) {
      console.error("Failed to create ERP mapping:", error);
      res.status(500).json({ error: "Failed to create ERP mapping" });
    }
  });

  app.patch("/api/erp-mappings/:id", async (req, res) => {
    try {
      const mappingId = parseInt(req.params.id);
      const [result] = await db
        .update(erpFieldMappings)
        .set(req.body)
        .where(eq(erpFieldMappings.id, mappingId))
        .returning();
      res.json(result);
    } catch (error) {
      console.error("Failed to update ERP mapping:", error);
      res.status(500).json({ error: "Failed to update ERP mapping" });
    }
  });

  app.delete("/api/erp-mappings/:id", async (req, res) => {
    try {
      const mappingId = parseInt(req.params.id);
      await db.delete(erpFieldMappings).where(eq(erpFieldMappings.id, mappingId));
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete ERP mapping:", error);
      res.status(500).json({ error: "Failed to delete ERP mapping" });
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
      
      console.log("Generating contract package for project:", projectData.PROJECT_NAME);
      
      // Add calculated/derived fields
      const enrichedData = {
        ...projectData,
        IS_CRC: projectData.SERVICE_MODEL === "CRC",
        IS_CMOS: projectData.SERVICE_MODEL === "CMOS",
        CONTRACT_DATE: projectData.CONTRACT_DATE || new Date().toISOString().split("T")[0]
      };
      
      // Helper function to generate a single contract
      async function generateSingleContract(contractType: string) {
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
      }
      
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
  // Uses template-based generation with fallback to direct generation if templates fail
  app.post("/api/contracts/download-docx", async (req, res) => {
    try {
      const { contractType, projectData } = req.body;
      
      if (!contractType || !projectData) {
        return res.status(400).json({ error: "contractType and projectData are required" });
      }

      const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: 0
        }).format(value || 0);
      };

      const formatDate = (dateString: string) => {
        if (!dateString) return '[DATE]';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        });
      };

      let documentContent = '';
      let filename = '';

      if (contractType === 'ONE') {
        filename = `${projectData.projectNumber || 'Contract'}_ONE_Agreement.docx`;
        documentContent = `
DVELE ONE AGREEMENT

Project Number: ${projectData.projectNumber || '[PROJECT_NUMBER]'}
Project Name: ${projectData.projectName || '[PROJECT_NAME]'}
Effective Date: ${formatDate(projectData.effectiveDate)}

================================================================================

ARTICLE 1. PARTIES

1.1 Owner/Client
Name: ${projectData.clientLegalName || '[CLIENT_NAME]'}
Entity Type: ${projectData.clientEntityType || '[ENTITY_TYPE]'}
State of Organization: ${projectData.clientState || '[STATE]'}
Authorized Signer: ${projectData.clientSignerName || '[SIGNER_NAME]'}
${projectData.clientSignerTitle ? `Title: ${projectData.clientSignerTitle}` : ''}
Email: ${projectData.clientEmail || '[EMAIL]'}
${projectData.clientPhone ? `Phone: ${projectData.clientPhone}` : ''}

1.2 Dvele Partners LLC (Child Entity)
Name: ${projectData.childLlcName || '[CHILD_LLC_NAME]'}
State of Formation: ${projectData.childLlcState || 'Delaware'}

1.3 Service Model
This Agreement is structured under the ${projectData.serviceModel === 'CRC' ? 'Construction Risk Contractor (CRC)' : 'Construction Management Owner Services (CMOS)'} model.

${projectData.serviceModel === 'CRC' && projectData.contractorName ? `
1.4 General Contractor (CRC Model)
Contractor: ${projectData.contractorName}
License Number: ${projectData.contractorLicense || '[LICENSE]'}
Address: ${projectData.contractorAddress || '[ADDRESS]'}
Insurance Policy: ${projectData.contractorInsurance || '[INSURANCE]'}
` : ''}

================================================================================

ARTICLE 2. PROJECT DESCRIPTION

2.1 Site Location
Address: ${projectData.siteAddress || '[ADDRESS]'}
City: ${projectData.siteCity || '[CITY]'}
State: ${projectData.siteState || '[STATE]'}
ZIP: ${projectData.siteZip || '[ZIP]'}
${projectData.siteCounty ? `County: ${projectData.siteCounty}` : ''}

2.2 Project Scope
Total Units: ${projectData.totalUnits || 1}
Project Type: ${projectData.projectType || 'Single Family'}

${projectData.units && projectData.units.length > 0 ? `
2.3 Unit Specifications
${projectData.units.slice(0, projectData.totalUnits || 1).map((unit: any, index: number) => `
Unit ${index + 1}:
  Model: ${unit.model || '[MODEL]'}
  Square Footage: ${unit.squareFootage?.toLocaleString() || '[SQ FT]'} sq ft
  Bedrooms: ${unit.bedrooms || '[BR]'}
  Bathrooms: ${unit.bathrooms || '[BA]'}
  Unit Price: ${formatCurrency(unit.price)}
`).join('')}` : ''}

================================================================================

ARTICLE 3. CONTRACT PRICE AND PAYMENT

3.1 Design Phase
Design Fee: ${formatCurrency(projectData.designFee)}
Revision Rounds Included: ${projectData.designRevisionRounds || 3}

3.2 Preliminary Contract Price
Manufacturing (Offsite): ${formatCurrency(projectData.preliminaryOffsiteCost)}
Delivery & Installation: ${formatCurrency(projectData.deliveryInstallationPrice)}
Total Preliminary Contract Price: ${formatCurrency(projectData.totalPreliminaryContractPrice)}

3.3 Payment Milestones
The following payment schedule applies, representing 95% of the contract price with ${projectData.retainagePercent || 5}% retainage:

Milestone 1: ${projectData.milestone1Percent || 20}%
Milestone 2: ${projectData.milestone2Percent || 20}%
Milestone 3: ${projectData.milestone3Percent || 20}%
Milestone 4: ${projectData.milestone4Percent || 20}%
Milestone 5: ${projectData.milestone5Percent || 15}%
Retainage: ${projectData.retainagePercent || 5}% (released ${projectData.retainageDays || 60} days after project completion)

================================================================================

ARTICLE 4. PROJECT SCHEDULE

4.1 Key Dates
Effective Date: ${formatDate(projectData.effectiveDate)}
${projectData.targetDeliveryDate ? `Target Delivery: ${formatDate(projectData.targetDeliveryDate)}` : ''}

4.2 Phase Durations
Design Phase: ${projectData.designPhaseDays || 90} days
Manufacturing: ${projectData.manufacturingDurationDays || 120} days
On-Site Installation: ${projectData.onsiteDurationDays || 90} days

Estimated Total Duration: ${(projectData.designPhaseDays || 90) + (projectData.manufacturingDurationDays || 120) + (projectData.onsiteDurationDays || 90)} days

================================================================================

ARTICLE 5. WARRANTIES

5.1 Warranty Terms
Dvele warrants the completed home according to the following schedule:

Fit & Finish Warranty: ${projectData.warrantyFitFinishMonths || 24} months
Coverage: Interior finishes, fixtures, appliances, and cosmetic items

Building Envelope Warranty: ${projectData.warrantyBuildingEnvelopeMonths || 60} months
Coverage: Exterior cladding, windows, doors, roofing, and weatherproofing systems

Structural Warranty: ${projectData.warrantyStructuralMonths || 120} months
Coverage: Foundation, framing, load-bearing elements, and structural systems

================================================================================

ARTICLE 6. DISPUTE RESOLUTION

6.1 Governing Law
This Agreement shall be governed by the laws of the State of ${projectData.projectState || projectData.siteState || '[STATE]'}.

6.2 Venue
County: ${projectData.projectCounty || projectData.siteCounty || '[COUNTY]'}
Federal District: ${projectData.projectFederalDistrict || '[FEDERAL_DISTRICT]'}

6.3 Arbitration
Any disputes arising under this Agreement shall be resolved through binding arbitration administered by ${projectData.arbitrationProvider || 'JAMS'} in accordance with its Commercial Arbitration Rules.

================================================================================

ARTICLE 7. SIGNATURES

IN WITNESS WHEREOF, the parties have executed this Agreement as of the Effective Date.

OWNER/CLIENT:

_________________________________
${projectData.clientSignerName || '[SIGNER_NAME]'}
${projectData.clientSignerTitle ? projectData.clientSignerTitle : 'Authorized Representative'}
${projectData.clientLegalName || '[CLIENT_NAME]'}

Date: _________________________________


DVELE PARTNERS LLC:

_________________________________
Authorized Representative
${projectData.childLlcName || 'Dvele Partners LLC'}

Date: _________________________________


================================================================================
DVELE CONTRACT PLATFORM - Generated ${new Date().toLocaleDateString()}
================================================================================
`;
      } else if (contractType === 'MANUFACTURING') {
        filename = `${projectData.projectNumber || 'Contract'}_Manufacturing_Subcontract.docx`;
        documentContent = `
MANUFACTURING SUBCONTRACTOR AGREEMENT

Project Number: ${projectData.projectNumber || '[PROJECT_NUMBER]'}
Project Name: ${projectData.projectName || '[PROJECT_NAME]'}
Effective Date: ${formatDate(projectData.effectiveDate)}

================================================================================

ARTICLE 1. PARTIES

1.1 Contractor
${projectData.childLlcName || 'Dvele Partners LLC'}

1.2 Manufacturer
${projectData.manufacturerName || 'Dvele, Inc.'}
${projectData.manufacturerAddress ? `Address: ${projectData.manufacturerAddress}` : ''}

================================================================================

ARTICLE 2. SCOPE OF WORK

2.1 Manufacturing Scope
The Manufacturer shall fabricate modular home units according to approved design specifications for delivery to:

Delivery Address:
${projectData.siteAddress || '[ADDRESS]'}
${projectData.siteCity || '[CITY]'}, ${projectData.siteState || '[STATE]'} ${projectData.siteZip || '[ZIP]'}

2.2 Unit Specifications
Total Units: ${projectData.totalUnits || 1}

${projectData.units && projectData.units.length > 0 ? `
${projectData.units.slice(0, projectData.totalUnits || 1).map((unit: any, index: number) => `
Unit ${index + 1}:
  Model: ${unit.model || '[MODEL]'}
  Square Footage: ${unit.squareFootage?.toLocaleString() || '[SQ FT]'} sq ft
  Configuration: ${unit.bedrooms || '[BR]'} BR / ${unit.bathrooms || '[BA]'} BA
`).join('')}` : ''}

================================================================================

ARTICLE 3. MANUFACTURING PAYMENTS

3.1 Payment Schedule
The following payments shall be made to the Manufacturer:

Design Payment: ${formatCurrency(projectData.manufacturingDesignPayment)}
Due upon completion of design phase

Production Start Payment: ${formatCurrency(projectData.manufacturingProductionStart)}
Due upon commencement of manufacturing

Production Complete Payment: ${formatCurrency(projectData.manufacturingProductionComplete)}
Due upon completion of manufacturing and quality inspection

Delivery Ready Payment: ${formatCurrency(projectData.manufacturingDeliveryReady)}
Due upon loading and shipping preparation

Total Manufacturing Payments: ${formatCurrency(
  (projectData.manufacturingDesignPayment || 0) +
  (projectData.manufacturingProductionStart || 0) +
  (projectData.manufacturingProductionComplete || 0) +
  (projectData.manufacturingDeliveryReady || 0)
)}

================================================================================

ARTICLE 4. SCHEDULE

4.1 Manufacturing Timeline
Design Phase Duration: ${projectData.designPhaseDays || 90} days
Manufacturing Duration: ${projectData.manufacturingDurationDays || 120} days

4.2 Delivery
Target Delivery Date: ${projectData.targetDeliveryDate ? formatDate(projectData.targetDeliveryDate) : 'To be determined based on site readiness'}

================================================================================

ARTICLE 5. QUALITY STANDARDS

5.1 Manufacturing Standards
All units shall be manufactured in accordance with:
- California Building Code (CBC) requirements
- HUD manufacturing standards where applicable
- Dvele quality control specifications
- Approved architectural and engineering drawings

5.2 Inspections
Units shall pass all required factory inspections prior to shipping, including:
- Structural inspection
- Electrical inspection
- Plumbing inspection
- Final quality review

================================================================================

ARTICLE 6. SIGNATURES

CONTRACTOR:

_________________________________
Authorized Representative
${projectData.childLlcName || 'Dvele Partners LLC'}

Date: _________________________________


MANUFACTURER:

_________________________________
Authorized Representative
${projectData.manufacturerName || 'Dvele, Inc.'}

Date: _________________________________


================================================================================
DVELE CONTRACT PLATFORM - Generated ${new Date().toLocaleDateString()}
================================================================================
`;
      } else if (contractType === 'ONSITE') {
        filename = `${projectData.projectNumber || 'Contract'}_OnSite_Subcontract.docx`;
        documentContent = `
ON-SITE INSTALLATION SUBCONTRACTOR AGREEMENT

Project Number: ${projectData.projectNumber || '[PROJECT_NUMBER]'}
Project Name: ${projectData.projectName || '[PROJECT_NAME]'}
Effective Date: ${formatDate(projectData.effectiveDate)}

================================================================================

ARTICLE 1. PARTIES

1.1 Contractor
${projectData.childLlcName || 'Dvele Partners LLC'}

${projectData.serviceModel === 'CRC' && projectData.contractorName ? `
1.2 General Contractor
Name: ${projectData.contractorName}
License Number: ${projectData.contractorLicense || '[LICENSE]'}
Address: ${projectData.contractorAddress || '[ADDRESS]'}
Insurance Policy: ${projectData.contractorInsurance || '[INSURANCE]'}
` : `
1.2 Installation Contractor
To be assigned by Dvele Partners LLC
`}

================================================================================

ARTICLE 2. PROJECT SITE

2.1 Site Location
Address: ${projectData.siteAddress || '[ADDRESS]'}
City: ${projectData.siteCity || '[CITY]'}
State: ${projectData.siteState || '[STATE]'}
ZIP: ${projectData.siteZip || '[ZIP]'}
${projectData.siteCounty ? `County: ${projectData.siteCounty}` : ''}
${projectData.siteApn ? `APN: ${projectData.siteApn}` : ''}

================================================================================

ARTICLE 3. SCOPE OF WORK

3.1 Site Preparation
- Foundation construction per approved engineering plans
- Utility connections (water, sewer, electrical, gas as applicable)
- Site grading and drainage
- Access road preparation

3.2 Module Installation
- Crane placement of modular units
- Module interconnection and marriage
- Utility hook-ups between modules
- Exterior finishing and weatherproofing

3.3 Site Completion
- Landscaping per approved plans
- Final utility connections and testing
- Final grading and hardscaping
- Certificate of occupancy preparation

================================================================================

ARTICLE 4. CONTRACT PRICE

4.1 On-Site Work Pricing
Delivery & Installation: ${formatCurrency(projectData.deliveryInstallationPrice)}

${projectData.sitePrepPrice ? `Site Preparation: ${formatCurrency(projectData.sitePrepPrice)}` : ''}
${projectData.utilitiesPrice ? `Utilities: ${formatCurrency(projectData.utilitiesPrice)}` : ''}
${projectData.completionPrice ? `Completion Work: ${formatCurrency(projectData.completionPrice)}` : ''}

================================================================================

ARTICLE 5. SCHEDULE

5.1 On-Site Duration
Estimated On-Site Work Duration: ${projectData.onsiteDurationDays || 90} days

5.2 Milestones
- Site preparation completion
- Foundation ready for module placement
- Module installation complete
- Utility connections complete
- Final inspection and certificate of occupancy

================================================================================

ARTICLE 6. PERMITS AND INSPECTIONS

6.1 Permits
The ${projectData.serviceModel === 'CRC' ? 'General Contractor' : 'Contractor'} shall obtain all required permits including:
- Building permit
- Grading permit (if required)
- Utility connection permits
- Occupancy permit

6.2 Inspections
All work shall pass required inspections by the local authority having jurisdiction.

================================================================================

ARTICLE 7. INSURANCE REQUIREMENTS

7.1 Required Coverage
- General Liability: Minimum $1,000,000 per occurrence
- Workers Compensation: As required by state law
- Auto Liability: Minimum $500,000 combined single limit
${projectData.contractorInsurance ? `
Contractor Insurance Policy: ${projectData.contractorInsurance}
` : ''}

================================================================================

ARTICLE 8. SIGNATURES

CONTRACTOR:

_________________________________
Authorized Representative
${projectData.childLlcName || 'Dvele Partners LLC'}

Date: _________________________________


${projectData.serviceModel === 'CRC' && projectData.contractorName ? `
GENERAL CONTRACTOR:

_________________________________
Authorized Representative
${projectData.contractorName}
License #: ${projectData.contractorLicense || '[LICENSE]'}

Date: _________________________________
` : `
INSTALLATION SUBCONTRACTOR:

_________________________________
Authorized Representative
[Installation Company Name]

Date: _________________________________
`}

================================================================================
DVELE CONTRACT PLATFORM - Generated ${new Date().toLocaleDateString()}
================================================================================
`;
      } else {
        return res.status(400).json({ error: `Unknown contract type: ${contractType}` });
      }

      // Create a simple Word document using PizZip and Docxtemplater
      // For now, we'll create a text-based response that can be properly downloaded
      // In production, you'd use a proper template .docx file
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      
      // Create minimal valid docx structure
      const JSZip = PizZip;
      const zip = new JSZip();
      
      // Add required Word document structure
      zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`);
      
      zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`);
      
      // Convert content to Word XML paragraphs
      const lines = documentContent.split('\n');
      let wordContent = '';
      for (const line of lines) {
        const escapedLine = line
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;');
        
        // Check if it's a header line (all caps or contains ===)
        const isHeader = line === line.toUpperCase() && line.trim().length > 0 && !line.includes('===');
        const isDivider = line.includes('===');
        
        if (isDivider) {
          wordContent += `<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="auto"/></w:pBdr></w:pPr></w:p>`;
        } else if (isHeader && line.trim()) {
          wordContent += `<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="28"/></w:rPr><w:t>${escapedLine}</w:t></w:r></w:p>`;
        } else {
          wordContent += `<w:p><w:r><w:t>${escapedLine}</w:t></w:r></w:p>`;
        }
      }
      
      zip.file('word/document.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${wordContent}
  </w:body>
</w:document>`);
      
      const docxBuffer = zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
      res.send(docxBuffer);
      
    } catch (error) {
      console.error("Error generating docx:", error);
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
      const result = await pool.query(`
        SELECT * FROM llcs ORDER BY created_at DESC
      `);
      res.json(result.rows);
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
      const result = await pool.query(`
        SELECT DISTINCT contract_type, COUNT(*) as count
        FROM clauses
        GROUP BY contract_type
        ORDER BY contract_type
      `);
      res.json(result.rows);
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

  // Routes registered successfully
}

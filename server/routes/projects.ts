import { Router } from "express";
import { db } from "../db/index";
import { pool } from "../db";
import {
  projects,
  clients,
  projectDetails,
  contractors,
  contractorEntities,
  homeModels,
  projectUnits,
  milestones,
  warrantyTerms,
} from "../../shared/schema";
import { eq, and, sql, desc } from "drizzle-orm";

const router = Router();

// ---------------------------------------------------------------------------
// PROJECT NUMBER UNIQUENESS CHECK
// ---------------------------------------------------------------------------

router.get('/projects/check-number/:projectNumber', async (req, res) => {
  try {
    const { projectNumber } = req.params;
    const excludeId = req.query.excludeId ? parseInt(req.query.excludeId as string) : null;
    
    if (!projectNumber) {
      return res.json({ isUnique: true });
    }
    
    // Check if project number exists
    let query = db.select({ id: projects.id })
      .from(projects)
      .where(eq(projects.projectNumber, projectNumber));
    
    const existingProjects = await query;
    
    // If excluding a specific ID (for edit mode), check if the only match is the excluded one
    if (excludeId && existingProjects.length === 1 && existingProjects[0].id === excludeId) {
      return res.json({ isUnique: true });
    }
    
    res.json({ isUnique: existingProjects.length === 0 });
  } catch (error) {
    console.error("Failed to check project number:", error);
    res.json({ isUnique: true }); // Default to true to not block on errors
  }
});

// ---------------------------------------------------------------------------
// DEBUG - Variable Audit (temporary)
// ---------------------------------------------------------------------------

router.get('/debug/audit-variables', async (req, res) => {
  try {
    console.log('Starting variable audit...');
    
    const clauseResult = await pool.query('SELECT * FROM clauses');
    const clauseList = clauseResult.rows || [];
    
    console.log(`Fetched ${clauseList.length} clauses`);
    
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
        ONE: { total: oneVars.length, variables: oneVars.sort() },
        MANUFACTURING: { total: mfgVars.length, variables: mfgVars.sort() },
        ONSITE: { total: onsiteVars.length, variables: onsiteVars.sort() }
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

router.get('/debug/seed-models', async (req, res) => {
  try {
    const existingModels = await db.select().from(homeModels);
    
    if (existingModels.length > 0) {
      return res.json({
        message: 'Home models already seeded',
        count: existingModels.length,
        models: existingModels
      });
    }
    
    const seedData = [
      {
        name: 'Trinity',
        modelCode: 'TRINITY-3000',
        bedrooms: 4,
        bathrooms: 3.5,
        sqFt: 3000,
        designFee: 5000000,
        offsiteBasePrice: 85000000,
        onsiteEstPrice: 45000000,
        isActive: true
      },
      {
        name: 'Salt Point',
        modelCode: 'SALTPOINT-1800',
        bedrooms: 3,
        bathrooms: 2.0,
        sqFt: 1800,
        designFee: 3500000,
        offsiteBasePrice: 55000000,
        onsiteEstPrice: 30000000,
        isActive: true
      },
      {
        name: 'Mini-Mod',
        modelCode: 'MINIMOD-600',
        bedrooms: 1,
        bathrooms: 1.0,
        sqFt: 600,
        designFee: 1000000,
        offsiteBasePrice: 18000000,
        onsiteEstPrice: 10000000,
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

router.get('/home-models', async (req, res) => {
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

router.get('/projects/:projectId/units', async (req, res) => {
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

router.post('/projects/:projectId/units', async (req, res) => {
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

router.delete('/project-units/:id', async (req, res) => {
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
// PROJECTS
// ---------------------------------------------------------------------------

router.get("/projects/next-number", async (req, res) => {
  try {
    const currentYear = new Date().getFullYear();
    const yearPrefix = `${currentYear}-`;
    
    const allProjects = await db
      .select({ projectNumber: projects.projectNumber })
      .from(projects);
    
    const thisYearProjects = allProjects.filter(p => 
      p.projectNumber && p.projectNumber.startsWith(yearPrefix)
    );
    
    let maxNumber = 0;
    for (const p of thisYearProjects) {
      const numPart = p.projectNumber.split('-')[1];
      const num = parseInt(numPart, 10);
      if (!isNaN(num) && num > maxNumber) {
        maxNumber = num;
      }
    }
    
    const nextNumber = String(maxNumber + 1).padStart(3, '0');
    const nextProjectNumber = `${yearPrefix}${nextNumber}`;
    
    res.json({ nextProjectNumber });
  } catch (error) {
    console.error("Failed to get next project number:", error);
    res.status(500).json({ error: "Failed to get next project number" });
  }
});

router.get("/projects", async (req, res) => {
  try {
    const allProjects = await db.select().from(projects).orderBy(desc(projects.createdAt));
    res.json(allProjects);
  } catch (error) {
    console.error("Failed to fetch projects:", error);
    res.status(500).json({ error: "Failed to fetch projects" });
  }
});

router.get("/projects/:id", async (req, res) => {
  try {
    const projectId = parseInt(req.params.id);
    const [project] = await db.select().from(projects).where(eq(projects.id, projectId));
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }
    res.json(project);
  } catch (error) {
    console.error("Failed to fetch project:", error);
    res.status(500).json({ error: "Failed to fetch project" });
  }
});

router.post("/projects", async (req, res) => {
  try {
    const [result] = await db.insert(projects).values(req.body).returning();
    res.json(result);
  } catch (error) {
    console.error("Failed to create project:", error);
    res.status(500).json({ error: "Failed to create project" });
  }
});

router.patch("/projects/:id", async (req, res) => {
  try {
    const projectId = parseInt(req.params.id);
    const [result] = await db
      .update(projects)
      .set(req.body)
      .where(eq(projects.id, projectId))
      .returning();
    res.json(result);
  } catch (error) {
    console.error("Failed to update project:", error);
    res.status(500).json({ error: "Failed to update project" });
  }
});

router.delete("/projects/:id", async (req, res) => {
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

router.get("/projects/:projectId/client", async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId);
    const [client] = await db.select().from(clients).where(eq(clients.projectId, projectId));
    res.json(client || null);
  } catch (error) {
    console.error("Failed to fetch client:", error);
    res.status(500).json({ error: "Failed to fetch client" });
  }
});

router.post("/projects/:projectId/client", async (req, res) => {
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
    console.error("Failed to create/update client:", error);
    res.status(500).json({ error: "Failed to create/update client" });
  }
});

router.patch("/projects/:projectId/client", async (req, res) => {
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
// PROJECT DETAILS
// ---------------------------------------------------------------------------

router.get("/projects/:projectId/details", async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId);
    const [details] = await db.select().from(projectDetails).where(eq(projectDetails.projectId, projectId));
    res.json(details || null);
  } catch (error) {
    console.error("Failed to fetch project details:", error);
    res.status(500).json({ error: "Failed to fetch project details" });
  }
});

router.post("/projects/:projectId/details", async (req, res) => {
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

// PATCH endpoint for project details (same as POST - upsert behavior)
router.patch("/projects/:projectId/details", async (req, res) => {
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
// MILESTONES
// ---------------------------------------------------------------------------

router.get("/projects/:projectId/milestones", async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId);
    const projectMilestones = await db.select().from(milestones).where(eq(milestones.projectId, projectId));
    res.json(projectMilestones);
  } catch (error) {
    console.error("Failed to fetch milestones:", error);
    res.status(500).json({ error: "Failed to fetch milestones" });
  }
});

router.get("/projects/:projectId/milestones/:type", async (req, res) => {
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

router.post("/projects/:projectId/milestones", async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId);
    const [result] = await db.insert(milestones).values({ ...req.body, projectId }).returning();
    res.json(result);
  } catch (error) {
    console.error("Failed to create milestone:", error);
    res.status(500).json({ error: "Failed to create milestone" });
  }
});

router.patch("/milestones/:id", async (req, res) => {
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

router.post("/milestones/:id/pay", async (req, res) => {
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

router.delete("/milestones/:id", async (req, res) => {
  try {
    const milestoneId = parseInt(req.params.id);
    await db.delete(milestones).where(eq(milestones.id, milestoneId));
    res.json({ success: true });
  } catch (error) {
    console.error("Failed to delete milestone:", error);
    res.status(500).json({ error: "Failed to delete milestone" });
  }
});

router.post("/projects/:projectId/milestones/create-defaults", async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId);
    const { milestoneType } = req.body;
    
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
// WARRANTY TERMS
// ---------------------------------------------------------------------------

router.get("/projects/:projectId/warranty-terms", async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId);
    const [warranty] = await db.select().from(warrantyTerms).where(eq(warrantyTerms.projectId, projectId));
    res.json(warranty || null);
  } catch (error) {
    console.error("Failed to fetch warranty terms:", error);
    res.status(500).json({ error: "Failed to fetch warranty terms" });
  }
});

router.patch("/projects/:projectId/warranty-terms", async (req, res) => {
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
// CONTRACTORS
// ---------------------------------------------------------------------------

router.get("/projects/:projectId/contractors", async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId);
    const projectContractors = await db.select().from(contractors).where(eq(contractors.projectId, projectId));
    res.json(projectContractors);
  } catch (error) {
    console.error("Failed to fetch contractors:", error);
    res.status(500).json({ error: "Failed to fetch contractors" });
  }
});

router.get("/projects/:projectId/contractors/:type", async (req, res) => {
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

router.post("/projects/:projectId/contractors", async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId);
    const { contractorType, ...otherData } = req.body;
    
    const existing = await db
      .select()
      .from(contractors)
      .where(and(
        eq(contractors.projectId, projectId),
        eq(contractors.contractorType, contractorType)
      ));
    
    if (existing.length > 0) {
      const [result] = await db
        .update(contractors)
        .set(otherData)
        .where(eq(contractors.id, existing[0].id))
        .returning();
      res.json(result);
    } else {
      const [result] = await db.insert(contractors).values({ ...req.body, projectId }).returning();
      res.json(result);
    }
  } catch (error) {
    console.error("Failed to create/update contractor:", error);
    res.status(500).json({ error: "Failed to create/update contractor" });
  }
});

router.patch("/contractors/:id", async (req, res) => {
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

router.delete("/contractors/:id", async (req, res) => {
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

router.get("/contractor-entities", async (req, res) => {
  try {
    const { type } = req.query;
    let query = db.select().from(contractorEntities).where(eq(contractorEntities.isActive, true));
    
    const allEntities = await query;
    
    const filtered = type 
      ? allEntities.filter(e => e.contractorType === type)
      : allEntities;
    
    res.json(filtered);
  } catch (error) {
    console.error("Failed to fetch contractor entities:", error);
    res.status(500).json({ error: "Failed to fetch contractor entities" });
  }
});

router.get("/contractor-entities/type/:type", async (req, res) => {
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

router.post("/contractor-entities", async (req, res) => {
  try {
    const [result] = await db.insert(contractorEntities).values(req.body).returning();
    res.json(result);
  } catch (error) {
    console.error("Failed to create contractor entity:", error);
    res.status(500).json({ error: "Failed to create contractor entity" });
  }
});

router.patch("/contractor-entities/:id", async (req, res) => {
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

export default router;

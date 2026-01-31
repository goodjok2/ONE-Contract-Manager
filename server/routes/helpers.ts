import { db } from "../db/index";
import {
  projects,
  clients,
  projectDetails,
  financials,
  milestones,
  warrantyTerms,
  contractors,
  llcs,
  projectUnits,
  homeModels,
} from "../../shared/schema";
import { eq } from "drizzle-orm";
import type { ProjectWithRelations } from "../lib/mapper";

export async function getProjectWithRelations(projectId: number): Promise<ProjectWithRelations | null> {
  const [project] = await db.select().from(projects).where(eq(projects.id, projectId));
  if (!project) return null;

  const [client] = await db.select().from(clients).where(eq(clients.projectId, projectId));
  
  // Try multiple ways to find the LLC:
  // 1. Via llcs.projectId (LLC was created for this project)
  // 2. Via projects.llcId (project references an existing LLC)
  let [llcRecord] = await db.select().from(llcs).where(eq(llcs.projectId, projectId));
  if (!llcRecord && project.llcId) {
    [llcRecord] = await db.select().from(llcs).where(eq(llcs.id, project.llcId));
  }
  const [projectDetail] = await db.select().from(projectDetails).where(eq(projectDetails.projectId, projectId));
  const [financial] = await db.select().from(financials).where(eq(financials.projectId, projectId));
  const [warranty] = await db.select().from(warrantyTerms).where(eq(warrantyTerms.projectId, projectId));
  const projectMilestones = await db.select().from(milestones).where(eq(milestones.projectId, projectId));
  const projectContractors = await db.select().from(contractors).where(eq(contractors.projectId, projectId));
  
  // Fetch units with their home model details
  // Transform from DB schema (modelId, name, sqFt) to mapper types (homeModelId, modelName, squareFootage)
  const unitsRaw = await db.select().from(projectUnits).where(eq(projectUnits.projectId, projectId));
  
  const units = await Promise.all(
    unitsRaw.map(async (unit) => {
      const [model] = unit.modelId 
        ? await db.select().from(homeModels).where(eq(homeModels.id, unit.modelId))
        : [null];
      // For onsiteEstimateSnapshot: use model's onsiteEstPrice as a fallback since 
      // project_units doesn't store a separate onsite snapshot
      return {
        id: unit.id,
        projectId: unit.projectId,
        homeModelId: unit.modelId,
        unitLabel: unit.unitLabel,
        basePriceSnapshot: unit.basePriceSnapshot,
        // Onsite estimate: use home model's current onsite price (no unit-level snapshot exists)
        onsiteEstimateSnapshot: model?.onsiteEstPrice || 0,
        // Include customization for total pricing
        customizationTotal: unit.customizationTotal || 0,
        homeModel: model ? {
          id: model.id,
          modelName: model.name,
          squareFootage: model.sqFt,
          bedrooms: model.bedrooms,
          bathrooms: model.bathrooms,
        } : undefined,
      };
    })
  );

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
    project: project as any, // Date fields handled by mapper formatDate functions
    client: client || null,
    childLlc: childLlc,
    projectDetails: projectDetail || null,
    financials: financial as any || null, // Date fields handled by mapper formatDate functions
    warrantyTerms: warranty || null,
    milestones: projectMilestones,
    contractors: projectContractors,
    units: units,
  };
}

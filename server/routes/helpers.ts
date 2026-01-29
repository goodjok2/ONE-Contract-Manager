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
} from "../../shared/schema";
import { eq } from "drizzle-orm";
import type { ProjectWithRelations } from "../lib/mapper";

export async function getProjectWithRelations(projectId: number): Promise<ProjectWithRelations | null> {
  const [project] = await db.select().from(projects).where(eq(projects.id, projectId));
  if (!project) return null;

  const [client] = await db.select().from(clients).where(eq(clients.projectId, projectId));
  const [llcRecord] = await db.select().from(llcs).where(eq(llcs.projectId, projectId));
  const [projectDetail] = await db.select().from(projectDetails).where(eq(projectDetails.projectId, projectId));
  const [financial] = await db.select().from(financials).where(eq(financials.projectId, projectId));
  const [warranty] = await db.select().from(warrantyTerms).where(eq(warrantyTerms.projectId, projectId));
  const projectMilestones = await db.select().from(milestones).where(eq(milestones.projectId, projectId));
  const projectContractors = await db.select().from(contractors).where(eq(contractors.projectId, projectId));

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

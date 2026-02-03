import { db } from "../db/index";
import { pool } from "../db";
import {
  projects,
  clients,
  projectDetails,
  financials,
  milestones,
  warrantyTerms,
  contractors,
} from "../../shared/schema";
import { eq } from "drizzle-orm";
import type { ProjectWithRelations } from "../lib/mapper";

export async function getProjectWithRelations(projectId: number): Promise<ProjectWithRelations | null> {
  const [project] = await db.select().from(projects).where(eq(projects.id, projectId));
  if (!project) return null;

  const [client] = await db.select().from(clients).where(eq(clients.projectId, projectId));
  const [projectDetail] = await db.select().from(projectDetails).where(eq(projectDetails.projectId, projectId));
  const [financial] = await db.select().from(financials).where(eq(financials.projectId, projectId));
  const [warranty] = await db.select().from(warrantyTerms).where(eq(warrantyTerms.projectId, projectId));
  const projectMilestones = await db.select().from(milestones).where(eq(milestones.projectId, projectId));
  const projectContractors = await db.select().from(contractors).where(eq(contractors.projectId, projectId));

  // Fetch LLC data if project has llc_id
  let childLlc = null;
  if (project.llcId) {
    const llcResult = await pool.query(
      `SELECT id, name, project_name, state_of_formation, entity_type, ein, address, city, 
              state_address, zip, registered_agent, registered_agent_address, formation_date,
              annual_report_due_date, annual_report_status, is_active
       FROM llcs WHERE id = $1`,
      [project.llcId]
    );
    if (llcResult.rows.length > 0) {
      const llc = llcResult.rows[0];
      childLlc = {
        id: llc.id,
        projectId: null,
        legalName: llc.name,
        formationState: llc.state_of_formation || 'Delaware',
        entityType: llc.entity_type || 'LLC',
        ein: llc.ein || '',
        address: llc.address || '',
        city: llc.city || '',
        state: llc.state_address || '',
        zip: llc.zip || '',
        registeredAgent: llc.registered_agent || '',
        registeredAgentAddress: llc.registered_agent_address || '',
        formationDate: llc.formation_date || '',
        annualReportDue: llc.annual_report_due_date || '',
        status: llc.is_active ? 'active' : 'inactive',
        insuranceStatus: null,
        insuranceExpiration: null,
      };
    }
  }

  return {
    project: project as any,
    client: client || null,
    childLlc,
    projectDetails: projectDetail || null,
    financials: financial as any || null,
    warrantyTerms: warranty || null,
    milestones: projectMilestones,
    contractors: projectContractors,
    units: [], // Units table removed in schema refactor
  };
}

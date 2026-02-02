import { db } from "../db/index";
import { projects, projectDetails, financials, milestones } from "../../shared/schema";
import { eq } from "drizzle-orm";

export interface PaymentScheduleItem {
  name: string;
  percentage: number;
  amount: number;
  phase: string;
}

export interface PricingBreakdown {
  totalDesignFee: number;
  totalOffsite: number;
  totalOnsite: number;
  totalCustomizations: number;
}

export interface PricingSummary {
  breakdown: PricingBreakdown;
  grandTotal: number;
  projectBudget: number;      // Full cost: design + offsite + onsite (always)
  contractValue: number;      // What Dvele charges: CRC excludes onsite, CMOS includes all
  serviceModel: 'CRC' | 'CMOS';
  paymentSchedule: PaymentScheduleItem[];
  unitCount: number;
  unitModelSummary: string;   // e.g., "1x Trinity, 2x Salt Point"
}

export async function calculateProjectPricing(projectId: number): Promise<PricingSummary> {
  const [project] = await db.select().from(projects).where(eq(projects.id, projectId));
  
  if (!project) {
    throw new Error(`Project with id ${projectId} not found`);
  }

  const [financial] = await db
    .select()
    .from(financials)
    .where(eq(financials.projectId, projectId));

  const [details] = await db
    .select()
    .from(projectDetails)
    .where(eq(projectDetails.projectId, projectId));

  const projectMilestones = await db
    .select()
    .from(milestones)
    .where(eq(milestones.projectId, projectId));

  // Determine service model (CRC or CMOS)
  const serviceModel: 'CRC' | 'CMOS' = (project.onSiteSelection === 'CMOS') ? 'CMOS' : 'CRC';

  // Get pricing from financials table
  const totalDesignFee = financial?.designFee || 0;
  const totalOffsite = financial?.prelimOffsite || financial?.finalOffsite || 0;
  const totalOnsite = financial?.prelimOnsite || financial?.refinedOnsite || 0;
  const totalCustomizations = financial?.homeCustomizations || 0;

  // Get unit info from project details
  const unitCount = details?.totalUnits || 1;
  const homeModel = details?.homeModel || 'Custom Home';
  const unitModelSummary = `${unitCount}x ${homeModel}`;

  // projectBudget = full cost of the project (design + offsite + onsite)
  const projectBudget = totalDesignFee + totalOffsite + totalOnsite;
  
  // contractValue = what Dvele charges the client
  // CRC: excludes onsite (client handles their own GC)
  // CMOS: includes everything (Dvele manages onsite)
  const contractValue = serviceModel === 'CRC' 
    ? totalDesignFee + totalOffsite
    : totalDesignFee + totalOffsite + totalOnsite;
  
  // grandTotal kept for backwards compatibility
  const grandTotal = projectBudget;
  
  console.log(`[PricingEngine] Project ${projectId} (${serviceModel}): designFee=${totalDesignFee}, offsite=${totalOffsite}, onsite=${totalOnsite}, projectBudget=${projectBudget}, contractValue=${contractValue}`);

  const paymentSchedule: PaymentScheduleItem[] = [];

  // Payment schedule is calculated based on contractValue (what Dvele actually charges)
  if (projectMilestones.length > 0) {
    for (const milestone of projectMilestones) {
      const percentage = milestone.percentage || 0;
      const phase = milestone.milestoneType || 'Unknown';

      paymentSchedule.push({
        name: milestone.name || `Milestone ${milestone.id}`,
        percentage,
        amount: Math.round((contractValue * percentage) / 100),
        phase,
      });
    }
  } else {
    // Default 6-milestone schedule based on contractValue
    const defaultMilestones = [
      { name: 'Signing Deposit', percentage: 20, phase: 'Design' },
      { name: 'Green Light', percentage: 20, phase: 'Production' },
      { name: 'Production Start', percentage: 20, phase: 'Production' },
      { name: 'Production Midpoint', percentage: 20, phase: 'Production' },
      { name: 'Delivery', percentage: 15, phase: 'Delivery' },
      { name: 'Retainage', percentage: 5, phase: 'Completion' },
    ];

    for (const m of defaultMilestones) {
      paymentSchedule.push({
        name: m.name,
        percentage: m.percentage,
        amount: Math.round((contractValue * m.percentage) / 100),
        phase: m.phase,
      });
    }
  }

  // Reconcile payment schedule to ensure sum equals contractValue exactly
  const rawSum = paymentSchedule.reduce((sum, m) => sum + m.amount, 0);
  const discrepancy = contractValue - rawSum;
  
  // Apply any rounding discrepancy to the last milestone (usually retainage)
  if (discrepancy !== 0 && paymentSchedule.length > 0) {
    paymentSchedule[paymentSchedule.length - 1].amount += discrepancy;
  }
  
  const finalSum = paymentSchedule.reduce((sum, m) => sum + m.amount, 0);
  console.log(`[PricingEngine] Payment schedule sum: ${finalSum} (contractValue: ${contractValue}, adjusted: ${discrepancy !== 0})`);

  return {
    breakdown: {
      totalDesignFee,
      totalOffsite,
      totalOnsite,
      totalCustomizations,
    },
    grandTotal,
    projectBudget,
    contractValue,
    serviceModel,
    paymentSchedule,
    unitCount,
    unitModelSummary,
  };
}

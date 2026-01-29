import { db } from "../db/index";
import { projects, projectUnits, homeModels, financials, milestones } from "../../shared/schema";
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
  paymentSchedule: PaymentScheduleItem[];
  unitCount: number;
}

export async function calculateProjectPricing(projectId: number): Promise<PricingSummary> {
  const [project] = await db.select().from(projects).where(eq(projects.id, projectId));
  
  if (!project) {
    throw new Error(`Project with id ${projectId} not found`);
  }

  const units = await db
    .select({
      unitId: projectUnits.id,
      unitLabel: projectUnits.unitLabel,
      basePriceSnapshot: projectUnits.basePriceSnapshot,
      customizationTotal: projectUnits.customizationTotal,
      modelId: projectUnits.modelId,
      modelName: homeModels.name,
      modelCode: homeModels.modelCode,
      designFee: homeModels.designFee,
      offsiteBasePrice: homeModels.offsiteBasePrice,
      onsiteEstPrice: homeModels.onsiteEstPrice,
    })
    .from(projectUnits)
    .innerJoin(homeModels, eq(projectUnits.modelId, homeModels.id))
    .where(eq(projectUnits.projectId, projectId));

  const [financial] = await db
    .select()
    .from(financials)
    .where(eq(financials.projectId, projectId));

  const projectMilestones = await db
    .select()
    .from(milestones)
    .where(eq(milestones.projectId, projectId));

  if (units.length === 0) {
    return {
      breakdown: {
        totalDesignFee: 0,
        totalOffsite: 0,
        totalOnsite: 0,
        totalCustomizations: 0,
      },
      grandTotal: 0,
      paymentSchedule: [],
      unitCount: 0,
    };
  }

  let totalDesignFee = 0;
  let totalOffsite = 0;
  let totalOnsite = 0;
  let totalCustomizations = 0;

  for (const unit of units) {
    totalDesignFee += unit.designFee || 0;
    totalOffsite += (unit.offsiteBasePrice || 0) + (unit.customizationTotal || 0);
    totalOnsite += unit.onsiteEstPrice || 0;
    totalCustomizations += unit.customizationTotal || 0;
  }

  const globalSiteCosts = (financial?.prelimOnsite || 0);
  totalOnsite += globalSiteCosts;

  const grandTotal = totalDesignFee + totalOffsite + totalOnsite;
  
  console.log(`[PricingEngine] Project ${projectId}: designFee=${totalDesignFee}, offsite=${totalOffsite}, onsite=${totalOnsite}, grandTotal=${grandTotal}`);

  const paymentSchedule: PaymentScheduleItem[] = [];

  if (projectMilestones.length > 0) {
    for (const milestone of projectMilestones) {
      const percentage = milestone.percentage || 0;
      const phase = milestone.milestoneType || 'Unknown';
      
      let baseAmount = grandTotal;
      if (phase.toLowerCase().includes('manufacturing') || phase.toLowerCase().includes('production')) {
        baseAmount = totalOffsite;
      }

      paymentSchedule.push({
        name: milestone.name || `Milestone ${milestone.id}`,
        percentage,
        amount: Math.round((baseAmount * percentage) / 100),
        phase,
      });
    }
  } else {
    const defaultMilestones = [
      { name: 'Signing Deposit', percentage: 20, phase: 'Design' },
      { name: 'Green Light', percentage: 20, phase: 'Production' },
      { name: 'Production Start', percentage: 20, phase: 'Production' },
      { name: 'Production Midpoint', percentage: 20, phase: 'Production' },
      { name: 'Delivery', percentage: 15, phase: 'Delivery' },
      { name: 'Retainage', percentage: 5, phase: 'Completion' },
    ];

    for (const m of defaultMilestones) {
      let baseAmount = grandTotal;
      if (m.phase === 'Production') {
        baseAmount = totalOffsite;
      }

      paymentSchedule.push({
        name: m.name,
        percentage: m.percentage,
        amount: Math.round((baseAmount * m.percentage) / 100),
        phase: m.phase,
      });
    }
  }

  return {
    breakdown: {
      totalDesignFee,
      totalOffsite,
      totalOnsite,
      totalCustomizations,
    },
    grandTotal,
    paymentSchedule,
    unitCount: units.length,
  };
}

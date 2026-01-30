import type {
  Project,
  Client,
  ProjectDetails,
  Financial,
  Milestone,
  WarrantyTerm,
  Contractor,
} from "../db/schema";
import { generatePricingTableHtml, generatePaymentScheduleHtml, generateUnitDetailsHtml, UnitDetail } from "./tableGenerators";

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

// ChildLlc type - compatible with both old SQLite and new PostgreSQL llcs table
export interface ChildLlc {
  id: number;
  projectId: number | null;
  legalName: string;
  formationState: string | null;
  entityType: string | null;
  ein: string | null;
  formationDate: string | null;
  registeredAgent: string | null;
  registeredAgentAddress: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  status: string | null;
  // Additional fields from PostgreSQL llcs table
  insuranceStatus?: string | null;
  insuranceExpiration?: string | null;
  annualReportDue?: string | null;
}

export interface ProjectUnit {
  id: number;
  projectId: number;
  homeModelId: number;
  unitLabel: string;
  basePriceSnapshot: number;
  onsiteEstimateSnapshot: number;
  homeModel?: {
    id: number;
    modelName: string;
    squareFootage?: number;
    bedrooms?: number;
    bathrooms?: number;
  };
}

export interface ProjectWithRelations {
  project: Project;
  client: Client | null;
  childLlc: ChildLlc | null;
  projectDetails: ProjectDetails | null;
  financials: Financial | null;
  milestones: Milestone[];
  warrantyTerms: WarrantyTerm | null; // Single row per project now
  contractors: Contractor[];
  units?: ProjectUnit[]; // Added for unit model list
}

export interface ContractVariables {
  [key: string]: string | number | boolean | null;
}

// =============================================================================
// VARIABLE CATEGORIES (for documentation and UI organization)
// =============================================================================

export const VARIABLE_CATEGORIES = {
  project: [
    "PROJECT_NUMBER",
    "PROJECT_NAME",
    "PROJECT_STATUS",
    "PROJECT_STATE",
    "ON_SITE_SELECTION", // CRC or CMOS - critical for conditional sections
  ],
  client: [
    "CLIENT_LEGAL_NAME",
    "CLIENT_ENTITY_TYPE",
    "CLIENT_FORMATION_STATE",
    "CLIENT_ADDRESS",
    "CLIENT_CITY",
    "CLIENT_STATE",
    "CLIENT_ZIP",
    "CLIENT_FULL_ADDRESS",
    "CLIENT_EMAIL",
    "CLIENT_PHONE",
    "CLIENT_TRUST_DATE",
    "CLIENT_TRUSTEE_NAME",
    "CLIENT2_LEGAL_NAME",
    "CLIENT2_ENTITY_TYPE",
    "OWNERSHIP_SPLIT",
  ],
  childLlc: [
    "CHILD_LLC_LEGAL_NAME",
    "CHILD_LLC_FORMATION_STATE",
    "CHILD_LLC_ENTITY_TYPE",
    "CHILD_LLC_EIN",
    "CHILD_LLC_FORMATION_DATE",
    "CHILD_LLC_REGISTERED_AGENT",
    "CHILD_LLC_REGISTERED_AGENT_ADDRESS",
    "CHILD_LLC_ADDRESS",
    "CHILD_LLC_FULL_ADDRESS",
    "CHILD_LLC_INSURANCE_STATUS",
  ],
  site: [
    "DELIVERY_ADDRESS",
    "DELIVERY_CITY",
    "DELIVERY_STATE",
    "DELIVERY_ZIP",
    "DELIVERY_FULL_ADDRESS",
    "DELIVERY_COUNTY",
    "DELIVERY_APN",
    "SITE_ACREAGE",
    "SITE_ZONING",
  ],
  home: [
    "HOME_MODEL",
    "HOME_SQ_FT",
    "HOME_BEDROOMS",
    "HOME_BATHROOMS",
    "HOME_STORIES",
    "HOME_GARAGE",
    "TOTAL_UNITS",
    "MODULE_COUNT",
  ],
  specifications: [
    "BUILDING_CODE_REFERENCE",
    "CLIMATE_ZONE",
    "WIND_SPEED",
    "SNOW_LOAD",
    "SEISMIC_ZONE",
  ],
  dates: [
    "AGREEMENT_EXECUTION_DATE",
    "AGREEMENT_EXECUTION_DATE_WRITTEN",
    "DESIGN_START_DATE",
    "DESIGN_COMPLETE_DATE",
    "GREEN_LIGHT_DATE",
    "PRODUCTION_START_DATE",
    "ESTIMATED_DELIVERY_DATE",
    "ACTUAL_DELIVERY_DATE",
  ],
  pricing: [
    "DESIGN_FEE",
    "DESIGN_FEE_WRITTEN",
    "DESIGN_REVISION_ROUNDS",
    "DESIGN_REVISION_COST_OVERAGE",
    "PRELIM_OFFSITE",
    "PRELIM_OFFSITE_WRITTEN",
    "PRELIM_ONSITE",
    "PRELIM_ONSITE_WRITTEN",
    "PRELIM_CONTRACT_PRICE",
    "PRELIM_CONTRACT_PRICE_WRITTEN",
    "HOME_BASE_PRICE",
    "HOME_BASE_PRICE_WRITTEN",
    "HOME_CUSTOMIZATIONS",
    "HOME_CUSTOMIZATIONS_WRITTEN",
    "FINAL_OFFSITE",
    "FINAL_OFFSITE_WRITTEN",
    "REFINED_ONSITE",
    "REFINED_ONSITE_WRITTEN",
    "FINAL_CONTRACT_PRICE",
    "FINAL_CONTRACT_PRICE_WRITTEN",
    "INFLATION_TRIGGER_DATE",
    "INFLATION_ADJUSTMENT_PERCENT",
    "MATERIAL_INCREASE_THRESHOLD",
  ],
  milestones: [
    // Client milestones
    "CLIENT_MILESTONE_1_NAME",
    "CLIENT_MILESTONE_1_PERCENT",
    "CLIENT_MILESTONE_1_AMOUNT",
    "CLIENT_MILESTONE_1_DUE_UPON",
    "CLIENT_MILESTONE_2_NAME",
    "CLIENT_MILESTONE_2_PERCENT",
    "CLIENT_MILESTONE_2_AMOUNT",
    "CLIENT_MILESTONE_2_DUE_UPON",
    "CLIENT_MILESTONE_3_NAME",
    "CLIENT_MILESTONE_3_PERCENT",
    "CLIENT_MILESTONE_3_AMOUNT",
    "CLIENT_MILESTONE_3_DUE_UPON",
    "CLIENT_MILESTONE_4_NAME",
    "CLIENT_MILESTONE_4_PERCENT",
    "CLIENT_MILESTONE_4_AMOUNT",
    "CLIENT_MILESTONE_4_DUE_UPON",
    "CLIENT_MILESTONE_5_NAME",
    "CLIENT_MILESTONE_5_PERCENT",
    "CLIENT_MILESTONE_5_AMOUNT",
    "CLIENT_MILESTONE_5_DUE_UPON",
    "CLIENT_MILESTONE_6_NAME",
    "CLIENT_MILESTONE_6_PERCENT",
    "CLIENT_MILESTONE_6_AMOUNT",
    "CLIENT_MILESTONE_6_DUE_UPON",
    // Manufacturing milestones
    "MFG_MILESTONE_1_NAME",
    "MFG_MILESTONE_1_PERCENT",
    "MFG_MILESTONE_1_AMOUNT",
    "MFG_MILESTONE_1_DUE_UPON",
    // ... similar pattern for manufacturing and onsite
  ],
  warranty: [
    "DVELE_FIT_FINISH_MONTHS",
    "DVELE_FIT_FINISH_YEARS",
    "DVELE_STRUCTURAL_MONTHS",
    "DVELE_STRUCTURAL_YEARS",
    "DVELE_SYSTEMS_MONTHS",
    "DVELE_SYSTEMS_YEARS",
    "DVELE_BUILDING_ENVELOPE_MONTHS",
    "DVELE_BUILDING_ENVELOPE_YEARS",
    "ONSITE_FIT_FINISH_MONTHS",
    "ONSITE_FIT_FINISH_YEARS",
    "ONSITE_STRUCTURAL_MONTHS",
    "ONSITE_STRUCTURAL_YEARS",
    "ONSITE_SYSTEMS_MONTHS",
    "ONSITE_SYSTEMS_YEARS",
    "CLIENT_FIT_FINISH_MONTHS",
    "CLIENT_FIT_FINISH_YEARS",
    "CLIENT_STRUCTURAL_MONTHS",
    "CLIENT_STRUCTURAL_YEARS",
    "CLIENT_BUILDING_ENVELOPE_MONTHS",
    "CLIENT_BUILDING_ENVELOPE_YEARS",
    "WARRANTY_START_DATE",
  ],
  manufacturer: [
    "MANUFACTURER_LEGAL_NAME",
    "MANUFACTURER_STATE",
    "MANUFACTURER_ENTITY_TYPE",
    "MANUFACTURER_ADDRESS",
    "MANUFACTURER_FULL_ADDRESS",
    "MANUFACTURER_LICENSE_NUMBER",
    "MANUFACTURER_LICENSE_STATE",
    "MANUFACTURER_CONTACT_NAME",
    "MANUFACTURER_CONTACT_EMAIL",
    "MANUFACTURER_CONTACT_PHONE",
  ],
  onsiteContractor: [
    "ONSITE_CONTRACTOR_LEGAL_NAME",
    "ONSITE_CONTRACTOR_STATE",
    "ONSITE_CONTRACTOR_ENTITY_TYPE",
    "ONSITE_CONTRACTOR_ADDRESS",
    "ONSITE_CONTRACTOR_FULL_ADDRESS",
    "ONSITE_CONTRACTOR_LICENSE_NUMBER",
    "ONSITE_CONTRACTOR_LICENSE_STATE",
    "ONSITE_CONTRACTOR_CONTACT_NAME",
    "ONSITE_CONTRACTOR_CONTACT_EMAIL",
    "ONSITE_CONTRACTOR_CONTACT_PHONE",
    "ONSITE_CONTRACTOR_BOND_AMOUNT",
    "ONSITE_CONTRACTOR_INSURANCE_AMOUNT",
  ],
  liquidatedDamages: [
    "LIQUIDATED_DAMAGES_PER_DAY",
    "LIQUIDATED_DAMAGES_PER_DAY_WRITTEN",
    "LIQUIDATED_DAMAGES_CAP",
    "LIQUIDATED_DAMAGES_CAP_WRITTEN",
    "ONSITE_LIQUIDATED_DAMAGES_PER_DAY",
    "ONSITE_LIQUIDATED_DAMAGES_PER_DAY_WRITTEN",
    "ONSITE_LIQUIDATED_DAMAGES_CAP",
    "ONSITE_LIQUIDATED_DAMAGES_CAP_WRITTEN",
  ],
  schedule: [
    "DESIGN_DURATION",
    "DESIGN_DURATION_WRITTEN",
    "MANUFACTURING_DURATION",
    "MANUFACTURING_DURATION_WRITTEN",
    "ONSITE_DURATION",
    "ONSITE_DURATION_WRITTEN",
    "PERMITTING_DURATION",
    "PERMITTING_DURATION_WRITTEN",
    "DELIVERY_DATE",
    "COMPLETION_DATE",
    "PROJECT_START_DATE",
    "PROJECT_END_DATE",
  ],
  legal: [
    "GOVERNING_LAW_STATE",
    "ARBITRATION_LOCATION",
    "ARBITRATION_PROVIDER",
    "STATE_OF_FORMATION",
    "COUNTY",
    "CANCELLATION_FEE_PERCENT",
  ],
  insurance: [
    "GL_INSURANCE_LIMIT",
    "GL_AGGREGATE_LIMIT",
  ],
  tables: [
    "PRICING_BREAKDOWN_TABLE",
    "PAYMENT_SCHEDULE_TABLE",
    "UNIT_DETAILS_TABLE",
  ],
  conditional: [
    "IS_CRC",
    "IS_CMOS",
    "HAS_CHILD_LLC",
    "HAS_TRUST",
    "HAS_MULTIPLE_CLIENTS",
    "PRICE_IS_LOCKED",
  ],
};

export const ALL_VARIABLES = Object.values(VARIABLE_CATEGORIES).flat();

// =============================================================================
// FORMATTING HELPERS
// =============================================================================

/**
 * Convert cents to dollars and format as currency: 123456 -> "$1,234.56"
 */
export function formatCentsAsCurrency(cents: number | null | undefined): string {
  if (cents == null) return "";
  const dollars = cents / 100;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(dollars);
}

/**
 * Convert cents to dollars (numeric): 123456 -> 1234.56
 */
export function centsToDollars(cents: number | null | undefined): number | null {
  if (cents == null) return null;
  return cents / 100;
}

/**
 * Format a date string to written form: "2025-01-15" -> "January 15, 2025"
 */
export function formatDateWritten(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * Format a number with commas: 1234567 -> "1,234,567"
 */
export function formatNumber(num: number | null | undefined): string {
  if (num == null) return "";
  return new Intl.NumberFormat("en-US").format(num);
}

/**
 * Format dollars (not cents) as currency: 1234.56 -> "$1,234.56"
 */
export function formatCurrency(dollars: number | null | undefined): string {
  if (dollars == null) return "";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(dollars);
}

/**
 * Convert months to years (for display): 24 -> 2, 120 -> 10
 */
export function monthsToYears(months: number | null | undefined): number | null {
  if (months == null) return null;
  return months / 12;
}

/**
 * Build a full address from components
 */
export function buildFullAddress(
  address: string | null | undefined,
  city: string | null | undefined,
  state: string | null | undefined,
  zip: string | null | undefined
): string {
  const parts = [address, city, state, zip].filter(Boolean);
  if (parts.length === 0) return "";
  // Format as: "123 Main St, City, ST 12345"
  if (city && state && zip) {
    return `${address || ""}, ${city}, ${state} ${zip}`.replace(/^, /, "");
  }
  return parts.join(", ");
}

/**
 * Format percentage: 25 -> "25%"
 */
export function formatPercent(value: number | null | undefined): string {
  if (value == null) return "";
  return `${value}%`;
}

// =============================================================================
// MILESTONE HELPERS
// =============================================================================

interface MilestoneVariables {
  [key: string]: string | number | null;
}

/**
 * Extract milestone variables for a specific type and number
 */
function getMilestoneVariables(
  milestones: Milestone[],
  type: "client" | "manufacturing" | "onsite",
  prefix: string
): MilestoneVariables {
  const vars: MilestoneVariables = {};
  
  // Filter milestones by type and sort by number
  const typeMilestones = milestones
    .filter(m => m.milestoneType === type)
    .sort((a, b) => a.milestoneNumber - b.milestoneNumber);
  
  // Generate variables for up to 6 milestones
  for (let i = 1; i <= 6; i++) {
    const milestone = typeMilestones.find(m => m.milestoneNumber === i);
    vars[`${prefix}_MILESTONE_${i}_NAME`] = milestone?.name || "";
    vars[`${prefix}_MILESTONE_${i}_PERCENT`] = milestone?.percentage ? formatPercent(milestone.percentage) : "";
    vars[`${prefix}_MILESTONE_${i}_AMOUNT`] = formatCentsAsCurrency(milestone?.amount);
    vars[`${prefix}_MILESTONE_${i}_DUE_UPON`] = milestone?.dueUpon || "";
    vars[`${prefix}_MILESTONE_${i}_TARGET_DATE`] = milestone?.targetDate || "";
    vars[`${prefix}_MILESTONE_${i}_STATUS`] = milestone?.status || "";
  }
  
  return vars;
}

// =============================================================================
// PRICING SUMMARY INTERFACE (for optional pricing engine integration)
// =============================================================================

export interface PricingSummaryForMapper {
  breakdown: {
    totalDesignFee: number;
    totalOffsite: number;
    totalOnsite: number;
    totalCustomizations: number;
  };
  grandTotal: number;
  projectBudget: number;
  contractValue: number;
  serviceModel: 'CRC' | 'CMOS';
  paymentSchedule: { name: string; percentage: number; amount: number; phase: string }[];
  unitCount: number;
  unitModelSummary: string;
}

// =============================================================================
// MAIN MAPPER FUNCTION
// =============================================================================

/**
 * Maps a project with all its relations to contract template variables.
 * Returns an object with all variables that can be used with docxtemplater.
 * 
 * @param data - Project data with all relations
 * @param pricingSummary - Optional pricing engine output for accurate financial variables
 */
/**
 * Build a formatted unit model list from project units
 * Format: "1x Trinity (Unit A), 1x Salt Point (Unit B)"
 */
function buildUnitModelList(units?: ProjectUnit[]): string {
  if (!units || units.length === 0) {
    return "No units selected";
  }
  
  return units.map(unit => {
    const modelName = unit.homeModel?.modelName || 'Unknown Model';
    const label = unit.unitLabel || '';
    return `1x ${modelName}${label ? ` (${label})` : ''}`;
  }).join(', ');
}

export function mapProjectToVariables(
  data: ProjectWithRelations, 
  pricingSummary?: PricingSummaryForMapper
): ContractVariables {
  const { project, client, childLlc, projectDetails, financials, milestones, warrantyTerms, contractors, units } = data;

  // Find specific contractors by type
  const manufacturer = contractors.find(c => c.contractorType === "manufacturer");
  const onsiteContractor = contractors.find(c => c.contractorType === "onsite_general");

  // Build milestone variables
  const clientMilestones = getMilestoneVariables(milestones, "client", "CLIENT");
  const mfgMilestones = getMilestoneVariables(milestones, "manufacturing", "MFG");
  const onsiteMilestones = getMilestoneVariables(milestones, "onsite", "ONSITE");

  // Build the variables object
  const variables: ContractVariables = {
    // ===================
    // PROJECT
    // ===================
    PROJECT_NUMBER: project.projectNumber,
    PROJECT_NAME: project.name,
    PROJECT_STATUS: project.status,
    PROJECT_STATE: project.state || "",
    ON_SITE_SELECTION: project.onSiteSelection || "CRC",

    // ===================
    // CLIENT
    // ===================
    CLIENT_LEGAL_NAME: client?.legalName || "",
    CLIENT_ENTITY_TYPE: client?.entityType || "Individual",
    CLIENT_FORMATION_STATE: client?.formationState || "",
    CLIENT_ADDRESS: client?.address || "",
    CLIENT_CITY: client?.city || "",
    CLIENT_STATE: client?.state || "",
    CLIENT_ZIP: client?.zip || "",
    CLIENT_FULL_ADDRESS: buildFullAddress(
      client?.address,
      client?.city,
      client?.state,
      client?.zip
    ),
    CLIENT_EMAIL: client?.email || "",
    CLIENT_PHONE: client?.phone || "",
    CLIENT_TRUST_DATE: client?.trustDate || "",
    CLIENT_TRUST_DATE_WRITTEN: formatDateWritten(client?.trustDate),
    CLIENT_TRUSTEE_NAME: client?.trusteeName || "",
    CLIENT2_LEGAL_NAME: client?.client2LegalName || "",
    CLIENT2_ENTITY_TYPE: client?.client2EntityType || "",
    OWNERSHIP_SPLIT: client?.ownershipSplit || "",

    // ===================
    // CHILD LLC
    // ===================
    CHILD_LLC_LEGAL_NAME: childLlc?.legalName || "",
    CHILD_LLC_FORMATION_STATE: childLlc?.formationState || "Delaware",
    CHILD_LLC_ENTITY_TYPE: childLlc?.entityType || "LLC",
    CHILD_LLC_EIN: childLlc?.ein || "",
    CHILD_LLC_FORMATION_DATE: childLlc?.formationDate || "",
    CHILD_LLC_FORMATION_DATE_WRITTEN: formatDateWritten(childLlc?.formationDate),
    CHILD_LLC_REGISTERED_AGENT: childLlc?.registeredAgent || "",
    CHILD_LLC_REGISTERED_AGENT_ADDRESS: childLlc?.registeredAgentAddress || "",
    CHILD_LLC_ADDRESS: childLlc?.address || "",
    CHILD_LLC_FULL_ADDRESS: buildFullAddress(
      childLlc?.address,
      childLlc?.city,
      childLlc?.state,
      childLlc?.zip
    ),
    CHILD_LLC_INSURANCE_STATUS: childLlc?.insuranceStatus || "Pending",
    CHILD_LLC_INSURANCE_EXPIRATION: childLlc?.insuranceExpiration || "",
    CHILD_LLC_ANNUAL_REPORT_DUE: childLlc?.annualReportDue || "",

    // ===================
    // SITE / DELIVERY
    // ===================
    DELIVERY_ADDRESS: projectDetails?.deliveryAddress || "",
    DELIVERY_CITY: projectDetails?.deliveryCity || "",
    DELIVERY_STATE: projectDetails?.deliveryState || "",
    DELIVERY_ZIP: projectDetails?.deliveryZip || "",
    DELIVERY_FULL_ADDRESS: buildFullAddress(
      projectDetails?.deliveryAddress,
      projectDetails?.deliveryCity,
      projectDetails?.deliveryState,
      projectDetails?.deliveryZip
    ),
    DELIVERY_COUNTY: projectDetails?.deliveryCounty || "",
    DELIVERY_APN: projectDetails?.deliveryApn || "",
    SITE_ACREAGE: projectDetails?.siteAcreage || "",
    SITE_ZONING: projectDetails?.siteZoning || "",

    // ===================
    // HOME
    // ===================
    // HOME_MODEL: single model name from projectDetails (unchanged)
    HOME_MODEL: pricingSummary?.unitModelSummary || projectDetails?.homeModel || "",
    // UNIT_MODEL_LIST: formatted list from real project units
    UNIT_MODEL_LIST: pricingSummary?.unitModelSummary || buildUnitModelList(units),
    HOME_SQ_FT: projectDetails?.homeSqFt ? formatNumber(projectDetails.homeSqFt) : "",
    HOME_SQ_FT_RAW: projectDetails?.homeSqFt || "",
    HOME_BEDROOMS: projectDetails?.homeBedrooms || "",
    HOME_BATHROOMS: projectDetails?.homeBathrooms || "",
    HOME_STORIES: projectDetails?.homeStories || "",
    HOME_GARAGE: projectDetails?.homeGarage || "",
    TOTAL_UNITS: pricingSummary?.unitCount || projectDetails?.totalUnits || 1,
    MODULE_COUNT: projectDetails?.moduleCount || "",

    // ===================
    // SPECIFICATIONS
    // ===================
    BUILDING_CODE_REFERENCE: projectDetails?.buildingCodeReference || "",
    CLIMATE_ZONE: projectDetails?.climateZone || "",
    WIND_SPEED: projectDetails?.windSpeed || "",
    SNOW_LOAD: projectDetails?.snowLoad || "",
    SEISMIC_ZONE: projectDetails?.seismicZone || "",

    // ===================
    // DATES
    // ===================
    AGREEMENT_EXECUTION_DATE: projectDetails?.agreementExecutionDate || "",
    AGREEMENT_EXECUTION_DATE_WRITTEN: formatDateWritten(projectDetails?.agreementExecutionDate),
    DESIGN_START_DATE: projectDetails?.designStartDate || "",
    DESIGN_START_DATE_WRITTEN: formatDateWritten(projectDetails?.designStartDate),
    DESIGN_COMPLETE_DATE: projectDetails?.designCompleteDate || "",
    DESIGN_COMPLETE_DATE_WRITTEN: formatDateWritten(projectDetails?.designCompleteDate),
    GREEN_LIGHT_DATE: projectDetails?.greenLightDate || "",
    GREEN_LIGHT_DATE_WRITTEN: formatDateWritten(projectDetails?.greenLightDate),
    PRODUCTION_START_DATE: projectDetails?.productionStartDate || "",
    PRODUCTION_START_DATE_WRITTEN: formatDateWritten(projectDetails?.productionStartDate),
    ESTIMATED_DELIVERY_DATE: projectDetails?.estimatedDeliveryDate || "",
    ESTIMATED_DELIVERY_DATE_WRITTEN: formatDateWritten(projectDetails?.estimatedDeliveryDate),
    ACTUAL_DELIVERY_DATE: projectDetails?.actualDeliveryDate || "",
    ACTUAL_DELIVERY_DATE_WRITTEN: formatDateWritten(projectDetails?.actualDeliveryDate),

    // ===================
    // PRICING (stored in cents, output as dollars)
    // ===================
    DESIGN_FEE: centsToDollars(financials?.designFee),
    DESIGN_FEE_WRITTEN: formatCentsAsCurrency(financials?.designFee),
    DESIGN_REVISION_ROUNDS: financials?.designRevisionRounds || 3,
    DESIGN_REVISION_COST_OVERAGE: centsToDollars(financials?.designRevisionCostOverage),
    DESIGN_REVISION_COST_OVERAGE_WRITTEN: formatCentsAsCurrency(financials?.designRevisionCostOverage),
    
    PRELIM_OFFSITE: centsToDollars(financials?.prelimOffsite),
    PRELIM_OFFSITE_WRITTEN: formatCentsAsCurrency(financials?.prelimOffsite),
    PRELIM_ONSITE: centsToDollars(financials?.prelimOnsite),
    PRELIM_ONSITE_WRITTEN: formatCentsAsCurrency(financials?.prelimOnsite),
    PRELIM_CONTRACT_PRICE: centsToDollars(financials?.prelimContractPrice),
    PRELIM_CONTRACT_PRICE_WRITTEN: formatCentsAsCurrency(financials?.prelimContractPrice),
    
    HOME_BASE_PRICE: centsToDollars(financials?.homeBasePrice),
    HOME_BASE_PRICE_WRITTEN: formatCentsAsCurrency(financials?.homeBasePrice),
    HOME_CUSTOMIZATIONS: centsToDollars(financials?.homeCustomizations),
    HOME_CUSTOMIZATIONS_WRITTEN: formatCentsAsCurrency(financials?.homeCustomizations),
    FINAL_OFFSITE: centsToDollars(financials?.finalOffsite),
    FINAL_OFFSITE_WRITTEN: formatCentsAsCurrency(financials?.finalOffsite),
    REFINED_ONSITE: centsToDollars(financials?.refinedOnsite),
    REFINED_ONSITE_WRITTEN: formatCentsAsCurrency(financials?.refinedOnsite),
    FINAL_CONTRACT_PRICE: centsToDollars(financials?.finalContractPrice),
    FINAL_CONTRACT_PRICE_WRITTEN: formatCentsAsCurrency(financials?.finalContractPrice),
    
    // Reimbursable Expenses
    ADMIN_FEE_PERCENT: (financials as any)?.adminFeePercent ? `${(financials as any).adminFeePercent}%` : "15%",
    
    INFLATION_TRIGGER_DATE: financials?.inflationTriggerDate || "",
    INFLATION_TRIGGER_DATE_WRITTEN: formatDateWritten(financials?.inflationTriggerDate),
    INFLATION_ADJUSTMENT_PERCENT: financials?.inflationAdjustmentPercent ? `${financials.inflationAdjustmentPercent}%` : "5%",
    MATERIAL_INCREASE_THRESHOLD: financials?.materialIncreaseThreshold ? `${financials.materialIncreaseThreshold}%` : "10%",
    
    // Price Lock
    PRICE_IS_LOCKED: financials?.isLocked || false,
    PRICE_LOCKED_AT: financials?.lockedAt || "",
    PRICE_LOCKED_AT_WRITTEN: formatDateWritten(financials?.lockedAt),
    PRICE_LOCKED_BY: financials?.lockedBy || "",
    
    // ===================
    // PRICING ENGINE TOTALS (computed from selected units)
    // ===================
    // Total Project Budget = Design + Offsite + Onsite (full cost of the project)
    TOTAL_PROJECT_BUDGET: pricingSummary ? pricingSummary.projectBudget / 100 : centsToDollars(financials?.prelimContractPrice),
    TOTAL_PROJECT_BUDGET_WRITTEN: pricingSummary 
      ? formatCurrency(pricingSummary.projectBudget / 100)
      : formatCentsAsCurrency(financials?.prelimContractPrice),
    
    // Total Contract Price = What Dvele charges the client
    // CRC: Design + Offsite (excludes onsite - client handles their own GC)
    // CMOS: Design + Offsite + Onsite (Dvele manages everything)
    TOTAL_CONTRACT_PRICE: pricingSummary ? pricingSummary.contractValue / 100 : centsToDollars(financials?.prelimContractPrice),
    TOTAL_CONTRACT_PRICE_WRITTEN: pricingSummary 
      ? formatCurrency(pricingSummary.contractValue / 100)
      : formatCentsAsCurrency(financials?.prelimContractPrice),
    
    // Service model used for pricing
    PRICING_SERVICE_MODEL: pricingSummary?.serviceModel || project.onSiteSelection || "CRC",

    // Offsite Manufacturing Cost (from pricing engine or financials)
    OFFSITE_MANUFACTURING_COST: pricingSummary 
      ? pricingSummary.breakdown.totalOffsite / 100 
      : centsToDollars(financials?.prelimOffsite),
    OFFSITE_MANUFACTURING_COST_WRITTEN: pricingSummary 
      ? formatCurrency(pricingSummary.breakdown.totalOffsite / 100)
      : formatCentsAsCurrency(financials?.prelimOffsite),

    // Onsite Construction Cost (for CMOS - from pricing engine or financials)
    ONSITE_CONSTRUCTION_COST: pricingSummary 
      ? pricingSummary.breakdown.totalOnsite / 100 
      : centsToDollars(financials?.prelimOnsite),
    ONSITE_CONSTRUCTION_COST_WRITTEN: pricingSummary 
      ? formatCurrency(pricingSummary.breakdown.totalOnsite / 100)
      : formatCentsAsCurrency(financials?.prelimOnsite),

    // ===================
    // DYNAMIC HTML TABLES
    // ===================
    // Debug logging for payment schedule
    ...((() => {
      console.log('📊 Mapping Payment Schedule:', {
        hasPricingSummary: !!pricingSummary,
        paymentScheduleLength: pricingSummary?.paymentSchedule?.length || 0,
        paymentSchedule: pricingSummary?.paymentSchedule || null
      });
      return {};
    })()),
    PRICING_BREAKDOWN_TABLE: generatePricingTableHtml(pricingSummary || null),
    PAYMENT_SCHEDULE_TABLE: generatePaymentScheduleHtml(pricingSummary?.paymentSchedule || null),
    UNIT_DETAILS_TABLE: generateUnitDetailsHtml(
      units?.map(u => ({
        unitLabel: u.unitLabel || `Unit ${u.id}`,
        modelName: u.homeModel?.modelName || 'Unknown Model',
        bedrooms: u.homeModel?.bedrooms,
        bathrooms: u.homeModel?.bathrooms,
        squareFootage: u.homeModel?.squareFootage,
        estimatedPrice: (u.basePriceSnapshot || 0) + (u.onsiteEstimateSnapshot || 0),
      })) || null
    ),

    // ===================
    // MILESTONES (spread in the milestone objects)
    // ===================
    ...clientMilestones,
    ...mfgMilestones,
    ...onsiteMilestones,

    // ===================
    // WARRANTY (stored in months, provide both months and years)
    // ===================
    DVELE_FIT_FINISH_MONTHS: warrantyTerms?.dveleFitFinishMonths || 12,
    DVELE_FIT_FINISH_YEARS: monthsToYears(warrantyTerms?.dveleFitFinishMonths) || 1,
    DVELE_STRUCTURAL_MONTHS: warrantyTerms?.dveleStructuralMonths || 120,
    DVELE_STRUCTURAL_YEARS: monthsToYears(warrantyTerms?.dveleStructuralMonths) || 10,
    DVELE_SYSTEMS_MONTHS: warrantyTerms?.dveleSystemsMonths || 24,
    DVELE_SYSTEMS_YEARS: monthsToYears(warrantyTerms?.dveleSystemsMonths) || 2,
    DVELE_BUILDING_ENVELOPE_MONTHS: warrantyTerms?.dveleBuildingEnvelopeMonths || 60,
    DVELE_BUILDING_ENVELOPE_YEARS: monthsToYears(warrantyTerms?.dveleBuildingEnvelopeMonths) || 5,
    
    ONSITE_FIT_FINISH_MONTHS: warrantyTerms?.onsiteFitFinishMonths || 12,
    ONSITE_FIT_FINISH_YEARS: monthsToYears(warrantyTerms?.onsiteFitFinishMonths) || 1,
    ONSITE_STRUCTURAL_MONTHS: warrantyTerms?.onsiteStructuralMonths || 120,
    ONSITE_STRUCTURAL_YEARS: monthsToYears(warrantyTerms?.onsiteStructuralMonths) || 10,
    ONSITE_SYSTEMS_MONTHS: warrantyTerms?.onsiteSystemsMonths || 24,
    ONSITE_SYSTEMS_YEARS: monthsToYears(warrantyTerms?.onsiteSystemsMonths) || 2,
    
    CLIENT_FIT_FINISH_MONTHS: warrantyTerms?.clientFitFinishMonths || 12,
    CLIENT_FIT_FINISH_YEARS: monthsToYears(warrantyTerms?.clientFitFinishMonths) || 1,
    CLIENT_STRUCTURAL_MONTHS: warrantyTerms?.clientStructuralMonths || 120,
    CLIENT_STRUCTURAL_YEARS: monthsToYears(warrantyTerms?.clientStructuralMonths) || 10,
    CLIENT_BUILDING_ENVELOPE_MONTHS: warrantyTerms?.clientBuildingEnvelopeMonths || 60,
    CLIENT_BUILDING_ENVELOPE_YEARS: monthsToYears(warrantyTerms?.clientBuildingEnvelopeMonths) || 5,
    
    WARRANTY_START_DATE: warrantyTerms?.warrantyStartDate || "",
    WARRANTY_START_DATE_WRITTEN: formatDateWritten(warrantyTerms?.warrantyStartDate),
    CUSTOM_WARRANTY_TERMS: warrantyTerms?.customWarrantyTerms || "",

    // ===================
    // MANUFACTURER
    // ===================
    MANUFACTURER_LEGAL_NAME: manufacturer?.legalName || "Dvele Manufacturing, LLC",
    MANUFACTURER_STATE: manufacturer?.state || "California",
    MANUFACTURER_ENTITY_TYPE: manufacturer?.entityType || "LLC",
    MANUFACTURER_ADDRESS: manufacturer?.address || "",
    MANUFACTURER_FULL_ADDRESS: buildFullAddress(
      manufacturer?.address,
      manufacturer?.city,
      manufacturer?.stateAddress,
      manufacturer?.zip
    ),
    MANUFACTURER_LICENSE_NUMBER: manufacturer?.licenseNumber || "",
    MANUFACTURER_LICENSE_STATE: manufacturer?.licenseState || "",
    MANUFACTURER_LICENSE_EXPIRATION: manufacturer?.licenseExpiration || "",
    MANUFACTURER_CONTACT_NAME: manufacturer?.contactName || "",
    MANUFACTURER_CONTACT_EMAIL: manufacturer?.contactEmail || "",
    MANUFACTURER_CONTACT_PHONE: manufacturer?.contactPhone || "",
    MANUFACTURER_BOND_AMOUNT: formatCentsAsCurrency(manufacturer?.bondAmount),
    MANUFACTURER_INSURANCE_AMOUNT: formatCentsAsCurrency(manufacturer?.insuranceAmount),
    MANUFACTURER_INSURANCE_EXPIRATION: manufacturer?.insuranceExpiration || "",

    // ===================
    // ON-SITE CONTRACTOR
    // ===================
    ONSITE_CONTRACTOR_LEGAL_NAME: onsiteContractor?.legalName || "",
    ONSITE_CONTRACTOR_STATE: onsiteContractor?.state || "",
    ONSITE_CONTRACTOR_ENTITY_TYPE: onsiteContractor?.entityType || "",
    ONSITE_CONTRACTOR_ADDRESS: onsiteContractor?.address || "",
    ONSITE_CONTRACTOR_FULL_ADDRESS: buildFullAddress(
      onsiteContractor?.address,
      onsiteContractor?.city,
      onsiteContractor?.stateAddress,
      onsiteContractor?.zip
    ),
    ONSITE_CONTRACTOR_LICENSE_NUMBER: onsiteContractor?.licenseNumber || "",
    ONSITE_CONTRACTOR_LICENSE_STATE: onsiteContractor?.licenseState || "",
    ONSITE_CONTRACTOR_LICENSE_EXPIRATION: onsiteContractor?.licenseExpiration || "",
    ONSITE_CONTRACTOR_CONTACT_NAME: onsiteContractor?.contactName || "",
    ONSITE_CONTRACTOR_CONTACT_EMAIL: onsiteContractor?.contactEmail || "",
    ONSITE_CONTRACTOR_CONTACT_PHONE: onsiteContractor?.contactPhone || "",
    ONSITE_CONTRACTOR_BOND_AMOUNT: formatCentsAsCurrency(onsiteContractor?.bondAmount),
    ONSITE_CONTRACTOR_INSURANCE_AMOUNT: formatCentsAsCurrency(onsiteContractor?.insuranceAmount),
    ONSITE_CONTRACTOR_INSURANCE_EXPIRATION: onsiteContractor?.insuranceExpiration || "",
    ONSITE_CONTRACTOR_INSURANCE_CARRIER: onsiteContractor?.insuranceCarrier || "",

    // ===================
    // LIQUIDATED DAMAGES
    // ===================
    LIQUIDATED_DAMAGES_PER_DAY: centsToDollars(financials?.liquidatedDamagesPerDay),
    LIQUIDATED_DAMAGES_PER_DAY_WRITTEN: formatCentsAsCurrency(financials?.liquidatedDamagesPerDay),
    LIQUIDATED_DAMAGES_CAP: centsToDollars(financials?.liquidatedDamagesCap),
    LIQUIDATED_DAMAGES_CAP_WRITTEN: formatCentsAsCurrency(financials?.liquidatedDamagesCap),
    ONSITE_LIQUIDATED_DAMAGES_PER_DAY: centsToDollars(financials?.onsiteLiquidatedDamagesPerDay),
    ONSITE_LIQUIDATED_DAMAGES_PER_DAY_WRITTEN: formatCentsAsCurrency(financials?.onsiteLiquidatedDamagesPerDay),
    ONSITE_LIQUIDATED_DAMAGES_CAP: centsToDollars(financials?.onsiteLiquidatedDamagesCap),
    ONSITE_LIQUIDATED_DAMAGES_CAP_WRITTEN: formatCentsAsCurrency(financials?.onsiteLiquidatedDamagesCap),

    // ===================
    // LEGAL
    // ===================
    GOVERNING_LAW_STATE: projectDetails?.governingLawState || project.state || "California",
    ARBITRATION_LOCATION: projectDetails?.arbitrationLocation || "",
    ARBITRATION_PROVIDER: "JAMS",
    STATE_OF_FORMATION: projectDetails?.governingLawState || project.state || "California",
    COUNTY: projectDetails?.deliveryCounty || "",
    CANCELLATION_FEE_PERCENT: "15",

    // ===================
    // INSURANCE
    // ===================
    GL_INSURANCE_LIMIT: "$1,000,000",
    GL_AGGREGATE_LIMIT: "$2,000,000",

    // ===================
    // SCHEDULE
    // ===================
    DESIGN_DURATION: String(projectDetails?.designPhaseDays || 90),
    DESIGN_DURATION_WRITTEN: `${projectDetails?.designPhaseDays || 90} days`,
    MANUFACTURING_DURATION: String(projectDetails?.manufacturingDurationDays || 120),
    MANUFACTURING_DURATION_WRITTEN: `${projectDetails?.manufacturingDurationDays || 120} days`,
    ONSITE_DURATION: String(projectDetails?.onsiteDurationDays || 90),
    ONSITE_DURATION_WRITTEN: `${projectDetails?.onsiteDurationDays || 90} days`,
    PERMITTING_DURATION: String(projectDetails?.permittingDurationDays || 60),
    PERMITTING_DURATION_WRITTEN: `${projectDetails?.permittingDurationDays || 60} days`,
    DELIVERY_DATE: projectDetails?.estimatedDeliveryDate 
      ? formatDate(new Date(projectDetails.estimatedDeliveryDate)) 
      : "",
    COMPLETION_DATE: projectDetails?.estimatedCompletionDate 
      ? formatDate(new Date(projectDetails.estimatedCompletionDate)) 
      : "",
    PROJECT_START_DATE: financials?.contractDate 
      ? formatDate(new Date(financials.contractDate)) 
      : "",
    PROJECT_END_DATE: projectDetails?.estimatedCompletionDate 
      ? formatDate(new Date(projectDetails.estimatedCompletionDate)) 
      : "",

    // ===================
    // CONDITIONAL FLAGS (for template logic)
    // ===================
    IS_CRC: project.onSiteSelection === "CRC",
    IS_CMOS: project.onSiteSelection === "CMOS",
    HAS_CHILD_LLC: !!childLlc?.legalName,
    HAS_TRUST: !!client?.trustDate || client?.entityType === "Trust",
    HAS_MULTIPLE_CLIENTS: !!client?.client2LegalName,
    HAS_MANUFACTURER: !!manufacturer,
    HAS_ONSITE_CONTRACTOR: !!onsiteContractor,

    // ===================
    // CLAUSE VARIABLE ALIASES
    // These match the exact variable names used in clauses
    // ===================
    ON_SITE_SERVICES_SELECTION: project.onSiteSelection === "CRC" 
      ? "Client-Retained Contractor" 
      : project.onSiteSelection === "CMOS" 
        ? "Company-Managed On-Site Services" 
        : project.onSiteSelection || "CRC",
    
    // Pricing aliases to match clause variable names
    PRELIMINARY_CONTRACT_PRICE: formatCentsAsCurrency(financials?.prelimContractPrice),
    PRELIMINARY_OFFSITE_PRICE: formatCentsAsCurrency(financials?.prelimOffsite),
    PRELIMINARY_ONSITE_PRICE: formatCentsAsCurrency(financials?.prelimOnsite),
    PRELIMINARY_TOTAL_PRICE: formatCentsAsCurrency(financials?.prelimContractPrice),
    
    // Child LLC aliases (clauses use DVELE_PARTNERS_XYZ format)
    DVELE_PARTNERS_XYZ: childLlc?.legalName?.replace(/ LLC$/, '').replace(/, LLC$/, '') || "Dvele Partners",
    DVELE_PARTNERS_XYZ_LEGAL_NAME: childLlc?.legalName || "",
    DVELE_PARTNERS_XYZ_STATE: childLlc?.formationState || "Delaware",
    DVELE_PARTNERS_XYZ_ENTITY_TYPE: "limited liability company",
    DP_X: childLlc?.legalName || "",
    DP_X_STATE: childLlc?.formationState || "Delaware",
    
    // Contract price alias
    CONTRACT_PRICE: formatCentsAsCurrency(financials?.prelimContractPrice || financials?.finalContractPrice),
    
    // Effective date alias
    EFFECTIVE_DATE: projectDetails?.agreementExecutionDate || "",
    
    // Client signer info - use existing fields
    CLIENT_FULL_NAME: client?.legalName || "",
    CLIENT_TITLE: client?.entityType || "",
    
    // Milestone percent aliases - get from milestones array
    MILESTONE_1_PERCENT: milestones.find(m => m.milestoneNumber === 1)?.percentage?.toString() || "20",
    MILESTONE_2_PERCENT: milestones.find(m => m.milestoneNumber === 2)?.percentage?.toString() || "20",
    MILESTONE_3_PERCENT: milestones.find(m => m.milestoneNumber === 3)?.percentage?.toString() || "20",
    MILESTONE_4_PERCENT: milestones.find(m => m.milestoneNumber === 4)?.percentage?.toString() || "20",
    MILESTONE_5_PERCENT: milestones.find(m => m.milestoneNumber === 5)?.percentage?.toString() || "15",
    RETAINAGE_PERCENT: "5",
    RETAINAGE_DAYS: "60",
    
    // Project location aliases
    PROJECT_COUNTY: projectDetails?.deliveryCounty || "",
    PROJECT_FEDERAL_DISTRICT: "",
    PROJECT_STATE_CODE: project.state || "",
    
    // Home model alias
    HOME_MODEL_1: projectDetails?.homeModel || "",
    
    // Warranty aliases to match clause naming (use correct property names)
    DVELE_FIT_FINISH_WARRANTY: warrantyTerms?.dveleFitFinishMonths?.toString() || "24",
    DVELE_ENVELOPE_WARRANTY: warrantyTerms?.dveleBuildingEnvelopeMonths?.toString() || "60",
    DVELE_STRUCTURAL_WARRANTY: warrantyTerms?.dveleStructuralMonths?.toString() || "120",
  };

  return variables;
}

// =============================================================================
// VARIABLE VALIDATION
// =============================================================================

/**
 * Checks which required variables are missing or empty for a given contract type.
 */
export function validateVariablesForContract(
  variables: ContractVariables,
  contractType: "one_agreement" | "manufacturing_sub" | "onsite_sub"
): { missing: string[]; warnings: string[] } {
  const missing: string[] = [];
  const warnings: string[] = [];

  // Core variables required for all contracts
  const coreRequired = [
    "PROJECT_NUMBER",
    "PROJECT_NAME",
    "CLIENT_LEGAL_NAME",
    "DELIVERY_ADDRESS",
    "AGREEMENT_EXECUTION_DATE",
  ];

  for (const varName of coreRequired) {
    if (!variables[varName]) {
      missing.push(varName);
    }
  }

  // Contract-type specific requirements
  if (contractType === "one_agreement") {
    const oneAgreementRequired = [
      "CLIENT_FULL_ADDRESS",
      "ON_SITE_SELECTION",
    ];
    for (const varName of oneAgreementRequired) {
      if (!variables[varName]) {
        missing.push(varName);
      }
    }
    
    // Check if we have pricing
    if (!variables.FINAL_CONTRACT_PRICE && !variables.PRELIM_CONTRACT_PRICE) {
      warnings.push("No contract price set (neither final nor preliminary)");
    }
    
    // Check for child LLC if needed
    if (!variables.HAS_CHILD_LLC) {
      warnings.push("No Child LLC configured - contract will use client directly");
    }
  }

  if (contractType === "manufacturing_sub") {
    if (!variables.MANUFACTURER_LEGAL_NAME) missing.push("MANUFACTURER_LEGAL_NAME");
    if (!variables.FINAL_OFFSITE && !variables.PRELIM_OFFSITE) {
      warnings.push("No off-site price set");
    }
    
    // Check for manufacturing milestones
    if (!variables.MFG_MILESTONE_1_NAME) {
      warnings.push("No manufacturing milestones configured");
    }
  }

  if (contractType === "onsite_sub") {
    if (variables.IS_CMOS) {
      if (!variables.ONSITE_CONTRACTOR_LEGAL_NAME) missing.push("ONSITE_CONTRACTOR_LEGAL_NAME");
      if (!variables.ONSITE_CONTRACTOR_LICENSE_NUMBER) warnings.push("ONSITE_CONTRACTOR_LICENSE_NUMBER not set");
      if (!variables.ONSITE_CONTRACTOR_BOND_AMOUNT) warnings.push("ONSITE_CONTRACTOR_BOND_AMOUNT not set");
    } else {
      // CRC mode - no onsite sub needed
      warnings.push("Project is CRC - on-site subcontract may not be needed");
    }
    
    // Check for onsite milestones
    if (!variables.ONSITE_MILESTONE_1_NAME) {
      warnings.push("No on-site milestones configured");
    }
  }

  return { missing, warnings };
}

// =============================================================================
// TEMPLATE VARIABLE EXTRACTION (for analyzing templates)
// =============================================================================

/**
 * Extracts all {{VARIABLE}} placeholders from a template string.
 * Useful for analyzing which variables a template needs.
 */
export function extractTemplateVariables(templateContent: string): string[] {
  const regex = /\{\{([A-Z0-9_]+)\}\}/g;
  const variables = new Set<string>();
  let match;
  while ((match = regex.exec(templateContent)) !== null) {
    variables.add(match[1]);
  }
  return Array.from(variables).sort();
}

/**
 * Compares template variables against available variables.
 * Returns variables in template that aren't in our mapper.
 */
export function findUnmappedVariables(templateVariables: string[]): string[] {
  return templateVariables.filter(v => !ALL_VARIABLES.includes(v));
}

/**
 * Returns a summary of variable coverage for a template
 */
export function getVariableCoverage(templateVariables: string[]): {
  total: number;
  mapped: number;
  unmapped: string[];
  coverage: number;
} {
  const unmapped = findUnmappedVariables(templateVariables);
  const mapped = templateVariables.length - unmapped.length;
  return {
    total: templateVariables.length,
    mapped,
    unmapped,
    coverage: templateVariables.length > 0 ? Math.round((mapped / templateVariables.length) * 100) : 100,
  };
}

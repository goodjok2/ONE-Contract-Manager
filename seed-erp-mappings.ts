import { db } from "./server/db/index";
import { erpFieldMappings } from "./shared/schema";

const seedMappings = [
  // Project variables
  { variableName: "PROJECT_NUMBER", variableCategory: "project", variableDescription: "Unique project identifier" },
  { variableName: "PROJECT_NAME", variableCategory: "project", variableDescription: "Project name" },
  { variableName: "PROJECT_STATUS", variableCategory: "project", variableDescription: "Current project status" },
  { variableName: "PROJECT_STATE", variableCategory: "project", variableDescription: "State where project is located" },
  { variableName: "ON_SITE_SELECTION", variableCategory: "project", variableDescription: "CRC or CMOS selection" },

  // Client variables
  { variableName: "CLIENT_LEGAL_NAME", variableCategory: "client", variableDescription: "Client's legal name", isRequired: true },
  { variableName: "CLIENT_ENTITY_TYPE", variableCategory: "client", variableDescription: "Individual, LLC, Corporation, Trust" },
  { variableName: "CLIENT_FORMATION_STATE", variableCategory: "client", variableDescription: "State where client entity was formed" },
  { variableName: "CLIENT_ADDRESS", variableCategory: "client", variableDescription: "Client street address" },
  { variableName: "CLIENT_CITY", variableCategory: "client", variableDescription: "Client city" },
  { variableName: "CLIENT_STATE", variableCategory: "client", variableDescription: "Client state" },
  { variableName: "CLIENT_ZIP", variableCategory: "client", variableDescription: "Client ZIP code" },
  { variableName: "CLIENT_FULL_ADDRESS", variableCategory: "client", variableDescription: "Complete formatted address" },
  { variableName: "CLIENT_EMAIL", variableCategory: "client", variableDescription: "Client email address" },
  { variableName: "CLIENT_PHONE", variableCategory: "client", variableDescription: "Client phone number" },
  { variableName: "CLIENT_TRUST_DATE", variableCategory: "client", variableDescription: "Trust formation date (if applicable)" },
  { variableName: "CLIENT_TRUSTEE_NAME", variableCategory: "client", variableDescription: "Trustee name (if trust)" },
  { variableName: "CLIENT2_LEGAL_NAME", variableCategory: "client", variableDescription: "Second client name (if applicable)" },
  { variableName: "OWNERSHIP_SPLIT", variableCategory: "client", variableDescription: "Ownership split between clients" },

  // Child LLC variables
  { variableName: "CHILD_LLC_LEGAL_NAME", variableCategory: "childLlc", variableDescription: "SPV LLC legal name" },
  { variableName: "CHILD_LLC_FORMATION_STATE", variableCategory: "childLlc", variableDescription: "LLC formation state" },
  { variableName: "CHILD_LLC_EIN", variableCategory: "childLlc", variableDescription: "LLC EIN number" },
  { variableName: "CHILD_LLC_FORMATION_DATE", variableCategory: "childLlc", variableDescription: "LLC formation date" },
  { variableName: "CHILD_LLC_REGISTERED_AGENT", variableCategory: "childLlc", variableDescription: "Registered agent name" },
  { variableName: "CHILD_LLC_FULL_ADDRESS", variableCategory: "childLlc", variableDescription: "LLC address" },

  // Site/Delivery variables
  { variableName: "DELIVERY_ADDRESS", variableCategory: "site", variableDescription: "Project delivery address", isRequired: true },
  { variableName: "DELIVERY_CITY", variableCategory: "site", variableDescription: "Delivery city" },
  { variableName: "DELIVERY_STATE", variableCategory: "site", variableDescription: "Delivery state" },
  { variableName: "DELIVERY_ZIP", variableCategory: "site", variableDescription: "Delivery ZIP" },
  { variableName: "DELIVERY_FULL_ADDRESS", variableCategory: "site", variableDescription: "Complete delivery address" },
  { variableName: "DELIVERY_COUNTY", variableCategory: "site", variableDescription: "County name" },
  { variableName: "DELIVERY_APN", variableCategory: "site", variableDescription: "Assessor's Parcel Number" },
  { variableName: "SITE_ACREAGE", variableCategory: "site", variableDescription: "Site acreage" },
  { variableName: "SITE_ZONING", variableCategory: "site", variableDescription: "Zoning designation" },

  // Home variables
  { variableName: "HOME_MODEL", variableCategory: "home", variableDescription: "Home model name" },
  { variableName: "HOME_SQ_FT", variableCategory: "home", variableDescription: "Square footage" },
  { variableName: "HOME_BEDROOMS", variableCategory: "home", variableDescription: "Number of bedrooms" },
  { variableName: "HOME_BATHROOMS", variableCategory: "home", variableDescription: "Number of bathrooms" },
  { variableName: "HOME_STORIES", variableCategory: "home", variableDescription: "Number of stories" },
  { variableName: "HOME_GARAGE", variableCategory: "home", variableDescription: "Garage type/size" },
  { variableName: "TOTAL_UNITS", variableCategory: "home", variableDescription: "Total units in project" },
  { variableName: "MODULE_COUNT", variableCategory: "home", variableDescription: "Number of modules" },

  // Specification variables
  { variableName: "BUILDING_CODE_REFERENCE", variableCategory: "specifications", variableDescription: "Applicable building code" },
  { variableName: "CLIMATE_ZONE", variableCategory: "specifications", variableDescription: "Climate zone" },
  { variableName: "WIND_SPEED", variableCategory: "specifications", variableDescription: "Design wind speed" },
  { variableName: "SNOW_LOAD", variableCategory: "specifications", variableDescription: "Design snow load" },
  { variableName: "SEISMIC_ZONE", variableCategory: "specifications", variableDescription: "Seismic design category" },

  // Date variables
  { variableName: "AGREEMENT_EXECUTION_DATE", variableCategory: "dates", variableDescription: "Contract execution date", isRequired: true },
  { variableName: "DESIGN_START_DATE", variableCategory: "dates", variableDescription: "Design phase start" },
  { variableName: "DESIGN_COMPLETE_DATE", variableCategory: "dates", variableDescription: "Design completion" },
  { variableName: "GREEN_LIGHT_DATE", variableCategory: "dates", variableDescription: "Green light approval date" },
  { variableName: "PRODUCTION_START_DATE", variableCategory: "dates", variableDescription: "Production start" },
  { variableName: "ESTIMATED_DELIVERY_DATE", variableCategory: "dates", variableDescription: "Estimated delivery" },
  { variableName: "ACTUAL_DELIVERY_DATE", variableCategory: "dates", variableDescription: "Actual delivery date" },

  // Pricing variables (stored in cents)
  { variableName: "DESIGN_FEE", variableCategory: "financial", variableDescription: "Design fee amount" },
  { variableName: "DESIGN_REVISION_ROUNDS", variableCategory: "financial", variableDescription: "Included revision rounds", defaultValue: "3" },
  { variableName: "PRELIM_OFFSITE", variableCategory: "financial", variableDescription: "Preliminary off-site price" },
  { variableName: "PRELIM_ONSITE", variableCategory: "financial", variableDescription: "Preliminary on-site price" },
  { variableName: "PRELIM_CONTRACT_PRICE", variableCategory: "financial", variableDescription: "Total preliminary price" },
  { variableName: "HOME_BASE_PRICE", variableCategory: "financial", variableDescription: "Base home price" },
  { variableName: "HOME_CUSTOMIZATIONS", variableCategory: "financial", variableDescription: "Customization costs" },
  { variableName: "FINAL_OFFSITE", variableCategory: "financial", variableDescription: "Final off-site price" },
  { variableName: "REFINED_ONSITE", variableCategory: "financial", variableDescription: "Refined on-site estimate" },
  { variableName: "FINAL_CONTRACT_PRICE", variableCategory: "financial", variableDescription: "Final total contract price", isRequired: true },
  { variableName: "INFLATION_ADJUSTMENT_PERCENT", variableCategory: "financial", variableDescription: "Inflation adjustment %", defaultValue: "5" },
  { variableName: "MATERIAL_INCREASE_THRESHOLD", variableCategory: "financial", variableDescription: "Material increase threshold %", defaultValue: "10" },
  { variableName: "LIQUIDATED_DAMAGES_PER_DAY", variableCategory: "financial", variableDescription: "Daily liquidated damages" },
  { variableName: "LIQUIDATED_DAMAGES_CAP", variableCategory: "financial", variableDescription: "Max liquidated damages" },

  // Warranty variables (in months)
  { variableName: "DVELE_FIT_FINISH_MONTHS", variableCategory: "warranty", variableDescription: "Dvele fit & finish warranty", defaultValue: "12" },
  { variableName: "DVELE_STRUCTURAL_MONTHS", variableCategory: "warranty", variableDescription: "Dvele structural warranty", defaultValue: "120" },
  { variableName: "DVELE_SYSTEMS_MONTHS", variableCategory: "warranty", variableDescription: "Dvele systems warranty", defaultValue: "24" },
  { variableName: "DVELE_BUILDING_ENVELOPE_MONTHS", variableCategory: "warranty", variableDescription: "Dvele building envelope warranty", defaultValue: "60" },
  { variableName: "ONSITE_FIT_FINISH_MONTHS", variableCategory: "warranty", variableDescription: "On-site fit & finish warranty", defaultValue: "12" },
  { variableName: "ONSITE_STRUCTURAL_MONTHS", variableCategory: "warranty", variableDescription: "On-site structural warranty", defaultValue: "120" },
  { variableName: "ONSITE_SYSTEMS_MONTHS", variableCategory: "warranty", variableDescription: "On-site systems warranty", defaultValue: "24" },
  { variableName: "CLIENT_FIT_FINISH_MONTHS", variableCategory: "warranty", variableDescription: "Client warranty - fit & finish", defaultValue: "12" },
  { variableName: "CLIENT_STRUCTURAL_MONTHS", variableCategory: "warranty", variableDescription: "Client warranty - structural", defaultValue: "120" },
  { variableName: "CLIENT_BUILDING_ENVELOPE_MONTHS", variableCategory: "warranty", variableDescription: "Client warranty - envelope", defaultValue: "60" },

  // Manufacturer variables
  { variableName: "MANUFACTURER_LEGAL_NAME", variableCategory: "manufacturer", variableDescription: "Manufacturer legal name", defaultValue: "Dvele Manufacturing, LLC" },
  { variableName: "MANUFACTURER_STATE", variableCategory: "manufacturer", variableDescription: "Manufacturer state", defaultValue: "California" },
  { variableName: "MANUFACTURER_ENTITY_TYPE", variableCategory: "manufacturer", variableDescription: "Manufacturer entity type", defaultValue: "LLC" },
  { variableName: "MANUFACTURER_ADDRESS", variableCategory: "manufacturer", variableDescription: "Manufacturer address" },
  { variableName: "MANUFACTURER_LICENSE_NUMBER", variableCategory: "manufacturer", variableDescription: "Manufacturer license #" },
  { variableName: "MANUFACTURER_CONTACT_NAME", variableCategory: "manufacturer", variableDescription: "Manufacturer contact" },
  { variableName: "MANUFACTURER_CONTACT_EMAIL", variableCategory: "manufacturer", variableDescription: "Manufacturer email" },

  // On-site contractor variables
  { variableName: "ONSITE_CONTRACTOR_LEGAL_NAME", variableCategory: "onsiteContractor", variableDescription: "On-site contractor name" },
  { variableName: "ONSITE_CONTRACTOR_STATE", variableCategory: "onsiteContractor", variableDescription: "Contractor state" },
  { variableName: "ONSITE_CONTRACTOR_LICENSE_NUMBER", variableCategory: "onsiteContractor", variableDescription: "Contractor license #" },
  { variableName: "ONSITE_CONTRACTOR_CONTACT_NAME", variableCategory: "onsiteContractor", variableDescription: "Contractor contact" },
  { variableName: "ONSITE_CONTRACTOR_BOND_AMOUNT", variableCategory: "onsiteContractor", variableDescription: "Bond amount" },

  // Legal variables
  { variableName: "GOVERNING_LAW_STATE", variableCategory: "legal", variableDescription: "Governing law state", defaultValue: "California" },
  { variableName: "ARBITRATION_LOCATION", variableCategory: "legal", variableDescription: "Arbitration venue" },
];

async function seed() {
  console.log("Seeding ERP field mappings...");
  
  for (const mapping of seedMappings) {
    try {
      await db.insert(erpFieldMappings).values({
        variableName: mapping.variableName,
        variableCategory: mapping.variableCategory,
        variableDescription: mapping.variableDescription,
        defaultValue: mapping.defaultValue || null,
        isRequired: mapping.isRequired || false,
        isActive: true,
      }).onConflictDoNothing();
    } catch (error) {
      console.log(`Skipping ${mapping.variableName} (may already exist)`);
    }
  }
  
  console.log(`Seeded ${seedMappings.length} ERP field mappings`);
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});

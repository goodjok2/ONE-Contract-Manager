/**
 * Sync Variable Registry Script
 * 
 * This script synchronizes the contract_variables database table with the
 * actual variables supported in server/lib/mapper.ts.
 * 
 * Run with: npx tsx scripts/sync_variables.ts
 */

import { db } from "../server/db";
import { contractVariables } from "../shared/schema";
import { VARIABLE_CATEGORIES } from "../server/lib/mapper";

interface VariableMetadata {
  variableName: string;
  displayName: string;
  category: string;
  dataType: string;
  isRequired: boolean;
  description: string;
}

function humanizeVariableName(varName: string): string {
  return varName
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bLlc\b/g, 'LLC')
    .replace(/\bCrc\b/g, 'CRC')
    .replace(/\bCmos\b/g, 'CMOS')
    .replace(/\bSq Ft\b/g, 'Sq Ft')
    .replace(/\bAPN\b/gi, 'APN')
    .replace(/\bEIN\b/gi, 'EIN')
    .replace(/\bGL\b/gi, 'GL');
}

function inferDataType(varName: string): string {
  const lowerName = varName.toLowerCase();
  
  if (lowerName.includes('_date') || lowerName.endsWith('_date')) {
    return 'date';
  }
  if (lowerName.includes('_amount') || lowerName.includes('_price') || 
      lowerName.includes('_fee') || lowerName.includes('_cost') ||
      lowerName.includes('_limit') || lowerName.includes('_cap')) {
    return 'currency';
  }
  if (lowerName.includes('_percent') || lowerName.includes('_months') || 
      lowerName.includes('_years') || lowerName.includes('_duration') ||
      lowerName.includes('_count') || lowerName.includes('_sq_ft') ||
      lowerName.includes('_bedrooms') || lowerName.includes('_bathrooms')) {
    return 'number';
  }
  if (lowerName.startsWith('is_') || lowerName.startsWith('has_') ||
      lowerName.includes('_is_')) {
    return 'boolean';
  }
  if (lowerName.includes('_table')) {
    return 'html';
  }
  return 'text';
}

function inferDescription(varName: string, category: string): string {
  const humanName = humanizeVariableName(varName);
  
  const categoryDescriptions: Record<string, string> = {
    project: 'Project identification field',
    client: 'Client/Owner information',
    childLlc: 'Child LLC entity information',
    site: 'Delivery site/property information',
    home: 'Home model specifications',
    specifications: 'Building code and specifications',
    dates: 'Project timeline dates',
    pricing: 'Pricing and cost information',
    milestones: 'Payment milestone details',
    warranty: 'Warranty terms and durations',
    manufacturer: 'Manufacturing contractor information',
    onsiteContractor: 'On-site contractor information',
    liquidatedDamages: 'Liquidated damages terms',
    schedule: 'Project schedule durations',
    legal: 'Legal and governing terms',
    insurance: 'Insurance requirements',
    tables: 'Dynamic HTML table content',
    conditional: 'Conditional logic flag',
  };
  
  return `${humanName} - ${categoryDescriptions[category] || 'Contract variable'}`;
}

function isRequiredVariable(varName: string): boolean {
  const requiredVars = [
    'PROJECT_NUMBER',
    'PROJECT_NAME',
    'CLIENT_LEGAL_NAME',
    'DELIVERY_ADDRESS',
    'DELIVERY_CITY',
    'DELIVERY_STATE',
    'DELIVERY_ZIP',
    'ON_SITE_SELECTION',
    'PROJECT_STATE',
  ];
  return requiredVars.includes(varName);
}

function buildVariableMetadata(): VariableMetadata[] {
  const variables: VariableMetadata[] = [];
  
  for (const [category, varNames] of Object.entries(VARIABLE_CATEGORIES)) {
    for (const varName of varNames) {
      variables.push({
        variableName: varName,
        displayName: humanizeVariableName(varName),
        category: category,
        dataType: inferDataType(varName),
        isRequired: isRequiredVariable(varName),
        description: inferDescription(varName, category),
      });
    }
  }
  
  return variables;
}

async function syncVariables(): Promise<void> {
  console.log('=== Contract Variables Sync Script ===\n');
  
  const variables = buildVariableMetadata();
  console.log(`Found ${variables.length} variables in mapper.ts\n`);
  
  console.log('Categories:');
  const categoryCount: Record<string, number> = {};
  for (const v of variables) {
    categoryCount[v.category] = (categoryCount[v.category] || 0) + 1;
  }
  for (const [cat, count] of Object.entries(categoryCount)) {
    console.log(`  - ${cat}: ${count} variables`);
  }
  console.log('');
  
  console.log('Step 1: Deleting existing contract_variables...');
  await db.delete(contractVariables);
  console.log('  ✓ Cleared contract_variables table\n');
  
  console.log('Step 2: Inserting fresh variable registry...');
  let inserted = 0;
  
  for (const variable of variables) {
    try {
      await db.insert(contractVariables).values({
        variableName: variable.variableName,
        displayName: variable.displayName,
        category: variable.category,
        dataType: variable.dataType,
        isRequired: variable.isRequired,
        description: variable.description,
        usedInContracts: ['ONE', 'OFFSITE', 'ONSITE'],
      });
      inserted++;
    } catch (error: any) {
      console.error(`  ✗ Failed to insert ${variable.variableName}: ${error.message}`);
    }
  }
  
  console.log(`  ✓ Inserted ${inserted} variables\n`);
  
  console.log('Step 3: Summary by category:');
  for (const [cat, count] of Object.entries(categoryCount)) {
    console.log(`  ${cat}: ${count} variables`);
  }
  
  console.log('\n=== Sync Complete ===');
  console.log(`Total variables in registry: ${inserted}`);
  
  process.exit(0);
}

syncVariables().catch((error) => {
  console.error('Sync failed:', error);
  process.exit(1);
});

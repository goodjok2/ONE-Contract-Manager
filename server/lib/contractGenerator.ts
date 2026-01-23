import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

interface ContractGenerationOptions {
  contractType: 'ONE' | 'MANUFACTURING' | 'ONSITE';
  projectData: Record<string, any>;
}

function fixSplitTags(xmlContent: string): string {
  let result = xmlContent.replace(/\r?\n/g, ' ');
  
  result = result.replace(/<w:r>(<w:rPr>[\s\S]*?<\/w:rPr>)?(<w:t[^>]*>[^<]*<\/w:t>)+<\/w:r>/g, (match) => {
    const textContents: string[] = [];
    const textMatches = match.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || [];
    for (const textTag of textMatches) {
      const content = textTag.replace(/<w:t[^>]*>([^<]*)<\/w:t>/, '$1');
      textContents.push(content);
    }
    const combinedText = textContents.join('');
    
    const rPrMatch = match.match(/<w:rPr>[\s\S]*?<\/w:rPr>/);
    const rPr = rPrMatch ? rPrMatch[0] : '';
    
    return `<w:r>${rPr}<w:t>${combinedText}</w:t></w:r>`;
  });
  
  for (let i = 0; i < 5; i++) {
    result = result.replace(/<\/w:t><\/w:r><w:r>(<w:rPr>[\s\S]*?<\/w:rPr>)?<w:t[^>]*>/g, '');
    result = result.replace(/<\/w:t><\/w:r><w:r><w:t>/g, '');
  }
  
  return result;
}

export async function generateContract(options: ContractGenerationOptions): Promise<Buffer> {
  const { contractType, projectData } = options;
  
  const templatePath = getTemplatePath(contractType);
  
  if (!fs.existsSync(templatePath)) {
    throw new Error(`Template not found at: ${templatePath}`);
  }
  
  const content = fs.readFileSync(templatePath, 'binary');
  const zip = new PizZip(content);
  
  const docXml = zip.file('word/document.xml');
  if (docXml) {
    let xmlContent = docXml.asText();
    xmlContent = fixSplitTags(xmlContent);
    zip.file('word/document.xml', xmlContent);
  }
  
  const variableMap = buildVariableMap(projectData, contractType);
  
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    nullGetter: () => '',
  });
  
  try {
    doc.render(variableMap);
  } catch (error: any) {
    console.error('Error rendering document:', error);
    if (error.properties && error.properties.errors) {
      console.error('Template errors:', JSON.stringify(error.properties.errors.slice(0, 5), null, 2));
    }
    throw new Error(`Failed to render ${contractType} contract: ${error.message}`);
  }
  
  const buffer = doc.getZip().generate({
    type: 'nodebuffer',
    compression: 'DEFLATE',
  });
  
  return buffer;
}

function getTemplatePath(contractType: string): string {
  const baseDir = path.join(process.cwd(), 'server/templates');
  
  const templates: Record<string, string> = {
    'ONE': path.join(baseDir, 'Template_ONE_Agreement.docx'),
    'MANUFACTURING': path.join(baseDir, 'Template_Offsite.docx'),
    'ONSITE': path.join(baseDir, 'Template_On-Site.docx'),
  };
  
  const templatePath = templates[contractType];
  console.log(`Template path for ${contractType}:`, templatePath);
  console.log(`Template exists:`, fs.existsSync(templatePath));
  
  return templatePath || '';
}

function buildVariableMap(projectData: Record<string, any>, contractType: string): Record<string, string> {
  const map: Record<string, string> = {};
  
  map['PROJECT_NUMBER'] = projectData.projectNumber || '';
  map['PROJECT_NAME'] = projectData.projectName || '';
  map['TOTAL_UNITS'] = projectData.totalUnits?.toString() || '1';
  map['AGREEMENT_EXECUTION_DATE'] = formatDate(projectData.effectiveDate || projectData.agreementDate);
  
  map['CLIENT_LEGAL_NAME'] = projectData.clientLegalName || '';
  map['CLIENT_STATE'] = projectData.clientState || '';
  map['CLIENT_ENTITY_TYPE'] = getEntityTypeText(projectData.clientEntityType);
  map['CLIENT_EMAIL'] = projectData.clientEmail || '';
  map['CLIENT_PHONE'] = projectData.clientPhone || '';
  map['CLIENT_SIGNER_NAME'] = projectData.clientSignerName || '';
  map['CLIENT_FULL_NAME'] = projectData.clientFullName || projectData.clientLegalName || '';
  map['CLIENT_TITLE'] = projectData.clientSignerTitle || projectData.clientTitle || '';
  map['CLIENT_ADDRESS'] = projectData.clientAddress || '';
  map['CLIENT_CITY'] = projectData.clientCity || '';
  map['CLIENT_ZIP'] = projectData.clientZip || '';
  
  const llcBaseName = projectData.childLlcName?.replace(' LLC', '') || 'Dvele Partners';
  map['DVELE_PARTNERS_XYZ'] = llcBaseName;
  map['DVELE_PARTNERS_XYZ_LEGAL_NAME'] = projectData.childLlcName || '';
  map['DVELE_PARTNERS_XYZ_STATE'] = projectData.childLlcState || 'Delaware';
  map['DVELE_PARTNERS_XYZ_ENTITY_TYPE'] = 'limited liability company';
  map['DP_X'] = projectData.childLlcName || '';
  map['DP_X_STATE'] = projectData.childLlcState || 'Delaware';
  
  map['DELIVERY_ADDRESS'] = formatAddress(projectData);
  map['SITE_ADDRESS'] = projectData.siteAddress || '';
  map['SITE_CITY'] = projectData.siteCity || '';
  map['SITE_STATE'] = projectData.siteState || '';
  map['SITE_ZIP'] = projectData.siteZip || '';
  map['SITE_COUNTY'] = projectData.siteCounty || '';
  
  const units = projectData.units || [];
  const totalUnits = parseInt(projectData.totalUnits) || 1;
  for (let i = 0; i < totalUnits && i < units.length; i++) {
    const unit = units[i];
    const unitNum = i + 1;
    map[`UNIT_${unitNum}_MODEL`] = unit.model || '';
    map[`UNIT_${unitNum}_SQFT`] = unit.squareFootage?.toString() || '';
    map[`UNIT_${unitNum}_BEDROOMS`] = unit.bedrooms?.toString() || '';
    map[`UNIT_${unitNum}_BATHROOMS`] = unit.bathrooms?.toString() || '';
    map[`UNIT_${unitNum}_PRICE`] = formatCurrency(unit.price);
  }
  
  if (units.length > 0) {
    map['HOME_MODEL'] = units[0].model || '';
    map['HOME_MODEL_1'] = units[0].model || '';
  }
  
  map['DESIGN_FEE'] = formatCurrency(projectData.designFee);
  map['DESIGN_REVISION_ROUNDS'] = projectData.designRevisionRounds?.toString() || '3';
  map['PRELIMINARY_OFFSITE_PRICE'] = formatCurrency(projectData.preliminaryOffsiteCost);
  map['DELIVERY_INSTALLATION_PRICE'] = formatCurrency(projectData.deliveryInstallationPrice);
  map['TOTAL_PRELIMINARY_CONTRACT_PRICE'] = formatCurrency(projectData.totalPreliminaryContractPrice);
  
  map['MILESTONE_1_PERCENT'] = projectData.milestone1Percent?.toString() || '20';
  map['MILESTONE_2_PERCENT'] = projectData.milestone2Percent?.toString() || '20';
  map['MILESTONE_3_PERCENT'] = projectData.milestone3Percent?.toString() || '20';
  map['MILESTONE_4_PERCENT'] = projectData.milestone4Percent?.toString() || '20';
  map['MILESTONE_5_PERCENT'] = projectData.milestone5Percent?.toString() || '15';
  map['RETAINAGE_PERCENT'] = projectData.retainagePercent?.toString() || '5';
  map['RETAINAGE_DAYS'] = projectData.retainageDays?.toString() || '60';
  
  const totalPrice = parseFloat(projectData.totalPreliminaryContractPrice || '0');
  map['MILESTONE_1_AMOUNT'] = formatCurrency(totalPrice * (parseFloat(map['MILESTONE_1_PERCENT']) / 100));
  map['MILESTONE_2_AMOUNT'] = formatCurrency(totalPrice * (parseFloat(map['MILESTONE_2_PERCENT']) / 100));
  map['MILESTONE_3_AMOUNT'] = formatCurrency(totalPrice * (parseFloat(map['MILESTONE_3_PERCENT']) / 100));
  map['MILESTONE_4_AMOUNT'] = formatCurrency(totalPrice * (parseFloat(map['MILESTONE_4_PERCENT']) / 100));
  map['MILESTONE_5_AMOUNT'] = formatCurrency(totalPrice * (parseFloat(map['MILESTONE_5_PERCENT']) / 100));
  map['RETAINAGE_AMOUNT'] = formatCurrency(totalPrice * (parseFloat(map['RETAINAGE_PERCENT']) / 100));
  
  map['MANUFACTURING_DESIGN_PAYMENT'] = formatCurrency(projectData.manufacturingDesignPayment);
  map['MANUFACTURING_PRODUCTION_START'] = formatCurrency(projectData.manufacturingProductionStart);
  map['MANUFACTURING_PRODUCTION_COMPLETE'] = formatCurrency(projectData.manufacturingProductionComplete);
  map['MANUFACTURING_DELIVERY_READY'] = formatCurrency(projectData.manufacturingDeliveryReady);
  
  const totalManufacturing = (projectData.manufacturingDesignPayment || 0) +
    (projectData.manufacturingProductionStart || 0) +
    (projectData.manufacturingProductionComplete || 0) +
    (projectData.manufacturingDeliveryReady || 0);
  map['TOTAL_MANUFACTURING_PRICE'] = formatCurrency(totalManufacturing);
  map['DESIGN_MANUFACTURING_PRICE'] = formatCurrency(projectData.manufacturingDesignPayment);
  map['PRODUCTION_MANUFACTURING_PRICE'] = formatCurrency(
    (projectData.manufacturingProductionStart || 0) + (projectData.manufacturingProductionComplete || 0)
  );
  map['QC_PRICE'] = formatCurrency(0);
  map['DELIVERY_PREP_PRICE'] = formatCurrency(projectData.manufacturingDeliveryReady);
  
  map['DESIGN_PAYMENT'] = '10';
  map['PRODUCTION_START_PAYMENT'] = '25';
  map['PRODUCTION_50_PAYMENT'] = '25';
  map['PRODUCTION_COMPLETION_PAYMENT'] = '25';
  map['DELIVERY_READY_PAYMENT'] = '15';
  
  map['AGREEMENT_DATE'] = formatDate(projectData.effectiveDate || projectData.agreementDate);
  map['EFFECTIVE_DATE'] = formatDate(projectData.effectiveDate);
  map['ESTIMATED_COMPLETION_DATE'] = calculateEstimatedCompletion(projectData);
  map['DESIGN_PHASE_DAYS'] = projectData.designPhaseDays?.toString() || '90';
  map['MANUFACTURING_DURATION_DAYS'] = projectData.manufacturingDurationDays?.toString() || '120';
  map['ONSITE_DURATION_DAYS'] = projectData.onsiteDurationDays?.toString() || '90';
  
  map['WARRANTY_FIT_FINISH_MONTHS'] = projectData.warrantyFitFinishMonths?.toString() || '24';
  map['WARRANTY_BUILDING_ENVELOPE_MONTHS'] = projectData.warrantyBuildingEnvelopeMonths?.toString() || '60';
  map['WARRANTY_STRUCTURAL_MONTHS'] = projectData.warrantyStructuralMonths?.toString() || '120';
  
  map['PROJECT_STATE'] = projectData.projectState || projectData.siteState || '';
  map['PROJECT_COUNTY'] = projectData.projectCounty || projectData.siteCounty || '';
  map['PROJECT_FEDERAL_DISTRICT'] = projectData.projectFederalDistrict || '';
  map['ARBITRATION_PROVIDER'] = projectData.arbitrationProvider || 'JAMS';
  
  map['ON_SITE_SERVICES_SELECTION'] = projectData.serviceModel === 'CRC' 
    ? 'CLIENT-RETAINED CONTRACTOR' 
    : 'COMPANY-MANAGED ON-SITE SERVICES';
  
  if (projectData.serviceModel === 'CRC') {
    map['ONSITE_PROVIDER_NAME'] = projectData.contractorName || '';
    map['CONTRACTOR_LICENSE'] = projectData.contractorLicense || '';
    map['CONTRACTOR_NAME'] = projectData.contractorName || '';
  } else {
    map['ONSITE_PROVIDER_NAME'] = 'Dvele On-Site Services';
    map['CONTRACTOR_LICENSE'] = '';
    map['CONTRACTOR_NAME'] = '';
  }
  
  if (projectData.serviceModel === 'CMOS') {
    map['SITE_PREP_PRICE'] = formatCurrency(projectData.sitePrepPrice);
    map['UTILITIES_PRICE'] = formatCurrency(projectData.utilitiesPrice);
    map['COMPLETION_PRICE'] = formatCurrency(projectData.completionPrice);
  }
  
  map['TOTAL_ONSITE_PRICE'] = formatCurrency(projectData.deliveryInstallationPrice);
  map['SITE_PREP_PRICE'] = formatCurrency(projectData.sitePrepPrice || 0);
  map['FOUNDATION_UTILITIES_PRICE'] = formatCurrency(projectData.foundationPrice || 0);
  map['SHIPPING_LOGISTICS_PRICE'] = formatCurrency(projectData.shippingPrice || 0);
  map['INSTALLATION_PRICE'] = formatCurrency(projectData.installationPrice || 0);
  map['COMPLETION_PRICE'] = formatCurrency(projectData.completionPrice || 0);
  
  map['ONSITE_DESIGN_PAYMENT'] = '5';
  map['SITE_PREP_PAYMENT'] = '15';
  map['FOUNDATION_PAYMENT'] = '25';
  map['DELIVERY_PAYMENT'] = '15';
  map['INSTALLATION_PAYMENT'] = '20';
  map['SUBSTANTIAL_COMPLETION_PAYMENT'] = '15';
  
  map['LIQUIDATED_DAMAGES_AMOUNT'] = '$500';
  map['LIQUIDATED_DAMAGES_CAP'] = '$25,000';
  
  return map;
}

function formatCurrency(value: string | number | undefined): string {
  if (value === undefined || value === null || value === '') return '$0';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '$0';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(num);
}

function formatDate(dateString: string | undefined): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

function formatAddress(projectData: Record<string, any>): string {
  const parts = [
    projectData.siteAddress,
    projectData.siteCity,
    projectData.siteState,
    projectData.siteZip
  ].filter(Boolean);
  return parts.join(', ');
}

function getEntityTypeText(entityType: string | undefined): string {
  const types: Record<string, string> = {
    'Individual': 'individual',
    'LLC': 'limited liability company',
    'Corporation': 'corporation',
    'Partnership': 'partnership',
    'Trust': 'trust'
  };
  return types[entityType || 'Individual'] || 'individual';
}

function calculateEstimatedCompletion(projectData: Record<string, any>): string {
  if (!projectData.effectiveDate) return '';
  
  const startDate = new Date(projectData.effectiveDate);
  const totalDays = (parseInt(projectData.designPhaseDays) || 0) +
                   (parseInt(projectData.manufacturingDurationDays) || 0) +
                   (parseInt(projectData.onsiteDurationDays) || 0);
  
  const completionDate = new Date(startDate);
  completionDate.setDate(completionDate.getDate() + totalDays);
  
  return formatDate(completionDate.toISOString());
}

export function getContractFilename(contractType: string, projectData: Record<string, any>): string {
  const projectNumber = projectData.projectNumber || 'DRAFT';
  const projectName = (projectData.projectName || 'Contract').replace(/[^a-z0-9]/gi, '_');
  
  const typeNames: Record<string, string> = {
    'ONE': 'ONE_Agreement',
    'MANUFACTURING': 'Manufacturing_Subcontract',
    'ONSITE': 'OnSite_Subcontract'
  };
  
  return `${projectNumber}_${projectName}_${typeNames[contractType] || contractType}.docx`;
}

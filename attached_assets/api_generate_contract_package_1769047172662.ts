// api/contracts/generate-package.ts
// Complete contract package generation endpoint for ONE Agreement + Manufacturing + On-Site subcontracts

import { Request, Response } from 'express';
import { pool } from '../../db';
import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';
import fs from 'fs';
import path from 'path';

interface ClauseData {
  id: number;
  clause_code: string;
  parent_clause_id: number | null;
  hierarchy_level: number;
  sort_order: number;
  name: string;
  category: string;
  contract_type: string;
  content: string;
  variables_used: string[];
  conditions: any;
  risk_level: string;
  negotiable: boolean;
}

interface ContractTemplate {
  id: number;
  contract_type: string;
  version: string;
  display_name: string;
  base_clause_ids: number[];
  conditional_rules: any;
  status: string;
}

interface ProjectData {
  // This will contain all the variable values
  [key: string]: any;
}

/**
 * Evaluates whether a clause's conditions are met by the project data
 */
function evaluateConditions(conditions: any, projectData: ProjectData): boolean {
  if (!conditions) return true; // No conditions means always include
  
  // Check each condition key
  for (const [key, value] of Object.entries(conditions)) {
    const projectValue = projectData[key];
    
    // Handle boolean conditions
    if (typeof value === 'boolean') {
      if (projectValue !== value) return false;
    }
    // Handle string exact match
    else if (typeof value === 'string') {
      if (projectValue !== value) return false;
    }
    // Handle array (value must be in array)
    else if (Array.isArray(value)) {
      if (!value.includes(projectValue)) return false;
    }
  }
  
  return true;
}

/**
 * Assembles the final list of clause IDs for a contract based on template and project data
 */
async function assembleContractClauses(
  template: ContractTemplate,
  projectData: ProjectData
): Promise<number[]> {
  const clauseIds = new Set<number>();
  
  // Add all base clauses
  template.base_clause_ids.forEach(id => clauseIds.add(id));
  
  // Process conditional rules
  const conditionalRules = template.conditional_rules || {};
  
  for (const [conditionKey, ruleSet] of Object.entries(conditionalRules)) {
    const projectValue = projectData[conditionKey];
    
    if (projectValue !== undefined && ruleSet[projectValue]) {
      const clausesToAdd = ruleSet[projectValue];
      clausesToAdd.forEach((id: number) => clauseIds.add(id));
    }
  }
  
  return Array.from(clauseIds).sort((a, b) => a - b);
}

/**
 * Fetches clause data from database and orders by hierarchy
 */
async function fetchClauses(clauseIds: number[]): Promise<ClauseData[]> {
  if (clauseIds.length === 0) return [];
  
  const query = `
    SELECT 
      id, clause_code, parent_clause_id, hierarchy_level, sort_order,
      name, category, contract_type, content, variables_used, conditions,
      risk_level, negotiable
    FROM clauses
    WHERE id = ANY($1)
    ORDER BY sort_order
  `;
  
  const result = await pool.query(query, [clauseIds]);
  return result.rows;
}

/**
 * Builds hierarchical document structure from flat clause list
 */
function buildDocumentStructure(clauses: ClauseData[]): string {
  let document = '';
  
  for (const clause of clauses) {
    // Add appropriate spacing and formatting based on hierarchy
    if (clause.hierarchy_level === 1) {
      // Main section - add extra spacing
      document += '\n\n';
      document += `${clause.name.toUpperCase()}\n\n`;
    } else if (clause.hierarchy_level === 2) {
      // Subsection
      document += '\n';
      document += `${clause.name}\n\n`;
    } else if (clause.hierarchy_level === 3) {
      // Paragraph - minimal spacing
      document += '\n';
    }
    
    // Add the content
    document += clause.content + '\n';
  }
  
  return document;
}

/**
 * Replaces all {{VARIABLES}} in text with actual values from projectData
 */
function replaceVariables(text: string, projectData: ProjectData): string {
  return text.replace(/\{\{([A-Z_]+)\}\}/g, (match, varName) => {
    const value = projectData[varName];
    
    if (value === undefined || value === null) {
      console.warn(`Warning: Variable ${varName} not found in project data`);
      return `[${varName}]`; // Show missing variables clearly
    }
    
    // Format based on type
    if (typeof value === 'boolean') {
      return value ? 'Yes' : 'No';
    }
    if (typeof value === 'number') {
      return value.toLocaleString();
    }
    if (value instanceof Date) {
      return value.toLocaleDateString();
    }
    
    return String(value);
  });
}

/**
 * Generates a single contract document
 */
async function generateSingleContract(
  contractType: string,
  projectData: ProjectData
): Promise<{ content: string; filename: string; clauseCount: number }> {
  // Get the template
  const templateQuery = `
    SELECT * FROM contract_templates
    WHERE contract_type = $1 AND status = 'active'
    ORDER BY effective_date DESC
    LIMIT 1
  `;
  
  const templateResult = await pool.query(templateQuery, [contractType]);
  
  if (templateResult.rows.length === 0) {
    throw new Error(`No active template found for contract type: ${contractType}`);
  }
  
  const template: ContractTemplate = templateResult.rows[0];
  
  // Assemble the clause list based on project parameters
  const clauseIds = await assembleContractClauses(template, projectData);
  
  // Fetch the actual clauses
  const clauses = await fetchClauses(clauseIds);
  
  // Build the document structure
  let documentText = buildDocumentStructure(clauses);
  
  // Replace all variables
  documentText = replaceVariables(documentText, projectData);
  
  // Generate filename
  const projectName = projectData.PROJECT_NAME || 'Unnamed';
  const sanitizedName = projectName.replace(/[^a-z0-9]/gi, '_');
  const filename = `${sanitizedName}_${contractType}_${Date.now()}.docx`;
  
  return {
    content: documentText,
    filename,
    clauseCount: clauses.length
  };
}

/**
 * Main endpoint handler
 */
export async function generateContractPackage(req: Request, res: Response) {
  try {
    const { projectId, projectData } = req.body;
    
    if (!projectData) {
      return res.status(400).json({ 
        error: 'Project data is required',
        message: 'Please provide projectData object with all required variables'
      });
    }
    
    console.log('Generating contract package for project:', projectData.PROJECT_NAME);
    
    // Add calculated/derived fields
    const enrichedData = {
      ...projectData,
      IS_CRC: projectData.SERVICE_MODEL === 'CRC',
      IS_CMOS: projectData.SERVICE_MODEL === 'CMOS',
      CONTRACT_DATE: projectData.CONTRACT_DATE || new Date().toISOString().split('T')[0]
    };
    
    // Generate all three contracts
    const contracts = await Promise.all([
      generateSingleContract('ONE', enrichedData),
      generateSingleContract('MANUFACTURING', enrichedData),
      generateSingleContract('ONSITE', enrichedData)
    ]);
    
    const [oneAgreement, manufacturing, onsite] = contracts;
    
    // For now, return the text content
    // TODO: Use docxtemplater to create actual .docx files
    
    return res.json({
      success: true,
      message: 'Contract package generated successfully',
      projectName: enrichedData.PROJECT_NAME,
      serviceModel: enrichedData.SERVICE_MODEL,
      contracts: {
        one_agreement: {
          filename: oneAgreement.filename,
          content: oneAgreement.content,
          clauseCount: oneAgreement.clauseCount
        },
        manufacturing_subcontract: {
          filename: manufacturing.filename,
          content: manufacturing.content,
          clauseCount: manufacturing.clauseCount
        },
        onsite_subcontract: {
          filename: onsite.filename,
          content: onsite.content,
          clauseCount: onsite.clauseCount
        }
      },
      generatedAt: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error generating contract package:', error);
    res.status(500).json({ 
      error: 'Failed to generate contract package',
      message: error.message
    });
  }
}

/**
 * Endpoint to preview which clauses will be included for given project parameters
 */
export async function previewContractClauses(req: Request, res: Response) {
  try {
    const { contractType, projectData } = req.body;
    
    if (!contractType || !projectData) {
      return res.status(400).json({ 
        error: 'Both contractType and projectData are required' 
      });
    }
    
    // Get the template
    const templateQuery = `
      SELECT * FROM contract_templates
      WHERE contract_type = $1 AND status = 'active'
      ORDER BY effective_date DESC
      LIMIT 1
    `;
    
    const templateResult = await pool.query(templateQuery, [contractType]);
    
    if (templateResult.rows.length === 0) {
      return res.status(404).json({ 
        error: `No active template found for: ${contractType}` 
      });
    }
    
    const template: ContractTemplate = templateResult.rows[0];
    
    // Assemble clause list
    const clauseIds = await assembleContractClauses(template, projectData);
    const clauses = await fetchClauses(clauseIds);
    
    // Organize by hierarchy
    const sections = clauses.filter(c => c.hierarchy_level === 1);
    const subsections = clauses.filter(c => c.hierarchy_level === 2);
    const paragraphs = clauses.filter(c => c.hierarchy_level === 3);
    
    // Identify conditional clauses that are included
    const conditionalIncluded = clauses.filter(c => c.conditions !== null);
    
    return res.json({
      contractType,
      template: template.display_name,
      summary: {
        totalClauses: clauses.length,
        sections: sections.length,
        subsections: subsections.length,
        paragraphs: paragraphs.length,
        conditionalIncluded: conditionalIncluded.length
      },
      conditionalClauses: conditionalIncluded.map(c => ({
        code: c.clause_code,
        name: c.name,
        conditions: c.conditions,
        category: c.category
      })),
      allClauses: clauses.map(c => ({
        code: c.clause_code,
        level: c.hierarchy_level,
        name: c.name,
        category: c.category,
        variablesUsed: c.variables_used,
        conditional: c.conditions !== null
      }))
    });
    
  } catch (error) {
    console.error('Error previewing clauses:', error);
    res.status(500).json({ 
      error: 'Failed to preview clauses',
      message: error.message
    });
  }
}

/**
 * Endpoint to get required variables for a contract type
 */
export async function getRequiredVariables(req: Request, res: Response) {
  try {
    const { contractType } = req.params;
    
    const query = `
      SELECT DISTINCT 
        cv.variable_name,
        cv.display_name,
        cv.data_type,
        cv.category,
        cv.description,
        cv.source_system,
        cv.default_value,
        cv.validation_rules
      FROM contract_variables cv
      WHERE $1 = ANY(cv.used_in_contracts)
      ORDER BY cv.category, cv.variable_name
    `;
    
    const result = await pool.query(query, [contractType.toUpperCase()]);
    
    // Group by category
    const byCategory = result.rows.reduce((acc, variable) => {
      const category = variable.category || 'other';
      if (!acc[category]) acc[category] = [];
      acc[category].push(variable);
      return acc;
    }, {});
    
    return res.json({
      contractType: contractType.toUpperCase(),
      totalVariables: result.rows.length,
      categories: Object.keys(byCategory),
      variablesByCategory: byCategory,
      allVariables: result.rows
    });
    
  } catch (error) {
    console.error('Error fetching required variables:', error);
    res.status(500).json({ 
      error: 'Failed to fetch required variables',
      message: error.message
    });
  }
}

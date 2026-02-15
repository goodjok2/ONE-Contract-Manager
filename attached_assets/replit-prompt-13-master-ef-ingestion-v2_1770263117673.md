# PROMPT 13: Ingest Master Exhibit-First ONE Agreement

## Objective
Add a new contract type "Master Exhibit-First ONE Agreement" (`MASTER_EF`) alongside the existing `ONE` agreement. This enables users to select which agreement format to use while keeping both clause trees completely separate.

## Source Document
Use the uploaded file: `Dvele_Master_FBH_Agreement_with_variables.docx`

This document has been pre-tagged with `{{VARIABLE}}` placeholders by the legal team. It uses the same Client/Company naming convention as the existing ONE Agreement for consistency.

## Pre-Ingestion Fixes Required

Before ingesting, fix these malformed tags in the DOCX:

| Issue | Location | Fix |
|-------|----------|-----|
| `{{DVELE_PARTNERS_XYZ_ENTITY_TYPE}` | Preamble | Add closing `}}` → `{{DVELE_PARTNERS_XYZ_ENTITY_TYPE}}` |
| `{{CLIENT_LEGAL_NAME}` | Preamble | Add closing `}}` → `{{CLIENT_LEGAL_NAME}}` |
| `{{$_DAYS}}` | Exhibit A.8 | Replace with `{{STORAGE_FREE_DAYS}}` |
| `{{DESIGN_FEE}` | Exhibit A.4 | Add closing `}}` → `{{DESIGN_FEE}}` (verify in document) |

### Cross-Reference Tags (XREF)

These two tags are **cross-references** to other sections of the agreement, not data variables. They need to resolve dynamically based on where sections land in the final document:

| Tag in DOCX | Purpose | Example Output |
|-------------|---------|----------------|
| `{{FEES; PAYMENT; FINANCEABILITY}}` | Reference to the Fees/Payment section | "Section 3" |
| `{{FINANCEABILITY_H}}` | Reference to bankability subsections | "Sections 3.4–3.9" |

**Rename these in the DOCX to use XREF convention:**
- `{{FEES; PAYMENT; FINANCEABILITY}}` → `{{XREF_FEES_PAYMENT_SECTION}}`
- `{{FINANCEABILITY_H}}` → `{{XREF_BANKABILITY_SUBSECTIONS}}`

The XREF resolution system (see Section 9 below) will replace these with the correct section numbers at generation time.

## Variables in Source Document

The document contains 24 unique variables. Here's the complete list with their data sources:

### Existing Variables (already in mapper.ts)
| Variable | Source | Notes |
|----------|--------|-------|
| `CLIENT_EMAIL` | party_entities | ✓ Exists |
| `CLIENT_ENTITY_TYPE` | party_entities | ✓ Exists |
| `CLIENT_LEGAL_NAME` | party_entities | ✓ Exists (fix closing brace) |
| `CLIENT_STATE` | party_entities | ✓ Exists |
| `DESIGN_FEE` | calculated | ✓ Exists |
| `DVELE_PARTNERS_XYZ_ENTITY_TYPE` | party_entities (company) | ✓ Exists (fix closing brace) |
| `DVELE_PARTNERS_XYZ_LEGAL_NAME` | party_entities (company) | ✓ Exists |
| `DVELE_PARTNERS_XYZ_STATE` | party_entities (company) | ✓ Exists |
| `EFFECTIVE_DATE` | projects.created_at | ✓ Exists |
| `ON_SITE_SERVICES_SELECTION` | projects.service_model | ✓ Exists — maps CRC→"Client Responsible", CMOS→"Company Managed" |
| `PROJECT_NAME` | projects.name | ✓ Exists |
| `PROJECT_NUMBER` | projects.project_number | ✓ Exists |
| `PROJECT_STATE` | projects.state | ✓ Exists |
| `SIGNATURE_BLOCK_TABLE` | component_library | ✓ Exists |
| `SITE_ADDRESS` | projects.site_address | ✓ Exists |

### New Variables (add to mapper.ts)
| Variable | Source | Implementation |
|----------|--------|----------------|
| `BUYER_TYPE` | projects.buyer_type | New field: 'end_customer' \| 'developer' |
| `PROJECT_TYPE` | derived | 'Single' if unit count = 1, else 'Multiple' |
| `PRODUCTION_PRICE` | calculated | Same as `OFFSITE_MANUFACTURING_COST` or alias |
| `LOGISTICS_PRICE` | calculated | New: delivery/transport portion of pricing |
| `ONSITE_PRICE` | calculated | Same as `ONSITE_CONSTRUCTION_COST` or alias |
| `TOTAL_PROJECT_PRICE` | calculated | Same as `TOTAL_CONTRACT_PRICE` or alias |
| `AD_FEE` | projects.admin_fee_percent | Format as "X%" or "none" |
| `STORAGE_FEE_PER_DAY` | projects.storage_fee_per_day | New field |
| `STORAGE_FREE_DAYS` | projects.storage_free_days | New field |
| `CLIENT_PRIMARY_CONTACT` | party_entities.contact_name | Client's primary contact person |
| `COMPANY_CONTACT` | static or config | Dvele's assigned contact |
| `COMPANY_EMAIL` | static or config | Dvele's notice email |
| `XREF_FEES_PAYMENT_FINANCEABILITY` | Cross-reference | Resolves to section number (e.g., "Section 3") |
| `XREF_FINANCEABILITY_SUBSECTIONS` | Cross-reference | Resolves to subsection range (e.g., "Sections 4.4–4.9") |

## Files to Modify

### 1. Schema Updates (`shared/schema.ts`)

Add new fields to the `projects` table:

```typescript
// In the projects table definition, add:
buyerType: text("buyer_type"), // 'end_customer' | 'developer'
storageFeePerDay: numeric("storage_fee_per_day", { precision: 10, scale: 2 }),
storageFreedays: integer("storage_free_days"),
adminFeePercent: numeric("admin_fee_percent", { precision: 5, scale: 2 }),
contractType: text("contract_type").default('ONE'), // 'ONE' | 'MASTER_EF'
```

Run migration after schema update.

### 2. Contract Type Selector (Wizard Step 1)

In `client/src/components/wizard/steps/Step1ProjectInfo.tsx`, add a contract type selector at the top of the form:

```tsx
<div className="form-group">
  <label>Agreement Type</label>
  <select 
    value={formData.contractType || 'ONE'}
    onChange={(e) => updateFormData({ contractType: e.target.value })}
  >
    <option value="ONE">ONE Agreement (Current)</option>
    <option value="MASTER_EF">Master Exhibit-First Agreement</option>
  </select>
  <p className="help-text">
    The Master Exhibit-First Agreement consolidates all deal terms into Exhibit A.
  </p>
</div>
```

Also add the new fields for MASTER_EF projects:

```tsx
{formData.contractType === 'MASTER_EF' && (
  <>
    <div className="form-group">
      <label>Buyer Type</label>
      <select
        value={formData.buyerType || 'end_customer'}
        onChange={(e) => updateFormData({ buyerType: e.target.value })}
      >
        <option value="end_customer">End Customer</option>
        <option value="developer">Developer</option>
      </select>
    </div>
    
    <div className="form-group">
      <label>Storage Fee ($/day)</label>
      <input
        type="number"
        value={formData.storageFeePerDay || ''}
        onChange={(e) => updateFormData({ storageFeePerDay: e.target.value })}
        placeholder="e.g., 150"
      />
    </div>
    
    <div className="form-group">
      <label>Free Storage Days</label>
      <input
        type="number"
        value={formData.storageFreedays || ''}
        onChange={(e) => updateFormData({ storageFreedays: e.target.value })}
        placeholder="e.g., 14"
      />
    </div>
    
    <div className="form-group">
      <label>Admin Fee %</label>
      <input
        type="number"
        step="0.1"
        value={formData.adminFeePercent || ''}
        onChange={(e) => updateFormData({ adminFeePercent: e.target.value })}
        placeholder="e.g., 5"
      />
    </div>
  </>
)}
```

### 3. Variable Mapper Updates (`server/lib/mapper.ts`)

Add the new variables to the `buildVariableMap` function:

```typescript
// Inside buildVariableMap(), add these new mappings:

// Project type (Single vs Multiple)
const unitCount = projectUnits?.length || 1;
BUYER_TYPE: project.buyerType === 'developer' ? 'Developer' : 'End Customer',
PROJECT_TYPE: unitCount === 1 ? 'Single' : 'Multiple',

// Pricing aliases for MASTER_EF naming
PRODUCTION_PRICE: formatCurrency(totals.offsiteTotal),
LOGISTICS_PRICE: formatCurrency(totals.logisticsTotal || 0), // Add logistics calculation
ONSITE_PRICE: formatCurrency(totals.onsiteTotal),
TOTAL_PROJECT_PRICE: formatCurrency(totals.grandTotal),

// Admin/storage fees
AD_FEE: project.adminFeePercent ? `${project.adminFeePercent}%` : 'none',
STORAGE_FEE_PER_DAY: formatCurrency(project.storageFeePerDay || 0),
STORAGE_FREE_DAYS: String(project.storageFreedays || 0),

// Contact info
CLIENT_PRIMARY_CONTACT: getPartyContact(project, 'client') || '[Contact Name]',
COMPANY_CONTACT: 'Dvele Project Manager', // Or pull from config/assignment
COMPANY_EMAIL: 'contracts@dvele.com', // Or pull from config
```

### 4. Contract Generator Updates (`server/lib/contractGenerator.ts`)

Modify clause and exhibit fetching to filter by contract type:

```typescript
// Update fetchClausesForProject to accept contractType parameter
async function fetchClausesForProject(projectId: number, contractType: string = 'ONE') {
  const projectClauses = await db.query.clauses.findMany({
    where: sql`${clauses.contractTypes} @> ${JSON.stringify([contractType])}::jsonb`,
    orderBy: [asc(clauses.order)],
  });
  
  return projectClauses;
}

// Update fetchExhibitsForProject similarly
async function fetchExhibitsForProject(projectId: number, contractType: string = 'ONE') {
  const projectExhibits = await db.query.exhibits.findMany({
    where: sql`${exhibits.contractTypes} @> ${JSON.stringify([contractType])}::jsonb`,
    orderBy: [asc(exhibits.sortOrder)],
  });
  
  return projectExhibits;
}

// In the main generateContract function, get contractType from project:
const contractType = project.contractType || 'ONE';
const projectClauses = await fetchClausesForProject(projectId, contractType);
const projectExhibits = await fetchExhibitsForProject(projectId, contractType);
```

### 5. Clause Ingestion Script

Create `server/scripts/ingest-master-ef-agreement.ts`:

```typescript
/**
 * Ingests the Master Exhibit-First ONE Agreement from the pre-tagged DOCX.
 * 
 * Source: Dvele_Master_FBH_Agreement_with_variables.docx
 * Contract Type: MASTER_EF
 * 
 * Key differences from ONE Agreement:
 * - 6 exhibits (A-F) instead of 7 (A-G)
 * - Exhibit A is the consolidated "deal sheet"
 * - Same Client/Company naming convention
 */

import { db } from '../db';
import { clauses, exhibits } from '../../shared/schema';
import mammoth from 'mammoth';
import * as fs from 'fs';
import * as path from 'path';

const DOCX_PATH = path.join(__dirname, '../templates/Dvele_Master_FBH_Agreement_with_variables.docx');

// Section hierarchy for MASTER_EF body
const SECTIONS = [
  { name: 'AGREEMENT CONSTRUCTION', level: 1, order: 100 },
  { name: 'SERVICES; SCOPE; CHANGE CONTROL', level: 1, order: 200 },
  { name: 'FEES; PAYMENT; FINANCEABILITY', level: 1, order: 300 },
  { name: 'BUYER RESPONSIBILITIES', level: 1, order: 400 },
  { name: 'DVELE RESPONSIBILITIES; INSURANCE', level: 1, order: 500 },
  { name: 'SCHEDULE; DELAYS; FORCE MAJEURE; PRICING ADJUSTMENTS', level: 1, order: 600 },
  { name: 'LIMITED WARRANTY; DISCLAIMER; REMEDIES', level: 1, order: 700 },
  { name: 'INTELLECTUAL PROPERTY; LICENSE; PUBLICITY', level: 1, order: 800 },
  { name: 'LIMITATION OF LIABILITY', level: 1, order: 900 },
  { name: 'MILESTONE REVIEW; NO OBLIGATION; CLARIFICATION', level: 1, order: 1000 },
  { name: 'DEFAULT; TERMINATION; EFFECTS', level: 1, order: 1100 },
  { name: 'DISPUTE RESOLUTION; GOVERNING LAW', level: 1, order: 1200 },
  { name: 'MISCELLANEOUS', level: 1, order: 1300 },
];

// Exhibit configuration for MASTER_EF (6 exhibits, not 7)
const EXHIBITS_CONFIG = [
  { code: 'A', name: 'Project Scope and Commercial Terms', order: 1 },
  { code: 'B', name: 'Home Plans, Specifications & Finishes', order: 2 },
  { code: 'C', name: 'GC / On-Site Scope & Responsibility Matrix', order: 3 },
  { code: 'D', name: 'Milestones & Schedule', order: 4 },
  { code: 'E', name: 'Limited Warranty', order: 5 },
  { code: 'F', name: 'State-Specific Provisions', order: 6 },
];

async function ingestMasterEFAgreement() {
  console.log('=== Starting Master Exhibit-First Agreement Ingestion ===');
  console.log(`Source: ${DOCX_PATH}`);
  
  // 1. Verify source file exists
  if (!fs.existsSync(DOCX_PATH)) {
    throw new Error(`Source DOCX not found: ${DOCX_PATH}`);
  }
  
  // 2. Parse DOCX to HTML
  const docxBuffer = fs.readFileSync(DOCX_PATH);
  const result = await mammoth.convertToHtml({ buffer: docxBuffer });
  const html = result.value;
  
  console.log(`Parsed DOCX: ${html.length} characters`);
  
  // 3. Split into sections and clauses
  // Implementation: Use heading detection to split body into sections
  // Each section becomes a level-1 clause with contract_types = ['MASTER_EF']
  
  // 4. Insert body clauses
  console.log('Inserting body clauses...');
  // ... clause insertion logic here
  // IMPORTANT: All clauses must have contract_types = '["MASTER_EF"]'::jsonb
  
  // 5. Insert exhibits
  console.log('Inserting exhibits...');
  for (const exhibit of EXHIBITS_CONFIG) {
    await db.insert(exhibits).values({
      exhibitCode: exhibit.code,
      name: exhibit.name,
      contractTypes: ['MASTER_EF'],
      sortOrder: exhibit.order,
      bodyHtml: '', // Will be populated by exhibit content extraction
    }).onConflictDoNothing();
    
    console.log(`  Inserted Exhibit ${exhibit.code}: ${exhibit.name}`);
  }
  
  console.log('=== Ingestion Complete ===');
}

// Run
ingestMasterEFAgreement()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Ingestion failed:', err);
    process.exit(1);
  });
```

### 6. Seed Data: MASTER_EF Exhibits

Create `server/seeds/seed-master-ef-exhibits.sql`:

```sql
-- Master Exhibit-First Agreement: 6 Exhibits (A-F)
-- Note: Exhibit G (State-Specific) is now Exhibit F

INSERT INTO exhibits (exhibit_code, name, contract_types, sort_order, body_html) VALUES
('A', 'Project Scope and Commercial Terms', '["MASTER_EF"]'::jsonb, 1, '
<h2>EXHIBIT A — PROJECT SCOPE AND COMMERCIAL TERMS</h2>

<h3>A.1 Project Overview</h3>
<table class="exhibit-table">
  <tr><td>Buyer Type</td><td>{{BUYER_TYPE}}</td></tr>
  <tr><td>Project Name</td><td>{{PROJECT_NAME}}</td></tr>
  <tr><td>Properties</td><td>{{PROJECT_TYPE}}</td></tr>
  <tr><td>Completion Model</td><td>{{ON_SITE_SERVICES_SELECTION}}</td></tr>
  <tr><td>Jurisdiction(s)</td><td>{{PROJECT_STATE}}</td></tr>
  <tr><td>Site(s)</td><td>{{SITE_ADDRESS}}</td></tr>
  <tr><td>Client Notice Address / Email</td><td>{{CLIENT_EMAIL}}</td></tr>
  <tr><td>Company Notice Address / Email</td><td>{{COMPANY_EMAIL}}</td></tr>
</table>

<h3>A.2 Property & Phase Matrix</h3>
{{PROPERTY_PHASE_MATRIX_TABLE}}

<h3>A.3 Scope Summary</h3>
{{SCOPE_SUMMARY_TABLE}}

<h3>A.4 Pricing Summary</h3>
<table class="exhibit-table pricing">
  <tr><th>Stage / Component</th><th>Amount</th><th>Notes</th></tr>
  <tr><td>Design / Pre-Production Fee</td><td>{{DESIGN_FEE}}</td><td>Due at signing</td></tr>
  <tr><td>Production Price (Factory)</td><td>{{PRODUCTION_PRICE}}</td><td>Per Phase</td></tr>
  <tr><td>Logistics</td><td>{{LOGISTICS_PRICE}}</td><td>Delivery/transport</td></tr>
  <tr><td>On-Site (if Company Managed)</td><td>{{ONSITE_PRICE}}</td><td>Only if CMOS</td></tr>
  <tr><td>Admin Fee</td><td>{{AD_FEE}}</td><td>On reimbursables</td></tr>
  <tr><th>Total Project Price</th><th>{{TOTAL_PROJECT_PRICE}}</th><th>Subject to Change Orders</th></tr>
</table>

<h3>A.5 Milestones & Payment Schedule</h3>
{{MILESTONE_PAYMENT_TABLE}}

<h3>A.6 Green Light Conditions</h3>
<p>Production for each Phase begins only upon satisfaction of Green Light Conditions including final design approvals, proof of site control, GC engagement (if applicable), permit status, proof of funds, and receipt of Green Light deposit.</p>

<h3>A.7 Reporting and Meetings</h3>
<p>Primary contacts: Client {{CLIENT_PRIMARY_CONTACT}}; Company {{COMPANY_CONTACT}}</p>

<h3>A.8 Special Commercial Terms</h3>
<p>Storage fees if site not ready: ${{STORAGE_FEE_PER_DAY}}/day after {{STORAGE_FREE_DAYS}} days free</p>

{{EXHIBIT_A_SIGNATURE_TABLE}}
'),

('B', 'Home Plans, Specifications & Finishes', '["MASTER_EF"]'::jsonb, 2, '
<h2>EXHIBIT B — HOME PLANS, SPECIFICATIONS & FINISHES</h2>

<h3>B.1 Plan Set Index</h3>
{{PLAN_SET_INDEX_TABLE}}

<h3>B.2 Specifications</h3>
<p>See attached specification schedules.</p>

<h3>B.3 Change Control</h3>
<p>Changes that materially affect cost, schedule, or milestone timing require an Exhibit A amendment or Change Order signed by both Parties.</p>
'),

('C', 'GC / On-Site Scope & Responsibility Matrix', '["MASTER_EF"]'::jsonb, 3, '
<h2>EXHIBIT C — GC / ON-SITE SCOPE & RESPONSIBILITY MATRIX</h2>

{{BLOCK_GC_INFO_SECTION}}

<h3>C.2 Responsibility Allocation Matrix</h3>
{{RESPONSIBILITY_MATRIX_TABLE}}

<h3>C.3 Site Readiness Requirements</h3>
<p>Client/GC must provide written confirmation that foundation meets tolerances, utility stubs are placed, access routes are ready, permits are scheduled, and site is safe and secured.</p>

<h3>C.4 Interfaces & Dependencies</h3>
{{INTERFACES_TABLE}}
'),

('D', 'Milestones & Schedule', '["MASTER_EF"]'::jsonb, 4, '
<h2>EXHIBIT D — MILESTONES & SCHEDULE</h2>

<h3>D.1 Design / Pre-Production Milestones</h3>
{{DESIGN_MILESTONES_TABLE}}

<h3>D.2 Production Milestones</h3>
{{PRODUCTION_MILESTONES_TABLE}}

<h3>D.3 Schedule Dependencies</h3>
<p>Schedule adjustments occur for: permitting timelines, production slot changes, supply constraints, Client approvals, GC readiness, site readiness, and force majeure.</p>
'),

('E', 'Limited Warranty', '["MASTER_EF"]'::jsonb, 5, '
<h2>EXHIBIT E — LIMITED WARRANTY</h2>

<p class="conspicuous">PURSUANT TO CAL. COM. CODE § 1201(b)(10), THIS SECTION CHANGES YOUR EXISTING WARRANTY RIGHTS UNDER CALIFORNIA LAW. PLEASE READ CAREFULLY.</p>

<h3>Warranty Scope</h3>
<table class="exhibit-table">
  <tr><th>Warranty Type</th><th>Duration</th><th>Covered Components</th></tr>
  <tr><td>Fit and Finish</td><td>2 Years</td><td>Interior/exterior finishes</td></tr>
  <tr><td>Building Envelope</td><td>5 Years</td><td>Roof, exterior walls, foundation system</td></tr>
  <tr><td>Structural</td><td>10 Years</td><td>Structural frame, floor structure, load-bearing walls</td></tr>
  <tr><td>Systems</td><td>2 Years</td><td>Plumbing, Electrical, HVAC</td></tr>
</table>

<h3>Exclusions</h3>
<p>This warranty does not cover: cosmetic issues not affecting functionality, damage caused by others, normal wear and tear, modifications without approval, acts of God, or commercial/rental use unless approved.</p>
'),

('F', 'State-Specific Provisions', '["MASTER_EF"]'::jsonb, 6, '
<h2>EXHIBIT F — STATE-SPECIFIC PROVISIONS</h2>

<h3>F.1 Applicability</h3>
<p>This Exhibit applies only if and to the extent required by applicable law for the Property jurisdiction identified in Exhibit A.</p>

<h3>F.2 Consumer / Statutory Notices</h3>
{{STATE_DISCLOSURES}}

<h3>F.3 Priority</h3>
<p>If a state-required provision conflicts with the Agreement, the state-required provision controls only to the minimum extent required by law.</p>
')
ON CONFLICT (exhibit_code, contract_types) DO UPDATE SET
  name = EXCLUDED.name,
  body_html = EXCLUDED.body_html,
  sort_order = EXCLUDED.sort_order;
```

### 7. Block Components for MASTER_EF

Add to component_library for conditional GC info section:

```sql
-- GC Info Section (only shows for CRC / Client Responsible model)
INSERT INTO component_library (tag_name, service_model, content) VALUES
('BLOCK_GC_INFO_SECTION', 'CRC', '
<h3>C.1 Parties / GC Information</h3>
<table class="exhibit-table">
  <tr><td>GC Legal Name</td><td>{{ONSITE_CONTRACTOR_LEGAL_NAME}}</td></tr>
  <tr><td>License No.</td><td>{{ONSITE_CONTRACTOR_LICENSE_NUMBER}} State: {{ONSITE_CONTRACTOR_LICENSE_STATE}}</td></tr>
  <tr><td>Insurance</td><td>GL ${{ONSITE_CONTRACTOR_INSURANCE_AMOUNT}}, WC per law</td></tr>
</table>
'),
('BLOCK_GC_INFO_SECTION', 'CMOS', '<!-- GC info not applicable for Company Managed model -->');
```

### 8. Table Definitions for MASTER_EF

```sql
-- Dynamic tables for MASTER_EF Exhibit A
INSERT INTO table_definitions (tag_name, table_type, columns, contract_types) VALUES
('PROPERTY_PHASE_MATRIX_TABLE', 'dynamic', 
 '["Property ID", "Site Address", "Phase", "Home/Model", "Est. Factory Start", "Est. Delivery"]',
 '["MASTER_EF"]'::jsonb),
 
('SCOPE_SUMMARY_TABLE', 'static',
 '["Phase", "Company Deliverables", "Client/GC Deliverables"]',
 '["MASTER_EF"]'::jsonb),
 
('MILESTONE_PAYMENT_TABLE', 'dynamic',
 '["Property", "Phase", "Payment", "Trigger", "Amount", "Due"]',
 '["MASTER_EF"]'::jsonb),

('INTERFACES_TABLE', 'static',
 '["Interface Item", "Providing Party", "Receiving Party", "Deadline"]',
 '["MASTER_EF"]'::jsonb),

('DESIGN_MILESTONES_TABLE', 'template',
 '["Milestone", "Deliverable", "Client Inputs", "Review Period", "Target Date"]',
 '["MASTER_EF"]'::jsonb),

('PRODUCTION_MILESTONES_TABLE', 'dynamic',
 '["Milestone", "Trigger", "Certification", "Target Date"]',
 '["MASTER_EF"]'::jsonb)
ON CONFLICT DO NOTHING;
```

## Verification Steps

After implementation, run these checks:

### 1. Schema Migration
```bash
npm run db:push
# Verify new columns exist:
# - projects.buyer_type
# - projects.storage_fee_per_day
# - projects.storage_free_days
# - projects.admin_fee_percent
# - projects.contract_type
```

### 2. Check Clause Separation
```sql
SELECT contract_types, COUNT(*) as clause_count 
FROM clauses 
GROUP BY contract_types;

-- Expected:
-- ["ONE"]      | ~80+ clauses
-- ["MASTER_EF"]| ~40+ clauses (fewer due to consolidated structure)
```

### 3. Check Exhibit Separation
```sql
SELECT exhibit_code, name, contract_types 
FROM exhibits 
ORDER BY contract_types, sort_order;

-- Expected:
-- ONE: A, B, C, D, E, F, G (7 exhibits)
-- MASTER_EF: A, B, C, D, E, F (6 exhibits)
```

### 4. Generate Test Contract
1. Create a new project in the wizard
2. In Step 1, select "Master Exhibit-First Agreement"
3. Fill in Buyer Type, Storage Fee, etc.
4. Complete wizard and generate PDF
5. Verify:
   - Document title is "Master Factory Built Home Agreement"
   - Uses "Client" and "Company" (not "Buyer" and "Dvele")
   - Only 6 exhibits (A-F, no G)
   - Exhibit A contains the consolidated deal sheet
   - All variables are resolved (no `{{VARIABLE}}` in output)

### 5. Verify ONE Agreement Still Works
1. Create another project
2. Select "ONE Agreement (Current)"
3. Generate PDF
4. Confirm identical behavior to before this change

## Important Notes

- **Do NOT modify existing ONE clauses** — only add new MASTER_EF entries
- **The `contract_types` field is JSONB** — always use `'["MASTER_EF"]'::jsonb` syntax
- **Keep Client/Company naming** — internal consistency with existing system; the agreement text uses these terms
- **Service model codes unchanged** — CRC and CMOS internally, displayed as "Client Responsible" and "Company Managed"
- **State disclosures reuse existing system** — Exhibit F (MASTER_EF) = Exhibit G (ONE) functionality
- **Copy source DOCX to templates folder** — `server/templates/Dvele_Master_FBH_Agreement_with_variables.docx`

## 9. Cross-Reference (XREF) Resolution System

The agreement contains references to other sections that must resolve dynamically. When sections move, these references update automatically.

### How It Works

1. **Each clause gets a `slug`** — a stable identifier that never changes (e.g., `FEES_PAYMENT_FINANCEABILITY`)
2. **XREF tags reference slugs** — `{{XREF_FEES_PAYMENT_SECTION}}` looks up the slug
3. **After `applyDynamicNumbering()`** — build a lookup map: `{ slug: dynamicNumber }`
4. **Replace XREF tags** — substitute `{{XREF_*}}` with resolved numbers

### Implementation

Add to `server/lib/contractGenerator.ts`:

```typescript
/**
 * Build a map of clause slugs to their dynamic numbers.
 * Called after applyDynamicNumbering() has assigned numbers to all nodes.
 */
function buildXRefMap(blockTree: BlockNode[]): Record<string, string> {
  const xrefMap: Record<string, string> = {};
  
  function traverse(nodes: BlockNode[]) {
    for (const node of nodes) {
      if (node.clause.slug && node.dynamicNumber) {
        xrefMap[node.clause.slug] = node.dynamicNumber;
      }
      if (node.children.length > 0) {
        traverse(node.children);
      }
    }
  }
  
  traverse(blockTree);
  return xrefMap;
}

/**
 * Resolve {{XREF_*}} tags in content using the xref map.
 */
function resolveXRefTags(content: string, xrefMap: Record<string, string>): string {
  return content.replace(/\{\{XREF_([A-Z_]+)\}\}/g, (match, slug) => {
    const number = xrefMap[slug];
    if (number) {
      return `Section ${number}`;
    }
    console.warn(`XREF not found: ${slug}`);
    return match; // Leave unreplaced if not found
  });
}
```

### Clause Slugs for MASTER_EF

Add these slugs to the MASTER_EF clauses:

| Clause | Slug | Example Output |
|--------|------|----------------|
| FEES; PAYMENT; FINANCEABILITY (Section 3) | `FEES_PAYMENT_SECTION` | "Section 3" |
| Irrevocable Payment (3.4) | `IRREVOCABLE_PAYMENT` | "Section 3.4" |
| No Setoff (3.5) | `NO_SETOFF` | "Section 3.5" |
| Assignment/Financing (3.8) | `ASSIGNMENT_FINANCING` | "Section 3.8" |
| Financing Party Cure (3.9) | `FINANCING_PARTY_CURE` | "Section 3.9" |

### XREF Tags in MASTER_EF

| XREF Tag | Resolves To | Used In |
|----------|-------------|---------|
| `{{XREF_FEES_PAYMENT_SECTION}}` | "Section 3" | Miscellaneous (referencing payment terms) |
| `{{XREF_BANKABILITY_SUBSECTIONS}}` | "Sections 3.4–3.9" | Miscellaneous (no amendment without consent) |

### Special Case: Section Ranges

For ranges like "Sections 3.4–3.9", use a compound XREF:

```typescript
// In mapper or as a special XREF handler:
XREF_BANKABILITY_SUBSECTIONS: `Sections ${xrefMap['IRREVOCABLE_PAYMENT']}–${xrefMap['FINANCING_PARTY_CURE']}`
```

Or define it as a single slug on a parent clause that encompasses 3.4–3.9.

## Deliverables Checklist

- [ ] Fix malformed tags in source DOCX (4 fixes listed above)
- [ ] Rename XREF tags in DOCX (`{{FEES; PAYMENT...}}` → `{{XREF_FEES_PAYMENT_SECTION}}`, etc.)
- [ ] Copy fixed DOCX to `server/templates/`
- [ ] Schema migration with new project fields
- [ ] Contract type selector in Wizard Step 1
- [ ] Conditional fields for MASTER_EF in Step 1
- [ ] Variable mapper updates (11 new variables + 2 XREF)
- [ ] Contract generator filtering by contract_type
- [ ] XREF resolution system (`buildXRefMap`, `resolveXRefTags`)
- [ ] Clause ingestion script with slugs for XREF targets
- [ ] Exhibit seed SQL (6 exhibits)
- [ ] Block components for conditional GC section
- [ ] Table definitions for new dynamic tables
- [ ] Verification queries pass
- [ ] Test PDF generation for both contract types
- [ ] Verify XREF tags resolve correctly when sections move

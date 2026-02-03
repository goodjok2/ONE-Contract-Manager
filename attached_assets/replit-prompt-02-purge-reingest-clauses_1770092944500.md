# PROMPT 2: Purge and Re-Ingest All Contract Clauses

## Context

The current clause library (236 clauses) was ingested incorrectly. The problems are:

1. **Content in wrong field**: Clause text is stored in the `name` column. The `content` column (which is what the contract generator reads) is empty/null for most clauses. This is why contracts render blank.
2. **Over-atomized**: Individual bullet items, table rows, and sub-paragraphs were split into separate clause records when they should be part of their parent clause's content. For example, the pricing breakdown line items (Design & Engineering, Offsite Services, On-Site Services) are separate clauses when they should be bullets within the "total preliminary project cost" clause.
3. **HTML entity corruption**: `&amp;` appears literally in text instead of `&`. The parser HTML-encoded the content but nothing decodes it.
4. **Flat hierarchy**: All clauses are at the same level instead of proper section → subsection → paragraph nesting.
5. **No HTML formatting in content**: All content is plain text. The contract generator renders content as HTML, so clauses need proper `<p>`, `<ul>`, `<li>`, `<strong>`, `<table>` tags to produce professional output.

## What To Do

### Step 1: Purge Existing Clause Data

Run these SQL statements to clear the slate:

```sql
DELETE FROM contract_templates;
DELETE FROM clauses;
-- Keep contract_variables, we'll update those separately
```

### Step 2: Build a Proper DOCX-to-Clauses Parser

Create a server-side endpoint or script that parses the uploaded DOCX files using `mammoth` (for HTML conversion) or `docx` (for structured extraction). The parser should:

#### 2A: Parse the DOCX into structured HTML

Use `mammoth` to convert each DOCX file to HTML. Mammoth preserves:
- Bold/italic formatting as `<strong>` and `<em>`
- Headings as `<h1>`, `<h2>`, etc.
- Bullet lists as `<ul><li>`
- Numbered lists as `<ol><li>`
- Tables as `<table><tr><td>`

Install mammoth if not already present: `npm install mammoth`

#### 2B: Split HTML into clause records by section structure

The parser needs to understand the document structure of each contract type:

**ONE Agreement structure:**
- DOCUMENT SUMMARY (preamble, hierarchy_level 1)
- RECITALS (hierarchy_level 1)
  - Recital A through Recital J (hierarchy_level 2)
  - Recital G has Option A (CRC) and Option B (CMOS) — these are conditional clauses
- ATTACHMENTS (hierarchy_level 1)
- SECTION 1. SCOPE OF SERVICES (hierarchy_level 1)
  - 1.1 through 1.6 (hierarchy_level 2)
    - Sub-paragraphs within each subsection (hierarchy_level 3, kept as part of parent's content)
- SECTION 2. FEES, PURCHASE PRICE, AND PAYMENT TERMS (hierarchy_level 1)
  - 2.1 through 2.10 (hierarchy_level 2)
- SECTION 3 through SECTION 13 (same pattern)
- EXHIBITS A through F (hierarchy_level 1)

**Manufacturing Subcontract structure:**
- RECITALS
- ARTICLE 1 through ARTICLE 10
  - Numbered subsections within each article

**OnSite Installation Subcontract structure:**
- RECITALS
- ARTICLE 1 through ARTICLE 10 (or similar)
  - Numbered subsections within each article

#### 2C: For each clause record, store:

```typescript
{
  clauseCode: string,       // e.g., "ONE-REC-G-OPT-A", "ONE-1.2", "MFG-3.1"
  parentClauseId: number,   // ID of parent section clause (null for top-level)
  hierarchyLevel: number,   // 1=section, 2=subsection, 3=paragraph
  sortOrder: number,        // Sequential ordering (100, 110, 120 for section 1 subsections, etc.)
  name: string,             // SHORT title only: "Section 1. Scope of Services" or "1.2. Design Phase"
  category: string,         // 'preamble', 'recitals', 'scope', 'payment', 'warranty', etc.
  contractType: string,     // 'ONE', 'MANUFACTURING', 'ONSITE'
  content: string,          // THE FULL HTML CONTENT of the clause including all sub-paragraphs,
                            // bullet lists, tables, and formatting. This is the critical field.
  variablesUsed: string[],  // Array of variable names found via regex: /\{\{([A-Z_0-9]+)\}\}/g
  conditions: object|null,  // JSONB: { "ON_SITE_SERVICES_SELECTION": "CRC" } for conditional clauses
  riskLevel: string,        // 'low', 'medium', 'high'
  negotiable: boolean,      // true for most, false for core legal terms
}
```

### Critical Rules for Content Parsing

1. **The `content` field must contain the full clause body as HTML.** This is the most important thing. Every clause must have substantial content in this field. The `name` field is just a short label for the UI.

2. **Do NOT split bullet items or table rows into separate clauses.** If a section says "which includes:" followed by bullet points, those bullets are part of that clause's `content`, not separate clause records. For example:

   WRONG (current state):
   ```
   Clause 36: name="WHEREAS, the total preliminary project cost is {{PRELIMINARY_CONTRACT_PRICE}}, which includes:", content=""
   Clause 37: name="Design and Engineering: {{DESIGN_FEE}}", content=""
   Clause 38: name="Offsite Services: {{PRELIMINARY_OFFSITE_PRICE}}", content=""
   Clause 39: name="If included, On-Site Services: {{PRELIMINARY_ONSITE_PRICE}}", content=""
   ```

   RIGHT:
   ```
   Clause: name="Recital H - Total Preliminary Project Cost",
           clauseCode="ONE-REC-H",
           content="<p>WHEREAS, the total preliminary project cost is {{PRELIMINARY_CONTRACT_PRICE}}, which includes:</p>
                    <ul>
                      <li>Design and Engineering: {{DESIGN_FEE}}</li>
                      <li>Offsite Services: {{PRELIMINARY_OFFSITE_PRICE}}</li>
                      <li>If included, On-Site Services: {{PRELIMINARY_ONSITE_PRICE}}</li>
                    </ul>"
   ```

3. **Decode HTML entities.** `&amp;` should be `&` in the stored content. The contract generator handles HTML escaping at render time.

4. **Preserve {{VARIABLE_NAME}} placeholders exactly as-is.** Do not resolve, remove, or alter variable placeholders. They get substituted at contract generation time.

5. **CRC/CMOS conditional clauses** get separate records with the `conditions` field set:
   - Recital G Option A (CRC): `conditions = {"ON_SITE_SERVICES_SELECTION": "CRC"}`
   - Recital G Option B (CMOS): `conditions = {"ON_SITE_SERVICES_SELECTION": "CMOS"}`
   - Same pattern for any section that has CRC-only or CMOS-only paragraphs
   - Clauses with `-CRC` or `-CMOS` in their clauseCode are conditional

6. **Tables in content should use HTML table markup:**
   ```html
   <table>
     <thead><tr><th>Phase</th><th>Description</th><th>Client Pays</th></tr></thead>
     <tbody>
       <tr><td>Design & Engineering</td><td>Work starts after signing...</td><td>Design Fee (Paid at Signing)</td></tr>
     </tbody>
   </table>
   ```

7. **The split boundary is at the SECTION or SUBSECTION level, not the paragraph level.** A single clause record for "Section 1.2 Design Phase" should contain ALL the paragraphs, bullets, tables, and sub-items within that subsection as HTML in the `content` field.

### Step 3: Set sort_order for Proper Assembly

Use a spacing scheme that allows future insertions:
- ONE Agreement: Preamble=100, Recitals=200-290, Attachments=300, Section 1=1000-1090, Section 2=2000-2090, ..., Section 13=13000-13090, Exhibits=14000+
- MANUFACTURING: Recitals=100, Article 1=1000-1090, Article 2=2000-2090, etc.
- ONSITE: Same pattern as Manufacturing

### Step 4: Extract and Store variables_used

For each clause, scan the `content` field with regex `/\{\{([A-Z_0-9]+)\}\}/g` and store the unique variable names as an array in `variables_used`. This enables the pre-flight validation that checks whether all variables are resolved before PDF generation.

### Step 5: Rebuild contract_templates

After all clauses are inserted, run the template seed logic to populate `base_clause_ids`:

For each contract type (ONE, MANUFACTURING, ONSITE):
1. Create a template row in `contract_templates`
2. Set `base_clause_ids` = array of clause IDs for that contract type, EXCLUDING CRC-only and CMOS-only clauses (those go in conditional_rules)
3. Set `conditional_rules` as JSONB mapping conditions to clause ID arrays:
   ```json
   {
     "SERVICE_MODEL": {
       "CRC": [id1, id2, ...],
       "CMOS": [id3, id4, ...]
     }
   }
   ```

### Step 6: Create the Ingestion UI

Add a page or section in Settings where I can:
1. Upload a DOCX file
2. Select the contract type (ONE, MANUFACTURING, ONSITE)
3. Click "Parse & Import"
4. See a preview of the parsed clauses (name, hierarchy, content preview) before committing
5. Click "Confirm Import" to insert into the database
6. After import, auto-rebuild the contract_templates for that contract type

Also add a "Purge & Re-import" button that deletes all clauses for a specific contract type and re-imports from the uploaded file.

## Source Files

The three DOCX source files are already in the project:
- `attached_assets/7._26-00X_Project_Name_-_Dvele_ONE_Agreement_1769049836636.docx` (ONE Agreement)
- `attached_assets/8._Manufacturing_Subcontractor_Agreement_-_Company_to_Dvele_M_1769052367912.docx` (Manufacturing)
- `attached_assets/9._On-Site_Installation_Subcontractor_Agreement_-_Company_to__1769052367913.docx` (OnSite)

## Verification

After this prompt is complete, I should be able to:

1. Open the Clause Explorer and see clauses with:
   - Short, descriptive `name` values (e.g., "Section 1.2 Design Phase")
   - Full HTML `content` with paragraphs, bullets, tables, bold text
   - Proper hierarchy (sections at level 1, subsections at level 2)
   - No `&amp;` corruption
   - No `(No Content)` indicators

2. The clause count should be approximately:
   - ONE Agreement: ~80-120 clauses (sections + subsections, NOT individual paragraphs)
   - MANUFACTURING: ~40-60 clauses
   - ONSITE: ~40-60 clauses

3. `contract_templates` should have 3 rows with populated `base_clause_ids`

4. Contract preview should show full clause content rendered as formatted HTML

## Do NOT

- Do not keep any of the existing 236 clauses — purge them all
- Do not split individual paragraphs, bullets, or table rows into separate clause records
- Do not store content in the `name` field — `name` is a short label, `content` is the body
- Do not strip HTML formatting — the contract generator renders HTML, so preserve it
- Do not remove or alter `{{VARIABLE_NAME}}` placeholders
- Do not change the database schema — the existing `clauses` and `contract_templates` tables are correct

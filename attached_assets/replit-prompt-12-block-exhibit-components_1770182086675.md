# Replit Agent Prompt 12: Author Missing BLOCK Exhibit Components

## Context
We are working on the ONE Contract Manager. The contract generator resolves `{{BLOCK_*}}` tags by looking up CRC/CMOS-specific content from the `component_library` table. Three BLOCK tags exist in the ONE Agreement Exhibits DOCX but have no matching records in `component_library`, causing them to remain as unresolved placeholders in generated contracts.

The existing 12 components in `component_library` (6 tag names × CRC/CMOS) cover clause-body blocks. These 3 new blocks cover exhibit-specific CRC/CMOS conditional content.

## RULES
1. **Only add rows to `component_library`.** Do not modify any existing code or components.
2. **Do not modify `WizardContext.tsx` or `WizardShell.tsx`.**
3. **Follow the exact same structure** as the existing components (tag_name, service_model, description, content, is_system=false).
4. **Content must be valid HTML** — same format as existing blocks in `seed-components.ts`.

---

## New Components to Add (6 rows: 3 tags × CRC/CMOS)

### 1. `BLOCK_ON_SITE_SCOPE_EXHIBIT_A` — Exhibit A: Project Budget

**Context:** This block appears in Exhibit A between "Offsite total price" and "PRELIMINARY TOTAL CONTRACT PRICE". It controls how on-site pricing is presented in the budget summary.

**CRC variant:**
```html
<p><strong>On-Site Services (Not Included)</strong></p>
<p>On-Site Services are not included in this Agreement. Client is responsible for engaging a licensed General Contractor to perform all on-site work. On-site costs are estimated separately and are not part of the Contract Price.</p>
<p>Estimated On-Site Cost (for reference only): {{PRELIMINARY_ONSITE_PRICE}}</p>
```

**CMOS variant:**
```html
<p><strong>On-Site Services (Included)</strong></p>
<p>On-Site Services are included in this Agreement and managed by Company.</p>
<p>Preliminary On-Site Price: {{PRELIMINARY_ONSITE_PRICE}}</p>
```

### 2. `BLOCK_ON_SITE_SCOPE_EXHIBIT_F` — Exhibit F: Site Responsibility Matrix Header

**Context:** This block appears in Exhibit F before the responsibility matrix table. It explains who is responsible for on-site work under the selected service model.

**CRC variant:**
```html
<p><strong>Client-Retained Contractor (CRC) — On-Site Requirements</strong></p>
<p>Client has elected to retain their own licensed General Contractor for all On-Site Services. The following requirements must be met by Client's General Contractor in order for Client to maintain eligibility for the Limited Warranty provided by Company.</p>
<p>Client's General Contractor must:</p>
<ul>
<li>Hold a valid general contractor license in the state where the Project is located</li>
<li>Maintain insurance coverage meeting Company's minimum requirements</li>
<li>Execute Company's Contractor Acknowledgment form prior to commencing work</li>
<li>Follow all installation specifications provided by Company</li>
<li>Allow Company reasonable access for inspection at all project milestones</li>
</ul>
```

**CMOS variant:**
```html
<p><strong>Company-Managed On-Site Services (CMOS) — Scope</strong></p>
<p>Company will engage and manage qualified contractors to perform all On-Site Services under this Agreement. Company is responsible for coordinating site preparation, foundation, utility connections, module setting, and all completion work.</p>
<p>Company's on-site management includes:</p>
<ul>
<li>Selection and management of licensed subcontractors</li>
<li>Coordination of site preparation and foundation work</li>
<li>Utility connection scheduling and oversight</li>
<li>Module delivery coordination and crane/setting supervision</li>
<li>Post-installation completion and punch list management</li>
</ul>
```

### 3. `BLOCK_ON_SITE_SCOPE_EXHIBIT_END` — Exhibit F: Closing Statement

**Context:** This block appears at the end of Exhibit F after all responsibility items. It provides the service-model-specific closing notice.

**CRC variant:**
```html
<p><strong>NOTICE:</strong> Client acknowledges that failure by Client's General Contractor to comply with Company's installation specifications, quality standards, or inspection requirements may result in partial or complete voiding of the Limited Warranty set forth in Exhibit E. Client is solely responsible for ensuring their General Contractor's compliance with the requirements in this Exhibit.</p>
```

**CMOS variant:**
```html
<p><strong>NOTICE:</strong> Company warrants that all On-Site Services performed under this Agreement will be completed in accordance with applicable building codes, manufacturer specifications, and the quality standards set forth in this Agreement. Any deficiencies in on-site work performed by Company's contractors are covered under the Limited Warranty set forth in Exhibit E.</p>
```

---

## Implementation

Run the following SQL to insert the 6 new component rows. First, get the organization ID:

```sql
-- Get organization ID
SELECT id FROM organizations LIMIT 1;
-- Use the returned ID (likely 1) in the inserts below
```

Then insert:

```sql
-- BLOCK_ON_SITE_SCOPE_EXHIBIT_A (CRC)
INSERT INTO component_library (organization_id, tag_name, service_model, description, content, is_system)
VALUES (1, 'BLOCK_ON_SITE_SCOPE_EXHIBIT_A', 'CRC',
  'Exhibit A — CRC: On-Site Services not included in budget',
  '<p><strong>On-Site Services (Not Included)</strong></p><p>On-Site Services are not included in this Agreement. Client is responsible for engaging a licensed General Contractor to perform all on-site work. On-site costs are estimated separately and are not part of the Contract Price.</p><p>Estimated On-Site Cost (for reference only): {{PRELIMINARY_ONSITE_PRICE}}</p>',
  false);

-- BLOCK_ON_SITE_SCOPE_EXHIBIT_A (CMOS)
INSERT INTO component_library (organization_id, tag_name, service_model, description, content, is_system)
VALUES (1, 'BLOCK_ON_SITE_SCOPE_EXHIBIT_A', 'CMOS',
  'Exhibit A — CMOS: On-Site Services included in budget',
  '<p><strong>On-Site Services (Included)</strong></p><p>On-Site Services are included in this Agreement and managed by Company.</p><p>Preliminary On-Site Price: {{PRELIMINARY_ONSITE_PRICE}}</p>',
  false);

-- BLOCK_ON_SITE_SCOPE_EXHIBIT_F (CRC)
INSERT INTO component_library (organization_id, tag_name, service_model, description, content, is_system)
VALUES (1, 'BLOCK_ON_SITE_SCOPE_EXHIBIT_F', 'CRC',
  'Exhibit F — CRC: Client GC requirements for warranty eligibility',
  '<p><strong>Client-Retained Contractor (CRC) — On-Site Requirements</strong></p><p>Client has elected to retain their own licensed General Contractor for all On-Site Services. The following requirements must be met by Client''s General Contractor in order for Client to maintain eligibility for the Limited Warranty provided by Company.</p><p>Client''s General Contractor must:</p><ul><li>Hold a valid general contractor license in the state where the Project is located</li><li>Maintain insurance coverage meeting Company''s minimum requirements</li><li>Execute Company''s Contractor Acknowledgment form prior to commencing work</li><li>Follow all installation specifications provided by Company</li><li>Allow Company reasonable access for inspection at all project milestones</li></ul>',
  false);

-- BLOCK_ON_SITE_SCOPE_EXHIBIT_F (CMOS)
INSERT INTO component_library (organization_id, tag_name, service_model, description, content, is_system)
VALUES (1, 'BLOCK_ON_SITE_SCOPE_EXHIBIT_F', 'CMOS',
  'Exhibit F — CMOS: Company manages all on-site work',
  '<p><strong>Company-Managed On-Site Services (CMOS) — Scope</strong></p><p>Company will engage and manage qualified contractors to perform all On-Site Services under this Agreement. Company is responsible for coordinating site preparation, foundation, utility connections, module setting, and all completion work.</p><p>Company''s on-site management includes:</p><ul><li>Selection and management of licensed subcontractors</li><li>Coordination of site preparation and foundation work</li><li>Utility connection scheduling and oversight</li><li>Module delivery coordination and crane/setting supervision</li><li>Post-installation completion and punch list management</li></ul>',
  false);

-- BLOCK_ON_SITE_SCOPE_EXHIBIT_END (CRC)
INSERT INTO component_library (organization_id, tag_name, service_model, description, content, is_system)
VALUES (1, 'BLOCK_ON_SITE_SCOPE_EXHIBIT_END', 'CRC',
  'Exhibit F closing — CRC: Warranty voiding notice for non-compliant GC work',
  '<p><strong>NOTICE:</strong> Client acknowledges that failure by Client''s General Contractor to comply with Company''s installation specifications, quality standards, or inspection requirements may result in partial or complete voiding of the Limited Warranty set forth in Exhibit E. Client is solely responsible for ensuring their General Contractor''s compliance with the requirements in this Exhibit.</p>',
  false);

-- BLOCK_ON_SITE_SCOPE_EXHIBIT_END (CMOS)
INSERT INTO component_library (organization_id, tag_name, service_model, description, content, is_system)
VALUES (1, 'BLOCK_ON_SITE_SCOPE_EXHIBIT_END', 'CMOS',
  'Exhibit F closing — CMOS: Company warranty coverage for on-site work',
  '<p><strong>NOTICE:</strong> Company warrants that all On-Site Services performed under this Agreement will be completed in accordance with applicable building codes, manufacturer specifications, and the quality standards set forth in this Agreement. Any deficiencies in on-site work performed by Company''s contractors are covered under the Limited Warranty set forth in Exhibit E.</p>',
  false);
```

## Verification

After inserting, verify:

```sql
-- Should return 18 total (12 existing + 6 new)
SELECT tag_name, service_model, length(content) as content_len
FROM component_library
WHERE organization_id = 1
ORDER BY tag_name, service_model;
```

Then generate a test contract for a CRC project and a CMOS project:
- CRC contract should show "On-Site Services (Not Included)" in Exhibit A and the GC requirements in Exhibit F
- CMOS contract should show "On-Site Services (Included)" in Exhibit A and the company-managed scope in Exhibit F
- Neither contract should have any remaining `{{BLOCK_*}}` placeholders

## Summary

| Change | Count |
|--------|-------|
| New rows in `component_library` | 6 |
| Code changes | 0 |
| Schema changes | 0 |

**Important:** The content above is draft/placeholder legal text. Have your legal team review and refine the actual language before using in production contracts. The structure and tag names are correct — only the prose may need adjustment.

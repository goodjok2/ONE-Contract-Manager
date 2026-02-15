-- ============================================================================
-- MASTER_EF CLAUSE CONTENT FIX - Run this to populate missing body_html
-- ============================================================================

-- Fix: Services (V.1) - has no header in DOCX, content flows from section header
UPDATE clauses SET body_html = '<p>Company will provide the services described in Exhibit A (the "Services"), including, as applicable, design/engineering coordination, factory manufacturing, production management, delivery coordination, on-site assembly/installation support, and/or completion services as allocated in Exhibit C.</p>'
WHERE slug = 'MASTER_EF_SERVICES' AND contract_types @> '["MASTER_EF"]'::jsonb;

-- Fix: Production (VIII.2)
UPDATE clauses SET body_html = '<p>Upon Green Light, Company will commence production and manage manufacturing in accordance with Exhibit B and applicable quality processes. Company may use qualified third-party manufacturing partners.</p>'
WHERE slug = 'MASTER_EF_PRODUCTION' AND contract_types @> '["MASTER_EF"]'::jsonb;

-- Fix: Limited Warranty (X.1)
UPDATE clauses SET body_html = '<p>Company provides the limited warranty set forth in Exhibit E, subject to exclusions, allocation of responsibilities in Exhibit C, and any warranty-eligibility requirements in Exhibit E/Exhibit F.</p>'
WHERE slug = 'MASTER_EF_LIMITED_WARRANTY' AND contract_types @> '["MASTER_EF"]'::jsonb;

-- Fix: Milestone Review (XIII.1)
UPDATE clauses SET body_html = '<p>Milestone review periods and deliverables are set forth in Exhibit D.</p>'
WHERE slug = 'MASTER_EF_MILESTONE_REVIEW_2' AND contract_types @> '["MASTER_EF"]'::jsonb;

-- Fix: Other Material Breach (XIV.2)
UPDATE clauses SET body_html = '<p>Other material breach not cured within ten (10) days after notice (or such shorter period where cure is not possible and the breach is continuing) permits suspension/termination.</p>'
WHERE slug = 'MASTER_EF_MATERIAL_BREACH' AND contract_types @> '["MASTER_EF"]'::jsonb;

-- Fix: Arbitration (XV.2)
UPDATE clauses SET body_html = '<p>Any dispute not resolved by mediation shall be finally resolved by binding arbitration administered by JAMS in Los Angeles County, California, under its Comprehensive Arbitration Rules. Judgment may be entered in any court of competent jurisdiction.</p>'
WHERE slug = 'MASTER_EF_ARBITRATION' AND contract_types @> '["MASTER_EF"]'::jsonb;

-- Fix: Entire Agreement; Amendments (XVI.1)
UPDATE clauses SET body_html = '<p>This Agreement and the Exhibits constitute the entire agreement. Amendments require a writing signed by both Parties. Exhibit A may be amended by a written Exhibit A amendment, provided no amendment modifies Sections 3.4–3.9 (bankability provisions) unless expressly stated.</p>'
WHERE slug = 'MASTER_EF_ENTIRE_AGREEMENT' AND contract_types @> '["MASTER_EF"]'::jsonb;

-- Fix: Notices (XVI.2)
UPDATE clauses SET body_html = '<p>Notices must be in writing and delivered by personal delivery, overnight courier, or email with confirmed receipt, to the addresses set forth in Exhibit A (or updated by notice).</p>'
WHERE slug = 'MASTER_EF_NOTICES' AND contract_types @> '["MASTER_EF"]'::jsonb;

-- Fix: Assignment (XVI.3)
UPDATE clauses SET body_html = '<p>Client may not assign this Agreement without Company''s consent. Company may assign to affiliates, successors, and financing parties as provided in Section 3.8.</p>'
WHERE slug = 'MASTER_EF_ASSIGNMENT' AND contract_types @> '["MASTER_EF"]'::jsonb;

-- ============================================================================
-- Fix Order of Precedence L3 children (3.1 - 3.6) - these have content
-- ============================================================================

UPDATE clauses SET body_html = '<p>Exhibit A controls solely for project scope, phasing, milestones, pricing, payment terms, delivery parameters, and site/completion model elections.</p>'
WHERE slug = 'MASTER_EF_PRECEDENCE_A' AND contract_types @> '["MASTER_EF"]'::jsonb;

UPDATE clauses SET body_html = '<p>Exhibits B and C control for technical requirements, interfaces, and allocation of responsibilities.</p>'
WHERE slug = 'MASTER_EF_PRECEDENCE_B' AND contract_types @> '["MASTER_EF"]'::jsonb;

UPDATE clauses SET body_html = '<p>Exhibit D controls for schedule mechanics and milestone review/admin.</p>'
WHERE slug = 'MASTER_EF_PRECEDENCE_C' AND contract_types @> '["MASTER_EF"]'::jsonb;

UPDATE clauses SET body_html = '<p>Exhibit E controls for warranty terms and claims procedures.</p>'
WHERE slug = 'MASTER_EF_PRECEDENCE_D' AND contract_types @> '["MASTER_EF"]'::jsonb;

UPDATE clauses SET body_html = '<p>Exhibit F controls solely to the extent required by applicable state law.</p>'
WHERE slug = 'MASTER_EF_PRECEDENCE_E' AND contract_types @> '["MASTER_EF"]'::jsonb;

UPDATE clauses SET body_html = '<p>This Agreement controls in all other respects.</p>'
WHERE slug = 'MASTER_EF_PRECEDENCE_F' AND contract_types @> '["MASTER_EF"]'::jsonb;

-- ============================================================================
-- Fix Completion Model L3 children (V.2.1 and V.2.2)
-- ============================================================================

UPDATE clauses SET body_html = '<p>If Company Completion Model is selected, Company will perform or subcontract the on-site responsibilities allocated to Company in Exhibit C through issuance of a certificate of occupancy or equivalent approval ("CO/Equivalent"), subject to Client meeting its responsibilities.</p>'
WHERE slug = 'MASTER_EF_COMPANY_COMPLETION' AND contract_types @> '["MASTER_EF"]'::jsonb;

UPDATE clauses SET body_html = '<p>If Client GC Completion Model is selected, Client (through its GC) is responsible for all on-site work allocated to Client in Exhibit C, and Company has no responsibility for site conditions, inspections, completion, or CO/Equivalent beyond the scope allocated to Company in Exhibit C.</p>'
WHERE slug = 'MASTER_EF_CLIENT_GC_COMPLETION' AND contract_types @> '["MASTER_EF"]'::jsonb;

-- ============================================================================
-- Remove "Recital" prefix from headers - DOCX doesn't have numbered recitals
-- ============================================================================

UPDATE clauses SET header_text = '' 
WHERE slug IN ('MASTER_EF_RECITAL_1', 'MASTER_EF_RECITAL_2', 'MASTER_EF_RECITAL_3') 
AND contract_types @> '["MASTER_EF"]'::jsonb;

-- ============================================================================
-- Fix Roman numeral gap: Delete duplicate/orphan clauses causing the III gap
-- First, check what's happening with the numbering
-- ============================================================================

-- The issue is likely that RECITALS children are being counted in the L1 numbering
-- Let's verify the parent structure is correct

-- Make sure RECITALS is truly L1 with no parent
UPDATE clauses SET level = 1, parent_id = NULL 
WHERE slug = 'MASTER_EF_RECITALS' AND contract_types @> '["MASTER_EF"]'::jsonb;

-- Make sure recital children are L2 under RECITALS
UPDATE clauses SET level = 2, parent_id = (SELECT id FROM clauses WHERE slug = 'MASTER_EF_RECITALS')
WHERE slug IN ('MASTER_EF_RECITAL_1', 'MASTER_EF_RECITAL_2', 'MASTER_EF_RECITAL_3', 'MASTER_EF_RECITAL_THEREFORE')
AND contract_types @> '["MASTER_EF"]'::jsonb;

-- ============================================================================
-- Delete duplicate signature block if it exists
-- ============================================================================

-- Keep only one signature block
DELETE FROM clauses 
WHERE slug LIKE '%SIGNATURE%' 
  AND contract_types @> '["MASTER_EF"]'::jsonb
  AND id NOT IN (
    SELECT MIN(id) FROM clauses 
    WHERE slug LIKE '%SIGNATURE%' 
    AND contract_types @> '["MASTER_EF"]'::jsonb
  );

-- ============================================================================
-- Verification query - run after to check
-- ============================================================================
-- SELECT slug, header_text, LEFT(body_html, 50) as body_preview, level, parent_id
-- FROM clauses 
-- WHERE contract_types @> '["MASTER_EF"]'::jsonb
-- ORDER BY "order";

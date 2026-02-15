-- ============================================================================
-- MASTER_EF Level 3 Clauses - Supplemental Script
-- ============================================================================
-- Run this AFTER seed-master-ef-clauses.sql
-- This adds L3 sub-clauses and updates L2 parents to remove embedded lists
-- ============================================================================


-- ============================================================================
-- 1. ORDER OF PRECEDENCE - Update L2 and add L3 children
-- ============================================================================

-- Update parent to remove embedded list
UPDATE clauses 
SET body_html = '<p>If there is any conflict:</p>'
WHERE slug = 'MASTER_EF_ORDER_PRECEDENCE';

-- Add L3 children
INSERT INTO clauses (slug, header_text, body_html, level, parent_id, "order", contract_types) VALUES
('MASTER_EF_PRECEDENCE_A', '', 
'<p>Exhibit A controls solely for project scope, phasing, milestones, pricing, payment terms, delivery parameters, and site/completion model elections.</p>', 
3, (SELECT id FROM clauses WHERE slug = 'MASTER_EF_ORDER_PRECEDENCE'), 331, '["MASTER_EF"]'::jsonb);

INSERT INTO clauses (slug, header_text, body_html, level, parent_id, "order", contract_types) VALUES
('MASTER_EF_PRECEDENCE_B', '', 
'<p>Exhibits B and C control for technical requirements, interfaces, and allocation of responsibilities.</p>', 
3, (SELECT id FROM clauses WHERE slug = 'MASTER_EF_ORDER_PRECEDENCE'), 332, '["MASTER_EF"]'::jsonb);

INSERT INTO clauses (slug, header_text, body_html, level, parent_id, "order", contract_types) VALUES
('MASTER_EF_PRECEDENCE_C', '', 
'<p>Exhibit D controls for schedule mechanics and milestone review/admin.</p>', 
3, (SELECT id FROM clauses WHERE slug = 'MASTER_EF_ORDER_PRECEDENCE'), 333, '["MASTER_EF"]'::jsonb);

INSERT INTO clauses (slug, header_text, body_html, level, parent_id, "order", contract_types) VALUES
('MASTER_EF_PRECEDENCE_D', '', 
'<p>Exhibit E controls for warranty terms and claims procedures.</p>', 
3, (SELECT id FROM clauses WHERE slug = 'MASTER_EF_ORDER_PRECEDENCE'), 334, '["MASTER_EF"]'::jsonb);

INSERT INTO clauses (slug, header_text, body_html, level, parent_id, "order", contract_types) VALUES
('MASTER_EF_PRECEDENCE_E', '', 
'<p>Exhibit F controls solely to the extent required by applicable state law.</p>', 
3, (SELECT id FROM clauses WHERE slug = 'MASTER_EF_ORDER_PRECEDENCE'), 335, '["MASTER_EF"]'::jsonb);

INSERT INTO clauses (slug, header_text, body_html, level, parent_id, "order", contract_types) VALUES
('MASTER_EF_PRECEDENCE_F', '', 
'<p>This Agreement controls in all other respects.</p>', 
3, (SELECT id FROM clauses WHERE slug = 'MASTER_EF_ORDER_PRECEDENCE'), 336, '["MASTER_EF"]'::jsonb);


-- ============================================================================
-- 2. COMPLETION MODEL - Update L2 and add L3 children
-- ============================================================================

-- Update parent to remove embedded paragraphs
UPDATE clauses 
SET body_html = '<p>Completion responsibility is elected in Exhibit A and allocated in Exhibit C.</p>'
WHERE slug = 'MASTER_EF_COMPLETION_MODEL';

-- Add L3 children
INSERT INTO clauses (slug, header_text, body_html, level, parent_id, "order", contract_types) VALUES
('MASTER_EF_COMPANY_COMPLETION', 'Company Completion Model', 
'<p>If Company Completion Model is selected, Company will perform or subcontract the on-site responsibilities allocated to Company in Exhibit C through issuance of a certificate of occupancy or equivalent approval ("CO/Equivalent"), subject to Client meeting its responsibilities.</p>', 
3, (SELECT id FROM clauses WHERE slug = 'MASTER_EF_COMPLETION_MODEL'), 421, '["MASTER_EF"]'::jsonb);

INSERT INTO clauses (slug, header_text, body_html, level, parent_id, "order", contract_types) VALUES
('MASTER_EF_CLIENT_GC_COMPLETION', 'Client GC Completion Model', 
'<p>If Client GC Completion Model is selected, Client (through its GC) is responsible for all on-site work allocated to Client in Exhibit C, and Company has no responsibility for site conditions, inspections, completion, or CO/Equivalent beyond the scope allocated to Company in Exhibit C.</p>', 
3, (SELECT id FROM clauses WHERE slug = 'MASTER_EF_COMPLETION_MODEL'), 422, '["MASTER_EF"]'::jsonb);


-- ============================================================================
-- 3. CHANGE ORDERS; SUBSTITUTIONS - Update L2 and add L3 children
-- ============================================================================

-- Update parent to just be the header
UPDATE clauses 
SET body_html = ''
WHERE slug = 'MASTER_EF_CHANGE_ORDERS';

-- Add L3 children
INSERT INTO clauses (slug, header_text, body_html, level, parent_id, "order", contract_types) VALUES
('MASTER_EF_CHANGE_ORDERS_SUB', 'Change Orders', 
'<p>Any Client-requested changes, Client-caused delays, or unforeseen site conditions that impact cost, scope, or schedule will be documented in a written change order or Exhibit A amendment signed by both Parties ("Change Order").</p>', 
3, (SELECT id FROM clauses WHERE slug = 'MASTER_EF_CHANGE_ORDERS'), 431, '["MASTER_EF"]'::jsonb);

INSERT INTO clauses (slug, header_text, body_html, level, parent_id, "order", contract_types) VALUES
('MASTER_EF_SUBSTITUTIONS', 'Like-for-Like Substitutions', 
'<p>Company may make reasonable substitutions of materials, finishes, fixtures, or components of substantially similar quality and functionality where necessary due to supply constraints or discontinuations, provided such substitutions do not materially reduce overall performance or agreed finishes category.</p>', 
3, (SELECT id FROM clauses WHERE slug = 'MASTER_EF_CHANGE_ORDERS'), 432, '["MASTER_EF"]'::jsonb);


-- ============================================================================
-- 4. TERMINATION PRIOR TO GREEN LIGHT - Update L2 and add L3 children
-- ============================================================================

-- Update parent to just be header
UPDATE clauses 
SET body_html = ''
WHERE slug = 'MASTER_EF_TERMINATION_PRIOR';

-- Add L3 children
INSERT INTO clauses (slug, header_text, body_html, level, parent_id, "order", contract_types) VALUES
('MASTER_EF_TERM_CONVENIENCE', 'Client Termination for Convenience', 
'<p>Prior to issuance of the Green Light Production Notice, Client may elect to terminate the applicable Exhibit A engagement for convenience upon written notice to Company.</p>', 
3, (SELECT id FROM clauses WHERE slug = 'MASTER_EF_TERMINATION_PRIOR'), 1341, '["MASTER_EF"]'::jsonb);

INSERT INTO clauses (slug, header_text, body_html, level, parent_id, "order", contract_types) VALUES
('MASTER_EF_PERMITTING_EXIT', 'Permitting Delay Exit', 
'<p>If permits are not obtained within 6 months of submission due to factors outside Company''s control, Company may terminate the applicable Exhibit A with notice; Client pays for Services performed and reimbursables incurred to date.</p>', 
3, (SELECT id FROM clauses WHERE slug = 'MASTER_EF_TERMINATION_PRIOR'), 1342, '["MASTER_EF"]'::jsonb);


-- ============================================================================
-- 5. EXHIBITS INCORPORATED - Update L2 and add L3 children for exhibit list
-- ============================================================================

-- Update parent to intro text only
UPDATE clauses 
SET body_html = '<p>The following exhibits are attached to and incorporated into this Agreement:</p>'
WHERE slug = 'MASTER_EF_EXHIBITS_INCORPORATED';

-- Add L3 children for each exhibit reference
INSERT INTO clauses (slug, header_text, body_html, level, parent_id, "order", contract_types) VALUES
('MASTER_EF_EXHIBIT_A_REF', 'Exhibit A', 
'<p>Project Scope and Commercial Terms (Project/Phase Matrix; Milestones; Pricing; Payment Schedule; Completion Model election)</p>', 
3, (SELECT id FROM clauses WHERE slug = 'MASTER_EF_EXHIBITS_INCORPORATED'), 311, '["MASTER_EF"]'::jsonb);

INSERT INTO clauses (slug, header_text, body_html, level, parent_id, "order", contract_types) VALUES
('MASTER_EF_EXHIBIT_B_REF', 'Exhibit B', 
'<p>Home Plans, Specifications & Finishes (Plan Set Index; technical specs; finish schedules)</p>', 
3, (SELECT id FROM clauses WHERE slug = 'MASTER_EF_EXHIBITS_INCORPORATED'), 312, '["MASTER_EF"]'::jsonb);

INSERT INTO clauses (slug, header_text, body_html, level, parent_id, "order", contract_types) VALUES
('MASTER_EF_EXHIBIT_C_REF', 'Exhibit C', 
'<p>General Contractor / On-Site Scope & Responsibility Matrix (Responsibility Allocation; Interfaces; Dependencies; site readiness requirements)</p>', 
3, (SELECT id FROM clauses WHERE slug = 'MASTER_EF_EXHIBITS_INCORPORATED'), 313, '["MASTER_EF"]'::jsonb);

INSERT INTO clauses (slug, header_text, body_html, level, parent_id, "order", contract_types) VALUES
('MASTER_EF_EXHIBIT_D_REF', 'Exhibit D', 
'<p>Milestones & Schedule (Design/engineering schedule; review periods; production slot assumptions; reporting cadence)</p>', 
3, (SELECT id FROM clauses WHERE slug = 'MASTER_EF_EXHIBITS_INCORPORATED'), 314, '["MASTER_EF"]'::jsonb);

INSERT INTO clauses (slug, header_text, body_html, level, parent_id, "order", contract_types) VALUES
('MASTER_EF_EXHIBIT_E_REF', 'Exhibit E', 
'<p>Limited Warranty (coverage terms; exclusions; claim process; manufacturer pass-through)</p>', 
3, (SELECT id FROM clauses WHERE slug = 'MASTER_EF_EXHIBITS_INCORPORATED'), 315, '["MASTER_EF"]'::jsonb);

INSERT INTO clauses (slug, header_text, body_html, level, parent_id, "order", contract_types) VALUES
('MASTER_EF_EXHIBIT_F_REF', 'Exhibit F', 
'<p>State-Specific Provisions (only to the extent required by law)</p>', 
3, (SELECT id FROM clauses WHERE slug = 'MASTER_EF_EXHIBITS_INCORPORATED'), 316, '["MASTER_EF"]'::jsonb);


-- ============================================================================
-- Link new L3 clauses to template
-- ============================================================================

INSERT INTO template_clauses (template_id, clause_id, sort_order)
SELECT 
  (SELECT id FROM contract_templates WHERE contract_type = 'MASTER_EF' LIMIT 1),
  c.id,
  c."order"
FROM clauses c
WHERE c.contract_types @> '["MASTER_EF"]'::jsonb
  AND c.level = 3
ON CONFLICT DO NOTHING;


-- ============================================================================
-- Verification Query
-- ============================================================================
-- Run this to verify the hierarchy:
--
-- SELECT 
--   c.level,
--   c.slug,
--   c.header_text,
--   p.slug as parent_slug
-- FROM clauses c
-- LEFT JOIN clauses p ON c.parent_id = p.id
-- WHERE c.contract_types @> '["MASTER_EF"]'::jsonb
-- ORDER BY c."order";
--
-- Expected: 
--   Level 1: ~15 clauses (no parent)
--   Level 2: ~50 clauses (parent = L1)
--   Level 3: ~18 clauses (parent = L2)

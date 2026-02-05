-- ============================================================================
-- MASTER EXHIBIT-FIRST ONE AGREEMENT - Clause Seed Data
-- ============================================================================
-- 
-- Run this after deleting the incorrectly ingested MASTER_EF clauses:
--   DELETE FROM template_clauses WHERE template_id = (SELECT id FROM contract_templates WHERE name ILIKE '%master%ef%');
--   DELETE FROM clauses WHERE contract_types @> '["MASTER_EF"]'::jsonb;
--
-- Then run this file to create the correct hierarchy.
-- ============================================================================

-- First, ensure we have a clean slate for MASTER_EF
DELETE FROM template_clauses WHERE template_id IN (SELECT id FROM contract_templates WHERE name ILIKE '%master%ef%');
DELETE FROM clauses WHERE contract_types @> '["MASTER_EF"]'::jsonb;

-- ============================================================================
-- LEVEL 1: Main Sections (Roman numerals in output: I, II, III...)
-- ============================================================================

-- Preamble & Recitals
INSERT INTO clauses (slug, header_text, body_html, level, parent_id, "order", contract_types) VALUES
('MASTER_EF_PREAMBLE', 'MASTER PURCHASE AGREEMENT', 
'<p>This Master Factory Built Home Purchase Agreement (this "Agreement") is entered into as of {{EFFECTIVE_DATE}} (the "Effective Date") by and between {{DVELE_PARTNERS_XYZ_LEGAL_NAME}}, a {{DVELE_PARTNERS_XYZ_STATE}} {{DVELE_PARTNERS_XYZ_ENTITY_TYPE}} ("Company"), and {{CLIENT_LEGAL_NAME}}, a {{CLIENT_STATE}} {{CLIENT_ENTITY_TYPE}} ("Client"). Company and Client may be referred to individually as a "Party" and collectively as the "Parties."</p>', 
1, NULL, 100, '["MASTER_EF"]'::jsonb);

INSERT INTO clauses (slug, header_text, body_html, level, parent_id, "order", contract_types) VALUES
('MASTER_EF_RECITALS', 'RECITALS', '', 1, NULL, 200, '["MASTER_EF"]'::jsonb);

-- Section 1: Agreement Construction
INSERT INTO clauses (slug, header_text, body_html, level, parent_id, "order", contract_types) VALUES
('MASTER_EF_AGREEMENT_CONSTRUCTION', 'AGREEMENT CONSTRUCTION', '', 1, NULL, 300, '["MASTER_EF"]'::jsonb);

-- Section 2: Services; Scope; Change Control
INSERT INTO clauses (slug, header_text, body_html, level, parent_id, "order", contract_types) VALUES
('MASTER_EF_SERVICES_SCOPE', 'SERVICES; SCOPE; CHANGE CONTROL', '', 1, NULL, 400, '["MASTER_EF"]'::jsonb);

-- Section 3: Fees; Payment; Financeability (XREF target)
INSERT INTO clauses (slug, header_text, body_html, level, parent_id, "order", contract_types) VALUES
('FEES_PAYMENT_SECTION', 'FEES; PAYMENT; FINANCEABILITY', '', 1, NULL, 500, '["MASTER_EF"]'::jsonb);

-- Section 4: Client Responsibilities
INSERT INTO clauses (slug, header_text, body_html, level, parent_id, "order", contract_types) VALUES
('MASTER_EF_CLIENT_RESPONSIBILITIES', 'CLIENT RESPONSIBILITIES', '', 1, NULL, 600, '["MASTER_EF"]'::jsonb);

-- Section 5: Company Responsibilities; Insurance
INSERT INTO clauses (slug, header_text, body_html, level, parent_id, "order", contract_types) VALUES
('MASTER_EF_COMPANY_RESPONSIBILITIES', 'COMPANY RESPONSIBILITIES; INSURANCE', '', 1, NULL, 700, '["MASTER_EF"]'::jsonb);

-- Section 6: Schedule; Delays; Force Majeure; Pricing Adjustments
INSERT INTO clauses (slug, header_text, body_html, level, parent_id, "order", contract_types) VALUES
('MASTER_EF_SCHEDULE_DELAYS', 'SCHEDULE; DELAYS; FORCE MAJEURE; PRICING ADJUSTMENTS', '', 1, NULL, 800, '["MASTER_EF"]'::jsonb);

-- Section 7: Limited Warranty; Disclaimer; Remedies
INSERT INTO clauses (slug, header_text, body_html, level, parent_id, "order", contract_types) VALUES
('MASTER_EF_WARRANTY', 'LIMITED WARRANTY; DISCLAIMER; REMEDIES', '', 1, NULL, 900, '["MASTER_EF"]'::jsonb);

-- Section 8: Intellectual Property; License; Publicity
INSERT INTO clauses (slug, header_text, body_html, level, parent_id, "order", contract_types) VALUES
('MASTER_EF_IP', 'INTELLECTUAL PROPERTY; LICENSE; PUBLICITY', '', 1, NULL, 1000, '["MASTER_EF"]'::jsonb);

-- Section 9: Limitation of Liability
INSERT INTO clauses (slug, header_text, body_html, level, parent_id, "order", contract_types) VALUES
('MASTER_EF_LIABILITY', 'LIMITATION OF LIABILITY', '', 1, NULL, 1100, '["MASTER_EF"]'::jsonb);

-- Section 10: Milestone Review; No Obligation; Clarification
INSERT INTO clauses (slug, header_text, body_html, level, parent_id, "order", contract_types) VALUES
('MASTER_EF_MILESTONE_REVIEW', 'MILESTONE REVIEW; NO OBLIGATION; CLARIFICATION', '', 1, NULL, 1200, '["MASTER_EF"]'::jsonb);

-- Section 11: Default; Termination; Effects
INSERT INTO clauses (slug, header_text, body_html, level, parent_id, "order", contract_types) VALUES
('MASTER_EF_DEFAULT_TERMINATION', 'DEFAULT; TERMINATION; EFFECTS', '', 1, NULL, 1300, '["MASTER_EF"]'::jsonb);

-- Section 12: Dispute Resolution; Governing Law
INSERT INTO clauses (slug, header_text, body_html, level, parent_id, "order", contract_types) VALUES
('MASTER_EF_DISPUTE_RESOLUTION', 'DISPUTE RESOLUTION; GOVERNING LAW', '', 1, NULL, 1400, '["MASTER_EF"]'::jsonb);

-- Section 13: Miscellaneous
INSERT INTO clauses (slug, header_text, body_html, level, parent_id, "order", contract_types) VALUES
('MASTER_EF_MISCELLANEOUS', 'MISCELLANEOUS', '', 1, NULL, 1500, '["MASTER_EF"]'::jsonb);

-- Signature Block
INSERT INTO clauses (slug, header_text, body_html, level, parent_id, "order", contract_types) VALUES
('MASTER_EF_SIGNATURES', 'SIGNATURES; COUNTERPARTS; AUTHORITY', 
'<p>IN WITNESS WHEREOF, the Parties have executed this Agreement as of the Effective Date first written above. This Agreement may be executed in counterparts, each of which shall be deemed an original. Signatures delivered by electronic transmission shall be deemed original signatures.</p>
{{SIGNATURE_BLOCK_TABLE}}', 
1, NULL, 1600, '["MASTER_EF"]'::jsonb);


-- ============================================================================
-- LEVEL 2: Subsections (under Recitals)
-- ============================================================================

INSERT INTO clauses (slug, header_text, body_html, level, parent_id, "order", contract_types) VALUES
('MASTER_EF_RECITAL_1', 'Recital 1', 
'<p>WHEREAS, Company designs and manufactures factory-built housing components and modular homes and may provide delivery, assembly, installation support, and/or completion services described on Exhibit A (hereinafter "Services") as agreed.</p>', 
2, (SELECT id FROM clauses WHERE slug = 'MASTER_EF_RECITALS'), 210, '["MASTER_EF"]'::jsonb);

INSERT INTO clauses (slug, header_text, body_html, level, parent_id, "order", contract_types) VALUES
('MASTER_EF_RECITAL_2', 'Recital 2', 
'<p>WHEREAS, Client owns or controls or will own or control, prior to delivery, the real property identified in Exhibit A (each, a "Site") and has or will obtain the authority necessary for delivery, installation, and completion of one or more factory built homes thereon.</p>', 
2, (SELECT id FROM clauses WHERE slug = 'MASTER_EF_RECITALS'), 220, '["MASTER_EF"]'::jsonb);

INSERT INTO clauses (slug, header_text, body_html, level, parent_id, "order", contract_types) VALUES
('MASTER_EF_RECITAL_3', 'Recital 3', 
'<p>WHEREAS, Client desires to engage Company to provide certain Services for one or more properties and/or phases as more fully described in Exhibit A.</p>', 
2, (SELECT id FROM clauses WHERE slug = 'MASTER_EF_RECITALS'), 230, '["MASTER_EF"]'::jsonb);

INSERT INTO clauses (slug, header_text, body_html, level, parent_id, "order", contract_types) VALUES
('MASTER_EF_RECITAL_THEREFORE', '', 
'<p>NOW, THEREFORE, for good and valuable consideration, the Parties agree as follows:</p>', 
2, (SELECT id FROM clauses WHERE slug = 'MASTER_EF_RECITALS'), 240, '["MASTER_EF"]'::jsonb);


-- ============================================================================
-- LEVEL 2: Subsections (under Agreement Construction)
-- ============================================================================

INSERT INTO clauses (slug, header_text, body_html, level, parent_id, "order", contract_types) VALUES
('MASTER_EF_EXHIBITS_INCORPORATED', 'Exhibits Incorporated', 
'<p>The following exhibits are attached to and incorporated into this Agreement:</p>
<ul>
<li>Exhibit A – Project Scope and Commercial Terms (Project/Phase Matrix; Milestones; Pricing; Payment Schedule; Completion Model election)</li>
<li>Exhibit B – Home Plans, Specifications & Finishes (Plan Set Index; technical specs; finish schedules)</li>
<li>Exhibit C – General Contractor / On-Site Scope & Responsibility Matrix (Responsibility Allocation; Interfaces; Dependencies; site readiness requirements)</li>
<li>Exhibit D – Milestones & Schedule (Design/engineering schedule; review periods; production slot assumptions; reporting cadence)</li>
<li>Exhibit E – Limited Warranty (coverage terms; exclusions; claim process; manufacturer pass-through)</li>
<li>Exhibit F – State-Specific Provisions (only to the extent required by law)</li>
</ul>', 
2, (SELECT id FROM clauses WHERE slug = 'MASTER_EF_AGREEMENT_CONSTRUCTION'), 310, '["MASTER_EF"]'::jsonb);

INSERT INTO clauses (slug, header_text, body_html, level, parent_id, "order", contract_types) VALUES
('MASTER_EF_EXHIBIT_FIRST', 'Exhibit-First Structure', 
'<p>All project- and customer-specific descriptions and commercial terms are set forth in Exhibit A and related technical/operational Exhibits. No Services commence unless an Exhibit A is executed by both Parties.</p>', 
2, (SELECT id FROM clauses WHERE slug = 'MASTER_EF_AGREEMENT_CONSTRUCTION'), 320, '["MASTER_EF"]'::jsonb);

INSERT INTO clauses (slug, header_text, body_html, level, parent_id, "order", contract_types) VALUES
('MASTER_EF_ORDER_PRECEDENCE', 'Order of Precedence', 
'<p>If there is any conflict:</p>
<ul>
<li>Exhibit A controls solely for project scope, phasing, milestones, pricing, payment terms, delivery parameters, and site/completion model elections.</li>
<li>Exhibits B and C control for technical requirements, interfaces, and allocation of responsibilities.</li>
<li>Exhibit D controls for schedule mechanics and milestone review/admin.</li>
<li>Exhibit E controls for warranty terms and claims procedures.</li>
<li>Exhibit F controls solely to the extent required by applicable state law.</li>
<li>This Agreement controls in all other respects.</li>
</ul>', 
2, (SELECT id FROM clauses WHERE slug = 'MASTER_EF_AGREEMENT_CONSTRUCTION'), 330, '["MASTER_EF"]'::jsonb);

INSERT INTO clauses (slug, header_text, body_html, level, parent_id, "order", contract_types) VALUES
('MASTER_EF_MULTIPLE_PROJECTS', 'Multiple Projects / Multiple Exhibit As', 
'<p>The Parties may execute one or more Exhibits A under this Agreement. Each Exhibit A constitutes a separate project engagement governed by this Agreement. Termination or completion of one Exhibit A does not affect others unless expressly stated.</p>', 
2, (SELECT id FROM clauses WHERE slug = 'MASTER_EF_AGREEMENT_CONSTRUCTION'), 340, '["MASTER_EF"]'::jsonb);


-- ============================================================================
-- LEVEL 2: Subsections (under Services; Scope; Change Control)
-- ============================================================================

INSERT INTO clauses (slug, header_text, body_html, level, parent_id, "order", contract_types) VALUES
('MASTER_EF_SERVICES', 'Services', 
'<p>Company will provide the services described in Exhibit A (the "Services"), including, as applicable, design/engineering coordination, factory manufacturing, production management, delivery coordination, on-site assembly/installation support, and/or completion services as allocated in Exhibit C.</p>', 
2, (SELECT id FROM clauses WHERE slug = 'MASTER_EF_SERVICES_SCOPE'), 410, '["MASTER_EF"]'::jsonb);

INSERT INTO clauses (slug, header_text, body_html, level, parent_id, "order", contract_types) VALUES
('MASTER_EF_COMPLETION_MODEL', 'Completion Model; Separation of Responsibility', 
'<p>Completion responsibility is elected in Exhibit A and allocated in Exhibit C.</p>
<p>If Company Completion Model is selected, Company will perform or subcontract the on-site responsibilities allocated to Company in Exhibit C through issuance of a certificate of occupancy or equivalent approval ("CO/Equivalent"), subject to Client meeting its responsibilities.</p>
<p>If Client GC Completion Model is selected, Client (through its GC) is responsible for all on-site work allocated to Client in Exhibit C, and Company has no responsibility for site conditions, inspections, completion, or CO/Equivalent beyond the scope allocated to Company in Exhibit C.</p>', 
2, (SELECT id FROM clauses WHERE slug = 'MASTER_EF_SERVICES_SCOPE'), 420, '["MASTER_EF"]'::jsonb);

INSERT INTO clauses (slug, header_text, body_html, level, parent_id, "order", contract_types) VALUES
('MASTER_EF_CHANGE_ORDERS', 'Change Orders; Substitutions', 
'<p><strong>Change Orders.</strong> Any Client-requested changes, Client-caused delays, or unforeseen site conditions that impact cost, scope, or schedule will be documented in a written change order or Exhibit A amendment signed by both Parties ("Change Order").</p>
<p><strong>Like-for-Like Substitutions.</strong> Company may make reasonable substitutions of materials, finishes, fixtures, or components of substantially similar quality and functionality where necessary due to supply constraints or discontinuations, provided such substitutions do not materially reduce overall performance or agreed finishes category.</p>', 
2, (SELECT id FROM clauses WHERE slug = 'MASTER_EF_SERVICES_SCOPE'), 430, '["MASTER_EF"]'::jsonb);

INSERT INTO clauses (slug, header_text, body_html, level, parent_id, "order", contract_types) VALUES
('MASTER_EF_NOT_INCLUDED', 'What is Not Included', 
'<p>Unless expressly included in Exhibit A (or a Change Order), Company does not provide: local permit fees, utility connection fees, specialty equipment not specified in Exhibit B, site landscaping/driveways/fencing, owner furnishings/window coverings, or other site work allocated to Client/GC in Exhibit C.</p>', 
2, (SELECT id FROM clauses WHERE slug = 'MASTER_EF_SERVICES_SCOPE'), 440, '["MASTER_EF"]'::jsonb);


-- ============================================================================
-- LEVEL 2: Subsections (under Fees; Payment; Financeability)
-- ============================================================================

INSERT INTO clauses (slug, header_text, body_html, level, parent_id, "order", contract_types) VALUES
('MASTER_EF_PRICING_PAYMENT', 'Pricing and Payment Schedule', 
'<p>All fees, purchase price, milestone payments, deposits, reimbursements, and payment timing are set forth in Exhibit A.</p>', 
2, (SELECT id FROM clauses WHERE slug = 'FEES_PAYMENT_SECTION'), 510, '["MASTER_EF"]'::jsonb);

INSERT INTO clauses (slug, header_text, body_html, level, parent_id, "order", contract_types) VALUES
('MASTER_EF_GREEN_LIGHT', 'Green Light Conditions; Green Light Production Notice', 
'<p>Where applicable, production begins only after satisfaction of the Green Light Conditions stated in Exhibit A (including design approvals, proof of site control, GC readiness as applicable, proof of funds/financing, and required deposits). Upon satisfaction, Company will issue a written Green Light Production Notice confirming production commencement and the applicable production slot.</p>', 
2, (SELECT id FROM clauses WHERE slug = 'FEES_PAYMENT_SECTION'), 520, '["MASTER_EF"]'::jsonb);

INSERT INTO clauses (slug, header_text, body_html, level, parent_id, "order", contract_types) VALUES
('MASTER_EF_MILESTONE_CERT', 'Milestone Certification; Deemed Acceptance', 
'<p>Company will certify milestone completion in writing (email acceptable). Client has five (5) business days to object in writing specifying material non-conformity. Failure to object within that period constitutes acceptance of the milestone for all purposes, including payment.</p>', 
2, (SELECT id FROM clauses WHERE slug = 'FEES_PAYMENT_SECTION'), 530, '["MASTER_EF"]'::jsonb);

INSERT INTO clauses (slug, header_text, body_html, level, parent_id, "order", contract_types) VALUES
('IRREVOCABLE_PAYMENT', 'Irrevocable Payment Obligation After Green Light', 
'<p>Upon issuance of the Green Light Production Notice, Client''s obligation to pay the Production Price and milestone payments is absolute, unconditional, and irrevocable, subject only to Company''s uncured material failure to perform its obligations for the applicable milestone(s).</p>', 
2, (SELECT id FROM clauses WHERE slug = 'FEES_PAYMENT_SECTION'), 540, '["MASTER_EF"]'::jsonb);

INSERT INTO clauses (slug, header_text, body_html, level, parent_id, "order", contract_types) VALUES
('NO_SETOFF', 'No Setoff / No Counterclaim', 
'<p>Client waives any right of setoff, deduction, counterclaim, abatement, or withholding against amounts due, except to the extent arising from Company''s uncured material breach.</p>', 
2, (SELECT id FROM clauses WHERE slug = 'FEES_PAYMENT_SECTION'), 550, '["MASTER_EF"]'::jsonb);

INSERT INTO clauses (slug, header_text, body_html, level, parent_id, "order", contract_types) VALUES
('MASTER_EF_REIMBURSABLES', 'Reimbursables', 
'<p>Unless otherwise stated in Exhibit A, reimbursable out-of-pocket expenses (e.g., travel, shipping premiums, printing, third-party review agency fees) are reimbursed at actual cost, with any administrative fee only if expressly stated in Exhibit A.</p>', 
2, (SELECT id FROM clauses WHERE slug = 'FEES_PAYMENT_SECTION'), 560, '["MASTER_EF"]'::jsonb);

INSERT INTO clauses (slug, header_text, body_html, level, parent_id, "order", contract_types) VALUES
('MASTER_EF_LATE_PAYMENTS', 'Late Payments; Suspension', 
'<p>Late payments accrue interest at 1.5% per month (or the maximum allowed by law). If Client fails to pay amounts due, Company may suspend work and adjust schedule until payments are current. Storage, re-handling, and remobilization costs caused by Client delays are payable by Client.</p>', 
2, (SELECT id FROM clauses WHERE slug = 'FEES_PAYMENT_SECTION'), 570, '["MASTER_EF"]'::jsonb);

INSERT INTO clauses (slug, header_text, body_html, level, parent_id, "order", contract_types) VALUES
('ASSIGNMENT_FINANCING', 'Assignment; Financing; Payment Directions', 
'<p>Client acknowledges Company may assign, pledge, sell, or grant a security interest in this Agreement, any Exhibit A, and any payment obligations/receivables to one or more financing parties (warehouse, receivables purchase, or project financing). Client consents to such actions without further consent. Client agrees to follow written payment instructions after notice of assignment. No assignment relieves Company of performance obligations.</p>', 
2, (SELECT id FROM clauses WHERE slug = 'FEES_PAYMENT_SECTION'), 580, '["MASTER_EF"]'::jsonb);

INSERT INTO clauses (slug, header_text, body_html, level, parent_id, "order", contract_types) VALUES
('FINANCING_PARTY_CURE', 'Financing Party Cure Rights (Non-Operator)', 
'<p>Upon Client default, Company shall permit any financing party holding an assignment/security interest to cure payment defaults within the applicable cure period. No financing party is obligated to perform Client''s non-payment obligations and shall not be deemed an owner, contractor, or GC.</p>', 
2, (SELECT id FROM clauses WHERE slug = 'FEES_PAYMENT_SECTION'), 590, '["MASTER_EF"]'::jsonb);


-- ============================================================================
-- LEVEL 2: Subsections (under Client Responsibilities)
-- ============================================================================

INSERT INTO clauses (slug, header_text, body_html, level, parent_id, "order", contract_types) VALUES
('MASTER_EF_CLIENT_GENERAL', 'General', 
'<p>Client''s timely performance is critical. Client will perform the responsibilities allocated to Client in Exhibit C, including site access, site readiness, GC coordination (if applicable), and timely approvals.</p>', 
2, (SELECT id FROM clauses WHERE slug = 'MASTER_EF_CLIENT_RESPONSIBILITIES'), 610, '["MASTER_EF"]'::jsonb);

INSERT INTO clauses (slug, header_text, body_html, level, parent_id, "order", contract_types) VALUES
('MASTER_EF_SITE_INFO', 'Site Information; Surveys; Reports', 
'<p>Upon request, Client shall provide available site information (surveys, easements, utility locations, geotech/environmental reports, tests). Failure to timely provide information may delay schedule and increase costs, which will be addressed via Change Order.</p>', 
2, (SELECT id FROM clauses WHERE slug = 'MASTER_EF_CLIENT_RESPONSIBILITIES'), 620, '["MASTER_EF"]'::jsonb);

INSERT INTO clauses (slug, header_text, body_html, level, parent_id, "order", contract_types) VALUES
('MASTER_EF_SITE_CONTROL', 'Site Control; Authority', 
'<p>Before delivery, Client shall provide proof of ownership/control sufficient to authorize installation and completion and maintain such authority through final payment.</p>', 
2, (SELECT id FROM clauses WHERE slug = 'MASTER_EF_CLIENT_RESPONSIBILITIES'), 630, '["MASTER_EF"]'::jsonb);

INSERT INTO clauses (slug, header_text, body_html, level, parent_id, "order", contract_types) VALUES
('MASTER_EF_GC_ENGAGEMENT', 'GC Engagement (Client GC Completion Model)', 
'<p>If Client GC Completion Model is elected, Client will engage a licensed GC meeting the minimum requirements of Exhibit C and any warranty-eligibility requirements in Exhibit E/Exhibit F as applicable.</p>', 
2, (SELECT id FROM clauses WHERE slug = 'MASTER_EF_CLIENT_RESPONSIBILITIES'), 640, '["MASTER_EF"]'::jsonb);


-- ============================================================================
-- LEVEL 2: Subsections (under Company Responsibilities; Insurance)
-- ============================================================================

INSERT INTO clauses (slug, header_text, body_html, level, parent_id, "order", contract_types) VALUES
('MASTER_EF_DESIGN_PREPROD', 'Design / Pre-Production', 
'<p>Company will provide the design and pre-production services described in Exhibit A and Exhibit D, subject to Client providing required inputs/approvals.</p>', 
2, (SELECT id FROM clauses WHERE slug = 'MASTER_EF_COMPANY_RESPONSIBILITIES'), 710, '["MASTER_EF"]'::jsonb);

INSERT INTO clauses (slug, header_text, body_html, level, parent_id, "order", contract_types) VALUES
('MASTER_EF_PRODUCTION', 'Production', 
'<p>Upon Green Light, Company will commence production and manage manufacturing in accordance with Exhibit B and applicable quality processes. Company may use qualified third-party manufacturing partners.</p>', 
2, (SELECT id FROM clauses WHERE slug = 'MASTER_EF_COMPANY_RESPONSIBILITIES'), 720, '["MASTER_EF"]'::jsonb);

INSERT INTO clauses (slug, header_text, body_html, level, parent_id, "order", contract_types) VALUES
('MASTER_EF_DELIVERY_ONSITE', 'Delivery / On-Site', 
'<p>Delivery coordination and any on-site responsibilities will be performed as allocated in Exhibit C.</p>', 
2, (SELECT id FROM clauses WHERE slug = 'MASTER_EF_COMPANY_RESPONSIBILITIES'), 730, '["MASTER_EF"]'::jsonb);

INSERT INTO clauses (slug, header_text, body_html, level, parent_id, "order", contract_types) VALUES
('MASTER_EF_INSURANCE', 'Insurance', 
'<p>Company will maintain workers'' compensation as required by law and commercial general liability with limits not less than $1,000,000 per occurrence / $2,000,000 aggregate (or such other amounts as stated in Exhibit A). Certificates provided upon request.</p>', 
2, (SELECT id FROM clauses WHERE slug = 'MASTER_EF_COMPANY_RESPONSIBILITIES'), 740, '["MASTER_EF"]'::jsonb);


-- ============================================================================
-- LEVEL 2: Subsections (under Schedule; Delays; Force Majeure)
-- ============================================================================

INSERT INTO clauses (slug, header_text, body_html, level, parent_id, "order", contract_types) VALUES
('MASTER_EF_PROJECT_SCHEDULE', 'Project Schedule', 
'<p>The schedule set forth in Exhibit D is an estimate and may adjust due to permitting, production slot availability, supply chain variability, weather, site readiness, and other factors outside Company''s reasonable control. Time is not of the essence unless expressly stated in Exhibit A.</p>', 
2, (SELECT id FROM clauses WHERE slug = 'MASTER_EF_SCHEDULE_DELAYS'), 810, '["MASTER_EF"]'::jsonb);

INSERT INTO clauses (slug, header_text, body_html, level, parent_id, "order", contract_types) VALUES
('MASTER_EF_PRECONDITIONS', 'Preconditions to Production', 
'<p>Company is not obligated to begin production until Green Light Conditions are met. If conditions are not timely met, Company may reassign the production slot and adjust schedule with notice.</p>', 
2, (SELECT id FROM clauses WHERE slug = 'MASTER_EF_SCHEDULE_DELAYS'), 820, '["MASTER_EF"]'::jsonb);

INSERT INTO clauses (slug, header_text, body_html, level, parent_id, "order", contract_types) VALUES
('MASTER_EF_SITE_NOT_READY', 'Site Not Ready', 
'<p>If the site is not ready as required by Exhibit C, Company may delay delivery and/or incur storage, re-handling, demurrage, and remobilization costs payable by Client.</p>', 
2, (SELECT id FROM clauses WHERE slug = 'MASTER_EF_SCHEDULE_DELAYS'), 830, '["MASTER_EF"]'::jsonb);

INSERT INTO clauses (slug, header_text, body_html, level, parent_id, "order", contract_types) VALUES
('MASTER_EF_FORCE_MAJEURE', 'Force Majeure', 
'<p>Neither Party is liable for delay/failure caused by events beyond reasonable control (acts of God, natural disasters, governmental actions, labor disputes, transportation disruptions, pandemics, supply chain disruptions, permit backlogs, carrier unavailability, factory closures/slot disruptions due to external conditions). Schedule extends equitably.</p>', 
2, (SELECT id FROM clauses WHERE slug = 'MASTER_EF_SCHEDULE_DELAYS'), 840, '["MASTER_EF"]'::jsonb);

INSERT INTO clauses (slug, header_text, body_html, level, parent_id, "order", contract_types) VALUES
('MASTER_EF_INFLATION_ADJUSTMENT', 'Inflation / Market Adjustment', 
'<p>If production has not commenced within [6] months after execution of the applicable Exhibit A due to factors outside Company''s control (including permitting delays, Client delays, or force majeure), Company may propose a reasonable price adjustment reflecting documented increases in materials/labor/transport costs. Any adjustment must be documented via Exhibit A amendment or Change Order.</p>', 
2, (SELECT id FROM clauses WHERE slug = 'MASTER_EF_SCHEDULE_DELAYS'), 850, '["MASTER_EF"]'::jsonb);


-- ============================================================================
-- LEVEL 2: Subsections (under Limited Warranty; Disclaimer; Remedies)
-- ============================================================================

INSERT INTO clauses (slug, header_text, body_html, level, parent_id, "order", contract_types) VALUES
('MASTER_EF_LIMITED_WARRANTY', 'Limited Warranty', 
'<p>Company provides the limited warranty set forth in Exhibit E, subject to exclusions, allocation of responsibilities in Exhibit C, and any warranty-eligibility requirements in Exhibit E/Exhibit F.</p>', 
2, (SELECT id FROM clauses WHERE slug = 'MASTER_EF_WARRANTY'), 910, '["MASTER_EF"]'::jsonb);

INSERT INTO clauses (slug, header_text, body_html, level, parent_id, "order", contract_types) VALUES
('MASTER_EF_EXCLUSIVE_REMEDY', 'Exclusive Remedy; Disclaimer', 
'<p class="conspicuous">EXCEPT AS EXPRESSLY STATED IN EXHIBIT E, COMPANY DISCLAIMS ALL OTHER WARRANTIES TO THE MAXIMUM EXTENT PERMITTED BY LAW, INCLUDING IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE. THE LIMITED WARRANTY IS THE SOLE AND EXCLUSIVE REMEDY FOR COVERED DEFECTS.</p>', 
2, (SELECT id FROM clauses WHERE slug = 'MASTER_EF_WARRANTY'), 920, '["MASTER_EF"]'::jsonb);

INSERT INTO clauses (slug, header_text, body_html, level, parent_id, "order", contract_types) VALUES
('MASTER_EF_MFR_PASSTHROUGH', 'Manufacturer Pass-Through', 
'<p>To the extent available, Company will pass through manufacturer warranties for appliances/fixtures/equipment; such manufacturer warranties are the exclusive remedy for those components except to the extent defects arise from Company''s workmanship within the applicable coverage.</p>', 
2, (SELECT id FROM clauses WHERE slug = 'MASTER_EF_WARRANTY'), 930, '["MASTER_EF"]'::jsonb);


-- ============================================================================
-- LEVEL 2: Subsections (under Intellectual Property; License; Publicity)
-- ============================================================================

INSERT INTO clauses (slug, header_text, body_html, level, parent_id, "order", contract_types) VALUES
('MASTER_EF_WORK_PRODUCT', 'Ownership of Work Product', 
'<p>Company owns all drawings, plans, specifications, and deliverables created by or for Company ("Work Product"), including all IP rights.</p>', 
2, (SELECT id FROM clauses WHERE slug = 'MASTER_EF_IP'), 1010, '["MASTER_EF"]'::jsonb);

INSERT INTO clauses (slug, header_text, body_html, level, parent_id, "order", contract_types) VALUES
('MASTER_EF_PROJECT_LICENSE', 'Limited Project License', 
'<p>Upon payment of amounts due through the applicable milestone, Client receives a non-exclusive, non-transferable license to use the Work Product solely for the applicable Project. If Client uses Work Product without Company''s further involvement or outside the Project, Client assumes all risk and will defend/indemnify Company from resulting claims to the fullest extent permitted by law.</p>', 
2, (SELECT id FROM clauses WHERE slug = 'MASTER_EF_IP'), 1020, '["MASTER_EF"]'::jsonb);

INSERT INTO clauses (slug, header_text, body_html, level, parent_id, "order", contract_types) VALUES
('MASTER_EF_PUBLICITY', 'Publicity', 
'<p>Client grants Company the right to photograph and use images of the home for marketing, provided Company will not publicly disclose the specific address without Client''s consent (not unreasonably withheld for portfolio-type references).</p>', 
2, (SELECT id FROM clauses WHERE slug = 'MASTER_EF_IP'), 1030, '["MASTER_EF"]'::jsonb);


-- ============================================================================
-- LEVEL 2: Subsections (under Limitation of Liability)
-- ============================================================================

INSERT INTO clauses (slug, header_text, body_html, level, parent_id, "order", contract_types) VALUES
('MASTER_EF_CONSEQUENTIAL', 'Exclusion of Consequential Damages', 
'<p class="conspicuous">TO THE FULLEST EXTENT PERMITTED BY LAW, NEITHER PARTY IS LIABLE FOR CONSEQUENTIAL, INCIDENTAL, SPECIAL, INDIRECT, OR PUNITIVE DAMAGES (INCLUDING LOST PROFITS OR LOSS OF USE), REGARDLESS OF THEORY.</p>', 
2, (SELECT id FROM clauses WHERE slug = 'MASTER_EF_LIABILITY'), 1110, '["MASTER_EF"]'::jsonb);

INSERT INTO clauses (slug, header_text, body_html, level, parent_id, "order", contract_types) VALUES
('MASTER_EF_LIABILITY_CAP', 'Liability Cap', 
'<p class="conspicuous">COMPANY''S TOTAL LIABILITY ARISING OUT OF OR RELATING TO THIS AGREEMENT WILL NOT EXCEED THE TOTAL AMOUNTS PAID BY CLIENT UNDER THE APPLICABLE EXHIBIT A GIVING RISE TO THE CLAIM, EXCEPT FOR FRAUD, GROSS NEGLIGENCE, OR WILLFUL MISCONDUCT.</p>', 
2, (SELECT id FROM clauses WHERE slug = 'MASTER_EF_LIABILITY'), 1120, '["MASTER_EF"]'::jsonb);


-- ============================================================================
-- LEVEL 2: Subsections (under Milestone Review; No Obligation)
-- ============================================================================

INSERT INTO clauses (slug, header_text, body_html, level, parent_id, "order", contract_types) VALUES
('MASTER_EF_MILESTONE_REVIEW_2', 'Milestone Review', 
'<p>Milestone review periods and deliverables are set forth in Exhibit D.</p>', 
2, (SELECT id FROM clauses WHERE slug = 'MASTER_EF_MILESTONE_REVIEW'), 1210, '["MASTER_EF"]'::jsonb);

INSERT INTO clauses (slug, header_text, body_html, level, parent_id, "order", contract_types) VALUES
('MASTER_EF_NO_OBLIGATION', 'Clarification of "No Obligation" vs Green Light', 
'<p>Notwithstanding anything else, Client''s right to decline to proceed without obligation applies only prior to issuance of the Green Light Production Notice. After Green Light, Client is committed to the Production Phase and payment obligations, subject only to Company''s uncured material default.</p>', 
2, (SELECT id FROM clauses WHERE slug = 'MASTER_EF_MILESTONE_REVIEW'), 1220, '["MASTER_EF"]'::jsonb);


-- ============================================================================
-- LEVEL 2: Subsections (under Default; Termination; Effects)
-- ============================================================================

INSERT INTO clauses (slug, header_text, body_html, level, parent_id, "order", contract_types) VALUES
('MASTER_EF_PAYMENT_DEFAULT', 'Payment Default', 
'<p>Failure to pay amounts due is a default. If not cured within five (5) days after notice, Company may suspend performance and/or terminate the applicable Exhibit A engagement.</p>', 
2, (SELECT id FROM clauses WHERE slug = 'MASTER_EF_DEFAULT_TERMINATION'), 1310, '["MASTER_EF"]'::jsonb);

INSERT INTO clauses (slug, header_text, body_html, level, parent_id, "order", contract_types) VALUES
('MASTER_EF_MATERIAL_BREACH', 'Other Material Breach', 
'<p>Other material breach not cured within ten (10) days after notice (or such shorter period where cure is not possible and the breach is continuing) permits suspension/termination.</p>', 
2, (SELECT id FROM clauses WHERE slug = 'MASTER_EF_DEFAULT_TERMINATION'), 1320, '["MASTER_EF"]'::jsonb);

INSERT INTO clauses (slug, header_text, body_html, level, parent_id, "order", contract_types) VALUES
('MASTER_EF_TERMINATION_CAUSE', 'Termination for Cause', 
'<p>Either Party may terminate for the other Party''s uncured material breach.</p>', 
2, (SELECT id FROM clauses WHERE slug = 'MASTER_EF_DEFAULT_TERMINATION'), 1330, '["MASTER_EF"]'::jsonb);

INSERT INTO clauses (slug, header_text, body_html, level, parent_id, "order", contract_types) VALUES
('MASTER_EF_TERMINATION_PRIOR', 'Termination Prior to Green Light', 
'<p>Prior to issuance of the Green Light Production Notice, Client may elect to terminate the applicable Exhibit A engagement for convenience upon written notice to Company.</p>
<p><strong>Permitting Delay Exit.</strong> If permits are not obtained within 6 months of submission due to factors outside Company''s control, Company may terminate the applicable Exhibit A with notice; Client pays for Services performed and reimbursables incurred to date.</p>', 
2, (SELECT id FROM clauses WHERE slug = 'MASTER_EF_DEFAULT_TERMINATION'), 1340, '["MASTER_EF"]'::jsonb);

INSERT INTO clauses (slug, header_text, body_html, level, parent_id, "order", contract_types) VALUES
('MASTER_EF_TERMINATION_EFFECT', 'Effect of Termination; Survival of Payment Obligations', 
'<p>In the event of Termination hereunder, Client shall remain responsible for payment of (i) all fees for Services performed through the effective date of termination, (ii) all approved reimbursable expenses incurred by Company, and (iii) any non-cancelable third-party costs committed by Company in reliance on this Agreement, as set forth in the applicable Exhibit A. Upon payment of such amounts, neither Party shall have any further obligation with respect to the terminated Exhibit A, except for provisions that by their nature survive termination.</p>', 
2, (SELECT id FROM clauses WHERE slug = 'MASTER_EF_DEFAULT_TERMINATION'), 1350, '["MASTER_EF"]'::jsonb);

INSERT INTO clauses (slug, header_text, body_html, level, parent_id, "order", contract_types) VALUES
('MASTER_EF_WORK_PRODUCT_TERM', 'Work Product Upon Termination', 
'<p>Client''s license to use Work Product is limited to Work Product delivered and paid for through the last paid milestone and solely for the Project.</p>', 
2, (SELECT id FROM clauses WHERE slug = 'MASTER_EF_DEFAULT_TERMINATION'), 1360, '["MASTER_EF"]'::jsonb);


-- ============================================================================
-- LEVEL 2: Subsections (under Dispute Resolution; Governing Law)
-- ============================================================================

INSERT INTO clauses (slug, header_text, body_html, level, parent_id, "order", contract_types) VALUES
('MASTER_EF_MEDIATION', 'Escalation and Mediation', 
'<p>The Parties will first attempt good-faith executive negotiation. If unresolved, the Parties will pursue non-binding mediation in Los Angeles County, California unless otherwise agreed.</p>', 
2, (SELECT id FROM clauses WHERE slug = 'MASTER_EF_DISPUTE_RESOLUTION'), 1410, '["MASTER_EF"]'::jsonb);

INSERT INTO clauses (slug, header_text, body_html, level, parent_id, "order", contract_types) VALUES
('MASTER_EF_ARBITRATION', 'Arbitration', 
'<p>Any dispute not resolved by mediation shall be finally resolved by binding arbitration administered by JAMS in Los Angeles County, California, under its Comprehensive Arbitration Rules. Judgment may be entered in any court of competent jurisdiction.</p>', 
2, (SELECT id FROM clauses WHERE slug = 'MASTER_EF_DISPUTE_RESOLUTION'), 1420, '["MASTER_EF"]'::jsonb);

INSERT INTO clauses (slug, header_text, body_html, level, parent_id, "order", contract_types) VALUES
('MASTER_EF_LIMITATIONS_PERIOD', 'Limitations Period', 
'<p>Any claim must be brought within twelve (12) months after the cause of action accrues, except where a longer period is required by applicable law.</p>', 
2, (SELECT id FROM clauses WHERE slug = 'MASTER_EF_DISPUTE_RESOLUTION'), 1430, '["MASTER_EF"]'::jsonb);

INSERT INTO clauses (slug, header_text, body_html, level, parent_id, "order", contract_types) VALUES
('MASTER_EF_GOVERNING_LAW', 'Governing Law', 
'<p>This Agreement is governed by the laws of the State of California, without regard to conflict-of-laws principles, provided Exhibit F controls where required by other state law for a given Project.</p>', 
2, (SELECT id FROM clauses WHERE slug = 'MASTER_EF_DISPUTE_RESOLUTION'), 1440, '["MASTER_EF"]'::jsonb);


-- ============================================================================
-- LEVEL 2: Subsections (under Miscellaneous)
-- ============================================================================

INSERT INTO clauses (slug, header_text, body_html, level, parent_id, "order", contract_types) VALUES
('MASTER_EF_ENTIRE_AGREEMENT', 'Entire Agreement; Amendments', 
'<p>This Agreement and the Exhibits constitute the entire agreement. Amendments require a writing signed by both Parties. Exhibit A may be amended by a written Exhibit A amendment, provided no amendment modifies {{XREF_BANKABILITY_SUBSECTIONS}} (bankability provisions) unless expressly stated.</p>', 
2, (SELECT id FROM clauses WHERE slug = 'MASTER_EF_MISCELLANEOUS'), 1510, '["MASTER_EF"]'::jsonb);

INSERT INTO clauses (slug, header_text, body_html, level, parent_id, "order", contract_types) VALUES
('MASTER_EF_NOTICES', 'Notices', 
'<p>Notices must be in writing and delivered by personal delivery, overnight courier, or email with confirmed receipt, to the addresses set forth in Exhibit A (or updated by notice).</p>', 
2, (SELECT id FROM clauses WHERE slug = 'MASTER_EF_MISCELLANEOUS'), 1520, '["MASTER_EF"]'::jsonb);

INSERT INTO clauses (slug, header_text, body_html, level, parent_id, "order", contract_types) VALUES
('MASTER_EF_ASSIGNMENT', 'Assignment', 
'<p>Client may not assign this Agreement without Company''s consent. Company may assign to affiliates, successors, and financing parties as provided in {{XREF_ASSIGNMENT_FINANCING}}.</p>', 
2, (SELECT id FROM clauses WHERE slug = 'MASTER_EF_MISCELLANEOUS'), 1530, '["MASTER_EF"]'::jsonb);


-- ============================================================================
-- Create/Update Template and Link Clauses
-- ============================================================================

-- Ensure MASTER_EF template exists
INSERT INTO contract_templates (name, description, contract_type)
VALUES ('Master Exhibit-First ONE Agreement', 'Exhibit-first structure with consolidated deal terms in Exhibit A', 'MASTER_EF')
ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description;

-- Link all MASTER_EF clauses to the template
INSERT INTO template_clauses (template_id, clause_id, sort_order)
SELECT 
  (SELECT id FROM contract_templates WHERE contract_type = 'MASTER_EF' LIMIT 1),
  c.id,
  c."order"
FROM clauses c
WHERE c.contract_types @> '["MASTER_EF"]'::jsonb
ON CONFLICT DO NOTHING;


-- ============================================================================
-- Summary Query (run after to verify)
-- ============================================================================
-- SELECT 
--   level,
--   COUNT(*) as clause_count,
--   STRING_AGG(slug, ', ' ORDER BY "order") as slugs
-- FROM clauses 
-- WHERE contract_types @> '["MASTER_EF"]'::jsonb
-- GROUP BY level
-- ORDER BY level;

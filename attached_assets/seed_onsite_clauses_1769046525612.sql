-- ON-SITE INSTALLATION SUBCONTRACT CLAUSES - Complete Subsection-Level Seeding
-- This creates all clauses for the On-Site Installation Subcontract at subsection granularity

-- Clear existing ONSITE clauses if re-running
DELETE FROM clauses WHERE contract_type = 'ONSITE';

-- ============================================================================
-- SECTION 1: PARTIES & PROJECT
-- ============================================================================

INSERT INTO clauses (clause_code, parent_clause_id, hierarchy_level, sort_order, name, category, contract_type, content, variables_used, conditions, risk_level, negotiable, owner) VALUES

('ONSITE-1', NULL, 1, 100, 'Parties and Project Information', 'parties', 'ONSITE',
'This On-Site Installation Subcontract Agreement is entered into as of {{CONTRACT_DATE}} by and between {{SPV_NAME}}, a {{SPV_STATE}} limited liability company ("Owner"), and {{CONTRACTOR_NAME}} ("Contractor").',
ARRAY['CONTRACT_DATE', 'SPV_NAME', 'SPV_STATE', 'CONTRACTOR_NAME'],
NULL, 'LOW', false, 'legal'),

('ONSITE-1.1', (SELECT id FROM clauses WHERE clause_code = 'ONSITE-1'), 2, 110, 'Owner Information', 'parties', 'ONSITE',
'Owner: {{SPV_NAME}}
State of Formation: {{SPV_STATE}}
Address: {{SPV_ADDRESS}}
EIN: {{SPV_EIN}}',
ARRAY['SPV_NAME', 'SPV_STATE', 'SPV_ADDRESS', 'SPV_EIN'],
NULL, 'LOW', false, 'legal'),

('ONSITE-1.2', (SELECT id FROM clauses WHERE clause_code = 'ONSITE-1'), 2, 120, 'Contractor Information', 'parties', 'ONSITE',
'Contractor: {{CONTRACTOR_NAME}}
License Number: {{CONTRACTOR_LICENSE}}
Address: {{CONTRACTOR_ADDRESS}}
Insurance Policy: {{CONTRACTOR_INSURANCE}}',
ARRAY['CONTRACTOR_NAME', 'CONTRACTOR_LICENSE', 'CONTRACTOR_ADDRESS', 'CONTRACTOR_INSURANCE'],
NULL, 'MEDIUM', false, 'legal'),

('ONSITE-1.3', (SELECT id FROM clauses WHERE clause_code = 'ONSITE-1'), 2, 130, 'Project Site', 'parties', 'ONSITE',
'Project Name: {{PROJECT_NAME}}
Property Address: {{PROPERTY_ADDRESS}}
Legal Description: {{PROPERTY_LEGAL_DESCRIPTION}}
APN: {{PROPERTY_APN}}',
ARRAY['PROJECT_NAME', 'PROPERTY_ADDRESS', 'PROPERTY_LEGAL_DESCRIPTION', 'PROPERTY_APN'],
NULL, 'LOW', false, 'operations');

-- ============================================================================
-- SECTION 2: SCOPE OF ON-SITE WORK
-- ============================================================================

INSERT INTO clauses (clause_code, parent_clause_id, hierarchy_level, sort_order, name, category, contract_type, content, variables_used, conditions, risk_level, negotiable, owner) VALUES

('ONSITE-2', NULL, 1, 200, 'Scope of On-Site Work', 'scope', 'ONSITE',
'Contractor shall perform all on-site work necessary to receive, install, and complete the modular home.',
ARRAY[],
NULL, 'HIGH', false, 'operations'),

('ONSITE-2.1', (SELECT id FROM clauses WHERE clause_code = 'ONSITE-2'), 2, 210, 'Site Preparation', 'scope', 'ONSITE',
'Contractor shall prepare the site including:
- Clearing and grading as required
- Foundation construction per approved plans
- Utility rough-ins to module connection points
- Access road preparation for delivery vehicles',
ARRAY[],
NULL, 'HIGH', false, 'operations'),

('ONSITE-2.2', (SELECT id FROM clauses WHERE clause_code = 'ONSITE-2'), 2, 220, 'Module Installation', 'scope', 'ONSITE',
'Contractor shall:
- Provide crane and rigging services
- Set modules on foundation
- Secure modules structurally
- Complete inter-module connections
- Seal marriage walls and roof sections',
ARRAY[],
NULL, 'HIGH', false, 'operations'),

('ONSITE-2.3', (SELECT id FROM clauses WHERE clause_code = 'ONSITE-2'), 2, 230, 'Site Utilities', 'scope', 'ONSITE',
'Contractor shall complete all utility connections including:
- Water service connection
- Sewer or septic system connection
- Electrical service and panel connection
- Gas service connection (if applicable)
- HVAC startup and commissioning',
ARRAY[],
NULL, 'HIGH', false, 'operations'),

('ONSITE-2.4', (SELECT id FROM clauses WHERE clause_code = 'ONSITE-2'), 2, 240, 'Site Completion Work', 'scope', 'ONSITE',
'Contractor shall complete:
- Exterior skirting and trim
- Decks, stairs, and railings per plans
- Driveway and walkway construction
- Grading and drainage
- Erosion control measures',
ARRAY[],
NULL, 'MEDIUM', true, 'operations'),

('ONSITE-2.5-CRC', (SELECT id FROM clauses WHERE clause_code = 'ONSITE-2'), 2, 250, 'CRC Additional Services', 'scope', 'ONSITE',
'Under the CRC model, Contractor shall also provide project management, permit coordination, inspection scheduling, and final certificate of occupancy.',
ARRAY['SERVICE_MODEL'],
'{"SERVICE_MODEL": "CRC"}'::jsonb, 'HIGH', false, 'operations'),

('ONSITE-2.6-CMOS', (SELECT id FROM clauses WHERE clause_code = 'ONSITE-2'), 2, 251, 'CMOS Coordination', 'scope', 'ONSITE',
'Under the CMOS model, Contractor shall coordinate with Owner and Manufacturer for delivery scheduling and module acceptance inspection.',
ARRAY['SERVICE_MODEL'],
'{"SERVICE_MODEL": "CMOS"}'::jsonb, 'MEDIUM', false, 'operations'),

('ONSITE-2.7', (SELECT id FROM clauses WHERE clause_code = 'ONSITE-2'), 2, 260, 'Included Services Detail', 'scope', 'ONSITE',
'The following services are included in the Contract Price:
{{INCLUDED_SERVICES}}',
ARRAY['INCLUDED_SERVICES'],
NULL, 'HIGH', true, 'operations'),

('ONSITE-2.8', (SELECT id FROM clauses WHERE clause_code = 'ONSITE-2'), 2, 270, 'Excluded Services', 'scope', 'ONSITE',
'The following items are specifically excluded from Contractor''s scope:
{{EXCLUDED_SERVICES}}',
ARRAY['EXCLUDED_SERVICES'],
NULL, 'HIGH', true, 'operations');

-- ============================================================================
-- SECTION 3: CONTRACT PRICE AND PAYMENT
-- ============================================================================

INSERT INTO clauses (clause_code, parent_clause_id, hierarchy_level, sort_order, name, category, contract_type, content, variables_used, conditions, risk_level, negotiable, owner) VALUES

('ONSITE-3', NULL, 1, 300, 'Contract Price and Payment Terms', 'financial', 'ONSITE',
'The total Contract Price for on-site work is {{ONSITE_CONTRACT_PRICE}}, payable per the schedule below.',
ARRAY['ONSITE_CONTRACT_PRICE'],
NULL, 'HIGH', false, 'finance'),

('ONSITE-3.1', (SELECT id FROM clauses WHERE clause_code = 'ONSITE-3'), 2, 310, 'Mobilization Payment', 'financial', 'ONSITE',
'Owner shall pay mobilization deposit of {{ONSITE_DEPOSIT}} upon execution and prior to Contractor beginning site work.',
ARRAY['ONSITE_DEPOSIT'],
NULL, 'HIGH', false, 'finance'),

('ONSITE-3.2', (SELECT id FROM clauses WHERE clause_code = 'ONSITE-3'), 2, 320, 'Progress Payment Schedule', 'financial', 'ONSITE',
'Progress payments due upon completion and inspection of the following milestones:

Milestone 1: {{MILESTONE_1_DESCRIPTION}} - {{MILESTONE_1_AMOUNT}} ({{MILESTONE_1_PERCENTAGE}}%)
Milestone 2: {{MILESTONE_2_DESCRIPTION}} - {{MILESTONE_2_AMOUNT}} ({{MILESTONE_2_PERCENTAGE}}%)
Milestone 3: {{MILESTONE_3_DESCRIPTION}} - {{MILESTONE_3_AMOUNT}} ({{MILESTONE_3_PERCENTAGE}}%)',
ARRAY['MILESTONE_1_DESCRIPTION', 'MILESTONE_1_AMOUNT', 'MILESTONE_1_PERCENTAGE',
      'MILESTONE_2_DESCRIPTION', 'MILESTONE_2_AMOUNT', 'MILESTONE_2_PERCENTAGE',
      'MILESTONE_3_DESCRIPTION', 'MILESTONE_3_AMOUNT', 'MILESTONE_3_PERCENTAGE'],
NULL, 'HIGH', false, 'finance'),

('ONSITE-3.3', (SELECT id FROM clauses WHERE clause_code = 'ONSITE-3'), 2, 330, 'Retainage', 'financial', 'ONSITE',
'Owner shall retain {{RETAINAGE_PERCENTAGE}}% ({{RETAINAGE_AMOUNT}}) from each progress payment until substantial completion and release of liens.',
ARRAY['RETAINAGE_PERCENTAGE', 'RETAINAGE_AMOUNT'],
NULL, 'MEDIUM', true, 'finance'),

('ONSITE-3.4', (SELECT id FROM clauses WHERE clause_code = 'ONSITE-3'), 2, 340, 'Final Payment', 'financial', 'ONSITE',
'Final payment including retained amounts is due within 30 days after substantial completion, final inspection approval, delivery of required documentation, and release of all liens.',
ARRAY[],
NULL, 'HIGH', false, 'finance'),

('ONSITE-3.5', (SELECT id FROM clauses WHERE clause_code = 'ONSITE-3'), 2, 350, 'Progress Payment Documentation', 'financial', 'ONSITE',
'Contractor shall submit applications for payment with supporting documentation including: photographs of completed work, lien releases from subcontractors and suppliers, and copies of inspection approvals.',
ARRAY[],
NULL, 'MEDIUM', false, 'finance'),

('ONSITE-3.6', (SELECT id FROM clauses WHERE clause_code = 'ONSITE-3'), 2, 360, 'Payment Terms', 'financial', 'ONSITE',
'Payment is due within 10 business days of approved invoice. Late payments accrue interest at 1.5% per month or maximum legal rate.',
ARRAY[],
NULL, 'LOW', false, 'finance');

-- ============================================================================
-- SECTION 4: SCHEDULE AND COMPLETION
-- ============================================================================

INSERT INTO clauses (clause_code, parent_clause_id, hierarchy_level, sort_order, name, category, contract_type, content, variables_used, conditions, risk_level, negotiable, owner) VALUES

('ONSITE-4', NULL, 1, 400, 'Project Schedule and Completion', 'schedule', 'ONSITE',
'Contractor shall complete the on-site work according to the following schedule.',
ARRAY[],
NULL, 'MEDIUM', false, 'operations'),

('ONSITE-4.1', (SELECT id FROM clauses WHERE clause_code = 'ONSITE-4'), 2, 410, 'Commencement and Substantial Completion', 'schedule', 'ONSITE',
'On-Site Work Start: {{ONSITE_START_DATE}}
Substantial Completion: Within {{SUBSTANTIAL_COMPLETION_DAYS}} calendar days from commencement

Substantial Completion means work is sufficiently complete for Owner occupancy with only minor punch list items remaining.',
ARRAY['ONSITE_START_DATE', 'SUBSTANTIAL_COMPLETION_DAYS'],
NULL, 'MEDIUM', true, 'operations'),

('ONSITE-4.2', (SELECT id FROM clauses WHERE clause_code = 'ONSITE-4'), 2, 420, 'Module Delivery Coordination', 'schedule', 'ONSITE',
'Contractor shall coordinate with Manufacturer for module delivery. Site must be ready for module placement by {{MFG_DELIVERY_DATE}}. Contractor is responsible for crane, rigging, and unloading crew.',
ARRAY['MFG_DELIVERY_DATE'],
NULL, 'HIGH', false, 'operations'),

('ONSITE-4.3', (SELECT id FROM clauses WHERE clause_code = 'ONSITE-4'), 2, 430, 'Schedule Adjustments', 'schedule', 'ONSITE',
'The schedule may be extended for: adverse weather preventing work, change orders, Owner delays, unforeseen site conditions, permit delays, or force majeure. Contractor shall provide written notice of delays within 5 days.',
ARRAY[],
NULL, 'MEDIUM', false, 'operations'),

('ONSITE-4.4', (SELECT id FROM clauses WHERE clause_code = 'ONSITE-4'), 2, 440, 'Punch List Completion', 'schedule', 'ONSITE',
'Contractor shall complete punch list items within {{PUNCH_LIST_DEADLINE_DAYS}} days of substantial completion inspection.',
ARRAY['PUNCH_LIST_DEADLINE_DAYS'],
NULL, 'MEDIUM', false, 'operations'),

('ONSITE-4.5', (SELECT id FROM clauses WHERE clause_code = 'ONSITE-4'), 2, 450, 'Work Hours', 'schedule', 'ONSITE',
'Work shall be performed during normal business hours unless otherwise approved by Owner. No work on Sundays or holidays without prior written consent.',
ARRAY[],
NULL, 'LOW', false, 'operations');

-- ============================================================================
-- SECTION 5: PERMITS AND INSPECTIONS
-- ============================================================================

INSERT INTO clauses (clause_code, parent_clause_id, hierarchy_level, sort_order, name, category, contract_type, content, variables_used, conditions, risk_level, negotiable, owner) VALUES

('ONSITE-5', NULL, 1, 500, 'Permits and Inspections', 'compliance', 'ONSITE',
'Responsibility for permits and inspections is as follows.',
ARRAY[],
NULL, 'HIGH', false, 'legal'),

('ONSITE-5.1-CRC', (SELECT id FROM clauses WHERE clause_code = 'ONSITE-5'), 2, 510, 'CRC Permit Responsibility', 'compliance', 'ONSITE',
'Under the CRC model, Contractor shall obtain and pay for all on-site building permits, utility permits, and required inspections.',
ARRAY['SERVICE_MODEL'],
'{"SERVICE_MODEL": "CRC"}'::jsonb, 'HIGH', false, 'operations'),

('ONSITE-5.1-CMOS', (SELECT id FROM clauses WHERE clause_code = 'ONSITE-5'), 2, 511, 'CMOS Permit Responsibility', 'compliance', 'ONSITE',
'Under the CMOS model, Owner is responsible for obtaining on-site permits. Contractor shall provide necessary documentation and coordinate inspections.',
ARRAY['SERVICE_MODEL'],
'{"SERVICE_MODEL": "CMOS"}'::jsonb, 'HIGH', false, 'operations'),

('ONSITE-5.2', (SELECT id FROM clauses WHERE clause_code = 'ONSITE-5'), 2, 520, 'Code Compliance', 'compliance', 'ONSITE',
'All work shall comply with {{BUILDING_CODE_YEAR}} building codes and local amendments. Contractor shall correct any work that fails inspection at no additional cost to Owner.',
ARRAY['BUILDING_CODE_YEAR'],
NULL, 'HIGH', false, 'legal'),

('ONSITE-5.3', (SELECT id FROM clauses WHERE clause_code = 'ONSITE-5'), 2, 530, 'Inspection Scheduling', 'compliance', 'ONSITE',
'Contractor shall schedule all required inspections and notify Owner 48 hours in advance. Owner or Owner''s representative may attend inspections.',
ARRAY[],
NULL, 'MEDIUM', false, 'operations'),

('ONSITE-5.4', (SELECT id FROM clauses WHERE clause_code = 'ONSITE-5'), 2, 540, 'Final Certificate of Occupancy', 'compliance', 'ONSITE',
'Contractor shall coordinate final inspections and obtain certificate of occupancy or equivalent approval for Owner occupancy.',
ARRAY[],
NULL, 'HIGH', false, 'operations');

-- ============================================================================
-- SECTION 6: INSURANCE AND BONDING
-- ============================================================================

INSERT INTO clauses (clause_code, parent_clause_id, hierarchy_level, sort_order, name, category, contract_type, content, variables_used, conditions, risk_level, negotiable, owner) VALUES

('ONSITE-6', NULL, 1, 600, 'Insurance and Bonding Requirements', 'insurance', 'ONSITE',
'Contractor shall maintain the following insurance coverage.',
ARRAY[],
NULL, 'HIGH', false, 'legal'),

('ONSITE-6.1', (SELECT id FROM clauses WHERE clause_code = 'ONSITE-6'), 2, 610, 'Commercial General Liability', 'insurance', 'ONSITE',
'Contractor shall maintain CGL insurance with minimum limits of {{LIABILITY_LIMIT}} per occurrence, naming Owner as additional insured.',
ARRAY['LIABILITY_LIMIT'],
NULL, 'HIGH', false, 'legal'),

('ONSITE-6.2', (SELECT id FROM clauses WHERE clause_code = 'ONSITE-6'), 2, 620, 'Workers Compensation', 'insurance', 'ONSITE',
'Contractor shall maintain workers compensation insurance as required by law covering all employees and subcontractors.',
ARRAY[],
NULL, 'HIGH', false, 'legal'),

('ONSITE-6.3', (SELECT id FROM clauses WHERE clause_code = 'ONSITE-6'), 2, 630, 'Auto Liability', 'insurance', 'ONSITE',
'Contractor shall maintain commercial auto liability insurance covering all vehicles used on the project.',
ARRAY[],
NULL, 'MEDIUM', false, 'legal'),

('ONSITE-6.4', (SELECT id FROM clauses WHERE clause_code = 'ONSITE-6'), 2, 640, 'Builder Risk Insurance', 'insurance', 'ONSITE',
'Owner shall maintain builder''s risk insurance covering the project during construction. Contractor shall be named as loss payee for work in place.',
ARRAY[],
NULL, 'MEDIUM', false, 'legal'),

('ONSITE-6.5-BOND', (SELECT id FROM clauses WHERE clause_code = 'ONSITE-6'), 2, 650, 'Performance Bond', 'insurance', 'ONSITE',
'Contractor shall provide a performance bond in the amount of {{BOND_AMOUNT}} from an approved surety company.',
ARRAY['BOND_AMOUNT', 'BOND_REQUIRED'],
'{"BOND_REQUIRED": true}'::jsonb, 'HIGH', false, 'legal'),

('ONSITE-6.6', (SELECT id FROM clauses WHERE clause_code = 'ONSITE-6'), 2, 660, 'Insurance Certificates', 'insurance', 'ONSITE',
'Contractor shall provide certificates of insurance to Owner prior to commencing work and maintain coverage throughout the project.',
ARRAY[],
NULL, 'MEDIUM', false, 'legal');

-- ============================================================================
-- SECTION 7: QUALITY AND WORKMANSHIP
-- ============================================================================

INSERT INTO clauses (clause_code, parent_clause_id, hierarchy_level, sort_order, name, category, contract_type, content, variables_used, conditions, risk_level, negotiable, owner) VALUES

('ONSITE-7', NULL, 1, 700, 'Quality Standards and Workmanship', 'quality', 'ONSITE',
'All work shall be performed in a professional and workmanlike manner.',
ARRAY[],
NULL, 'HIGH', false, 'operations'),

('ONSITE-7.1', (SELECT id FROM clauses WHERE clause_code = 'ONSITE-7'), 2, 710, 'Standard of Care', 'quality', 'ONSITE',
'Contractor shall perform work in accordance with industry standards, manufacturer specifications, and approved plans. All work shall meet or exceed code requirements.',
ARRAY[],
NULL, 'HIGH', false, 'operations'),

('ONSITE-7.2', (SELECT id FROM clauses WHERE clause_code = 'ONSITE-7'), 2, 720, 'Materials and Equipment', 'quality', 'ONSITE',
'All materials shall be new, of good quality, and suitable for intended purpose. Contractor shall provide manufacturer certifications and warranties as requested.',
ARRAY[],
NULL, 'MEDIUM', false, 'operations'),

('ONSITE-7.3', (SELECT id FROM clauses WHERE clause_code = 'ONSITE-7'), 2, 730, 'Inspection Access', 'quality', 'ONSITE',
'Contractor shall provide Owner and inspectors with access to the work. Contractor shall notify Owner of inspection points defined in {{INSPECTION_POINTS}}.',
ARRAY['INSPECTION_POINTS'],
NULL, 'MEDIUM', false, 'operations'),

('ONSITE-7.4', (SELECT id FROM clauses WHERE clause_code = 'ONSITE-7'), 2, 740, 'Defective Work Correction', 'quality', 'ONSITE',
'Contractor shall promptly correct any work that does not conform to contract requirements at no cost to Owner, including work covered up before inspection.',
ARRAY[],
NULL, 'HIGH', false, 'operations'),

('ONSITE-7.5', (SELECT id FROM clauses WHERE clause_code = 'ONSITE-7'), 2, 750, 'Substantial Completion Standards', 'quality', 'ONSITE',
'Work shall meet the acceptance criteria defined in {{ACCEPTANCE_CRITERIA}} to achieve substantial completion.',
ARRAY['ACCEPTANCE_CRITERIA'],
NULL, 'HIGH', false, 'operations');

-- ============================================================================
-- SECTION 8: CHANGE ORDERS
-- ============================================================================

INSERT INTO clauses (clause_code, parent_clause_id, hierarchy_level, sort_order, name, category, contract_type, content, variables_used, conditions, risk_level, negotiable, owner) VALUES

('ONSITE-8', NULL, 1, 800, 'Changes to the Work', 'change_orders', 'ONSITE',
'Changes to the scope of work require written Change Orders.',
ARRAY[],
NULL, 'MEDIUM', false, 'operations'),

('ONSITE-8.1', (SELECT id FROM clauses WHERE clause_code = 'ONSITE-8'), 2, 810, 'Change Order Process', 'change_orders', 'ONSITE',
'Either party may propose changes. Contractor shall provide written proposal including cost and schedule impact within {{CHANGE_ORDER_NOTICE_DAYS}} days of request.',
ARRAY['CHANGE_ORDER_NOTICE_DAYS'],
NULL, 'MEDIUM', false, 'operations'),

('ONSITE-8.2', (SELECT id FROM clauses WHERE clause_code = 'ONSITE-8'), 2, 820, 'Change Order Pricing', 'change_orders', 'ONSITE',
'Change orders shall be priced at Contractor''s actual costs (materials, labor, equipment, subcontractors) plus {{CHANGE_ORDER_MARKUP}}% markup for overhead and profit.',
ARRAY['CHANGE_ORDER_MARKUP'],
NULL, 'MEDIUM', true, 'finance'),

('ONSITE-8.3', (SELECT id FROM clauses WHERE clause_code = 'ONSITE-8'), 2, 830, 'Written Authorization Required', 'change_orders', 'ONSITE',
'No change to scope, cost, or schedule shall be implemented without a fully executed Change Order signed by both parties.',
ARRAY[],
NULL, 'HIGH', false, 'operations'),

('ONSITE-8.4', (SELECT id FROM clauses WHERE clause_code = 'ONSITE-8'), 2, 840, 'Field Directives', 'change_orders', 'ONSITE',
'In case of emergency or minor field adjustments under $500, Owner may issue field directive. Contractor shall document and include in next payment application.',
ARRAY[],
NULL, 'LOW', false, 'operations'),

('ONSITE-8.5', (SELECT id FROM clauses WHERE clause_code = 'ONSITE-8'), 2, 850, 'Unforeseen Conditions', 'change_orders', 'ONSITE',
'If Contractor encounters concealed or unknown conditions materially differing from contract documents, Contractor shall notify Owner immediately and may be entitled to adjustment in price or schedule.',
ARRAY[],
NULL, 'MEDIUM', false, 'operations');

-- ============================================================================
-- SECTION 9: WARRANTY
-- ============================================================================

INSERT INTO clauses (clause_code, parent_clause_id, hierarchy_level, sort_order, name, category, contract_type, content, variables_used, conditions, risk_level, negotiable, owner) VALUES

('ONSITE-9', NULL, 1, 900, 'Contractor Warranty', 'warranty', 'ONSITE',
'Contractor warrants the quality and conformance of on-site work.',
ARRAY[],
NULL, 'HIGH', false, 'legal'),

('ONSITE-9.1', (SELECT id FROM clauses WHERE clause_code = 'ONSITE-9'), 2, 910, 'Workmanship Warranty', 'warranty', 'ONSITE',
'Contractor warrants all on-site work against defects in materials and workmanship for {{WORKMANSHIP_WARRANTY_YEARS}} year(s) from the date of substantial completion.',
ARRAY['WORKMANSHIP_WARRANTY_YEARS'],
NULL, 'HIGH', false, 'legal'),

('ONSITE-9.2', (SELECT id FROM clauses WHERE clause_code = 'ONSITE-9'), 2, 920, 'Warranty Start Date', 'warranty', 'ONSITE',
'Warranty period begins on {{WARRANTY_START_DATE}}, the date of substantial completion and Owner occupancy.',
ARRAY['WARRANTY_START_DATE'],
NULL, 'MEDIUM', false, 'legal'),

('ONSITE-9.3', (SELECT id FROM clauses WHERE clause_code = 'ONSITE-9'), 2, 930, 'Warranty Coverage', 'warranty', 'ONSITE',
'Warranty covers foundation, site utilities, installation connections, exterior completion work, and all on-site improvements performed by Contractor.',
ARRAY[],
NULL, 'HIGH', false, 'legal'),

('ONSITE-9.4', (SELECT id FROM clauses WHERE clause_code = 'ONSITE-9'), 2, 940, 'Warranty Exclusions', 'warranty', 'ONSITE',
'Warranty does not cover: damage from Owner misuse or negligence, modifications by others, normal wear and tear, damage from failure to maintain, or damage from acts of nature.',
ARRAY[],
NULL, 'MEDIUM', false, 'legal'),

('ONSITE-9.5', (SELECT id FROM clauses WHERE clause_code = 'ONSITE-9'), 2, 950, 'Warranty Claims Procedure', 'warranty', 'ONSITE',
'Owner shall notify Contractor in writing of any warranty claim within 30 days of discovery. Contractor shall inspect and repair defects within reasonable time.',
ARRAY[],
NULL, 'MEDIUM', false, 'legal'),

('ONSITE-9.6', (SELECT id FROM clauses WHERE clause_code = 'ONSITE-9'), 2, 960, 'Manufacturer Warranties', 'warranty', 'ONSITE',
'Materials and equipment are covered by manufacturer warranties which Contractor shall assign to Owner. Contractor makes no warranty beyond manufacturer coverage.',
ARRAY[],
NULL, 'LOW', false, 'legal'),

('ONSITE-9.7', (SELECT id FROM clauses WHERE clause_code = 'ONSITE-9'), 2, 970, 'Exclusive Remedy', 'warranty', 'ONSITE',
'Repair or replacement of defective work is Owner''s sole remedy. Contractor is not liable for consequential or incidental damages.',
ARRAY[],
NULL, 'HIGH', false, 'legal');

-- ============================================================================
-- SECTION 10: SITE SAFETY AND CLEANUP
-- ============================================================================

INSERT INTO clauses (clause_code, parent_clause_id, hierarchy_level, sort_order, name, category, contract_type, content, variables_used, conditions, risk_level, negotiable, owner) VALUES

('ONSITE-10', NULL, 1, 1000, 'Site Safety and Maintenance', 'safety', 'ONSITE',
'Contractor is responsible for maintaining a safe and clean work site.',
ARRAY[],
NULL, 'HIGH', false, 'operations'),

('ONSITE-10.1', (SELECT id FROM clauses WHERE clause_code = 'ONSITE-10'), 2, 1010, 'Safety Compliance', 'safety', 'ONSITE',
'Contractor shall comply with all OSHA regulations and maintain a safety program. Contractor is responsible for safety of all personnel on site.',
ARRAY[],
NULL, 'HIGH', false, 'operations'),

('ONSITE-10.2', (SELECT id FROM clauses WHERE clause_code = 'ONSITE-10'), 2, 1020, 'Site Security', 'safety', 'ONSITE',
'Contractor shall secure the site against unauthorized entry and protect work in progress from damage, theft, or vandalism.',
ARRAY[],
NULL, 'MEDIUM', false, 'operations'),

('ONSITE-10.3', (SELECT id FROM clauses WHERE clause_code = 'ONSITE-10'), 2, 1030, 'Daily Cleanup', 'safety', 'ONSITE',
'Contractor shall maintain site in orderly condition, removing debris and waste regularly. Site shall be broom-clean at end of each workday.',
ARRAY[],
NULL, 'LOW', false, 'operations'),

('ONSITE-10.4', (SELECT id FROM clauses WHERE clause_code = 'ONSITE-10'), 2, 1040, 'Final Cleanup', 'safety', 'ONSITE',
'Upon completion, Contractor shall remove all equipment, materials, and debris, leaving the site and home clean and ready for occupancy.',
ARRAY[],
NULL, 'MEDIUM', false, 'operations'),

('ONSITE-10.5', (SELECT id FROM clauses WHERE clause_code = 'ONSITE-10'), 2, 1050, 'Environmental Protection', 'safety', 'ONSITE',
'Contractor shall comply with environmental regulations including erosion control, storm water management, and proper waste disposal.',
ARRAY[],
NULL, 'MEDIUM', false, 'operations');

-- ============================================================================
-- SECTION 11: TERMINATION
-- ============================================================================

INSERT INTO clauses (clause_code, parent_clause_id, hierarchy_level, sort_order, name, category, contract_type, content, variables_used, conditions, risk_level, negotiable, owner) VALUES

('ONSITE-11', NULL, 1, 1100, 'Termination', 'termination', 'ONSITE',
'This Agreement may be terminated under the following circumstances.',
ARRAY[],
NULL, 'HIGH', false, 'legal'),

('ONSITE-11.1', (SELECT id FROM clauses WHERE clause_code = 'ONSITE-11'), 2, 1110, 'Termination by Owner for Cause', 'termination', 'ONSITE',
'Owner may terminate for cause if Contractor: fails to perform work, fails to maintain insurance or bonds, violates safety requirements, or materially breaches this Agreement. Contractor has 10 days to cure after written notice.',
ARRAY[],
NULL, 'HIGH', false, 'legal'),

('ONSITE-11.2', (SELECT id FROM clauses WHERE clause_code = 'ONSITE-11'), 2, 1120, 'Termination by Contractor for Cause', 'termination', 'ONSITE',
'Contractor may terminate if Owner fails to make payment or materially breaches this Agreement. Owner has 15 days to cure after written notice.',
ARRAY[],
NULL, 'HIGH', false, 'legal'),

('ONSITE-11.3', (SELECT id FROM clauses WHERE clause_code = 'ONSITE-11'), 2, 1130, 'Termination for Convenience', 'termination', 'ONSITE',
'Owner may terminate for convenience upon 15 days written notice. Owner shall pay for completed work, materials ordered, demobilization costs, and 10% of remaining contract balance.',
ARRAY[],
NULL, 'HIGH', true, 'legal'),

('ONSITE-11.4', (SELECT id FROM clauses WHERE clause_code = 'ONSITE-11'), 2, 1140, 'Rights Upon Termination', 'termination', 'ONSITE',
'Upon termination, Contractor shall cease work, secure the site, remove equipment, and submit final invoice. Owner shall pay undisputed amounts within 30 days.',
ARRAY[],
NULL, 'MEDIUM', false, 'legal');

-- ============================================================================
-- SECTION 12: DISPUTE RESOLUTION
-- ============================================================================

INSERT INTO clauses (clause_code, parent_clause_id, hierarchy_level, sort_order, name, category, contract_type, content, variables_used, conditions, risk_level, negotiable, owner) VALUES

('ONSITE-12', NULL, 1, 1200, 'Dispute Resolution', 'dispute', 'ONSITE',
'Disputes shall be resolved through the following process.',
ARRAY[],
NULL, 'MEDIUM', false, 'legal'),

('ONSITE-12.1', (SELECT id FROM clauses WHERE clause_code = 'ONSITE-12'), 2, 1210, 'Direct Negotiation', 'dispute', 'ONSITE',
'Parties shall first attempt resolution through good faith negotiations between principals.',
ARRAY[],
NULL, 'LOW', false, 'legal'),

('ONSITE-12.2', (SELECT id FROM clauses WHERE clause_code = 'ONSITE-12'), 2, 1220, 'Mediation', 'dispute', 'ONSITE',
'If negotiation fails, parties shall mediate before a mutually agreed mediator. Mediation costs shared equally.',
ARRAY[],
NULL, 'MEDIUM', false, 'legal'),

('ONSITE-12.3', (SELECT id FROM clauses WHERE clause_code = 'ONSITE-12'), 2, 1230, 'Binding Arbitration', 'dispute', 'ONSITE',
'Unresolved disputes shall be decided by binding arbitration under AAA Construction Industry Rules. Decision is final and binding on both parties.',
ARRAY[],
NULL, 'HIGH', true, 'legal'),

('ONSITE-12.4', (SELECT id FROM clauses WHERE clause_code = 'ONSITE-12'), 2, 1240, 'Governing Law and Venue', 'dispute', 'ONSITE',
'This Agreement is governed by laws of {{JURISDICTION}}. Any litigation shall be in courts of {{JURISDICTION}}.',
ARRAY['JURISDICTION'],
NULL, 'MEDIUM', false, 'legal'),

('ONSITE-12.5', (SELECT id FROM clauses WHERE clause_code = 'ONSITE-12'), 2, 1250, 'Attorney Fees', 'dispute', 'ONSITE',
'Prevailing party in any dispute shall recover reasonable attorney fees and costs.',
ARRAY[],
NULL, 'MEDIUM', true, 'legal'),

('ONSITE-12.6', (SELECT id FROM clauses WHERE clause_code = 'ONSITE-12'), 2, 1260, 'Continuation of Work', 'dispute', 'ONSITE',
'Except in case of termination, Contractor shall continue performing while dispute is being resolved.',
ARRAY[],
NULL, 'MEDIUM', false, 'legal');

-- ============================================================================
-- SECTION 13: GENERAL PROVISIONS
-- ============================================================================

INSERT INTO clauses (clause_code, parent_clause_id, hierarchy_level, sort_order, name, category, contract_type, content, variables_used, conditions, risk_level, negotiable, owner) VALUES

('ONSITE-13', NULL, 1, 1300, 'General Provisions', 'general', 'ONSITE',
'Standard contractual provisions apply.',
ARRAY[],
NULL, 'LOW', false, 'legal'),

('ONSITE-13.1', (SELECT id FROM clauses WHERE clause_code = 'ONSITE-13'), 2, 1310, 'Entire Agreement', 'general', 'ONSITE',
'This Subcontract and referenced documents constitute the entire agreement and supersede all prior negotiations.',
ARRAY[],
NULL, 'LOW', false, 'legal'),

('ONSITE-13.2', (SELECT id FROM clauses WHERE clause_code = 'ONSITE-13'), 2, 1320, 'Amendments', 'general', 'ONSITE',
'This Agreement may be amended only by written instrument signed by both parties.',
ARRAY[],
NULL, 'LOW', false, 'legal'),

('ONSITE-13.3', (SELECT id FROM clauses WHERE clause_code = 'ONSITE-13'), 2, 1330, 'Assignment', 'general', 'ONSITE',
'Neither party may assign this Agreement without prior written consent of the other party.',
ARRAY[],
NULL, 'MEDIUM', false, 'legal'),

('ONSITE-13.4', (SELECT id FROM clauses WHERE clause_code = 'ONSITE-13'), 2, 1340, 'Subcontracting', 'general', 'ONSITE',
'Contractor may subcontract portions of work with Owner approval. Contractor remains fully responsible for subcontractor performance.',
ARRAY[],
NULL, 'MEDIUM', false, 'operations'),

('ONSITE-13.5', (SELECT id FROM clauses WHERE clause_code = 'ONSITE-13'), 2, 1350, 'Notices', 'general', 'ONSITE',
'All notices shall be in writing to addresses specified in Section 1.',
ARRAY[],
NULL, 'LOW', false, 'legal'),

('ONSITE-13.6', (SELECT id FROM clauses WHERE clause_code = 'ONSITE-13'), 2, 1360, 'Severability', 'general', 'ONSITE',
'If any provision is invalid, remaining provisions continue in full effect.',
ARRAY[],
NULL, 'LOW', false, 'legal'),

('ONSITE-13.7', (SELECT id FROM clauses WHERE clause_code = 'ONSITE-13'), 2, 1370, 'Waiver', 'general', 'ONSITE',
'No waiver of any provision is effective unless in writing. Waiver of one breach does not waive future breaches.',
ARRAY[],
NULL, 'LOW', false, 'legal'),

('ONSITE-13.8', (SELECT id FROM clauses WHERE clause_code = 'ONSITE-13'), 2, 1380, 'Force Majeure', 'general', 'ONSITE',
'Neither party liable for delays due to causes beyond reasonable control. Affected party shall give prompt notice and minimize delays.',
ARRAY[],
NULL, 'MEDIUM', false, 'legal'),

('ONSITE-13.9', (SELECT id FROM clauses WHERE clause_code = 'ONSITE-13'), 2, 1390, 'Indemnification', 'general', 'ONSITE',
'Each party shall indemnify the other against claims arising from its negligent acts or omissions in performance of this Agreement.',
ARRAY[],
NULL, 'HIGH', false, 'legal');

-- ============================================================================
-- SECTION 14: SIGNATURES
-- ============================================================================

INSERT INTO clauses (clause_code, parent_clause_id, hierarchy_level, sort_order, name, category, contract_type, content, variables_used, conditions, risk_level, negotiable, owner) VALUES

('ONSITE-14', NULL, 1, 1400, 'Execution', 'execution', 'ONSITE',
'IN WITNESS WHEREOF, the parties execute this On-Site Installation Subcontract.',
ARRAY[],
NULL, 'LOW', false, 'legal'),

('ONSITE-14.1', (SELECT id FROM clauses WHERE clause_code = 'ONSITE-14'), 2, 1410, 'Owner Signature', 'execution', 'ONSITE',
'OWNER:
{{SPV_NAME}}

By: _______________________
Name: _______________________
Title: Managing Member
Date: _______________________',
ARRAY['SPV_NAME'],
NULL, 'LOW', false, 'legal'),

('ONSITE-14.2', (SELECT id FROM clauses WHERE clause_code = 'ONSITE-14'), 2, 1420, 'Contractor Signature', 'execution', 'ONSITE',
'CONTRACTOR:
{{CONTRACTOR_NAME}}

By: _______________________
Name: _______________________
Title: _______________________
License #: {{CONTRACTOR_LICENSE}}
Date: _______________________',
ARRAY['CONTRACTOR_NAME', 'CONTRACTOR_LICENSE'],
NULL, 'LOW', false, 'legal');

-- Create performance indexes
CREATE INDEX IF NOT EXISTS idx_onsite_clauses_sort ON clauses(contract_type, sort_order) WHERE contract_type = 'ONSITE';
CREATE INDEX IF NOT EXISTS idx_onsite_clauses_hierarchy ON clauses(contract_type, hierarchy_level) WHERE contract_type = 'ONSITE';
CREATE INDEX IF NOT EXISTS idx_onsite_clauses_category ON clauses(contract_type, category) WHERE contract_type = 'ONSITE';

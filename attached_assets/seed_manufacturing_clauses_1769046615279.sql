-- MANUFACTURING SUBCONTRACT CLAUSES - Complete Subsection-Level Seeding
-- This creates all clauses for the Manufacturing Subcontract at subsection granularity

-- Clear existing MANUFACTURING clauses if re-running
DELETE FROM clauses WHERE contract_type = 'MANUFACTURING';

-- ============================================================================
-- SECTION 1: PARTIES & RECITALS
-- ============================================================================

INSERT INTO clauses (clause_code, parent_clause_id, hierarchy_level, sort_order, name, category, contract_type, content, variables_used, conditions, risk_level, negotiable, owner) VALUES

('MFG-1', NULL, 1, 100, 'Parties and Recitals', 'parties', 'MANUFACTURING',
'This Manufacturing Subcontract Agreement is entered into as of {{CONTRACT_DATE}} by and between {{SPV_NAME}}, a {{SPV_STATE}} limited liability company ("Owner"), and Dvele Manufacturing, LLC, a California limited liability company ("Manufacturer").',
ARRAY['CONTRACT_DATE', 'SPV_NAME', 'SPV_STATE'],
NULL, 'LOW', false, 'legal'),

('MFG-1.1', (SELECT id FROM clauses WHERE clause_code = 'MFG-1'), 2, 110, 'Owner Information', 'parties', 'MANUFACTURING',
'Owner: {{SPV_NAME}}
State of Formation: {{SPV_STATE}}
Address: {{SPV_ADDRESS}}
EIN: {{SPV_EIN}}',
ARRAY['SPV_NAME', 'SPV_STATE', 'SPV_ADDRESS', 'SPV_EIN'],
NULL, 'LOW', false, 'legal'),

('MFG-1.2', (SELECT id FROM clauses WHERE clause_code = 'MFG-1'), 2, 120, 'Manufacturer Information', 'parties', 'MANUFACTURING',
'Manufacturer: Dvele Manufacturing, LLC
Address: {{DVELE_MFG_ADDRESS}}
Contact: {{DVELE_MFG_CONTACT}}',
ARRAY['DVELE_MFG_ADDRESS', 'DVELE_MFG_CONTACT'],
NULL, 'LOW', false, 'legal'),

('MFG-1.3', (SELECT id FROM clauses WHERE clause_code = 'MFG-1'), 2, 130, 'Project Reference', 'parties', 'MANUFACTURING',
'This Subcontract is for the manufacturing of a modular home for the following project:
Project Name: {{PROJECT_NAME}}
Delivery Address: {{PROPERTY_ADDRESS}}',
ARRAY['PROJECT_NAME', 'PROPERTY_ADDRESS'],
NULL, 'LOW', false, 'operations');

-- ============================================================================
-- SECTION 2: SCOPE OF MANUFACTURING WORK
-- ============================================================================

INSERT INTO clauses (clause_code, parent_clause_id, hierarchy_level, sort_order, name, category, contract_type, content, variables_used, conditions, risk_level, negotiable, owner) VALUES

('MFG-2', NULL, 1, 200, 'Scope of Manufacturing Work', 'scope', 'MANUFACTURING',
'Manufacturer shall fabricate, assemble, and deliver the modular home components in accordance with approved plans and specifications.',
ARRAY[],
NULL, 'HIGH', false, 'operations'),

('MFG-2.1', (SELECT id FROM clauses WHERE clause_code = 'MFG-2'), 2, 210, 'Home Specifications', 'scope', 'MANUFACTURING',
'Home Model: {{HOME_MODEL}}
Square Footage: {{HOME_SQUARE_FOOTAGE}} sq ft
Configuration: {{NUM_BEDROOMS}} bedrooms, {{NUM_BATHROOMS}} bathrooms
Design Package: {{DESIGN_PACKAGE}}',
ARRAY['HOME_MODEL', 'HOME_SQUARE_FOOTAGE', 'NUM_BEDROOMS', 'NUM_BATHROOMS', 'DESIGN_PACKAGE'],
NULL, 'HIGH', false, 'operations'),

('MFG-2.2', (SELECT id FROM clauses WHERE clause_code = 'MFG-2'), 2, 220, 'Manufacturing Services', 'scope', 'MANUFACTURING',
'Manufacturer''s scope includes:
a) Procurement of all materials and components
b) Fabrication of structural framing and panels
c) Installation of all building systems (MEP)
d) Interior and exterior finishes
e) Quality control inspections
f) Factory acceptance testing',
ARRAY[],
NULL, 'HIGH', false, 'operations'),

('MFG-2.3', (SELECT id FROM clauses WHERE clause_code = 'MFG-2'), 2, 230, 'Delivery Services', 'scope', 'MANUFACTURING',
'Manufacturer shall package, load, and transport the completed modules to the delivery address specified above using appropriate transport equipment and escorts.',
ARRAY[],
NULL, 'MEDIUM', false, 'operations'),

('MFG-2.4-SOLAR', (SELECT id FROM clauses WHERE clause_code = 'MFG-2'), 2, 240, 'Solar System Manufacturing', 'scope', 'MANUFACTURING',
'Manufacturer shall install the solar photovoltaic system components, inverters, and associated electrical systems as specified in the approved plans.',
ARRAY['SOLAR_INCLUDED'],
'{"SOLAR_INCLUDED": true}'::jsonb, 'MEDIUM', false, 'operations'),

('MFG-2.5-BATTERY', (SELECT id FROM clauses WHERE clause_code = 'MFG-2'), 2, 250, 'Battery Storage Manufacturing', 'scope', 'MANUFACTURING',
'Manufacturer shall install the battery energy storage system and integration components as specified in the approved plans.',
ARRAY['BATTERY_INCLUDED'],
'{"BATTERY_INCLUDED": true}'::jsonb, 'MEDIUM', false, 'operations'),

('MFG-2.6', (SELECT id FROM clauses WHERE clause_code = 'MFG-2'), 2, 260, 'Excluded Services', 'scope', 'MANUFACTURING',
'The following items are specifically excluded from Manufacturer''s scope:
- Foundation and site preparation
- Utility connections beyond module boundaries
- On-site assembly and installation
- Landscaping and exterior improvements
- Final commissioning and occupancy permits',
ARRAY[],
NULL, 'MEDIUM', false, 'operations');

-- ============================================================================
-- SECTION 3: CONTRACT PRICE AND PAYMENT
-- ============================================================================

INSERT INTO clauses (clause_code, parent_clause_id, hierarchy_level, sort_order, name, category, contract_type, content, variables_used, conditions, risk_level, negotiable, owner) VALUES

('MFG-3', NULL, 1, 300, 'Contract Price and Payment', 'financial', 'MANUFACTURING',
'The total Contract Price for the manufacturing work is {{MFG_CONTRACT_PRICE}}, payable according to the schedule below.',
ARRAY['MFG_CONTRACT_PRICE'],
NULL, 'HIGH', false, 'finance'),

('MFG-3.1', (SELECT id FROM clauses WHERE clause_code = 'MFG-3'), 2, 310, 'Deposit Payment', 'financial', 'MANUFACTURING',
'Owner shall pay a deposit of {{MFG_DEPOSIT}} upon execution of this Agreement to secure production scheduling.',
ARRAY['MFG_DEPOSIT'],
NULL, 'HIGH', false, 'finance'),

('MFG-3.2', (SELECT id FROM clauses WHERE clause_code = 'MFG-3'), 2, 320, 'Materials Deposit', 'financial', 'MANUFACTURING',
'An additional materials deposit of {{MFG_MATERIALS_DEPOSIT}} is due upon release of shop drawings for procurement of long-lead materials.',
ARRAY['MFG_MATERIALS_DEPOSIT'],
NULL, 'HIGH', false, 'finance'),

('MFG-3.3', (SELECT id FROM clauses WHERE clause_code = 'MFG-3'), 2, 330, 'Manufacturing Milestone Payments', 'financial', 'MANUFACTURING',
'Progress payments due at the following manufacturing milestones:

Milestone 1: {{MILESTONE_1_DESCRIPTION}} - {{MILESTONE_1_AMOUNT}}
Milestone 2: {{MILESTONE_2_DESCRIPTION}} - {{MILESTONE_2_AMOUNT}}
Milestone 3: {{MILESTONE_3_DESCRIPTION}} - {{MILESTONE_3_AMOUNT}}',
ARRAY['MILESTONE_1_DESCRIPTION', 'MILESTONE_1_AMOUNT',
      'MILESTONE_2_DESCRIPTION', 'MILESTONE_2_AMOUNT',
      'MILESTONE_3_DESCRIPTION', 'MILESTONE_3_AMOUNT'],
NULL, 'HIGH', false, 'finance'),

('MFG-3.4', (SELECT id FROM clauses WHERE clause_code = 'MFG-3'), 2, 340, 'Final Manufacturing Payment', 'financial', 'MANUFACTURING',
'Final payment of {{FINAL_PAYMENT_AMOUNT}} is due upon factory acceptance and prior to shipment.',
ARRAY['FINAL_PAYMENT_AMOUNT'],
NULL, 'HIGH', false, 'finance'),

('MFG-3.5', (SELECT id FROM clauses WHERE clause_code = 'MFG-3'), 2, 350, 'Payment Terms', 'financial', 'MANUFACTURING',
'All payments are due within 5 business days of invoice. Late payments will accrue interest at 1.5% per month or the maximum legal rate, whichever is less.',
ARRAY[],
NULL, 'MEDIUM', false, 'finance');

-- ============================================================================
-- SECTION 4: SCHEDULE AND DELIVERY
-- ============================================================================

INSERT INTO clauses (clause_code, parent_clause_id, hierarchy_level, sort_order, name, category, contract_type, content, variables_used, conditions, risk_level, negotiable, owner) VALUES

('MFG-4', NULL, 1, 400, 'Manufacturing Schedule and Delivery', 'schedule', 'MANUFACTURING',
'Manufacturer shall complete fabrication and deliver the modules according to the following schedule.',
ARRAY[],
NULL, 'MEDIUM', false, 'operations'),

('MFG-4.1', (SELECT id FROM clauses WHERE clause_code = 'MFG-4'), 2, 410, 'Manufacturing Start', 'schedule', 'MANUFACTURING',
'Manufacturing shall commence approximately {{ESTIMATED_START_DATE}} or upon receipt of deposit and approved shop drawings.',
ARRAY['ESTIMATED_START_DATE'],
NULL, 'MEDIUM', false, 'operations'),

('MFG-4.2', (SELECT id FROM clauses WHERE clause_code = 'MFG-4'), 2, 420, 'Estimated Delivery Date', 'schedule', 'MANUFACTURING',
'Estimated delivery to site: {{MFG_DELIVERY_DATE}}

This date is subject to adjustment based on shop drawing approval timing, material availability, and production schedule.',
ARRAY['MFG_DELIVERY_DATE'],
NULL, 'MEDIUM', true, 'operations'),

('MFG-4.3', (SELECT id FROM clauses WHERE clause_code = 'MFG-4'), 2, 430, 'Factory Inspection', 'schedule', 'MANUFACTURING',
'Owner may conduct factory inspection up to 7 days prior to scheduled shipment. Manufacturer will provide {{INSPECTION_POINTS}} for Owner review.',
ARRAY['INSPECTION_POINTS'],
NULL, 'MEDIUM', false, 'operations'),

('MFG-4.4', (SELECT id FROM clauses WHERE clause_code = 'MFG-4'), 2, 440, 'Delivery Coordination', 'schedule', 'MANUFACTURING',
'Manufacturer shall coordinate delivery schedule with Owner or Owner''s on-site contractor with at least 14 days advance notice. Owner is responsible for site readiness and crane/unloading equipment.',
ARRAY[],
NULL, 'HIGH', false, 'operations'),

('MFG-4.5', (SELECT id FROM clauses WHERE clause_code = 'MFG-4'), 2, 450, 'Schedule Delays', 'schedule', 'MANUFACTURING',
'The manufacturing schedule may be extended for delays caused by: shop drawing approval delays, material shortages beyond Manufacturer''s control, change orders, or force majeure events.',
ARRAY[],
NULL, 'MEDIUM', false, 'operations');

-- ============================================================================
-- SECTION 5: QUALITY AND COMPLIANCE
-- ============================================================================

INSERT INTO clauses (clause_code, parent_clause_id, hierarchy_level, sort_order, name, category, contract_type, content, variables_used, conditions, risk_level, negotiable, owner) VALUES

('MFG-5', NULL, 1, 500, 'Quality Standards and Compliance', 'quality', 'MANUFACTURING',
'Manufacturer shall perform all work in accordance with industry standards and applicable codes.',
ARRAY[],
NULL, 'HIGH', false, 'operations'),

('MFG-5.1', (SELECT id FROM clauses WHERE clause_code = 'MFG-5'), 2, 510, 'Code Compliance', 'quality', 'MANUFACTURING',
'All work shall comply with the {{BUILDING_CODE_YEAR}} International Residential Code and California modular building regulations.',
ARRAY['BUILDING_CODE_YEAR'],
NULL, 'HIGH', false, 'operations'),

('MFG-5.2', (SELECT id FROM clauses WHERE clause_code = 'MFG-5'), 2, 520, 'Factory Inspections', 'quality', 'MANUFACTURING',
'Manufacturer maintains third-party inspection agreements with approved agencies. All required inspections will be completed prior to shipment.',
ARRAY[],
NULL, 'HIGH', false, 'operations'),

('MFG-5.3', (SELECT id FROM clauses WHERE clause_code = 'MFG-5'), 2, 530, 'Quality Control Process', 'quality', 'MANUFACTURING',
'Manufacturer maintains internal quality control procedures including material inspection, in-process checks, and final acceptance criteria defined in {{ACCEPTANCE_CRITERIA}}.',
ARRAY['ACCEPTANCE_CRITERIA'],
NULL, 'MEDIUM', false, 'operations'),

('MFG-5.4', (SELECT id FROM clauses WHERE clause_code = 'MFG-5'), 2, 540, 'Documentation', 'quality', 'MANUFACTURING',
'Manufacturer shall provide Owner with: approved inspection reports, material certifications, equipment manuals, and as-built drawings upon completion.',
ARRAY[],
NULL, 'MEDIUM', false, 'operations');

-- ============================================================================
-- SECTION 6: CHANGES TO WORK
-- ============================================================================

INSERT INTO clauses (clause_code, parent_clause_id, hierarchy_level, sort_order, name, category, contract_type, content, variables_used, conditions, risk_level, negotiable, owner) VALUES

('MFG-6', NULL, 1, 600, 'Change Orders', 'change_orders', 'MANUFACTURING',
'Changes to the manufacturing scope must be documented through written Change Orders.',
ARRAY[],
NULL, 'MEDIUM', false, 'operations'),

('MFG-6.1', (SELECT id FROM clauses WHERE clause_code = 'MFG-6'), 2, 610, 'Change Request Process', 'change_orders', 'MANUFACTURING',
'Owner may request changes by submitting detailed specifications to Manufacturer. Manufacturer shall respond within {{CHANGE_ORDER_NOTICE_DAYS}} days with cost and schedule impact.',
ARRAY['CHANGE_ORDER_NOTICE_DAYS'],
NULL, 'MEDIUM', false, 'operations'),

('MFG-6.2', (SELECT id FROM clauses WHERE clause_code = 'MFG-6'), 2, 620, 'Change Order Pricing', 'change_orders', 'MANUFACTURING',
'Changes shall be priced at actual material cost plus labor cost plus {{CHANGE_ORDER_MARKUP}}% for overhead and profit.',
ARRAY['CHANGE_ORDER_MARKUP'],
NULL, 'MEDIUM', true, 'finance'),

('MFG-6.3', (SELECT id FROM clauses WHERE clause_code = 'MFG-6'), 2, 630, 'Timing Restrictions', 'change_orders', 'MANUFACTURING',
'Change orders may not be feasible once materials are ordered or fabrication has begun on affected components. Manufacturer reserves right to decline changes that would jeopardize quality or schedule.',
ARRAY[],
NULL, 'MEDIUM', false, 'operations'),

('MFG-6.4', (SELECT id FROM clauses WHERE clause_code = 'MFG-6'), 2, 640, 'Authorized Changes Only', 'change_orders', 'MANUFACTURING',
'No changes shall be made without fully executed Change Order. Owner shall not be charged for corrections of Manufacturer errors or defects.',
ARRAY[],
NULL, 'HIGH', false, 'operations');

-- ============================================================================
-- SECTION 7: WARRANTY
-- ============================================================================

INSERT INTO clauses (clause_code, parent_clause_id, hierarchy_level, sort_order, name, category, contract_type, content, variables_used, conditions, risk_level, negotiable, owner) VALUES

('MFG-7', NULL, 1, 700, 'Manufacturing Warranty', 'warranty', 'MANUFACTURING',
'Manufacturer warrants the quality and conformance of manufacturing work.',
ARRAY[],
NULL, 'HIGH', false, 'legal'),

('MFG-7.1', (SELECT id FROM clauses WHERE clause_code = 'MFG-7'), 2, 710, 'Workmanship Warranty', 'warranty', 'MANUFACTURING',
'Manufacturer warrants that all manufacturing work is performed in a workmanlike manner, free from defects in materials and workmanship, for a period of {{WORKMANSHIP_WARRANTY_YEARS}} year(s) from delivery.',
ARRAY['WORKMANSHIP_WARRANTY_YEARS'],
NULL, 'HIGH', false, 'legal'),

('MFG-7.2', (SELECT id FROM clauses WHERE clause_code = 'MFG-7'), 2, 720, 'Structural Warranty', 'warranty', 'MANUFACTURING',
'Manufacturer warrants structural components against defects for {{STRUCTURAL_WARRANTY_YEARS}} years from delivery, covering structural framing, panels, and connections.',
ARRAY['STRUCTURAL_WARRANTY_YEARS'],
NULL, 'HIGH', false, 'legal'),

('MFG-7.3', (SELECT id FROM clauses WHERE clause_code = 'MFG-7'), 2, 730, 'Warranty Exclusions', 'warranty', 'MANUFACTURING',
'Warranty does not cover: damage during transportation, damage from improper installation or site work, modifications by others, normal wear and tear, or failure to perform recommended maintenance.',
ARRAY[],
NULL, 'HIGH', false, 'legal'),

('MFG-7.4', (SELECT id FROM clauses WHERE clause_code = 'MFG-7'), 2, 740, 'Manufacturer Warranties Passed Through', 'warranty', 'MANUFACTURING',
'Equipment and materials are covered by manufacturer warranties which are assigned to Owner. Manufacturer makes no warranty beyond those provided by material suppliers.',
ARRAY[],
NULL, 'MEDIUM', false, 'legal'),

('MFG-7.5', (SELECT id FROM clauses WHERE clause_code = 'MFG-7'), 2, 750, 'Warranty Claims', 'warranty', 'MANUFACTURING',
'Owner must notify Manufacturer in writing of warranty claims within 30 days of discovery. Manufacturer shall have reasonable opportunity to inspect and repair defects.',
ARRAY[],
NULL, 'MEDIUM', false, 'legal'),

('MFG-7.6', (SELECT id FROM clauses WHERE clause_code = 'MFG-7'), 2, 760, 'Remedy Limitation', 'warranty', 'MANUFACTURING',
'Manufacturer''s sole obligation is to repair or replace defective work. Manufacturer is not liable for consequential or incidental damages.',
ARRAY[],
NULL, 'HIGH', false, 'legal');

-- ============================================================================
-- SECTION 8: INSURANCE AND LIABILITY
-- ============================================================================

INSERT INTO clauses (clause_code, parent_clause_id, hierarchy_level, sort_order, name, category, contract_type, content, variables_used, conditions, risk_level, negotiable, owner) VALUES

('MFG-8', NULL, 1, 800, 'Insurance and Risk Allocation', 'insurance', 'MANUFACTURING',
'Manufacturer shall maintain insurance coverage during manufacturing operations.',
ARRAY[],
NULL, 'HIGH', false, 'legal'),

('MFG-8.1', (SELECT id FROM clauses WHERE clause_code = 'MFG-8'), 2, 810, 'Manufacturer Insurance', 'insurance', 'MANUFACTURING',
'Manufacturer maintains commercial general liability insurance with minimum limits of $2,000,000 per occurrence, workers compensation as required by law, and commercial auto coverage.',
ARRAY[],
NULL, 'HIGH', false, 'legal'),

('MFG-8.2', (SELECT id FROM clauses WHERE clause_code = 'MFG-8'), 2, 820, 'Risk of Loss During Manufacturing', 'insurance', 'MANUFACTURING',
'Risk of loss or damage to modules remains with Manufacturer until delivery to the site and acceptance by Owner or Owner''s designated representative.',
ARRAY[],
NULL, 'HIGH', false, 'legal'),

('MFG-8.3', (SELECT id FROM clauses WHERE clause_code = 'MFG-8'), 2, 830, 'Transportation Insurance', 'insurance', 'MANUFACTURING',
'Manufacturer shall maintain cargo insurance during transport. Any damage during shipping is Manufacturer''s responsibility to repair or replace.',
ARRAY[],
NULL, 'MEDIUM', false, 'legal'),

('MFG-8.4', (SELECT id FROM clauses WHERE clause_code = 'MFG-8'), 2, 840, 'Limitation of Liability', 'insurance', 'MANUFACTURING',
'Manufacturer''s total liability under this Agreement shall not exceed the Contract Price. Manufacturer is not liable for indirect, consequential, or punitive damages.',
ARRAY[],
NULL, 'HIGH', false, 'legal');

-- ============================================================================
-- SECTION 9: TERMINATION
-- ============================================================================

INSERT INTO clauses (clause_code, parent_clause_id, hierarchy_level, sort_order, name, category, contract_type, content, variables_used, conditions, risk_level, negotiable, owner) VALUES

('MFG-9', NULL, 1, 900, 'Termination', 'termination', 'MANUFACTURING',
'This Subcontract may be terminated under the following conditions.',
ARRAY[],
NULL, 'HIGH', false, 'legal'),

('MFG-9.1', (SELECT id FROM clauses WHERE clause_code = 'MFG-9'), 2, 910, 'Termination for Non-Payment', 'termination', 'MANUFACTURING',
'Manufacturer may suspend work or terminate this Agreement if Owner fails to make payment within 15 days of written notice of non-payment.',
ARRAY[],
NULL, 'HIGH', false, 'legal'),

('MFG-9.2', (SELECT id FROM clauses WHERE clause_code = 'MFG-9'), 2, 920, 'Termination for Convenience by Owner', 'termination', 'MANUFACTURING',
'Owner may terminate for convenience upon 15 days written notice. Owner shall pay for all completed work, materials ordered, reasonable demobilization costs, and 10% of unearned balance.',
ARRAY[],
NULL, 'HIGH', true, 'legal'),

('MFG-9.3', (SELECT id FROM clauses WHERE clause_code = 'MFG-9'), 2, 930, 'Termination for Cause', 'termination', 'MANUFACTURING',
'Either party may terminate for cause if the other party materially breaches and fails to cure within 15 days of written notice.',
ARRAY[],
NULL, 'HIGH', false, 'legal'),

('MFG-9.4', (SELECT id FROM clauses WHERE clause_code = 'MFG-9'), 2, 940, 'Effect of Termination', 'termination', 'MANUFACTURING',
'Upon termination, Manufacturer shall secure work in progress. Owner shall take possession of completed modules and materials upon payment of amounts due.',
ARRAY[],
NULL, 'MEDIUM', false, 'legal');

-- ============================================================================
-- SECTION 10: DISPUTE RESOLUTION
-- ============================================================================

INSERT INTO clauses (clause_code, parent_clause_id, hierarchy_level, sort_order, name, category, contract_type, content, variables_used, conditions, risk_level, negotiable, owner) VALUES

('MFG-10', NULL, 1, 1000, 'Dispute Resolution', 'dispute', 'MANUFACTURING',
'Disputes shall be resolved through the following escalation process.',
ARRAY[],
NULL, 'MEDIUM', false, 'legal'),

('MFG-10.1', (SELECT id FROM clauses WHERE clause_code = 'MFG-10'), 2, 1010, 'Direct Negotiation', 'dispute', 'MANUFACTURING',
'Parties shall first attempt resolution through good faith negotiations between project managers.',
ARRAY[],
NULL, 'LOW', false, 'legal'),

('MFG-10.2', (SELECT id FROM clauses WHERE clause_code = 'MFG-10'), 2, 1020, 'Mediation', 'dispute', 'MANUFACTURING',
'If negotiation fails, disputes shall be submitted to non-binding mediation. Mediation costs shall be shared equally.',
ARRAY[],
NULL, 'MEDIUM', false, 'legal'),

('MFG-10.3', (SELECT id FROM clauses WHERE clause_code = 'MFG-10'), 2, 1030, 'Binding Arbitration', 'dispute', 'MANUFACTURING',
'Any dispute not resolved through mediation shall be settled by binding arbitration under AAA Construction Industry Rules. The decision shall be final and binding.',
ARRAY[],
NULL, 'HIGH', true, 'legal'),

('MFG-10.4', (SELECT id FROM clauses WHERE clause_code = 'MFG-10'), 2, 1040, 'Governing Law', 'dispute', 'MANUFACTURING',
'This Agreement is governed by the laws of {{JURISDICTION}}.',
ARRAY['JURISDICTION'],
NULL, 'MEDIUM', false, 'legal');

-- ============================================================================
-- SECTION 11: GENERAL PROVISIONS
-- ============================================================================

INSERT INTO clauses (clause_code, parent_clause_id, hierarchy_level, sort_order, name, category, contract_type, content, variables_used, conditions, risk_level, negotiable, owner) VALUES

('MFG-11', NULL, 1, 1100, 'General Provisions', 'general', 'MANUFACTURING',
'Standard contract provisions apply.',
ARRAY[],
NULL, 'LOW', false, 'legal'),

('MFG-11.1', (SELECT id FROM clauses WHERE clause_code = 'MFG-11'), 2, 1110, 'Entire Agreement', 'general', 'MANUFACTURING',
'This Subcontract constitutes the entire agreement between Owner and Manufacturer and supersedes all prior negotiations and agreements.',
ARRAY[],
NULL, 'LOW', false, 'legal'),

('MFG-11.2', (SELECT id FROM clauses WHERE clause_code = 'MFG-11'), 2, 1120, 'Assignment', 'general', 'MANUFACTURING',
'Neither party may assign this Agreement without written consent of the other party.',
ARRAY[],
NULL, 'MEDIUM', false, 'legal'),

('MFG-11.3', (SELECT id FROM clauses WHERE clause_code = 'MFG-11'), 2, 1130, 'Notices', 'general', 'MANUFACTURING',
'All notices shall be in writing to the addresses specified in Section 1.',
ARRAY[],
NULL, 'LOW', false, 'legal'),

('MFG-11.4', (SELECT id FROM clauses WHERE clause_code = 'MFG-11'), 2, 1140, 'Severability', 'general', 'MANUFACTURING',
'If any provision is held invalid, the remaining provisions shall remain in effect.',
ARRAY[],
NULL, 'LOW', false, 'legal'),

('MFG-11.5', (SELECT id FROM clauses WHERE clause_code = 'MFG-11'), 2, 1150, 'Force Majeure', 'general', 'MANUFACTURING',
'Neither party is liable for delays due to events beyond reasonable control including material shortages, natural disasters, or government actions.',
ARRAY[],
NULL, 'MEDIUM', false, 'legal');

-- ============================================================================
-- SECTION 12: SIGNATURES
-- ============================================================================

INSERT INTO clauses (clause_code, parent_clause_id, hierarchy_level, sort_order, name, category, contract_type, content, variables_used, conditions, risk_level, negotiable, owner) VALUES

('MFG-12', NULL, 1, 1200, 'Execution', 'execution', 'MANUFACTURING',
'IN WITNESS WHEREOF, the parties execute this Manufacturing Subcontract.',
ARRAY[],
NULL, 'LOW', false, 'legal'),

('MFG-12.1', (SELECT id FROM clauses WHERE clause_code = 'MFG-12'), 2, 1210, 'Owner Signature', 'execution', 'MANUFACTURING',
'OWNER:
{{SPV_NAME}}

By: _______________________
Name: _______________________
Title: Managing Member
Date: _______________________',
ARRAY['SPV_NAME'],
NULL, 'LOW', false, 'legal'),

('MFG-12.2', (SELECT id FROM clauses WHERE clause_code = 'MFG-12'), 2, 1220, 'Manufacturer Signature', 'execution', 'MANUFACTURING',
'MANUFACTURER:
Dvele Manufacturing, LLC

By: _______________________
Name: _______________________
Title: _______________________
Date: _______________________',
ARRAY[],
NULL, 'LOW', false, 'legal');

-- Create performance indexes
CREATE INDEX IF NOT EXISTS idx_mfg_clauses_sort ON clauses(contract_type, sort_order) WHERE contract_type = 'MANUFACTURING';
CREATE INDEX IF NOT EXISTS idx_mfg_clauses_hierarchy ON clauses(contract_type, hierarchy_level) WHERE contract_type = 'MANUFACTURING';
CREATE INDEX IF NOT EXISTS idx_mfg_clauses_category ON clauses(contract_type, category) WHERE contract_type = 'MANUFACTURING';

-- ONE AGREEMENT CLAUSES - Complete Subsection-Level Seeding
-- This creates all clauses for the ONE Agreement at subsection granularity (Option B)

-- Clear existing ONE clauses if re-running
DELETE FROM clauses WHERE contract_type = 'ONE';

-- ============================================================================
-- SECTION 1: THE PARTIES & PROPERTY
-- ============================================================================

INSERT INTO clauses (clause_code, parent_clause_id, hierarchy_level, sort_order, name, category, contract_type, content, variables_used, conditions, risk_level, negotiable, owner) VALUES

-- Level 1: Main Section
('ONE-1', NULL, 1, 100, 'The Parties & Property', 'parties', 'ONE', 
'This Agreement is entered into as of {{CONTRACT_DATE}} by and between {{CLIENT_NAME}} ("Owner") and {{SPV_NAME}}, a {{SPV_STATE}} limited liability company ("Builder").', 
ARRAY['CONTRACT_DATE', 'CLIENT_NAME', 'SPV_NAME', 'SPV_STATE'], 
NULL, 'LOW', false, 'legal'),

-- Level 2: Subsections
('ONE-1.1', (SELECT id FROM clauses WHERE clause_code = 'ONE-1'), 2, 110, 'Owner Information', 'parties', 'ONE',
'Owner: {{CLIENT_NAME}}
Address: {{CLIENT_ADDRESS}}
Email: {{CLIENT_EMAIL}}
Phone: {{CLIENT_PHONE}}',
ARRAY['CLIENT_NAME', 'CLIENT_ADDRESS', 'CLIENT_EMAIL', 'CLIENT_PHONE'],
NULL, 'LOW', false, 'legal'),

('ONE-1.2', (SELECT id FROM clauses WHERE clause_code = 'ONE-1'), 2, 120, 'Builder Information', 'parties', 'ONE',
'Builder: {{SPV_NAME}}
State of Formation: {{SPV_STATE}}
Address: {{SPV_ADDRESS}}
EIN: {{SPV_EIN}}',
ARRAY['SPV_NAME', 'SPV_STATE', 'SPV_ADDRESS', 'SPV_EIN'],
NULL, 'LOW', false, 'legal'),

('ONE-1.3', (SELECT id FROM clauses WHERE clause_code = 'ONE-1'), 2, 130, 'Property Description', 'property', 'ONE',
'Property Address: {{PROPERTY_ADDRESS}}
Legal Description: {{PROPERTY_LEGAL_DESCRIPTION}}
Assessor Parcel Number: {{PROPERTY_APN}}
Lot Size: {{LOT_SIZE}}
Zoning: {{ZONING}}',
ARRAY['PROPERTY_ADDRESS', 'PROPERTY_LEGAL_DESCRIPTION', 'PROPERTY_APN', 'LOT_SIZE', 'ZONING'],
NULL, 'MEDIUM', false, 'legal');

-- ============================================================================
-- SECTION 2: SCOPE OF WORK
-- ============================================================================

INSERT INTO clauses (clause_code, parent_clause_id, hierarchy_level, sort_order, name, category, contract_type, content, variables_used, conditions, risk_level, negotiable, owner) VALUES

('ONE-2', NULL, 1, 200, 'Scope of Work', 'scope', 'ONE',
'Builder shall design, manufacture, deliver, and install a modular home on the Property in accordance with the specifications and plans attached hereto.',
ARRAY[],
NULL, 'HIGH', false, 'operations'),

('ONE-2.1', (SELECT id FROM clauses WHERE clause_code = 'ONE-2'), 2, 210, 'Home Specifications', 'scope', 'ONE',
'Home Model: {{HOME_MODEL}}
Square Footage: {{HOME_SQUARE_FOOTAGE}} sq ft
Bedrooms: {{NUM_BEDROOMS}}
Bathrooms: {{NUM_BATHROOMS}}
Design Package: {{DESIGN_PACKAGE}}',
ARRAY['HOME_MODEL', 'HOME_SQUARE_FOOTAGE', 'NUM_BEDROOMS', 'NUM_BATHROOMS', 'DESIGN_PACKAGE'],
NULL, 'HIGH', false, 'operations'),

('ONE-2.2', (SELECT id FROM clauses WHERE clause_code = 'ONE-2'), 2, 220, 'Included Services', 'scope', 'ONE',
'The following services are included in the Contract Price:
{{INCLUDED_SERVICES}}',
ARRAY['INCLUDED_SERVICES'],
NULL, 'HIGH', true, 'operations'),

('ONE-2.3', (SELECT id FROM clauses WHERE clause_code = 'ONE-2'), 2, 230, 'Excluded Services', 'scope', 'ONE',
'The following items are specifically excluded from Builder''s scope and are Owner''s responsibility:
{{EXCLUDED_SERVICES}}',
ARRAY['EXCLUDED_SERVICES'],
NULL, 'HIGH', true, 'operations'),

('ONE-2.4-SOLAR', (SELECT id FROM clauses WHERE clause_code = 'ONE-2'), 2, 240, 'Solar System Inclusion', 'scope', 'ONE',
'The home includes a solar photovoltaic system as specified in the attached plans and specifications.',
ARRAY['SOLAR_INCLUDED'],
'{"SOLAR_INCLUDED": true}'::jsonb, 'MEDIUM', false, 'operations'),

('ONE-2.5-BATTERY', (SELECT id FROM clauses WHERE clause_code = 'ONE-2'), 2, 250, 'Battery Storage Inclusion', 'scope', 'ONE',
'The home includes battery energy storage system as specified in the attached plans and specifications.',
ARRAY['BATTERY_INCLUDED'],
'{"BATTERY_INCLUDED": true}'::jsonb, 'MEDIUM', false, 'operations'),

('ONE-2.6-CRC', (SELECT id FROM clauses WHERE clause_code = 'ONE-2'), 2, 260, 'CRC Service Model', 'scope', 'ONE',
'Builder will provide complete turnkey construction services including all on-site work, utilities, foundations, and final completion under the Complete Responsibility Construction (CRC) model.',
ARRAY['SERVICE_MODEL'],
'{"SERVICE_MODEL": "CRC"}'::jsonb, 'HIGH', false, 'operations'),

('ONE-2.6-CMOS', (SELECT id FROM clauses WHERE clause_code = 'ONE-2'), 2, 261, 'CMOS Service Model', 'scope', 'ONE',
'Builder will manufacture and deliver the modular home components. Owner is responsible for retaining separate contractors for on-site work including foundations, utilities, and installation under the Customer-Managed On-Site (CMOS) model.',
ARRAY['SERVICE_MODEL'],
'{"SERVICE_MODEL": "CMOS"}'::jsonb, 'HIGH', false, 'operations');

-- ============================================================================
-- SECTION 3: CONTRACT PRICE & PAYMENT
-- ============================================================================

INSERT INTO clauses (clause_code, parent_clause_id, hierarchy_level, sort_order, name, category, contract_type, content, variables_used, conditions, risk_level, negotiable, owner) VALUES

('ONE-3', NULL, 1, 300, 'Contract Price and Payment Terms', 'financial', 'ONE',
'The total Contract Price for the Work is {{TOTAL_CONTRACT_PRICE}}, payable in accordance with the milestone schedule below.',
ARRAY['TOTAL_CONTRACT_PRICE'],
NULL, 'HIGH', false, 'finance'),

('ONE-3.1', (SELECT id FROM clauses WHERE clause_code = 'ONE-3'), 2, 310, 'Initial Deposit', 'financial', 'ONE',
'Owner shall pay an initial deposit of {{DEPOSIT_AMOUNT}} ({{DEPOSIT_PERCENTAGE}}% of Contract Price) upon execution of this Agreement.',
ARRAY['DEPOSIT_AMOUNT', 'DEPOSIT_PERCENTAGE'],
NULL, 'HIGH', false, 'finance'),

('ONE-3.2', (SELECT id FROM clauses WHERE clause_code = 'ONE-3'), 2, 320, 'Milestone Payment Schedule', 'financial', 'ONE',
'Milestone 1: {{MILESTONE_1_DESCRIPTION}} - {{MILESTONE_1_AMOUNT}} ({{MILESTONE_1_PERCENTAGE}}%)
Milestone 2: {{MILESTONE_2_DESCRIPTION}} - {{MILESTONE_2_AMOUNT}} ({{MILESTONE_2_PERCENTAGE}}%)
Milestone 3: {{MILESTONE_3_DESCRIPTION}} - {{MILESTONE_3_AMOUNT}} ({{MILESTONE_3_PERCENTAGE}}%)
Final Payment: Upon Substantial Completion - {{FINAL_PAYMENT_AMOUNT}}',
ARRAY['MILESTONE_1_DESCRIPTION', 'MILESTONE_1_AMOUNT', 'MILESTONE_1_PERCENTAGE', 
      'MILESTONE_2_DESCRIPTION', 'MILESTONE_2_AMOUNT', 'MILESTONE_2_PERCENTAGE',
      'MILESTONE_3_DESCRIPTION', 'MILESTONE_3_AMOUNT', 'MILESTONE_3_PERCENTAGE',
      'FINAL_PAYMENT_AMOUNT'],
NULL, 'HIGH', true, 'finance'),

('ONE-3.3', (SELECT id FROM clauses WHERE clause_code = 'ONE-3'), 2, 330, 'Payment Method', 'financial', 'ONE',
'All payments shall be made by wire transfer or check to Builder at the address specified above, within five (5) business days of invoice.',
ARRAY[],
NULL, 'LOW', false, 'finance'),

('ONE-3.4', (SELECT id FROM clauses WHERE clause_code = 'ONE-3'), 2, 340, 'Late Payment Interest', 'financial', 'ONE',
'Any payment not made within the specified time period shall accrue interest at the rate of 1.5% per month or the maximum rate permitted by law, whichever is less.',
ARRAY[],
NULL, 'MEDIUM', true, 'finance'),

('ONE-3.5', (SELECT id FROM clauses WHERE clause_code = 'ONE-3'), 2, 350, 'Progress Payment Documentation', 'financial', 'ONE',
'Builder shall provide documentation supporting each milestone payment request, including photographs, lien releases, and inspection reports as applicable.',
ARRAY[],
NULL, 'MEDIUM', false, 'finance');

-- ============================================================================
-- SECTION 4: PROJECT SCHEDULE
-- ============================================================================

INSERT INTO clauses (clause_code, parent_clause_id, hierarchy_level, sort_order, name, category, contract_type, content, variables_used, conditions, risk_level, negotiable, owner) VALUES

('ONE-4', NULL, 1, 400, 'Project Schedule', 'schedule', 'ONE',
'The Project shall proceed in accordance with the following estimated schedule, subject to adjustment for events beyond Builder''s control.',
ARRAY[],
NULL, 'MEDIUM', false, 'operations'),

('ONE-4.1', (SELECT id FROM clauses WHERE clause_code = 'ONE-4'), 2, 410, 'Estimated Dates', 'schedule', 'ONE',
'Estimated Start Date: {{ESTIMATED_START_DATE}}
Estimated Substantial Completion: {{ESTIMATED_COMPLETION_DATE}}',
ARRAY['ESTIMATED_START_DATE', 'ESTIMATED_COMPLETION_DATE'],
NULL, 'MEDIUM', true, 'operations'),

('ONE-4.2', (SELECT id FROM clauses WHERE clause_code = 'ONE-4'), 2, 420, 'Schedule Adjustments', 'schedule', 'ONE',
'The schedule may be adjusted for: (a) Owner-requested changes, (b) delays in permit approval, (c) adverse weather, (d) force majeure events, or (e) unforeseen site conditions. Builder shall provide written notice of any anticipated schedule changes.',
ARRAY[],
NULL, 'MEDIUM', false, 'operations'),

('ONE-4.3', (SELECT id FROM clauses WHERE clause_code = 'ONE-4'), 2, 430, 'Substantial Completion Definition', 'schedule', 'ONE',
'Substantial Completion occurs when the Work is sufficiently complete in accordance with the Contract Documents so that the Owner can occupy the home for its intended use, with only minor punch list items remaining.',
ARRAY[],
NULL, 'MEDIUM', false, 'operations'),

('ONE-4.4', (SELECT id FROM clauses WHERE clause_code = 'ONE-4'), 2, 440, 'Owner Coordination Obligations', 'schedule', 'ONE',
'Owner shall provide timely access to the Property, make timely decisions on selections and change orders, and obtain necessary approvals to avoid delays to the Project schedule.',
ARRAY[],
NULL, 'MEDIUM', false, 'operations');

-- ============================================================================
-- SECTION 5: CHANGE ORDERS
-- ============================================================================

INSERT INTO clauses (clause_code, parent_clause_id, hierarchy_level, sort_order, name, category, contract_type, content, variables_used, conditions, risk_level, negotiable, owner) VALUES

('ONE-5', NULL, 1, 500, 'Change Orders', 'change_orders', 'ONE',
'Any changes to the Work must be documented in a written Change Order signed by both parties.',
ARRAY[],
NULL, 'MEDIUM', false, 'operations'),

('ONE-5.1', (SELECT id FROM clauses WHERE clause_code = 'ONE-5'), 2, 510, 'Change Order Process', 'change_orders', 'ONE',
'Owner may request changes to the Work by submitting a written request to Builder. Builder shall provide a written proposal including cost impact and schedule impact within {{CHANGE_ORDER_NOTICE_DAYS}} days.',
ARRAY['CHANGE_ORDER_NOTICE_DAYS'],
NULL, 'MEDIUM', false, 'operations'),

('ONE-5.2', (SELECT id FROM clauses WHERE clause_code = 'ONE-5'), 2, 520, 'Change Order Pricing', 'change_orders', 'ONE',
'Change Orders shall be priced at Builder''s actual costs plus {{CHANGE_ORDER_MARKUP}}% markup for overhead and profit.',
ARRAY['CHANGE_ORDER_MARKUP'],
NULL, 'MEDIUM', true, 'finance'),

('ONE-5.3', (SELECT id FROM clauses WHERE clause_code = 'ONE-5'), 2, 530, 'Executed Change Orders Required', 'change_orders', 'ONE',
'No changes shall be made to the Work without a fully executed Change Order. Builder is not obligated to perform changed work until the Change Order is signed and any required deposit is received.',
ARRAY[],
NULL, 'HIGH', false, 'operations'),

('ONE-5.4', (SELECT id FROM clauses WHERE clause_code = 'ONE-5'), 2, 540, 'Emergency Changes', 'change_orders', 'ONE',
'In the event of an emergency requiring immediate action to protect life, safety, or property, Builder may proceed with necessary changes and document them in a Change Order within 48 hours.',
ARRAY[],
NULL, 'MEDIUM', false, 'operations');

-- ============================================================================
-- SECTION 6: WARRANTIES
-- ============================================================================

INSERT INTO clauses (clause_code, parent_clause_id, hierarchy_level, sort_order, name, category, contract_type, content, variables_used, conditions, risk_level, negotiable, owner) VALUES

('ONE-6', NULL, 1, 600, 'Warranties', 'warranty', 'ONE',
'Builder provides the following warranties for the completed home.',
ARRAY[],
NULL, 'HIGH', false, 'legal'),

('ONE-6.1', (SELECT id FROM clauses WHERE clause_code = 'ONE-6'), 2, 610, 'Structural Warranty', 'warranty', 'ONE',
'Builder warrants the structural components of the home against defects in materials and workmanship for a period of {{STRUCTURAL_WARRANTY_YEARS}} years from the Warranty Start Date.',
ARRAY['STRUCTURAL_WARRANTY_YEARS'],
NULL, 'HIGH', false, 'legal'),

('ONE-6.2', (SELECT id FROM clauses WHERE clause_code = 'ONE-6'), 2, 620, 'Systems Warranty', 'warranty', 'ONE',
'Builder warrants the mechanical, electrical, and plumbing systems against defects in materials and workmanship for a period of {{SYSTEMS_WARRANTY_YEARS}} years from the Warranty Start Date.',
ARRAY['SYSTEMS_WARRANTY_YEARS'],
NULL, 'HIGH', false, 'legal'),

('ONE-6.3', (SELECT id FROM clauses WHERE clause_code = 'ONE-6'), 2, 630, 'Warranty Start Date', 'warranty', 'ONE',
'The warranty period begins on {{WARRANTY_START_DATE}}, which is the date of Substantial Completion and Owner occupancy.',
ARRAY['WARRANTY_START_DATE'],
NULL, 'MEDIUM', false, 'legal'),

('ONE-6.4', (SELECT id FROM clauses WHERE clause_code = 'ONE-6'), 2, 640, 'Warranty Exclusions', 'warranty', 'ONE',
'The following items are excluded from warranty coverage:
{{WARRANTY_EXCLUSIONS}}

Additionally excluded: damage from Owner misuse, normal wear and tear, failure to perform required maintenance, acts of God, and modifications made by parties other than Builder.',
ARRAY['WARRANTY_EXCLUSIONS'],
NULL, 'HIGH', true, 'legal'),

('ONE-6.5', (SELECT id FROM clauses WHERE clause_code = 'ONE-6'), 2, 650, 'Manufacturer Warranties', 'warranty', 'ONE',
'Appliances, fixtures, and equipment are covered by their respective manufacturer warranties, which Builder will assign to Owner. Builder makes no warranty beyond those provided by manufacturers.',
ARRAY[],
NULL, 'MEDIUM', false, 'legal'),

('ONE-6.6', (SELECT id FROM clauses WHERE clause_code = 'ONE-6'), 2, 660, 'Warranty Claims Process', 'warranty', 'ONE',
'Owner must notify Builder in writing of any warranty claims within 30 days of discovering the defect. Builder shall have reasonable opportunity to inspect and repair the claimed defect.',
ARRAY[],
NULL, 'MEDIUM', false, 'legal'),

('ONE-6.7', (SELECT id FROM clauses WHERE clause_code = 'ONE-6'), 2, 670, 'Exclusive Remedy', 'warranty', 'ONE',
'Repair or replacement of defective work at Builder''s option is Owner''s sole and exclusive remedy for breach of warranty. Builder shall not be liable for consequential damages.',
ARRAY[],
NULL, 'HIGH', false, 'legal');

-- ============================================================================
-- SECTION 7: PERMITS AND APPROVALS
-- ============================================================================

INSERT INTO clauses (clause_code, parent_clause_id, hierarchy_level, sort_order, name, category, contract_type, content, variables_used, conditions, risk_level, negotiable, owner) VALUES

('ONE-7', NULL, 1, 700, 'Permits and Approvals', 'compliance', 'ONE',
'Responsibility for obtaining permits and approvals is allocated as follows.',
ARRAY[],
NULL, 'HIGH', false, 'legal'),

('ONE-7.1-CRC', (SELECT id FROM clauses WHERE clause_code = 'ONE-7'), 2, 710, 'CRC Permit Responsibility', 'compliance', 'ONE',
'Under the CRC model, Builder shall obtain and pay for all necessary building permits, inspections, and regulatory approvals required for the Project.',
ARRAY['SERVICE_MODEL'],
'{"SERVICE_MODEL": "CRC"}'::jsonb, 'HIGH', false, 'operations'),

('ONE-7.1-CMOS', (SELECT id FROM clauses WHERE clause_code = 'ONE-7'), 2, 711, 'CMOS Permit Responsibility', 'compliance', 'ONE',
'Under the CMOS model, Owner is responsible for obtaining and paying for all on-site permits and approvals. Builder shall obtain manufacturing facility permits for the modular components.',
ARRAY['SERVICE_MODEL'],
'{"SERVICE_MODEL": "CMOS"}'::jsonb, 'HIGH', false, 'operations'),

('ONE-7.2', (SELECT id FROM clauses WHERE clause_code = 'ONE-7'), 2, 720, 'Owner Cooperation', 'compliance', 'ONE',
'Owner shall provide Builder with all necessary documentation, execute required permit applications, and provide timely access to the Property for inspections.',
ARRAY[],
NULL, 'MEDIUM', false, 'legal'),

('ONE-7.3', (SELECT id FROM clauses WHERE clause_code = 'ONE-7'), 2, 730, 'Code Compliance', 'compliance', 'ONE',
'Builder shall construct the home in compliance with applicable building codes in effect as of the permit application date. Changes required by code officials after permit issuance may result in Change Orders.',
ARRAY[],
NULL, 'MEDIUM', false, 'legal'),

('ONE-7.4', (SELECT id FROM clauses WHERE clause_code = 'ONE-7'), 2, 740, 'HOA and CC&R Compliance', 'compliance', 'ONE',
'Owner is responsible for ensuring the home design complies with any homeowners association rules or CC&Rs. Builder is not responsible for obtaining HOA approvals unless specifically agreed in writing.',
ARRAY[],
NULL, 'HIGH', false, 'legal');

-- ============================================================================
-- SECTION 8: INSURANCE AND LIABILITY
-- ============================================================================

INSERT INTO clauses (clause_code, parent_clause_id, hierarchy_level, sort_order, name, category, contract_type, content, variables_used, conditions, risk_level, negotiable, owner) VALUES

('ONE-8', NULL, 1, 800, 'Insurance and Liability', 'insurance', 'ONE',
'The parties shall maintain insurance coverage as described below.',
ARRAY[],
NULL, 'HIGH', false, 'legal'),

('ONE-8.1-CRC', (SELECT id FROM clauses WHERE clause_code = 'ONE-8'), 2, 810, 'CRC Builder Insurance', 'insurance', 'ONE',
'Builder shall maintain commercial general liability insurance with minimum limits of $2,000,000 per occurrence, workers compensation insurance as required by law, and builder''s risk insurance covering the Project during construction.',
ARRAY['SERVICE_MODEL'],
'{"SERVICE_MODEL": "CRC"}'::jsonb, 'HIGH', false, 'legal'),

('ONE-8.1-CMOS', (SELECT id FROM clauses WHERE clause_code = 'ONE-8'), 2, 811, 'CMOS Builder Insurance', 'insurance', 'ONE',
'Builder shall maintain commercial general liability insurance and workers compensation for manufacturing operations. Owner is responsible for builder''s risk insurance covering on-site work and installation.',
ARRAY['SERVICE_MODEL'],
'{"SERVICE_MODEL": "CMOS"}'::jsonb, 'HIGH', false, 'legal'),

('ONE-8.2', (SELECT id FROM clauses WHERE clause_code = 'ONE-8'), 2, 820, 'Owner Insurance Obligations', 'insurance', 'ONE',
'Owner shall obtain and maintain property insurance on the completed home and notify Builder of any claims related to Builder''s work during the warranty period.',
ARRAY[],
NULL, 'MEDIUM', false, 'legal'),

('ONE-8.3', (SELECT id FROM clauses WHERE clause_code = 'ONE-8'), 2, 830, 'Waiver of Subrogation', 'insurance', 'ONE',
'Owner and Builder waive all rights against each other for damages covered by property insurance during construction, except for damages arising from willful misconduct.',
ARRAY[],
NULL, 'MEDIUM', false, 'legal'),

('ONE-8.4', (SELECT id FROM clauses WHERE clause_code = 'ONE-8'), 2, 840, 'Insurance Certificates', 'insurance', 'ONE',
'Each party shall provide proof of required insurance coverage to the other party upon request.',
ARRAY[],
NULL, 'LOW', false, 'legal');

-- ============================================================================
-- SECTION 9: OWNER RESPONSIBILITIES
-- ============================================================================

INSERT INTO clauses (clause_code, parent_clause_id, hierarchy_level, sort_order, name, category, contract_type, content, variables_used, conditions, risk_level, negotiable, owner) VALUES

('ONE-9', NULL, 1, 900, 'Owner Responsibilities', 'obligations', 'ONE',
'Owner shall fulfill the following obligations to enable Builder to complete the Project.',
ARRAY[],
NULL, 'MEDIUM', false, 'operations'),

('ONE-9.1', (SELECT id FROM clauses WHERE clause_code = 'ONE-9'), 2, 910, 'Property Access', 'obligations', 'ONE',
'Owner shall provide Builder with access to the Property during normal business hours and such additional times as may be necessary for the Work.',
ARRAY[],
NULL, 'MEDIUM', false, 'operations'),

('ONE-9.2', (SELECT id FROM clauses WHERE clause_code = 'ONE-9'), 2, 920, 'Site Preparation', 'obligations', 'ONE',
'Owner shall ensure the Property is ready for construction, including clearing obstacles, providing access for delivery vehicles, and ensuring adequate utility service is available to the Property line.',
ARRAY[],
NULL, 'HIGH', true, 'operations'),

('ONE-9.3', (SELECT id FROM clauses WHERE clause_code = 'ONE-9'), 2, 930, 'Timely Decisions', 'obligations', 'ONE',
'Owner shall make timely decisions on selections, change orders, and other matters requiring Owner approval to avoid delays to the Project schedule.',
ARRAY[],
NULL, 'MEDIUM', false, 'operations'),

('ONE-9.4-CMOS', (SELECT id FROM clauses WHERE clause_code = 'ONE-9'), 2, 940, 'CMOS Site Contractor Coordination', 'obligations', 'ONE',
'Under the CMOS model, Owner is responsible for retaining qualified contractors for foundation, utilities, and installation work, and coordinating their work with Builder''s delivery schedule.',
ARRAY['SERVICE_MODEL'],
'{"SERVICE_MODEL": "CMOS"}'::jsonb, 'HIGH', false, 'operations'),

('ONE-9.5', (SELECT id FROM clauses WHERE clause_code = 'ONE-9'), 2, 950, 'Payment Obligations', 'obligations', 'ONE',
'Owner shall make all payments when due in accordance with Section 3 of this Agreement.',
ARRAY[],
NULL, 'HIGH', false, 'finance');

-- ============================================================================
-- SECTION 10: TERMINATION
-- ============================================================================

INSERT INTO clauses (clause_code, parent_clause_id, hierarchy_level, sort_order, name, category, contract_type, content, variables_used, conditions, risk_level, negotiable, owner) VALUES

('ONE-10', NULL, 1, 1000, 'Termination', 'termination', 'ONE',
'This Agreement may be terminated under the following circumstances.',
ARRAY[],
NULL, 'HIGH', false, 'legal'),

('ONE-10.1', (SELECT id FROM clauses WHERE clause_code = 'ONE-10'), 2, 1010, 'Termination for Cause by Owner', 'termination', 'ONE',
'Owner may terminate this Agreement for cause if Builder: (a) persistently fails to perform the Work in accordance with the Contract Documents, (b) fails to maintain required insurance, or (c) materially breaches this Agreement and fails to cure within 30 days of written notice.',
ARRAY[],
NULL, 'HIGH', false, 'legal'),

('ONE-10.2', (SELECT id FROM clauses WHERE clause_code = 'ONE-10'), 2, 1020, 'Termination for Cause by Builder', 'termination', 'ONE',
'Builder may terminate this Agreement for cause if Owner: (a) fails to make payment when due, (b) persistently fails to provide access to the Property, or (c) materially breaches this Agreement and fails to cure within 30 days of written notice.',
ARRAY[],
NULL, 'HIGH', false, 'legal'),

('ONE-10.3', (SELECT id FROM clauses WHERE clause_code = 'ONE-10'), 2, 1030, 'Termination for Convenience by Owner', 'termination', 'ONE',
'Owner may terminate this Agreement for convenience upon 30 days written notice. Owner shall pay Builder for all Work performed through the termination date, plus reasonable demobilization costs and 15% of the unearned Contract balance.',
ARRAY[],
NULL, 'HIGH', true, 'legal'),

('ONE-10.4', (SELECT id FROM clauses WHERE clause_code = 'ONE-10'), 2, 1040, 'Effect of Termination', 'termination', 'ONE',
'Upon termination, Builder shall cease work, secure the Project site, and remove equipment and materials. Owner shall pay all undisputed amounts due within 15 days of termination.',
ARRAY[],
NULL, 'MEDIUM', false, 'legal');

-- ============================================================================
-- SECTION 11: DISPUTE RESOLUTION
-- ============================================================================

INSERT INTO clauses (clause_code, parent_clause_id, hierarchy_level, sort_order, name, category, contract_type, content, variables_used, conditions, risk_level, negotiable, owner) VALUES

('ONE-11', NULL, 1, 1100, 'Dispute Resolution', 'dispute', 'ONE',
'Disputes arising under this Agreement shall be resolved through the following process.',
ARRAY[],
NULL, 'HIGH', false, 'legal'),

('ONE-11.1', (SELECT id FROM clauses WHERE clause_code = 'ONE-11'), 2, 1110, 'Negotiation', 'dispute', 'ONE',
'The parties shall first attempt to resolve any dispute through good faith negotiations between their respective principals.',
ARRAY[],
NULL, 'LOW', false, 'legal'),

('ONE-11.2', (SELECT id FROM clauses WHERE clause_code = 'ONE-11'), 2, 1120, 'Mediation', 'dispute', 'ONE',
'If negotiation fails, the parties shall submit the dispute to non-binding mediation before a mutually agreed mediator. The parties shall share mediation costs equally.',
ARRAY[],
NULL, 'MEDIUM', false, 'legal'),

('ONE-11.3', (SELECT id FROM clauses WHERE clause_code = 'ONE-11'), 2, 1130, 'Arbitration', 'dispute', 'ONE',
'If mediation fails, any remaining dispute shall be resolved by binding arbitration in accordance with the Construction Industry Arbitration Rules of the American Arbitration Association. The arbitrator''s decision shall be final and binding.',
ARRAY[],
NULL, 'HIGH', true, 'legal'),

('ONE-11.4', (SELECT id FROM clauses WHERE clause_code = 'ONE-11'), 2, 1140, 'Jurisdiction and Venue', 'dispute', 'ONE',
'This Agreement shall be governed by the laws of {{JURISDICTION}}. Any litigation shall be brought exclusively in the courts of {{JURISDICTION}}.',
ARRAY['JURISDICTION'],
NULL, 'MEDIUM', false, 'legal'),

('ONE-11.5', (SELECT id FROM clauses WHERE clause_code = 'ONE-11'), 2, 1150, 'Attorney Fees', 'dispute', 'ONE',
'The prevailing party in any dispute resolution proceeding or litigation shall be entitled to recover reasonable attorney fees and costs.',
ARRAY[],
NULL, 'MEDIUM', true, 'legal');

-- ============================================================================
-- SECTION 12: GENERAL PROVISIONS
-- ============================================================================

INSERT INTO clauses (clause_code, parent_clause_id, hierarchy_level, sort_order, name, category, contract_type, content, variables_used, conditions, risk_level, negotiable, owner) VALUES

('ONE-12', NULL, 1, 1200, 'General Provisions', 'general', 'ONE',
'The following general provisions apply to this Agreement.',
ARRAY[],
NULL, 'MEDIUM', false, 'legal'),

('ONE-12.1', (SELECT id FROM clauses WHERE clause_code = 'ONE-12'), 2, 1210, 'Entire Agreement', 'general', 'ONE',
'This Agreement, together with the attached exhibits, constitutes the entire agreement between the parties and supersedes all prior negotiations, representations, and agreements.',
ARRAY[],
NULL, 'MEDIUM', false, 'legal'),

('ONE-12.2', (SELECT id FROM clauses WHERE clause_code = 'ONE-12'), 2, 1220, 'Amendments', 'general', 'ONE',
'This Agreement may be amended only by written instrument signed by both parties.',
ARRAY[],
NULL, 'LOW', false, 'legal'),

('ONE-12.3', (SELECT id FROM clauses WHERE clause_code = 'ONE-12'), 2, 1230, 'Assignment', 'general', 'ONE',
'Neither party may assign this Agreement without the prior written consent of the other party, except that Builder may assign to an affiliated entity or for financing purposes.',
ARRAY[],
NULL, 'MEDIUM', false, 'legal'),

('ONE-12.4', (SELECT id FROM clauses WHERE clause_code = 'ONE-12'), 2, 1240, 'Notices', 'general', 'ONE',
'All notices required under this Agreement shall be in writing and delivered to the addresses specified in Section 1, or to such other address as a party may designate in writing.',
ARRAY[],
NULL, 'LOW', false, 'legal'),

('ONE-12.5', (SELECT id FROM clauses WHERE clause_code = 'ONE-12'), 2, 1250, 'Severability', 'general', 'ONE',
'If any provision of this Agreement is held invalid or unenforceable, the remaining provisions shall continue in full force and effect.',
ARRAY[],
NULL, 'LOW', false, 'legal'),

('ONE-12.6', (SELECT id FROM clauses WHERE clause_code = 'ONE-12'), 2, 1260, 'Waiver', 'general', 'ONE',
'No waiver of any provision of this Agreement shall be effective unless in writing. No waiver shall constitute a continuing waiver or waiver of any other provision.',
ARRAY[],
NULL, 'LOW', false, 'legal'),

('ONE-12.7', (SELECT id FROM clauses WHERE clause_code = 'ONE-12'), 2, 1270, 'Force Majeure', 'general', 'ONE',
'Neither party shall be liable for delays or failure to perform due to causes beyond its reasonable control, including acts of God, war, labor disputes, or government actions. The affected party shall provide prompt notice and use reasonable efforts to minimize delay.',
ARRAY[],
NULL, 'MEDIUM', false, 'legal'),

('ONE-12.8', (SELECT id FROM clauses WHERE clause_code = 'ONE-12'), 2, 1280, 'Survival', 'general', 'ONE',
'The provisions of this Agreement relating to warranties, indemnification, dispute resolution, and confidentiality shall survive completion or termination of this Agreement.',
ARRAY[],
NULL, 'MEDIUM', false, 'legal');

-- ============================================================================
-- SECTION 13: SIGNATURES
-- ============================================================================

INSERT INTO clauses (clause_code, parent_clause_id, hierarchy_level, sort_order, name, category, contract_type, content, variables_used, conditions, risk_level, negotiable, owner) VALUES

('ONE-13', NULL, 1, 1300, 'Signatures', 'execution', 'ONE',
'IN WITNESS WHEREOF, the parties have executed this Agreement as of the date first written above.',
ARRAY[],
NULL, 'LOW', false, 'legal'),

('ONE-13.1', (SELECT id FROM clauses WHERE clause_code = 'ONE-13'), 2, 1310, 'Owner Signature Block', 'execution', 'ONE',
'OWNER:

{{CLIENT_NAME}}

Signature: _______________________
Date: _______________________',
ARRAY['CLIENT_NAME'],
NULL, 'LOW', false, 'legal'),

('ONE-13.2', (SELECT id FROM clauses WHERE clause_code = 'ONE-13'), 2, 1320, 'Builder Signature Block', 'execution', 'ONE',
'BUILDER:

{{SPV_NAME}}

By: _______________________
Name: _______________________
Title: Managing Member
Date: _______________________',
ARRAY['SPV_NAME'],
NULL, 'LOW', false, 'legal');

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_one_clauses_sort ON clauses(contract_type, sort_order) WHERE contract_type = 'ONE';
CREATE INDEX IF NOT EXISTS idx_one_clauses_hierarchy ON clauses(contract_type, hierarchy_level) WHERE contract_type = 'ONE';
CREATE INDEX IF NOT EXISTS idx_one_clauses_category ON clauses(contract_type, category) WHERE contract_type = 'ONE';

-- CONTRACT TEMPLATE ASSEMBLY CONFIGURATION
-- This defines how clauses are assembled into complete contracts based on project parameters

-- Clear existing templates
DELETE FROM contract_templates;

-- ============================================================================
-- ONE AGREEMENT TEMPLATE
-- ============================================================================

INSERT INTO contract_templates (contract_type, version, display_name, base_clause_ids, conditional_rules, status) 
SELECT 
  'ONE',
  '1.0',
  'ONE Agreement - Standard',
  -- Base clauses that are ALWAYS included (regardless of CRC/CMOS)
  ARRAY(
    SELECT id FROM clauses 
    WHERE contract_type = 'ONE' 
    AND clause_code NOT LIKE '%-CRC' 
    AND clause_code NOT LIKE '%-CMOS'
    AND clause_code != 'ONE-2.4-SOLAR'
    AND clause_code != 'ONE-2.5-BATTERY'
    ORDER BY sort_order
  ),
  -- Conditional rules for CRC vs CMOS and optional features
  jsonb_build_object(
    'SERVICE_MODEL', jsonb_build_object(
      'CRC', ARRAY(
        SELECT id FROM clauses WHERE clause_code IN (
          'ONE-2.6-CRC',
          'ONE-7.1-CRC',
          'ONE-8.1-CRC'
        )
      ),
      'CMOS', ARRAY(
        SELECT id FROM clauses WHERE clause_code IN (
          'ONE-2.6-CMOS',
          'ONE-7.1-CMOS',
          'ONE-8.1-CMOS',
          'ONE-9.4-CMOS'
        )
      )
    ),
    'SOLAR_INCLUDED', jsonb_build_object(
      'true', ARRAY(
        SELECT id FROM clauses WHERE clause_code = 'ONE-2.4-SOLAR'
      )
    ),
    'BATTERY_INCLUDED', jsonb_build_object(
      'true', ARRAY(
        SELECT id FROM clauses WHERE clause_code = 'ONE-2.5-BATTERY'
      )
    )
  ),
  'active';

-- ============================================================================
-- MANUFACTURING SUBCONTRACT TEMPLATE
-- ============================================================================

INSERT INTO contract_templates (contract_type, version, display_name, base_clause_ids, conditional_rules, status)
SELECT
  'MANUFACTURING',
  '1.0',
  'Manufacturing Subcontract - Standard',
  -- Base clauses always included
  ARRAY(
    SELECT id FROM clauses
    WHERE contract_type = 'MANUFACTURING'
    AND clause_code != 'MFG-2.4-SOLAR'
    AND clause_code != 'MFG-2.5-BATTERY'
    ORDER BY sort_order
  ),
  -- Conditional rules for solar/battery
  jsonb_build_object(
    'SOLAR_INCLUDED', jsonb_build_object(
      'true', ARRAY(
        SELECT id FROM clauses WHERE clause_code = 'MFG-2.4-SOLAR'
      )
    ),
    'BATTERY_INCLUDED', jsonb_build_object(
      'true', ARRAY(
        SELECT id FROM clauses WHERE clause_code = 'MFG-2.5-BATTERY'
      )
    )
  ),
  'active';

-- ============================================================================
-- ON-SITE INSTALLATION SUBCONTRACT TEMPLATE
-- ============================================================================

INSERT INTO contract_templates (contract_type, version, display_name, base_clause_ids, conditional_rules, status)
SELECT
  'ONSITE',
  '1.0',
  'On-Site Installation Subcontract - Standard',
  -- Base clauses always included
  ARRAY(
    SELECT id FROM clauses
    WHERE contract_type = 'ONSITE'
    AND clause_code NOT LIKE '%-CRC'
    AND clause_code NOT LIKE '%-CMOS'
    AND clause_code != 'ONSITE-6.5-BOND'
    ORDER BY sort_order
  ),
  -- Conditional rules for CRC/CMOS and bonding
  jsonb_build_object(
    'SERVICE_MODEL', jsonb_build_object(
      'CRC', ARRAY(
        SELECT id FROM clauses WHERE clause_code IN (
          'ONSITE-2.5-CRC',
          'ONSITE-5.1-CRC'
        )
      ),
      'CMOS', ARRAY(
        SELECT id FROM clauses WHERE clause_code IN (
          'ONSITE-2.6-CMOS',
          'ONSITE-5.1-CMOS'
        )
      )
    ),
    'BOND_REQUIRED', jsonb_build_object(
      'true', ARRAY(
        SELECT id FROM clauses WHERE clause_code = 'ONSITE-6.5-BOND'
      )
    )
  ),
  'active';

-- ============================================================================
-- HELPER VIEWS FOR CONTRACT ASSEMBLY
-- ============================================================================

-- View to get all clauses for a specific contract with hierarchy
CREATE OR REPLACE VIEW v_contract_clauses_hierarchy AS
SELECT 
  c.id,
  c.clause_code,
  c.parent_clause_id,
  c.hierarchy_level,
  c.sort_order,
  c.name,
  c.category,
  c.contract_type,
  c.content,
  c.variables_used,
  c.conditions,
  c.risk_level,
  c.negotiable,
  p.clause_code as parent_code,
  p.name as parent_name
FROM clauses c
LEFT JOIN clauses p ON c.parent_clause_id = p.id
ORDER BY c.contract_type, c.sort_order;

-- View to get contract statistics
CREATE OR REPLACE VIEW v_contract_statistics AS
SELECT 
  contract_type,
  COUNT(*) as total_clauses,
  COUNT(*) FILTER (WHERE hierarchy_level = 1) as section_count,
  COUNT(*) FILTER (WHERE hierarchy_level = 2) as subsection_count,
  COUNT(*) FILTER (WHERE hierarchy_level = 3) as paragraph_count,
  COUNT(*) FILTER (WHERE conditions IS NOT NULL) as conditional_clauses,
  COUNT(DISTINCT category) as category_count,
  array_agg(DISTINCT category ORDER BY category) as categories
FROM clauses
GROUP BY contract_type;

-- View to show variable usage across contracts
CREATE OR REPLACE VIEW v_variable_usage AS
SELECT 
  cv.variable_name,
  cv.display_name,
  cv.category,
  cv.used_in_contracts,
  COUNT(c.id) as clause_usage_count,
  array_agg(DISTINCT c.contract_type) as contracts_using
FROM contract_variables cv
LEFT JOIN clauses c ON cv.variable_name = ANY(c.variables_used)
GROUP BY cv.id, cv.variable_name, cv.display_name, cv.category, cv.used_in_contracts
ORDER BY clause_usage_count DESC;

-- View to identify missing variables
CREATE OR REPLACE VIEW v_missing_variables AS
SELECT DISTINCT 
  c.contract_type,
  c.clause_code,
  c.name as clause_name,
  unnest(c.variables_used) as variable_used
FROM clauses c
WHERE EXISTS (
  SELECT 1 
  FROM unnest(c.variables_used) v
  WHERE NOT EXISTS (
    SELECT 1 FROM contract_variables WHERE variable_name = v
  )
);

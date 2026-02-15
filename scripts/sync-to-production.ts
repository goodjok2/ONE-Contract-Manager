import { db } from "../server/db";
import { clauses } from "../shared/schema";
import { sql } from "drizzle-orm";

const PROD_DATABASE_URL = process.env.PROD_DATABASE_URL || process.env.DATABASE_URL;

async function syncToProduction() {
  console.log("=== Dev → Production Data Sync ===\n");

  const allClauses = await db.execute(sql`
    SELECT id, slug, header_text, body_html, level, parent_id, "order", contract_types, tags
    FROM clauses ORDER BY id
  `);

  const allComponents = await db.execute(sql`
    SELECT id, organization_id, tag_name, content, description, service_model, is_system, is_active
    FROM component_library ORDER BY id
  `);

  const clauseRows = allClauses.rows as any[];
  const componentRows = allComponents.rows as any[];

  console.log(`Found ${clauseRows.length} clauses and ${componentRows.length} components in dev.\n`);

  const escapeSql = (val: string | null | undefined): string => {
    if (val === null || val === undefined) return "NULL";
    return "'" + val.replace(/'/g, "''") + "'";
  };

  const jsonVal = (val: any): string => {
    if (val === null || val === undefined) return "NULL";
    return "'" + JSON.stringify(val).replace(/'/g, "''") + "'::jsonb";
  };

  let output = "";
  output += "-- ==============================================\n";
  output += "-- Dev → Production Sync Script\n";
  output += `-- Generated: ${new Date().toISOString()}\n`;
  output += "-- ==============================================\n\n";

  output += "BEGIN;\n\n";

  output += "-- ============ CLAUSES ============\n\n";
  for (const c of clauseRows) {
    output += `INSERT INTO clauses (id, slug, header_text, body_html, level, parent_id, "order", contract_types, tags)\n`;
    output += `VALUES (${c.id}, ${escapeSql(c.slug)}, ${escapeSql(c.header_text)}, ${escapeSql(c.body_html)}, ${c.level || 'NULL'}, ${c.parent_id || 'NULL'}, ${c.order || 0}, ${jsonVal(c.contract_types)}, ${jsonVal(c.tags)})\n`;
    output += `ON CONFLICT (id) DO UPDATE SET\n`;
    output += `  slug = EXCLUDED.slug,\n`;
    output += `  header_text = EXCLUDED.header_text,\n`;
    output += `  body_html = EXCLUDED.body_html,\n`;
    output += `  level = EXCLUDED.level,\n`;
    output += `  parent_id = EXCLUDED.parent_id,\n`;
    output += `  "order" = EXCLUDED."order",\n`;
    output += `  contract_types = EXCLUDED.contract_types,\n`;
    output += `  tags = EXCLUDED.tags,\n`;
    output += `  updated_at = NOW();\n\n`;
  }

  output += "-- OPTIONAL: Uncomment to delete clauses that no longer exist in dev\n";
  const clauseIds = clauseRows.map(c => c.id).join(",");
  output += `-- DELETE FROM clauses WHERE id NOT IN (${clauseIds});\n\n`;

  output += "-- ============ COMPONENT LIBRARY ============\n\n";
  for (const c of componentRows) {
    output += `INSERT INTO component_library (id, organization_id, tag_name, content, description, service_model, is_system, is_active)\n`;
    output += `VALUES (${c.id}, ${c.organization_id || 1}, ${escapeSql(c.tag_name)}, ${escapeSql(c.content)}, ${escapeSql(c.description)}, ${escapeSql(c.service_model)}, ${c.is_system ?? false}, ${c.is_active ?? true})\n`;
    output += `ON CONFLICT (id) DO UPDATE SET\n`;
    output += `  tag_name = EXCLUDED.tag_name,\n`;
    output += `  content = EXCLUDED.content,\n`;
    output += `  description = EXCLUDED.description,\n`;
    output += `  service_model = EXCLUDED.service_model,\n`;
    output += `  is_system = EXCLUDED.is_system,\n`;
    output += `  is_active = EXCLUDED.is_active,\n`;
    output += `  updated_at = NOW();\n\n`;
  }

  const componentIds = componentRows.map(c => c.id).join(",");
  output += "-- OPTIONAL: Uncomment to delete components that no longer exist in dev\n";
  output += `-- DELETE FROM component_library WHERE id NOT IN (${componentIds});\n\n`;

  output += "-- Reset sequences\n";
  output += `SELECT setval('clauses_id_seq', (SELECT COALESCE(MAX(id), 1) FROM clauses));\n`;
  output += `SELECT setval('component_library_id_seq', (SELECT COALESCE(MAX(id), 1) FROM component_library));\n\n`;

  output += "COMMIT;\n";

  const fs = await import("fs");
  const outputPath = "scripts/prod-sync.sql";
  fs.writeFileSync(outputPath, output);
  console.log(`✅ Generated sync SQL: ${outputPath}`);
  console.log(`   ${clauseRows.length} clauses (upsert)`);
  console.log(`   ${componentRows.length} components (upsert)`);
  console.log(`\nTo apply to production, run:`);
  console.log(`   psql "$PROD_DATABASE_URL" -f scripts/prod-sync.sql`);
  console.log(`\nOr use the admin sync API endpoint (POST /api/admin/sync-from-dev)`);
}

syncToProduction().catch(console.error).finally(() => process.exit(0));

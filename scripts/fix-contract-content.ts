import { db } from '../server/db';
import { sql } from 'drizzle-orm';

export async function fixContractContent(): Promise<{
  deleted: string[];
  updated: string[];
  errors: string[];
}> {
  const deleted: string[] = [];
  const updated: string[] = [];
  const errors: string[] = [];

  console.log('\n========================================');
  console.log('  CONTRACT CONTENT FIX SCRIPT');
  console.log('========================================\n');

  try {
    // ============================================================
    // STEP 1: Delete Ghost Headers (Duplicate/Conflicting Sections)
    // ============================================================
    console.log('STEP 1: Deleting ghost/duplicate section headers...\n');

    const ghostHeaderPatterns = [
      { pattern: 'Section 7. Intellectual Property', reason: 'Duplicate of Section 12' },
      { pattern: 'Section 8. Limitation of Liability', reason: 'Duplicate of Section 9' },
      { pattern: 'Section 9. No Obligation to Purchase', reason: 'Conflicting header' },
      { pattern: 'Section 12. Default', reason: 'Conflicting header' },
      { pattern: 'Section 13. Miscellaneous Provisions', reason: 'Duplicate of General Provisions' },
    ];

    for (const { pattern, reason } of ghostHeaderPatterns) {
      try {
        const result = await db.execute(sql`
          DELETE FROM clauses 
          WHERE name LIKE ${pattern + '%'} 
          AND contract_type = 'ONE Agreement'
          RETURNING id, clause_code, name
        `);
        
        if (result.rows && result.rows.length > 0) {
          for (const row of result.rows) {
            const msg = `Deleted [${row.id}] ${row.clause_code}: "${row.name}" (${reason})`;
            console.log(`  ✗ ${msg}`);
            deleted.push(msg);
          }
        }
      } catch (err: any) {
        const errMsg = `Failed to delete "${pattern}": ${err.message}`;
        console.error(`  ⚠️ ${errMsg}`);
        errors.push(errMsg);
      }
    }

    console.log(`\n  Total deleted: ${deleted.length}\n`);

    // ============================================================
    // STEP 2: Renumber Conflicting Section 3.4 -> 3.5
    // ============================================================
    console.log('STEP 2: Renumbering Section 3.4 Financial Obligations to 3.5...\n');

    try {
      // Find the clause with mismatched name/content (named GC Engagement but content is Financial)
      const result = await db.execute(sql`
        UPDATE clauses 
        SET 
          clause_code = 'ONE-3.5-FIN',
          name = '3.5. Financial Obligations',
          sort_order = 355
        WHERE id = 285 
          AND contract_type = 'ONE Agreement'
        RETURNING id, clause_code, name
      `);
      
      if (result.rows && result.rows.length > 0) {
        const row = result.rows[0];
        const msg = `Renumbered [${row.id}] to ${row.clause_code}: "${row.name}"`;
        console.log(`  ✓ ${msg}`);
        updated.push(msg);
      }
    } catch (err: any) {
      const errMsg = `Failed to renumber Section 3.4: ${err.message}`;
      console.error(`  ⚠️ ${errMsg}`);
      errors.push(errMsg);
    }

    // ============================================================
    // STEP 3: Simplify Section 2.4 - Remove Redundant Table
    // ============================================================
    console.log('\nSTEP 3: Simplifying Section 2.4 (Total Preliminary Project Cost)...\n');

    try {
      const newContent24 = `2.4. TOTAL PRELIMINARY PROJECT COST

TOTAL PRELIMINARY PROJECT COST (At Signing): {{PRELIMINARY_CONTRACT_PRICE}}

The Total Preliminary Project Cost breakdown is set forth in **Recital H**.

This preliminary estimate is subject to adjustment as provided in Section 2.6 (Pricing Adjustments and Final Contract Price).`;

      const result = await db.execute(sql`
        UPDATE clauses 
        SET content = ${newContent24}
        WHERE clause_code = 'ONE-2.4' 
          AND contract_type = 'ONE Agreement'
        RETURNING id, clause_code, name
      `);
      
      if (result.rows && result.rows.length > 0) {
        const row = result.rows[0];
        const msg = `Simplified [${row.id}] ${row.clause_code}: "${row.name}" - removed redundant table`;
        console.log(`  ✓ ${msg}`);
        updated.push(msg);
      }
    } catch (err: any) {
      const errMsg = `Failed to simplify Section 2.4: ${err.message}`;
      console.error(`  ⚠️ ${errMsg}`);
      errors.push(errMsg);
    }

    // ============================================================
    // STEP 4: Simplify Section 2.8 - Remove Redundant Table
    // ============================================================
    console.log('\nSTEP 4: Simplifying Section 2.8 (Payment Schedule)...\n');

    try {
      const newContent28 = `2.8. PAYMENT SCHEDULE

All payments under this Agreement shall be made according to the Payment Schedule set forth in **Exhibit C**.

Payment terms, milestone triggers, and amounts are detailed in the Payment Schedule exhibit attached hereto.`;

      const result = await db.execute(sql`
        UPDATE clauses 
        SET content = ${newContent28}
        WHERE clause_code = 'ONE-2.8' 
          AND contract_type = 'ONE Agreement'
        RETURNING id, clause_code, name
      `);
      
      if (result.rows && result.rows.length > 0) {
        const row = result.rows[0];
        const msg = `Simplified [${row.id}] ${row.clause_code}: "${row.name}" - removed redundant table`;
        console.log(`  ✓ ${msg}`);
        updated.push(msg);
      }
    } catch (err: any) {
      const errMsg = `Failed to simplify Section 2.8: ${err.message}`;
      console.error(`  ⚠️ ${errMsg}`);
      errors.push(errMsg);
    }

    console.log('\n========================================');
    console.log('  SUMMARY');
    console.log('========================================');
    console.log(`  Deleted: ${deleted.length} clauses`);
    console.log(`  Updated: ${updated.length} clauses`);
    console.log(`  Errors: ${errors.length}`);
    console.log('========================================\n');

  } catch (error: any) {
    console.error('Script failed:', error);
    errors.push(`Script failed: ${error.message}`);
  }

  return { deleted, updated, errors };
}

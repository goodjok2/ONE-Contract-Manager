import { db } from '../db';
import { clauses } from '../../shared/schema';
import { eq, ilike, sql } from 'drizzle-orm';

interface RepairResult {
  renamed: string[];
  deleted: string[];
  created: string[];
  errors: string[];
}

export async function runGrandmasterRepair(): Promise<RepairResult> {
  const result: RepairResult = {
    renamed: [],
    deleted: [],
    created: [],
    errors: []
  };

  try {
    // =============================================
    // 1. FIX NUMBERING COLLISIONS (RENAMING)
    // =============================================
    
    // Section 1.5 -> 1.6
    const section15 = await db.select().from(clauses)
      .where(ilike(clauses.name, '%1.5%On-Site Work%CRC%'));
    
    for (const clause of section15) {
      const newName = clause.name?.replace('1.5.', '1.6.') || clause.name;
      const newCode = clause.clauseCode?.replace('1.5', '1.6') || clause.clauseCode;
      await db.update(clauses)
        .set({ 
          name: newName,
          clauseCode: newCode,
          sortOrder: (clause.sortOrder || 0) + 1
        })
        .where(eq(clauses.id, clause.id));
      result.renamed.push(`${clause.clauseCode} -> ${newCode}: ${clause.name} -> ${newName}`);
    }

    // Section 3.5 Green Light -> 3.6
    const section35Green = await db.select().from(clauses)
      .where(ilike(clauses.name, '%3.5%Green Light%'));
    
    for (const clause of section35Green) {
      const newName = clause.name?.replace('3.5.', '3.6.') || clause.name;
      const newCode = clause.clauseCode?.replace('3.5', '3.6') || clause.clauseCode;
      await db.update(clauses)
        .set({ 
          name: newName,
          clauseCode: newCode,
          sortOrder: (clause.sortOrder || 0) + 1
        })
        .where(eq(clauses.id, clause.id));
      result.renamed.push(`${clause.clauseCode} -> ${newCode}: ${clause.name} -> ${newName}`);
    }

    // =============================================
    // 2. DELETE GHOST HEADERS (Section 3 duplicates)
    // =============================================
    const ghostHeaders3 = [
      '3.2. Access to Site',
      '3.3. Legal Authority and Site Control',
      '3.5. Communication and Coordination'
    ];

    for (const ghostName of ghostHeaders3) {
      const ghosts = await db.select().from(clauses)
        .where(ilike(clauses.name, `%${ghostName}%`));
      
      for (const ghost of ghosts) {
        await db.delete(clauses).where(eq(clauses.id, ghost.id));
        result.deleted.push(`Ghost header: ${ghost.clauseCode} - ${ghost.name}`);
      }
    }

    // =============================================
    // 3. SECTION 7 PURGE (IP clauses - wrong section)
    // =============================================
    const ipClausesToDelete = [
      '7.1. Ownership of Work Product',
      '7.2. License to Use Work Product',
      '7.3. Restrictions on Use',
      '7.4. Indemnification Regarding Work Product Use',
      '7.5. Publicity Rights'
    ];

    for (const ipName of ipClausesToDelete) {
      const ipClauses = await db.select().from(clauses)
        .where(ilike(clauses.name, `%${ipName}%`));
      
      for (const ipClause of ipClauses) {
        await db.delete(clauses).where(eq(clauses.id, ipClause.id));
        result.deleted.push(`IP Ghost: ${ipClause.clauseCode} - ${ipClause.name}`);
      }
    }

    // Check if valid Section 7 header exists (Risk of Loss)
    const section7Header = await db.select().from(clauses)
      .where(ilike(clauses.clauseCode, '%ONE-7-HEADER%'));
    
    if (section7Header.length === 0) {
      // Create the correct Section 7 header using raw SQL for flexibility
      await db.execute(sql`
        INSERT INTO clauses (clause_code, name, content, contract_type, category, sort_order)
        VALUES ('ONE-7-HEADER', 'SECTION 7: RISK OF LOSS', '<h2>SECTION 7: RISK OF LOSS</h2>', 'ONE', 'Header', 700)
      `);
      result.created.push('ONE-7-HEADER: SECTION 7: RISK OF LOSS');
    }

    // =============================================
    // 4. GLOBAL GHOST BUSTING (Sections 8, 9, 12, 13)
    // =============================================
    const globalGhosts = [
      '8.1. Damages',
      '9.1. Scope and Milestones',
      '12.1. Payment Default',
      '12.2. Material Breach',
      '12.3. Rights upon Termination',
      '13.1. Governing Law and Venue',
      '13.2. Entire Agreement; Amendments',
      '13.4. No Third-Party Beneficiaries'
    ];

    for (const ghostName of globalGhosts) {
      const ghosts = await db.select().from(clauses)
        .where(ilike(clauses.name, `%${ghostName}%`));
      
      for (const ghost of ghosts) {
        // Extra check for 13.2 - only delete if it's the ghost version
        if (ghostName === '13.2. Entire Agreement; Amendments') {
          // Check if this is a duplicate/ghost by looking at content length or specific markers
          const contentLen = ghost.content?.length || 0;
          if (contentLen < 100) {
            // Likely a ghost header with minimal content
            await db.delete(clauses).where(eq(clauses.id, ghost.id));
            result.deleted.push(`Global Ghost: ${ghost.clauseCode} - ${ghost.name}`);
          }
        } else {
          await db.delete(clauses).where(eq(clauses.id, ghost.id));
          result.deleted.push(`Global Ghost: ${ghost.clauseCode} - ${ghost.name}`);
        }
      }
    }

    // =============================================
    // 5. VERIFY SEQUENTIAL NUMBERING
    // =============================================
    // Get all ONE clauses and verify sort order
    const allOneClauses = await db.select().from(clauses)
      .where(eq(clauses.contractType, 'ONE'))
      .orderBy(clauses.sortOrder);
    
    let sortOrderUpdates = 0;
    for (let i = 0; i < allOneClauses.length; i++) {
      const clause = allOneClauses[i];
      const expectedSortOrder = (i + 1) * 10;
      
      if (clause.sortOrder !== expectedSortOrder) {
        await db.update(clauses)
          .set({ sortOrder: expectedSortOrder })
          .where(eq(clauses.id, clause.id));
        sortOrderUpdates++;
      }
    }
    
    if (sortOrderUpdates > 0) {
      result.renamed.push(`Updated sortOrder for ${sortOrderUpdates} clauses`);
    }

  } catch (error) {
    result.errors.push(`Error during repair: ${error}`);
  }

  return result;
}

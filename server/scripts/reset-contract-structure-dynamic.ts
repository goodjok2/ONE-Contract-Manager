import { db } from '../db';
import { clauses } from '../../shared/schema';
import { eq, ilike, sql } from 'drizzle-orm';

interface ResetResult {
  updated: string[];
  created: string[];
  deleted: string[];
  errors: string[];
}

interface SlotEntry {
  name?: string;
  sortOrder: number;
  content?: string;
  isNew?: boolean;
}

export async function runDynamicReset(): Promise<ResetResult> {
  const result: ResetResult = {
    updated: [],
    created: [],
    deleted: [],
    errors: []
  };

  // The Shared Slot Map - CRC and CMOS get the same slot
  const slotMap: Record<string, SlotEntry> = {
    // Section 1
    'ONE-1.5': { name: '1.5. On-Site Work and Installation', sortOrder: 150 },
    'ONE-1.6-CRC': { name: '1.6. On-Site Work - CRC Client Acknowledgment', sortOrder: 160 },
    'ONE-1.6-CMOS': { name: '1.6. On-Site Work - CMOS Provisions', sortOrder: 160 },
    'ONE-1.6': { name: '1.7. Custom Design Services (Optional)', sortOrder: 170 },
    
    // Section 3
    'ONE-3.1': { sortOrder: 310 },
    'ONE-3.2': { sortOrder: 320 },
    'ONE-3.3': { sortOrder: 330 },
    'ONE-3.4-CRC': { name: '3.4. Client-Retained Contractor Obligations', sortOrder: 340 },
    'ONE-3.4-CMOS': { name: '3.4. General Contractor Engagement - CMOS', sortOrder: 340 },
    'ONE-3.5-FIN': { name: '3.5. Financial Obligations', sortOrder: 350 },
    'ONE-3.5-FINANCIAL': { name: '3.5. Financial Obligations', sortOrder: 350 },
    'ONE-3.5': { name: '3.6. Green Light Conditions', sortOrder: 360 },
    'ONE-3.6': { name: '3.6. Green Light Conditions', sortOrder: 360 },
    
    // Section 5
    'ONE-5.3': { name: '5.3. Site Readiness and Delivery Coordination', sortOrder: 530 },
    'ONE-5.3-CRC': { name: '5.3. Site Readiness - CRC', sortOrder: 531 },
    'ONE-5.3-CMOS': { name: '5.3. Site Readiness - CMOS', sortOrder: 531 },
    
    // Section 7 - Risk of Loss
    'ONE-SEC-7-HEADER': { 
      name: 'SECTION 7: RISK OF LOSS AND TITLE TRANSFER', 
      sortOrder: 700,
      content: '<h3>SECTION 7. RISK OF LOSS AND TITLE TRANSFER</h3>'
    },
    'ONE-7.1': { name: '7.1. Risk of Loss', sortOrder: 710 },
    'ONE-7.2': { name: '7.2. Title Transfer', sortOrder: 720 },
    
    // Section 8 - Indemnification
    'ONE-SEC-8-HEADER': { 
      name: 'SECTION 8: INDEMNIFICATION', 
      sortOrder: 800,
      content: '<h3>SECTION 8. INDEMNIFICATION</h3>'
    },
    'ONE-8.1': { name: '8.1. Client Indemnification', sortOrder: 810 },
    'ONE-8.2': { name: '8.2. Company Indemnification', sortOrder: 820 },
    
    // Section 9 - Limitation of Liability
    'ONE-SEC-9-HEADER': { 
      name: 'SECTION 9: LIMITATION OF LIABILITY', 
      sortOrder: 900,
      content: '<h3>SECTION 9. LIMITATION OF LIABILITY</h3>'
    },
    'ONE-9.1': { name: '9.1. Cap on Liability', sortOrder: 910 },
    'ONE-9.2': { sortOrder: 920 },
    'ONE-9.3': { sortOrder: 930 },
    'ONE-9.4': { sortOrder: 940 },
    'ONE-9.5': { sortOrder: 950 },
  };

  try {
    // First: Delete any ghost IP clauses in Section 7 range
    const ipGhosts = [
      '7.1. Ownership of Work Product',
      '7.2. License to Use Work Product',
      '7.3. Restrictions on Use',
      '7.4. Indemnification Regarding Work Product Use',
      '7.5. Publicity Rights'
    ];
    
    for (const ipName of ipGhosts) {
      const ghosts = await db.select().from(clauses)
        .where(ilike(clauses.name, `%${ipName}%`));
      for (const ghost of ghosts) {
        await db.delete(clauses).where(eq(clauses.id, ghost.id));
        result.deleted.push(`IP Ghost: ${ghost.clauseCode} - ${ghost.name}`);
      }
    }

    // Process each slot entry
    for (const [clauseCode, entry] of Object.entries(slotMap)) {
      try {
        // Check if clause exists
        const existing = await db.select().from(clauses)
          .where(eq(clauses.clauseCode, clauseCode));
        
        if (existing.length > 0) {
          // Build update object
          const updateObj: any = { sortOrder: entry.sortOrder };
          if (entry.name) updateObj.name = entry.name;
          if (entry.content) updateObj.content = entry.content;
          
          await db.update(clauses)
            .set(updateObj)
            .where(eq(clauses.clauseCode, clauseCode));
          result.updated.push(`${clauseCode}: sortOrder=${entry.sortOrder}${entry.name ? `, name="${entry.name}"` : ''}`);
        } else if (entry.isNew || entry.content) {
          // Create new clause if marked or has content (headers)
          await db.execute(sql`
            INSERT INTO clauses (clause_code, name, content, contract_type, category, sort_order)
            VALUES (${clauseCode}, ${entry.name || clauseCode}, ${entry.content || ''}, 'ONE Agreement', 'Body', ${entry.sortOrder})
          `);
          result.created.push(`${clauseCode}: name="${entry.name}", sortOrder=${entry.sortOrder}`);
        }
        // If not exists and not marked as new, skip silently
      } catch (err) {
        result.errors.push(`Error processing ${clauseCode}: ${err}`);
      }
    }

    // Clean up old headers if any
    const oldHeaders = ['ONE-7-HEADER'];
    for (const oldCode of oldHeaders) {
      const exists = await db.select().from(clauses).where(eq(clauses.clauseCode, oldCode));
      if (exists.length > 0) {
        await db.delete(clauses).where(eq(clauses.clauseCode, oldCode));
        result.deleted.push(`Old header: ${oldCode}`);
      }
    }

    // Verify symmetry: check that both CRC and CMOS versions exist for split slots
    const splitPairs = [
      { base: 'ONE-1.6', crc: 'ONE-1.6-CRC', cmos: 'ONE-1.6-CMOS', slot: 160, section: '1.6' },
      { base: 'ONE-3.4', crc: 'ONE-3.4-CRC', cmos: 'ONE-3.4-CMOS', slot: 340, section: '3.4' },
      { base: 'ONE-5.3', crc: 'ONE-5.3-CRC', cmos: 'ONE-5.3-CMOS', slot: 531, section: '5.3' },
    ];

    for (const pair of splitPairs) {
      const crcExists = await db.select().from(clauses).where(eq(clauses.clauseCode, pair.crc));
      const cmosExists = await db.select().from(clauses).where(eq(clauses.clauseCode, pair.cmos));
      
      if (crcExists.length === 0) {
        result.errors.push(`Missing CRC variant: ${pair.crc}`);
      }
      if (cmosExists.length === 0) {
        result.errors.push(`Missing CMOS variant: ${pair.cmos}`);
      }
    }

  } catch (error) {
    result.errors.push(`Fatal error: ${error}`);
  }

  return result;
}

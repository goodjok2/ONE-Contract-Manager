import { db } from '../db';
import { clauses } from '../../shared/schema';
import { eq, sql } from 'drizzle-orm';

interface OrderResult {
  updated: string[];
  created: string[];
  errors: string[];
}

interface GoldenOrderEntry {
  name: string;
  sortOrder: number;
  content?: string;
  isNew?: boolean;
}

export async function runForceOrder(): Promise<OrderResult> {
  const result: OrderResult = {
    updated: [],
    created: [],
    errors: []
  };

  // The Golden Order Map - using actual clause codes from database
  const goldenOrder: Record<string, GoldenOrderEntry> = {
    // Section 1 - Fixing 1.6 collision (actual codes: ONE-1.6-CRC and ONE-1.6)
    'ONE-1.6-CRC': { name: '1.6. On-Site Work - CRC Client Acknowledgment', sortOrder: 160 },
    'ONE-1.6': { name: '1.7. Custom Design Services (Optional)', sortOrder: 170 },
    
    // Section 3 - Fixing 3.4 -> 3.6 -> 3.5 scramble
    'ONE-3.4-CRC': { name: '3.4. Client-Retained Contractor Obligations', sortOrder: 340 },
    'ONE-3.5': { name: '3.5. Financial Obligations', sortOrder: 350 },
    'ONE-3.6': { name: '3.6. Green Light Conditions', sortOrder: 360 },
    
    // Section 5 - Fixing double 5.3
    'ONE-5.3': { name: '5.3.1 Site Readiness Overview', sortOrder: 530 },
    'ONE-5.3-CRC': { name: '5.3.2 Site Readiness - CRC', sortOrder: 531 },
    
    // Section 7 - Update existing header
    'ONE-SEC-7-HEADER': { 
      name: 'SECTION 7: RISK OF LOSS AND TITLE TRANSFER', 
      sortOrder: 700,
      content: '<h3>SECTION 7. RISK OF LOSS AND TITLE TRANSFER</h3>'
    },
    'ONE-7.1': { 
      name: '7.1. Risk of Loss', 
      sortOrder: 710,
      content: '<p>7.1. Risk of Loss. Risk of loss for Home Model units shall transfer to Client upon delivery to the Site.</p>',
      isNew: true
    },
    'ONE-7.2': { 
      name: '7.2. Title Transfer', 
      sortOrder: 720,
      content: '<p>7.2. Title Transfer. Title to the Home Model units shall transfer to Client upon full payment of the Purchase Price.</p>',
      isNew: true
    },
    
    // Section 8 - Update existing header and add content
    'ONE-SEC-8-HEADER': { 
      name: 'SECTION 8: INDEMNIFICATION', 
      sortOrder: 800,
      content: '<h3>SECTION 8. INDEMNIFICATION</h3>'
    },
    'ONE-8.1': { 
      name: '8.1. Client Indemnification', 
      sortOrder: 810,
      content: '<p>8.1. Client Indemnification. Client shall indemnify, defend, and hold harmless Company from any claims arising from Client\'s breach of this Agreement or negligent acts.</p>',
      isNew: true
    },
    'ONE-8.2': { name: '8.2. Company Indemnification', sortOrder: 820 },
    
    // Section 9 - Update existing header and add content
    'ONE-SEC-9-HEADER': { 
      name: 'SECTION 9: LIMITATION OF LIABILITY', 
      sortOrder: 900,
      content: '<h3>SECTION 9. LIMITATION OF LIABILITY</h3>'
    },
    'ONE-9.1': { 
      name: '9.1. Cap on Liability', 
      sortOrder: 910,
      content: '<p>9.1. Cap on Liability. In no event shall either party\'s total liability exceed the Purchase Price paid under this Agreement.</p>',
      isNew: true
    }
  };

  try {
    // Process each entry in the golden order
    for (const [clauseCode, entry] of Object.entries(goldenOrder)) {
      try {
        // Check if clause exists
        const existing = await db.select().from(clauses)
          .where(eq(clauses.clauseCode, clauseCode));
        
        if (existing.length > 0) {
          // Update existing clause
          await db.update(clauses)
            .set({ 
              name: entry.name,
              sortOrder: entry.sortOrder,
              ...(entry.content ? { content: entry.content } : {})
            })
            .where(eq(clauses.clauseCode, clauseCode));
          result.updated.push(`${clauseCode}: name="${entry.name}", sortOrder=${entry.sortOrder}`);
        } else if (entry.isNew) {
          // Create new clause if marked as new
          await db.execute(sql`
            INSERT INTO clauses (clause_code, name, content, contract_type, category, sort_order)
            VALUES (${clauseCode}, ${entry.name}, ${entry.content || ''}, 'ONE', 'Header', ${entry.sortOrder})
          `);
          result.created.push(`${clauseCode}: name="${entry.name}", sortOrder=${entry.sortOrder}`);
        } else {
          // Clause doesn't exist and isn't marked as new - just note it
          result.errors.push(`Clause ${clauseCode} not found in database (skipped)`);
        }
      } catch (err) {
        result.errors.push(`Error processing ${clauseCode}: ${err}`);
      }
    }

    // Clean up any duplicate headers (delete the old format)
    const oldHeaders = ['ONE-7-HEADER'];
    for (const oldCode of oldHeaders) {
      const exists = await db.select().from(clauses).where(eq(clauses.clauseCode, oldCode));
      if (exists.length > 0) {
        await db.delete(clauses).where(eq(clauses.clauseCode, oldCode));
        result.updated.push(`Removed old header: ${oldCode}`);
      }
    }

  } catch (error) {
    result.errors.push(`Fatal error: ${error}`);
  }

  return result;
}

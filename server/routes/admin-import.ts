import { Router, Request, Response } from "express";
import { Pool } from "pg";
import { requireAuth } from "../middleware/auth";
import multer from "multer";
import mammoth from "mammoth";
import { z } from "zod";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const router = Router();

router.use(requireAuth);

const clauseSchema = z.object({
  name: z.string().min(1),
  content: z.string(),
  level: z.number().int().min(1).max(6).default(1),
});

const saveTemplateSchema = z.object({
  templateName: z.string().min(1, "Template name is required"),
  contractType: z.enum(["ONE", "CMOS", "CRC", "ONSITE", "MFG"]),
  clauses: z.array(clauseSchema).min(1, "At least one clause is required"),
});

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      cb(null, true);
    } else {
      cb(new Error('Only DOCX files are allowed'));
    }
  }
});

interface ParsedClause {
  name: string;
  content: string;
  level: number;
}

router.post("/admin/parse-docx", upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const result = await mammoth.convertToHtml({ buffer: req.file.buffer });
    const html = result.value;

    const clauses = shredDocument(html);

    res.json({ 
      clauses,
      messages: result.messages 
    });
  } catch (error: any) {
    console.error("Error parsing DOCX:", error);
    res.status(500).json({ error: "Failed to parse DOCX file" });
  }
});

function shredDocument(html: string): ParsedClause[] {
  const clauses: ParsedClause[] = [];
  
  const headerRegex = /<h([1-6])[^>]*>(.*?)<\/h[1-6]>/gi;
  const parts = html.split(headerRegex);
  
  let currentClause: ParsedClause | null = null;
  
  for (let i = 1; i < parts.length; i += 3) {
    const level = parseInt(parts[i], 10);
    const headerText = stripHtml(parts[i + 1] || '');
    const content = parts[i + 2] || '';
    
    if (headerText.trim()) {
      if (currentClause) {
        clauses.push(currentClause);
      }
      
      currentClause = {
        name: headerText.trim(),
        content: content.trim(),
        level
      };
    } else if (currentClause) {
      currentClause.content += content;
    }
  }
  
  if (currentClause) {
    clauses.push(currentClause);
  }
  
  if (clauses.length === 0 && parts[0]) {
    const paragraphs = parts[0].split(/<p[^>]*>/i).filter(p => p.trim());
    paragraphs.forEach((p, index) => {
      const text = stripHtml(p);
      if (text.trim()) {
        clauses.push({
          name: `Section ${index + 1}`,
          content: `<p>${p}`,
          level: 1
        });
      }
    });
  }
  
  return clauses;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim();
}

router.post("/admin/save-template", async (req: Request, res: Response) => {
  const client = await pool.connect();
  
  try {
    const parseResult = saveTemplateSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ 
        error: "Validation failed", 
        details: parseResult.error.errors 
      });
    }
    
    const { templateName, contractType, clauses } = parseResult.data;

    await client.query('BEGIN');

    const templateResult = await client.query(
      `INSERT INTO contract_templates 
       (organization_id, name, display_name, contract_type, version, status, is_active)
       VALUES ($1, $2, $2, $3, '1.0', 'active', true)
       RETURNING *`,
      [req.organizationId, templateName, contractType]
    );
    
    const template = templateResult.rows[0];
    const clauseIds: number[] = [];

    for (let i = 0; i < clauses.length; i++) {
      const clause = clauses[i];
      const slug = generateSlug(clause.name, i);
      
      const clauseResult = await client.query(
        `INSERT INTO clauses 
         (organization_id, slug, header_text, body_html, level, "order", contract_types)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          req.organizationId,
          slug,
          clause.name,
          clause.content,
          clause.level || 1,
          i,
          JSON.stringify([contractType])
        ]
      );
      
      const savedClause = clauseResult.rows[0];
      clauseIds.push(savedClause.id);

      await client.query(
        `INSERT INTO template_clauses 
         (template_id, clause_id, order_index, organization_id)
         VALUES ($1, $2, $3, $4)`,
        [template.id, savedClause.id, i, req.organizationId]
      );
    }

    await client.query(
      `UPDATE contract_templates SET base_clause_ids = $1 WHERE id = $2`,
      [clauseIds, template.id]
    );

    await client.query('COMMIT');

    res.status(201).json({ 
      success: true,
      template,
      clauseCount: clauses.length
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error("Error saving template:", error);
    res.status(500).json({ error: "Failed to save template" });
  } finally {
    client.release();
  }
});

function generateSlug(name: string, index: number): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50);
  
  return `${base}-${Date.now()}-${index}`;
}

export default router;

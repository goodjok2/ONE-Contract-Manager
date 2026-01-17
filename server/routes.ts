import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertLLCSchema, insertContractSchema } from "@shared/schema";
import { z } from "zod";
import { db as sqliteDb } from "./db/index";
import { projects, clients, childLlcs, financials } from "./db/schema";
import { eq } from "drizzle-orm";
import { mapProjectToVariables } from "./lib/mapper";
import Docxtemplater from "docxtemplater";
import PizZip from "pizzip";
import * as fs from "fs";
import * as path from "path";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Projects API
  app.get("/api/projects", async (req, res) => {
    try {
      const allProjects = await sqliteDb.query.projects.findMany({
        with: {
          client: true,
          childLlc: true,
          financials: true,
        },
      });
      res.json(allProjects);
    } catch (error) {
      console.error("Error fetching projects:", error);
      res.status(500).json({ error: "Failed to fetch projects" });
    }
  });

  app.post("/api/projects", async (req, res) => {
    try {
      const { project, client, llc, financials: financialsData } = req.body;

      const result = await sqliteDb.transaction(async (tx) => {
        const [newProject] = await tx
          .insert(projects)
          .values({
            projectNumber: project.projectNumber,
            name: project.name,
            status: project.status || "Draft",
            state: project.state,
          })
          .returning();

        const llcLegalName = llc?.legalName?.trim() 
          ? llc.legalName 
          : `Dvele Partners ${project.name} LLC`;

        await tx.insert(clients).values({
          projectId: newProject.id,
          legalName: client.legalName,
          address: client.address,
          email: client.email,
          phone: client.phone,
          entityType: client.entityType,
        });

        await tx.insert(childLlcs).values({
          projectId: newProject.id,
          legalName: llcLegalName,
          ein: llc?.ein,
          insuranceStatus: llc?.insuranceStatus || "Pending",
          formationDate: llc?.formationDate,
        });

        await tx.insert(financials).values({
          projectId: newProject.id,
          designFee: financialsData?.designFee,
          prelimOffsite: financialsData?.prelimOffsite,
          prelimOnsite: financialsData?.prelimOnsite,
          finalOffsite: financialsData?.finalOffsite,
          refinedOnsite: financialsData?.refinedOnsite,
          isLocked: false,
        });

        return newProject;
      });

      const fullProject = await sqliteDb.query.projects.findFirst({
        where: eq(projects.id, result.id),
        with: {
          client: true,
          childLlc: true,
          financials: true,
        },
      });

      res.status(201).json(fullProject);
    } catch (error) {
      console.error("Error creating project:", error);
      res.status(500).json({ error: "Failed to create project" });
    }
  });

  app.patch("/api/projects/:id/green-light", async (req, res) => {
    try {
      const projectId = parseInt(req.params.id, 10);
      const { finalOffsite, refinedOnsite } = req.body;

      await sqliteDb
        .update(financials)
        .set({
          isLocked: true,
          finalOffsite: finalOffsite,
          refinedOnsite: refinedOnsite,
        })
        .where(eq(financials.projectId, projectId));

      const updatedProject = await sqliteDb.query.projects.findFirst({
        where: eq(projects.id, projectId),
        with: {
          client: true,
          childLlc: true,
          financials: true,
        },
      });

      if (!updatedProject) {
        return res.status(404).json({ error: "Project not found" });
      }

      res.json(updatedProject);
    } catch (error) {
      console.error("Error updating project green-light:", error);
      res.status(500).json({ error: "Failed to update project" });
    }
  });

  app.post("/api/projects/:id/contract", async (req, res) => {
    try {
      const projectId = parseInt(req.params.id, 10);

      const project = await sqliteDb.query.projects.findFirst({
        where: eq(projects.id, projectId),
        with: {
          client: true,
          childLlc: true,
          financials: true,
        },
      });

      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      const templatePath = path.join(process.cwd(), "server", "templates", "template.docx");
      
      if (!fs.existsSync(templatePath)) {
        return res.status(500).json({ error: "Contract template not found" });
      }

      const content = fs.readFileSync(templatePath, "binary");
      const zip = new PizZip(content);
      const doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
      });

      const variables = mapProjectToVariables(project);
      doc.render(variables);

      const buf = doc.getZip().generate({
        type: "nodebuffer",
        compression: "DEFLATE",
      });

      const filename = `Contract_${project.projectNumber || project.id}.docx`;
      
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.send(buf);
    } catch (error) {
      console.error("Error generating contract:", error);
      res.status(500).json({ error: "Failed to generate contract" });
    }
  });

  // Dashboard Stats
  app.get("/api/dashboard/stats", async (req, res) => {
    try {
      const stats = await storage.getDashboardStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      res.status(500).json({ error: "Failed to fetch dashboard stats" });
    }
  });

  // LLCs CRUD
  app.get("/api/llcs", async (req, res) => {
    try {
      const llcs = await storage.getLLCs();
      res.json(llcs);
    } catch (error) {
      console.error("Error fetching LLCs:", error);
      res.status(500).json({ error: "Failed to fetch LLCs" });
    }
  });

  app.get("/api/llcs/:id", async (req, res) => {
    try {
      const llc = await storage.getLLC(req.params.id);
      if (!llc) {
        return res.status(404).json({ error: "LLC not found" });
      }
      res.json(llc);
    } catch (error) {
      console.error("Error fetching LLC:", error);
      res.status(500).json({ error: "Failed to fetch LLC" });
    }
  });

  app.post("/api/llcs", async (req, res) => {
    try {
      const validated = insertLLCSchema.parse(req.body);
      const llc = await storage.createLLC(validated);
      res.status(201).json(llc);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      console.error("Error creating LLC:", error);
      res.status(500).json({ error: "Failed to create LLC" });
    }
  });

  app.patch("/api/llcs/:id", async (req, res) => {
    try {
      const validated = insertLLCSchema.partial().parse(req.body);
      const llc = await storage.updateLLC(req.params.id, validated);
      if (!llc) {
        return res.status(404).json({ error: "LLC not found" });
      }
      res.json(llc);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      console.error("Error updating LLC:", error);
      res.status(500).json({ error: "Failed to update LLC" });
    }
  });

  app.delete("/api/llcs/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteLLC(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "LLC not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting LLC:", error);
      res.status(500).json({ error: "Failed to delete LLC" });
    }
  });

  // Contracts CRUD
  app.get("/api/contracts", async (req, res) => {
    try {
      const contracts = await storage.getContracts();
      res.json(contracts);
    } catch (error) {
      console.error("Error fetching contracts:", error);
      res.status(500).json({ error: "Failed to fetch contracts" });
    }
  });

  app.get("/api/contracts/:id", async (req, res) => {
    try {
      const contract = await storage.getContract(req.params.id);
      if (!contract) {
        return res.status(404).json({ error: "Contract not found" });
      }
      res.json(contract);
    } catch (error) {
      console.error("Error fetching contract:", error);
      res.status(500).json({ error: "Failed to fetch contract" });
    }
  });

  app.post("/api/contracts", async (req, res) => {
    try {
      const validated = insertContractSchema.parse(req.body);
      const contract = await storage.createContract(validated);
      res.status(201).json(contract);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      console.error("Error creating contract:", error);
      res.status(500).json({ error: "Failed to create contract" });
    }
  });

  app.patch("/api/contracts/:id", async (req, res) => {
    try {
      const validated = insertContractSchema.partial().parse(req.body);
      const contract = await storage.updateContract(req.params.id, validated);
      if (!contract) {
        return res.status(404).json({ error: "Contract not found" });
      }
      res.json(contract);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      console.error("Error updating contract:", error);
      res.status(500).json({ error: "Failed to update contract" });
    }
  });

  app.delete("/api/contracts/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteContract(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Contract not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting contract:", error);
      res.status(500).json({ error: "Failed to delete contract" });
    }
  });

  return httpServer;
}

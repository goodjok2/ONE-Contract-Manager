import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertLLCSchema, insertContractSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
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

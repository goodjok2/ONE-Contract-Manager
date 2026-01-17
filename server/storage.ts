import { 
  users, llcs, contracts,
  type User, type InsertUser,
  type LLC, type InsertLLC,
  type Contract, type InsertContract,
  type DashboardStats
} from "@shared/schema";
import { db } from "./db";
import { eq, sql, count } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // LLCs
  getLLCs(): Promise<LLC[]>;
  getLLC(id: string): Promise<LLC | undefined>;
  createLLC(llc: InsertLLC): Promise<LLC>;
  updateLLC(id: string, llc: Partial<InsertLLC>): Promise<LLC | undefined>;
  deleteLLC(id: string): Promise<boolean>;
  
  // Contracts
  getContracts(): Promise<Contract[]>;
  getContract(id: string): Promise<Contract | undefined>;
  createContract(contract: InsertContract): Promise<Contract>;
  updateContract(id: string, contract: Partial<InsertContract>): Promise<Contract | undefined>;
  deleteContract(id: string): Promise<boolean>;
  
  // Dashboard
  getDashboardStats(): Promise<DashboardStats>;
}

export class DatabaseStorage implements IStorage {
  // Users
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  // LLCs
  async getLLCs(): Promise<LLC[]> {
    return await db.select().from(llcs).orderBy(llcs.createdAt);
  }

  async getLLC(id: string): Promise<LLC | undefined> {
    const [llc] = await db.select().from(llcs).where(eq(llcs.id, id));
    return llc || undefined;
  }

  async createLLC(insertLLC: InsertLLC): Promise<LLC> {
    const [llc] = await db.insert(llcs).values(insertLLC).returning();
    return llc;
  }

  async updateLLC(id: string, updateData: Partial<InsertLLC>): Promise<LLC | undefined> {
    const [llc] = await db.update(llcs).set(updateData).where(eq(llcs.id, id)).returning();
    return llc || undefined;
  }

  async deleteLLC(id: string): Promise<boolean> {
    const result = await db.delete(llcs).where(eq(llcs.id, id)).returning();
    return result.length > 0;
  }

  // Contracts
  async getContracts(): Promise<Contract[]> {
    return await db.select().from(contracts).orderBy(contracts.createdAt);
  }

  async getContract(id: string): Promise<Contract | undefined> {
    const [contract] = await db.select().from(contracts).where(eq(contracts.id, id));
    return contract || undefined;
  }

  async createContract(insertContract: InsertContract): Promise<Contract> {
    const [contract] = await db.insert(contracts).values(insertContract).returning();
    return contract;
  }

  async updateContract(id: string, updateData: Partial<InsertContract>): Promise<Contract | undefined> {
    const [contract] = await db.update(contracts).set(updateData).where(eq(contracts.id, id)).returning();
    return contract || undefined;
  }

  async deleteContract(id: string): Promise<boolean> {
    const result = await db.delete(contracts).where(eq(contracts.id, id)).returning();
    return result.length > 0;
  }

  // Dashboard Stats
  async getDashboardStats(): Promise<DashboardStats> {
    // Count active projects (contracts with status signed or approved)
    const activeProjectsResult = await db
      .select({ count: count() })
      .from(contracts)
      .where(sql`${contracts.status} IN ('signed', 'approved', 'pending_review')`);
    
    // Count pending LLCs
    const pendingLLCsResult = await db
      .select({ count: count() })
      .from(llcs)
      .where(sql`${llcs.status} IN ('pending', 'in_formation')`);
    
    // Sum total contract value
    const totalValueResult = await db
      .select({ total: sql<string>`COALESCE(SUM(${contracts.contractValue}), 0)` })
      .from(contracts)
      .where(sql`${contracts.status} IN ('signed', 'approved')`);

    return {
      activeProjects: activeProjectsResult[0]?.count ?? 0,
      pendingLLCs: pendingLLCsResult[0]?.count ?? 0,
      totalContractValue: parseFloat(totalValueResult[0]?.total ?? "0"),
    };
  }
}

export const storage = new DatabaseStorage();

import { 
  llcs, contracts,
  type LLC, type NewLLC,
  type Contract, type NewContract,
} from "@shared/schema";
import { db } from "./db";
import { eq, sql, count, desc } from "drizzle-orm";

export interface DashboardStats {
  activeProjects: number;
  pendingLLCs: number;
  totalContractValue: number;
  totalContracts: number;
  drafts: number;
  pendingReview: number;
  signed: number;
  draftsValue: number;
  pendingValue: number;
  signedValue: number;
}

export interface IStorage {
  // LLCs
  getLLCs(): Promise<LLC[]>;
  getLLC(id: number): Promise<LLC | undefined>;
  createLLC(llc: NewLLC): Promise<LLC>;
  updateLLC(id: number, llc: Partial<NewLLC>): Promise<LLC | undefined>;
  deleteLLC(id: number): Promise<boolean>;
  
  // Contracts
  getContracts(): Promise<Contract[]>;
  getContract(id: number): Promise<Contract | undefined>;
  createContract(contract: NewContract): Promise<Contract>;
  updateContract(id: number, contract: Partial<NewContract>): Promise<Contract | undefined>;
  deleteContract(id: number): Promise<boolean>;
  
  // Dashboard
  getDashboardStats(): Promise<DashboardStats>;
}

export class DatabaseStorage implements IStorage {
  // LLCs
  async getLLCs(): Promise<LLC[]> {
    return await db.select().from(llcs).orderBy(desc(llcs.createdAt));
  }

  async getLLC(id: number): Promise<LLC | undefined> {
    const [llc] = await db.select().from(llcs).where(eq(llcs.id, id));
    return llc || undefined;
  }

  async createLLC(insertLLC: NewLLC): Promise<LLC> {
    const [llc] = await db.insert(llcs).values(insertLLC).returning();
    return llc;
  }

  async updateLLC(id: number, updateData: Partial<NewLLC>): Promise<LLC | undefined> {
    const [llc] = await db.update(llcs).set({ ...updateData, updatedAt: new Date() }).where(eq(llcs.id, id)).returning();
    return llc || undefined;
  }

  async deleteLLC(id: number): Promise<boolean> {
    const result = await db.delete(llcs).where(eq(llcs.id, id)).returning();
    return result.length > 0;
  }

  // Contracts
  async getContracts(): Promise<Contract[]> {
    return await db.select().from(contracts).orderBy(desc(contracts.generatedAt));
  }

  async getContract(id: number): Promise<Contract | undefined> {
    const [contract] = await db.select().from(contracts).where(eq(contracts.id, id));
    return contract || undefined;
  }

  async createContract(insertContract: NewContract): Promise<Contract> {
    const [contract] = await db.insert(contracts).values(insertContract).returning();
    return contract;
  }

  async updateContract(id: number, updateData: Partial<NewContract>): Promise<Contract | undefined> {
    const [contract] = await db.update(contracts).set(updateData).where(eq(contracts.id, id)).returning();
    return contract || undefined;
  }

  async deleteContract(id: number): Promise<boolean> {
    const result = await db.delete(contracts).where(eq(contracts.id, id)).returning();
    return result.length > 0;
  }

  // Dashboard Stats
  async getDashboardStats(): Promise<DashboardStats> {
    // Count LLCs by status
    const formingLLCsResult = await db
      .select({ count: count() })
      .from(llcs)
      .where(sql`${llcs.status} IN ('pending', 'forming')`);
    
    // Total contracts
    const totalResult = await db.select({ count: count() }).from(contracts);
    
    // Drafts count
    const draftsResult = await db
      .select({ count: count() })
      .from(contracts)
      .where(sql`${contracts.status} = 'Draft'`);
    
    // Pending review count
    const pendingResult = await db
      .select({ count: count() })
      .from(contracts)
      .where(sql`${contracts.status} = 'PendingReview'`);
    
    // Executed/Signed count
    const signedResult = await db
      .select({ count: count() })
      .from(contracts)
      .where(sql`${contracts.status} = 'Executed'`);

    // Active projects (contracts not draft)
    const activeProjectsResult = await db
      .select({ count: count() })
      .from(contracts)
      .where(sql`${contracts.status} IN ('PendingReview', 'Approved', 'Executed')`);

    return {
      activeProjects: activeProjectsResult[0]?.count ?? 0,
      pendingLLCs: formingLLCsResult[0]?.count ?? 0,
      totalContractValue: 0,
      totalContracts: totalResult[0]?.count ?? 0,
      drafts: draftsResult[0]?.count ?? 0,
      pendingReview: pendingResult[0]?.count ?? 0,
      signed: signedResult[0]?.count ?? 0,
      draftsValue: 0,
      pendingValue: 0,
      signedValue: 0,
    };
  }
}

export const storage = new DatabaseStorage();

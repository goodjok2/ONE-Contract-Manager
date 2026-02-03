import { 
  contracts,
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
    // LLC stats temporarily disabled (Phase A refactoring - llcs table removed)
    const pendingLLCsCount = 0;
    
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
      pendingLLCs: pendingLLCsCount,
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

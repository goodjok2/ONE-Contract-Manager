import type { Project, Client, ChildLlc, Financial } from "../db/schema";

interface ProjectWithRelations {
  id: number;
  projectNumber: string;
  name: string;
  status: string;
  state: string | null;
  createdAt: string | null;
  client: Client | null;
  childLlc: ChildLlc | null;
  financials: Financial | null;
}

interface ContractVariables {
  PROJECT_NUMBER: string;
  PROJECT_NAME: string;
  PROJECT_STATE: string;
  CLIENT_LEGAL_NAME: string;
  CLIENT_ADDRESS: string;
  CLIENT_EMAIL: string;
  DVELE_PARTNERS_XYZ: string;
  DESIGN_FEE: string;
  PRELIMINARY_OFFSITE_PRICE: string;
  PRELIMINARY_ONSITE_PRICE: string;
  PRELIMINARY_TOTAL_PRICE: string;
  BUILDING_CODE_REFERENCE: string;
}

function formatCurrency(value: number | null | undefined): string {
  if (value == null) return "$0.00";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

function getBuildingCodeReference(state: string | null): string {
  switch (state) {
    case "CA":
      return "2022 California Building Code";
    case "TX":
      return "2021 IBC with Texas Amendments";
    default:
      return "2021 IBC";
  }
}

export function mapProjectToVariables(project: ProjectWithRelations): ContractVariables {
  const designFee = project.financials?.designFee ?? 0;
  const prelimOffsite = project.financials?.prelimOffsite ?? 0;
  const prelimOnsite = project.financials?.prelimOnsite ?? 0;
  const prelimTotal = designFee + prelimOffsite + prelimOnsite;

  return {
    PROJECT_NUMBER: project.projectNumber || "",
    PROJECT_NAME: project.name || "",
    PROJECT_STATE: project.state || "",
    CLIENT_LEGAL_NAME: project.client?.legalName || "",
    CLIENT_ADDRESS: project.client?.address || "",
    CLIENT_EMAIL: project.client?.email || "",
    DVELE_PARTNERS_XYZ: project.childLlc?.legalName || "",
    DESIGN_FEE: formatCurrency(designFee),
    PRELIMINARY_OFFSITE_PRICE: formatCurrency(prelimOffsite),
    PRELIMINARY_ONSITE_PRICE: formatCurrency(prelimOnsite),
    PRELIMINARY_TOTAL_PRICE: formatCurrency(prelimTotal),
    BUILDING_CODE_REFERENCE: getBuildingCodeReference(project.state),
  };
}

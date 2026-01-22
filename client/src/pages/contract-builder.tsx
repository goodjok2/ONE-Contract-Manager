import { useState, useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { type LLC } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import {
  Check,
  ChevronRight,
  ChevronLeft,
  Building2,
  Users,
  DollarSign,
  MapPin,
  Calendar,
  FileText,
  Download,
  Eye,
  Loader2,
  Home,
  FileCheck,
  AlertCircle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

const US_STATES = [
  { code: "AL", name: "Alabama" }, { code: "AK", name: "Alaska" }, { code: "AZ", name: "Arizona" },
  { code: "AR", name: "Arkansas" }, { code: "CA", name: "California" }, { code: "CO", name: "Colorado" },
  { code: "CT", name: "Connecticut" }, { code: "DE", name: "Delaware" }, { code: "FL", name: "Florida" },
  { code: "GA", name: "Georgia" }, { code: "HI", name: "Hawaii" }, { code: "ID", name: "Idaho" },
  { code: "IL", name: "Illinois" }, { code: "IN", name: "Indiana" }, { code: "IA", name: "Iowa" },
  { code: "KS", name: "Kansas" }, { code: "KY", name: "Kentucky" }, { code: "LA", name: "Louisiana" },
  { code: "ME", name: "Maine" }, { code: "MD", name: "Maryland" }, { code: "MA", name: "Massachusetts" },
  { code: "MI", name: "Michigan" }, { code: "MN", name: "Minnesota" }, { code: "MS", name: "Mississippi" },
  { code: "MO", name: "Missouri" }, { code: "MT", name: "Montana" }, { code: "NE", name: "Nebraska" },
  { code: "NV", name: "Nevada" }, { code: "NH", name: "New Hampshire" }, { code: "NJ", name: "New Jersey" },
  { code: "NM", name: "New Mexico" }, { code: "NY", name: "New York" }, { code: "NC", name: "North Carolina" },
  { code: "ND", name: "North Dakota" }, { code: "OH", name: "Ohio" }, { code: "OK", name: "Oklahoma" },
  { code: "OR", name: "Oregon" }, { code: "PA", name: "Pennsylvania" }, { code: "RI", name: "Rhode Island" },
  { code: "SC", name: "South Carolina" }, { code: "SD", name: "South Dakota" }, { code: "TN", name: "Tennessee" },
  { code: "TX", name: "Texas" }, { code: "UT", name: "Utah" }, { code: "VT", name: "Vermont" },
  { code: "VA", name: "Virginia" }, { code: "WA", name: "Washington" }, { code: "WV", name: "West Virginia" },
  { code: "WI", name: "Wisconsin" }, { code: "WY", name: "Wyoming" }
];

const ENTITY_TYPES = [
  { value: "individual", label: "Individual" },
  { value: "married_couple", label: "Married Couple" },
  { value: "trust", label: "Trust" },
  { value: "llc", label: "LLC" },
  { value: "corporation", label: "Corporation" },
  { value: "partnership", label: "Partnership" },
];

const HOME_MODELS = [
  { value: "Ora 1200", sqft: 1200, beds: 2, baths: 2 },
  { value: "Ora 1600", sqft: 1600, beds: 3, baths: 2 },
  { value: "Ora 2000", sqft: 2000, beds: 3, baths: 2.5 },
  { value: "Ora 2400", sqft: 2400, beds: 4, baths: 3 },
  { value: "Ora 2800", sqft: 2800, beds: 4, baths: 3.5 },
  { value: "Ora 3200", sqft: 3200, beds: 5, baths: 4 },
  { value: "Custom", sqft: 0, beds: 0, baths: 0 },
];

const baseContractSchema = z.object({
  projectNumber: z.string().min(1, "Project number is required"),
  projectName: z.string().min(1, "Project name is required"),
  serviceModel: z.enum(["CRC", "CMOS"], { required_error: "Service model is required" }),
  totalUnits: z.coerce.number().min(1, "At least 1 unit required").default(1),

  clientLegalName: z.string().min(1, "Client legal name is required"),
  clientEntityType: z.string().min(1, "Entity type is required"),
  clientState: z.string().min(1, "Client state is required"),
  spvLegalName: z.string().min(1, "SPV/LLC name is required"),
  spvState: z.string().default("DE"),
  onsiteContractorName: z.string().optional(),
  onsiteContractorLicense: z.string().optional(),
  onsiteContractorAddress: z.string().optional(),

  deliveryAddress: z.string().min(1, "Delivery address is required"),
  siteAddress: z.string().min(1, "Site address is required"),
  homeModel: z.string().min(1, "Home model is required"),
  homeSqft: z.coerce.number().min(100, "Square footage required"),
  homeBedrooms: z.coerce.number().min(1, "Bedrooms required"),
  homeBathrooms: z.coerce.number().min(1, "Bathrooms required"),

  designFee: z.coerce.number().min(0, "Design fee required"),
  preliminaryOffsitePrice: z.coerce.number().min(0, "Offsite price required"),
  preliminaryOnsitePrice: z.coerce.number().min(0, "Onsite price required"),
  milestone1Percent: z.coerce.number().min(0).max(100).default(25),
  milestone2Percent: z.coerce.number().min(0).max(100).default(25),
  milestone3Percent: z.coerce.number().min(0).max(100).default(25),
  milestone4Percent: z.coerce.number().min(0).max(100).default(15),
  milestone5Percent: z.coerce.number().min(0).max(100).default(5),
  retainagePercent: z.coerce.number().min(0).max(20).default(5),

  agreementDate: z.string().min(1, "Agreement date is required"),
  warrantyFitFinish: z.coerce.number().min(1).default(24),
  warrantyEnvelope: z.coerce.number().min(1).default(60),
  warrantyStructural: z.coerce.number().min(1).default(120),
  projectState: z.string().min(1, "Project state is required"),
  projectCounty: z.string().min(1, "County is required"),
}).refine((data) => {
  if (data.serviceModel === "CRC") {
    return data.onsiteContractorName && data.onsiteContractorName.length > 0;
  }
  return true;
}, {
  message: "Contractor name is required for CRC service model",
  path: ["onsiteContractorName"],
});

const contractSchema = baseContractSchema;

type ContractFormValues = z.infer<typeof baseContractSchema>;

const STORAGE_KEY = "dvele-contract-wizard-draft";

const steps = [
  { id: 1, name: "Project Basics", icon: Building2, description: "Name, number & service model" },
  { id: 2, name: "Parties", icon: Users, description: "Client, SPV & contractor info" },
  { id: 3, name: "Site Details", icon: MapPin, description: "Address & unit specifications" },
  { id: 4, name: "Financials", icon: DollarSign, description: "Pricing & payment milestones" },
  { id: 5, name: "Schedule & Legal", icon: Calendar, description: "Dates, warranties & jurisdiction" },
  { id: 6, name: "Review & Generate", icon: FileText, description: "Preview and download contracts" },
];

interface GeneratedContract {
  filename: string;
  content: string;
  clauseCount: number;
}

interface GenerateResult {
  success: boolean;
  projectName: string;
  serviceModel: string;
  contracts: {
    one_agreement: GeneratedContract;
    manufacturing_subcontract: GeneratedContract;
    onsite_subcontract: GeneratedContract;
  };
  generatedAt: string;
}

interface ClausePreviewResult {
  oneAgreement: { total: number; conditional: number };
  manufacturing: { total: number };
  onsite: { total: number };
}

export default function ContractBuilder() {
  const [currentStep, setCurrentStep] = useState(1);
  const [clausePreview, setClausePreview] = useState<ClausePreviewResult | null>(null);
  const [generatedContracts, setGeneratedContracts] = useState<GenerateResult | null>(null);
  const [spvManuallyEdited, setSpvManuallyEdited] = useState(false);
  const [llcMode, setLlcMode] = useState<"new" | "existing">("new");
  const [selectedLlcId, setSelectedLlcId] = useState<string>("");
  const { toast } = useToast();

  const { data: existingLLCs = [] } = useQuery<LLC[]>({
    queryKey: ["/api/llcs"],
  });

  const defaultValues: ContractFormValues = {
    projectNumber: "",
    projectName: "",
    serviceModel: "CRC",
    totalUnits: 1,
    clientLegalName: "",
    clientEntityType: "individual",
    clientState: "CA",
    spvLegalName: "",
    spvState: "DE",
    onsiteContractorName: "",
    onsiteContractorLicense: "",
    onsiteContractorAddress: "",
    deliveryAddress: "",
    siteAddress: "",
    homeModel: "",
    homeSqft: 0,
    homeBedrooms: 3,
    homeBathrooms: 2,
    designFee: 45000,
    preliminaryOffsitePrice: 425000,
    preliminaryOnsitePrice: 380000,
    milestone1Percent: 25,
    milestone2Percent: 25,
    milestone3Percent: 25,
    milestone4Percent: 15,
    milestone5Percent: 5,
    retainagePercent: 5,
    agreementDate: new Date().toISOString().split("T")[0],
    warrantyFitFinish: 24,
    warrantyEnvelope: 60,
    warrantyStructural: 120,
    projectState: "CA",
    projectCounty: "",
  };

  const form = useForm<ContractFormValues>({
    resolver: zodResolver(contractSchema),
    defaultValues,
    mode: "onChange",
  });

  const projectName = useWatch({ control: form.control, name: "projectName" });
  const clientLegalName = useWatch({ control: form.control, name: "clientLegalName" });
  const serviceModel = useWatch({ control: form.control, name: "serviceModel" });
  const totalUnits = useWatch({ control: form.control, name: "totalUnits" });
  const homeModel = useWatch({ control: form.control, name: "homeModel" });
  const designFee = useWatch({ control: form.control, name: "designFee" });
  const preliminaryOffsitePrice = useWatch({ control: form.control, name: "preliminaryOffsitePrice" });
  const preliminaryOnsitePrice = useWatch({ control: form.control, name: "preliminaryOnsitePrice" });
  const siteAddress = useWatch({ control: form.control, name: "siteAddress" });

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        form.reset(parsed);
      } catch {
        console.error("Failed to load saved draft");
      }
    }
  }, [form]);

  useEffect(() => {
    const subscription = form.watch((values) => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(values));
    });
    return () => subscription.unsubscribe();
  }, [form]);

  useEffect(() => {
    if (projectName && !spvManuallyEdited) {
      const cleanName = projectName.replace(/\s+/g, " ").trim();
      form.setValue("spvLegalName", `Dvele Partners ${cleanName} LLC`);
    }
  }, [projectName, spvManuallyEdited, form]);

  useEffect(() => {
    if (siteAddress) {
      form.setValue("deliveryAddress", siteAddress);
    }
  }, [siteAddress, form]);

  useEffect(() => {
    const model = HOME_MODELS.find(m => m.value === homeModel);
    if (model && model.value !== "Custom") {
      form.setValue("homeSqft", model.sqft);
      form.setValue("homeBedrooms", model.beds);
      form.setValue("homeBathrooms", model.baths);
    }
  }, [homeModel, form]);

  const totalContractPrice = Number(designFee || 0) + Number(preliminaryOffsitePrice || 0) + Number(preliminaryOnsitePrice || 0);

  const generateMutation = useMutation({
    mutationFn: async (data: ContractFormValues) => {
      const stateName = US_STATES.find(s => s.code === data.projectState)?.name || data.projectState;
      
      const projectData = {
        PROJECT_NUMBER: data.projectNumber,
        PROJECT_NAME: data.projectName,
        TOTAL_UNITS: String(data.totalUnits),
        AGREEMENT_EXECUTION_DATE: data.agreementDate,
        EFFECTIVE_DATE: data.agreementDate,
        DVELE_PARTNERS_XYZ: `Dvele Partners ${data.projectName}`,
        DVELE_PARTNERS_XYZ_LEGAL_NAME: data.spvLegalName,
        DVELE_PARTNERS_XYZ_STATE: "Delaware",
        DVELE_PARTNERS_XYZ_ENTITY_TYPE: "limited liability company",
        DP_X: data.spvLegalName,
        CLIENT_LEGAL_NAME: data.clientLegalName,
        CLIENT_STATE: US_STATES.find(s => s.code === data.clientState)?.name || data.clientState,
        CLIENT_ENTITY_TYPE: data.clientEntityType,
        CLIENT_FULL_NAME: data.clientLegalName,
        CLIENT_TITLE: data.clientEntityType === "individual" ? "Homeowner" : "Authorized Representative",
        DELIVERY_ADDRESS: data.deliveryAddress,
        SITE_ADDRESS: data.siteAddress,
        SERVICE_MODEL: data.serviceModel,
        ON_SITE_SERVICES_SELECTION: data.serviceModel === "CRC" ? "CLIENT-RETAINED CONTRACTOR" : "COMPANY-MANAGED ON-SITE SERVICES",
        DESIGN_FEE: `$${data.designFee.toLocaleString()}`,
        DESIGN_REVISION_ROUNDS: "3",
        PRELIMINARY_CONTRACT_PRICE: `$${totalContractPrice.toLocaleString()}`,
        PRELIMINARY_TOTAL_PRICE: `$${totalContractPrice.toLocaleString()}`,
        PRELIMINARY_OFFSITE_PRICE: `$${data.preliminaryOffsitePrice.toLocaleString()}`,
        PRELIMINARY_ONSITE_PRICE: `$${data.preliminaryOnsitePrice.toLocaleString()}`,
        DELIVERY_AND_INSTALLATION_PRICE: "$50,000",
        FINAL_CONTRACT_PRICE: `$${totalContractPrice.toLocaleString()}`,
        CONTRACT_PRICE: `$${totalContractPrice.toLocaleString()}`,
        HOME_MODEL_1: `Dvele ${data.homeModel}`,
        HOME_MODEL_1_PRELIMINARY_PRICE: `$${data.preliminaryOffsitePrice.toLocaleString()}`,
        SHIPPING_PRELIMINARY_PRICE: "$15,000",
        INSTALLATION_PRELIMINARY_PRICE: "$35,000",
        SITE_PREP_PRELIMINARY_PRICE: "$120,000",
        UTILITIES_PRELIMINARY_PRICE: "$80,000",
        COMPLETION_PRELIMINARY_PRICE: "$180,000",
        UNIT_1_MODEL: data.homeModel,
        UNIT_1_SQFT: String(data.homeSqft),
        UNIT_1_BEDROOMS: String(data.homeBedrooms),
        UNIT_1_BATHROOMS: String(data.homeBathrooms),
        UNIT_1_PRICE: `$${data.preliminaryOffsitePrice.toLocaleString()}`,
        MILESTONE_1_PERCENT: String(data.milestone1Percent),
        MILESTONE_2_PERCENT: String(data.milestone2Percent),
        MILESTONE_3_PERCENT: String(data.milestone3Percent),
        MILESTONE_4_PERCENT: String(data.milestone4Percent),
        MILESTONE_5_PERCENT: String(data.milestone5Percent),
        RETAINAGE_DAYS: "60",
        RETAINAGE_PERCENT: String(data.retainagePercent),
        DVELE_FIT_FINISH_WARRANTY: String(data.warrantyFitFinish),
        DVELE_ENVELOPE_WARRANTY: String(data.warrantyEnvelope),
        DVELE_STRUCTURAL_WARRANTY: String(data.warrantyStructural),
        PROJECT_STATE: stateName,
        PROJECT_STATE_CODE: `${stateName.substring(0, 3)}. Civ. Code`,
        PROJECT_COUNTY: data.projectCounty,
        PROJECT_FEDERAL_DISTRICT: `Northern District of ${stateName}`,
        ONSITE_PROVIDER_NAME: data.onsiteContractorName || "Premier Site Builders Inc.",
        MANUFACTURER_NAME: "Dvele Manufacturing LLC",
        COMPANY_ADDRESS: "123 Innovation Way, San Francisco, CA 94105",
        COMPANY_EMAIL: "contracts@dvele.com",
        MANUFACTURER_ADDRESS: "500 Factory Drive, Hayward, CA 94545",
        MANUFACTURER_EMAIL: "manufacturing@dvele.com",
        PROVIDER_ADDRESS: data.onsiteContractorAddress || "789 Builder Lane, San Jose, CA 95112",
        PROVIDER_EMAIL: "info@premiersitebuilders.com",
        MANUFACTURING_PRICE: `$${data.preliminaryOffsitePrice.toLocaleString()}`,
        TOTAL_ONSITE_PRICE: `$${data.preliminaryOnsitePrice.toLocaleString()}`,
        SITE_PREP_PRICE: "$120,000",
        FOUNDATION_UTILITIES_PRICE: "$100,000",
        SHIPPING_LOGISTICS_PRICE: "$15,000",
        INSTALLATION_PRICE: "$65,000",
        COMPLETION_PRICE: "$80,000",
        GL_INSURANCE_LIMIT: "$1,000,000",
        GL_AGGREGATE_LIMIT: "$2,000,000",
        POLLUTION_LIABILITY_LIMIT: "$1,000,000",
        LIQUIDATED_DAMAGES_AMOUNT: "$500",
        ONSITE_DESIGN_PAYMENT: "5",
        SITE_PREP_PAYMENT: "15",
        FOUNDATION_PAYMENT: "20",
        DELIVERY_PAYMENT: "15",
        INSTALLATION_PAYMENT: "20",
        SUBSTANTIAL_COMPLETION_PAYMENT: "15",
        MFG_DESIGN_PAYMENT: "10",
        MFG_MATERIALS_PAYMENT: "25",
        MFG_PRODUCTION_START_PAYMENT: "25",
        MFG_PRODUCTION_50_PAYMENT: "20",
        MFG_PRODUCTION_COMPLETE_PAYMENT: "15",
        MFG_DELIVERY_PAYMENT: "5",
        TOTAL_MANUFACTURING_PRICE: `$${data.preliminaryOffsitePrice.toLocaleString()}`,
        DESIGN_MANUFACTURING_PRICE: `$${Math.round(data.preliminaryOffsitePrice * 0.1).toLocaleString()}`,
        PRODUCTION_MANUFACTURING_PRICE: `$${Math.round(data.preliminaryOffsitePrice * 0.9).toLocaleString()}`,
        DELIVERY_PREP_PRICE: "$15,000",
        QC_PRICE: "$10,000",
        DESIGN_PAYMENT: `$${Math.round(data.preliminaryOffsitePrice * 0.1).toLocaleString()}`,
        PRODUCTION_START_PAYMENT: `$${Math.round(data.preliminaryOffsitePrice * 0.25).toLocaleString()}`,
        PRODUCTION_COMPLETION_PAYMENT: `$${Math.round(data.preliminaryOffsitePrice * 0.45).toLocaleString()}`,
        DELIVERY_READY_PAYMENT: `$${Math.round(data.preliminaryOffsitePrice * 0.2).toLocaleString()}`,
        LIQUIDATED_DAMAGES_CAP: "$50,000",
        PRODUCT_LIABILITY_LIMIT: "$2,000,000",
        HOME_MODEL_X: `Dvele ${data.homeModel}`,
        HOME_MODEL_X_PRELIMINARY_PRICE: `$${data.preliminaryOffsitePrice.toLocaleString()}`,
      };

      const response = await apiRequest("POST", "/api/contracts/generate-package", { projectData });
      return response.json();
    },
    onSuccess: (data) => {
      setGeneratedContracts(data);
      localStorage.removeItem(STORAGE_KEY);
      toast({
        title: "Contracts Generated!",
        description: "Your complete contract package is ready for download.",
      });
    },
    onError: () => {
      toast({
        title: "Generation Failed",
        description: "Failed to generate contracts. Please try again.",
        variant: "destructive",
      });
    },
  });

  const previewMutation = useMutation({
    mutationFn: async (data: ContractFormValues) => {
      const response = await apiRequest("POST", "/api/contracts/preview-clauses", {
        contractType: "ONE",
        projectData: {
          SERVICE_MODEL: data.serviceModel,
          ON_SITE_SERVICES_SELECTION: data.serviceModel === "CRC" ? "CLIENT-RETAINED CONTRACTOR" : "COMPANY-MANAGED ON-SITE SERVICES",
          TOTAL_UNITS: String(data.totalUnits),
        },
      });
      return response.json();
    },
    onSuccess: (data) => {
      const conditionalCount = data.conditionalClauses?.length || 0;
      setClausePreview({
        oneAgreement: { total: data.summary?.totalClauses || 129, conditional: conditionalCount },
        manufacturing: { total: 61 },
        onsite: { total: 79 },
      });
    },
    onError: () => {
      setClausePreview({
        oneAgreement: { total: 129, conditional: serviceModel === "CRC" ? 7 : 8 },
        manufacturing: { total: 61 },
        onsite: { total: 79 },
      });
    },
  });

  const getStepFields = (step: number): (keyof ContractFormValues)[] => {
    const currentServiceModel = form.getValues("serviceModel");
    switch (step) {
      case 1:
        return ["projectNumber", "projectName", "serviceModel", "totalUnits"];
      case 2:
        if (currentServiceModel === "CRC") {
          return ["clientLegalName", "clientEntityType", "clientState", "spvLegalName", "onsiteContractorName"];
        }
        return ["clientLegalName", "clientEntityType", "clientState", "spvLegalName"];
      case 3:
        return ["deliveryAddress", "siteAddress", "homeModel", "homeSqft", "homeBedrooms", "homeBathrooms"];
      case 4:
        return ["designFee", "preliminaryOffsitePrice", "preliminaryOnsitePrice"];
      case 5:
        return ["agreementDate", "projectState", "projectCounty"];
      default:
        return [];
    }
  };

  const validateStep = async (step: number): Promise<boolean> => {
    const fieldsToValidate = getStepFields(step);
    if (fieldsToValidate.length === 0) return true;
    const isValid = await form.trigger(fieldsToValidate);
    
    if (step === 2 && llcMode === "existing" && !selectedLlcId) {
      toast({
        title: "LLC Selection Required",
        description: "Please select an existing LLC or switch to 'Create New LLC' mode.",
        variant: "destructive",
      });
      return false;
    }
    
    return isValid;
  };

  const handleNext = async () => {
    const isValid = await validateStep(currentStep);
    if (isValid && currentStep < 6) {
      setCurrentStep(currentStep + 1);
      
      if (currentStep === 5) {
        const values = form.getValues();
        previewMutation.mutate(values);
      }
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleGenerate = () => {
    const values = form.getValues();
    generateMutation.mutate(values);
  };

  const handleDownload = (contract: GeneratedContract) => {
    const blob = new Blob([contract.content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const txtFilename = contract.filename.endsWith(".docx") 
      ? contract.filename.replace(".docx", ".txt")
      : contract.filename.endsWith(".txt") 
        ? contract.filename 
        : `${contract.filename}.txt`;
    a.download = txtFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({
      title: "Download Started",
      description: `${txtFilename} is downloading...`,
    });
  };

  const handleDownloadAll = () => {
    if (generatedContracts) {
      handleDownload(generatedContracts.contracts.one_agreement);
      setTimeout(() => handleDownload(generatedContracts.contracts.manufacturing_subcontract), 500);
      setTimeout(() => handleDownload(generatedContracts.contracts.onsite_subcontract), 1000);
    }
  };

  const handleClearDraft = () => {
    localStorage.removeItem(STORAGE_KEY);
    form.reset(defaultValues);
    setClausePreview(null);
    setGeneratedContracts(null);
    setSpvManuallyEdited(false);
    setCurrentStep(1);
    toast({
      title: "Draft Cleared",
      description: "Your saved draft has been cleared.",
    });
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="flex-1 p-6 md:p-8">
      <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-foreground" data-testid="text-page-title">
            Contract Generation Wizard
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Build a complete contract package with clause-based assembly
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleClearDraft} data-testid="button-clear-draft">
          Clear Draft
        </Button>
      </div>

      <div className="max-w-5xl">
        <nav aria-label="Progress" className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-muted-foreground">
              Step {currentStep} of 6
            </span>
            <span className="text-sm text-muted-foreground">
              {Math.round((currentStep / 6) * 100)}% Complete
            </span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${(currentStep / 6) * 100}%` }}
            />
          </div>
          <ol className="flex items-center mt-4 overflow-x-auto pb-2">
            {steps.map((step, stepIdx) => (
              <li key={step.name} className={`relative ${stepIdx !== steps.length - 1 ? "flex-1 pr-4" : ""}`}>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => currentStep > step.id && setCurrentStep(step.id)}
                    disabled={currentStep < step.id}
                    className={`flex h-8 w-8 items-center justify-center rounded-full border-2 transition-colors ${
                      currentStep > step.id
                        ? "border-primary bg-primary text-primary-foreground cursor-pointer"
                        : currentStep === step.id
                        ? "border-primary bg-background text-primary"
                        : "border-muted bg-background text-muted-foreground cursor-not-allowed"
                    }`}
                    data-testid={`step-indicator-${step.id}`}
                  >
                    {currentStep > step.id ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <span className="text-xs font-medium">{step.id}</span>
                    )}
                  </button>
                  <div className="hidden md:block">
                    <span
                      className={`text-xs font-medium ${
                        currentStep >= step.id ? "text-foreground" : "text-muted-foreground"
                      }`}
                    >
                      {step.name}
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </nav>

        <Form {...form}>
          <form onKeyDown={(e) => { if (e.key === "Enter" && currentStep < 6) e.preventDefault(); }}>
            
            {currentStep === 1 && (
              <Card data-testid="card-step-1">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Building2 className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">Project Basics</CardTitle>
                      <CardDescription>Project identification and service configuration</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="projectNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Project Number</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., 2025-001" data-testid="input-project-number" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="projectName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Project Name</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., Smith Residence" data-testid="input-project-name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="serviceModel"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Service Model</FormLabel>
                        <FormDescription>
                          Choose how on-site construction will be managed
                        </FormDescription>
                        <FormControl>
                          <RadioGroup
                            onValueChange={field.onChange}
                            value={field.value}
                            className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2"
                          >
                            <label
                              htmlFor="crc"
                              className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                                field.value === "CRC" ? "border-primary bg-primary/5" : "border-muted hover:border-muted-foreground/50"
                              }`}
                            >
                              <RadioGroupItem value="CRC" id="crc" data-testid="radio-crc" />
                              <div>
                                <span className="font-medium">CRC</span>
                                <p className="text-sm text-muted-foreground mt-1">
                                  Client-Retained Contractor - Client hires their own licensed general contractor
                                </p>
                              </div>
                            </label>
                            <label
                              htmlFor="cmos"
                              className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                                field.value === "CMOS" ? "border-primary bg-primary/5" : "border-muted hover:border-muted-foreground/50"
                              }`}
                            >
                              <RadioGroupItem value="CMOS" id="cmos" data-testid="radio-cmos" />
                              <div>
                                <span className="font-medium">CMOS</span>
                                <p className="text-sm text-muted-foreground mt-1">
                                  Company-Managed On-Site Services - Dvele manages all site construction
                                </p>
                              </div>
                            </label>
                          </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="totalUnits"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Total Units</FormLabel>
                        <FormDescription>Number of modular homes in this project</FormDescription>
                        <FormControl>
                          <RadioGroup
                            onValueChange={(v) => field.onChange(parseInt(v))}
                            value={String(field.value)}
                            className="flex gap-4 mt-2"
                          >
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="1" id="unit-1" data-testid="radio-unit-1" />
                              <Label htmlFor="unit-1" className="cursor-pointer">Single Unit</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="2" id="unit-2" data-testid="radio-unit-multi" />
                              <Label htmlFor="unit-2" className="cursor-pointer">Multi-Unit (2+)</Label>
                            </div>
                          </RadioGroup>
                        </FormControl>
                        {field.value > 1 && (
                          <Input
                            type="number"
                            min={2}
                            className="w-24 mt-2"
                            value={field.value}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 2)}
                            data-testid="input-total-units"
                          />
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            )}

            {currentStep === 2 && (
              <Card data-testid="card-step-2">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Users className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">Parties</CardTitle>
                      <CardDescription>Client information and project entity setup</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <h3 className="font-medium mb-4 flex items-center gap-2">
                      <Users className="h-4 w-4" /> Client Information
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="clientLegalName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Client Legal Name</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g., John and Jane Smith" data-testid="input-client-name" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="clientEntityType"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Entity Type</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-entity-type">
                                  <SelectValue placeholder="Select type" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {ENTITY_TYPES.map((type) => (
                                  <SelectItem key={type.value} value={type.value}>
                                    {type.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="clientState"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Client State</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-client-state">
                                  <SelectValue placeholder="Select state" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {US_STATES.map((state) => (
                                  <SelectItem key={state.code} value={state.code}>
                                    {state.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <h3 className="font-medium mb-4 flex items-center gap-2">
                      <Building2 className="h-4 w-4" /> SPV/LLC Information
                    </h3>
                    
                    <div className="mb-4">
                      <RadioGroup
                        value={llcMode}
                        onValueChange={(value: "new" | "existing") => {
                          setLlcMode(value);
                          if (value === "new") {
                            setSelectedLlcId("");
                            form.setValue("spvLegalName", "");
                            form.setValue("spvState", "DE");
                            setSpvManuallyEdited(false);
                          } else {
                            form.setValue("spvLegalName", "");
                            form.setValue("spvState", "DE");
                          }
                        }}
                        className="flex flex-wrap gap-4"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="new" id="llc-new" data-testid="radio-llc-new" />
                          <Label htmlFor="llc-new">Create New LLC</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="existing" id="llc-existing" data-testid="radio-llc-existing" />
                          <Label htmlFor="llc-existing">Use Existing LLC ({existingLLCs.filter(l => l.status === "active").length} active)</Label>
                        </div>
                      </RadioGroup>
                    </div>

                    {llcMode === "existing" ? (
                      <div className="space-y-4">
                        <div>
                          <Label className="mb-2 block">Select LLC</Label>
                          <Select
                            value={selectedLlcId}
                            onValueChange={(value) => {
                              if (value && value !== "none") {
                                setSelectedLlcId(value);
                                const selectedLlc = existingLLCs.find(l => String(l.id) === value);
                                if (selectedLlc) {
                                  form.setValue("spvLegalName", selectedLlc.name);
                                  form.setValue("spvState", selectedLlc.stateOfFormation || "DE");
                                  setSpvManuallyEdited(true);
                                }
                              }
                            }}
                          >
                            <SelectTrigger data-testid="select-existing-llc">
                              <SelectValue placeholder="Choose an existing LLC" />
                            </SelectTrigger>
                            <SelectContent>
                              {existingLLCs.filter(l => l.status === "active" || l.status === "forming").map((llc) => (
                                <SelectItem key={llc.id} value={String(llc.id)}>
                                  <div className="flex items-center gap-2">
                                    <span>{llc.name}</span>
                                    <Badge variant={llc.status === "active" ? "default" : "secondary"} className="text-xs">
                                      {llc.status}
                                    </Badge>
                                  </div>
                                </SelectItem>
                              ))}
                              {existingLLCs.filter(l => l.status === "active" || l.status === "forming").length === 0 && (
                                <SelectItem value="none" disabled>No active or forming LLCs available</SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                          <p className="text-sm text-muted-foreground mt-2">
                            Only active and forming LLCs are available for selection
                          </p>
                        </div>
                        {selectedLlcId ? (
                          <div className="p-3 bg-muted/50 rounded-lg">
                            <div className="flex items-center gap-2 mb-2">
                              <Building2 className="h-4 w-4 text-primary" />
                              <span className="font-medium">Selected LLC</span>
                            </div>
                            <p className="text-sm">{form.getValues("spvLegalName")}</p>
                            <p className="text-xs text-muted-foreground">
                              State: {US_STATES.find(s => s.code === form.getValues("spvState"))?.name || form.getValues("spvState")}
                            </p>
                          </div>
                        ) : (
                          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                            <div className="flex items-center gap-2">
                              <AlertCircle className="h-4 w-4 text-amber-500" />
                              <span className="text-sm text-amber-700 dark:text-amber-400">
                                Please select an LLC from the dropdown above to continue
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="spvLegalName"
                          render={({ field }) => (
                            <FormItem className="md:col-span-2">
                              <FormLabel>SPV Legal Name</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="Auto-generated from project name"
                                  data-testid="input-spv-name"
                                  {...field}
                                  onChange={(e) => {
                                    setSpvManuallyEdited(true);
                                    field.onChange(e);
                                  }}
                                />
                              </FormControl>
                              <FormDescription>
                                Auto-generated based on project name. You can customize if needed.
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="spvState"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>SPV State of Formation</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger data-testid="select-spv-state">
                                    <SelectValue placeholder="Select state" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {US_STATES.map((state) => (
                                    <SelectItem key={state.code} value={state.code}>
                                      {state.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    )}
                  </div>

                  {serviceModel === "CRC" && (
                    <>
                      <Separator />
                      <div>
                        <h3 className="font-medium mb-4 flex items-center gap-2">
                          <Home className="h-4 w-4" /> On-Site Contractor (CRC)
                          <Badge variant="secondary">Required for CRC</Badge>
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="onsiteContractorName"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Contractor Name <span className="text-destructive">*</span></FormLabel>
                                <FormControl>
                                  <Input placeholder="e.g., Premier Site Builders Inc." data-testid="input-contractor-name" {...field} />
                                </FormControl>
                                <FormDescription>Required for CRC service model</FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="onsiteContractorLicense"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Contractor License #</FormLabel>
                                <FormControl>
                                  <Input placeholder="e.g., CA-B-123456" data-testid="input-contractor-license" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="onsiteContractorAddress"
                            render={({ field }) => (
                              <FormItem className="md:col-span-2">
                                <FormLabel>Contractor Address</FormLabel>
                                <FormControl>
                                  <Input placeholder="Full business address" data-testid="input-contractor-address" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            )}

            {currentStep === 3 && (
              <Card data-testid="card-step-3">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <MapPin className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">Site Details</CardTitle>
                      <CardDescription>Property location and unit specifications</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 gap-4">
                    <FormField
                      control={form.control}
                      name="siteAddress"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Site Address</FormLabel>
                          <FormControl>
                            <Input placeholder="123 Main Street, City, State ZIP" data-testid="input-site-address" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="deliveryAddress"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Delivery Address</FormLabel>
                          <FormDescription>Same as site address unless delivery differs</FormDescription>
                          <FormControl>
                            <Input placeholder="Delivery location" data-testid="input-delivery-address" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <Separator />

                  <div>
                    <h3 className="font-medium mb-4 flex items-center gap-2">
                      <Home className="h-4 w-4" /> Unit Specifications
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="homeModel"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Home Model</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-home-model">
                                  <SelectValue placeholder="Select model" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {HOME_MODELS.map((model) => (
                                  <SelectItem key={model.value} value={model.value}>
                                    {model.value} {model.sqft > 0 && `(${model.sqft} sqft)`}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="homeSqft"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Square Footage</FormLabel>
                            <FormControl>
                              <Input type="number" min={100} data-testid="input-sqft" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="homeBedrooms"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Bedrooms</FormLabel>
                            <FormControl>
                              <Input type="number" min={1} max={10} data-testid="input-bedrooms" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="homeBathrooms"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Bathrooms</FormLabel>
                            <FormControl>
                              <Input type="number" min={1} max={10} step={0.5} data-testid="input-bathrooms" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {currentStep === 4 && (
              <Card data-testid="card-step-4">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <DollarSign className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">Financials</CardTitle>
                      <CardDescription>Pricing structure and payment milestones</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="designFee"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Design Fee ($)</FormLabel>
                          <FormControl>
                            <Input type="number" min={0} data-testid="input-design-fee" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="preliminaryOffsitePrice"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Preliminary Offsite Price ($)</FormLabel>
                          <FormControl>
                            <Input type="number" min={0} data-testid="input-offsite-price" {...field} />
                          </FormControl>
                          <FormDescription>Manufacturing & delivery</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="preliminaryOnsitePrice"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Preliminary Onsite Price ($)</FormLabel>
                          <FormControl>
                            <Input type="number" min={0} data-testid="input-onsite-price" {...field} />
                          </FormControl>
                          <FormDescription>Site work & installation</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="p-4 rounded-lg bg-muted/50">
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                      <span className="text-sm font-medium text-muted-foreground">Total Contract Price</span>
                      <span className="text-2xl font-bold text-foreground" data-testid="text-total-price">
                        {formatCurrency(totalContractPrice)}
                      </span>
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <h3 className="font-medium mb-4">Payment Milestones (%)</h3>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                      <FormField
                        control={form.control}
                        name="milestone1Percent"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Design Complete</FormLabel>
                            <FormControl>
                              <Input type="number" min={0} max={100} data-testid="input-milestone-1" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="milestone2Percent"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Green Light</FormLabel>
                            <FormControl>
                              <Input type="number" min={0} max={100} data-testid="input-milestone-2" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="milestone3Percent"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Production 50%</FormLabel>
                            <FormControl>
                              <Input type="number" min={0} max={100} data-testid="input-milestone-3" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="milestone4Percent"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Delivery Ready</FormLabel>
                            <FormControl>
                              <Input type="number" min={0} max={100} data-testid="input-milestone-4" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="milestone5Percent"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Final/Retainage</FormLabel>
                            <FormControl>
                              <Input type="number" min={0} max={100} data-testid="input-milestone-5" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {currentStep === 5 && (
              <Card data-testid="card-step-5">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Calendar className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">Schedule & Legal</CardTitle>
                      <CardDescription>Agreement dates, warranties, and jurisdiction</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <FormField
                    control={form.control}
                    name="agreementDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Agreement Date</FormLabel>
                        <FormControl>
                          <Input type="date" data-testid="input-agreement-date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Separator />

                  <div>
                    <h3 className="font-medium mb-4">Warranty Periods (months)</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name="warrantyFitFinish"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Fit & Finish</FormLabel>
                            <FormControl>
                              <Input type="number" min={1} data-testid="input-warranty-fit" {...field} />
                            </FormControl>
                            <FormDescription>Default: 24 months</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="warrantyEnvelope"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Building Envelope</FormLabel>
                            <FormControl>
                              <Input type="number" min={1} data-testid="input-warranty-envelope" {...field} />
                            </FormControl>
                            <FormDescription>Default: 60 months</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="warrantyStructural"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Structural</FormLabel>
                            <FormControl>
                              <Input type="number" min={1} data-testid="input-warranty-structural" {...field} />
                            </FormControl>
                            <FormDescription>Default: 120 months</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <h3 className="font-medium mb-4">Jurisdiction</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="projectState"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Project State</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-project-state">
                                  <SelectValue placeholder="Select state" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {US_STATES.map((state) => (
                                  <SelectItem key={state.code} value={state.code}>
                                    {state.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="projectCounty"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>County</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g., Santa Clara" data-testid="input-county" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {currentStep === 6 && (
              <div className="space-y-6">
                <Card data-testid="card-step-6-summary">
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <FileCheck className="h-5 w-5" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">Review & Generate</CardTitle>
                        <CardDescription>Review your contract configuration and generate documents</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Project</h4>
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Project:</span>
                            <span className="font-medium">{projectName || "-"}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Service Model:</span>
                            <Badge variant={serviceModel === "CRC" ? "default" : "secondary"}>
                              {serviceModel}
                            </Badge>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Units:</span>
                            <span>{totalUnits}</span>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-4">
                        <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Parties</h4>
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Client:</span>
                            <span className="font-medium">{clientLegalName || "-"}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">SPV:</span>
                            <span className="text-sm">{form.getValues("spvLegalName") || "-"}</span>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-4">
                        <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Property</h4>
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Model:</span>
                            <span>{homeModel || "-"}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Size:</span>
                            <span>{form.getValues("homeSqft")} sqft</span>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-4">
                        <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Financial</h4>
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Total Price:</span>
                            <span className="font-bold text-lg">{formatCurrency(totalContractPrice)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card data-testid="card-clause-preview">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Eye className="h-5 w-5" />
                      Clause Preview
                    </CardTitle>
                    <CardDescription>Clauses that will be included based on your configuration</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="p-4 rounded-lg border bg-card">
                        <div className="flex items-center gap-2 mb-2">
                          <FileText className="h-4 w-4 text-primary" />
                          <span className="font-medium">ONE Agreement</span>
                        </div>
                        <div className="text-2xl font-bold">{clausePreview?.oneAgreement.total || 129}</div>
                        <div className="text-sm text-muted-foreground">
                          clauses ({clausePreview?.oneAgreement.conditional || (serviceModel === "CRC" ? 7 : 8)} conditional)
                        </div>
                      </div>
                      <div className="p-4 rounded-lg border bg-card">
                        <div className="flex items-center gap-2 mb-2">
                          <Building2 className="h-4 w-4 text-primary" />
                          <span className="font-medium">Manufacturing</span>
                        </div>
                        <div className="text-2xl font-bold">{clausePreview?.manufacturing.total || 61}</div>
                        <div className="text-sm text-muted-foreground">clauses</div>
                      </div>
                      <div className="p-4 rounded-lg border bg-card">
                        <div className="flex items-center gap-2 mb-2">
                          <MapPin className="h-4 w-4 text-primary" />
                          <span className="font-medium">On-Site</span>
                        </div>
                        <div className="text-2xl font-bold">{clausePreview?.onsite.total || 79}</div>
                        <div className="text-sm text-muted-foreground">clauses</div>
                      </div>
                    </div>

                    {serviceModel === "CRC" && (
                      <div className="mt-4 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                        <div className="flex items-start gap-2">
                          <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5" />
                          <div className="text-sm">
                            <span className="font-medium text-blue-700 dark:text-blue-300">CRC Mode:</span>
                            <span className="text-blue-600 dark:text-blue-400 ml-1">
                              Client-Retained Contractor clauses will be included. CMOS clauses excluded.
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                    {serviceModel === "CMOS" && (
                      <div className="mt-4 p-3 rounded-lg bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800">
                        <div className="flex items-start gap-2">
                          <AlertCircle className="h-4 w-4 text-purple-600 dark:text-purple-400 mt-0.5" />
                          <div className="text-sm">
                            <span className="font-medium text-purple-700 dark:text-purple-300">CMOS Mode:</span>
                            <span className="text-purple-600 dark:text-purple-400 ml-1">
                              Company-Managed On-Site Services clauses will be included. CRC clauses excluded.
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {!generatedContracts && (
                  <div className="flex justify-center">
                    <Button
                      type="button"
                      size="lg"
                      onClick={handleGenerate}
                      disabled={generateMutation.isPending}
                      className="gap-2"
                      data-testid="button-generate"
                    >
                      {generateMutation.isPending ? (
                        <>
                          <Loader2 className="h-5 w-5 animate-spin" />
                          Generating Contracts...
                        </>
                      ) : (
                        <>
                          <FileText className="h-5 w-5" />
                          Generate Contract Package
                        </>
                      )}
                    </Button>
                  </div>
                )}

                {generatedContracts && (
                  <Card className="border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20" data-testid="card-generated-contracts">
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2 text-green-700 dark:text-green-400">
                        <Check className="h-5 w-5" />
                        Contracts Generated Successfully!
                      </CardTitle>
                      <CardDescription>
                        Generated at {new Date(generatedContracts.generatedAt).toLocaleString()}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="p-4 rounded-lg border bg-card">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium">ONE Agreement</span>
                            <Badge>{generatedContracts.contracts.one_agreement.clauseCount} clauses</Badge>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full gap-2"
                            onClick={() => handleDownload(generatedContracts.contracts.one_agreement)}
                            data-testid="button-download-one"
                          >
                            <Download className="h-4 w-4" />
                            Download
                          </Button>
                        </div>
                        <div className="p-4 rounded-lg border bg-card">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium">Manufacturing</span>
                            <Badge>{generatedContracts.contracts.manufacturing_subcontract.clauseCount} clauses</Badge>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full gap-2"
                            onClick={() => handleDownload(generatedContracts.contracts.manufacturing_subcontract)}
                            data-testid="button-download-manufacturing"
                          >
                            <Download className="h-4 w-4" />
                            Download
                          </Button>
                        </div>
                        <div className="p-4 rounded-lg border bg-card">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium">On-Site</span>
                            <Badge>{generatedContracts.contracts.onsite_subcontract.clauseCount} clauses</Badge>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full gap-2"
                            onClick={() => handleDownload(generatedContracts.contracts.onsite_subcontract)}
                            data-testid="button-download-onsite"
                          >
                            <Download className="h-4 w-4" />
                            Download
                          </Button>
                        </div>
                      </div>
                      <div className="pt-4">
                        <Button
                          className="w-full gap-2"
                          onClick={handleDownloadAll}
                          data-testid="button-download-all"
                        >
                          <Download className="h-5 w-5" />
                          Download All Contracts
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            <div className="flex justify-between gap-4 mt-6 flex-wrap">
              <Button
                type="button"
                variant="outline"
                onClick={handleBack}
                disabled={currentStep === 1}
                data-testid="button-back"
              >
                <ChevronLeft className="h-4 w-4 mr-2" />
                Back
              </Button>

              {currentStep < 6 && (
                <Button type="button" onClick={handleNext} data-testid="button-next">
                  Next
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              )}
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}

import { useState, useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
  Shield,
  FileText,
  Download,
  Eye,
  Loader2,
  Home,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY"
];

const contractSchema = z.object({
  projectName: z.string().min(1, "Project name is required"),
  serviceModel: z.enum(["CRC", "CMOS"], { required_error: "Service model is required" }),
  solarIncluded: z.boolean().default(false),
  batteryIncluded: z.boolean().default(false),
  bondingIncluded: z.boolean().default(false),

  clientName: z.string().min(1, "Client name is required"),
  clientAddress: z.string().min(1, "Client address is required"),
  clientEmail: z.string().email("Invalid email address"),
  clientPhone: z.string().optional(),

  spvName: z.string().min(1, "LLC name is required"),
  spvState: z.string().min(1, "LLC state is required"),
  spvAddress: z.string().min(1, "LLC address is required"),
  spvEin: z.string().optional(),

  contractorName: z.string().optional(),
  contractorLicense: z.string().optional(),
  contractorAddress: z.string().optional(),

  propertyAddress: z.string().min(1, "Property address is required"),
  propertyLegalDescription: z.string().optional(),
  propertyApn: z.string().optional(),
  lotSize: z.string().optional(),
  zoning: z.string().optional(),

  totalContractPrice: z.coerce.number().min(1, "Contract price is required"),
  depositPercentage: z.coerce.number().min(1).max(100).default(10),
  manufacturingPrice: z.coerce.number().optional(),
  onsitePrice: z.coerce.number().optional(),

  milestone1Description: z.string().default("Design Completion"),
  milestone1Percentage: z.coerce.number().min(0).max(100).default(15),
  milestone2Description: z.string().default("Green Light Approval"),
  milestone2Percentage: z.coerce.number().min(0).max(100).default(25),
  milestone3Description: z.string().default("Production Start"),
  milestone3Percentage: z.coerce.number().min(0).max(100).default(20),

  contractDate: z.string().min(1, "Contract date is required"),
  estimatedStartDate: z.string().min(1, "Start date is required"),
  estimatedCompletionDate: z.string().min(1, "Completion date is required"),

  homeModel: z.string().min(1, "Home model is required"),
  homeSquareFootage: z.coerce.number().min(1, "Square footage is required"),
  numBedrooms: z.coerce.number().min(1, "Number of bedrooms is required"),
  numBathrooms: z.coerce.number().min(1, "Number of bathrooms is required"),
  designPackage: z.string().min(1, "Design package is required"),

  structuralWarrantyYears: z.coerce.number().min(1).default(10),
  systemsWarrantyYears: z.coerce.number().min(1).default(2),
  workmanshipWarrantyYears: z.coerce.number().min(1).default(1),
  jurisdiction: z.string().min(1, "Jurisdiction is required"),
  buildingCodeYear: z.string().optional(),
});

type ContractFormValues = z.infer<typeof contractSchema>;

const STORAGE_KEY = "dvele-contract-builder-draft";

const steps = [
  { id: 1, name: "Project Basics", icon: Building2 },
  { id: 2, name: "Party Info", icon: Users },
  { id: 3, name: "Property", icon: MapPin },
  { id: 4, name: "Financial", icon: DollarSign },
  { id: 5, name: "Schedule", icon: Calendar },
  { id: 6, name: "Warranty", icon: Shield },
  { id: 7, name: "Review", icon: FileText },
];

interface ClausePreview {
  contractType: string;
  template: string;
  summary: {
    totalClauses: number;
    sections: number;
    subsections: number;
    conditionalIncluded: number;
  };
  conditionalClauses: Array<{
    code: string;
    name: string;
    conditions: Record<string, unknown>;
    category: string;
  }>;
}

interface GeneratedContract {
  filename: string;
  content: string;
  clauseCount: number;
}

interface GenerateResult {
  success: boolean;
  projectName: string;
  contracts: {
    one_agreement: GeneratedContract;
    manufacturing_subcontract: GeneratedContract;
    onsite_subcontract: GeneratedContract;
  };
  generatedAt: string;
}

export default function ContractBuilder() {
  const [currentStep, setCurrentStep] = useState(1);
  const [clausePreview, setClausePreview] = useState<ClausePreview | null>(null);
  const [generatedContracts, setGeneratedContracts] = useState<GenerateResult | null>(null);
  const [spvManuallyEdited, setSpvManuallyEdited] = useState(false);
  const { toast } = useToast();

  const defaultValues: ContractFormValues = {
    projectName: "",
    serviceModel: "CRC",
    solarIncluded: false,
    batteryIncluded: false,
    bondingIncluded: false,
    clientName: "",
    clientAddress: "",
    clientEmail: "",
    clientPhone: "",
    spvName: "",
    spvState: "DE",
    spvAddress: "1209 Orange Street, Wilmington, DE 19801",
    spvEin: "",
    contractorName: "",
    contractorLicense: "",
    contractorAddress: "",
    propertyAddress: "",
    propertyLegalDescription: "",
    propertyApn: "",
    lotSize: "",
    zoning: "",
    totalContractPrice: 0,
    depositPercentage: 10,
    manufacturingPrice: 0,
    onsitePrice: 0,
    milestone1Description: "Design Completion",
    milestone1Percentage: 15,
    milestone2Description: "Green Light Approval",
    milestone2Percentage: 25,
    milestone3Description: "Production Start",
    milestone3Percentage: 20,
    contractDate: new Date().toISOString().split("T")[0],
    estimatedStartDate: "",
    estimatedCompletionDate: "",
    homeModel: "",
    homeSquareFootage: 0,
    numBedrooms: 3,
    numBathrooms: 2,
    designPackage: "Standard",
    structuralWarrantyYears: 10,
    systemsWarrantyYears: 2,
    workmanshipWarrantyYears: 1,
    jurisdiction: "State of California",
    buildingCodeYear: "2022",
  };

  const form = useForm<ContractFormValues>({
    resolver: zodResolver(contractSchema),
    defaultValues,
    mode: "onChange",
  });

  const projectName = useWatch({ control: form.control, name: "projectName" });
  const serviceModel = useWatch({ control: form.control, name: "serviceModel" });
  const totalContractPrice = useWatch({ control: form.control, name: "totalContractPrice" });
  const depositPercentage = useWatch({ control: form.control, name: "depositPercentage" });
  const milestone1Percentage = useWatch({ control: form.control, name: "milestone1Percentage" });
  const milestone2Percentage = useWatch({ control: form.control, name: "milestone2Percentage" });
  const milestone3Percentage = useWatch({ control: form.control, name: "milestone3Percentage" });

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
      form.setValue("spvName", `Dvele Partners ${projectName} LLC`);
    }
  }, [projectName, spvManuallyEdited, form]);

  const depositAmount = (totalContractPrice * depositPercentage) / 100;
  const milestone1Amount = (totalContractPrice * milestone1Percentage) / 100;
  const milestone2Amount = (totalContractPrice * milestone2Percentage) / 100;
  const milestone3Amount = (totalContractPrice * milestone3Percentage) / 100;
  const finalPaymentPercentage = 100 - depositPercentage - milestone1Percentage - milestone2Percentage - milestone3Percentage;
  const finalPaymentAmount = (totalContractPrice * finalPaymentPercentage) / 100;

  const previewMutation = useMutation({
    mutationFn: async (data: ContractFormValues) => {
      const response = await apiRequest("POST", "/api/contracts/preview-clauses", {
        contractType: "ONE",
        projectData: {
          SERVICE_MODEL: data.serviceModel,
          SOLAR_INCLUDED: data.solarIncluded,
          BATTERY_INCLUDED: data.batteryIncluded,
        },
      });
      return response.json();
    },
    onSuccess: (data) => {
      setClausePreview(data);
      toast({
        title: "Preview Generated",
        description: `${data.summary.totalClauses} clauses will be included in your contract.`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to preview clauses. Please try again.",
        variant: "destructive",
      });
    },
  });

  const generateMutation = useMutation({
    mutationFn: async (data: ContractFormValues) => {
      const projectData = {
        PROJECT_NAME: data.projectName,
        SERVICE_MODEL: data.serviceModel,
        SOLAR_INCLUDED: data.solarIncluded,
        BATTERY_INCLUDED: data.batteryIncluded,
        CONTRACT_DATE: data.contractDate,
        CLIENT_NAME: data.clientName,
        CLIENT_ADDRESS: data.clientAddress,
        CLIENT_EMAIL: data.clientEmail,
        CLIENT_PHONE: data.clientPhone || "",
        SPV_NAME: data.spvName,
        SPV_STATE: data.spvState,
        SPV_ADDRESS: data.spvAddress,
        SPV_EIN: data.spvEin || "",
        CONTRACTOR_NAME: data.contractorName || "",
        CONTRACTOR_LICENSE: data.contractorLicense || "",
        CONTRACTOR_ADDRESS: data.contractorAddress || "",
        PROPERTY_ADDRESS: data.propertyAddress,
        PROPERTY_LEGAL_DESCRIPTION: data.propertyLegalDescription || "",
        PROPERTY_APN: data.propertyApn || "",
        LOT_SIZE: data.lotSize || "",
        ZONING: data.zoning || "",
        TOTAL_CONTRACT_PRICE: data.totalContractPrice,
        DEPOSIT_AMOUNT: depositAmount,
        DEPOSIT_PERCENTAGE: data.depositPercentage,
        MANUFACTURING_PRICE: data.manufacturingPrice || 0,
        ONSITE_PRICE: data.onsitePrice || 0,
        MILESTONE_1_DESCRIPTION: data.milestone1Description,
        MILESTONE_1_AMOUNT: milestone1Amount,
        MILESTONE_1_PERCENTAGE: data.milestone1Percentage,
        MILESTONE_2_DESCRIPTION: data.milestone2Description,
        MILESTONE_2_AMOUNT: milestone2Amount,
        MILESTONE_2_PERCENTAGE: data.milestone2Percentage,
        MILESTONE_3_DESCRIPTION: data.milestone3Description,
        MILESTONE_3_AMOUNT: milestone3Amount,
        MILESTONE_3_PERCENTAGE: data.milestone3Percentage,
        FINAL_PAYMENT_AMOUNT: finalPaymentAmount,
        ESTIMATED_START_DATE: data.estimatedStartDate,
        ESTIMATED_COMPLETION_DATE: data.estimatedCompletionDate,
        HOME_MODEL: data.homeModel,
        HOME_SQUARE_FOOTAGE: data.homeSquareFootage,
        NUM_BEDROOMS: data.numBedrooms,
        NUM_BATHROOMS: data.numBathrooms,
        DESIGN_PACKAGE: data.designPackage,
        STRUCTURAL_WARRANTY_YEARS: data.structuralWarrantyYears,
        SYSTEMS_WARRANTY_YEARS: data.systemsWarrantyYears,
        WARRANTY_START_DATE: data.estimatedCompletionDate,
        WARRANTY_EXCLUSIONS: "Normal wear and tear, owner modifications, acts of nature",
        CHANGE_ORDER_NOTICE_DAYS: 5,
        CHANGE_ORDER_MARKUP: 15,
        JURISDICTION: data.jurisdiction,
        INCLUDED_SERVICES: "Design, engineering, permitting, manufacturing, delivery, installation, and site finishing",
        EXCLUDED_SERVICES: "Landscaping, fencing, exterior lighting beyond code requirements",
      };

      const response = await apiRequest("POST", "/api/contracts/generate-package", { projectData });
      return response.json();
    },
    onSuccess: (data) => {
      setGeneratedContracts(data);
      localStorage.removeItem(STORAGE_KEY);
      toast({
        title: "Contracts Generated",
        description: "Your contract package has been generated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to generate contracts. Please try again.",
        variant: "destructive",
      });
    },
  });

  const getStepFields = (step: number): (keyof ContractFormValues)[] => {
    switch (step) {
      case 1:
        return ["projectName", "serviceModel"];
      case 2:
        return ["clientName", "clientAddress", "clientEmail", "spvName", "spvState", "spvAddress"];
      case 3:
        return ["propertyAddress"];
      case 4:
        return ["totalContractPrice", "depositPercentage"];
      case 5:
        return ["contractDate", "estimatedStartDate", "estimatedCompletionDate", "homeModel", "homeSquareFootage", "numBedrooms", "numBathrooms", "designPackage"];
      case 6:
        return ["structuralWarrantyYears", "systemsWarrantyYears", "jurisdiction"];
      default:
        return [];
    }
  };

  const validateStep = async (step: number): Promise<boolean> => {
    const fieldsToValidate = getStepFields(step);
    if (fieldsToValidate.length === 0) return true;
    return await form.trigger(fieldsToValidate);
  };

  const handleNext = async () => {
    const isValid = await validateStep(currentStep);
    if (isValid && currentStep < 7) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handlePreview = () => {
    const values = form.getValues();
    previewMutation.mutate(values);
  };

  const handleGenerate = () => {
    const values = form.getValues();
    generateMutation.mutate(values);
  };

  const handleDownload = (contract: GeneratedContract) => {
    const blob = new Blob([contract.content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = contract.filename.replace(".docx", ".txt");
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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
            Contract Builder
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Build a complete contract package with clause-based assembly
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleClearDraft} data-testid="button-clear-draft">
          Clear Draft
        </Button>
      </div>

      <div className="max-w-4xl">
        <nav aria-label="Progress" className="mb-8 overflow-x-auto">
          <ol className="flex items-center min-w-max">
            {steps.map((step, stepIdx) => (
              <li key={step.name} className={`relative ${stepIdx !== steps.length - 1 ? "flex-1 pr-4 md:pr-8" : ""}`}>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(step.id)}
                    className={`flex h-8 w-8 md:h-10 md:w-10 items-center justify-center rounded-full border-2 transition-colors ${
                      currentStep > step.id
                        ? "border-primary bg-primary text-primary-foreground"
                        : currentStep === step.id
                        ? "border-primary bg-background text-primary"
                        : "border-muted bg-background text-muted-foreground"
                    }`}
                    data-testid={`step-indicator-${step.id}`}
                  >
                    {currentStep > step.id ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <step.icon className="h-4 w-4" />
                    )}
                  </button>
                  <span
                    className={`text-xs md:text-sm font-medium hidden sm:block ${
                      currentStep >= step.id ? "text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {step.name}
                  </span>
                </div>
                {stepIdx !== steps.length - 1 && (
                  <div
                    className={`absolute top-4 md:top-5 left-10 md:left-14 -ml-px h-0.5 w-full transition-colors ${
                      currentStep > step.id ? "bg-primary" : "bg-muted"
                    }`}
                    aria-hidden="true"
                  />
                )}
              </li>
            ))}
          </ol>
        </nav>

        <Form {...form}>
          <form onKeyDown={(e) => { if (e.key === "Enter" && currentStep < 7) e.preventDefault(); }}>
            {currentStep === 1 && (
              <Card data-testid="card-step-1">
                <CardHeader>
                  <CardTitle className="text-lg">Project Basics</CardTitle>
                  <CardDescription>Enter project name and service configuration</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
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

                  <FormField
                    control={form.control}
                    name="serviceModel"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Service Model</FormLabel>
                        <FormControl>
                          <RadioGroup
                            onValueChange={field.onChange}
                            value={field.value}
                            className="flex gap-4"
                          >
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="CRC" id="crc" data-testid="radio-crc" />
                              <Label htmlFor="crc" className="font-normal cursor-pointer">
                                <span className="font-medium">CRC</span>
                                <span className="text-muted-foreground ml-1">- Complete Responsibility Construction</span>
                              </Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="CMOS" id="cmos" data-testid="radio-cmos" />
                              <Label htmlFor="cmos" className="font-normal cursor-pointer">
                                <span className="font-medium">CMOS</span>
                                <span className="text-muted-foreground ml-1">- Construction Management Owner Services</span>
                              </Label>
                            </div>
                          </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div>
                    <Label className="text-sm font-medium">Optional Features</Label>
                    <div className="mt-3 space-y-3">
                      <FormField
                        control={form.control}
                        name="solarIncluded"
                        render={({ field }) => (
                          <FormItem className="flex items-center space-x-3 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                data-testid="checkbox-solar"
                              />
                            </FormControl>
                            <FormLabel className="font-normal cursor-pointer">
                              Solar Photovoltaic System
                            </FormLabel>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="batteryIncluded"
                        render={({ field }) => (
                          <FormItem className="flex items-center space-x-3 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                data-testid="checkbox-battery"
                              />
                            </FormControl>
                            <FormLabel className="font-normal cursor-pointer">
                              Battery Storage System
                            </FormLabel>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="bondingIncluded"
                        render={({ field }) => (
                          <FormItem className="flex items-center space-x-3 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                data-testid="checkbox-bonding"
                              />
                            </FormControl>
                            <FormLabel className="font-normal cursor-pointer">
                              Performance Bonding
                            </FormLabel>
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {currentStep === 2 && (
              <Card data-testid="card-step-2">
                <CardHeader>
                  <CardTitle className="text-lg">Party Information</CardTitle>
                  <CardDescription>Enter client, LLC, and contractor details</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <h3 className="text-sm font-medium mb-3">Client (Owner)</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="clientName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Legal Name</FormLabel>
                            <FormControl>
                              <Input placeholder="John and Sarah Smith" data-testid="input-client-name" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="clientEmail"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email</FormLabel>
                            <FormControl>
                              <Input type="email" placeholder="client@email.com" data-testid="input-client-email" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                      <FormField
                        control={form.control}
                        name="clientAddress"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Mailing Address</FormLabel>
                            <FormControl>
                              <Input placeholder="123 Main St, City, State ZIP" data-testid="input-client-address" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="clientPhone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Phone (Optional)</FormLabel>
                            <FormControl>
                              <Input placeholder="(555) 123-4567" data-testid="input-client-phone" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <h3 className="text-sm font-medium mb-3">Child LLC (Builder Entity)</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="spvName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>LLC Legal Name</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="Dvele Partners [Project] LLC" 
                                data-testid="input-spv-name" 
                                {...field}
                                onChange={(e) => {
                                  setSpvManuallyEdited(true);
                                  field.onChange(e);
                                }}
                              />
                            </FormControl>
                            <FormDescription>Auto-generated from project name</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="spvState"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>State of Formation</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-spv-state">
                                  <SelectValue placeholder="Select state" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {US_STATES.map((state) => (
                                  <SelectItem key={state} value={state}>{state}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                      <FormField
                        control={form.control}
                        name="spvAddress"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Registered Address</FormLabel>
                            <FormControl>
                              <Input placeholder="1209 Orange St, Wilmington, DE" data-testid="input-spv-address" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="spvEin"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>EIN (Optional)</FormLabel>
                            <FormControl>
                              <Input placeholder="XX-XXXXXXX" data-testid="input-spv-ein" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  {serviceModel === "CMOS" && (
                    <>
                      <Separator />
                      <div>
                        <h3 className="text-sm font-medium mb-3">General Contractor (CMOS Only)</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="contractorName"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Contractor Name</FormLabel>
                                <FormControl>
                                  <Input placeholder="ABC Construction Inc." data-testid="input-contractor-name" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="contractorLicense"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>License Number</FormLabel>
                                <FormControl>
                                  <Input placeholder="CSLB #123456" data-testid="input-contractor-license" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        <FormField
                          control={form.control}
                          name="contractorAddress"
                          render={({ field }) => (
                            <FormItem className="mt-4">
                              <FormLabel>Contractor Address</FormLabel>
                              <FormControl>
                                <Input placeholder="456 Builder Ave, City, State ZIP" data-testid="input-contractor-address" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            )}

            {currentStep === 3 && (
              <Card data-testid="card-step-3">
                <CardHeader>
                  <CardTitle className="text-lg">Property Details</CardTitle>
                  <CardDescription>Enter the property location and legal information</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="propertyAddress"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Property Address</FormLabel>
                        <FormControl>
                          <Input placeholder="456 Oak Lane, San Jose, CA 95120" data-testid="input-property-address" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="propertyLegalDescription"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Legal Description (Optional)</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Lot 42, Block 3, Oak Valley Subdivision"
                            data-testid="input-legal-description"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="propertyApn"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>APN (Optional)</FormLabel>
                          <FormControl>
                            <Input placeholder="123-45-678" data-testid="input-apn" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="lotSize"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Lot Size (Optional)</FormLabel>
                          <FormControl>
                            <Input placeholder="0.35 acres" data-testid="input-lot-size" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="zoning"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Zoning (Optional)</FormLabel>
                          <FormControl>
                            <Input placeholder="R-1 Residential" data-testid="input-zoning" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            {currentStep === 4 && (
              <Card data-testid="card-step-4">
                <CardHeader>
                  <CardTitle className="text-lg">Financial Terms</CardTitle>
                  <CardDescription>Set contract pricing and payment milestones</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="totalContractPrice"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Total Contract Price ($)</FormLabel>
                          <FormControl>
                            <Input type="number" min="0" placeholder="850000" data-testid="input-total-price" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="manufacturingPrice"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Manufacturing Price ($)</FormLabel>
                          <FormControl>
                            <Input type="number" min="0" placeholder="450000" data-testid="input-manufacturing-price" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="onsitePrice"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>On-Site Price ($)</FormLabel>
                          <FormControl>
                            <Input type="number" min="0" placeholder="350000" data-testid="input-onsite-price" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <Separator />

                  <div>
                    <h3 className="text-sm font-medium mb-3">Payment Schedule</h3>
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                        <div>
                          <Label className="text-sm text-muted-foreground">Deposit</Label>
                          <p className="font-medium">Initial Deposit</p>
                        </div>
                        <FormField
                          control={form.control}
                          name="depositPercentage"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Percentage</FormLabel>
                              <FormControl>
                                <Input type="number" min="0" max="100" data-testid="input-deposit-pct" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <div className="p-2 bg-muted/50 rounded text-right">
                          <span className="font-medium">{formatCurrency(depositAmount)}</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                        <FormField
                          control={form.control}
                          name="milestone1Description"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Milestone 1</FormLabel>
                              <FormControl>
                                <Input placeholder="Design Completion" data-testid="input-m1-desc" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="milestone1Percentage"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Percentage</FormLabel>
                              <FormControl>
                                <Input type="number" min="0" max="100" data-testid="input-m1-pct" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <div className="p-2 bg-muted/50 rounded text-right">
                          <span className="font-medium">{formatCurrency(milestone1Amount)}</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                        <FormField
                          control={form.control}
                          name="milestone2Description"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Milestone 2</FormLabel>
                              <FormControl>
                                <Input placeholder="Green Light Approval" data-testid="input-m2-desc" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="milestone2Percentage"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Percentage</FormLabel>
                              <FormControl>
                                <Input type="number" min="0" max="100" data-testid="input-m2-pct" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <div className="p-2 bg-muted/50 rounded text-right">
                          <span className="font-medium">{formatCurrency(milestone2Amount)}</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                        <FormField
                          control={form.control}
                          name="milestone3Description"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Milestone 3</FormLabel>
                              <FormControl>
                                <Input placeholder="Production Start" data-testid="input-m3-desc" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="milestone3Percentage"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Percentage</FormLabel>
                              <FormControl>
                                <Input type="number" min="0" max="100" data-testid="input-m3-pct" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <div className="p-2 bg-muted/50 rounded text-right">
                          <span className="font-medium">{formatCurrency(milestone3Amount)}</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end border-t pt-4">
                        <div>
                          <Label className="text-sm text-muted-foreground">Final Payment</Label>
                          <p className="font-medium">Completion</p>
                        </div>
                        <div className="p-2 bg-muted/50 rounded text-center">
                          <span className="font-medium">{finalPaymentPercentage}%</span>
                        </div>
                        <div className="p-2 bg-muted/50 rounded text-right">
                          <span className="font-medium">{formatCurrency(finalPaymentAmount)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                      <span className="text-sm font-medium">Total Contract Value</span>
                      <span className="text-2xl font-bold" data-testid="text-total-value">
                        {formatCurrency(totalContractPrice)}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {currentStep === 5 && (
              <Card data-testid="card-step-5">
                <CardHeader>
                  <CardTitle className="text-lg">Schedule & Specifications</CardTitle>
                  <CardDescription>Set project timeline and home specifications</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <h3 className="text-sm font-medium mb-3">Project Timeline</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name="contractDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Contract Date</FormLabel>
                            <FormControl>
                              <Input type="date" data-testid="input-contract-date" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="estimatedStartDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Estimated Start</FormLabel>
                            <FormControl>
                              <Input type="date" data-testid="input-start-date" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="estimatedCompletionDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Estimated Completion</FormLabel>
                            <FormControl>
                              <Input type="date" data-testid="input-completion-date" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <h3 className="text-sm font-medium mb-3">Home Specifications</h3>
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
                                <SelectItem value="Ora 1200">Ora 1200</SelectItem>
                                <SelectItem value="Ora 1800">Ora 1800</SelectItem>
                                <SelectItem value="Ora 2400">Ora 2400</SelectItem>
                                <SelectItem value="Ora 3200">Ora 3200</SelectItem>
                                <SelectItem value="Custom">Custom Design</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="homeSquareFootage"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Square Footage</FormLabel>
                            <FormControl>
                              <Input type="number" min="0" placeholder="2400" data-testid="input-sqft" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                      <FormField
                        control={form.control}
                        name="numBedrooms"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Bedrooms</FormLabel>
                            <FormControl>
                              <Input type="number" min="1" max="10" data-testid="input-bedrooms" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="numBathrooms"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Bathrooms</FormLabel>
                            <FormControl>
                              <Input type="number" min="1" max="10" step="0.5" data-testid="input-bathrooms" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="designPackage"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Design Package</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-design-package">
                                  <SelectValue placeholder="Select package" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="Standard">Standard</SelectItem>
                                <SelectItem value="Premium">Premium</SelectItem>
                                <SelectItem value="Premium Modern">Premium Modern</SelectItem>
                                <SelectItem value="Luxury">Luxury</SelectItem>
                                <SelectItem value="Custom">Custom</SelectItem>
                              </SelectContent>
                            </Select>
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
              <Card data-testid="card-step-6">
                <CardHeader>
                  <CardTitle className="text-lg">Warranty & Compliance</CardTitle>
                  <CardDescription>Set warranty terms and legal jurisdiction</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <h3 className="text-sm font-medium mb-3">Warranty Periods (Years)</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name="structuralWarrantyYears"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Structural</FormLabel>
                            <FormControl>
                              <Input type="number" min="1" max="20" data-testid="input-structural-warranty" {...field} />
                            </FormControl>
                            <FormDescription>Foundation, framing, roof</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="systemsWarrantyYears"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Systems</FormLabel>
                            <FormControl>
                              <Input type="number" min="1" max="10" data-testid="input-systems-warranty" {...field} />
                            </FormControl>
                            <FormDescription>HVAC, plumbing, electrical</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="workmanshipWarrantyYears"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Workmanship</FormLabel>
                            <FormControl>
                              <Input type="number" min="1" max="5" data-testid="input-workmanship-warranty" {...field} />
                            </FormControl>
                            <FormDescription>Finishes, fixtures</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  <Separator />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="jurisdiction"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Governing Jurisdiction</FormLabel>
                          <FormControl>
                            <Input placeholder="State of California" data-testid="input-jurisdiction" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="buildingCodeYear"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Building Code Year (Optional)</FormLabel>
                          <FormControl>
                            <Input placeholder="2022" data-testid="input-code-year" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            {currentStep === 7 && (
              <div className="space-y-6" data-testid="card-step-7">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Review & Generate</CardTitle>
                    <CardDescription>Review your contract details before generating</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <h4 className="text-sm font-medium text-muted-foreground mb-2">Project</h4>
                        <p className="font-medium">{form.getValues("projectName")}</p>
                        <div className="flex gap-2 mt-1">
                          <Badge variant="outline">{form.getValues("serviceModel")}</Badge>
                          {form.getValues("solarIncluded") && <Badge variant="secondary">Solar</Badge>}
                          {form.getValues("batteryIncluded") && <Badge variant="secondary">Battery</Badge>}
                        </div>
                      </div>
                      <div>
                        <h4 className="text-sm font-medium text-muted-foreground mb-2">Client</h4>
                        <p className="font-medium">{form.getValues("clientName")}</p>
                        <p className="text-sm text-muted-foreground">{form.getValues("clientEmail")}</p>
                      </div>
                      <div>
                        <h4 className="text-sm font-medium text-muted-foreground mb-2">Property</h4>
                        <p className="font-medium">{form.getValues("propertyAddress")}</p>
                      </div>
                      <div>
                        <h4 className="text-sm font-medium text-muted-foreground mb-2">Contract Value</h4>
                        <p className="text-xl font-bold">{formatCurrency(totalContractPrice)}</p>
                      </div>
                      <div>
                        <h4 className="text-sm font-medium text-muted-foreground mb-2">Home</h4>
                        <p className="font-medium">{form.getValues("homeModel")}</p>
                        <p className="text-sm text-muted-foreground">
                          {form.getValues("homeSquareFootage")} sq ft | {form.getValues("numBedrooms")} bed | {form.getValues("numBathrooms")} bath
                        </p>
                      </div>
                      <div>
                        <h4 className="text-sm font-medium text-muted-foreground mb-2">Timeline</h4>
                        <p className="text-sm">
                          {form.getValues("estimatedStartDate")} to {form.getValues("estimatedCompletionDate")}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {clausePreview && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Eye className="h-4 w-4" />
                        Clause Preview
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                        <div className="text-center p-3 bg-muted/50 rounded-lg">
                          <p className="text-2xl font-bold">{clausePreview.summary.totalClauses}</p>
                          <p className="text-xs text-muted-foreground">Total Clauses</p>
                        </div>
                        <div className="text-center p-3 bg-muted/50 rounded-lg">
                          <p className="text-2xl font-bold">{clausePreview.summary.sections}</p>
                          <p className="text-xs text-muted-foreground">Sections</p>
                        </div>
                        <div className="text-center p-3 bg-muted/50 rounded-lg">
                          <p className="text-2xl font-bold">{clausePreview.summary.subsections}</p>
                          <p className="text-xs text-muted-foreground">Subsections</p>
                        </div>
                        <div className="text-center p-3 bg-muted/50 rounded-lg">
                          <p className="text-2xl font-bold">{clausePreview.summary.conditionalIncluded}</p>
                          <p className="text-xs text-muted-foreground">Conditional</p>
                        </div>
                      </div>
                      {clausePreview.conditionalClauses.length > 0 && (
                        <div>
                          <p className="text-sm font-medium mb-2">Conditional Clauses Included:</p>
                          <div className="flex flex-wrap gap-2">
                            {clausePreview.conditionalClauses.map((c) => (
                              <Badge key={c.code} variant="outline" className="text-xs">
                                {c.code}: {c.name}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {generatedContracts && (
                  <Card className="border-green-500/50 bg-green-500/5">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg flex items-center gap-2 text-green-700 dark:text-green-400">
                        <Check className="h-5 w-5" />
                        Contracts Generated
                      </CardTitle>
                      <CardDescription>
                        Generated at {new Date(generatedContracts.generatedAt).toLocaleString()}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-4 p-3 bg-background rounded-lg border flex-wrap">
                          <div className="flex items-center gap-3">
                            <Home className="h-5 w-5 text-muted-foreground" />
                            <div>
                              <p className="font-medium">ONE Agreement</p>
                              <p className="text-xs text-muted-foreground">
                                {generatedContracts.contracts.one_agreement.clauseCount} clauses
                              </p>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDownload(generatedContracts.contracts.one_agreement)}
                            data-testid="button-download-one"
                          >
                            <Download className="h-4 w-4 mr-2" />
                            Download
                          </Button>
                        </div>
                        <div className="flex items-center justify-between gap-4 p-3 bg-background rounded-lg border flex-wrap">
                          <div className="flex items-center gap-3">
                            <Building2 className="h-5 w-5 text-muted-foreground" />
                            <div>
                              <p className="font-medium">Manufacturing Subcontract</p>
                              <p className="text-xs text-muted-foreground">
                                {generatedContracts.contracts.manufacturing_subcontract.clauseCount} clauses
                              </p>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDownload(generatedContracts.contracts.manufacturing_subcontract)}
                            data-testid="button-download-manufacturing"
                          >
                            <Download className="h-4 w-4 mr-2" />
                            Download
                          </Button>
                        </div>
                        <div className="flex items-center justify-between gap-4 p-3 bg-background rounded-lg border flex-wrap">
                          <div className="flex items-center gap-3">
                            <MapPin className="h-5 w-5 text-muted-foreground" />
                            <div>
                              <p className="font-medium">OnSite Subcontract</p>
                              <p className="text-xs text-muted-foreground">
                                {generatedContracts.contracts.onsite_subcontract.clauseCount} clauses
                              </p>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDownload(generatedContracts.contracts.onsite_subcontract)}
                            data-testid="button-download-onsite"
                          >
                            <Download className="h-4 w-4 mr-2" />
                            Download
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <div className="flex gap-3 flex-wrap">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handlePreview}
                    disabled={previewMutation.isPending}
                    data-testid="button-preview"
                  >
                    {previewMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Eye className="h-4 w-4 mr-2" />
                    )}
                    Preview Clauses
                  </Button>
                  <Button
                    type="button"
                    onClick={handleGenerate}
                    disabled={generateMutation.isPending}
                    data-testid="button-generate"
                  >
                    {generateMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <FileText className="h-4 w-4 mr-2" />
                    )}
                    Generate Contracts
                  </Button>
                </div>
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

              {currentStep < 7 && (
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

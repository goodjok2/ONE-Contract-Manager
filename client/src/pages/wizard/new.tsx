import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Home,
  User,
  FileText,
  Bed,
  Bath,
  Ruler,
  DollarSign,
  X,
  Loader2,
  Wrench,
  Building,
} from "lucide-react";

const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY"
];

const step1Schema = z.object({
  clientFirstName: z.string().min(1, "First name is required"),
  clientLastName: z.string().min(1, "Last name is required"),
  projectName: z.string().min(1, "Project name is required"),
  lotAddress: z.string().min(1, "Lot address is required"),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  zip: z.string().min(1, "ZIP code is required"),
  onSiteType: z.enum(["CRC", "CMOS"]),
});

const step2Schema = z.object({
  selectedModelId: z.number().min(1, "Please select a home model"),
});

const step3Schema = z.object({
  step1Complete: z.boolean().refine((val) => val === true, "Step 1 must be complete"),
  step2Complete: z.boolean().refine((val) => val === true, "Step 2 must be complete"),
});

type Step1Data = z.infer<typeof step1Schema>;

interface HomeModel {
  id: number;
  name: string;
  model_code: string;
  description: string;
  sq_ft: number;
  bedrooms: number;
  bathrooms: number;
  stories: number;
  design_fee: number;
  offsite_base_price: number;
  onsite_est_price: number;
}

interface WizardState {
  step1: Step1Data | null;
  selectedModel: HomeModel | null;
}

const STEPS = [
  { id: 1, title: "Project & Client", icon: User },
  { id: 2, title: "Home Selection", icon: Home },
  { id: 3, title: "Review & Generate", icon: FileText },
];

function StepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {STEPS.map((step, index) => {
        const Icon = step.icon;
        const isActive = currentStep === step.id;
        const isCompleted = currentStep > step.id;

        return (
          <div key={step.id} className="flex items-center">
            <div
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                isActive
                  ? "bg-primary text-primary-foreground"
                  : isCompleted
                  ? "bg-primary/20 text-primary"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {isCompleted ? (
                <Check className="h-4 w-4" />
              ) : (
                <Icon className="h-4 w-4" />
              )}
              <span className="text-sm font-medium hidden sm:inline">{step.title}</span>
              <span className="text-sm font-medium sm:hidden">{step.id}</span>
            </div>
            {index < STEPS.length - 1 && (
              <div className={`w-8 h-0.5 mx-1 ${currentStep > step.id ? "bg-primary" : "bg-muted"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function Step1ProjectClient({
  onNext,
  initialData,
}: {
  onNext: (data: Step1Data) => void;
  initialData: Step1Data | null;
}) {
  const form = useForm<Step1Data>({
    resolver: zodResolver(step1Schema),
    defaultValues: initialData || {
      clientFirstName: "",
      clientLastName: "",
      projectName: "",
      lotAddress: "",
      city: "",
      state: "CA",
      zip: "",
      onSiteType: "CRC",
    },
  });

  const selectedServiceType = form.watch("onSiteType");

  const onSubmit = (data: Step1Data) => {
    onNext(data);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5" />
          Project & Client Information
        </CardTitle>
        <CardDescription>
          Enter the client details and project location to get started.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="clientFirstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Client First Name *</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="John" 
                        {...field} 
                        data-testid="input-client-first-name"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="clientLastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Client Last Name *</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Smith" 
                        {...field}
                        data-testid="input-client-last-name"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="projectName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Project Name *</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Smith Residence" 
                      {...field}
                      data-testid="input-project-name"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Separator />

            <div className="space-y-4">
              <h4 className="text-sm font-medium">Site Address</h4>
              <FormField
                control={form.control}
                name="lotAddress"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Lot Address *</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="123 Oak Street" 
                        {...field}
                        data-testid="input-lot-address"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid gap-4 md:grid-cols-3">
                <FormField
                  control={form.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>City *</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="San Diego" 
                          {...field}
                          data-testid="input-city"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="state"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>State *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-state">
                            <SelectValue placeholder="Select state" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {US_STATES.map((state) => (
                            <SelectItem key={state} value={state}>
                              {state}
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
                  name="zip"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>ZIP Code *</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="92101" 
                          {...field}
                          data-testid="input-zip"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <Separator />

            <FormField
              control={form.control}
              name="onSiteType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>On-Site Services *</FormLabel>
                  <p className="text-sm text-muted-foreground mb-3">
                    Select how on-site construction will be managed for this project.
                  </p>
                  <div className="grid gap-4 md:grid-cols-2">
                    <Card
                      className={`cursor-pointer transition-all hover-elevate ${
                        field.value === "CRC" ? "ring-2 ring-primary bg-primary/5" : ""
                      }`}
                      onClick={() => field.onChange("CRC")}
                      data-testid="card-service-crc"
                    >
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Wrench className="h-5 w-5 text-muted-foreground" />
                            <CardTitle className="text-base">Option A</CardTitle>
                          </div>
                          {field.value === "CRC" && (
                            <Badge variant="default">
                              <Check className="h-3 w-3 mr-1" />
                              Selected
                            </Badge>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent>
                        <p className="font-medium text-sm">Client-Retained Contractor (CRC)</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Client hires their own general contractor for on-site work.
                          Dvele provides modular components only.
                        </p>
                      </CardContent>
                    </Card>

                    <Card
                      className={`cursor-pointer transition-all hover-elevate ${
                        field.value === "CMOS" ? "ring-2 ring-primary bg-primary/5" : ""
                      }`}
                      onClick={() => field.onChange("CMOS")}
                      data-testid="card-service-cmos"
                    >
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Building className="h-5 w-5 text-muted-foreground" />
                            <CardTitle className="text-base">Option B</CardTitle>
                          </div>
                          <div className="flex items-center gap-2">
                            {field.value === "CMOS" && (
                              <Badge variant="default">
                                <Check className="h-3 w-3 mr-1" />
                                Selected
                              </Badge>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm">Company-Managed On-Site (CMOS)</p>
                          <Badge variant="secondary" className="text-xs">Full Service</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Dvele manages all on-site construction. 
                          Turnkey solution from design to completion.
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end">
              <Button type="submit" data-testid="button-next-step1">
                Next Step
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

function Step2HomeSelection({
  onNext,
  onBack,
  selectedModel,
  onSelectModel,
  validationError,
}: {
  onNext: () => void;
  onBack: () => void;
  selectedModel: HomeModel | null;
  onSelectModel: (model: HomeModel | null) => void;
  validationError: string | null;
}) {
  const { data: homeModels, isLoading } = useQuery<HomeModel[]>({
    queryKey: ["/api/home-models"],
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(value || 0);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Home className="h-5 w-5" />
          Home Selection
        </CardTitle>
        <CardDescription>
          Select a home model from the available options.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            Loading home models...
          </div>
        ) : !homeModels || homeModels.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No home models available. Please add models in the Admin section.
          </div>
        ) : (
          <>
            {validationError && (
              <div className="text-sm text-destructive mb-4">{validationError}</div>
            )}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {homeModels.map((model) => {
              const isSelected = selectedModel?.id === model.id;
              return (
                <Card
                  key={model.id}
                  className={`cursor-pointer transition-all hover-elevate ${
                    isSelected ? "ring-2 ring-primary bg-primary/5" : ""
                  }`}
                  onClick={() => onSelectModel(isSelected ? null : model)}
                  data-testid={`card-model-${model.id}`}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-base">{model.name}</CardTitle>
                        <CardDescription className="text-xs">
                          {model.model_code}
                        </CardDescription>
                      </div>
                      {isSelected && (
                        <Badge variant="default" className="ml-2">
                          <Check className="h-3 w-3 mr-1" />
                          Selected
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="pb-4">
                    <div className="grid grid-cols-3 gap-2 text-sm mb-3">
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Bed className="h-3 w-3" />
                        <span>{model.bedrooms} bed</span>
                      </div>
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Bath className="h-3 w-3" />
                        <span>{model.bathrooms} bath</span>
                      </div>
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Ruler className="h-3 w-3" />
                        <span>{model.sq_ft?.toLocaleString()} sqft</span>
                      </div>
                    </div>
                    <Separator className="my-2" />
                    <div className="flex items-center gap-1 text-primary font-semibold">
                      <DollarSign className="h-4 w-4" />
                      <span>{formatCurrency(model.offsite_base_price)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Base Price</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          </>
        )}

        <div className="flex justify-between pt-4">
          <Button variant="outline" onClick={onBack} data-testid="button-back-step2">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <Button
            onClick={onNext}
            disabled={!selectedModel}
            data-testid="button-next-step2"
          >
            Next Step
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Step3ReviewGenerate({
  onBack,
  onCreate,
  isCreating,
  wizardState,
}: {
  onBack: () => void;
  onCreate: () => void;
  isCreating: boolean;
  wizardState: WizardState;
}) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(value || 0);
  };

  const clientName = `${wizardState.step1?.clientFirstName} ${wizardState.step1?.clientLastName}`;
  const isCMOS = wizardState.step1?.onSiteType === "CMOS";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Review & Generate Contract
        </CardTitle>
        <CardDescription>
          Review all details before generating the contract.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="bg-muted/50 rounded-lg p-6 text-center">
          <h3 className="text-xl font-semibold mb-2">
            {wizardState.step1?.projectName}
          </h3>
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <span>{wizardState.selectedModel?.name}</span>
            <span>-</span>
            <span>{wizardState.selectedModel?.bedrooms}BR</span>
            <span>-</span>
            <Badge variant={isCMOS ? "default" : "secondary"}>
              {wizardState.step1?.onSiteType}
              {isCMOS && <span className="ml-1">(Full Service)</span>}
            </Badge>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card className="bg-muted/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <User className="h-4 w-4" />
                Client & Project
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Client:</span>
                <span className="font-medium">{clientName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Project:</span>
                <span className="font-medium">{wizardState.step1?.projectName}</span>
              </div>
              <Separator className="my-2" />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Site Address:</span>
                <span className="font-medium text-right">
                  {wizardState.step1?.lotAddress}<br />
                  {wizardState.step1?.city}, {wizardState.step1?.state} {wizardState.step1?.zip}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Service Model:</span>
                <Badge variant={isCMOS ? "default" : "secondary"}>
                  {wizardState.step1?.onSiteType}
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-muted/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Home className="h-4 w-4" />
                Home Model
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Model:</span>
                <span className="font-medium">{wizardState.selectedModel?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Code:</span>
                <span className="font-medium">{wizardState.selectedModel?.model_code}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Specs:</span>
                <span className="font-medium">
                  {wizardState.selectedModel?.bedrooms} bed / {wizardState.selectedModel?.bathrooms} bath
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Size:</span>
                <span className="font-medium">
                  {wizardState.selectedModel?.sq_ft?.toLocaleString()} sqft
                </span>
              </div>
              <Separator className="my-2" />
              <div className="flex justify-between text-primary">
                <span>Base Price:</span>
                <span className="font-bold">
                  {formatCurrency(wizardState.selectedModel?.offsite_base_price || 0)}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        <Separator />

        <div className="flex justify-between pt-4">
          <Button variant="outline" onClick={onBack} disabled={isCreating} data-testid="button-back-step3">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <Button
            onClick={onCreate}
            disabled={isCreating}
            className="min-w-[180px]"
            data-testid="button-generate-contract"
          >
            {isCreating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Check className="mr-2 h-4 w-4" />
                Generate Contract
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function NewContractWizard() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(1);
  const [step2Error, setStep2Error] = useState<string | null>(null);
  const [wizardState, setWizardState] = useState<WizardState>({
    step1: null,
    selectedModel: null,
  });

  const createContractMutation = useMutation({
    mutationFn: async () => {
      const { step1, selectedModel } = wizardState;
      if (!step1 || !selectedModel) {
        throw new Error("Missing required data");
      }

      const nextNumberRes = await fetch("/api/projects/next-number");
      if (!nextNumberRes.ok) {
        throw new Error("Failed to get next project number");
      }
      const { nextProjectNumber } = await nextNumberRes.json();

      const clientName = `${step1.clientFirstName} ${step1.clientLastName}`;

      const projectRes = await apiRequest("POST", "/api/projects", {
        projectNumber: nextProjectNumber,
        name: step1.projectName,
        status: "Draft",
        state: step1.state,
        onSiteSelection: step1.onSiteType,
      });

      const project = await projectRes.json();

      await apiRequest("POST", `/api/projects/${project.id}/client`, {
        legalName: clientName,
        entityType: "Individual",
        address: step1.lotAddress,
        city: step1.city,
        state: step1.state,
        zip: step1.zip,
      });

      await apiRequest("POST", `/api/projects/${project.id}/details`, {
        deliveryAddress: step1.lotAddress,
        deliveryCity: step1.city,
        deliveryState: step1.state,
        deliveryZip: step1.zip,
        homeModel: selectedModel.name,
        homeSqFt: selectedModel.sq_ft,
        homeBedrooms: selectedModel.bedrooms,
        homeBathrooms: selectedModel.bathrooms,
      });

      await apiRequest("POST", "/api/project-units", {
        projectId: project.id,
        modelId: selectedModel.id,
        unitLabel: selectedModel.name,
        basePriceSnapshot: selectedModel.offsite_base_price,
      });

      // Fetch template ID for contract type ONE
      const templateRes = await fetch("/api/contract-templates?contractType=ONE");
      if (!templateRes.ok) {
        throw new Error("Failed to fetch template");
      }
      const templates = await templateRes.json();
      const template = templates.find((t: any) => t.contractType === "ONE" || t.contract_type === "ONE");
      if (!template) {
        throw new Error("No template found for contract type ONE. Please import a template first.");
      }

      const contractRes = await apiRequest("POST", "/api/contracts", {
        projectId: project.id,
        contractType: "ONE",
        templateId: template.id,
        status: "draft",
      });

      const contract = await contractRes.json();
      return { project, contract };
    },
    onSuccess: ({ contract }) => {
      toast({
        title: "Contract Generated",
        description: "Your new project and contract have been created successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
      navigate(`/contracts/${contract.id}/edit`);
    },
    onError: (error: any) => {
      console.error("Error creating contract:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to create contract. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleStep1Next = (data: Step1Data) => {
    setWizardState((prev) => ({ ...prev, step1: data }));
    setCurrentStep(2);
  };

  const handleStep2Next = () => {
    const result = step2Schema.safeParse({
      selectedModelId: wizardState.selectedModel?.id || 0,
    });
    if (!result.success) {
      setStep2Error(result.error.errors[0]?.message || "Please select a home model");
      return;
    }
    setStep2Error(null);
    setCurrentStep(3);
  };

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(1, prev - 1));
  };

  const handleCreate = () => {
    createContractMutation.mutate();
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
        <div className="flex h-14 items-center px-4 gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/")}
            data-testid="button-close-wizard"
          >
            <X className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-semibold">New Contract Wizard</h1>
            <p className="text-sm text-muted-foreground">Step {currentStep} of 3</p>
          </div>
        </div>
      </header>

      <main className="container max-w-4xl mx-auto py-8 px-4">
        <StepIndicator currentStep={currentStep} />

        {currentStep === 1 && (
          <Step1ProjectClient
            onNext={handleStep1Next}
            initialData={wizardState.step1}
          />
        )}

        {currentStep === 2 && (
          <Step2HomeSelection
            onNext={handleStep2Next}
            onBack={handleBack}
            selectedModel={wizardState.selectedModel}
            onSelectModel={(model) => {
              setStep2Error(null);
              setWizardState((prev) => ({ ...prev, selectedModel: model }));
            }}
            validationError={step2Error}
          />
        )}

        {currentStep === 3 && (
          <Step3ReviewGenerate
            onBack={handleBack}
            onCreate={handleCreate}
            isCreating={createContractMutation.isPending}
            wizardState={wizardState}
          />
        )}
      </main>
    </div>
  );
}

import { useState, useEffect } from "react";
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
  Building2,
  FileText,
  Bed,
  Bath,
  Ruler,
  DollarSign,
  X,
} from "lucide-react";

const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY"
];

const step1Schema = z.object({
  clientName: z.string().min(1, "Client name is required"),
  projectName: z.string().min(1, "Project name is required"),
  lotAddress: z.string().min(1, "Lot address is required"),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  zip: z.string().min(1, "ZIP code is required"),
  onSiteSelection: z.enum(["CRC", "CMOS"]),
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

interface LLC {
  id: number;
  name: string;
  status: string;
  stateOfFormation: string;
  ein: string;
}

interface WizardState {
  step1: Step1Data | null;
  selectedModel: HomeModel | null;
  unitLabel: string;
  selectedLlc: LLC | null;
}

const STEPS = [
  { id: 1, title: "Client & Project", icon: User },
  { id: 2, title: "Home Configuration", icon: Home },
  { id: 3, title: "Legal Entity", icon: Building2 },
  { id: 4, title: "Review & Create", icon: FileText },
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

function Step1ClientProject({
  onNext,
  initialData,
}: {
  onNext: (data: Step1Data) => void;
  initialData: Step1Data | null;
}) {
  const form = useForm<Step1Data>({
    resolver: zodResolver(step1Schema),
    defaultValues: initialData || {
      clientName: "",
      projectName: "",
      lotAddress: "",
      city: "",
      state: "CA",
      zip: "",
      onSiteSelection: "CRC",
    },
  });

  const onSubmit = (data: Step1Data) => {
    onNext(data);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5" />
          Client & Project Information
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
                name="clientName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Client Name *</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="John & Jane Smith" 
                        {...field} 
                        data-testid="input-client-name"
                      />
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
            </div>

            <Separator />

            <div className="space-y-4">
              <h4 className="text-sm font-medium">Project Location</h4>
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
              name="onSiteSelection"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>On-Site Service Model *</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-service-model">
                        <SelectValue placeholder="Select service model" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="CRC">CRC - Client Responsible for Construction</SelectItem>
                      <SelectItem value="CMOS">CMOS - Company Managed On-Site Services</SelectItem>
                    </SelectContent>
                  </Select>
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

function Step2HomeConfiguration({
  onNext,
  onBack,
  selectedModel,
  unitLabel,
  onSelectModel,
  onUnitLabelChange,
}: {
  onNext: () => void;
  onBack: () => void;
  selectedModel: HomeModel | null;
  unitLabel: string;
  onSelectModel: (model: HomeModel | null) => void;
  onUnitLabelChange: (label: string) => void;
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
          Home Configuration
        </CardTitle>
        <CardDescription>
          Select a home model from the available options.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">
            Loading home models...
          </div>
        ) : !homeModels || homeModels.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No home models available. Please add models in the Admin section.
          </div>
        ) : (
          <>
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

            {selectedModel && (
              <div className="border rounded-lg p-4 bg-muted/30">
                <Label htmlFor="unitLabel">Unit Label (Optional)</Label>
                <Input
                  id="unitLabel"
                  placeholder="e.g., Unit A, Primary Residence"
                  value={unitLabel}
                  onChange={(e) => onUnitLabelChange(e.target.value)}
                  className="mt-2 max-w-sm"
                  data-testid="input-unit-label"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Add a label to identify this unit within the project.
                </p>
              </div>
            )}
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

function Step3LegalEntity({
  onNext,
  onBack,
  selectedLlc,
  onSelectLlc,
}: {
  onNext: () => void;
  onBack: () => void;
  selectedLlc: LLC | null;
  onSelectLlc: (llc: LLC | null) => void;
}) {
  const { data: llcs, isLoading } = useQuery<LLC[]>({
    queryKey: ["/api/llcs"],
  });

  const activeLlcs = llcs?.filter((llc) => llc.status === "active") || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          Legal Entity Selection
        </CardTitle>
        <CardDescription>
          Select the Dvele entity (LLC) that will be the seller for this contract.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">
            Loading LLCs...
          </div>
        ) : activeLlcs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No active LLCs available. Please create an LLC in the Admin section.
          </div>
        ) : (
          <div className="space-y-4">
            <Label>Seller Entity *</Label>
            <Select
              value={selectedLlc?.id.toString() || ""}
              onValueChange={(value) => {
                const llc = activeLlcs.find((l) => l.id.toString() === value);
                onSelectLlc(llc || null);
              }}
            >
              <SelectTrigger className="w-full" data-testid="select-llc">
                <SelectValue placeholder="Select an LLC..." />
              </SelectTrigger>
              <SelectContent>
                {activeLlcs.map((llc) => (
                  <SelectItem key={llc.id} value={llc.id.toString()}>
                    {llc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {selectedLlc && (
              <Card className="bg-muted/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Selected Entity Details</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Name:</span>
                      <span className="font-medium">{selectedLlc.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">State of Formation:</span>
                      <span className="font-medium">{selectedLlc.stateOfFormation || "Delaware"}</span>
                    </div>
                    {selectedLlc.ein && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">EIN:</span>
                        <span className="font-medium">{selectedLlc.ein}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        <div className="flex justify-between pt-4">
          <Button variant="outline" onClick={onBack} data-testid="button-back-step3">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <Button
            onClick={onNext}
            disabled={!selectedLlc}
            data-testid="button-next-step3"
          >
            Next Step
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Step4Review({
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Review & Create Contract
        </CardTitle>
        <CardDescription>
          Review all details before creating the project and contract.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
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
                <span className="font-medium">{wizardState.step1?.clientName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Project:</span>
                <span className="font-medium">{wizardState.step1?.projectName}</span>
              </div>
              <Separator className="my-2" />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Address:</span>
                <span className="font-medium text-right">
                  {wizardState.step1?.lotAddress}<br />
                  {wizardState.step1?.city}, {wizardState.step1?.state} {wizardState.step1?.zip}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Service Model:</span>
                <Badge variant="secondary">{wizardState.step1?.onSiteSelection}</Badge>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-muted/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Home className="h-4 w-4" />
                Home Configuration
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
                <span className="text-muted-foreground">Size:</span>
                <span className="font-medium">
                  {wizardState.selectedModel?.bedrooms} bed / {wizardState.selectedModel?.bathrooms} bath
                </span>
              </div>
              {wizardState.unitLabel && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Unit Label:</span>
                  <span className="font-medium">{wizardState.unitLabel}</span>
                </div>
              )}
              <Separator className="my-2" />
              <div className="flex justify-between text-primary">
                <span>Base Price:</span>
                <span className="font-bold">
                  {formatCurrency(wizardState.selectedModel?.offsite_base_price || 0)}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-muted/30 md:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Legal Entity
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Seller Entity:</span>
                <span className="font-medium">{wizardState.selectedLlc?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">State of Formation:</span>
                <span className="font-medium">{wizardState.selectedLlc?.stateOfFormation || "Delaware"}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <Separator />

        <div className="flex justify-between pt-4">
          <Button variant="outline" onClick={onBack} disabled={isCreating} data-testid="button-back-step4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <Button
            onClick={onCreate}
            disabled={isCreating}
            className="min-w-[180px]"
            data-testid="button-create-contract"
          >
            {isCreating ? (
              "Creating..."
            ) : (
              <>
                <Check className="mr-2 h-4 w-4" />
                Create Contract
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
  const [wizardState, setWizardState] = useState<WizardState>({
    step1: null,
    selectedModel: null,
    unitLabel: "",
    selectedLlc: null,
  });

  const createContractMutation = useMutation({
    mutationFn: async () => {
      const { step1, selectedModel, unitLabel, selectedLlc } = wizardState;
      if (!step1 || !selectedModel || !selectedLlc) {
        throw new Error("Missing required data");
      }

      const nextNumberRes = await fetch("/api/projects/next-number");
      if (!nextNumberRes.ok) {
        throw new Error("Failed to get next project number");
      }
      const { nextProjectNumber } = await nextNumberRes.json();

      const projectRes = await apiRequest("POST", "/api/projects", {
        projectNumber: nextProjectNumber,
        name: step1.projectName,
        status: "Draft",
        state: step1.state,
        onSiteSelection: step1.onSiteSelection,
      });

      const project = await projectRes.json();

      await apiRequest("POST", `/api/projects/${project.id}/client`, {
        legalName: step1.clientName,
        entityType: "Individual",
        address: step1.lotAddress,
        city: step1.city,
        state: step1.state,
        zip: step1.zip,
      });

      await apiRequest("POST", `/api/projects/${project.id}/details`, {
        siteAddress: step1.lotAddress,
        siteCity: step1.city,
        siteState: step1.state,
        siteZip: step1.zip,
      });

      await apiRequest("POST", "/api/project-units", {
        projectId: project.id,
        modelId: selectedModel.id,
        unitLabel: unitLabel || selectedModel.name,
        basePriceSnapshot: selectedModel.offsite_base_price,
      });

      const contractRes = await apiRequest("POST", "/api/contracts", {
        projectId: project.id,
        llcId: selectedLlc.id,
        contractType: "ONE",
        status: "draft",
      });

      const contract = await contractRes.json();
      return { project, contract };
    },
    onSuccess: ({ contract }) => {
      toast({
        title: "Contract Created",
        description: "Your new project and contract have been created successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
      navigate(`/contracts/${contract.id}`);
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
    setCurrentStep(3);
  };

  const handleStep3Next = () => {
    setCurrentStep(4);
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
            <p className="text-sm text-muted-foreground">Step {currentStep} of 4</p>
          </div>
        </div>
      </header>

      <main className="container max-w-4xl mx-auto py-8 px-4">
        <StepIndicator currentStep={currentStep} />

        {currentStep === 1 && (
          <Step1ClientProject
            onNext={handleStep1Next}
            initialData={wizardState.step1}
          />
        )}

        {currentStep === 2 && (
          <Step2HomeConfiguration
            onNext={handleStep2Next}
            onBack={handleBack}
            selectedModel={wizardState.selectedModel}
            unitLabel={wizardState.unitLabel}
            onSelectModel={(model) =>
              setWizardState((prev) => ({ ...prev, selectedModel: model }))
            }
            onUnitLabelChange={(label) =>
              setWizardState((prev) => ({ ...prev, unitLabel: label }))
            }
          />
        )}

        {currentStep === 3 && (
          <Step3LegalEntity
            onNext={handleStep3Next}
            onBack={handleBack}
            selectedLlc={wizardState.selectedLlc}
            onSelectLlc={(llc) =>
              setWizardState((prev) => ({ ...prev, selectedLlc: llc }))
            }
          />
        )}

        {currentStep === 4 && (
          <Step4Review
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

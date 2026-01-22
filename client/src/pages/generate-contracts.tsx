import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { 
  Check, 
  ChevronLeft, 
  ChevronRight, 
  FileText, 
  Users, 
  MapPin, 
  DollarSign, 
  Calendar,
  Eye,
  Download,
  Building2,
  Plus,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Info
} from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const US_STATES = [
  { value: "AL", label: "Alabama" }, { value: "AK", label: "Alaska" }, { value: "AZ", label: "Arizona" },
  { value: "AR", label: "Arkansas" }, { value: "CA", label: "California" }, { value: "CO", label: "Colorado" },
  { value: "CT", label: "Connecticut" }, { value: "DE", label: "Delaware" }, { value: "FL", label: "Florida" },
  { value: "GA", label: "Georgia" }, { value: "HI", label: "Hawaii" }, { value: "ID", label: "Idaho" },
  { value: "IL", label: "Illinois" }, { value: "IN", label: "Indiana" }, { value: "IA", label: "Iowa" },
  { value: "KS", label: "Kansas" }, { value: "KY", label: "Kentucky" }, { value: "LA", label: "Louisiana" },
  { value: "ME", label: "Maine" }, { value: "MD", label: "Maryland" }, { value: "MA", label: "Massachusetts" },
  { value: "MI", label: "Michigan" }, { value: "MN", label: "Minnesota" }, { value: "MS", label: "Mississippi" },
  { value: "MO", label: "Missouri" }, { value: "MT", label: "Montana" }, { value: "NE", label: "Nebraska" },
  { value: "NV", label: "Nevada" }, { value: "NH", label: "New Hampshire" }, { value: "NJ", label: "New Jersey" },
  { value: "NM", label: "New Mexico" }, { value: "NY", label: "New York" }, { value: "NC", label: "North Carolina" },
  { value: "ND", label: "North Dakota" }, { value: "OH", label: "Ohio" }, { value: "OK", label: "Oklahoma" },
  { value: "OR", label: "Oregon" }, { value: "PA", label: "Pennsylvania" }, { value: "RI", label: "Rhode Island" },
  { value: "SC", label: "South Carolina" }, { value: "SD", label: "South Dakota" }, { value: "TN", label: "Tennessee" },
  { value: "TX", label: "Texas" }, { value: "UT", label: "Utah" }, { value: "VT", label: "Vermont" },
  { value: "VA", label: "Virginia" }, { value: "WA", label: "Washington" }, { value: "WV", label: "West Virginia" },
  { value: "WI", label: "Wisconsin" }, { value: "WY", label: "Wyoming" }
];

const ENTITY_TYPES = [
  { value: "individual", label: "Individual" },
  { value: "llc", label: "Limited Liability Company (LLC)" },
  { value: "corporation", label: "Corporation" },
  { value: "partnership", label: "Partnership" },
  { value: "trust", label: "Trust" },
  { value: "other", label: "Other" }
];

const HOME_MODELS = [
  { value: "dvele-one", label: "Dvele ONE", sqft: 1200, beds: 2, baths: 2 },
  { value: "dvele-two", label: "Dvele TWO", sqft: 1800, beds: 3, baths: 2 },
  { value: "dvele-three", label: "Dvele THREE", sqft: 2400, beds: 4, baths: 3 },
  { value: "dvele-adu", label: "Dvele ADU", sqft: 600, beds: 1, baths: 1 },
  { value: "custom", label: "Custom Design", sqft: 0, beds: 0, baths: 0 }
];

const WIZARD_STEPS = [
  { id: 1, title: "Project Setup", icon: FileText, description: "Basic project information" },
  { id: 2, title: "Service Model & Parties", icon: Users, description: "Client and LLC details" },
  { id: 3, title: "Site & Property", icon: MapPin, description: "Location and unit specifications" },
  { id: 4, title: "Financial Terms", icon: DollarSign, description: "Pricing and payment milestones" },
  { id: 5, title: "Schedule & Warranty", icon: Calendar, description: "Timeline and warranties" },
  { id: 6, title: "Review", icon: Eye, description: "Review all information" },
  { id: 7, title: "Generate", icon: Download, description: "Generate contract package" }
];

const step1Schema = z.object({
  projectNumber: z.string().min(1, "Project number is required"),
  projectName: z.string().min(1, "Project name is required"),
  totalUnits: z.number().min(1, "At least 1 unit required").max(50, "Maximum 50 units"),
  agreementExecutionDate: z.string().min(1, "Execution date is required")
});

const step2Schema = z.object({
  serviceModel: z.enum(["CRC", "CMOS"], { required_error: "Please select a service model" }),
  clientLegalName: z.string().min(1, "Client legal name is required"),
  clientState: z.string().min(1, "Client state is required"),
  clientEntityType: z.string().min(1, "Entity type is required"),
  clientFullName: z.string().min(1, "Full name is required"),
  clientTitle: z.string().optional(),
  llcMode: z.enum(["create", "existing"]),
  existingLlcId: z.number().optional(),
  newLlcName: z.string().optional(),
  formationState: z.string().optional(),
  contractorName: z.string().optional(),
  contractorLicense: z.string().optional(),
  contractorAddress: z.string().optional(),
  contractorInsurance: z.string().optional()
});

const unitSchema = z.object({
  id: z.number(),
  homeModel: z.string().min(1, "Home model is required"),
  squareFootage: z.number().min(100, "Square footage required"),
  bedrooms: z.number().min(0),
  bathrooms: z.number().min(0),
  unitPrice: z.number().min(0)
});

const step3Schema = z.object({
  deliveryAddress: z.string().min(1, "Delivery address is required"),
  deliveryCity: z.string().min(1, "City is required"),
  deliveryState: z.string().min(1, "State is required"),
  deliveryZip: z.string().min(5, "Valid ZIP code required"),
  units: z.array(unitSchema).min(1, "At least one unit is required")
});

type Step1Data = z.infer<typeof step1Schema>;
type Step2Data = z.infer<typeof step2Schema>;
type Step3Data = z.infer<typeof step3Schema>;
type UnitData = z.infer<typeof unitSchema>;

interface WizardData {
  step1: Step1Data | null;
  step2: Step2Data | null;
  step3: Step3Data | null;
}

export default function GenerateContracts() {
  const [currentStep, setCurrentStep] = useState(1);
  const [wizardData, setWizardData] = useState<WizardData>({
    step1: null,
    step2: null,
    step3: null
  });
  const { toast } = useToast();

  const { data: existingLlcs = [] } = useQuery<any[]>({
    queryKey: ["/api/llcs"]
  });

  const generateProjectNumber = () => {
    const year = new Date().getFullYear();
    const randomNum = Math.floor(Math.random() * 900) + 100;
    return `${year}-${randomNum}`;
  };

  const handleStepComplete = (step: number, data: any) => {
    setWizardData(prev => ({
      ...prev,
      [`step${step}`]: data
    }));
    if (step < 7) {
      setCurrentStep(step + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const getStepStatus = (stepId: number) => {
    if (stepId < currentStep) return "completed";
    if (stepId === currentStep) return "current";
    return "upcoming";
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Contract Generation Wizard</h1>
          <p className="text-muted-foreground mt-2">
            Create a complete contract package for your project
          </p>
        </div>

        <div className="mb-8">
          <div className="flex items-center justify-between">
            {WIZARD_STEPS.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <button
                  onClick={() => step.id < currentStep && setCurrentStep(step.id)}
                  disabled={step.id > currentStep}
                  className={`flex flex-col items-center ${step.id < currentStep ? "cursor-pointer" : step.id === currentStep ? "cursor-default" : "cursor-not-allowed opacity-50"}`}
                  data-testid={`wizard-step-${step.id}`}
                >
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors ${
                      getStepStatus(step.id) === "completed"
                        ? "bg-primary border-primary text-primary-foreground"
                        : getStepStatus(step.id) === "current"
                        ? "border-primary text-primary bg-primary/10"
                        : "border-muted-foreground/30 text-muted-foreground"
                    }`}
                  >
                    {getStepStatus(step.id) === "completed" ? (
                      <Check className="h-5 w-5" />
                    ) : (
                      <step.icon className="h-5 w-5" />
                    )}
                  </div>
                  <span className={`text-xs mt-1 font-medium ${
                    getStepStatus(step.id) === "current" ? "text-primary" : "text-muted-foreground"
                  }`}>
                    {step.title}
                  </span>
                </button>
                {index < WIZARD_STEPS.length - 1 && (
                  <div className={`w-12 h-0.5 mx-2 ${
                    step.id < currentStep ? "bg-primary" : "bg-muted-foreground/30"
                  }`} />
                )}
              </div>
            ))}
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {(() => {
                const StepIcon = WIZARD_STEPS[currentStep - 1].icon;
                return <StepIcon className="h-5 w-5" />;
              })()}
              Step {currentStep}: {WIZARD_STEPS[currentStep - 1].title}
            </CardTitle>
            <CardDescription>
              {WIZARD_STEPS[currentStep - 1].description}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {currentStep === 1 && (
              <Step1ProjectSetup
                initialData={wizardData.step1}
                generateProjectNumber={generateProjectNumber}
                onComplete={(data) => handleStepComplete(1, data)}
              />
            )}
            {currentStep === 2 && (
              <Step2ServiceModelParties
                initialData={wizardData.step2}
                existingLlcs={existingLlcs}
                clientLastName={wizardData.step1?.projectName.split(" ").pop() || ""}
                onComplete={(data) => handleStepComplete(2, data)}
                onBack={handleBack}
              />
            )}
            {currentStep === 3 && (
              <Step3SiteProperty
                initialData={wizardData.step3}
                totalUnits={wizardData.step1?.totalUnits || 1}
                onComplete={(data) => handleStepComplete(3, data)}
                onBack={handleBack}
              />
            )}
            {currentStep >= 4 && (
              <div className="text-center py-12">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                  {(() => {
                    const CurrentIcon = WIZARD_STEPS[currentStep - 1].icon;
                    return <CurrentIcon className="h-8 w-8 text-muted-foreground" />;
                  })()}
                </div>
                <h3 className="text-lg font-medium mb-2">Steps 4-7 Coming Soon</h3>
                <p className="text-muted-foreground mb-4">
                  Financial terms, schedule, review, and generation will be implemented next.
                </p>
                <Button variant="outline" onClick={handleBack}>
                  <ChevronLeft className="h-4 w-4 mr-2" />
                  Back to Previous Step
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {wizardData.step1 && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Info className="h-4 w-4" />
                Saved Progress
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Project:</span>
                  <span className="ml-2 font-medium">{wizardData.step1.projectNumber} - {wizardData.step1.projectName}</span>
                </div>
                {wizardData.step2 && (
                  <div>
                    <span className="text-muted-foreground">Service Model:</span>
                    <Badge variant="outline" className="ml-2">{wizardData.step2.serviceModel}</Badge>
                  </div>
                )}
                {wizardData.step3 && (
                  <div>
                    <span className="text-muted-foreground">Units:</span>
                    <span className="ml-2 font-medium">{wizardData.step3.units.length} unit(s)</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function Step1ProjectSetup({
  initialData,
  generateProjectNumber,
  onComplete
}: {
  initialData: Step1Data | null;
  generateProjectNumber: () => string;
  onComplete: (data: Step1Data) => void;
}) {
  const form = useForm<Step1Data>({
    resolver: zodResolver(step1Schema),
    defaultValues: initialData || {
      projectNumber: generateProjectNumber(),
      projectName: "",
      totalUnits: 1,
      agreementExecutionDate: new Date().toISOString().split("T")[0]
    }
  });

  const onSubmit = (data: Step1Data) => {
    onComplete(data);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="projectNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Project Number *</FormLabel>
                <div className="flex gap-2">
                  <FormControl>
                    <Input {...field} placeholder="YYYY-###" data-testid="input-project-number" />
                  </FormControl>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => form.setValue("projectNumber", generateProjectNumber())}
                    data-testid="button-generate-number"
                  >
                    Generate
                  </Button>
                </div>
                <FormDescription>Auto-generated format: YYYY-###</FormDescription>
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
                  <Input {...field} placeholder="e.g., Smith Residence" data-testid="input-project-name" />
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
                <FormLabel>Total Units *</FormLabel>
                <Select
                  value={field.value.toString()}
                  onValueChange={(v) => field.onChange(parseInt(v))}
                >
                  <FormControl>
                    <SelectTrigger data-testid="select-total-units">
                      <SelectValue placeholder="Select number of units" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                      <SelectItem key={n} value={n.toString()}>
                        {n} {n === 1 ? "Unit" : "Units"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormDescription>Select number of homes/units in this project</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="agreementExecutionDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Agreement Execution Date *</FormLabel>
                <FormControl>
                  <Input type="date" {...field} data-testid="input-execution-date" />
                </FormControl>
                <FormDescription>Date the agreement will be signed</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex justify-end">
          <Button type="submit" data-testid="button-next-step1">
            Continue to Service Model & Parties
            <ChevronRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </form>
    </Form>
  );
}

function Step2ServiceModelParties({
  initialData,
  existingLlcs,
  clientLastName,
  onComplete,
  onBack
}: {
  initialData: Step2Data | null;
  existingLlcs: any[];
  clientLastName: string;
  onComplete: (data: Step2Data) => void;
  onBack: () => void;
}) {
  const [llcMode, setLlcMode] = useState<"create" | "existing">(
    initialData?.llcMode || "create"
  );
  const { toast } = useToast();

  const form = useForm<Step2Data>({
    resolver: zodResolver(step2Schema),
    defaultValues: initialData || {
      serviceModel: "CRC",
      clientLegalName: "",
      clientState: "",
      clientEntityType: "",
      clientFullName: "",
      clientTitle: "",
      llcMode: "create",
      existingLlcId: undefined,
      newLlcName: "",
      formationState: "DE",
      contractorName: "",
      contractorLicense: "",
      contractorAddress: "",
      contractorInsurance: ""
    }
  });

  const serviceModel = form.watch("serviceModel");
  const watchedClientLegalName = form.watch("clientLegalName");

  useEffect(() => {
    if (llcMode === "create" && watchedClientLegalName) {
      const lastName = watchedClientLegalName.split(" ").pop() || "";
      const generatedName = `Dvele Partners ${lastName} LLC`;
      form.setValue("newLlcName", generatedName);
    }
  }, [watchedClientLegalName, llcMode, form]);

  const onSubmit = (data: Step2Data) => {
    data.llcMode = llcMode;
    onComplete(data);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <div>
          <h3 className="text-lg font-medium mb-4">Service Model Selection</h3>
          <FormField
            control={form.control}
            name="serviceModel"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <RadioGroup
                    onValueChange={field.onChange}
                    value={field.value}
                    className="grid grid-cols-2 gap-4"
                  >
                    <Label
                      htmlFor="crc"
                      className={`flex flex-col items-start p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                        field.value === "CRC"
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="CRC" id="crc" data-testid="radio-crc" />
                        <span className="font-medium">CRC - Contractor Responsible</span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-2">
                        Client hires their own on-site contractor. Dvele provides manufacturing and delivery only.
                      </p>
                      <Badge variant="outline" className="mt-2">121 Clauses</Badge>
                    </Label>
                    <Label
                      htmlFor="cmos"
                      className={`flex flex-col items-start p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                        field.value === "CMOS"
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="CMOS" id="cmos" data-testid="radio-cmos" />
                        <span className="font-medium">CMOS - Full Service</span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-2">
                        Dvele manages the complete project including site work and installation.
                      </p>
                      <Badge variant="outline" className="mt-2">121 Clauses</Badge>
                    </Label>
                  </RadioGroup>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <Separator />

        <div>
          <h3 className="text-lg font-medium mb-4">Client Information</h3>
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="clientLegalName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Client Legal Name *</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="John Smith or Smith Holdings LLC" data-testid="input-client-legal-name" />
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
                  <FormLabel>Entity Type *</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger data-testid="select-entity-type">
                        <SelectValue placeholder="Select entity type" />
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
                  <FormLabel>Client State *</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger data-testid="select-client-state">
                        <SelectValue placeholder="Select state" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {US_STATES.map((state) => (
                        <SelectItem key={state.value} value={state.value}>
                          {state.label}
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
              name="clientFullName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Signatory Full Name *</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Name as it will appear on signature" data-testid="input-client-full-name" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="clientTitle"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Signatory Title</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="e.g., Managing Member, President" data-testid="input-client-title" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        <Separator />

        <div>
          <h3 className="text-lg font-medium mb-4">Project LLC (SPV)</h3>
          <div className="flex gap-4 mb-4">
            <Button
              type="button"
              variant={llcMode === "create" ? "default" : "outline"}
              onClick={() => setLlcMode("create")}
              data-testid="button-create-llc"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create New LLC
            </Button>
            <Button
              type="button"
              variant={llcMode === "existing" ? "default" : "outline"}
              onClick={() => setLlcMode("existing")}
              data-testid="button-use-existing-llc"
            >
              <Building2 className="h-4 w-4 mr-2" />
              Use Existing LLC
            </Button>
          </div>

          {llcMode === "create" && (
            <div className="grid grid-cols-2 gap-4 p-4 border rounded-lg bg-muted/30">
              <FormField
                control={form.control}
                name="newLlcName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>LLC Name (Auto-Generated)</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Enter client name above to generate" data-testid="input-new-llc-name" />
                    </FormControl>
                    <FormDescription>Format: Dvele Partners [Client Last Name] LLC</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="formationState"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Formation State</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger data-testid="select-formation-state">
                          <SelectValue placeholder="Select state" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {US_STATES.map((state) => (
                          <SelectItem key={state.value} value={state.value}>
                            {state.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>Delaware is recommended for tax benefits</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="col-span-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Info className="h-4 w-4" />
                  <span>A new LLC will be created in the system when you complete this wizard.</span>
                </div>
              </div>
            </div>
          )}

          {llcMode === "existing" && (
            <div className="p-4 border rounded-lg bg-muted/30">
              <FormField
                control={form.control}
                name="existingLlcId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Select Existing LLC</FormLabel>
                    <Select
                      value={field.value?.toString()}
                      onValueChange={(v) => field.onChange(parseInt(v))}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-existing-llc">
                          <SelectValue placeholder="Choose an LLC" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {existingLlcs.map((llc: any) => (
                          <SelectItem key={llc.id} value={llc.id.toString()}>
                            {llc.name} ({llc.status})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {existingLlcs.length === 0 && (
                <div className="flex items-center gap-2 mt-2 text-sm text-amber-600">
                  <AlertCircle className="h-4 w-4" />
                  <span>No existing LLCs found. Please create a new one.</span>
                </div>
              )}
            </div>
          )}
        </div>

        {serviceModel === "CRC" && (
          <>
            <Separator />
            <div>
              <h3 className="text-lg font-medium mb-4">On-Site Contractor Information</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Required for CRC model - the client's chosen contractor for on-site work.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="contractorName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contractor Name</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="ABC Construction Inc." data-testid="input-contractor-name" />
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
                        <Input {...field} placeholder="License #" data-testid="input-contractor-license" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="contractorAddress"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contractor Address</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Full address" data-testid="input-contractor-address" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="contractorInsurance"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Insurance Policy</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Policy number" data-testid="input-contractor-insurance" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
          </>
        )}

        <div className="flex justify-between">
          <Button type="button" variant="outline" onClick={onBack} data-testid="button-back-step2">
            <ChevronLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <Button type="submit" data-testid="button-next-step2">
            Continue to Site & Property
            <ChevronRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </form>
    </Form>
  );
}

function Step3SiteProperty({
  initialData,
  totalUnits,
  onComplete,
  onBack
}: {
  initialData: Step3Data | null;
  totalUnits: number;
  onComplete: (data: Step3Data) => void;
  onBack: () => void;
}) {
  const [units, setUnits] = useState<UnitData[]>(
    initialData?.units ||
    Array.from({ length: totalUnits }, (_, i) => ({
      id: i + 1,
      homeModel: "",
      squareFootage: 0,
      bedrooms: 0,
      bathrooms: 0,
      unitPrice: 0
    }))
  );

  const form = useForm<Step3Data>({
    resolver: zodResolver(step3Schema),
    defaultValues: initialData || {
      deliveryAddress: "",
      deliveryCity: "",
      deliveryState: "",
      deliveryZip: "",
      units: units
    }
  });

  useEffect(() => {
    form.setValue("units", units);
  }, [units, form]);

  const updateUnit = (index: number, field: keyof UnitData, value: any) => {
    const newUnits = [...units];
    newUnits[index] = { ...newUnits[index], [field]: value };
    
    if (field === "homeModel") {
      const model = HOME_MODELS.find(m => m.value === value);
      if (model && model.value !== "custom") {
        newUnits[index].squareFootage = model.sqft;
        newUnits[index].bedrooms = model.beds;
        newUnits[index].bathrooms = model.baths;
      }
    }
    
    setUnits(newUnits);
  };

  const calculateTotal = () => {
    return units.reduce((sum, unit) => sum + (unit.unitPrice || 0), 0);
  };

  const onSubmit = (data: Step3Data) => {
    data.units = units;
    onComplete(data);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <div>
          <h3 className="text-lg font-medium mb-4">Delivery / Site Address</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <FormField
                control={form.control}
                name="deliveryAddress"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Street Address *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="123 Main Street" data-testid="input-delivery-address" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="deliveryCity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>City *</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="San Francisco" data-testid="input-delivery-city" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="deliveryState"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>State *</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger data-testid="select-delivery-state">
                          <SelectValue placeholder="State" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {US_STATES.map((state) => (
                          <SelectItem key={state.value} value={state.value}>
                            {state.label}
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
                name="deliveryZip"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>ZIP Code *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="94102" data-testid="input-delivery-zip" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>
        </div>

        <Separator />

        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium">Unit Specifications</h3>
            <Badge variant="secondary">{totalUnits} {totalUnits === 1 ? "Unit" : "Units"}</Badge>
          </div>
          
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-6">
              {units.map((unit, index) => (
                <Card key={unit.id} className="border">
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm font-medium flex items-center justify-between">
                      <span>Unit {index + 1}</span>
                      {unit.homeModel && (
                        <Badge variant="outline">
                          {HOME_MODELS.find(m => m.value === unit.homeModel)?.label || unit.homeModel}
                        </Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-5 gap-4">
                      <div className="col-span-2">
                        <Label>Home Model *</Label>
                        <Select
                          value={unit.homeModel}
                          onValueChange={(v) => updateUnit(index, "homeModel", v)}
                        >
                          <SelectTrigger data-testid={`select-home-model-${index}`}>
                            <SelectValue placeholder="Select model" />
                          </SelectTrigger>
                          <SelectContent>
                            {HOME_MODELS.map((model) => (
                              <SelectItem key={model.value} value={model.value}>
                                {model.label} {model.sqft > 0 && `(${model.sqft} sqft)`}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Square Feet</Label>
                        <Input
                          type="number"
                          value={unit.squareFootage || ""}
                          onChange={(e) => updateUnit(index, "squareFootage", parseInt(e.target.value) || 0)}
                          placeholder="sqft"
                          data-testid={`input-sqft-${index}`}
                        />
                      </div>
                      <div>
                        <Label>Beds</Label>
                        <Input
                          type="number"
                          value={unit.bedrooms || ""}
                          onChange={(e) => updateUnit(index, "bedrooms", parseInt(e.target.value) || 0)}
                          placeholder="0"
                          data-testid={`input-beds-${index}`}
                        />
                      </div>
                      <div>
                        <Label>Baths</Label>
                        <Input
                          type="number"
                          value={unit.bathrooms || ""}
                          onChange={(e) => updateUnit(index, "bathrooms", parseInt(e.target.value) || 0)}
                          placeholder="0"
                          data-testid={`input-baths-${index}`}
                        />
                      </div>
                    </div>
                    <div>
                      <Label>Unit Price ($)</Label>
                      <Input
                        type="number"
                        value={unit.unitPrice || ""}
                        onChange={(e) => updateUnit(index, "unitPrice", parseInt(e.target.value) || 0)}
                        placeholder="0"
                        data-testid={`input-unit-price-${index}`}
                      />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>

          <div className="mt-4 p-4 bg-muted rounded-lg">
            <div className="flex items-center justify-between">
              <span className="font-medium">Total Preliminary Price</span>
              <span className="text-xl font-bold">
                ${calculateTotal().toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        <div className="flex justify-between">
          <Button type="button" variant="outline" onClick={onBack} data-testid="button-back-step3">
            <ChevronLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <Button type="submit" data-testid="button-next-step3">
            Continue to Financial Terms
            <ChevronRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </form>
    </Form>
  );
}

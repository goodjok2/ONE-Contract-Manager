import { useState, useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
} from "@/components/ui/form";
import { Check, ChevronRight, ChevronLeft, Building2, Users, DollarSign } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY"
];

const agreementSchema = z.object({
  projectNumber: z.string().min(1, "Project number is required"),
  projectName: z.string().min(1, "Project name is required"),
  state: z.string().min(1, "State is required"),
  clientName: z.string().min(1, "Client name is required"),
  clientEmail: z.string().email("Invalid email address"),
  llcLegalName: z.string().min(1, "LLC legal name is required"),
  designFee: z.coerce.number().min(0, "Must be a positive number"),
  prelimOffsite: z.coerce.number().min(0, "Must be a positive number"),
  prelimOnsite: z.coerce.number().min(0, "Must be a positive number"),
});

type AgreementFormValues = z.infer<typeof agreementSchema>;

const steps = [
  { id: 1, name: "Project & Client", icon: Users },
  { id: 2, name: "Entity Setup", icon: Building2 },
  { id: 3, name: "Budget", icon: DollarSign },
];

export default function AgreementsNew() {
  const [currentStep, setCurrentStep] = useState(1);
  const [llcManuallyEdited, setLlcManuallyEdited] = useState(false);
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const form = useForm<AgreementFormValues>({
    resolver: zodResolver(agreementSchema),
    defaultValues: {
      projectNumber: "",
      projectName: "",
      state: "",
      clientName: "",
      clientEmail: "",
      llcLegalName: "",
      designFee: 0,
      prelimOffsite: 0,
      prelimOnsite: 0,
    },
    mode: "onChange",
  });

  const projectName = useWatch({ control: form.control, name: "projectName" });
  const designFee = useWatch({ control: form.control, name: "designFee" });
  const prelimOffsite = useWatch({ control: form.control, name: "prelimOffsite" });
  const prelimOnsite = useWatch({ control: form.control, name: "prelimOnsite" });

  useEffect(() => {
    if (!llcManuallyEdited && projectName) {
      form.setValue("llcLegalName", `DP ${projectName} LLC`);
    }
  }, [projectName, llcManuallyEdited, form]);

  const totalBudget = Number(designFee || 0) + Number(prelimOffsite || 0) + Number(prelimOnsite || 0);

  const createMutation = useMutation({
    mutationFn: async (data: AgreementFormValues) => {
      const payload = {
        project: {
          projectNumber: data.projectNumber,
          name: data.projectName,
          state: data.state,
          status: "Draft",
        },
        client: {
          legalName: data.clientName,
          email: data.clientEmail,
          address: null,
          phone: null,
          entityType: null,
        },
        llc: {
          legalName: data.llcLegalName,
        },
        financials: {
          designFee: data.designFee,
          prelimOffsite: data.prelimOffsite,
          prelimOnsite: data.prelimOnsite,
        },
      };
      const response = await apiRequest("POST", "/api/projects", payload);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({
        title: "Agreement Created",
        description: "The new agreement has been created successfully.",
      });
      navigate("/");
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create agreement. Please try again.",
        variant: "destructive",
      });
    },
  });

  const validateStep = async (step: number): Promise<boolean> => {
    let fieldsToValidate: (keyof AgreementFormValues)[] = [];
    
    switch (step) {
      case 1:
        fieldsToValidate = ["projectNumber", "projectName", "state", "clientName", "clientEmail"];
        break;
      case 2:
        fieldsToValidate = ["llcLegalName"];
        break;
      case 3:
        fieldsToValidate = ["designFee", "prelimOffsite", "prelimOnsite"];
        break;
    }

    const result = await form.trigger(fieldsToValidate);
    return result;
  };

  const handleNext = async () => {
    const isValid = await validateStep(currentStep);
    if (isValid && currentStep < 3) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const onSubmit = (data: AgreementFormValues) => {
    createMutation.mutate(data);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(value);
  };

  return (
    <div className="flex-1 p-6 md:p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-foreground" data-testid="text-page-title">
          Create New Agreement
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Complete the wizard to set up a new project agreement
        </p>
      </div>

      <div className="max-w-3xl">
        <nav aria-label="Progress" className="mb-8">
          <ol className="flex items-center">
            {steps.map((step, stepIdx) => (
              <li key={step.name} className={`relative ${stepIdx !== steps.length - 1 ? "flex-1 pr-8" : ""}`}>
                <div className="flex items-center gap-3 flex-wrap">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors ${
                      currentStep > step.id
                        ? "border-primary bg-primary text-primary-foreground"
                        : currentStep === step.id
                        ? "border-primary bg-background text-primary"
                        : "border-muted bg-background text-muted-foreground"
                    }`}
                    data-testid={`step-indicator-${step.id}`}
                  >
                    {currentStep > step.id ? (
                      <Check className="h-5 w-5" />
                    ) : (
                      <step.icon className="h-5 w-5" />
                    )}
                  </div>
                  <span
                    className={`text-sm font-medium ${
                      currentStep >= step.id ? "text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {step.name}
                  </span>
                </div>
                {stepIdx !== steps.length - 1 && (
                  <div
                    className={`absolute top-5 left-14 -ml-px h-0.5 w-full transition-colors ${
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
          <form 
            onSubmit={form.handleSubmit(onSubmit)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && currentStep < 3) {
                e.preventDefault();
              }
            }}
          >
            {currentStep === 1 && (
              <Card data-testid="card-step-1">
                <CardHeader>
                  <CardTitle className="text-lg">Project & Client Information</CardTitle>
                  <CardDescription>Enter the basic project and client details</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="projectNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Project Number</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="e.g., PRJ-2024-001"
                              data-testid="input-project-number"
                              {...field}
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
                          <FormLabel>Project Name</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="e.g., Willow Creek Residence"
                              data-testid="input-project-name"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="state"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>State</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
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

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="clientName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Client Name</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Enter client's legal name"
                              data-testid="input-client-name"
                              {...field}
                            />
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
                          <FormLabel>Client Email</FormLabel>
                          <FormControl>
                            <Input
                              type="email"
                              placeholder="client@example.com"
                              data-testid="input-client-email"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            {currentStep === 2 && (
              <Card data-testid="card-step-2">
                <CardHeader>
                  <CardTitle className="text-lg">Entity Setup</CardTitle>
                  <CardDescription>Configure the child LLC for this project</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="llcLegalName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>LLC Legal Name</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Dvele Partners [Project] LLC"
                            data-testid="input-llc-name"
                            {...field}
                            onChange={(e) => {
                              setLlcManuallyEdited(true);
                              field.onChange(e);
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                        <p className="text-xs text-muted-foreground mt-1">
                          Auto-generated based on project name. You can customize if needed.
                        </p>
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            )}

            {currentStep === 3 && (
              <Card data-testid="card-step-3">
                <CardHeader>
                  <CardTitle className="text-lg">Budget</CardTitle>
                  <CardDescription>Set the preliminary budget for this project</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="designFee"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Design Fee ($)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="0.00"
                              data-testid="input-design-fee"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="prelimOffsite"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Prelim Offsite ($)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="0.00"
                              data-testid="input-prelim-offsite"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="prelimOnsite"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Prelim Onsite ($)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="0.00"
                              data-testid="input-prelim-onsite"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="mt-6 p-4 rounded-lg bg-muted/50">
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                      <span className="text-sm font-medium text-muted-foreground">
                        Preliminary Total
                      </span>
                      <span className="text-2xl font-bold text-foreground" data-testid="text-total-budget">
                        {formatCurrency(totalBudget)}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
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

              <Button 
                type="button" 
                onClick={handleNext} 
                data-testid="button-next"
                className={currentStep >= 3 ? "hidden" : ""}
              >
                Next
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending}
                data-testid="button-submit"
                className={currentStep < 3 ? "hidden" : ""}
              >
                {createMutation.isPending ? "Creating..." : "Create Agreement"}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}

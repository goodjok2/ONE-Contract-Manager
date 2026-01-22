import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { 
  Check, 
  ChevronLeft, 
  ChevronRight, 
  Save, 
  FileText,
  Building2,
  Users,
  Home,
  Calendar,
  DollarSign,
  ClipboardCheck
} from "lucide-react";

interface WizardState {
  currentStep: number;
  projectData: {
    projectNumber: string;
    projectName: string;
    totalUnits: number;
    agreementDate: string;
    serviceModel: 'CRC' | 'CMOS';
    clientLegalName: string;
    clientState: string;
    clientEntityType: string;
    clientAddress: string;
    clientCity: string;
    clientZip: string;
    clientSignerName: string;
    clientSignerTitle: string;
    clientEmail: string;
    clientPhone: string;
    childLlcName: string;
    childLlcState: string;
    childLlcEin: string;
    childLlcAddress: string;
    siteAddress: string;
    siteCity: string;
    siteState: string;
    siteZip: string;
    siteCounty: string;
    siteApn: string;
    homeModel: string;
    homeSquareFootage: number;
    homeBedrooms: number;
    homeBathrooms: number;
    homeConfiguration: string;
    effectiveDate: string;
    targetDeliveryDate: string;
    manufacturingStartDate: string;
    installationDate: string;
    contractPrice: number;
    designFee: number;
    preliminaryOffsiteCost: number;
    preliminaryOnsiteCost: number;
    depositAmount: number;
    paymentSchedule: string;
    warrantyPeriodYears: number;
    warrantyStartDate: string;
    generalContractorName: string;
    generalContractorLicense: string;
    manufacturerName: string;
    manufacturerAddress: string;
    insuranceProvider: string;
    insurancePolicyNumber: string;
    insuranceCoverageAmount: number;
  };
  completedSteps: Set<number>;
  validationErrors: Record<string, string>;
}

const STEPS = [
  { number: 1, title: "Project Info", description: "Basic project details", icon: FileText },
  { number: 2, title: "Client Details", description: "Client information", icon: Users },
  { number: 3, title: "Child LLC", description: "LLC entity setup", icon: Building2 },
  { number: 4, title: "Site & Home", description: "Property details", icon: Home },
  { number: 5, title: "Dates & Schedule", description: "Timeline", icon: Calendar },
  { number: 6, title: "Pricing", description: "Financial terms", icon: DollarSign },
  { number: 7, title: "Review & Generate", description: "Final review", icon: ClipboardCheck },
];

const initialProjectData: WizardState['projectData'] = {
  projectNumber: '',
  projectName: '',
  totalUnits: 1,
  agreementDate: new Date().toISOString().split('T')[0],
  serviceModel: 'CRC',
  clientLegalName: '',
  clientState: '',
  clientEntityType: '',
  clientAddress: '',
  clientCity: '',
  clientZip: '',
  clientSignerName: '',
  clientSignerTitle: '',
  clientEmail: '',
  clientPhone: '',
  childLlcName: '',
  childLlcState: 'Delaware',
  childLlcEin: '',
  childLlcAddress: '',
  siteAddress: '',
  siteCity: '',
  siteState: '',
  siteZip: '',
  siteCounty: '',
  siteApn: '',
  homeModel: '',
  homeSquareFootage: 0,
  homeBedrooms: 0,
  homeBathrooms: 0,
  homeConfiguration: '',
  effectiveDate: '',
  targetDeliveryDate: '',
  manufacturingStartDate: '',
  installationDate: '',
  contractPrice: 0,
  designFee: 0,
  preliminaryOffsiteCost: 0,
  preliminaryOnsiteCost: 0,
  depositAmount: 0,
  paymentSchedule: '',
  warrantyPeriodYears: 1,
  warrantyStartDate: '',
  generalContractorName: '',
  generalContractorLicense: '',
  manufacturerName: 'Dvele, Inc.',
  manufacturerAddress: '',
  insuranceProvider: '',
  insurancePolicyNumber: '',
  insuranceCoverageAmount: 0,
};

export default function GenerateContracts() {
  const { toast } = useToast();
  const [wizardState, setWizardState] = useState<WizardState>({
    currentStep: 1,
    projectData: initialProjectData,
    completedSteps: new Set<number>(),
    validationErrors: {},
  });

  const updateProjectData = useCallback((updates: Partial<WizardState['projectData']>) => {
    setWizardState(prev => ({
      ...prev,
      projectData: { ...prev.projectData, ...updates },
      validationErrors: {},
    }));
  }, []);

  const validateStep = useCallback((stepNumber: number): { valid: boolean; errors: Record<string, string> } => {
    const errors: Record<string, string> = {};
    const data = wizardState.projectData;

    switch (stepNumber) {
      case 1:
        if (!data.projectNumber.trim()) errors.projectNumber = 'Project number is required';
        if (!data.projectName.trim()) errors.projectName = 'Project name is required';
        if (!data.serviceModel) errors.serviceModel = 'Service model is required';
        break;
      case 2:
        if (!data.clientLegalName.trim()) errors.clientLegalName = 'Client legal name is required';
        if (!data.clientState.trim()) errors.clientState = 'Client state is required';
        break;
      case 3:
        if (!data.childLlcName.trim()) errors.childLlcName = 'LLC name is required';
        break;
      case 4:
        if (!data.siteAddress.trim()) errors.siteAddress = 'Site address is required';
        if (!data.siteState.trim()) errors.siteState = 'Site state is required';
        break;
      case 5:
        if (!data.effectiveDate) errors.effectiveDate = 'Effective date is required';
        break;
      case 6:
        if (data.contractPrice <= 0) errors.contractPrice = 'Contract price must be greater than 0';
        break;
      case 7:
        break;
    }

    return { valid: Object.keys(errors).length === 0, errors };
  }, [wizardState.projectData]);

  const nextStep = useCallback(() => {
    const { valid, errors } = validateStep(wizardState.currentStep);
    
    if (!valid) {
      setWizardState(prev => ({ ...prev, validationErrors: errors }));
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields before proceeding.",
        variant: "destructive",
      });
      return;
    }

    setWizardState(prev => ({
      ...prev,
      currentStep: Math.min(prev.currentStep + 1, 7),
      completedSteps: new Set([...prev.completedSteps, prev.currentStep]),
      validationErrors: {},
    }));
  }, [wizardState.currentStep, validateStep, toast]);

  const prevStep = useCallback(() => {
    setWizardState(prev => ({
      ...prev,
      currentStep: Math.max(prev.currentStep - 1, 1),
      validationErrors: {},
    }));
  }, []);

  const goToStep = useCallback((stepNumber: number) => {
    if (stepNumber < wizardState.currentStep || wizardState.completedSteps.has(stepNumber - 1) || stepNumber === 1) {
      setWizardState(prev => ({
        ...prev,
        currentStep: stepNumber,
        validationErrors: {},
      }));
    }
  }, [wizardState.currentStep, wizardState.completedSteps]);

  const saveDraft = useCallback(() => {
    localStorage.setItem('contractWizardDraft', JSON.stringify({
      projectData: wizardState.projectData,
      currentStep: wizardState.currentStep,
      completedSteps: Array.from(wizardState.completedSteps),
    }));
    toast({
      title: "Draft Saved",
      description: "Your progress has been saved locally.",
    });
  }, [wizardState, toast]);

  const loadDraft = useCallback(() => {
    const saved = localStorage.getItem('contractWizardDraft');
    if (saved) {
      const parsed = JSON.parse(saved);
      setWizardState(prev => ({
        ...prev,
        projectData: parsed.projectData,
        currentStep: parsed.currentStep,
        completedSteps: new Set(parsed.completedSteps),
      }));
      toast({
        title: "Draft Loaded",
        description: "Your previous progress has been restored.",
      });
    }
  }, [toast]);

  const progressPercent = ((wizardState.currentStep - 1) / 6) * 100;

  const renderStepContent = () => {
    const { currentStep, projectData, validationErrors } = wizardState;

    switch (currentStep) {
      case 1:
        return (
          <StepContent
            title="Project Information"
            description="Enter the basic project details and select the service model"
          >
            <div className="grid gap-6">
              <FormField
                label="Project Number"
                required
                error={validationErrors.projectNumber}
              >
                <input
                  type="text"
                  className="w-full px-3 py-2 border rounded-md bg-background"
                  placeholder="e.g., PRJ-2026-001"
                  value={projectData.projectNumber}
                  onChange={(e) => updateProjectData({ projectNumber: e.target.value })}
                  data-testid="input-project-number"
                />
              </FormField>

              <FormField
                label="Project Name"
                required
                error={validationErrors.projectName}
              >
                <input
                  type="text"
                  className="w-full px-3 py-2 border rounded-md bg-background"
                  placeholder="e.g., Smith Residence"
                  value={projectData.projectName}
                  onChange={(e) => updateProjectData({ projectName: e.target.value })}
                  data-testid="input-project-name"
                />
              </FormField>

              <FormField
                label="Service Model"
                required
                error={validationErrors.serviceModel}
              >
                <div className="flex gap-4">
                  <label className={`flex-1 p-4 border rounded-lg cursor-pointer transition-colors hover-elevate ${
                    projectData.serviceModel === 'CRC' ? 'border-primary bg-primary/5' : ''
                  }`}>
                    <input
                      type="radio"
                      name="serviceModel"
                      value="CRC"
                      checked={projectData.serviceModel === 'CRC'}
                      onChange={() => updateProjectData({ serviceModel: 'CRC' })}
                      className="sr-only"
                      data-testid="radio-service-crc"
                    />
                    <div className="font-semibold">CRC</div>
                    <div className="text-sm text-muted-foreground">Client Retained Contractor</div>
                  </label>
                  <label className={`flex-1 p-4 border rounded-lg cursor-pointer transition-colors hover-elevate ${
                    projectData.serviceModel === 'CMOS' ? 'border-primary bg-primary/5' : ''
                  }`}>
                    <input
                      type="radio"
                      name="serviceModel"
                      value="CMOS"
                      checked={projectData.serviceModel === 'CMOS'}
                      onChange={() => updateProjectData({ serviceModel: 'CMOS' })}
                      className="sr-only"
                      data-testid="radio-service-cmos"
                    />
                    <div className="font-semibold">CMOS</div>
                    <div className="text-sm text-muted-foreground">Contractor Managed OnSite</div>
                  </label>
                </div>
              </FormField>

              <div className="grid grid-cols-2 gap-4">
                <FormField label="Total Units">
                  <input
                    type="number"
                    min="1"
                    className="w-full px-3 py-2 border rounded-md bg-background"
                    value={projectData.totalUnits}
                    onChange={(e) => updateProjectData({ totalUnits: parseInt(e.target.value) || 1 })}
                    data-testid="input-total-units"
                  />
                </FormField>

                <FormField label="Agreement Date">
                  <input
                    type="date"
                    className="w-full px-3 py-2 border rounded-md bg-background"
                    value={projectData.agreementDate}
                    onChange={(e) => updateProjectData({ agreementDate: e.target.value })}
                    data-testid="input-agreement-date"
                  />
                </FormField>
              </div>
            </div>
          </StepContent>
        );

      case 2:
        return (
          <StepContent
            title="Client Details"
            description="Enter information about the client entity"
          >
            <div className="grid gap-6">
              <FormField
                label="Client Legal Name"
                required
                error={validationErrors.clientLegalName}
              >
                <input
                  type="text"
                  className="w-full px-3 py-2 border rounded-md bg-background"
                  placeholder="e.g., Smith Family Trust"
                  value={projectData.clientLegalName}
                  onChange={(e) => updateProjectData({ clientLegalName: e.target.value })}
                  data-testid="input-client-legal-name"
                />
              </FormField>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  label="Client State"
                  required
                  error={validationErrors.clientState}
                >
                  <input
                    type="text"
                    className="w-full px-3 py-2 border rounded-md bg-background"
                    placeholder="e.g., California"
                    value={projectData.clientState}
                    onChange={(e) => updateProjectData({ clientState: e.target.value })}
                    data-testid="input-client-state"
                  />
                </FormField>

                <FormField label="Entity Type">
                  <input
                    type="text"
                    className="w-full px-3 py-2 border rounded-md bg-background"
                    placeholder="e.g., Trust, LLC, Individual"
                    value={projectData.clientEntityType}
                    onChange={(e) => updateProjectData({ clientEntityType: e.target.value })}
                    data-testid="input-client-entity-type"
                  />
                </FormField>
              </div>

              <FormField label="Client Address">
                <input
                  type="text"
                  className="w-full px-3 py-2 border rounded-md bg-background"
                  placeholder="Street address"
                  value={projectData.clientAddress}
                  onChange={(e) => updateProjectData({ clientAddress: e.target.value })}
                  data-testid="input-client-address"
                />
              </FormField>

              <div className="grid grid-cols-2 gap-4">
                <FormField label="City">
                  <input
                    type="text"
                    className="w-full px-3 py-2 border rounded-md bg-background"
                    value={projectData.clientCity}
                    onChange={(e) => updateProjectData({ clientCity: e.target.value })}
                    data-testid="input-client-city"
                  />
                </FormField>
                <FormField label="ZIP Code">
                  <input
                    type="text"
                    className="w-full px-3 py-2 border rounded-md bg-background"
                    value={projectData.clientZip}
                    onChange={(e) => updateProjectData({ clientZip: e.target.value })}
                    data-testid="input-client-zip"
                  />
                </FormField>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField label="Signer Name">
                  <input
                    type="text"
                    className="w-full px-3 py-2 border rounded-md bg-background"
                    placeholder="Person signing the contract"
                    value={projectData.clientSignerName}
                    onChange={(e) => updateProjectData({ clientSignerName: e.target.value })}
                    data-testid="input-client-signer-name"
                  />
                </FormField>
                <FormField label="Signer Title">
                  <input
                    type="text"
                    className="w-full px-3 py-2 border rounded-md bg-background"
                    placeholder="e.g., Trustee, Manager"
                    value={projectData.clientSignerTitle}
                    onChange={(e) => updateProjectData({ clientSignerTitle: e.target.value })}
                    data-testid="input-client-signer-title"
                  />
                </FormField>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField label="Email">
                  <input
                    type="email"
                    className="w-full px-3 py-2 border rounded-md bg-background"
                    value={projectData.clientEmail}
                    onChange={(e) => updateProjectData({ clientEmail: e.target.value })}
                    data-testid="input-client-email"
                  />
                </FormField>
                <FormField label="Phone">
                  <input
                    type="tel"
                    className="w-full px-3 py-2 border rounded-md bg-background"
                    value={projectData.clientPhone}
                    onChange={(e) => updateProjectData({ clientPhone: e.target.value })}
                    data-testid="input-client-phone"
                  />
                </FormField>
              </div>
            </div>
          </StepContent>
        );

      case 3:
        return (
          <StepContent
            title="Child LLC Setup"
            description="Configure the project-specific LLC entity"
          >
            <div className="grid gap-6">
              <FormField
                label="LLC Name"
                required
                error={validationErrors.childLlcName}
              >
                <input
                  type="text"
                  className="w-full px-3 py-2 border rounded-md bg-background"
                  placeholder="e.g., Dvele Partners Smith 123Main LLC"
                  value={projectData.childLlcName}
                  onChange={(e) => updateProjectData({ childLlcName: e.target.value })}
                  data-testid="input-llc-name"
                />
                <p className="text-sm text-muted-foreground mt-1">
                  Format: Dvele Partners [Client Last Name] [First 7 chars of address] LLC
                </p>
              </FormField>

              <div className="grid grid-cols-2 gap-4">
                <FormField label="State of Formation">
                  <input
                    type="text"
                    className="w-full px-3 py-2 border rounded-md bg-background"
                    value={projectData.childLlcState}
                    onChange={(e) => updateProjectData({ childLlcState: e.target.value })}
                    data-testid="input-llc-state"
                  />
                </FormField>
                <FormField label="EIN (if available)">
                  <input
                    type="text"
                    className="w-full px-3 py-2 border rounded-md bg-background"
                    placeholder="XX-XXXXXXX"
                    value={projectData.childLlcEin}
                    onChange={(e) => updateProjectData({ childLlcEin: e.target.value })}
                    data-testid="input-llc-ein"
                  />
                </FormField>
              </div>

              <FormField label="LLC Address">
                <input
                  type="text"
                  className="w-full px-3 py-2 border rounded-md bg-background"
                  placeholder="Registered address for the LLC"
                  value={projectData.childLlcAddress}
                  onChange={(e) => updateProjectData({ childLlcAddress: e.target.value })}
                  data-testid="input-llc-address"
                />
              </FormField>

              <div className="p-4 bg-muted/50 rounded-lg">
                <h4 className="font-medium mb-2">LLC Purpose</h4>
                <p className="text-sm text-muted-foreground">
                  This child LLC will be created specifically for this project to manage the construction 
                  contract and related obligations. Dvele will be a managing member with the client as 
                  an investor member.
                </p>
              </div>
            </div>
          </StepContent>
        );

      case 4:
        return (
          <StepContent
            title="Site & Home Details"
            description="Enter the property location and home specifications"
          >
            <div className="grid gap-6">
              <div className="space-y-4">
                <h4 className="font-medium">Site Location</h4>
                <FormField
                  label="Site Address"
                  required
                  error={validationErrors.siteAddress}
                >
                  <input
                    type="text"
                    className="w-full px-3 py-2 border rounded-md bg-background"
                    placeholder="Street address where home will be installed"
                    value={projectData.siteAddress}
                    onChange={(e) => updateProjectData({ siteAddress: e.target.value })}
                    data-testid="input-site-address"
                  />
                </FormField>

                <div className="grid grid-cols-3 gap-4">
                  <FormField label="City">
                    <input
                      type="text"
                      className="w-full px-3 py-2 border rounded-md bg-background"
                      value={projectData.siteCity}
                      onChange={(e) => updateProjectData({ siteCity: e.target.value })}
                      data-testid="input-site-city"
                    />
                  </FormField>
                  <FormField
                    label="State"
                    required
                    error={validationErrors.siteState}
                  >
                    <input
                      type="text"
                      className="w-full px-3 py-2 border rounded-md bg-background"
                      value={projectData.siteState}
                      onChange={(e) => updateProjectData({ siteState: e.target.value })}
                      data-testid="input-site-state"
                    />
                  </FormField>
                  <FormField label="ZIP">
                    <input
                      type="text"
                      className="w-full px-3 py-2 border rounded-md bg-background"
                      value={projectData.siteZip}
                      onChange={(e) => updateProjectData({ siteZip: e.target.value })}
                      data-testid="input-site-zip"
                    />
                  </FormField>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField label="County">
                    <input
                      type="text"
                      className="w-full px-3 py-2 border rounded-md bg-background"
                      value={projectData.siteCounty}
                      onChange={(e) => updateProjectData({ siteCounty: e.target.value })}
                      data-testid="input-site-county"
                    />
                  </FormField>
                  <FormField label="APN (Parcel Number)">
                    <input
                      type="text"
                      className="w-full px-3 py-2 border rounded-md bg-background"
                      value={projectData.siteApn}
                      onChange={(e) => updateProjectData({ siteApn: e.target.value })}
                      data-testid="input-site-apn"
                    />
                  </FormField>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-medium">Home Specifications</h4>
                <FormField label="Home Model">
                  <input
                    type="text"
                    className="w-full px-3 py-2 border rounded-md bg-background"
                    placeholder="e.g., Dvele Modern 2500"
                    value={projectData.homeModel}
                    onChange={(e) => updateProjectData({ homeModel: e.target.value })}
                    data-testid="input-home-model"
                  />
                </FormField>

                <div className="grid grid-cols-4 gap-4">
                  <FormField label="Sq. Footage">
                    <input
                      type="number"
                      min="0"
                      className="w-full px-3 py-2 border rounded-md bg-background"
                      value={projectData.homeSquareFootage || ''}
                      onChange={(e) => updateProjectData({ homeSquareFootage: parseInt(e.target.value) || 0 })}
                      data-testid="input-home-sqft"
                    />
                  </FormField>
                  <FormField label="Bedrooms">
                    <input
                      type="number"
                      min="0"
                      className="w-full px-3 py-2 border rounded-md bg-background"
                      value={projectData.homeBedrooms || ''}
                      onChange={(e) => updateProjectData({ homeBedrooms: parseInt(e.target.value) || 0 })}
                      data-testid="input-home-beds"
                    />
                  </FormField>
                  <FormField label="Bathrooms">
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      className="w-full px-3 py-2 border rounded-md bg-background"
                      value={projectData.homeBathrooms || ''}
                      onChange={(e) => updateProjectData({ homeBathrooms: parseFloat(e.target.value) || 0 })}
                      data-testid="input-home-baths"
                    />
                  </FormField>
                  <FormField label="Configuration">
                    <input
                      type="text"
                      className="w-full px-3 py-2 border rounded-md bg-background"
                      placeholder="e.g., Single Story"
                      value={projectData.homeConfiguration}
                      onChange={(e) => updateProjectData({ homeConfiguration: e.target.value })}
                      data-testid="input-home-config"
                    />
                  </FormField>
                </div>
              </div>
            </div>
          </StepContent>
        );

      case 5:
        return (
          <StepContent
            title="Dates & Schedule"
            description="Set the project timeline and key milestones"
          >
            <div className="grid gap-6">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  label="Effective Date"
                  required
                  error={validationErrors.effectiveDate}
                >
                  <input
                    type="date"
                    className="w-full px-3 py-2 border rounded-md bg-background"
                    value={projectData.effectiveDate}
                    onChange={(e) => updateProjectData({ effectiveDate: e.target.value })}
                    data-testid="input-effective-date"
                  />
                </FormField>
                <FormField label="Target Delivery Date">
                  <input
                    type="date"
                    className="w-full px-3 py-2 border rounded-md bg-background"
                    value={projectData.targetDeliveryDate}
                    onChange={(e) => updateProjectData({ targetDeliveryDate: e.target.value })}
                    data-testid="input-delivery-date"
                  />
                </FormField>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField label="Manufacturing Start Date">
                  <input
                    type="date"
                    className="w-full px-3 py-2 border rounded-md bg-background"
                    value={projectData.manufacturingStartDate}
                    onChange={(e) => updateProjectData({ manufacturingStartDate: e.target.value })}
                    data-testid="input-manufacturing-date"
                  />
                </FormField>
                <FormField label="Installation Date">
                  <input
                    type="date"
                    className="w-full px-3 py-2 border rounded-md bg-background"
                    value={projectData.installationDate}
                    onChange={(e) => updateProjectData({ installationDate: e.target.value })}
                    data-testid="input-installation-date"
                  />
                </FormField>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField label="Warranty Period (Years)">
                  <input
                    type="number"
                    min="1"
                    className="w-full px-3 py-2 border rounded-md bg-background"
                    value={projectData.warrantyPeriodYears}
                    onChange={(e) => updateProjectData({ warrantyPeriodYears: parseInt(e.target.value) || 1 })}
                    data-testid="input-warranty-years"
                  />
                </FormField>
                <FormField label="Warranty Start Date">
                  <input
                    type="date"
                    className="w-full px-3 py-2 border rounded-md bg-background"
                    value={projectData.warrantyStartDate}
                    onChange={(e) => updateProjectData({ warrantyStartDate: e.target.value })}
                    data-testid="input-warranty-start"
                  />
                </FormField>
              </div>

              <div className="p-4 bg-muted/50 rounded-lg">
                <h4 className="font-medium mb-2">Timeline Overview</h4>
                <p className="text-sm text-muted-foreground">
                  The contract will include specific milestones for design approval, manufacturing 
                  completion, transportation, and on-site installation. Payment schedules will be 
                  tied to these milestones.
                </p>
              </div>
            </div>
          </StepContent>
        );

      case 6:
        return (
          <StepContent
            title="Pricing & Financials"
            description="Enter the contract value and payment terms"
          >
            <div className="grid gap-6">
              <FormField
                label="Total Contract Price"
                required
                error={validationErrors.contractPrice}
              >
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="w-full pl-7 pr-3 py-2 border rounded-md bg-background"
                    value={projectData.contractPrice || ''}
                    onChange={(e) => updateProjectData({ contractPrice: parseFloat(e.target.value) || 0 })}
                    data-testid="input-contract-price"
                  />
                </div>
              </FormField>

              <div className="grid grid-cols-3 gap-4">
                <FormField label="Design Fee">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="w-full pl-7 pr-3 py-2 border rounded-md bg-background"
                      value={projectData.designFee || ''}
                      onChange={(e) => updateProjectData({ designFee: parseFloat(e.target.value) || 0 })}
                      data-testid="input-design-fee"
                    />
                  </div>
                </FormField>
                <FormField label="Prelim. Offsite Cost">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="w-full pl-7 pr-3 py-2 border rounded-md bg-background"
                      value={projectData.preliminaryOffsiteCost || ''}
                      onChange={(e) => updateProjectData({ preliminaryOffsiteCost: parseFloat(e.target.value) || 0 })}
                      data-testid="input-offsite-cost"
                    />
                  </div>
                </FormField>
                <FormField label="Prelim. Onsite Cost">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="w-full pl-7 pr-3 py-2 border rounded-md bg-background"
                      value={projectData.preliminaryOnsiteCost || ''}
                      onChange={(e) => updateProjectData({ preliminaryOnsiteCost: parseFloat(e.target.value) || 0 })}
                      data-testid="input-onsite-cost"
                    />
                  </div>
                </FormField>
              </div>

              <FormField label="Deposit Amount">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="w-full pl-7 pr-3 py-2 border rounded-md bg-background"
                    value={projectData.depositAmount || ''}
                    onChange={(e) => updateProjectData({ depositAmount: parseFloat(e.target.value) || 0 })}
                    data-testid="input-deposit"
                  />
                </div>
              </FormField>

              <FormField label="Payment Schedule Notes">
                <textarea
                  className="w-full px-3 py-2 border rounded-md bg-background min-h-[80px]"
                  placeholder="Describe the milestone-based payment schedule..."
                  value={projectData.paymentSchedule}
                  onChange={(e) => updateProjectData({ paymentSchedule: e.target.value })}
                  data-testid="input-payment-schedule"
                />
              </FormField>

              <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
                <h4 className="font-medium mb-2">Financial Summary</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>Contract Price:</div>
                  <div className="text-right font-medium">
                    ${projectData.contractPrice.toLocaleString()}
                  </div>
                  <div>Design Fee:</div>
                  <div className="text-right">${projectData.designFee.toLocaleString()}</div>
                  <div>Offsite Costs:</div>
                  <div className="text-right">${projectData.preliminaryOffsiteCost.toLocaleString()}</div>
                  <div>Onsite Costs:</div>
                  <div className="text-right">${projectData.preliminaryOnsiteCost.toLocaleString()}</div>
                  <div className="font-medium pt-2 border-t">Total:</div>
                  <div className="text-right font-medium pt-2 border-t">
                    ${(projectData.contractPrice + projectData.designFee + 
                       projectData.preliminaryOffsiteCost + projectData.preliminaryOnsiteCost).toLocaleString()}
                  </div>
                </div>
              </div>
            </div>
          </StepContent>
        );

      case 7:
        return (
          <StepContent
            title="Review & Generate"
            description="Review all information and generate the contract package"
          >
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <ReviewSection title="Project">
                  <ReviewItem label="Project Number" value={projectData.projectNumber} />
                  <ReviewItem label="Project Name" value={projectData.projectName} />
                  <ReviewItem label="Service Model" value={projectData.serviceModel} />
                  <ReviewItem label="Units" value={String(projectData.totalUnits)} />
                </ReviewSection>

                <ReviewSection title="Client">
                  <ReviewItem label="Legal Name" value={projectData.clientLegalName} />
                  <ReviewItem label="State" value={projectData.clientState} />
                  <ReviewItem label="Signer" value={projectData.clientSignerName} />
                </ReviewSection>

                <ReviewSection title="Child LLC">
                  <ReviewItem label="LLC Name" value={projectData.childLlcName} />
                  <ReviewItem label="State" value={projectData.childLlcState} />
                </ReviewSection>

                <ReviewSection title="Site">
                  <ReviewItem label="Address" value={projectData.siteAddress} />
                  <ReviewItem label="City/State" value={`${projectData.siteCity}, ${projectData.siteState}`} />
                </ReviewSection>

                <ReviewSection title="Home">
                  <ReviewItem label="Model" value={projectData.homeModel} />
                  <ReviewItem label="Size" value={`${projectData.homeSquareFootage} sq ft`} />
                  <ReviewItem label="Bed/Bath" value={`${projectData.homeBedrooms}bd / ${projectData.homeBathrooms}ba`} />
                </ReviewSection>

                <ReviewSection title="Financials">
                  <ReviewItem label="Contract Price" value={`$${projectData.contractPrice.toLocaleString()}`} />
                  <ReviewItem label="Deposit" value={`$${projectData.depositAmount.toLocaleString()}`} />
                </ReviewSection>
              </div>

              <div className="p-4 bg-muted/50 rounded-lg">
                <h4 className="font-medium mb-3">Contracts to be Generated</h4>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    <span>ONE Agreement (Master Contract)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    <span>Manufacturing Subcontract</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    <span>OnSite Subcontract</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-center pt-4">
                <Button size="lg" className="gap-2" data-testid="button-generate-contracts">
                  <FileText className="h-5 w-5" />
                  Generate Contract Package
                </Button>
              </div>
            </div>
          </StepContent>
        );

      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="border-b p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold">Generate Contracts</h1>
            <p className="text-muted-foreground">
              Step {wizardState.currentStep} of 7: {STEPS[wizardState.currentStep - 1].title}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={loadDraft} data-testid="button-load-draft">
              Load Draft
            </Button>
            <Button variant="outline" size="sm" onClick={saveDraft} data-testid="button-save-draft">
              <Save className="h-4 w-4 mr-2" />
              Save Draft
            </Button>
          </div>
        </div>

        <Progress value={progressPercent} className="h-2" data-testid="progress-bar" />

        <div className="flex justify-between mt-4 overflow-x-auto">
          {STEPS.map((step) => {
            const isCompleted = wizardState.completedSteps.has(step.number);
            const isCurrent = wizardState.currentStep === step.number;
            const isClickable = step.number < wizardState.currentStep || 
                               wizardState.completedSteps.has(step.number - 1) || 
                               step.number === 1;

            return (
              <button
                key={step.number}
                onClick={() => isClickable && goToStep(step.number)}
                disabled={!isClickable}
                className={`flex flex-col items-center min-w-[100px] p-2 rounded-lg transition-colors ${
                  isCurrent 
                    ? 'bg-primary/10' 
                    : isClickable 
                      ? 'hover:bg-muted/50 cursor-pointer' 
                      : 'opacity-50 cursor-not-allowed'
                }`}
                data-testid={`step-${step.number}`}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-1 ${
                  isCompleted 
                    ? 'bg-green-500 text-white' 
                    : isCurrent 
                      ? 'bg-primary text-primary-foreground' 
                      : 'bg-muted text-muted-foreground'
                }`}>
                  {isCompleted ? (
                    <Check className="h-5 w-5" />
                  ) : (
                    <step.icon className="h-5 w-5" />
                  )}
                </div>
                <span className={`text-xs font-medium ${
                  isCurrent ? 'text-primary' : 'text-muted-foreground'
                }`}>
                  {step.title}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {renderStepContent()}
      </div>

      <div className="border-t p-4 flex justify-between">
        <Button
          variant="outline"
          onClick={prevStep}
          disabled={wizardState.currentStep === 1}
          data-testid="button-prev"
        >
          <ChevronLeft className="h-4 w-4 mr-2" />
          Back
        </Button>

        <div className="flex items-center gap-4">
          <Badge variant="outline">
            {wizardState.completedSteps.size} of 7 steps completed
          </Badge>
          
          {wizardState.currentStep < 7 ? (
            <Button onClick={nextStep} data-testid="button-next">
              Next
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button onClick={() => {}} data-testid="button-finish">
              Finish
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function FormField({ 
  label, 
  required, 
  error, 
  children 
}: { 
  label: string; 
  required?: boolean; 
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium">
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </label>
      {children}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

function StepContent({ 
  title, 
  description, 
  children 
}: { 
  title: string; 
  description: string; 
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function ReviewSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">{title}</h4>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function ReviewItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-muted-foreground">{label}:</span>
      <span className="font-medium">{value || '-'}</span>
    </div>
  );
}

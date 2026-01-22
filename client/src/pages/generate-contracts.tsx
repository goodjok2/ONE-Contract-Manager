import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
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
  ClipboardCheck,
  RefreshCw,
  Plus,
  Minus,
  AlertTriangle,
  HelpCircle,
  Loader2,
  Settings2,
  ArrowRightLeft,
  UserCheck,
  Wrench,
  X
} from "lucide-react";

// US States for dropdown
const US_STATES = [
  { value: 'AL', label: 'Alabama' }, { value: 'AK', label: 'Alaska' },
  { value: 'AZ', label: 'Arizona' }, { value: 'AR', label: 'Arkansas' },
  { value: 'CA', label: 'California' }, { value: 'CO', label: 'Colorado' },
  { value: 'CT', label: 'Connecticut' }, { value: 'DE', label: 'Delaware' },
  { value: 'FL', label: 'Florida' }, { value: 'GA', label: 'Georgia' },
  { value: 'HI', label: 'Hawaii' }, { value: 'ID', label: 'Idaho' },
  { value: 'IL', label: 'Illinois' }, { value: 'IN', label: 'Indiana' },
  { value: 'IA', label: 'Iowa' }, { value: 'KS', label: 'Kansas' },
  { value: 'KY', label: 'Kentucky' }, { value: 'LA', label: 'Louisiana' },
  { value: 'ME', label: 'Maine' }, { value: 'MD', label: 'Maryland' },
  { value: 'MA', label: 'Massachusetts' }, { value: 'MI', label: 'Michigan' },
  { value: 'MN', label: 'Minnesota' }, { value: 'MS', label: 'Mississippi' },
  { value: 'MO', label: 'Missouri' }, { value: 'MT', label: 'Montana' },
  { value: 'NE', label: 'Nebraska' }, { value: 'NV', label: 'Nevada' },
  { value: 'NH', label: 'New Hampshire' }, { value: 'NJ', label: 'New Jersey' },
  { value: 'NM', label: 'New Mexico' }, { value: 'NY', label: 'New York' },
  { value: 'NC', label: 'North Carolina' }, { value: 'ND', label: 'North Dakota' },
  { value: 'OH', label: 'Ohio' }, { value: 'OK', label: 'Oklahoma' },
  { value: 'OR', label: 'Oregon' }, { value: 'PA', label: 'Pennsylvania' },
  { value: 'RI', label: 'Rhode Island' }, { value: 'SC', label: 'South Carolina' },
  { value: 'SD', label: 'South Dakota' }, { value: 'TN', label: 'Tennessee' },
  { value: 'TX', label: 'Texas' }, { value: 'UT', label: 'Utah' },
  { value: 'VT', label: 'Vermont' }, { value: 'VA', label: 'Virginia' },
  { value: 'WA', label: 'Washington' }, { value: 'WV', label: 'West Virginia' },
  { value: 'WI', label: 'Wisconsin' }, { value: 'WY', label: 'Wyoming' },
  { value: 'DC', label: 'District of Columbia' }
];

// Client entity types
const ENTITY_TYPES = [
  { value: 'Individual', label: 'Individual' },
  { value: 'LLC', label: 'Limited Liability Company (LLC)' },
  { value: 'Corporation', label: 'Corporation' },
  { value: 'Partnership', label: 'Partnership' },
  { value: 'Trust', label: 'Trust' }
];

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
    clientFullName: string;
    clientTitle: string;
    clientAddress: string;
    clientCity: string;
    clientZip: string;
    clientSignerName: string;
    clientSignerTitle: string;
    clientEmail: string;
    clientPhone: string;
    llcOption: 'new' | 'existing';
    selectedExistingLlcId: string;
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
  { number: 2, title: "Service Model", description: "CRC or CMOS selection", icon: Settings2 },
  { number: 3, title: "Party Info", description: "Client & SPV details", icon: Users },
  { number: 4, title: "Child LLC", description: "LLC entity setup", icon: Building2 },
  { number: 5, title: "Site & Home", description: "Property details", icon: Home },
  { number: 6, title: "Dates & Schedule", description: "Timeline", icon: Calendar },
  { number: 7, title: "Pricing", description: "Financial terms", icon: DollarSign },
  { number: 8, title: "Review & Generate", description: "Final review", icon: ClipboardCheck },
];

const initialProjectData: WizardState['projectData'] = {
  projectNumber: '',
  projectName: '',
  totalUnits: 1,
  agreementDate: new Date().toISOString().split('T')[0],
  serviceModel: 'CRC',
  clientLegalName: '',
  clientState: '',
  clientEntityType: 'Individual',
  clientFullName: '',
  clientTitle: '',
  clientAddress: '',
  clientCity: '',
  clientZip: '',
  clientSignerName: '',
  clientSignerTitle: '',
  clientEmail: '',
  clientPhone: '',
  llcOption: 'new',
  selectedExistingLlcId: '',
  childLlcName: '',
  childLlcState: 'DE',
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
  const queryClient = useQueryClient();
  const [draftProjectId, setDraftProjectId] = useState<number | null>(null);
  const [isCheckingNumber, setIsCheckingNumber] = useState(false);
  const [numberIsUnique, setNumberIsUnique] = useState<boolean | null>(null);
  const [showComparisonModal, setShowComparisonModal] = useState(false);
  
  const [wizardState, setWizardState] = useState<WizardState>({
    currentStep: 1,
    projectData: initialProjectData,
    completedSteps: new Set<number>(),
    validationErrors: {},
  });

  // Fetch next project number on mount
  const { data: nextNumberData, refetch: refetchNextNumber, isLoading: isLoadingNumber } = useQuery<{ projectNumber: string }>({
    queryKey: ['/api/projects/next-number'],
    staleTime: 0,
  });

  // Auto-populate project number on first load
  useEffect(() => {
    if (nextNumberData?.projectNumber && !wizardState.projectData.projectNumber) {
      setWizardState(prev => ({
        ...prev,
        projectData: { ...prev.projectData, projectNumber: nextNumberData.projectNumber },
      }));
      setNumberIsUnique(true);
    }
  }, [nextNumberData]);

  // Check project number uniqueness when it changes
  const checkProjectNumberUniqueness = useCallback(async (projectNumber: string) => {
    if (!projectNumber || projectNumber.length < 4) {
      setNumberIsUnique(null);
      return;
    }
    
    setIsCheckingNumber(true);
    try {
      const response = await fetch(`/api/projects/check-number/${encodeURIComponent(projectNumber)}`);
      const data = await response.json();
      setNumberIsUnique(data.isUnique);
    } catch (error) {
      console.error('Failed to check project number:', error);
      setNumberIsUnique(null);
    } finally {
      setIsCheckingNumber(false);
    }
  }, []);

  // Create draft project mutation
  const createDraftProjectMutation = useMutation({
    mutationFn: async (projectData: { projectNumber: string; name: string; status: string; onSiteSelection: string }) => {
      const response = await apiRequest('POST', '/api/projects', projectData);
      return response.json();
    },
    onSuccess: (data) => {
      setDraftProjectId(data.id);
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
    },
  });

  // Update project mutation
  const updateProjectMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: number; [key: string]: any }) => {
      const response = await apiRequest('PATCH', `/api/projects/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
    },
  });

  // Create project details mutation
  const createProjectDetailsMutation = useMutation({
    mutationFn: async (data: { projectId: number; totalUnits: number; agreementExecutionDate: string }) => {
      const response = await apiRequest('POST', `/api/projects/${data.projectId}/details`, data);
      return response.json();
    },
  });

  // Fetch clause comparison data for CRC vs CMOS
  interface ClauseComparison {
    totalClauses: number;
    crcOnly: number;
    cmosOnly: number;
    shared: number;
    differences: Array<{
      clauseNumber: string;
      clauseName: string;
      appliesTo: 'CRC' | 'CMOS' | 'BOTH';
      contentDiffers?: boolean;
    }>;
  }

  const { data: comparisonData, isLoading: comparisonLoading } = useQuery<ClauseComparison>({
    queryKey: ['/api/contracts/compare-service-models'],
    queryFn: async () => {
      const response = await fetch('/api/contracts/compare-service-models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectData: { serviceModel: 'CRC' } }),
      });
      if (!response.ok) throw new Error('Failed to compare service models');
      return response.json();
    },
    enabled: showComparisonModal || wizardState.currentStep === 2,
    staleTime: 60000,
  });

  // Fetch existing LLCs for dropdown in Step 3
  const { data: existingLlcs } = useQuery<Array<{
    id: number;
    name: string;
    status: string;
    state_of_formation: string;
    ein_number: string;
    formation_date: string;
  }>>({
    queryKey: ['/api/llcs'],
    enabled: wizardState.currentStep === 3,
  });

  const regenerateProjectNumber = useCallback(async () => {
    const result = await refetchNextNumber();
    if (result.data?.projectNumber) {
      setWizardState(prev => ({
        ...prev,
        projectData: { ...prev.projectData, projectNumber: result.data.projectNumber },
        validationErrors: { ...prev.validationErrors, projectNumber: '' },
      }));
      setNumberIsUnique(true);
    }
  }, [refetchNextNumber]);

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
        if (!data.projectNumber.trim()) {
          errors.projectNumber = 'Project number is required';
        } else if (!/^\d{4}-\d{3}$/.test(data.projectNumber)) {
          errors.projectNumber = 'Project number must be in format YYYY-### (e.g., 2026-001)';
        } else if (numberIsUnique === false) {
          errors.projectNumber = 'This project number already exists';
        }
        if (!data.projectName.trim()) {
          errors.projectName = 'Project name is required';
        } else if (data.projectName.trim().length < 3) {
          errors.projectName = 'Project name must be at least 3 characters';
        } else if (data.projectName.trim().length > 100) {
          errors.projectName = 'Project name must be 100 characters or less';
        }
        if (data.totalUnits < 1 || data.totalUnits > 50) {
          errors.totalUnits = 'Total units must be between 1 and 50';
        }
        if (!data.agreementDate) {
          errors.agreementDate = 'Agreement date is required';
        }
        break;
      case 2:
        if (!data.serviceModel) errors.serviceModel = 'Service model is required';
        break;
      case 3:
        if (!data.clientLegalName.trim()) errors.clientLegalName = 'Client legal name is required';
        if (data.clientLegalName.trim().length < 2) errors.clientLegalName = 'Client legal name must be at least 2 characters';
        if (!data.clientState) errors.clientState = 'Client state is required';
        if (!data.clientEntityType) errors.clientEntityType = 'Client entity type is required';
        if (data.llcOption === 'existing' && !data.selectedExistingLlcId) {
          errors.selectedExistingLlcId = 'Please select an existing LLC';
        }
        break;
      case 4:
        if (!data.childLlcName.trim()) errors.childLlcName = 'LLC name is required';
        break;
      case 5:
        if (!data.siteAddress.trim()) errors.siteAddress = 'Site address is required';
        if (!data.siteState.trim()) errors.siteState = 'Site state is required';
        break;
      case 6:
        if (!data.effectiveDate) errors.effectiveDate = 'Effective date is required';
        break;
      case 7:
        if (data.contractPrice <= 0) errors.contractPrice = 'Contract price must be greater than 0';
        break;
      case 8:
        break;
    }

    return { valid: Object.keys(errors).length === 0, errors };
  }, [wizardState.projectData, numberIsUnique]);

  const nextStep = useCallback(async () => {
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

    // Step 1: Create or update draft project in database
    if (wizardState.currentStep === 1) {
      try {
        if (!draftProjectId) {
          // Create new draft project
          await createDraftProjectMutation.mutateAsync({
            projectNumber: wizardState.projectData.projectNumber,
            name: wizardState.projectData.projectName,
            status: 'Draft',
            onSiteSelection: wizardState.projectData.serviceModel,
          });
        } else {
          // Update existing draft
          await updateProjectMutation.mutateAsync({
            id: draftProjectId,
            projectNumber: wizardState.projectData.projectNumber,
            name: wizardState.projectData.projectName,
            onSiteSelection: wizardState.projectData.serviceModel,
          });
        }
      } catch (error) {
        console.error('Failed to save project:', error);
        toast({
          title: "Error",
          description: "Failed to save project. Please try again.",
          variant: "destructive",
        });
        return;
      }
    }

    setWizardState(prev => {
      const newCompletedSteps = new Set(Array.from(prev.completedSteps));
      newCompletedSteps.add(prev.currentStep);
      return {
        ...prev,
        currentStep: Math.min(prev.currentStep + 1, 8),
        completedSteps: newCompletedSteps,
        validationErrors: {},
      };
    });
  }, [wizardState.currentStep, wizardState.projectData, validateStep, toast, draftProjectId, createDraftProjectMutation, updateProjectMutation]);

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

  const progressPercent = ((wizardState.currentStep - 1) / (STEPS.length - 1)) * 100;

  const renderStepContent = () => {
    const { currentStep, projectData, validationErrors } = wizardState;

    switch (currentStep) {
      case 1: {
        const today = new Date().toISOString().split('T')[0];
        const isDateInPast = projectData.agreementDate && projectData.agreementDate < today;
        
        return (
          <StepContent
            title="Project Information"
            description="Enter the basic project details"
          >
            <div className="grid gap-6">
              {/* Project Number */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label className="text-sm font-medium">
                    Project Number <span className="text-destructive">*</span>
                  </Label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Format: YYYY-### (e.g., 2026-001)</p>
                      <p>Auto-generated based on current year and next available number.</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      type="text"
                      placeholder="e.g., 2026-001"
                      value={projectData.projectNumber}
                      onChange={(e) => {
                        updateProjectData({ projectNumber: e.target.value });
                        checkProjectNumberUniqueness(e.target.value);
                      }}
                      className={validationErrors.projectNumber ? 'border-destructive' : ''}
                      data-testid="input-project-number"
                    />
                    {isCheckingNumber && (
                      <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                    {!isCheckingNumber && numberIsUnique === true && projectData.projectNumber && (
                      <Check className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />
                    )}
                    {!isCheckingNumber && numberIsUnique === false && (
                      <AlertTriangle className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-destructive" />
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={regenerateProjectNumber}
                    disabled={isLoadingNumber}
                    data-testid="button-regenerate-number"
                  >
                    <RefreshCw className={`h-4 w-4 ${isLoadingNumber ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
                {validationErrors.projectNumber && (
                  <p className="text-sm text-destructive">{validationErrors.projectNumber}</p>
                )}
                {numberIsUnique === false && !validationErrors.projectNumber && (
                  <p className="text-sm text-destructive">This project number already exists. Please use a different number.</p>
                )}
              </div>

              {/* Project Name */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label className="text-sm font-medium">
                    Project Name <span className="text-destructive">*</span>
                  </Label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>A descriptive name for this project (3-100 characters).</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Input
                  type="text"
                  placeholder="e.g., Smith Residence"
                  value={projectData.projectName}
                  onChange={(e) => updateProjectData({ projectName: e.target.value })}
                  className={validationErrors.projectName ? 'border-destructive' : ''}
                  maxLength={100}
                  data-testid="input-project-name"
                />
                <div className="flex justify-between">
                  {validationErrors.projectName ? (
                    <p className="text-sm text-destructive">{validationErrors.projectName}</p>
                  ) : (
                    <span />
                  )}
                  <p className="text-xs text-muted-foreground">
                    {projectData.projectName.length}/100
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                {/* Total Units */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label className="text-sm font-medium">
                      Total Units <span className="text-destructive">*</span>
                    </Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Number of home units in this project (1-50).</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => updateProjectData({ totalUnits: Math.max(1, projectData.totalUnits - 1) })}
                      disabled={projectData.totalUnits <= 1}
                      data-testid="button-units-minus"
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <Input
                      type="number"
                      min="1"
                      max="50"
                      className={`text-center w-20 ${validationErrors.totalUnits ? 'border-destructive' : ''}`}
                      value={projectData.totalUnits}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 1;
                        updateProjectData({ totalUnits: Math.min(50, Math.max(1, val)) });
                      }}
                      data-testid="input-total-units"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => updateProjectData({ totalUnits: Math.min(50, projectData.totalUnits + 1) })}
                      disabled={projectData.totalUnits >= 50}
                      data-testid="button-units-plus"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  {validationErrors.totalUnits && (
                    <p className="text-sm text-destructive">{validationErrors.totalUnits}</p>
                  )}
                  {projectData.totalUnits > 10 && (
                    <div className="flex items-center gap-2 p-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md">
                      <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-500 flex-shrink-0" />
                      <p className="text-sm text-amber-700 dark:text-amber-400">
                        Multi-unit project will use extended exhibits
                      </p>
                    </div>
                  )}
                </div>

                {/* Agreement Date */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label className="text-sm font-medium">
                      Agreement Execution Date <span className="text-destructive">*</span>
                    </Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Date when the contract will be signed.</p>
                        <p>Also sets the Effective Date to the same value.</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Input
                    type="date"
                    value={projectData.agreementDate}
                    onChange={(e) => updateProjectData({ 
                      agreementDate: e.target.value,
                      effectiveDate: e.target.value 
                    })}
                    className={validationErrors.agreementDate ? 'border-destructive' : ''}
                    data-testid="input-agreement-date"
                  />
                  {validationErrors.agreementDate && (
                    <p className="text-sm text-destructive">{validationErrors.agreementDate}</p>
                  )}
                  {isDateInPast && !validationErrors.agreementDate && (
                    <div className="flex items-center gap-2 p-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md">
                      <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-500 flex-shrink-0" />
                      <p className="text-sm text-amber-700 dark:text-amber-400">
                        Selected date is in the past
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </StepContent>
        );
      }

      case 2: {
        // Calculate impact numbers based on comparison data
        const clauseImpact = comparisonData ? {
          crcOnly: comparisonData.crcOnly || 0,
          cmosOnly: comparisonData.cmosOnly || 0,
          total: comparisonData.totalClauses || 0,
        } : { crcOnly: 0, cmosOnly: 0, total: 0 };

        return (
          <StepContent
            title="Service Model Selection"
            description="Choose how on-site construction services will be managed"
          >
            <div className="space-y-6">
              {/* Service Model Selection Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* CRC Option */}
                <div
                  onClick={() => updateProjectData({ serviceModel: 'CRC' })}
                  className={`relative p-6 border-2 rounded-lg cursor-pointer transition-all hover-elevate ${
                    projectData.serviceModel === 'CRC' 
                      ? 'border-primary bg-primary/5 ring-2 ring-primary/20' 
                      : 'border-muted hover:border-muted-foreground/30'
                  }`}
                  data-testid="card-service-crc"
                >
                  {projectData.serviceModel === 'CRC' && (
                    <div className="absolute top-3 right-3">
                      <Check className="h-5 w-5 text-primary" />
                    </div>
                  )}
                  
                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                      <UserCheck className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-lg">Client Retains General Contractor</h3>
                      </div>
                      <Badge variant="outline" className="mb-3">Client Managed</Badge>
                      <p className="text-sm text-muted-foreground">
                        Client hires their own licensed GC for on-site work
                      </p>
                    </div>
                  </div>

                  {/* Impact Preview for CRC */}
                  <div className={`mt-4 p-3 rounded-md border ${
                    projectData.serviceModel === 'CRC' 
                      ? 'bg-primary/5 border-primary/20' 
                      : 'bg-muted/30 border-transparent'
                  }`}>
                    <p className="text-xs font-medium text-muted-foreground uppercase mb-2">What this means</p>
                    <ul className="space-y-1 text-sm">
                      <li className="flex items-center gap-2">
                        <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                        <span>Affects {clauseImpact.crcOnly} unique clauses</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                        <span>Client responsible for GC selection</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                        <span>On-site costs excluded from price</span>
                      </li>
                    </ul>
                  </div>
                </div>

                {/* CMOS Option */}
                <div
                  onClick={() => updateProjectData({ serviceModel: 'CMOS' })}
                  className={`relative p-6 border-2 rounded-lg cursor-pointer transition-all hover-elevate ${
                    projectData.serviceModel === 'CMOS' 
                      ? 'border-primary bg-primary/5 ring-2 ring-primary/20' 
                      : 'border-muted hover:border-muted-foreground/30'
                  }`}
                  data-testid="card-service-cmos"
                >
                  {projectData.serviceModel === 'CMOS' && (
                    <div className="absolute top-3 right-3">
                      <Check className="h-5 w-5 text-primary" />
                    </div>
                  )}
                  
                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-lg bg-green-100 dark:bg-green-900/30">
                      <Wrench className="h-6 w-6 text-green-600 dark:text-green-400" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-lg">Company Manages On-Site Services</h3>
                      </div>
                      <Badge variant="outline" className="mb-3">Turnkey</Badge>
                      <p className="text-sm text-muted-foreground">
                        Dvele coordinates all on-site contractors
                      </p>
                    </div>
                  </div>

                  {/* Impact Preview for CMOS */}
                  <div className={`mt-4 p-3 rounded-md border ${
                    projectData.serviceModel === 'CMOS' 
                      ? 'bg-primary/5 border-primary/20' 
                      : 'bg-muted/30 border-transparent'
                  }`}>
                    <p className="text-xs font-medium text-muted-foreground uppercase mb-2">What this means</p>
                    <ul className="space-y-1 text-sm">
                      <li className="flex items-center gap-2">
                        <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
                        <span>Affects {clauseImpact.cmosOnly} unique clauses</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
                        <span>Dvele handles all coordination</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
                        <span>On-site costs included in price</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Conditional Message */}
              {projectData.serviceModel && (
                <div className={`p-4 rounded-lg border ${
                  projectData.serviceModel === 'CRC'
                    ? 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800'
                    : 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800'
                }`}>
                  {projectData.serviceModel === 'CRC' ? (
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-medium text-blue-800 dark:text-blue-200">
                          Client-Retained Contractor Selected
                        </p>
                        <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                          You will need to provide contractor information in the next section. 
                          The contract variable ON_SITE_SERVICES_SELECTION will be set to "CLIENT-RETAINED CONTRACTOR".
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-3">
                      <Check className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-medium text-green-800 dark:text-green-200">
                          Company-Managed On-Site Services Selected
                        </p>
                        <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                          Dvele will coordinate all on-site work. 
                          The contract variable ON_SITE_SERVICES_SELECTION will be set to "COMPANY-MANAGED ON-SITE SERVICES".
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Compare Button */}
              <div className="flex justify-center pt-4">
                <Button 
                  variant="outline" 
                  onClick={() => setShowComparisonModal(true)}
                  className="gap-2"
                  data-testid="button-compare-models"
                >
                  <ArrowRightLeft className="h-4 w-4" />
                  Compare CRC vs CMOS
                </Button>
              </div>

              {validationErrors.serviceModel && (
                <p className="text-sm text-destructive text-center">{validationErrors.serviceModel}</p>
              )}
            </div>
          </StepContent>
        );
      }

      case 3: {
        // Helper function to extract last name from client legal name
        const extractLastName = (name: string): string => {
          const trimmed = name.trim();
          if (!trimmed) return '';
          // Handle "John and Jane Smith" pattern
          const andPattern = /\band\b\s+(\w+)\s+(\w+)$/i;
          const andMatch = trimmed.match(andPattern);
          if (andMatch) return andMatch[2];
          // Handle simple "First Last" pattern
          const parts = trimmed.split(/\s+/);
          return parts[parts.length - 1];
        };

        // Generate LLC name from client last name
        const lastName = extractLastName(projectData.clientLegalName);
        const generatedLlcName = lastName ? `Dvele Partners ${lastName} LLC` : 'Dvele Partners [LastName] LLC';

        // Find selected existing LLC
        const selectedLlc = existingLlcs?.find((llc: any) => llc.id.toString() === projectData.selectedExistingLlcId);

        // Auto-update child LLC name when client name changes (for new LLC option)
        // Only auto-fill clientFullName if it's empty or matches the previous clientLegalName
        const handleClientNameChange = (value: string) => {
          const newLastName = extractLastName(value);
          const newLlcName = newLastName ? `Dvele Partners ${newLastName} LLC` : '';
          const updates: Partial<WizardState['projectData']> = { 
            clientLegalName: value,
            childLlcName: projectData.llcOption === 'new' ? newLlcName : projectData.childLlcName
          };
          // Only auto-set clientFullName if it's empty
          if (!projectData.clientFullName) {
            updates.clientFullName = value;
          }
          updateProjectData(updates);
        };

        // Loading state for existing LLCs
        const llcsLoading = projectData.llcOption === 'existing' && !existingLlcs;

        return (
          <StepContent
            title="Party Information"
            description="Enter client details and configure the project SPV/LLC"
          >
            <div className="space-y-8">
              {/* Client Information Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 border-b pb-2">
                  <Users className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold text-lg">Client Information</h3>
                </div>

                <FormField
                  label="Client Legal Name"
                  required
                  error={validationErrors.clientLegalName}
                >
                  <Input
                    type="text"
                    className="w-full"
                    placeholder="e.g., John and Jane Smith"
                    value={projectData.clientLegalName}
                    onChange={(e) => handleClientNameChange(e.target.value)}
                    data-testid="input-client-legal-name"
                  />
                </FormField>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    label="Client State"
                    required
                    error={validationErrors.clientState}
                  >
                    <select
                      className="w-full px-3 py-2 border rounded-md bg-background"
                      value={projectData.clientState}
                      onChange={(e) => updateProjectData({ 
                        clientState: e.target.value,
                        siteState: e.target.value // Auto-populate project state
                      })}
                      data-testid="select-client-state"
                    >
                      <option value="">Select a state...</option>
                      {US_STATES.map(state => (
                        <option key={state.value} value={state.value}>{state.label}</option>
                      ))}
                    </select>
                  </FormField>

                  <FormField
                    label="Client Entity Type"
                    required
                    error={validationErrors.clientEntityType}
                  >
                    <select
                      className="w-full px-3 py-2 border rounded-md bg-background"
                      value={projectData.clientEntityType}
                      onChange={(e) => updateProjectData({ clientEntityType: e.target.value })}
                      data-testid="select-client-entity-type"
                    >
                      {ENTITY_TYPES.map(type => (
                        <option key={type.value} value={type.value}>{type.label}</option>
                      ))}
                    </select>
                  </FormField>
                </div>

                <FormField label="Client Full Name (for signature)">
                  <Input
                    type="text"
                    className="w-full"
                    placeholder="Defaults to Client Legal Name"
                    value={projectData.clientFullName}
                    onChange={(e) => updateProjectData({ clientFullName: e.target.value })}
                    data-testid="input-client-full-name"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Used for: CLIENT_FULL_NAME variable
                  </p>
                </FormField>

                {/* Conditional Title field - only show if not Individual */}
                {projectData.clientEntityType !== 'Individual' && (
                  <FormField label="Client Title">
                    <Input
                      type="text"
                      className="w-full"
                      placeholder={projectData.clientEntityType === 'LLC' ? 'e.g., Managing Member' : 
                                   projectData.clientEntityType === 'Corporation' ? 'e.g., President, CEO' :
                                   projectData.clientEntityType === 'Trust' ? 'e.g., Trustee' : 'e.g., Partner'}
                      value={projectData.clientTitle}
                      onChange={(e) => updateProjectData({ clientTitle: e.target.value })}
                      data-testid="input-client-title"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Used for: CLIENT_TITLE variable
                    </p>
                  </FormField>
                )}
              </div>

              {/* SPV/LLC Information Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 border-b pb-2">
                  <Building2 className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold text-lg">SPV/LLC Information</h3>
                </div>

                {/* LLC Option Radio Choice */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium">LLC Creation Option</Label>
                  
                  <div className="grid grid-cols-1 gap-3">
                    {/* Create New LLC Option */}
                    <div
                      className={`relative flex items-start p-4 border rounded-lg cursor-pointer transition-colors ${
                        projectData.llcOption === 'new' 
                          ? 'border-primary bg-primary/5' 
                          : 'border-border hover:border-primary/50'
                      }`}
                      onClick={() => {
                        const newLlcName = lastName ? `Dvele Partners ${lastName} LLC` : '';
                        updateProjectData({ 
                          llcOption: 'new', 
                          selectedExistingLlcId: '',
                          childLlcName: newLlcName,
                          childLlcState: 'DE'
                        });
                      }}
                      data-testid="radio-llc-new"
                    >
                      <div className={`w-4 h-4 rounded-full border-2 mr-3 mt-0.5 flex items-center justify-center ${
                        projectData.llcOption === 'new' ? 'border-primary' : 'border-muted-foreground'
                      }`}>
                        {projectData.llcOption === 'new' && (
                          <div className="w-2 h-2 rounded-full bg-primary" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">Create New Project LLC</span>
                          <Badge variant="secondary" className="text-xs">Recommended</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          A new LLC will be created for this project
                        </p>
                        
                        {projectData.llcOption === 'new' && (
                          <div className="mt-3 p-3 bg-muted/50 rounded-md space-y-3">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">Auto-Generated Name:</span>
                              <Badge variant="outline">{generatedLlcName}</Badge>
                            </div>
                            
                            <FormField label="Formation State">
                              <select
                                className="w-full px-3 py-2 border rounded-md bg-background"
                                value={projectData.childLlcState}
                                onChange={(e) => updateProjectData({ childLlcState: e.target.value })}
                                data-testid="select-llc-formation-state"
                              >
                                {US_STATES.map(state => (
                                  <option key={state.value} value={state.value}>{state.label}</option>
                                ))}
                              </select>
                            </FormField>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Use Existing LLC Option */}
                    <div
                      className={`relative flex items-start p-4 border rounded-lg cursor-pointer transition-colors ${
                        projectData.llcOption === 'existing' 
                          ? 'border-primary bg-primary/5' 
                          : 'border-border hover:border-primary/50'
                      }`}
                      onClick={() => updateProjectData({ llcOption: 'existing' })}
                      data-testid="radio-llc-existing"
                    >
                      <div className={`w-4 h-4 rounded-full border-2 mr-3 mt-0.5 flex items-center justify-center ${
                        projectData.llcOption === 'existing' ? 'border-primary' : 'border-muted-foreground'
                      }`}>
                        {projectData.llcOption === 'existing' && (
                          <div className="w-2 h-2 rounded-full bg-primary" />
                        )}
                      </div>
                      <div className="flex-1">
                        <span className="font-medium">Use Existing LLC</span>
                        <p className="text-sm text-muted-foreground mt-1">
                          Select from previously created LLCs in the system
                        </p>
                        
                        {projectData.llcOption === 'existing' && (
                          <div className="mt-3 space-y-3">
                            {llcsLoading ? (
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                <span>Loading existing LLCs...</span>
                              </div>
                            ) : (
                              <>
                                <FormField
                                  label="Select LLC"
                                  required
                                  error={validationErrors.selectedExistingLlcId}
                                >
                                  <select
                                    className="w-full px-3 py-2 border rounded-md bg-background"
                                    value={projectData.selectedExistingLlcId}
                                    onChange={(e) => {
                                      const llc = existingLlcs?.find((l: any) => l.id.toString() === e.target.value);
                                      updateProjectData({ 
                                        selectedExistingLlcId: e.target.value,
                                        childLlcName: llc?.name || '',
                                        childLlcState: llc?.state_of_formation || 'DE',
                                        childLlcEin: llc?.ein_number || ''
                                      });
                                    }}
                                    data-testid="select-existing-llc"
                                  >
                                    <option value="">Select an LLC...</option>
                                    {existingLlcs?.map((llc: any) => (
                                      <option key={llc.id} value={llc.id.toString()}>
                                        {llc.name}
                                      </option>
                                    ))}
                                  </select>
                                </FormField>

                                {selectedLlc && (
                                  <div className="p-3 bg-muted/50 rounded-md" data-testid="llc-details-panel">
                                    <p className="text-sm font-medium mb-2">LLC Details</p>
                                    <div className="grid grid-cols-2 gap-2 text-sm">
                                      <div>
                                        <span className="text-muted-foreground">State:</span>{' '}
                                        <span data-testid="text-llc-state">{selectedLlc.state_of_formation || 'N/A'}</span>
                                      </div>
                                      <div>
                                        <span className="text-muted-foreground">EIN:</span>{' '}
                                        <span data-testid="text-llc-ein">{selectedLlc.ein_number || 'Pending'}</span>
                                      </div>
                                      <div>
                                        <span className="text-muted-foreground">Status:</span>{' '}
                                        <Badge variant={selectedLlc.status === 'active' ? 'default' : 'secondary'} data-testid="badge-llc-status">
                                          {selectedLlc.status}
                                        </Badge>
                                      </div>
                                      <div>
                                        <span className="text-muted-foreground">Formed:</span>{' '}
                                        <span data-testid="text-llc-formed">{selectedLlc.formation_date || 'N/A'}</span>
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {existingLlcs?.length === 0 && (
                                  <p className="text-sm text-muted-foreground italic" data-testid="text-no-llcs">
                                    No existing LLCs found. Please create a new LLC instead.
                                  </p>
                                )}
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* SPV Details Display */}
                <div className="mt-4 p-4 border rounded-lg bg-muted/30" data-testid="panel-variable-preview">
                  <p className="text-sm font-medium mb-3">Calculated Variable Values</p>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-muted-foreground">DVELE_PARTNERS_XYZ:</span>
                      <p className="font-mono text-xs mt-1" data-testid="text-var-dvele-partners">
                        {lastName ? `Dvele Partners ${lastName}` : '[awaiting client name]'}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">DVELE_PARTNERS_XYZ_LEGAL_NAME:</span>
                      <p className="font-mono text-xs mt-1" data-testid="text-var-dvele-partners-legal">
                        {projectData.llcOption === 'existing' && selectedLlc 
                          ? selectedLlc.name 
                          : generatedLlcName}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">DVELE_PARTNERS_XYZ_STATE:</span>
                      <p className="font-mono text-xs mt-1" data-testid="text-var-dvele-partners-state">
                        {projectData.llcOption === 'existing' && selectedLlc
                          ? selectedLlc.state_of_formation
                          : US_STATES.find(s => s.value === projectData.childLlcState)?.label || projectData.childLlcState}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">DVELE_PARTNERS_XYZ_ENTITY_TYPE:</span>
                      <p className="font-mono text-xs mt-1" data-testid="text-var-entity-type">limited liability company</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </StepContent>
        );
      }

      case 4:
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

      case 5:
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

      case 6:
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

      case 7:
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

      case 8:
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
            {wizardState.completedSteps.size} of 8 steps completed
          </Badge>
          
          {wizardState.currentStep < 8 ? (
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

      {/* CRC vs CMOS Comparison Modal */}
      <Dialog open={showComparisonModal} onOpenChange={setShowComparisonModal}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5" />
              CRC vs CMOS Comparison
            </DialogTitle>
            <DialogDescription>
              Understanding the differences between service models
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 mt-4">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <UserCheck className="h-5 w-5 text-blue-600" />
                    CRC - Client Retained Contractor
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                      <span>Client selects and manages their own GC</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                      <span>More control over on-site construction</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                      <span>On-site costs billed separately</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                      <span>Client responsible for coordination</span>
                    </li>
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Wrench className="h-5 w-5 text-green-600" />
                    CMOS - Company Managed On-Site
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                      <span>Dvele manages all on-site contractors</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                      <span>Turnkey solution with single point of contact</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                      <span>All costs included in contract price</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                      <span>Simplified project management</span>
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </div>

            {/* Clause Impact Summary */}
            {comparisonLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin mr-2" />
                <span>Loading comparison data...</span>
              </div>
            ) : comparisonData ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Clause Impact Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                      <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                        {comparisonData.crcOnly || 0}
                      </p>
                      <p className="text-sm text-muted-foreground">CRC-Only Clauses</p>
                    </div>
                    <div className="p-4 bg-green-50 dark:bg-green-950/30 rounded-lg">
                      <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                        {comparisonData.cmosOnly || 0}
                      </p>
                      <p className="text-sm text-muted-foreground">CMOS-Only Clauses</p>
                    </div>
                    <div className="p-4 bg-muted/30 rounded-lg">
                      <p className="text-2xl font-bold">
                        {comparisonData.shared || 0}
                      </p>
                      <p className="text-sm text-muted-foreground">Shared Clauses</p>
                    </div>
                  </div>

                  {comparisonData.differences && comparisonData.differences.length > 0 && (
                    <div className="mt-4">
                      <h4 className="font-medium mb-2">Key Differences</h4>
                      <div className="max-h-48 overflow-y-auto border rounded-lg">
                        <table className="w-full text-sm">
                          <thead className="bg-muted/50 sticky top-0">
                            <tr>
                              <th className="text-left p-2">Clause</th>
                              <th className="text-left p-2">Applies To</th>
                            </tr>
                          </thead>
                          <tbody>
                            {comparisonData.differences.slice(0, 10).map((diff, idx) => (
                              <tr key={idx} className="border-t">
                                <td className="p-2">{diff.clauseName || diff.clauseNumber}</td>
                                <td className="p-2">
                                  <Badge variant="outline" className={
                                    diff.appliesTo === 'CRC' 
                                      ? 'border-blue-500 text-blue-600' 
                                      : diff.appliesTo === 'CMOS'
                                        ? 'border-green-500 text-green-600'
                                        : ''
                                  }>
                                    {diff.appliesTo}
                                  </Badge>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {comparisonData.differences.length > 10 && (
                        <p className="text-xs text-muted-foreground mt-2 text-center">
                          Showing 10 of {comparisonData.differences.length} differences
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : null}

            <div className="flex justify-end">
              <Button 
                variant="outline" 
                onClick={() => setShowComparisonModal(false)}
                data-testid="button-close-comparison"
              >
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
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

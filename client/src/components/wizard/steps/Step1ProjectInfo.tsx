import { useState, useEffect, useRef } from 'react';
import { useWizard } from '../WizardContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { HelpCircle, RefreshCw, AlertTriangle, CheckCircle } from 'lucide-react';

export const Step1ProjectInfo: React.FC = () => {
  const { 
    wizardState, 
    updateProjectData
  } = useWizard();
  
  const [projectNumberStatus, setProjectNumberStatus] = useState<'idle' | 'checking' | 'exists' | 'available'>('idle');
  const checkTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const { projectData, validationErrors } = wizardState;
  
  const generateProjectNumber = () => {
    const year = new Date().getFullYear();
    const random = Math.floor(Math.random() * 900) + 100;
    return `${year}-${random}`;
  };
  
  // Check project number availability with debounce
  useEffect(() => {
    const projectNumber = projectData.projectNumber;
    
    // Clear any pending check
    if (checkTimeoutRef.current) {
      clearTimeout(checkTimeoutRef.current);
    }
    
    // Skip check for empty, draft numbers, or very short numbers
    if (!projectNumber || projectNumber.length < 4 || projectNumber.includes('DRAFT')) {
      setProjectNumberStatus('idle');
      return;
    }
    
    setProjectNumberStatus('checking');
    
    // Debounce the check by 500ms - capture projectNumber to guard against stale responses
    const numberToCheck = projectNumber;
    checkTimeoutRef.current = setTimeout(async () => {
      try {
        const response = await fetch(`/api/projects/check-number/${encodeURIComponent(numberToCheck)}`);
        // Guard against stale responses - only update if still checking this number
        if (projectData.projectNumber !== numberToCheck) {
          return; // Ignore stale response
        }
        if (response.ok) {
          const data = await response.json();
          setProjectNumberStatus(data.exists ? 'exists' : 'available');
        } else {
          setProjectNumberStatus('idle');
        }
      } catch (error) {
        console.error('Failed to check project number:', error);
        setProjectNumberStatus('idle');
      }
    }, 500);
    
    return () => {
      if (checkTimeoutRef.current) {
        clearTimeout(checkTimeoutRef.current);
      }
    };
  }, [projectData.projectNumber]);
  
  // Note: Project number auto-population is handled in WizardContext via the /api/projects/next-number API
  
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Project Information</CardTitle>
          <CardDescription>
            Enter the basic details for your project
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="projectNumber" className="flex items-center gap-2">
              Project Number <span className="text-red-500">*</span>
              <Tooltip>
                <TooltipTrigger>
                  <HelpCircle className="h-4 w-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Format: YYYY-### (e.g., 2025-042)</p>
                </TooltipContent>
              </Tooltip>
            </Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  id="projectNumber"
                  value={projectData.projectNumber}
                  onChange={(e) => updateProjectData({ projectNumber: e.target.value })}
                  placeholder="2025-042"
                  className={`${validationErrors.projectNumber || projectNumberStatus === 'exists' ? 'border-red-500' : projectNumberStatus === 'available' ? 'border-green-500' : ''} pr-10`}
                  data-testid="input-project-number"
                />
                {projectNumberStatus === 'checking' && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                )}
                {projectNumberStatus === 'exists' && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                  </div>
                )}
                {projectNumberStatus === 'available' && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  </div>
                )}
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={() => updateProjectData({ projectNumber: generateProjectNumber() })}
                data-testid="button-regenerate-number"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
            {projectNumberStatus === 'exists' && (
              <p className="text-sm text-red-500 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                This project number already exists. Please use a different number or resume the existing draft.
              </p>
            )}
            {projectNumberStatus === 'available' && (
              <p className="text-sm text-green-600 flex items-center gap-1">
                <CheckCircle className="h-3 w-3" />
                Project number is available
              </p>
            )}
            {validationErrors.projectNumber && (
              <p className="text-sm text-red-500">{validationErrors.projectNumber}</p>
            )}
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="projectName" className="flex items-center gap-2">
              Project Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="projectName"
              value={projectData.projectName}
              onChange={(e) => updateProjectData({ projectName: e.target.value })}
              placeholder="e.g., Smith Residence"
              className={validationErrors.projectName ? 'border-red-500' : ''}
              data-testid="input-project-name"
            />
            {validationErrors.projectName && (
              <p className="text-sm text-red-500">{validationErrors.projectName}</p>
            )}
            <p className="text-xs text-muted-foreground">
              A descriptive name for the project
            </p>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="totalUnits" className="flex items-center gap-2">
              Total Units <span className="text-red-500">*</span>
              <Tooltip>
                <TooltipTrigger>
                  <HelpCircle className="h-4 w-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Number of dwelling units in this project (1-50)</p>
                </TooltipContent>
              </Tooltip>
            </Label>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => updateProjectData({ 
                  totalUnits: Math.max(1, projectData.totalUnits - 1) 
                })}
                disabled={projectData.totalUnits <= 1}
                data-testid="button-decrease-units"
              >
                -
              </Button>
              <Input
                id="totalUnits"
                type="number"
                value={projectData.totalUnits}
                onChange={(e) => updateProjectData({ 
                  totalUnits: parseInt(e.target.value) || 1 
                })}
                min="1"
                max="50"
                className={`w-24 text-center ${validationErrors.totalUnits ? 'border-red-500' : ''}`}
                data-testid="input-total-units"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => updateProjectData({ 
                  totalUnits: Math.min(50, projectData.totalUnits + 1) 
                })}
                disabled={projectData.totalUnits >= 50}
                data-testid="button-increase-units"
              >
                +
              </Button>
            </div>
            {projectData.totalUnits > 10 && (
              <div className="flex items-center gap-2 text-sm text-orange-600">
                <HelpCircle className="h-4 w-4" />
                <span>Multi-unit project will use extended exhibits</span>
              </div>
            )}
            {validationErrors.totalUnits && (
              <p className="text-sm text-red-500">{validationErrors.totalUnits}</p>
            )}
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="agreementDate" className="flex items-center gap-2">
              Agreement Execution Date <span className="text-red-500">*</span>
            </Label>
            <Input
              id="agreementDate"
              type="date"
              value={projectData.agreementDate}
              onChange={(e) => updateProjectData({ agreementDate: e.target.value })}
              className={validationErrors.agreementDate ? 'border-red-500' : ''}
              data-testid="input-agreement-date"
            />
            {validationErrors.agreementDate && (
              <p className="text-sm text-red-500">{validationErrors.agreementDate}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Date when the contract will be signed
            </p>
          </div>
        </CardContent>
      </Card>
      
      <Card className="bg-muted/30">
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Contract Variables</p>
              <p className="text-xs text-muted-foreground">
                This step populates 4 contract variables
              </p>
            </div>
            <Badge variant="secondary">
              PROJECT_NUMBER, PROJECT_NAME, TOTAL_UNITS, AGREEMENT_DATE
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

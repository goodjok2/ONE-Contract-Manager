import { useWizard } from '../WizardContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { HelpCircle, RefreshCw } from 'lucide-react';

export const Step1ProjectInfo: React.FC = () => {
  const { 
    wizardState, 
    updateProjectData
  } = useWizard();
  
  const { projectData, validationErrors } = wizardState;
  
  const generateProjectNumber = () => {
    const year = new Date().getFullYear();
    const random = Math.floor(Math.random() * 900) + 100;
    return `${year}-${random}`;
  };
  
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
              <Input
                id="projectNumber"
                value={projectData.projectNumber}
                onChange={(e) => updateProjectData({ projectNumber: e.target.value })}
                placeholder="2025-042"
                className={validationErrors.projectNumber ? 'border-red-500' : ''}
                data-testid="input-project-number"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => updateProjectData({ projectNumber: generateProjectNumber() })}
                data-testid="button-regenerate-number"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
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

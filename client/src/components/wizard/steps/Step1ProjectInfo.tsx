import { useState, useEffect, useRef } from 'react';
import { useWizard } from '../WizardContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { HelpCircle, RefreshCw, AlertTriangle, CheckCircle, Plus, Trash2, Home } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

interface HomeModel {
  id: number;
  name: string;
  modelCode: string;
  bedrooms: number;
  bathrooms: number;
  sqFt: number;
  designFee: number;
  offsiteBasePrice: number;
  onsiteEstPrice: number;
}

interface ProjectUnit {
  id: number;
  projectId: number;
  modelId: number;
  unitLabel: string;
  basePriceSnapshot: number;
  customizationTotal: number;
  model: HomeModel;
}

export const Step1ProjectInfo: React.FC = () => {
  const { 
    wizardState, 
    updateProjectData
  } = useWizard();
  
  const queryClient = useQueryClient();
  const [projectNumberStatus, setProjectNumberStatus] = useState<'idle' | 'checking' | 'exists' | 'available'>('idle');
  const [selectedModelId, setSelectedModelId] = useState<string>('');
  const checkTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const { projectData, validationErrors } = wizardState;

  const { data: homeModels = [], isLoading: modelsLoading } = useQuery<HomeModel[]>({
    queryKey: ['/api/home-models'],
  });

  const { data: projectUnits = [], isLoading: unitsLoading, refetch: refetchUnits } = useQuery<ProjectUnit[]>({
    queryKey: ['/api/projects', projectData.projectId, 'units'],
    enabled: !!projectData.projectId,
  });

  const addUnitMutation = useMutation({
    mutationFn: async (modelId: number) => {
      return apiRequest('POST', `/api/projects/${projectData.projectId}/units`, { modelId });
    },
    onSuccess: () => {
      refetchUnits();
      setSelectedModelId('');
    },
  });

  const deleteUnitMutation = useMutation({
    mutationFn: async (unitId: number) => {
      return apiRequest('DELETE', `/api/project-units/${unitId}`);
    },
    onSuccess: () => {
      refetchUnits();
    },
  });

  useEffect(() => {
    if (projectUnits.length !== projectData.totalUnits) {
      updateProjectData({ totalUnits: projectUnits.length || 1 });
    }
  }, [projectUnits.length]);
  
  const generateProjectNumber = () => {
    const year = new Date().getFullYear();
    const random = Math.floor(Math.random() * 900) + 100;
    return `${year}-${random}`;
  };
  
  useEffect(() => {
    const projectNumber = projectData.projectNumber;
    
    if (checkTimeoutRef.current) {
      clearTimeout(checkTimeoutRef.current);
    }
    
    if (!projectNumber || projectNumber.length < 4 || projectNumber.includes('DRAFT')) {
      setProjectNumberStatus('idle');
      return;
    }
    
    setProjectNumberStatus('checking');
    
    const numberToCheck = projectNumber;
    checkTimeoutRef.current = setTimeout(async () => {
      try {
        const response = await fetch(`/api/projects/check-number/${encodeURIComponent(numberToCheck)}`);
        if (projectData.projectNumber !== numberToCheck) {
          return;
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

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(cents / 100);
  };

  const handleAddUnit = () => {
    if (selectedModelId && projectData.projectId) {
      addUnitMutation.mutate(parseInt(selectedModelId));
    }
  };

  const handleDeleteUnit = (unitId: number) => {
    deleteUnitMutation.mutate(unitId);
  };
  
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Home className="h-5 w-5" />
            Unit Builder
          </CardTitle>
          <CardDescription>
            Select home models to add to this project. Each unit will be priced individually.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {projectData.projectId ? (
            <>
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <Label htmlFor="modelSelect">Add Home Model</Label>
                  <Select
                    value={selectedModelId}
                    onValueChange={setSelectedModelId}
                    disabled={modelsLoading}
                  >
                    <SelectTrigger data-testid="select-home-model">
                      <SelectValue placeholder="Select a home model..." />
                    </SelectTrigger>
                    <SelectContent>
                      {homeModels.map((model) => (
                        <SelectItem key={model.id} value={model.id.toString()}>
                          {model.name} - {model.bedrooms}BR/{model.bathrooms}BA, {model.sqFt.toLocaleString()} sqft ({formatCurrency(model.offsiteBasePrice)})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={handleAddUnit}
                  disabled={!selectedModelId || addUnitMutation.isPending}
                  data-testid="button-add-unit"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Unit
                </Button>
              </div>

              {unitsLoading ? (
                <div className="text-center py-4 text-muted-foreground">Loading units...</div>
              ) : projectUnits.length > 0 ? (
                <div className="border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Unit</TableHead>
                        <TableHead>Model</TableHead>
                        <TableHead>Specs</TableHead>
                        <TableHead className="text-right">Base Price</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {projectUnits.map((unit) => (
                        <TableRow key={unit.id} data-testid={`row-unit-${unit.id}`}>
                          <TableCell className="font-medium">{unit.unitLabel}</TableCell>
                          <TableCell>{unit.model.name}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {unit.model.bedrooms}BR / {unit.model.bathrooms}BA / {unit.model.sqFt.toLocaleString()} sqft
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {formatCurrency(unit.basePriceSnapshot)}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteUnit(unit.id)}
                              disabled={deleteUnitMutation.isPending}
                              data-testid={`button-delete-unit-${unit.id}`}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-8 border rounded-md bg-muted/30">
                  <Home className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-muted-foreground">No units added yet</p>
                  <p className="text-xs text-muted-foreground mt-1">Select a home model above to add units</p>
                </div>
              )}

              <div className="flex items-center justify-between pt-2 border-t">
                <div className="flex items-center gap-2">
                  <Label className="text-muted-foreground">Total Units:</Label>
                  <Badge variant="secondary" data-testid="badge-total-units">
                    {projectUnits.length}
                  </Badge>
                </div>
                {projectUnits.length > 0 && (
                  <div className="text-sm text-muted-foreground">
                    Total Base: {formatCurrency(projectUnits.reduce((sum, u) => sum + u.basePriceSnapshot, 0))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="text-center py-8 border rounded-md bg-muted/30">
              <AlertTriangle className="h-8 w-8 mx-auto text-orange-500 mb-2" />
              <p className="text-muted-foreground">Save the project first to add units</p>
              <p className="text-xs text-muted-foreground mt-1">Complete the project info and navigate forward to create the project</p>
            </div>
          )}
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

import { useState, useEffect } from 'react';
import { useWizard, US_STATES } from '../WizardContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { MapPin, Home, Plus, Trash2, AlertTriangle, Package } from 'lucide-react';
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

export const Step5SiteAndHome: React.FC = () => {
  const { 
    wizardState, 
    updateProjectData,
    draftProjectId,
    setDbUnitsCount
  } = useWizard();
  
  const queryClient = useQueryClient();
  const [selectedModelId, setSelectedModelId] = useState<string>('');
  
  const { projectData, validationErrors } = wizardState;

  const { data: homeModels = [], isLoading: modelsLoading } = useQuery<HomeModel[]>({
    queryKey: ['/api/home-models'],
  });

  const { data: projectUnits = [], isLoading: unitsLoading, refetch: refetchUnits } = useQuery<ProjectUnit[]>({
    queryKey: ['/api/projects', draftProjectId, 'units'],
    enabled: !!draftProjectId,
  });

  const addUnitMutation = useMutation({
    mutationFn: async (modelId: number) => {
      return apiRequest('POST', `/api/projects/${draftProjectId}/units`, { modelId });
    },
    onSuccess: () => {
      refetchUnits();
      queryClient.invalidateQueries({ queryKey: ['/api/projects', draftProjectId, 'pricing-summary'] });
      setSelectedModelId('');
    },
  });

  const deleteUnitMutation = useMutation({
    mutationFn: async (unitId: number) => {
      return apiRequest('DELETE', `/api/project-units/${unitId}`);
    },
    onSuccess: () => {
      refetchUnits();
      queryClient.invalidateQueries({ queryKey: ['/api/projects', draftProjectId, 'pricing-summary'] });
    },
  });

  useEffect(() => {
    if (projectUnits.length !== projectData.totalUnits) {
      updateProjectData({ totalUnits: projectUnits.length || 1 });
    }
    setDbUnitsCount(projectUnits.length);
  }, [projectUnits.length]);

  useEffect(() => {
    const totalPrice = projectUnits.reduce((sum, unit) => sum + unit.basePriceSnapshot, 0);
    if (totalPrice !== projectData.preliminaryOffsiteCost) {
      updateProjectData({ preliminaryOffsiteCost: totalPrice / 100 });
    }
  }, [projectUnits]);
  
  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(cents / 100);
  };

  const handleAddUnit = () => {
    if (selectedModelId && draftProjectId) {
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
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            Site Address
          </CardTitle>
          <CardDescription>
            Property location for the modular home installation
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="siteAddress">
              Street Address <span className="text-red-500">*</span>
            </Label>
            <Input
              id="siteAddress"
              value={projectData.siteAddress}
              onChange={(e) => updateProjectData({ siteAddress: e.target.value })}
              placeholder="e.g., 123 Main Street"
              className={validationErrors.siteAddress ? 'border-red-500' : ''}
              data-testid="input-site-address"
            />
            {validationErrors.siteAddress && (
              <p className="text-sm text-red-500">{validationErrors.siteAddress}</p>
            )}
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="siteCity">
                City <span className="text-red-500">*</span>
              </Label>
              <Input
                id="siteCity"
                value={projectData.siteCity}
                onChange={(e) => updateProjectData({ siteCity: e.target.value })}
                placeholder="City"
                className={validationErrors.siteCity ? 'border-red-500' : ''}
                data-testid="input-site-city"
              />
              {validationErrors.siteCity && (
                <p className="text-sm text-red-500">{validationErrors.siteCity}</p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="siteState">
                State <span className="text-red-500">*</span>
              </Label>
              <Select
                value={projectData.siteState}
                onValueChange={(value) => updateProjectData({ siteState: value })}
              >
                <SelectTrigger
                  id="siteState"
                  className={validationErrors.siteState ? 'border-red-500' : ''}
                  data-testid="select-site-state"
                >
                  <SelectValue placeholder="State" />
                </SelectTrigger>
                <SelectContent>
                  {US_STATES.map(state => (
                    <SelectItem key={state.value} value={state.value}>{state.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {validationErrors.siteState && (
                <p className="text-sm text-red-500">{validationErrors.siteState}</p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="siteZip">
                ZIP Code <span className="text-red-500">*</span>
              </Label>
              <Input
                id="siteZip"
                value={projectData.siteZip}
                onChange={(e) => updateProjectData({ siteZip: e.target.value })}
                placeholder="ZIP"
                className={validationErrors.siteZip ? 'border-red-500' : ''}
                data-testid="input-site-zip"
              />
              {validationErrors.siteZip && (
                <p className="text-sm text-red-500">{validationErrors.siteZip}</p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="siteCounty">
                County
              </Label>
              <Input
                id="siteCounty"
                value={projectData.siteCounty}
                onChange={(e) => updateProjectData({ siteCounty: e.target.value })}
                placeholder="County"
                data-testid="input-site-county"
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="siteApn">
              APN (Assessor's Parcel Number)
            </Label>
            <Input
              id="siteApn"
              value={projectData.siteApn}
              onChange={(e) => updateProjectData({ siteApn: e.target.value })}
              placeholder="e.g., 123-456-789"
              data-testid="input-site-apn"
            />
            <p className="text-xs text-muted-foreground">
              Optional - helps identify the exact parcel
            </p>
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Home className="h-5 w-5 text-primary" />
            Selected Home Models
          </CardTitle>
          <CardDescription>
            Add home models to this project. Each unit will be priced individually.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!draftProjectId ? (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Complete the previous steps and save the project to add home models.
              </AlertDescription>
            </Alert>
          ) : (
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
              ) : projectUnits.length === 0 ? (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    You must add at least one home model to proceed.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-4">
                  {projectUnits.map((unit, index) => (
                    <Card key={unit.id} className="border" data-testid={`card-unit-${unit.id}`}>
                      <CardHeader className="py-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Package className="h-4 w-4 text-primary" />
                            <CardTitle className="text-base">
                              {unit.unitLabel}: {unit.model.name}
                            </CardTitle>
                            <Badge variant="outline" className="text-xs">
                              {unit.model.bedrooms}BR / {unit.model.bathrooms}BA / {unit.model.sqFt.toLocaleString()} sqft
                            </Badge>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-mono font-semibold">
                              {formatCurrency(unit.basePriceSnapshot)}
                            </span>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteUnit(unit.id)}
                              disabled={deleteUnitMutation.isPending}
                              data-testid={`button-delete-unit-${unit.id}`}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                    </Card>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between pt-4 border-t">
                <div className="flex items-center gap-2">
                  <Label className="text-muted-foreground">Total Units:</Label>
                  <Badge variant="secondary" data-testid="badge-total-units">
                    {projectUnits.length}
                  </Badge>
                </div>
                {projectUnits.length > 0 && (
                  <div className="text-lg font-semibold">
                    Total Manufacturing: {formatCurrency(projectUnits.reduce((sum, u) => sum + u.basePriceSnapshot, 0))}
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
      
      <Card className="bg-muted/30">
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Contract Variables</p>
              <p className="text-xs text-muted-foreground">
                This step populates {5 + projectUnits.length * 5} contract variables
              </p>
            </div>
            <Badge variant="secondary" className="text-xs">
              SITE_ADDRESS, UNIT_MODEL, UNIT_SQFT, UNIT_PRICE, PRELIMINARY_OFFSITE_COST
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

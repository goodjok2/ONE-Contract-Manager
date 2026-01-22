import { useEffect } from 'react';
import { useWizard, US_STATES } from '../WizardContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MapPin, Home, Plus, Minus, DollarSign, Trash2 } from 'lucide-react';

export const Step5SiteAndHome: React.FC = () => {
  const { 
    wizardState, 
    updateProjectData,
    updateUnit,
    addUnit,
    removeUnit
  } = useWizard();
  
  const { projectData, validationErrors } = wizardState;
  
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };
  
  const totalUnitPrice = projectData.units.slice(0, projectData.totalUnits).reduce((sum, unit) => sum + (unit.price || 0), 0);
  
  useEffect(() => {
    if (totalUnitPrice !== projectData.preliminaryOffsiteCost) {
      updateProjectData({ preliminaryOffsiteCost: totalUnitPrice });
    }
  }, [totalUnitPrice, projectData.preliminaryOffsiteCost, updateProjectData]);
  
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
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Home className="h-5 w-5 text-primary" />
                Unit Specifications
              </CardTitle>
              <CardDescription>
                {projectData.totalUnits === 1 
                  ? 'Configure the modular home unit'
                  : `Configure ${projectData.totalUnits} modular home units`
                }
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">
                {projectData.totalUnits} Unit{projectData.totalUnits > 1 ? 's' : ''}
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={addUnit}
                className="gap-1"
                data-testid="button-add-unit"
              >
                <Plus className="h-4 w-4" />
                Add Unit
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {projectData.units.slice(0, projectData.totalUnits).map((unit, index) => (
            <div key={unit.id} className="space-y-4 p-4 border rounded-lg">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="font-medium">
                  {projectData.totalUnits > 1 ? `Unit ${index + 1}` : 'Home Details'}
                </h4>
                {projectData.totalUnits > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeUnit(unit.id)}
                    data-testid={`button-remove-unit-${index}`}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Home Model <span className="text-red-500">*</span></Label>
                  <Input
                    value={unit.model}
                    onChange={(e) => updateUnit(unit.id, { model: e.target.value })}
                    placeholder="e.g., Dvele One"
                    className={validationErrors[`unit_${index}_model`] ? 'border-red-500' : ''}
                    data-testid={`input-unit-${index}-model`}
                  />
                  {validationErrors[`unit_${index}_model`] && (
                    <p className="text-sm text-red-500">{validationErrors[`unit_${index}_model`]}</p>
                  )}
                </div>
                
                <div className="space-y-2">
                  <Label>Square Footage <span className="text-red-500">*</span></Label>
                  <Input
                    type="number"
                    value={unit.squareFootage || ''}
                    onChange={(e) => updateUnit(unit.id, { squareFootage: parseInt(e.target.value) || 0 })}
                    placeholder="e.g., 1200"
                    min={400}
                    max={10000}
                    className={validationErrors[`unit_${index}_sqft`] ? 'border-red-500' : ''}
                    data-testid={`input-unit-${index}-sqft`}
                  />
                  {validationErrors[`unit_${index}_sqft`] && (
                    <p className="text-sm text-red-500">{validationErrors[`unit_${index}_sqft`]}</p>
                  )}
                </div>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Bedrooms <span className="text-red-500">*</span></Label>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => updateUnit(unit.id, { bedrooms: Math.max(1, unit.bedrooms - 1) })}
                      data-testid={`button-unit-${index}-beds-minus`}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <Input
                      type="number"
                      value={unit.bedrooms}
                      onChange={(e) => updateUnit(unit.id, { bedrooms: parseInt(e.target.value) || 1 })}
                      className={`text-center ${validationErrors[`unit_${index}_beds`] ? 'border-red-500' : ''}`}
                      min={1}
                      max={10}
                      data-testid={`input-unit-${index}-beds`}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => updateUnit(unit.id, { bedrooms: Math.min(10, unit.bedrooms + 1) })}
                      data-testid={`button-unit-${index}-beds-plus`}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  {validationErrors[`unit_${index}_beds`] && (
                    <p className="text-sm text-red-500">{validationErrors[`unit_${index}_beds`]}</p>
                  )}
                </div>
                
                <div className="space-y-2">
                  <Label>Bathrooms <span className="text-red-500">*</span></Label>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => updateUnit(unit.id, { bathrooms: Math.max(1, unit.bathrooms - 0.5) })}
                      data-testid={`button-unit-${index}-baths-minus`}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <Input
                      type="number"
                      step={0.5}
                      value={unit.bathrooms}
                      onChange={(e) => updateUnit(unit.id, { bathrooms: parseFloat(e.target.value) || 1 })}
                      className={`text-center ${validationErrors[`unit_${index}_baths`] ? 'border-red-500' : ''}`}
                      min={1}
                      max={10}
                      data-testid={`input-unit-${index}-baths`}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => updateUnit(unit.id, { bathrooms: Math.min(10, unit.bathrooms + 0.5) })}
                      data-testid={`button-unit-${index}-baths-plus`}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  {validationErrors[`unit_${index}_baths`] && (
                    <p className="text-sm text-red-500">{validationErrors[`unit_${index}_baths`]}</p>
                  )}
                </div>
                
                <div className="space-y-2">
                  <Label className="flex items-center gap-1">
                    <DollarSign className="h-3 w-3" />
                    Unit Price <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    type="number"
                    value={unit.price || ''}
                    onChange={(e) => updateUnit(unit.id, { price: parseInt(e.target.value) || 0 })}
                    placeholder="e.g., 350000"
                    min={100000}
                    className={validationErrors[`unit_${index}_price`] ? 'border-red-500' : ''}
                    data-testid={`input-unit-${index}-price`}
                  />
                  {validationErrors[`unit_${index}_price`] && (
                    <p className="text-sm text-red-500">{validationErrors[`unit_${index}_price`]}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
          
          <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
            <span className="font-medium">Total Unit Value (Manufacturing/Offsite)</span>
            <span className="text-xl font-bold text-primary">{formatCurrency(totalUnitPrice)}</span>
          </div>
        </CardContent>
      </Card>
      
      <Card className="bg-muted/30">
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Contract Variables</p>
              <p className="text-xs text-muted-foreground">
                This step populates {5 + projectData.totalUnits * 5} contract variables
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

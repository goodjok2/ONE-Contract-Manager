import { useEffect, useMemo } from 'react';
import { useWizard } from '../WizardContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DollarSign, AlertTriangle, CheckCircle2, Plus, Minus, Percent } from 'lucide-react';

export const Step7Pricing: React.FC = () => {
  const { 
    wizardState, 
    updateProjectData
  } = useWizard();
  
  const { projectData, validationErrors } = wizardState;
  
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };
  
  const milestoneSum = useMemo(() => {
    return (projectData.milestone1Percent || 0) + 
           (projectData.milestone2Percent || 0) + 
           (projectData.milestone3Percent || 0) + 
           (projectData.milestone4Percent || 0) + 
           (projectData.milestone5Percent || 0);
  }, [
    projectData.milestone1Percent,
    projectData.milestone2Percent,
    projectData.milestone3Percent,
    projectData.milestone4Percent,
    projectData.milestone5Percent
  ]);
  
  const isMilestoneValid = Math.abs(milestoneSum - 95) < 0.01;
  
  const totalContractPrice = useMemo(() => {
    let total = (projectData.preliminaryOffsiteCost || 0) + 
                (projectData.deliveryInstallationPrice || 0) + 
                (projectData.designFee || 0);
    
    if (projectData.serviceModel === 'CMOS') {
      total += (projectData.sitePrepPrice || 0);
      total += (projectData.utilitiesPrice || 0);
      total += (projectData.completionPrice || 0);
    }
    return total;
  }, [
    projectData.preliminaryOffsiteCost,
    projectData.deliveryInstallationPrice,
    projectData.designFee,
    projectData.sitePrepPrice,
    projectData.utilitiesPrice,
    projectData.completionPrice,
    projectData.serviceModel
  ]);
  
  useEffect(() => {
    if (totalContractPrice !== projectData.totalPreliminaryContractPrice) {
      updateProjectData({ totalPreliminaryContractPrice: totalContractPrice });
    }
  }, [totalContractPrice, projectData.totalPreliminaryContractPrice, updateProjectData]);
  
  const adjustMilestone = (field: string, delta: number) => {
    const current = (projectData as any)[field] || 0;
    const newValue = Math.max(0, Math.min(100, current + delta));
    updateProjectData({ [field]: newValue });
  };
  
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Design Phase
          </CardTitle>
          <CardDescription>
            Design fee and revision rounds for the project
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="designFee">
                Design Fee <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="designFee"
                  type="number"
                  value={projectData.designFee || ''}
                  onChange={(e) => updateProjectData({ designFee: parseInt(e.target.value) || 0 })}
                  placeholder="e.g., 25000"
                  className={`pl-9 ${validationErrors.designFee ? 'border-red-500' : ''}`}
                  min={1000}
                  max={100000}
                  data-testid="input-design-fee"
                />
              </div>
              {validationErrors.designFee && (
                <p className="text-sm text-red-500">{validationErrors.designFee}</p>
              )}
              <p className="text-xs text-muted-foreground">Between $1,000 and $100,000</p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="revisionRounds">Revision Rounds</Label>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => updateProjectData({ designRevisionRounds: Math.max(1, (projectData.designRevisionRounds || 3) - 1) })}
                  data-testid="button-revisions-minus"
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <Input
                  id="revisionRounds"
                  type="number"
                  value={projectData.designRevisionRounds || 3}
                  onChange={(e) => updateProjectData({ designRevisionRounds: parseInt(e.target.value) || 3 })}
                  className="text-center w-20"
                  min={1}
                  max={10}
                  data-testid="input-revision-rounds"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => updateProjectData({ designRevisionRounds: Math.min(10, (projectData.designRevisionRounds || 3) + 1) })}
                  data-testid="button-revisions-plus"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Preliminary Pricing
          </CardTitle>
          <CardDescription>
            Cost breakdown for manufacturing, delivery, and {projectData.serviceModel === 'CMOS' ? 'construction phases' : 'installation'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="preliminaryOffsiteCost">
                Manufacturing (Offsite) <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="preliminaryOffsiteCost"
                  type="number"
                  value={projectData.preliminaryOffsiteCost || ''}
                  onChange={(e) => updateProjectData({ preliminaryOffsiteCost: parseInt(e.target.value) || 0 })}
                  placeholder="Auto-calculated from units"
                  className={`pl-9 ${validationErrors.preliminaryOffsiteCost ? 'border-red-500' : ''}`}
                  min={50000}
                  data-testid="input-offsite-cost"
                />
              </div>
              {validationErrors.preliminaryOffsiteCost && (
                <p className="text-sm text-red-500">{validationErrors.preliminaryOffsiteCost}</p>
              )}
              <p className="text-xs text-muted-foreground">Typically auto-calculated from unit prices</p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="deliveryInstallationPrice">
                Delivery & Installation <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="deliveryInstallationPrice"
                  type="number"
                  value={projectData.deliveryInstallationPrice || ''}
                  onChange={(e) => updateProjectData({ deliveryInstallationPrice: parseInt(e.target.value) || 0 })}
                  placeholder="e.g., 25000"
                  className={`pl-9 ${validationErrors.deliveryInstallationPrice ? 'border-red-500' : ''}`}
                  min={5000}
                  data-testid="input-delivery-price"
                />
              </div>
              {validationErrors.deliveryInstallationPrice && (
                <p className="text-sm text-red-500">{validationErrors.deliveryInstallationPrice}</p>
              )}
            </div>
          </div>
          
          {projectData.serviceModel === 'CMOS' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t">
              <div className="space-y-2">
                <Label htmlFor="sitePrepPrice">
                  Site Preparation <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="sitePrepPrice"
                    type="number"
                    value={projectData.sitePrepPrice || ''}
                    onChange={(e) => updateProjectData({ sitePrepPrice: parseInt(e.target.value) || 0 })}
                    placeholder="e.g., 50000"
                    className={`pl-9 ${validationErrors.sitePrepPrice ? 'border-red-500' : ''}`}
                    min={10000}
                    data-testid="input-site-prep-price"
                  />
                </div>
                {validationErrors.sitePrepPrice && (
                  <p className="text-sm text-red-500">{validationErrors.sitePrepPrice}</p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="utilitiesPrice">
                  Utilities Connection <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="utilitiesPrice"
                    type="number"
                    value={projectData.utilitiesPrice || ''}
                    onChange={(e) => updateProjectData({ utilitiesPrice: parseInt(e.target.value) || 0 })}
                    placeholder="e.g., 25000"
                    className={`pl-9 ${validationErrors.utilitiesPrice ? 'border-red-500' : ''}`}
                    min={5000}
                    data-testid="input-utilities-price"
                  />
                </div>
                {validationErrors.utilitiesPrice && (
                  <p className="text-sm text-red-500">{validationErrors.utilitiesPrice}</p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="completionPrice">
                  Site Completion <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="completionPrice"
                    type="number"
                    value={projectData.completionPrice || ''}
                    onChange={(e) => updateProjectData({ completionPrice: parseInt(e.target.value) || 0 })}
                    placeholder="e.g., 30000"
                    className={`pl-9 ${validationErrors.completionPrice ? 'border-red-500' : ''}`}
                    min={10000}
                    data-testid="input-completion-price"
                  />
                </div>
                {validationErrors.completionPrice && (
                  <p className="text-sm text-red-500">{validationErrors.completionPrice}</p>
                )}
              </div>
            </div>
          )}
          
          <div className="flex items-center justify-between p-4 bg-primary/10 rounded-lg">
            <span className="font-medium">Total Preliminary Contract Price</span>
            <span className="text-2xl font-bold">{formatCurrency(totalContractPrice)}</span>
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Percent className="h-5 w-5" />
                Payment Milestones
              </CardTitle>
              <CardDescription>
                Five payment milestones must sum to exactly 95% (5% retainage)
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {isMilestoneValid ? (
                <Badge variant="secondary" className="gap-1">
                  <CheckCircle2 className="h-3 w-3 text-green-500" />
                  {milestoneSum}% - Valid
                </Badge>
              ) : (
                <Badge variant="destructive" className="gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  {milestoneSum}% - Must be 95%
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[1, 2, 3, 4, 5].map((num) => {
              const field = `milestone${num}Percent` as keyof typeof projectData;
              const value = (projectData as any)[field] || 0;
              return (
                <div key={num} className="space-y-2">
                  <Label className="text-center block">Milestone {num}</Label>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => adjustMilestone(field, -5)}
                      data-testid={`button-milestone-${num}-minus`}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <div className="relative flex-1">
                      <Input
                        type="number"
                        value={value}
                        onChange={(e) => updateProjectData({ [field]: parseInt(e.target.value) || 0 })}
                        className="text-center pr-6"
                        min={0}
                        max={100}
                        data-testid={`input-milestone-${num}`}
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => adjustMilestone(field, 5)}
                      data-testid={`button-milestone-${num}-plus`}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
          {validationErrors.milestones && (
            <p className="text-sm text-red-500 text-center">{validationErrors.milestones}</p>
          )}
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
            <div className="space-y-2">
              <Label htmlFor="retainagePercent">Retainage Percent</Label>
              <div className="relative">
                <Input
                  id="retainagePercent"
                  type="number"
                  value={projectData.retainagePercent || 5}
                  onChange={(e) => updateProjectData({ retainagePercent: parseInt(e.target.value) || 5 })}
                  className="pr-6"
                  min={0}
                  max={10}
                  data-testid="input-retainage-percent"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
              </div>
              <p className="text-xs text-muted-foreground">Held until project completion</p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="retainageDays">Retainage Release Days</Label>
              <Input
                id="retainageDays"
                type="number"
                value={projectData.retainageDays || 30}
                onChange={(e) => updateProjectData({ retainageDays: parseInt(e.target.value) || 30 })}
                min={15}
                max={90}
                data-testid="input-retainage-days"
              />
              <p className="text-xs text-muted-foreground">Days after completion to release retainage</p>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Manufacturing Payment Schedule
          </CardTitle>
          <CardDescription>
            Payment amounts for manufacturing subcontract
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="manufacturingDesignPayment">Design Payment</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="manufacturingDesignPayment"
                  type="number"
                  value={projectData.manufacturingDesignPayment || projectData.designFee || ''}
                  onChange={(e) => updateProjectData({ manufacturingDesignPayment: parseInt(e.target.value) || 0 })}
                  placeholder="Auto-synced from design fee"
                  className="pl-9"
                  data-testid="input-mfg-design-payment"
                />
              </div>
              <p className="text-xs text-muted-foreground">Due upon design approval</p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="productionStartPayment">Production Start Payment</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="productionStartPayment"
                  type="number"
                  value={projectData.manufacturingProductionStart || ''}
                  onChange={(e) => updateProjectData({ manufacturingProductionStart: parseInt(e.target.value) || 0 })}
                  placeholder="e.g., 100000"
                  className="pl-9"
                  data-testid="input-production-start-payment"
                />
              </div>
              <p className="text-xs text-muted-foreground">Due when manufacturing begins</p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="productionCompletePayment">Production Complete Payment</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="productionCompletePayment"
                  type="number"
                  value={projectData.manufacturingProductionComplete || ''}
                  onChange={(e) => updateProjectData({ manufacturingProductionComplete: parseInt(e.target.value) || 0 })}
                  placeholder="e.g., 150000"
                  className="pl-9"
                  data-testid="input-production-complete-payment"
                />
              </div>
              <p className="text-xs text-muted-foreground">Due when manufacturing is complete</p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="deliveryReadyPayment">Delivery Ready Payment</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="deliveryReadyPayment"
                  type="number"
                  value={projectData.manufacturingDeliveryReady || ''}
                  onChange={(e) => updateProjectData({ manufacturingDeliveryReady: parseInt(e.target.value) || 0 })}
                  placeholder="e.g., 50000"
                  className="pl-9"
                  data-testid="input-delivery-ready-payment"
                />
              </div>
              <p className="text-xs text-muted-foreground">Due when ready for delivery</p>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card className="bg-muted/30">
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Contract Variables</p>
              <p className="text-xs text-muted-foreground">
                This step populates 15+ financial contract variables
              </p>
            </div>
            <Badge variant="secondary" className="text-xs">
              DESIGN_FEE, TOTAL_CONTRACT_PRICE, MILESTONE_1-5, RETAINAGE
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

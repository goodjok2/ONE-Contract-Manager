import { useEffect, useMemo } from 'react';
import { useWizard } from '../WizardContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, Clock } from 'lucide-react';

export const Step6DatesSchedule: React.FC = () => {
  const { 
    wizardState, 
    updateProjectData
  } = useWizard();
  
  const { projectData, validationErrors } = wizardState;
  
  useEffect(() => {
    if (!projectData.effectiveDate && projectData.agreementDate) {
      updateProjectData({ effectiveDate: projectData.agreementDate });
    }
  }, [projectData.agreementDate]);
  
  useEffect(() => {
    if (!projectData.onsiteDurationDays) {
      const defaultDays = projectData.serviceModel === 'CRC' ? 90 : 60;
      updateProjectData({ onsiteDurationDays: defaultDays });
    }
  }, [projectData.serviceModel]);
  
  useEffect(() => {
    if (!projectData.designPhaseDays) {
      updateProjectData({ designPhaseDays: 60 });
    }
    if (!projectData.manufacturingDurationDays) {
      updateProjectData({ manufacturingDurationDays: 120 });
    }
    if (!projectData.estimatedCompletionMonths) {
      updateProjectData({ estimatedCompletionMonths: 12 });
    }
    if (!projectData.estimatedCompletionUnit) {
      updateProjectData({ estimatedCompletionUnit: 'months' });
    }
  }, []);
  
  const completionDate = useMemo(() => {
    if (!projectData.effectiveDate) return null;
    const startDate = new Date(projectData.effectiveDate);
    const totalDays = (projectData.designPhaseDays || 0) + 
                     (projectData.manufacturingDurationDays || 0) + 
                     (projectData.onsiteDurationDays || 0);
    const date = new Date(startDate);
    date.setDate(date.getDate() + totalDays);
    return date;
  }, [projectData.effectiveDate, projectData.designPhaseDays, projectData.manufacturingDurationDays, projectData.onsiteDurationDays]);
  
  const totalDays = (projectData.designPhaseDays || 0) + 
                    (projectData.manufacturingDurationDays || 0) + 
                    (projectData.onsiteDurationDays || 0);
  
  const formatDate = (date: Date | null) => {
    if (!date) return 'Not calculated';
    return date.toLocaleDateString('en-US', { 
      weekday: 'long',
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };
  
  const designPercent = totalDays > 0 ? ((projectData.designPhaseDays || 0) / totalDays) * 100 : 0;
  const mfgPercent = totalDays > 0 ? ((projectData.manufacturingDurationDays || 0) / totalDays) * 100 : 0;
  const onsitePercent = totalDays > 0 ? ((projectData.onsiteDurationDays || 0) / totalDays) * 100 : 0;
  
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Key Dates
          </CardTitle>
          <CardDescription>
            Set the project timeline and key milestones
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="effectiveDate">
                Effective Date <span className="text-red-500">*</span>
              </Label>
              <Input
                id="effectiveDate"
                type="date"
                value={projectData.effectiveDate}
                onChange={(e) => updateProjectData({ effectiveDate: e.target.value })}
                className={validationErrors.effectiveDate ? 'border-red-500' : ''}
                data-testid="input-effective-date"
              />
              {validationErrors.effectiveDate && (
                <p className="text-sm text-red-500">{validationErrors.effectiveDate}</p>
              )}
              <p className="text-xs text-muted-foreground">
                When the contract becomes effective
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="estimatedCompletionMonths">
                Estimated Completion Timeframe
              </Label>
              <div className="flex gap-2">
                <Input
                  id="estimatedCompletionMonths"
                  type="number"
                  value={projectData.estimatedCompletionMonths || ''}
                  onChange={(e) => updateProjectData({ estimatedCompletionMonths: parseInt(e.target.value) || 0 })}
                  placeholder="e.g., 12"
                  min={1}
                  max={projectData.estimatedCompletionUnit === 'weeks' ? 104 : 24}
                  className={`flex-1 ${validationErrors.estimatedCompletionMonths ? 'border-red-500' : ''}`}
                  data-testid="input-completion-months"
                />
                <Select
                  value={projectData.estimatedCompletionUnit || 'months'}
                  onValueChange={(value: 'months' | 'weeks') => updateProjectData({ estimatedCompletionUnit: value })}
                >
                  <SelectTrigger className="w-28" data-testid="select-completion-unit">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="months">Months</SelectItem>
                    <SelectItem value="weeks">Weeks</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {validationErrors.estimatedCompletionMonths && (
                <p className="text-sm text-red-500">{validationErrors.estimatedCompletionMonths}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Phase Durations
          </CardTitle>
          <CardDescription>
            Configure the length of each project phase
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="designPhaseDays">
                Design Phase (days)
              </Label>
              <Input
                id="designPhaseDays"
                type="number"
                value={projectData.designPhaseDays || ''}
                onChange={(e) => updateProjectData({ designPhaseDays: parseInt(e.target.value) || 0 })}
                placeholder="e.g., 60"
                min={30}
                max={180}
                className={validationErrors.designPhaseDays ? 'border-red-500' : ''}
                data-testid="input-design-days"
              />
              {validationErrors.designPhaseDays && (
                <p className="text-sm text-red-500">{validationErrors.designPhaseDays}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Typical: 30-90 days
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="manufacturingDurationDays">
                Manufacturing (days)
              </Label>
              <Input
                id="manufacturingDurationDays"
                type="number"
                value={projectData.manufacturingDurationDays || ''}
                onChange={(e) => updateProjectData({ manufacturingDurationDays: parseInt(e.target.value) || 0 })}
                placeholder="e.g., 120"
                min={60}
                max={365}
                className={validationErrors.manufacturingDurationDays ? 'border-red-500' : ''}
                data-testid="input-manufacturing-days"
              />
              {validationErrors.manufacturingDurationDays && (
                <p className="text-sm text-red-500">{validationErrors.manufacturingDurationDays}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Typical: 90-180 days
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="onsiteDurationDays" className="flex items-center gap-2">
                On-Site (days)
                {projectData.serviceModel === 'CRC' && (
                  <Badge variant="outline" className="text-xs">CRC</Badge>
                )}
              </Label>
              <Input
                id="onsiteDurationDays"
                type="number"
                value={projectData.onsiteDurationDays || ''}
                onChange={(e) => updateProjectData({ onsiteDurationDays: parseInt(e.target.value) || 0 })}
                placeholder={projectData.serviceModel === 'CRC' ? '90' : '60'}
                min={30}
                max={180}
                className={validationErrors.onsiteDurationDays ? 'border-red-500' : ''}
                data-testid="input-onsite-days"
              />
              {validationErrors.onsiteDurationDays && (
                <p className="text-sm text-red-500">{validationErrors.onsiteDurationDays}</p>
              )}
              <p className="text-xs text-muted-foreground">
                {projectData.serviceModel === 'CRC' 
                  ? 'Default: 90 days (client-managed)' 
                  : 'Default: 60 days (Dvele-managed)'
                }
              </p>
            </div>
          </div>
          
          <div className="space-y-3 pt-4 border-t">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Total Duration</span>
              <span className="font-medium">{totalDays} days ({Math.round(totalDays / 30)} months)</span>
            </div>
            
            <div className="h-4 bg-muted rounded-full overflow-hidden flex">
              <div 
                className="bg-blue-500 h-full transition-all"
                style={{ width: `${designPercent}%` }}
                title={`Design: ${projectData.designPhaseDays || 0} days`}
              />
              <div 
                className="bg-amber-500 h-full transition-all"
                style={{ width: `${mfgPercent}%` }}
                title={`Manufacturing: ${projectData.manufacturingDurationDays || 0} days`}
              />
              <div 
                className="bg-green-500 h-full transition-all"
                style={{ width: `${onsitePercent}%` }}
                title={`On-Site: ${projectData.onsiteDurationDays || 0} days`}
              />
            </div>
            
            <div className="flex flex-wrap gap-4 text-xs">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-blue-500" />
                <span>Design ({projectData.designPhaseDays || 0}d)</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-amber-500" />
                <span>Manufacturing ({projectData.manufacturingDurationDays || 0}d)</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-green-500" />
                <span>On-Site ({projectData.onsiteDurationDays || 0}d)</span>
              </div>
            </div>
          </div>
          
          {completionDate && (
            <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Estimated Completion Date</p>
                  <p className="text-lg font-semibold text-primary">{formatDate(completionDate)}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Based on effective date + total phase durations
                  </p>
                </div>
              </div>
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
                This step populates 6 contract variables
              </p>
            </div>
            <Badge variant="secondary" className="text-xs">
              EFFECTIVE_DATE, DESIGN_DAYS, MFG_DAYS, ONSITE_DAYS, COMPLETION_DATE, etc.
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

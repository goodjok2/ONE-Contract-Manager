import { useWizard } from '../WizardContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowRightLeft, UserCheck, Briefcase, HelpCircle } from 'lucide-react';

export const Step2ServiceModel: React.FC = () => {
  const { 
    wizardState, 
    updateProjectData,
    setShowComparisonModal
  } = useWizard();
  
  const { projectData, validationErrors } = wizardState;
  
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Service Model Selection</CardTitle>
          <CardDescription>
            Choose how on-site construction work will be managed
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {validationErrors.serviceModel && (
            <p className="text-sm text-red-500">{validationErrors.serviceModel}</p>
          )}
          
          <div
            className={`
              relative p-6 border-2 rounded-lg cursor-pointer transition-all overflow-visible
              ${projectData.serviceModel === 'CRC' 
                ? 'border-primary bg-primary/5 shadow-md' 
                : 'border-border hover-elevate'
              }
            `}
            onClick={() => updateProjectData({ serviceModel: 'CRC' })}
            data-testid="option-crc"
          >
            <div className="flex items-start gap-4">
              <div className={`
                w-6 h-6 rounded-full border-2 flex items-center justify-center mt-1
                ${projectData.serviceModel === 'CRC' 
                  ? 'border-primary bg-primary' 
                  : 'border-muted-foreground'
                }
              `}>
                {projectData.serviceModel === 'CRC' && (
                  <div className="w-3 h-3 rounded-full bg-white" />
                )}
              </div>
              
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <UserCheck className="h-5 w-5 text-primary" />
                  <h3 className="text-lg font-semibold">Client-Retained Contractor (CRC)</h3>
                  <Badge variant="outline">Client Managed</Badge>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Client hires and manages their own licensed general contractor for all on-site work
                </p>
                
                <div className="space-y-2 text-sm">
                  <div className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                    <span>Client is responsible for hiring and managing the GC</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                    <span>Client handles all on-site coordination and scheduling</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                    <span>On-site costs are separate from Dvele contract</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                    <span className="font-medium text-primary">Contractor info required in Step 3</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div
            className={`
              relative p-6 border-2 rounded-lg cursor-pointer transition-all overflow-visible
              ${projectData.serviceModel === 'CMOS' 
                ? 'border-primary bg-primary/5 shadow-md' 
                : 'border-border hover-elevate'
              }
            `}
            onClick={() => updateProjectData({ serviceModel: 'CMOS' })}
            data-testid="option-cmos"
          >
            <div className="flex items-start gap-4">
              <div className={`
                w-6 h-6 rounded-full border-2 flex items-center justify-center mt-1
                ${projectData.serviceModel === 'CMOS' 
                  ? 'border-primary bg-primary' 
                  : 'border-muted-foreground'
                }
              `}>
                {projectData.serviceModel === 'CMOS' && (
                  <div className="w-3 h-3 rounded-full bg-white" />
                )}
              </div>
              
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <Briefcase className="h-5 w-5 text-primary" />
                  <h3 className="text-lg font-semibold">Company-Managed On-Site Services (CMOS)</h3>
                  <Badge variant="secondary">Turnkey</Badge>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Dvele coordinates and manages all on-site construction work and contractors
                </p>
                
                <div className="space-y-2 text-sm">
                  <div className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                    <span>Dvele manages all on-site contractors and scheduling</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                    <span>Single point of contact for entire project</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                    <span>On-site costs included in total contract price</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                    <span className="font-medium text-primary">Includes site prep, utilities, and completion pricing</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
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
          
          <Card className="bg-muted/30 border-primary/20">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <HelpCircle className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="font-medium text-sm mb-2">How this affects your contracts:</p>
                  <div className="space-y-1 text-sm text-muted-foreground">
                    {projectData.serviceModel === 'CRC' ? (
                      <>
                        <p>You'll provide contractor information in the next step</p>
                        <p>On-Site Subcontract will be between your contractor and the SPV</p>
                        <p>Excludes on-site pricing from the ONE Agreement</p>
                        <p>Includes 3 CRC-specific clauses in contracts</p>
                      </>
                    ) : (
                      <>
                        <p>No contractor information required</p>
                        <p>On-Site Subcontract will be managed by Dvele</p>
                        <p>Includes site prep, utilities, and completion pricing</p>
                        <p>Includes 5 CMOS-specific clauses in contracts</p>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </CardContent>
      </Card>
      
      <Card className="bg-muted/30">
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Contract Variables</p>
              <p className="text-xs text-muted-foreground">
                This step populates 1 contract variable
              </p>
            </div>
            <Badge variant="secondary">
              ON_SITE_SERVICES_SELECTION
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

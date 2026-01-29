import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useWizard } from '../WizardContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  CheckCircle2, 
  AlertCircle, 
  Edit2, 
  Eye, 
  ChevronDown, 
  ChevronUp,
  FileText,
  Users,
  Home,
  DollarSign,
  Shield,
  Download,
  Loader2,
  Sparkles,
  X
} from 'lucide-react';

interface ExpandedSections {
  project: boolean;
  parties: boolean;
  property: boolean;
  financial: boolean;
  schedule: boolean;
}

interface PricingSummary {
  breakdown: {
    totalDesignFee: number;
    totalOffsite: number;
    totalOnsite: number;
    totalCustomizations: number;
  };
  grandTotal: number;
  paymentSchedule: { name: string; percentage: number; amount: number; phase: string }[];
  unitCount: number;
}

export const Step9ReviewGenerate: React.FC = () => {
  const { 
    wizardState, 
    goToStep,
    setShowClausePreview,
    setConfirmationChecked,
    confirmationChecked,
    generationState,
    generationProgress,
    generatedContracts,
    generateContracts,
    draftProjectId
  } = useWizard();
  
  const { projectData } = wizardState;
  
  const [expandedSections, setExpandedSections] = useState<ExpandedSections>({
    project: true,
    parties: false,
    property: false,
    financial: false,
    schedule: false
  });
  
  const [clausePreviewOpen, setClausePreviewOpen] = useState(false);
  
  const { data: pricingSummary } = useQuery<PricingSummary>({
    queryKey: ['/api/projects', draftProjectId, 'pricing-summary'],
    enabled: !!draftProjectId,
  });
  
  const toggleSection = (section: keyof ExpandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };
  
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0
    }).format(value);
  };
  
  const formatCurrencyCents = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0
    }).format(cents / 100);
  };
  
  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };
  
  const variableCoverage = useMemo(() => {
    const requiredFields = [
      'projectNumber', 'projectName', 'projectType', 'serviceModel',
      'clientLegalName', 'clientState', 'clientEntityType', 'clientEmail', 'clientSignerName',
      'siteAddress', 'siteCity', 'siteState', 'siteZip',
      'childLlcName', 'childLlcState',
      'designFee', 'preliminaryOffsiteCost', 'deliveryInstallationPrice', 'totalPreliminaryContractPrice',
      'milestone1Percent', 'milestone2Percent', 'milestone3Percent', 'milestone4Percent', 'milestone5Percent',
      'effectiveDate', 'designPhaseDays', 'manufacturingDurationDays', 'onsiteDurationDays',
      'warrantyFitFinishMonths', 'warrantyBuildingEnvelopeMonths', 'warrantyStructuralMonths',
      'projectState', 'projectCounty', 'projectFederalDistrict', 'arbitrationProvider'
    ];
    
    const populated = requiredFields.filter(field => {
      const value = (projectData as any)[field];
      return value !== undefined && value !== null && value !== '' && value !== 0;
    }).length;
    
    const total = requiredFields.length;
    return { 
      populated, 
      total, 
      percentage: Math.round((populated / total) * 100) 
    };
  }, [projectData]);
  
  const allRequiredComplete = useMemo(() => {
    const requiredChecks = [
      projectData.projectNumber,
      projectData.projectName,
      projectData.serviceModel,
      projectData.clientLegalName,
      projectData.siteAddress,
      projectData.siteCity,
      projectData.siteState,
      projectData.childLlcName,
      projectData.designFee > 0,
      projectData.preliminaryOffsiteCost > 0,
      projectData.effectiveDate,
      projectData.projectFederalDistrict,
      projectData.arbitrationProvider
    ];
    return requiredChecks.every(Boolean);
  }, [projectData]);
  
  const handleGenerateContracts = async () => {
    // Call the real generateContracts from WizardContext which saves to the database
    await generateContracts();
  };
  
  const [isDownloading, setIsDownloading] = useState<string | null>(null);
  
  const handleDownload = async (contractType: string, contractName: string) => {
    try {
      setIsDownloading(contractType);
      
      const response = await fetch('/api/contracts/download-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contractType,
          projectData
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to generate document');
      }
      
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${projectData.projectNumber || 'Contract'}_${contractName.replace(/\s+/g, '_')}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download error:', error);
    } finally {
      setIsDownloading(null);
    }
  };
  
  const handleDownloadAll = async () => {
    if (!draftProjectId) {
      // Fallback to individual downloads if no project ID
      for (const contract of contracts) {
        await handleDownload(contract.type, contract.name);
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      return;
    }
    
    try {
      setIsDownloading('all');
      
      const response = await fetch('/api/contracts/download-all-zip', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectId: draftProjectId
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to generate contract package');
      }
      
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${projectData.projectNumber || 'Contracts'}_Package.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download all error:', error);
    } finally {
      setIsDownloading(null);
    }
  };
  
  const contracts = [
    { 
      name: 'ONE Agreement', 
      description: 'Master agreement between client and Dvele Partners LLC',
      clauseCount: 47,
      type: 'ONE',
      clauses: [
        { section: '1.0', name: 'Definitions', description: 'Key terms and definitions used throughout the agreement' },
        { section: '2.0', name: 'Scope of Work', description: 'Description of services to be provided' },
        { section: '3.0', name: 'Contract Price', description: 'Total contract value and payment terms' },
        { section: '4.0', name: 'Payment Schedule', description: 'Milestone-based payment schedule' },
        { section: '5.0', name: 'Project Timeline', description: 'Key dates and completion milestones' },
        { section: '6.0', name: 'Warranties', description: 'Product and workmanship warranties' },
        { section: '7.0', name: 'Dispute Resolution', description: 'Arbitration and legal jurisdiction' }
      ]
    },
    { 
      name: 'Manufacturing Subcontract', 
      description: 'Factory production agreement',
      clauseCount: 32,
      type: 'MANUFACTURING',
      clauses: [
        { section: '1.0', name: 'Manufacturing Scope', description: 'Factory production specifications' },
        { section: '2.0', name: 'Quality Standards', description: 'Quality control requirements' },
        { section: '3.0', name: 'Production Schedule', description: 'Manufacturing timeline and milestones' },
        { section: '4.0', name: 'Payment Terms', description: 'Manufacturing payment schedule' },
        { section: '5.0', name: 'Delivery Terms', description: 'Shipping and delivery requirements' }
      ]
    },
    { 
      name: 'OnSite Subcontract', 
      description: 'Installation and site work agreement',
      clauseCount: 28,
      type: 'ONSITE',
      clauses: [
        { section: '1.0', name: 'Site Work Scope', description: 'Installation and on-site work specifications' },
        { section: '2.0', name: 'Site Preparation', description: 'Foundation and utility requirements' },
        { section: '3.0', name: 'Installation Timeline', description: 'On-site work schedule' },
        { section: '4.0', name: 'Inspections', description: 'Inspection and approval requirements' },
        { section: '5.0', name: 'Completion Criteria', description: 'Project completion and handover' }
      ]
    }
  ];
  
  if (generationState === 'generating') {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-6">
        <Loader2 className="h-16 w-16 animate-spin" />
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold">Generating Contract Package</h2>
          <p className="text-muted-foreground">Creating your customized contracts...</p>
        </div>
        <div className="w-full max-w-md space-y-2">
          <Progress value={generationProgress} className="h-2" />
          <p className="text-sm text-center text-muted-foreground">{generationProgress}% complete</p>
        </div>
      </div>
    );
  }
  
  if (generationState === 'success') {
    return (
      <div className="space-y-6">
        <Card className="border-green-500">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="h-16 w-16 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                <CheckCircle2 className="h-10 w-10 text-green-500" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">Contract Package Generated!</h2>
                <p className="text-muted-foreground">
                  Your contract package for {projectData.projectName} is ready
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Generated Documents</CardTitle>
            <CardDescription>Download your contract package</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {contracts.map((contract) => (
              <div 
                key={contract.type}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <FileText className="h-8 w-8" />
                  <div>
                    <p className="font-medium">{contract.name}</p>
                    <p className="text-sm text-muted-foreground">{contract.clauseCount} clauses</p>
                  </div>
                </div>
                <Button 
                  variant="outline" 
                  className="gap-2" 
                  onClick={() => handleDownload(contract.type, contract.name)}
                  disabled={isDownloading !== null}
                  data-testid={`button-download-${contract.type.toLowerCase()}`}
                >
                  {isDownloading === contract.type ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  {isDownloading === contract.type ? 'Generating...' : 'Download'}
                </Button>
              </div>
            ))}
            
            <div className="flex gap-4 pt-4 border-t">
              <Button 
                className="flex-1 gap-2" 
                onClick={handleDownloadAll}
                disabled={isDownloading !== null}
                data-testid="button-download-all"
              >
                {isDownloading !== null ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                {isDownloading !== null ? 'Generating...' : 'Download All'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      <Card className={allRequiredComplete ? 'border-green-500' : 'border-amber-500'}>
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            {allRequiredComplete ? (
              <CheckCircle2 className="h-8 w-8 text-green-500 shrink-0" />
            ) : (
              <AlertCircle className="h-8 w-8 text-amber-500 shrink-0" />
            )}
            <div className="flex-1">
              <h3 className="font-semibold text-lg">
                {allRequiredComplete ? 'Ready to Generate' : 'Missing Required Information'}
              </h3>
              <p className="text-muted-foreground">
                {allRequiredComplete 
                  ? 'All required fields are complete. Review your information and generate the contract package.'
                  : 'Please complete all required fields before generating contracts.'
                }
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Variable Coverage</span>
              <span className="font-medium">{variableCoverage.populated}/{variableCoverage.total} variables</span>
            </div>
            <Progress value={variableCoverage.percentage} className="h-2" />
            <p className="text-xs text-muted-foreground">
              {variableCoverage.percentage}% of contract variables are populated
            </p>
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader 
          className="cursor-pointer"
          onClick={() => toggleSection('project')}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              <CardTitle className="text-base">Project Overview</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={(e) => { e.stopPropagation(); goToStep(1); }}
                data-testid="button-edit-project"
              >
                <Edit2 className="h-4 w-4" />
              </Button>
              {expandedSections.project ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </div>
          </div>
        </CardHeader>
        {expandedSections.project && (
          <CardContent className="border-t pt-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Project Number</p>
                <p className="font-medium">{projectData.projectNumber || '-'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Project Name</p>
                <p className="font-medium">{projectData.projectName || '-'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Project Type</p>
                <p className="font-medium">{projectData.projectType || '-'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Service Model</p>
                <Badge variant="outline">{projectData.serviceModel}</Badge>
              </div>
            </div>
          </CardContent>
        )}
      </Card>
      
      <Card>
        <CardHeader 
          className="cursor-pointer"
          onClick={() => toggleSection('parties')}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              <CardTitle className="text-base">Parties</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={(e) => { e.stopPropagation(); goToStep(3); }}
                data-testid="button-edit-parties"
              >
                <Edit2 className="h-4 w-4" />
              </Button>
              {expandedSections.parties ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </div>
          </div>
        </CardHeader>
        {expandedSections.parties && (
          <CardContent className="border-t pt-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Client</p>
                <p className="font-medium">{projectData.clientLegalName || '-'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Entity Type</p>
                <p className="font-medium">{projectData.clientEntityType || '-'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Signer</p>
                <p className="font-medium">{projectData.clientSignerName || '-'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Child LLC</p>
                <p className="font-medium">{projectData.childLlcName || '-'}</p>
              </div>
            </div>
          </CardContent>
        )}
      </Card>
      
      <Card>
        <CardHeader 
          className="cursor-pointer"
          onClick={() => toggleSection('property')}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Home className="h-5 w-5" />
              <CardTitle className="text-base">Property Details</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={(e) => { e.stopPropagation(); goToStep(5); }}
                data-testid="button-edit-property"
              >
                <Edit2 className="h-4 w-4" />
              </Button>
              {expandedSections.property ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </div>
          </div>
        </CardHeader>
        {expandedSections.property && (
          <CardContent className="border-t pt-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="col-span-2">
                <p className="text-muted-foreground">Site Address</p>
                <p className="font-medium">
                  {projectData.siteAddress ? 
                    `${projectData.siteAddress}, ${projectData.siteCity}, ${projectData.siteState} ${projectData.siteZip}` 
                    : '-'}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Total Units</p>
                <p className="font-medium">{projectData.totalUnits}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Unit Model(s)</p>
                <p className="font-medium">
                  {projectData.units.slice(0, projectData.totalUnits).map(u => u.model || 'Not specified').join(', ')}
                </p>
              </div>
            </div>
          </CardContent>
        )}
      </Card>
      
      <Card>
        <CardHeader 
          className="cursor-pointer"
          onClick={() => toggleSection('financial')}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              <CardTitle className="text-base">Financial Terms</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={(e) => { e.stopPropagation(); goToStep(7); }}
                data-testid="button-edit-financial"
              >
                <Edit2 className="h-4 w-4" />
              </Button>
              {expandedSections.financial ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </div>
          </div>
        </CardHeader>
        {expandedSections.financial && (
          <CardContent className="border-t pt-4">
            {pricingSummary && pricingSummary.unitCount > 0 ? (
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Total Design Fee</p>
                  <p className="font-medium" data-testid="review-design-fee">
                    {formatCurrencyCents(pricingSummary.breakdown.totalDesignFee)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Offsite Manufacturing</p>
                  <p className="font-medium" data-testid="review-offsite">
                    {formatCurrencyCents(pricingSummary.breakdown.totalOffsite)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Onsite Estimate</p>
                  <p className="font-medium" data-testid="review-onsite">
                    {formatCurrencyCents(pricingSummary.breakdown.totalOnsite)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Grand Total</p>
                  <p className="font-medium text-primary" data-testid="review-grand-total">
                    {formatCurrencyCents(pricingSummary.grandTotal)}
                  </p>
                </div>
                <div className="col-span-2">
                  <Badge variant="secondary" className="text-xs">
                    {pricingSummary.unitCount} Unit{pricingSummary.unitCount !== 1 ? 's' : ''} Selected
                  </Badge>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No pricing data available. Add units in Step 1 to calculate pricing.
              </p>
            )}
          </CardContent>
        )}
      </Card>
      
      <Card>
        <CardHeader 
          className="cursor-pointer"
          onClick={() => toggleSection('schedule')}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              <CardTitle className="text-base">Schedule & Warranty</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={(e) => { e.stopPropagation(); goToStep(8); }}
                data-testid="button-edit-schedule"
              >
                <Edit2 className="h-4 w-4" />
              </Button>
              {expandedSections.schedule ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </div>
          </div>
        </CardHeader>
        {expandedSections.schedule && (
          <CardContent className="border-t pt-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Effective Date</p>
                <p className="font-medium">{formatDate(projectData.effectiveDate)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Jurisdiction</p>
                <p className="font-medium">{projectData.projectState || '-'}, {projectData.projectCounty || '-'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Federal District</p>
                <p className="font-medium">{projectData.projectFederalDistrict || '-'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Arbitration</p>
                <p className="font-medium">{projectData.arbitrationProvider || '-'}</p>
              </div>
            </div>
          </CardContent>
        )}
      </Card>
      
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Contracts to be Generated
            </CardTitle>
            <Button 
              variant="outline" 
              size="sm" 
              className="gap-1"
              onClick={() => setClausePreviewOpen(true)}
              data-testid="button-preview-clauses"
            >
              <Eye className="h-4 w-4" />
              Preview Clauses
            </Button>
          </div>
          <CardDescription>
            Based on your selections, the following contracts will be generated
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {contracts.map((contract) => (
              <div 
                key={contract.type}
                className="p-4 border rounded-lg space-y-2"
              >
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  <span className="font-medium">{contract.name}</span>
                </div>
                <p className="text-sm text-muted-foreground">{contract.description}</p>
                <Badge variant="secondary">{contract.clauseCount} clauses</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Pre-Generation Confirmation</CardTitle>
          <CardDescription>
            Please confirm you have reviewed all information
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3">
            <Checkbox
              id="confirmation"
              checked={confirmationChecked}
              onCheckedChange={(checked) => setConfirmationChecked(checked as boolean)}
              data-testid="checkbox-confirmation"
            />
            <label 
              htmlFor="confirmation" 
              className="text-sm leading-relaxed cursor-pointer"
            >
              I have reviewed all contract information and confirm that the data is accurate. 
              I understand that the generated contracts will use this information and any 
              changes will require regeneration.
            </label>
          </div>
          
          <div className="flex gap-4 pt-4">
            <Button 
              className="flex-1 gap-2"
              disabled={!allRequiredComplete || !confirmationChecked}
              onClick={handleGenerateContracts}
              data-testid="button-generate-contracts"
            >
              <Sparkles className="h-4 w-4" />
              Generate Contract Package
            </Button>
          </div>
        </CardContent>
      </Card>
      
      <Dialog open={clausePreviewOpen} onOpenChange={setClausePreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Clause Preview
            </DialogTitle>
            <DialogDescription>
              Review the clauses that will be included in each contract
            </DialogDescription>
          </DialogHeader>
          <Tabs defaultValue="ONE" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="ONE" data-testid="tab-one-agreement">ONE Agreement</TabsTrigger>
              <TabsTrigger value="MANUFACTURING" data-testid="tab-manufacturing">Manufacturing</TabsTrigger>
              <TabsTrigger value="ONSITE" data-testid="tab-onsite">OnSite</TabsTrigger>
            </TabsList>
            {contracts.map((contract) => (
              <TabsContent key={contract.type} value={contract.type} className="mt-4">
                <ScrollArea className="h-[400px] pr-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="font-medium">{contract.name}</h3>
                        <p className="text-sm text-muted-foreground">{contract.description}</p>
                      </div>
                      <Badge variant="secondary">{contract.clauseCount} clauses</Badge>
                    </div>
                    {contract.clauses.map((clause) => (
                      <div 
                        key={clause.section}
                        className="p-3 border rounded-lg hover-elevate"
                        data-testid={`clause-${contract.type.toLowerCase()}-${clause.section}`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="text-xs">{clause.section}</Badge>
                          <span className="font-medium text-sm">{clause.name}</span>
                        </div>
                        <p className="text-sm text-muted-foreground">{clause.description}</p>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </TabsContent>
            ))}
          </Tabs>
          <div className="flex justify-end pt-4 border-t">
            <Button 
              variant="outline" 
              onClick={() => setClausePreviewOpen(false)}
              data-testid="button-close-preview"
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

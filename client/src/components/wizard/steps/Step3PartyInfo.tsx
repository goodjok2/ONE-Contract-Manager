import { useWizard, US_STATES, ENTITY_TYPES } from '../WizardContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UserCheck, Mail, Phone, Briefcase, Shield, AlertCircle } from 'lucide-react';

export const Step3PartyInfo: React.FC = () => {
  const { 
    wizardState, 
    updateProjectData
  } = useWizard();
  
  const { projectData, validationErrors } = wizardState;
  
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-primary" />
            Client Information
          </CardTitle>
          <CardDescription>
            Enter details about the client purchasing the home
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="clientLegalName">
              Client Legal Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="clientLegalName"
              value={projectData.clientLegalName}
              onChange={(e) => updateProjectData({ clientLegalName: e.target.value })}
              placeholder="e.g., John and Jane Smith"
              className={validationErrors.clientLegalName ? 'border-red-500' : ''}
              data-testid="input-client-legal-name"
            />
            {validationErrors.clientLegalName && (
              <p className="text-sm text-red-500">{validationErrors.clientLegalName}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Full legal name(s) as they should appear on the contract
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="clientState">
                Client State <span className="text-red-500">*</span>
              </Label>
              <Select
                value={projectData.clientState}
                onValueChange={(value) => updateProjectData({ clientState: value })}
              >
                <SelectTrigger
                  id="clientState"
                  className={validationErrors.clientState ? 'border-red-500' : ''}
                  data-testid="select-client-state"
                >
                  <SelectValue placeholder="Select a state..." />
                </SelectTrigger>
                <SelectContent>
                  {US_STATES.map(state => (
                    <SelectItem key={state.value} value={state.value}>{state.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {validationErrors.clientState && (
                <p className="text-sm text-red-500">{validationErrors.clientState}</p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="clientEntityType">
                Client Entity Type <span className="text-red-500">*</span>
              </Label>
              <Select
                value={projectData.clientEntityType}
                onValueChange={(value) => updateProjectData({ clientEntityType: value })}
              >
                <SelectTrigger
                  id="clientEntityType"
                  className={validationErrors.clientEntityType ? 'border-red-500' : ''}
                  data-testid="select-client-entity-type"
                >
                  <SelectValue placeholder="Select entity type..." />
                </SelectTrigger>
                <SelectContent>
                  {ENTITY_TYPES.map(type => (
                    <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {validationErrors.clientEntityType && (
                <p className="text-sm text-red-500">{validationErrors.clientEntityType}</p>
              )}
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="clientEmail" className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Client Email <span className="text-red-500">*</span>
              </Label>
              <Input
                id="clientEmail"
                type="email"
                value={projectData.clientEmail}
                onChange={(e) => updateProjectData({ clientEmail: e.target.value })}
                placeholder="e.g., client@example.com"
                className={validationErrors.clientEmail ? 'border-red-500' : ''}
                data-testid="input-client-email"
              />
              {validationErrors.clientEmail && (
                <p className="text-sm text-red-500">{validationErrors.clientEmail}</p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="clientPhone" className="flex items-center gap-2">
                <Phone className="h-4 w-4" />
                Client Phone
              </Label>
              <Input
                id="clientPhone"
                type="tel"
                value={projectData.clientPhone}
                onChange={(e) => updateProjectData({ clientPhone: e.target.value })}
                placeholder="e.g., (555) 123-4567"
                data-testid="input-client-phone"
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="clientSignerName">
              Client Signer Name (for signature) <span className="text-red-500">*</span>
            </Label>
            <Input
              id="clientSignerName"
              value={projectData.clientSignerName}
              onChange={(e) => updateProjectData({ clientSignerName: e.target.value })}
              placeholder="Full name of person signing the contract"
              className={validationErrors.clientSignerName ? 'border-red-500' : ''}
              data-testid="input-client-signer-name"
            />
            {validationErrors.clientSignerName && (
              <p className="text-sm text-red-500">{validationErrors.clientSignerName}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Used for: CLIENT_SIGNER_NAME variable
            </p>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="clientFullName">
              Client Full Name (for documents)
            </Label>
            <Input
              id="clientFullName"
              value={projectData.clientFullName}
              onChange={(e) => updateProjectData({ clientFullName: e.target.value })}
              placeholder="Defaults to Client Legal Name"
              data-testid="input-client-full-name"
            />
            <p className="text-xs text-muted-foreground">
              Used for: CLIENT_FULL_NAME variable (leave blank to use Legal Name)
            </p>
          </div>
          
          {projectData.clientEntityType !== 'Individual' && (
            <div className="space-y-2">
              <Label htmlFor="clientTitle">
                Client Title
              </Label>
              <Input
                id="clientTitle"
                value={projectData.clientTitle}
                onChange={(e) => updateProjectData({ clientTitle: e.target.value })}
                placeholder={
                  projectData.clientEntityType === 'LLC' ? 'e.g., Managing Member' : 
                  projectData.clientEntityType === 'Corporation' ? 'e.g., President, CEO' :
                  projectData.clientEntityType === 'Trust' ? 'e.g., Trustee' : 
                  'e.g., Partner'
                }
                data-testid="input-client-title"
              />
              <p className="text-xs text-muted-foreground">
                Used for: CLIENT_TITLE variable
              </p>
            </div>
          )}
        </CardContent>
      </Card>
      
      {projectData.serviceModel === 'CRC' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Briefcase className="h-5 w-5 text-primary" />
              Contractor Information
              <Badge variant="outline" className="ml-2">CRC Required</Badge>
            </CardTitle>
            <CardDescription className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 mt-0.5 text-amber-500 shrink-0" />
              <span>
                Since you selected CRC (Client-Retained Contractor), please provide the general contractor details
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contractorName">
                  Contractor Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="contractorName"
                  value={projectData.contractorName}
                  onChange={(e) => updateProjectData({ contractorName: e.target.value })}
                  placeholder="e.g., ABC Construction LLC"
                  className={validationErrors.contractorName ? 'border-red-500' : ''}
                  data-testid="input-contractor-name"
                />
                {validationErrors.contractorName && (
                  <p className="text-sm text-red-500">{validationErrors.contractorName}</p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="contractorLicense" className="flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  License Number <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="contractorLicense"
                  value={projectData.contractorLicense}
                  onChange={(e) => updateProjectData({ contractorLicense: e.target.value })}
                  placeholder="e.g., CSLB #1234567"
                  className={validationErrors.contractorLicense ? 'border-red-500' : ''}
                  data-testid="input-contractor-license"
                />
                {validationErrors.contractorLicense && (
                  <p className="text-sm text-red-500">{validationErrors.contractorLicense}</p>
                )}
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="contractorAddress">
                Contractor Address <span className="text-red-500">*</span>
              </Label>
              <Input
                id="contractorAddress"
                value={projectData.contractorAddress}
                onChange={(e) => updateProjectData({ contractorAddress: e.target.value })}
                placeholder="e.g., 123 Main St, Suite 100, Los Angeles, CA 90001"
                className={validationErrors.contractorAddress ? 'border-red-500' : ''}
                data-testid="input-contractor-address"
              />
              {validationErrors.contractorAddress && (
                <p className="text-sm text-red-500">{validationErrors.contractorAddress}</p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="contractorInsurance">
                Insurance Policy Number <span className="text-red-500">*</span>
              </Label>
              <Input
                id="contractorInsurance"
                value={projectData.contractorInsurance}
                onChange={(e) => updateProjectData({ contractorInsurance: e.target.value })}
                placeholder="e.g., POL-2024-123456"
                className={validationErrors.contractorInsurance ? 'border-red-500' : ''}
                data-testid="input-contractor-insurance"
              />
              {validationErrors.contractorInsurance && (
                <p className="text-sm text-red-500">{validationErrors.contractorInsurance}</p>
              )}
              <p className="text-xs text-muted-foreground">
                General liability insurance policy number
              </p>
            </div>
          </CardContent>
        </Card>
      )}
      
      <Card className="bg-muted/30">
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Contract Variables</p>
              <p className="text-xs text-muted-foreground">
                This step populates {projectData.serviceModel === 'CRC' ? '10+' : '7+'} contract variables
              </p>
            </div>
            <Badge variant="secondary" className="text-xs">
              CLIENT_LEGAL_NAME, CLIENT_STATE, CLIENT_ENTITY_TYPE, CLIENT_EMAIL, etc.
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

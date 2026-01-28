import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useWizard, US_STATES, ENTITY_TYPES } from '../WizardContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { UserCheck, Mail, Phone, Briefcase, Shield, AlertCircle, Factory, HardHat, Plus } from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';

interface ContractorEntity {
  id: number;
  contractorType: string;
  legalName: string;
  formationState?: string;
  entityType?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  licenseNumber?: string;
  licenseState?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  isActive: boolean;
}

export const Step3PartyInfo: React.FC = () => {
  const { 
    wizardState, 
    updateProjectData
  } = useWizard();
  
  const { projectData, validationErrors } = wizardState;
  
  // State for add new contractor dialogs
  const [showManufacturerDialog, setShowManufacturerDialog] = useState(false);
  const [showOnsiteDialog, setShowOnsiteDialog] = useState(false);
  const [newContractorName, setNewContractorName] = useState('');
  const [newContractorAddress, setNewContractorAddress] = useState('');
  const [newContractorState, setNewContractorState] = useState('');
  const [newContractorLicense, setNewContractorLicense] = useState('');
  
  // Fetch manufacturer entities
  const { data: manufacturers = [] } = useQuery<ContractorEntity[]>({
    queryKey: ['/api/contractor-entities/type/manufacturer'],
  });
  
  // Fetch onsite contractor entities
  const { data: onsiteContractors = [] } = useQuery<ContractorEntity[]>({
    queryKey: ['/api/contractor-entities/type/onsite'],
  });
  
  // Create contractor entity mutation
  const createContractorMutation = useMutation({
    mutationFn: async (data: { contractorType: string; legalName: string; address?: string; formationState?: string; licenseNumber?: string }) => {
      const response = await apiRequest('POST', '/api/contractor-entities', data);
      if (!response.ok) {
        throw new Error('Failed to create contractor entity');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contractor-entities'] });
      queryClient.invalidateQueries({ queryKey: ['/api/contractor-entities/type/manufacturer'] });
      queryClient.invalidateQueries({ queryKey: ['/api/contractor-entities/type/onsite'] });
    },
    onError: (error) => {
      console.error('Failed to create contractor entity:', error);
    }
  });
  
  // Handle manufacturer selection
  const handleManufacturerChange = (value: string) => {
    if (value === 'add-new') {
      setShowManufacturerDialog(true);
      return;
    }
    const selected = manufacturers.find(m => m.id.toString() === value);
    if (selected) {
      updateProjectData({
        manufacturerEntityId: selected.id,
        manufacturerName: selected.legalName,
        manufacturerAddress: selected.address || ''
      });
    }
  };
  
  // Handle onsite contractor selection
  const handleOnsiteChange = (value: string) => {
    if (value === 'add-new') {
      setShowOnsiteDialog(true);
      return;
    }
    const selected = onsiteContractors.find(c => c.id.toString() === value);
    if (selected) {
      updateProjectData({
        onsiteContractorEntityId: selected.id,
        onsiteContractorName: selected.legalName,
        onsiteContractorAddress: selected.address || ''
      });
    }
  };
  
  // Create new manufacturer
  const handleCreateManufacturer = async () => {
    try {
      const result = await createContractorMutation.mutateAsync({
        contractorType: 'manufacturer',
        legalName: newContractorName,
        address: newContractorAddress,
        formationState: newContractorState,
        licenseNumber: newContractorLicense
      });
      updateProjectData({
        manufacturerEntityId: result.id,
        manufacturerName: result.legalName,
        manufacturerAddress: result.address || ''
      });
      setShowManufacturerDialog(false);
      resetNewContractorForm();
    } catch (error) {
      console.error('Failed to create manufacturer:', error);
    }
  };
  
  // Create new onsite contractor
  const handleCreateOnsite = async () => {
    try {
      const result = await createContractorMutation.mutateAsync({
        contractorType: 'onsite',
        legalName: newContractorName,
        address: newContractorAddress,
        formationState: newContractorState,
        licenseNumber: newContractorLicense
      });
      updateProjectData({
        onsiteContractorEntityId: result.id,
        onsiteContractorName: result.legalName,
        onsiteContractorAddress: result.address || ''
      });
      setShowOnsiteDialog(false);
      resetNewContractorForm();
    } catch (error) {
      console.error('Failed to create onsite contractor:', error);
    }
  };
  
  const resetNewContractorForm = () => {
    setNewContractorName('');
    setNewContractorAddress('');
    setNewContractorState('');
    setNewContractorLicense('');
  };
  
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
      
      {/* Manufacturer Selection - Always shown */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Factory className="h-5 w-5 text-primary" />
            Manufacturer
            <Badge variant="outline" className="ml-2">Subcontract</Badge>
          </CardTitle>
          <CardDescription>
            Select the manufacturing company for the modular home production
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="manufacturerSelect">
              Manufacturer <span className="text-red-500">*</span>
            </Label>
            <Select
              value={projectData.manufacturerEntityId?.toString() || ''}
              onValueChange={handleManufacturerChange}
            >
              <SelectTrigger
                id="manufacturerSelect"
                className={validationErrors.manufacturerName ? 'border-red-500' : ''}
                data-testid="select-manufacturer"
              >
                <SelectValue placeholder="Select a manufacturer..." />
              </SelectTrigger>
              <SelectContent>
                {manufacturers.map(m => (
                  <SelectItem key={m.id} value={m.id.toString()}>
                    {m.legalName}
                    {m.formationState && <span className="text-muted-foreground ml-2">({m.formationState})</span>}
                  </SelectItem>
                ))}
                <SelectItem value="add-new" className="text-primary font-medium">
                  <span className="flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    Add New Manufacturer
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
            {validationErrors.manufacturerName && (
              <p className="text-sm text-red-500">{validationErrors.manufacturerName}</p>
            )}
          </div>
          
          {projectData.manufacturerName && (
            <div className="p-3 bg-muted/50 rounded-md space-y-1">
              <p className="text-sm font-medium">{projectData.manufacturerName}</p>
              {projectData.manufacturerAddress && (
                <p className="text-xs text-muted-foreground">{projectData.manufacturerAddress}</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* On-Site Contractor Selection - Always shown */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HardHat className="h-5 w-5 text-primary" />
            On-Site Contractor
            <Badge variant="outline" className="ml-2">Subcontract</Badge>
          </CardTitle>
          <CardDescription>
            Select the on-site installation contractor (leave empty to add later)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="onsiteSelect">
              On-Site Contractor
            </Label>
            <Select
              value={projectData.onsiteContractorEntityId?.toString() || ''}
              onValueChange={handleOnsiteChange}
            >
              <SelectTrigger
                id="onsiteSelect"
                data-testid="select-onsite-contractor"
              >
                <SelectValue placeholder="Select an on-site contractor..." />
              </SelectTrigger>
              <SelectContent>
                {onsiteContractors.map(c => (
                  <SelectItem key={c.id} value={c.id.toString()}>
                    {c.legalName}
                    {c.formationState && <span className="text-muted-foreground ml-2">({c.formationState})</span>}
                  </SelectItem>
                ))}
                <SelectItem value="add-new" className="text-primary font-medium">
                  <span className="flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    Add New On-Site Contractor
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {projectData.onsiteContractorName && (
            <div className="p-3 bg-muted/50 rounded-md space-y-1">
              <p className="text-sm font-medium">{projectData.onsiteContractorName}</p>
              {projectData.onsiteContractorAddress && (
                <p className="text-xs text-muted-foreground">{projectData.onsiteContractorAddress}</p>
              )}
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
                This step populates {projectData.serviceModel === 'CRC' ? '12+' : '10+'} contract variables
              </p>
            </div>
            <Badge variant="secondary" className="text-xs">
              CLIENT_LEGAL_NAME, MANUFACTURER_NAME, ONSITE_CONTRACTOR_NAME, etc.
            </Badge>
          </div>
        </CardContent>
      </Card>
      
      {/* Add New Manufacturer Dialog */}
      <Dialog open={showManufacturerDialog} onOpenChange={setShowManufacturerDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Manufacturer</DialogTitle>
            <DialogDescription>
              Create a new manufacturer entity for subcontracts
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="newManufacturerName">Legal Name <span className="text-red-500">*</span></Label>
              <Input
                id="newManufacturerName"
                value={newContractorName}
                onChange={(e) => setNewContractorName(e.target.value)}
                placeholder="e.g., ABC Manufacturing, LLC"
                data-testid="input-new-manufacturer-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newManufacturerAddress">Address</Label>
              <Input
                id="newManufacturerAddress"
                value={newContractorAddress}
                onChange={(e) => setNewContractorAddress(e.target.value)}
                placeholder="e.g., 123 Factory Dr, Phoenix, AZ 85001"
                data-testid="input-new-manufacturer-address"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="newManufacturerState">State</Label>
                <Select value={newContractorState} onValueChange={setNewContractorState}>
                  <SelectTrigger id="newManufacturerState" data-testid="select-new-manufacturer-state">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {US_STATES.map(state => (
                      <SelectItem key={state.value} value={state.value}>{state.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="newManufacturerLicense">License #</Label>
                <Input
                  id="newManufacturerLicense"
                  value={newContractorLicense}
                  onChange={(e) => setNewContractorLicense(e.target.value)}
                  placeholder="e.g., MFG-12345"
                  data-testid="input-new-manufacturer-license"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowManufacturerDialog(false)}>Cancel</Button>
            <Button 
              onClick={handleCreateManufacturer} 
              disabled={!newContractorName || createContractorMutation.isPending}
              data-testid="button-save-manufacturer"
            >
              {createContractorMutation.isPending ? 'Saving...' : 'Save Manufacturer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Add New On-Site Contractor Dialog */}
      <Dialog open={showOnsiteDialog} onOpenChange={setShowOnsiteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New On-Site Contractor</DialogTitle>
            <DialogDescription>
              Create a new on-site contractor entity for subcontracts
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="newOnsiteName">Legal Name <span className="text-red-500">*</span></Label>
              <Input
                id="newOnsiteName"
                value={newContractorName}
                onChange={(e) => setNewContractorName(e.target.value)}
                placeholder="e.g., XYZ Construction, Inc."
                data-testid="input-new-onsite-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newOnsiteAddress">Address</Label>
              <Input
                id="newOnsiteAddress"
                value={newContractorAddress}
                onChange={(e) => setNewContractorAddress(e.target.value)}
                placeholder="e.g., 456 Builder Blvd, Los Angeles, CA 90001"
                data-testid="input-new-onsite-address"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="newOnsiteState">State</Label>
                <Select value={newContractorState} onValueChange={setNewContractorState}>
                  <SelectTrigger id="newOnsiteState" data-testid="select-new-onsite-state">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {US_STATES.map(state => (
                      <SelectItem key={state.value} value={state.value}>{state.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="newOnsiteLicense">License #</Label>
                <Input
                  id="newOnsiteLicense"
                  value={newContractorLicense}
                  onChange={(e) => setNewContractorLicense(e.target.value)}
                  placeholder="e.g., CSLB-67890"
                  data-testid="input-new-onsite-license"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowOnsiteDialog(false)}>Cancel</Button>
            <Button 
              onClick={handleCreateOnsite} 
              disabled={!newContractorName || createContractorMutation.isPending}
              data-testid="button-save-onsite"
            >
              {createContractorMutation.isPending ? 'Saving...' : 'Save On-Site Contractor'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

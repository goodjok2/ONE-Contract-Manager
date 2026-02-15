import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, Bell, Palette, Wrench, Loader2, CheckCircle2, AlertTriangle, Upload, FileText } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { useState, useRef } from "react";
import { useToast } from "@/hooks/use-toast";

export default function Settings() {
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();
  const [diagnosing, setDiagnosing] = useState(false);
  const [diagnosticResult, setDiagnosticResult] = useState<any>(null);
  
  const [selectedContractType, setSelectedContractType] = useState("MASTER_EF");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importPreview, setImportPreview] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setImportPreview(null);
    }
  };

  const previewImport = async () => {
    if (!selectedFile) return;
    setImporting(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('contractType', selectedContractType);
      
      const res = await fetch('/api/system/ingest-docx/preview', {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) throw new Error('Preview failed');
      const result = await res.json();
      setImportPreview(result);
      toast({
        title: 'Preview Ready',
        description: `Found ${result.totalClauses} clauses (${result.clausesWithContent} with content)`,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to preview DOCX file',
        variant: 'destructive',
      });
    } finally {
      setImporting(false);
    }
  };

  const confirmImport = async () => {
    if (!selectedFile) return;
    setImporting(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('contractType', selectedContractType);
      formData.append('purgeExisting', 'true');
      
      const res = await fetch('/api/system/ingest-docx/import', {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) throw new Error('Import failed');
      const result = await res.json();
      toast({
        title: 'Import Complete',
        description: `Imported ${result.clausesImported} clauses for ${result.contractType}`,
      });
      setSelectedFile(null);
      setImportPreview(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to import DOCX file',
        variant: 'destructive',
      });
    } finally {
      setImporting(false);
    }
  };

  const runDiagnostics = async (repair: boolean = false) => {
    setDiagnosing(true);
    setDiagnosticResult(null);
    try {
      const url = repair ? "/api/system/diagnose-templates?repair=true" : "/api/system/diagnose-templates";
      const res = await fetch(url);
      if (!res.ok) throw new Error("Diagnostics failed");
      const result = await res.json();
      setDiagnosticResult(result);
      toast({
        title: repair ? "Repair Complete" : "Diagnostics Complete",
        description: `Found ${result.summary?.totalTemplates || 0} templates with ${result.summary?.totalClauses || 0} total clauses.`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to run diagnostics. Check console for details.",
        variant: "destructive",
      });
    } finally {
      setDiagnosing(false);
    }
  };

  return (
    <div className="flex-1 p-6 md:p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-foreground" data-testid="text-page-title">
          Settings
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your account and application preferences
        </p>
      </div>

      <div className="max-w-2xl space-y-6">
        <Card data-testid="card-company-settings">
          <CardHeader>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                <Building2 className="h-4 w-4 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Company Information</CardTitle>
                <CardDescription>
                  Configure your company details for contracts
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="company-name">Company Name</Label>
              <Input 
                id="company-name" 
                defaultValue="Dvele Partners LLC"
                data-testid="input-company-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="default-state">Default State of Formation</Label>
              <Input 
                id="default-state" 
                defaultValue="Delaware"
                data-testid="input-default-state"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="registered-agent">Default Registered Agent</Label>
              <Input 
                id="registered-agent" 
                placeholder="Enter registered agent name"
                data-testid="input-registered-agent"
              />
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-notification-settings">
          <CardHeader>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                <Bell className="h-4 w-4 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Notifications</CardTitle>
                <CardDescription>
                  Configure how you receive updates
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="space-y-0.5">
                <Label>Contract Status Updates</Label>
                <p className="text-xs text-muted-foreground">
                  Get notified when contracts change status
                </p>
              </div>
              <Switch defaultChecked data-testid="switch-contract-updates" />
            </div>
            <Separator />
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="space-y-0.5">
                <Label>LLC Formation Alerts</Label>
                <p className="text-xs text-muted-foreground">
                  Receive alerts for LLC formation milestones
                </p>
              </div>
              <Switch defaultChecked data-testid="switch-llc-alerts" />
            </div>
            <Separator />
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="space-y-0.5">
                <Label>Expiration Reminders</Label>
                <p className="text-xs text-muted-foreground">
                  Get reminded before contracts expire
                </p>
              </div>
              <Switch defaultChecked data-testid="switch-expiration-reminders" />
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-appearance-settings">
          <CardHeader>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                <Palette className="h-4 w-4 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Appearance</CardTitle>
                <CardDescription>
                  Customize the look and feel
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="space-y-0.5">
                <Label>Dark Mode</Label>
                <p className="text-xs text-muted-foreground">
                  Switch between light and dark themes
                </p>
              </div>
              <Switch 
                checked={theme === "dark"}
                onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
                data-testid="switch-dark-mode" 
              />
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-system-diagnostics">
          <CardHeader>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                <Wrench className="h-4 w-4 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">System Diagnostics</CardTitle>
                <CardDescription>
                  Check and repair contract template configuration
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="space-y-0.5">
                <Label>Template Diagnostics</Label>
                <p className="text-xs text-muted-foreground">
                  Verify templates have clause data and repair if needed
                </p>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => runDiagnostics(false)}
                  disabled={diagnosing}
                  data-testid="button-diagnose-templates"
                >
                  {diagnosing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Diagnose
                </Button>
                <Button 
                  variant="default" 
                  size="sm"
                  onClick={() => runDiagnostics(true)}
                  disabled={diagnosing}
                  data-testid="button-repair-templates"
                >
                  {diagnosing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Diagnose & Repair
                </Button>
              </div>
            </div>
            {diagnosticResult && (
              <>
                <Separator />
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    {diagnosticResult.summary?.healthyTemplates > 0 ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-yellow-500" />
                    )}
                    <span className="font-medium">Diagnostic Results</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-muted-foreground">
                    <span>Total Clauses:</span>
                    <span className="font-mono">{diagnosticResult.summary?.totalClauses || 0}</span>
                    <span>Total Templates:</span>
                    <span className="font-mono">{diagnosticResult.summary?.totalTemplates || 0}</span>
                    <span>Healthy Templates:</span>
                    <span className="font-mono text-green-600">{diagnosticResult.summary?.healthyTemplates || 0}</span>
                    <span>Needing Repair:</span>
                    <span className="font-mono text-yellow-600">{diagnosticResult.summary?.templatesNeedingRepair || 0}</span>
                  </div>
                  {diagnosticResult.templateStatus?.map((t: any) => (
                    <div key={t.id} className="flex items-center gap-2 text-xs bg-muted/50 p-2 rounded">
                      <span className="font-medium">{t.contractType}:</span>
                      <span>{t.templateClausesCount} clauses</span>
                      <span className={t.status === 'healthy' ? 'text-green-600' : 'text-yellow-600'}>
                        ({t.status})
                      </span>
                    </div>
                  ))}
                  {diagnosticResult.repairActions?.length > 0 && (
                    <div className="mt-2 text-xs">
                      <span className="font-medium">Repair Actions:</span>
                      {diagnosticResult.repairActions.map((a: any, i: number) => (
                        <div key={i} className="text-muted-foreground">
                          {a.action}: {a.contractType || a.type} - {a.status}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-template-import">
          <CardHeader>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                <Upload className="h-4 w-4 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Contract Template Import</CardTitle>
                <CardDescription>
                  Upload and import contract templates from Word documents
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Contract Type</Label>
                <Select 
                  value={selectedContractType} 
                  onValueChange={setSelectedContractType}
                >
                  <SelectTrigger data-testid="select-contract-type">
                    <SelectValue placeholder="Select contract type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MASTER_EF">Master Purchase Agreement</SelectItem>
                    <SelectItem value="ONE">ONE Agreement (Archived)</SelectItem>
                    <SelectItem value="MANUFACTURING">Manufacturing Subcontract (Archived)</SelectItem>
                    <SelectItem value="ONSITE">On-Site Subcontract (Archived)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>DOCX File</Label>
                <Input
                  ref={fileInputRef}
                  type="file"
                  accept=".docx"
                  onChange={handleFileSelect}
                  data-testid="input-docx-file"
                />
              </div>
            </div>
            
            {selectedFile && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <FileText className="h-4 w-4" />
                <span>{selectedFile.name}</span>
              </div>
            )}
            
            <div className="flex gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={previewImport}
                disabled={!selectedFile || importing}
                data-testid="button-preview-import"
              >
                {importing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Preview
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={confirmImport}
                disabled={!selectedFile || importing}
                data-testid="button-confirm-import"
              >
                {importing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Purge & Import
              </Button>
            </div>

            {importPreview && (
              <>
                <Separator />
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span className="font-medium">Parse Preview</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-muted-foreground">
                    <span>Contract Type:</span>
                    <span className="font-mono">{importPreview.contractType}</span>
                    <span>Total Clauses:</span>
                    <span className="font-mono">{importPreview.totalClauses}</span>
                    <span>With Content:</span>
                    <span className="font-mono text-green-600">{importPreview.clausesWithContent}</span>
                  </div>
                  <div className="mt-2 max-h-48 overflow-y-auto space-y-1">
                    {importPreview.preview?.slice(0, 10).map((c: any, i: number) => (
                      <div key={i} className="text-xs bg-muted/50 p-2 rounded">
                        <span className="font-medium">[L{c.level}]</span>{' '}
                        <span>{c.headerText}</span>{' '}
                        <span className="text-muted-foreground">({c.bodyLength} chars)</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3 flex-wrap">
          <Button variant="outline" data-testid="button-cancel">
            Cancel
          </Button>
          <Button data-testid="button-save-settings">
            Save Changes
          </Button>
        </div>
      </div>
    </div>
  );
}

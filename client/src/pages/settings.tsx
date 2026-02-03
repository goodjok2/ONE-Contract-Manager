import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Building2, Bell, Palette, Wrench, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

export default function Settings() {
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();
  const [diagnosing, setDiagnosing] = useState(false);
  const [diagnosticResult, setDiagnosticResult] = useState<any>(null);

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

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Building2, Bell, Palette } from "lucide-react";
import { useTheme } from "@/components/theme-provider";

export default function Settings() {
  const { theme, setTheme } = useTheme();

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

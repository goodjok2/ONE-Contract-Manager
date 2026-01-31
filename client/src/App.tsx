import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import AgreementsNew from "@/pages/agreements-new";
import LLCAdmin from "@/pages/llc-admin";
import LLCDetail from "@/pages/llc-detail";
import Settings from "@/pages/settings";
import ClauseLibrary from "@/pages/clause-library";
import Contracts from "@/pages/contracts";
import ContractDetail from "@/pages/contract-detail";
import Templates from "@/pages/templates";
import ContractPreview from "@/pages/contract-preview";
import GenerateContracts from "@/pages/generate-contracts";
import VariableMappings from "@/pages/variable-mappings";
import TemplatesUpload from "@/pages/templates-upload";
import Exhibits from "@/pages/exhibits";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/agreements/new" component={AgreementsNew} />
      <Route path="/clause-library" component={ClauseLibrary} />
      <Route path="/exhibits" component={Exhibits} />
      <Route path="/contract-preview" component={ContractPreview} />
      <Route path="/generate-contracts" component={GenerateContracts} />
      <Route path="/contracts" component={Contracts} />
      <Route path="/contracts/:id" component={ContractDetail} />
      <Route path="/templates" component={Templates} />
      <Route path="/templates-upload" component={TemplatesUpload} />
      <Route path="/llc-admin" component={LLCAdmin} />
      <Route path="/llc-admin/:id" component={LLCDetail} />
      <Route path="/variable-mappings" component={VariableMappings} />
      <Route path="/settings" component={Settings} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const sidebarStyle = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <ThemeProvider defaultTheme="light" storageKey="dvele-ui-theme">
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <SidebarProvider style={sidebarStyle as React.CSSProperties}>
            <div className="flex min-h-screen w-full bg-background">
              <AppSidebar />
              <div className="flex flex-col flex-1">
                <header className="flex h-14 items-center justify-between gap-4 border-b px-4 md:px-6">
                  <SidebarTrigger data-testid="button-sidebar-toggle" />
                  <ThemeToggle />
                </header>
                <main className="flex-1 overflow-auto">
                  <Router />
                </main>
              </div>
            </div>
          </SidebarProvider>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;

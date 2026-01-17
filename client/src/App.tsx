import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import NewAgreement from "@/pages/new-agreement";
import LLCAdmin from "@/pages/llc-admin";
import Settings from "@/pages/settings";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/new-agreement" component={NewAgreement} />
      <Route path="/llc-admin" component={LLCAdmin} />
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
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <SidebarProvider style={sidebarStyle as React.CSSProperties}>
          <div className="flex min-h-screen w-full bg-background">
            <AppSidebar />
            <div className="flex flex-col flex-1">
              <header className="flex h-14 items-center gap-4 border-b px-4 md:px-6">
                <SidebarTrigger data-testid="button-sidebar-toggle" />
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
  );
}

export default App;

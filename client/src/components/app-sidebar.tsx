import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  Library, 
  FileCheck,
  Files,
  Building2,
  Settings,
  Eye,
  Wand2,
  Variable,
  Upload,
  FileCode,
  Scale
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarSeparator,
} from "@/components/ui/sidebar";

const mainNavItems = [
  {
    title: "Dashboard",
    url: "/",
    icon: LayoutDashboard,
  },
  {
    title: "Generate Contracts",
    url: "/generate-contracts",
    icon: Wand2,
  },
  {
    title: "Active Contracts",
    url: "/contracts",
    icon: FileCheck,
  },
  {
    title: "LLC Admin",
    url: "/llc-admin",
    icon: Building2,
  },
  {
    title: "Templates",
    url: "/templates",
    icon: Files,
  },
];

const configNavItems = [
  {
    title: "Clause Library",
    url: "/clause-library",
    icon: Library,
  },
  {
    title: "Exhibits",
    url: "/exhibits",
    icon: FileCode,
  },
  {
    title: "State Disclosures",
    url: "/state-disclosures",
    icon: Scale,
  },
  {
    title: "Import Templates",
    url: "/templates-upload",
    icon: Upload,
  },
  {
    title: "Variable Mappings",
    url: "/variable-mappings",
    icon: Variable,
  },
  {
    title: "Contract Preview",
    url: "/contract-preview",
    icon: Eye,
  },
  {
    title: "Settings",
    url: "/settings",
    icon: Settings,
  },
];

export function AppSidebar() {
  const [location] = useLocation();

  const isActive = (url: string) => {
    if (url === "/") return location === url;
    return location.startsWith(url);
  };

  return (
    <Sidebar>
      <SidebarHeader className="px-4 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">
            D
          </div>
          <div className="flex flex-col">
            <span className="text-base font-semibold text-sidebar-foreground" data-testid="text-app-title">
              Dvele ONE
            </span>
            <span className="text-xs text-muted-foreground">
              Contract Platform
            </span>
          </div>
        </div>
      </SidebarHeader>
      
      <SidebarSeparator />
      
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Main
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNavItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton 
                    asChild 
                    isActive={isActive(item.url)}
                    tooltip={item.title}
                  >
                    <Link 
                      href={item.url}
                      data-testid={`link-nav-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Configuration
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {configNavItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton 
                    asChild 
                    isActive={isActive(item.url)}
                    tooltip={item.title}
                  >
                    <Link 
                      href={item.url}
                      data-testid={`link-nav-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      
      <SidebarFooter className="px-4 py-4">
        <div className="text-xs text-muted-foreground">
          Version 1.0.0
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

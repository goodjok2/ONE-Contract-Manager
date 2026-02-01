import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  LayoutGrid,
  Eye,
  Code,
  RefreshCw,
  Box,
  Layers,
  DollarSign,
  Calendar,
  FileText,
} from "lucide-react";
import { Label } from "@/components/ui/label";

interface Project {
  id: number;
  project_number: string;
  name: string;
  status: string;
}

interface TableComponent {
  id: string;
  variableName: string;
  displayName: string;
  description: string;
  category: string;
  columns: string[];
  icon: React.ReactNode;
}

const TABLE_COMPONENTS: TableComponent[] = [
  {
    id: "pricing_breakdown",
    variableName: "{{PRICING_BREAKDOWN_TABLE}}",
    displayName: "Pricing Breakdown Table",
    description: "Displays the itemized pricing breakdown including base price, customizations, and totals.",
    category: "Financial",
    columns: ["Item", "Description", "Amount"],
    icon: <DollarSign className="h-5 w-5" />,
  },
  {
    id: "payment_schedule",
    variableName: "{{PAYMENT_SCHEDULE_TABLE}}",
    displayName: "Payment Schedule Table",
    description: "Shows the milestone-based payment schedule with dates and amounts.",
    category: "Financial",
    columns: ["Milestone", "Due Date", "Percentage", "Amount"],
    icon: <Calendar className="h-5 w-5" />,
  },
  {
    id: "unit_spec",
    variableName: "{{UNIT_SPEC_TABLE}}",
    displayName: "Unit Specification Table",
    description: "Lists all home units with their model, specifications, and pricing.",
    category: "Project",
    columns: ["Unit", "Model", "Bed/Bath", "Sq Ft", "Base Price", "Customizations", "Total"],
    icon: <Layers className="h-5 w-5" />,
  },
];

export default function ComponentLibrary() {
  const [selectedComponent, setSelectedComponent] = useState<TableComponent | null>(TABLE_COMPONENTS[0]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");

  const { data: projects, isLoading: projectsLoading } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
    queryFn: async () => {
      const response = await fetch("/api/projects");
      if (!response.ok) throw new Error("Failed to fetch projects");
      return response.json();
    },
  });

  const { data: previewHtml, isLoading: previewLoading, refetch: refetchPreview } = useQuery<{ html: string }>({
    queryKey: ["/api/components/preview", selectedComponent?.id, selectedProjectId],
    queryFn: async () => {
      if (!selectedComponent || !selectedProjectId) {
        return { html: "<p class='text-muted-foreground text-center py-8'>Select a project to preview live data</p>" };
      }
      const response = await fetch(`/api/components/preview/${selectedComponent.id}?projectId=${selectedProjectId}`);
      if (!response.ok) throw new Error("Failed to fetch preview");
      return response.json();
    },
    enabled: !!selectedComponent,
  });

  const sandboxProject = projects?.find(p => p.name.toLowerCase().includes("sandbox") || p.project_number.includes("SANDBOX"));

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <div className="p-4 border-b bg-background">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Box className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-semibold" data-testid="text-page-title">Component Library</h1>
            <Badge variant="secondary" className="ml-2">
              {TABLE_COMPONENTS.length} components
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-sm">Preview with Project:</Label>
            <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
              <SelectTrigger className="w-64" data-testid="select-project">
                <SelectValue placeholder="Select a project..." />
              </SelectTrigger>
              <SelectContent>
                {sandboxProject && (
                  <>
                    <SelectItem value={sandboxProject.id.toString()}>
                      <span className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">Sandbox</Badge>
                        {sandboxProject.name}
                      </span>
                    </SelectItem>
                    <Separator className="my-1" />
                  </>
                )}
                {projects?.filter(p => p.id !== sandboxProject?.id).map((project) => (
                  <SelectItem key={project.id} value={project.id.toString()}>
                    {project.project_number} - {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetchPreview()}
              disabled={previewLoading}
              data-testid="button-refresh-preview"
            >
              <RefreshCw className={`h-4 w-4 ${previewLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-[30%] border-r flex flex-col bg-muted/30">
          <div className="p-2 border-b bg-background">
            <h2 className="text-sm font-medium flex items-center gap-2">
              <LayoutGrid className="h-4 w-4" />
              Table Components
            </h2>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-2">
              {TABLE_COMPONENTS.map((component) => (
                <Card
                  key={component.id}
                  className={`cursor-pointer transition-colors hover-elevate ${
                    selectedComponent?.id === component.id ? 'border-primary bg-primary/5' : ''
                  }`}
                  onClick={() => setSelectedComponent(component)}
                  data-testid={`component-card-${component.id}`}
                >
                  <CardContent className="p-3">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-primary/10 rounded-md text-primary">
                        {component.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-sm truncate">{component.displayName}</h3>
                        <Badge variant="outline" className="mt-1 font-mono text-[10px]">
                          {component.variableName}
                        </Badge>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {component.description}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </div>

        <div className="w-[70%] flex flex-col overflow-hidden">
          {selectedComponent ? (
            <>
              <div className="p-4 border-b bg-background">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                      {selectedComponent.icon}
                      {selectedComponent.displayName}
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      {selectedComponent.description}
                    </p>
                  </div>
                  <Badge variant="secondary">{selectedComponent.category}</Badge>
                </div>
              </div>

              <div className="flex-1 overflow-auto p-4 space-y-4">
                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Code className="h-4 w-4" />
                      Variable Name
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <code className="block p-3 bg-muted rounded-md font-mono text-sm">
                      {selectedComponent.variableName}
                    </code>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Column Configuration
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {selectedComponent.columns.map((col, idx) => (
                        <Badge key={idx} variant="outline">
                          {col}
                        </Badge>
                      ))}
                    </div>
                    <Textarea
                      className="mt-3 font-mono text-xs"
                      rows={3}
                      value={JSON.stringify(selectedComponent.columns, null, 2)}
                      readOnly
                    />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Eye className="h-4 w-4" />
                      Live Preview
                      {selectedProjectId && (
                        <Badge variant="outline" className="ml-2">
                          Project #{selectedProjectId}
                        </Badge>
                      )}
                    </CardTitle>
                    <CardDescription>
                      {selectedProjectId 
                        ? "Rendered with actual project data" 
                        : "Select a project above to see live data"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {previewLoading ? (
                      <div className="space-y-2">
                        <Skeleton className="h-8 w-full" />
                        <Skeleton className="h-8 w-full" />
                        <Skeleton className="h-8 w-full" />
                      </div>
                    ) : (
                      <div 
                        className="border rounded-md p-4 bg-white dark:bg-gray-900 overflow-auto"
                        dangerouslySetInnerHTML={{ __html: previewHtml?.html || "" }}
                      />
                    )}
                  </CardContent>
                </Card>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <Box className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p className="text-lg">Select a component</p>
                <p className="text-sm mt-1">Choose a table component from the list</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

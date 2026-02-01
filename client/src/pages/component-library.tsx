import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
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
  Plus,
  Trash2,
  GripVertical,
  Type,
  Database,
  PenTool,
  Save,
  Edit,
  Table,
} from "lucide-react";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

interface Project {
  id: number;
  project_number: string;
  name: string;
  status: string;
}

interface TableColumn {
  header: string;
  type: "text" | "data_field" | "signature";
  width?: string;
  value: string;
}

interface TableDefinition {
  id: number;
  variable_name: string;
  display_name: string;
  description: string | null;
  columns: TableColumn[];
  is_active: boolean;
}

interface BuiltinComponent {
  id: string;
  variableName: string;
  displayName: string;
  description: string;
  category: string;
  columns: string[];
  icon: React.ReactNode;
  isBuiltin: true;
}

const BUILTIN_COMPONENTS: BuiltinComponent[] = [
  {
    id: "pricing_breakdown",
    variableName: "{{PRICING_BREAKDOWN_TABLE}}",
    displayName: "Pricing Breakdown Table",
    description: "Displays the itemized pricing breakdown including base price, customizations, and totals.",
    category: "Financial",
    columns: ["Item", "Description", "Amount"],
    icon: <DollarSign className="h-5 w-5" />,
    isBuiltin: true,
  },
  {
    id: "payment_schedule",
    variableName: "{{PAYMENT_SCHEDULE_TABLE}}",
    displayName: "Payment Schedule Table",
    description: "Shows the milestone-based payment schedule with dates and amounts.",
    category: "Financial",
    columns: ["Milestone", "Due Date", "Percentage", "Amount"],
    icon: <Calendar className="h-5 w-5" />,
    isBuiltin: true,
  },
  {
    id: "unit_spec",
    variableName: "{{UNIT_SPEC_TABLE}}",
    displayName: "Unit Specification Table",
    description: "Lists all home units with their model, specifications, and pricing.",
    category: "Project",
    columns: ["Unit", "Model", "Bed/Bath", "Sq Ft", "Base Price", "Customizations", "Total"],
    icon: <Layers className="h-5 w-5" />,
    isBuiltin: true,
  },
];

const COLUMN_TYPES = [
  { value: "text", label: "Static Text", icon: Type, description: "Fixed text content" },
  { value: "data_field", label: "Project Variable", icon: Database, description: "Dynamic data from project" },
  { value: "signature", label: "Signature Box", icon: PenTool, description: "Line for signatures/initials" },
];

function slugifyToVariable(name: string): string {
  return name
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, "")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "") + "_TABLE";
}

export default function ComponentLibrary() {
  const { toast } = useToast();
  const [selectedComponent, setSelectedComponent] = useState<BuiltinComponent | TableDefinition | null>(BUILTIN_COMPONENTS[0]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingTable, setEditingTable] = useState<TableDefinition | null>(null);
  
  const [newTableName, setNewTableName] = useState("");
  const [newTableDescription, setNewTableDescription] = useState("");
  const [newTableColumns, setNewTableColumns] = useState<TableColumn[]>([
    { header: "Column 1", type: "text", value: "", width: "" }
  ]);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const { data: projects, isLoading: projectsLoading } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const { data: customTables, isLoading: tablesLoading } = useQuery<TableDefinition[]>({
    queryKey: ["/api/table-definitions"],
  });

  const isBuiltin = (comp: BuiltinComponent | TableDefinition | null): comp is BuiltinComponent => {
    return comp !== null && "isBuiltin" in comp && comp.isBuiltin === true;
  };

  const getComponentId = () => {
    if (!selectedComponent) return "";
    if (isBuiltin(selectedComponent)) {
      return selectedComponent.id;
    }
    return `custom_${selectedComponent.id}`;
  };

  const { data: previewHtml, isLoading: previewLoading, refetch: refetchPreview } = useQuery<{ html: string }>({
    queryKey: ["/api/components/preview", getComponentId(), selectedProjectId],
    queryFn: async () => {
      const componentId = getComponentId();
      if (!componentId || !selectedProjectId) {
        return { html: "<p class='text-muted-foreground text-center py-8'>Select a project to preview live data</p>" };
      }
      const response = await fetch(`/api/components/preview/${componentId}?projectId=${selectedProjectId}`);
      if (!response.ok) throw new Error("Failed to fetch preview");
      return response.json();
    },
    enabled: !!selectedComponent,
  });

  const createTableMutation = useMutation({
    mutationFn: async (data: { variable_name: string; display_name: string; description: string; columns: TableColumn[] }) => {
      return apiRequest("POST", "/api/table-definitions", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/table-definitions"] });
      setIsCreateDialogOpen(false);
      resetForm();
      toast({ title: "Success", description: "Table component created successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to create table", variant: "destructive" });
    },
  });

  const updateTableMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<TableDefinition> }) => {
      return apiRequest("PATCH", `/api/table-definitions/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/table-definitions"] });
      setIsEditMode(false);
      setEditingTable(null);
      toast({ title: "Success", description: "Table component updated successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update table", variant: "destructive" });
    },
  });

  const deleteTableMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/table-definitions/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/table-definitions"] });
      setSelectedComponent(BUILTIN_COMPONENTS[0]);
      toast({ title: "Success", description: "Table component deleted" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to delete table", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setNewTableName("");
    setNewTableDescription("");
    setNewTableColumns([{ header: "Column 1", type: "text", value: "", width: "" }]);
  };

  const addColumn = () => {
    const cols = isEditMode && editingTable ? editingTable.columns : newTableColumns;
    const newCol: TableColumn = { header: `Column ${cols.length + 1}`, type: "text", value: "", width: "" };
    if (isEditMode && editingTable) {
      setEditingTable({ ...editingTable, columns: [...cols, newCol] });
    } else {
      setNewTableColumns([...cols, newCol]);
    }
  };

  const removeColumn = (index: number) => {
    const cols = isEditMode && editingTable ? editingTable.columns : newTableColumns;
    if (cols.length <= 1) return;
    const updated = cols.filter((_, i) => i !== index);
    if (isEditMode && editingTable) {
      setEditingTable({ ...editingTable, columns: updated });
    } else {
      setNewTableColumns(updated);
    }
  };

  const updateColumn = (index: number, field: keyof TableColumn, value: string) => {
    const cols = isEditMode && editingTable ? [...editingTable.columns] : [...newTableColumns];
    cols[index] = { ...cols[index], [field]: value };
    if (isEditMode && editingTable) {
      setEditingTable({ ...editingTable, columns: cols });
    } else {
      setNewTableColumns(cols);
    }
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    
    const cols = isEditMode && editingTable ? [...editingTable.columns] : [...newTableColumns];
    const [draggedItem] = cols.splice(draggedIndex, 1);
    cols.splice(index, 0, draggedItem);
    
    if (isEditMode && editingTable) {
      setEditingTable({ ...editingTable, columns: cols });
    } else {
      setNewTableColumns(cols);
    }
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const handleCreate = () => {
    if (!newTableName.trim()) {
      toast({ title: "Error", description: "Table name is required", variant: "destructive" });
      return;
    }
    createTableMutation.mutate({
      variable_name: slugifyToVariable(newTableName),
      display_name: newTableName,
      description: newTableDescription,
      columns: newTableColumns,
    });
  };

  const handleUpdate = () => {
    if (!editingTable) return;
    updateTableMutation.mutate({
      id: editingTable.id,
      data: {
        display_name: editingTable.display_name,
        description: editingTable.description,
        columns: editingTable.columns,
      },
    });
  };

  const startEdit = (table: TableDefinition) => {
    setEditingTable({ ...table });
    setIsEditMode(true);
  };

  const cancelEdit = () => {
    setIsEditMode(false);
    setEditingTable(null);
  };

  const sandboxProject = projects?.find(p => p.name.toLowerCase().includes("sandbox") || p.project_number.includes("SANDBOX"));
  const allComponents = [...BUILTIN_COMPONENTS, ...(customTables || [])];

  const renderColumnEditor = (columns: TableColumn[], isDialog: boolean = false) => (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <Label className="text-sm font-medium">Columns</Label>
        <Button size="sm" variant="outline" onClick={addColumn} data-testid="button-add-column">
          <Plus className="h-4 w-4 mr-1" /> Add Column
        </Button>
      </div>
      <div className="space-y-2 max-h-[400px] overflow-y-auto">
        {columns.map((col, idx) => (
          <div
            key={idx}
            draggable
            onDragStart={() => handleDragStart(idx)}
            onDragOver={(e) => handleDragOver(e, idx)}
            onDragEnd={handleDragEnd}
            className={`flex items-center gap-2 p-3 border rounded-md bg-background ${draggedIndex === idx ? 'opacity-50' : ''}`}
            data-testid={`column-row-${idx}`}
          >
            <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
            <div className="flex-1 grid grid-cols-4 gap-2">
              <Input
                placeholder="Header"
                value={col.header}
                onChange={(e) => updateColumn(idx, "header", e.target.value)}
                className="text-sm"
                data-testid={`input-column-header-${idx}`}
              />
              <Select value={col.type} onValueChange={(v) => updateColumn(idx, "type", v)}>
                <SelectTrigger className="text-sm" data-testid={`select-column-type-${idx}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COLUMN_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      <div className="flex items-center gap-2">
                        <t.icon className="h-3 w-3" />
                        {t.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                placeholder={col.type === "data_field" ? "{{VARIABLE}}" : col.type === "signature" ? "(auto)" : "Value"}
                value={col.value}
                onChange={(e) => updateColumn(idx, "value", e.target.value)}
                disabled={col.type === "signature"}
                className="text-sm font-mono"
                data-testid={`input-column-value-${idx}`}
              />
              <Input
                placeholder="Width (e.g., 25%)"
                value={col.width || ""}
                onChange={(e) => updateColumn(idx, "width", e.target.value)}
                className="text-sm"
                data-testid={`input-column-width-${idx}`}
              />
            </div>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => removeColumn(idx)}
              disabled={columns.length <= 1}
              data-testid={`button-remove-column-${idx}`}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <div className="p-4 border-b bg-background">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Box className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-semibold" data-testid="text-page-title">Table Component Library</h1>
            <Badge variant="secondary" className="ml-2">
              {allComponents.length} components
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={() => setIsCreateDialogOpen(true)} data-testid="button-create-table">
              <Plus className="h-4 w-4 mr-2" /> Create New Table
            </Button>
            <Separator orientation="vertical" className="h-6" />
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
              <div className="text-xs font-medium text-muted-foreground px-2 py-1">Built-in Tables</div>
              {BUILTIN_COMPONENTS.map((component) => (
                <Card
                  key={component.id}
                  className={`cursor-pointer transition-colors hover-elevate ${
                    isBuiltin(selectedComponent) && selectedComponent.id === component.id ? 'border-primary bg-primary/5' : ''
                  }`}
                  onClick={() => { setSelectedComponent(component); setIsEditMode(false); }}
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
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              
              {(customTables?.length || 0) > 0 && (
                <>
                  <Separator className="my-2" />
                  <div className="text-xs font-medium text-muted-foreground px-2 py-1">Custom Tables</div>
                  {customTables?.map((table) => (
                    <Card
                      key={table.id}
                      className={`cursor-pointer transition-colors hover-elevate ${
                        !isBuiltin(selectedComponent) && selectedComponent?.id === table.id ? 'border-primary bg-primary/5' : ''
                      }`}
                      onClick={() => { setSelectedComponent(table); setIsEditMode(false); }}
                      data-testid={`component-card-custom-${table.id}`}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-start gap-3">
                          <div className="p-2 bg-accent/50 rounded-md text-accent-foreground">
                            <Table className="h-5 w-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-sm truncate">{table.display_name}</h3>
                            <Badge variant="outline" className="mt-1 font-mono text-[10px]">
                              {`{{${table.variable_name}}}`}
                            </Badge>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </>
              )}
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
                      {isBuiltin(selectedComponent) ? selectedComponent.icon : <Table className="h-5 w-5" />}
                      {isBuiltin(selectedComponent) ? selectedComponent.displayName : selectedComponent.display_name}
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      {isBuiltin(selectedComponent) ? selectedComponent.description : selectedComponent.description}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {!isBuiltin(selectedComponent) && !isEditMode && (
                      <>
                        <Button variant="outline" size="sm" onClick={() => startEdit(selectedComponent)} data-testid="button-edit-table">
                          <Edit className="h-4 w-4 mr-1" /> Edit
                        </Button>
                        <Button 
                          variant="destructive" 
                          size="sm" 
                          onClick={() => deleteTableMutation.mutate(selectedComponent.id)}
                          data-testid="button-delete-table"
                        >
                          <Trash2 className="h-4 w-4 mr-1" /> Delete
                        </Button>
                      </>
                    )}
                    {isEditMode && (
                      <>
                        <Button variant="outline" size="sm" onClick={cancelEdit}>Cancel</Button>
                        <Button size="sm" onClick={handleUpdate} disabled={updateTableMutation.isPending} data-testid="button-save-table">
                          <Save className="h-4 w-4 mr-1" /> Save Changes
                        </Button>
                      </>
                    )}
                    <Badge variant={isBuiltin(selectedComponent) ? "secondary" : "outline"}>
                      {isBuiltin(selectedComponent) ? selectedComponent.category : "Custom"}
                    </Badge>
                  </div>
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
                      {isBuiltin(selectedComponent) ? selectedComponent.variableName : `{{${selectedComponent.variable_name}}}`}
                    </code>
                  </CardContent>
                </Card>

                {isEditMode && editingTable ? (
                  <Card>
                    <CardHeader className="py-3">
                      <CardTitle className="text-sm">Edit Table Configuration</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <Label className="text-sm">Display Name</Label>
                        <Input
                          value={editingTable.display_name}
                          onChange={(e) => setEditingTable({ ...editingTable, display_name: e.target.value })}
                          className="mt-1"
                          data-testid="input-edit-display-name"
                        />
                      </div>
                      <div>
                        <Label className="text-sm">Description</Label>
                        <Textarea
                          value={editingTable.description || ""}
                          onChange={(e) => setEditingTable({ ...editingTable, description: e.target.value })}
                          className="mt-1"
                          rows={2}
                          data-testid="input-edit-description"
                        />
                      </div>
                      {renderColumnEditor(editingTable.columns)}
                    </CardContent>
                  </Card>
                ) : (
                  <Card>
                    <CardHeader className="py-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <LayoutGrid className="h-4 w-4" />
                        Column Configuration
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-2">
                        {isBuiltin(selectedComponent)
                          ? selectedComponent.columns.map((col, idx) => (
                              <Badge key={idx} variant="outline">{col}</Badge>
                            ))
                          : (selectedComponent.columns as TableColumn[]).map((col, idx) => (
                              <Badge key={idx} variant="outline" className="flex items-center gap-1">
                                {COLUMN_TYPES.find(t => t.value === col.type)?.icon && (
                                  <span className="opacity-60">
                                    {(() => {
                                      const IconComp = COLUMN_TYPES.find(t => t.value === col.type)?.icon;
                                      return IconComp ? <IconComp className="h-3 w-3" /> : null;
                                    })()}
                                  </span>
                                )}
                                {col.header}
                              </Badge>
                            ))
                        }
                      </div>
                      {!isBuiltin(selectedComponent) && (
                        <Textarea
                          className="mt-3 font-mono text-xs"
                          rows={4}
                          value={JSON.stringify(selectedComponent.columns, null, 2)}
                          readOnly
                        />
                      )}
                    </CardContent>
                  </Card>
                )}

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
                        data-testid="preview-container"
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

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Table Component</DialogTitle>
            <DialogDescription>
              Design a custom table that can be inserted into contracts using a variable placeholder.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Table Name</Label>
                <Input
                  placeholder="e.g., Customer Acknowledgement"
                  value={newTableName}
                  onChange={(e) => setNewTableName(e.target.value)}
                  className="mt-1"
                  data-testid="input-new-table-name"
                />
              </div>
              <div>
                <Label>Variable Name (auto-generated)</Label>
                <Input
                  value={newTableName ? `{{${slugifyToVariable(newTableName)}}}` : ""}
                  readOnly
                  className="mt-1 font-mono bg-muted"
                  data-testid="input-variable-name-preview"
                />
              </div>
            </div>
            <div>
              <Label>Description (optional)</Label>
              <Textarea
                placeholder="Describe what this table is used for..."
                value={newTableDescription}
                onChange={(e) => setNewTableDescription(e.target.value)}
                className="mt-1"
                rows={2}
                data-testid="input-new-table-description"
              />
            </div>
            <Separator />
            {renderColumnEditor(newTableColumns, true)}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsCreateDialogOpen(false); resetForm(); }}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreate} 
              disabled={createTableMutation.isPending || !newTableName.trim()}
              data-testid="button-confirm-create"
            >
              {createTableMutation.isPending ? "Creating..." : "Create Table"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

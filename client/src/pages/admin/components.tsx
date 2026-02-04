import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { AdminLayout } from "@/components/admin-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Eye,
  Code,
  Box,
  Layers,
  Plus,
  Trash2,
  GripVertical,
  Type,
  Database,
  PenTool,
  Save,
  Edit,
  Table,
  FileCode,
  Copy,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// =============================================================================
// INTERFACES
// =============================================================================

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

interface BlockComponent {
  id: number;
  tag_name: string;
  content: string;
  description?: string;
  service_model?: string;
  is_system: boolean;
}

type SelectedItem = 
  | { type: "block"; data: BlockComponent }
  | { type: "table"; data: TableDefinition };

// =============================================================================
// CONSTANTS
// =============================================================================

const CORE_TABLE_NAMES = [
  "PRICING_TABLE",
  "PAYMENT_SCHEDULE_TABLE", 
  "SIGNATURE_BLOCK_TABLE",
  "EXHIBIT_LIST_TABLE",
];

function isCoreTable(variableName: string): boolean {
  return CORE_TABLE_NAMES.includes(variableName);
}

const COLUMN_TYPES = [
  { value: "text", label: "Static Text", icon: Type, description: "Fixed text content" },
  { value: "data_field", label: "Project Variable", icon: Database, description: "Dynamic data from project" },
  { value: "signature", label: "Signature Box", icon: PenTool, description: "Line for signatures/initials" },
];

// =============================================================================
// BLOCK COMPONENT FORM SCHEMA
// =============================================================================

const blockComponentSchema = z.object({
  tagName: z.string().min(1, "Tag name is required").regex(/^BLOCK_[A-Z0-9_.]+$/, "Tag name must start with BLOCK_ and contain only uppercase letters, numbers, underscores, and dots"),
  content: z.string().min(1, "Content is required"),
  description: z.string().optional(),
  serviceModel: z.string().optional(),
});

type BlockComponentFormValues = z.infer<typeof blockComponentSchema>;

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function slugifyToVariable(name: string): string {
  return name
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, "")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "") + "_TABLE";
}

function groupBlocksByTagName(blocks: BlockComponent[]): Map<string, BlockComponent[]> {
  const grouped = new Map<string, BlockComponent[]>();
  for (const block of blocks) {
    const existing = grouped.get(block.tag_name) || [];
    existing.push(block);
    grouped.set(block.tag_name, existing);
  }
  return grouped;
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function ComponentLibrary() {
  const { toast } = useToast();
  
  // Selection state
  const [selectedItem, setSelectedItem] = useState<SelectedItem | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  
  // Sidebar expansion state
  const [blocksExpanded, setBlocksExpanded] = useState(true);
  const [tablesExpanded, setTablesExpanded] = useState(true);
  
  // Block component dialog state
  const [isBlockDialogOpen, setIsBlockDialogOpen] = useState(false);
  const [editingBlock, setEditingBlock] = useState<BlockComponent | null>(null);
  const [deleteBlock, setDeleteBlock] = useState<BlockComponent | null>(null);
  const [duplicateFrom, setDuplicateFrom] = useState<BlockComponent | null>(null);
  
  // Table component state
  const [isTableDialogOpen, setIsTableDialogOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingTable, setEditingTable] = useState<TableDefinition | null>(null);
  const [deleteTable, setDeleteTable] = useState<TableDefinition | null>(null);
  
  const [newTableName, setNewTableName] = useState("");
  const [newTableDescription, setNewTableDescription] = useState("");
  const [newTableColumns, setNewTableColumns] = useState<TableColumn[]>([
    { header: "Column 1", type: "text", value: "", width: "" }
  ]);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // =============================================================================
  // DATA QUERIES
  // =============================================================================

  const { data: projects, isLoading: projectsLoading } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const { data: blockComponents, isLoading: blocksLoading } = useQuery<BlockComponent[]>({
    queryKey: ["/api/components"],
  });

  const { data: customTables, isLoading: tablesLoading } = useQuery<TableDefinition[]>({
    queryKey: ["/api/table-definitions"],
  });

  const groupedBlocks = blockComponents ? groupBlocksByTagName(blockComponents) : new Map();

  // =============================================================================
  // BLOCK COMPONENT FORM
  // =============================================================================

  const blockForm = useForm<BlockComponentFormValues>({
    resolver: zodResolver(blockComponentSchema),
    defaultValues: {
      tagName: "",
      content: "",
      description: "",
      serviceModel: "",
    },
  });

  const createBlockMutation = useMutation({
    mutationFn: async (data: BlockComponentFormValues) => {
      return apiRequest("POST", "/api/components", {
        ...data,
        serviceModel: data.serviceModel || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/components"] });
      setIsBlockDialogOpen(false);
      setDuplicateFrom(null);
      blockForm.reset();
      toast({ title: "Block component created successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to create component", variant: "destructive" });
    },
  });

  const updateBlockMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: BlockComponentFormValues }) => {
      return apiRequest("PUT", `/api/components/${id}`, {
        ...data,
        serviceModel: data.serviceModel || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/components"] });
      setIsBlockDialogOpen(false);
      setEditingBlock(null);
      blockForm.reset();
      toast({ title: "Block component updated successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update component", variant: "destructive" });
    },
  });

  const deleteBlockMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/components/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/components"] });
      setDeleteBlock(null);
      if (selectedItem?.type === "block" && selectedItem.data.id === deleteBlock?.id) {
        setSelectedItem(null);
      }
      toast({ title: "Block component deleted" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to delete component", variant: "destructive" });
    },
  });

  // =============================================================================
  // TABLE MUTATIONS
  // =============================================================================

  const createTableMutation = useMutation({
    mutationFn: async (data: { variable_name: string; display_name: string; description: string; columns: TableColumn[] }) => {
      return apiRequest("POST", "/api/table-definitions", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/table-definitions"] });
      setIsTableDialogOpen(false);
      resetTableForm();
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
      setDeleteTable(null);
      if (selectedItem?.type === "table" && selectedItem.data.id === deleteTable?.id) {
        setSelectedItem(null);
      }
      toast({ title: "Success", description: "Table component deleted" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to delete table", variant: "destructive" });
    },
  });

  // =============================================================================
  // PREVIEW QUERY
  // =============================================================================

  const getPreviewQueryKey = () => {
    if (!selectedItem) return null;
    if (selectedItem.type === "block") {
      return ["block-preview", selectedItem.data.id];
    }
    if (selectedItem.type === "table") {
      const cols = isEditMode && editingTable ? editingTable.columns : selectedItem.data.columns;
      return ["/api/components/preview", `custom_${selectedItem.data.id}`, selectedProjectId, JSON.stringify(cols)];
    }
    return null;
  };

  const { data: previewHtml, isLoading: previewLoading } = useQuery<{ html: string }>({
    queryKey: getPreviewQueryKey() || ["no-preview"],
    queryFn: async () => {
      if (!selectedItem) return { html: "" };
      
      if (selectedItem.type === "block") {
        // Block components show their HTML content directly
        return { html: selectedItem.data.content };
      }
      
      if (!selectedProjectId) {
        return { html: "<p class='text-muted-foreground text-center py-8'>Select a project to preview live data</p>" };
      }
      
      if (selectedItem.type === "table") {
        const cols = isEditMode && editingTable ? editingTable.columns : selectedItem.data.columns;
        const response = await fetch("/api/table-definitions/preview-columns", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ columns: cols, projectId: selectedProjectId }),
        });
        if (!response.ok) throw new Error("Failed to fetch preview");
        return response.json();
      }
      
      return { html: "" };
    },
    enabled: !!selectedItem,
  });

  // =============================================================================
  // HANDLERS
  // =============================================================================

  const resetTableForm = () => {
    setNewTableName("");
    setNewTableDescription("");
    setNewTableColumns([{ header: "Column 1", type: "text", value: "", width: "" }]);
  };

  const openCreateBlockDialog = () => {
    setEditingBlock(null);
    setDuplicateFrom(null);
    blockForm.reset({ tagName: "", content: "", description: "", serviceModel: "" });
    setIsBlockDialogOpen(true);
  };

  const openEditBlockDialog = (block: BlockComponent) => {
    setEditingBlock(block);
    setDuplicateFrom(null);
    blockForm.reset({
      tagName: block.tag_name,
      content: block.content,
      description: block.description || "",
      serviceModel: block.service_model || "",
    });
    setIsBlockDialogOpen(true);
  };

  const openDuplicateBlockDialog = (block: BlockComponent) => {
    setEditingBlock(null);
    setDuplicateFrom(block);
    blockForm.reset({
      tagName: block.tag_name,
      content: block.content,
      description: block.description || "",
      serviceModel: block.service_model === "CRC" ? "CMOS" : "CRC", // Flip the service model
    });
    setIsBlockDialogOpen(true);
  };

  const handleBlockSubmit = (values: BlockComponentFormValues) => {
    if (editingBlock) {
      updateBlockMutation.mutate({ id: editingBlock.id, data: values });
    } else {
      createBlockMutation.mutate(values);
    }
  };

  const handleTableCreate = () => {
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

  const handleTableSave = () => {
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

  const startTableEdit = (table: TableDefinition) => {
    setEditingTable({ ...table });
    setIsEditMode(true);
  };

  const cancelTableEdit = () => {
    setEditingTable(null);
    setIsEditMode(false);
  };

  // =============================================================================
  // RENDER
  // =============================================================================

  return (
    <AdminLayout>
      <div className="flex h-full" data-testid="component-library-page">
        {/* Sidebar */}
        <div className="w-80 border-r flex flex-col bg-muted/30">
          <div className="p-4 border-b bg-background">
            <h1 className="text-lg font-semibold flex items-center gap-2">
              <Box className="h-5 w-5" />
              Component Library
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage block components and table templates
            </p>
          </div>
        
        <ScrollArea className="flex-1">
          <div className="p-2">
            {/* Block Components Section */}
            <div className="mb-4">
              <button
                onClick={() => setBlocksExpanded(!blocksExpanded)}
                className="flex items-center justify-between w-full p-2 rounded hover-elevate"
                data-testid="toggle-blocks-section"
              >
                <span className="flex items-center gap-2 font-medium text-sm">
                  {blocksExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  <FileCode className="h-4 w-4" />
                  Block Components
                </span>
                <Badge variant="secondary" className="text-xs">
                  {blockComponents?.length || 0}
                </Badge>
              </button>
              
              {blocksExpanded && (
                <div className="ml-4 mt-1 space-y-1">
                  {blocksLoading ? (
                    <div className="space-y-2 p-2">
                      <Skeleton className="h-6 w-full" />
                      <Skeleton className="h-6 w-full" />
                    </div>
                  ) : (
                    <>
                      {Array.from(groupedBlocks.entries()).map(([tagName, variants]) => (
                        <div key={tagName} className="space-y-0.5">
                          <div className="text-xs text-muted-foreground px-2 pt-2 font-mono truncate" title={tagName}>
                            {tagName}
                          </div>
                          {variants.map((block: BlockComponent) => (
                            <button
                              key={block.id}
                              onClick={() => setSelectedItem({ type: "block", data: block })}
                              className={`w-full text-left p-2 rounded text-sm flex items-center justify-between gap-2 ${
                                selectedItem?.type === "block" && selectedItem.data.id === block.id
                                  ? "bg-primary/10 text-primary"
                                  : "hover-elevate"
                              }`}
                              data-testid={`block-${block.id}`}
                            >
                              <span className="truncate">{block.description || tagName}</span>
                              <Badge variant={block.service_model === "CRC" ? "default" : "secondary"} className="text-xs shrink-0">
                                {block.service_model || "ALL"}
                              </Badge>
                            </button>
                          ))}
                        </div>
                      ))}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start text-muted-foreground mt-2"
                        onClick={openCreateBlockDialog}
                        data-testid="button-create-block"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Block Component
                      </Button>
                    </>
                  )}
                </div>
              )}
            </div>
            
            <Separator className="my-2" />
            
            {/* Tables Section */}
            <div>
              <button
                onClick={() => setTablesExpanded(!tablesExpanded)}
                className="flex items-center justify-between w-full p-2 rounded hover-elevate"
                data-testid="toggle-tables-section"
              >
                <span className="flex items-center gap-2 font-medium text-sm">
                  {tablesExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  <Layers className="h-4 w-4" />
                  Table Components
                </span>
                <Badge variant="secondary" className="text-xs">
                  {customTables?.length || 0}
                </Badge>
              </button>
              
              {tablesExpanded && (
                <div className="ml-4 mt-1 space-y-1">
                  {tablesLoading ? (
                    <div className="space-y-2 p-2">
                      <Skeleton className="h-6 w-full" />
                    </div>
                  ) : (
                    <>
                      {customTables?.map((table) => (
                        <button
                          key={table.id}
                          onClick={() => setSelectedItem({ type: "table", data: table })}
                          className={`w-full text-left p-2 rounded text-sm flex items-center justify-between gap-2 ${
                            selectedItem?.type === "table" && selectedItem.data.id === table.id
                              ? "bg-primary/10 text-primary"
                              : "hover-elevate"
                          }`}
                          data-testid={`table-${table.id}`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <Table className="h-4 w-4 shrink-0" />
                            <span className="truncate">{table.display_name}</span>
                          </div>
                          {isCoreTable(table.variable_name) && (
                            <Badge variant="outline" className="text-xs shrink-0" data-testid={`badge-core-${table.id}`}>Core</Badge>
                          )}
                        </button>
                      ))}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start text-muted-foreground mt-2"
                        onClick={() => setIsTableDialogOpen(true)}
                        data-testid="button-create-table"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Custom Table
                      </Button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </ScrollArea>
      </div>
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Header with project selector */}
        <div className="p-4 border-b bg-background flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Label className="text-sm whitespace-nowrap">Preview with Project:</Label>
              <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                <SelectTrigger className="w-64" data-testid="select-preview-project">
                  <SelectValue placeholder="Select a project..." />
                </SelectTrigger>
                <SelectContent>
                  {projects?.map((p) => (
                    <SelectItem key={p.id} value={p.id.toString()}>
                      {p.project_number} - {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          {/* Action buttons based on selection */}
          {selectedItem?.type === "block" && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => openDuplicateBlockDialog(selectedItem.data)}
                data-testid="button-duplicate-block"
              >
                <Copy className="h-4 w-4 mr-2" />
                Duplicate
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => openEditBlockDialog(selectedItem.data)}
                data-testid="button-edit-block"
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
              {!selectedItem.data.is_system && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDeleteBlock(selectedItem.data)}
                  className="text-destructive hover:text-destructive"
                  data-testid="button-delete-block"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              )}
            </div>
          )}
          
          {selectedItem?.type === "table" && !isEditMode && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => startTableEdit(selectedItem.data)}
                data-testid="button-edit-table"
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
              {!isCoreTable(selectedItem.data.variable_name) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDeleteTable(selectedItem.data)}
                  className="text-destructive hover:text-destructive"
                  data-testid="button-delete-table"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              )}
            </div>
          )}
          
          {isEditMode && editingTable && (
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={cancelTableEdit}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleTableSave} disabled={updateTableMutation.isPending}>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </Button>
            </div>
          )}
        </div>
        
        {/* Content area */}
        <div className="flex-1 flex min-h-0">
          {!selectedItem ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <Box className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p className="text-lg">Select a component from the sidebar</p>
                <p className="text-sm mt-1">Choose a block component or table to view details</p>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex">
              {/* Detail Panel */}
              <div className="w-1/2 border-r flex flex-col min-h-0">
                <div className="p-2 border-b bg-muted/30 flex-shrink-0">
                  <h3 className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                    <Code className="h-3 w-3" />
                    {selectedItem.type === "block" ? "Block Content" : "Column Editor"}
                  </h3>
                </div>
                <ScrollArea className="flex-1">
                  <div className="p-4">
                    {selectedItem.type === "block" && (
                      <div className="space-y-4">
                        <div>
                          <Label className="text-xs text-muted-foreground">Tag Name</Label>
                          <div className="font-mono text-sm mt-1 p-2 bg-muted rounded">
                            {`{{${selectedItem.data.tag_name}}}`}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={selectedItem.data.service_model === "CRC" ? "default" : "secondary"}>
                            {selectedItem.data.service_model || "ALL"}
                          </Badge>
                          {selectedItem.data.is_system && (
                            <Badge variant="outline">System</Badge>
                          )}
                        </div>
                        {selectedItem.data.description && (
                          <div>
                            <Label className="text-xs text-muted-foreground">Description</Label>
                            <p className="text-sm mt-1">{selectedItem.data.description}</p>
                          </div>
                        )}
                        <div>
                          <Label className="text-xs text-muted-foreground">HTML Content</Label>
                          <pre className="text-xs mt-1 p-3 bg-muted rounded overflow-auto max-h-96 whitespace-pre-wrap">
                            {selectedItem.data.content}
                          </pre>
                        </div>
                      </div>
                    )}
                    
                    {selectedItem.type === "table" && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <Label className="text-xs text-muted-foreground">Variable Name</Label>
                            <div className="font-mono text-sm mt-1 p-2 bg-muted rounded">
                              {`{{${selectedItem.data.variable_name}}}`}
                            </div>
                          </div>
                          {isCoreTable(selectedItem.data.variable_name) && (
                            <Badge variant="outline" className="ml-2 shrink-0" data-testid="badge-core-table">Core Table</Badge>
                          )}
                        </div>
                        {isCoreTable(selectedItem.data.variable_name) && !isEditMode && (
                          <p className="text-xs text-muted-foreground italic" data-testid="text-core-table-note">
                            This is a core system table. You can edit its columns but cannot delete it.
                          </p>
                        )}
                        {isEditMode && editingTable ? (
                          <div className="space-y-4">
                            <div>
                              <Label>Display Name</Label>
                              <Input
                                value={editingTable.display_name}
                                onChange={(e) => setEditingTable({ ...editingTable, display_name: e.target.value })}
                                className="mt-1"
                              />
                            </div>
                            <div>
                              <Label>Description</Label>
                              <Textarea
                                value={editingTable.description || ""}
                                onChange={(e) => setEditingTable({ ...editingTable, description: e.target.value })}
                                className="mt-1"
                              />
                            </div>
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <Label>Columns</Label>
                                <Button variant="outline" size="sm" onClick={addColumn}>
                                  <Plus className="h-3 w-3 mr-1" />
                                  Add Column
                                </Button>
                              </div>
                              <div className="space-y-2">
                                {editingTable.columns.map((col, idx) => (
                                  <div
                                    key={idx}
                                    draggable
                                    onDragStart={() => handleDragStart(idx)}
                                    onDragOver={(e) => handleDragOver(e, idx)}
                                    onDragEnd={handleDragEnd}
                                    className="flex items-center gap-2 p-2 border rounded bg-background"
                                  >
                                    <GripVertical className="h-4 w-4 text-muted-foreground cursor-move" />
                                    <Input
                                      value={col.header}
                                      onChange={(e) => updateColumn(idx, "header", e.target.value)}
                                      placeholder="Header"
                                      className="flex-1"
                                    />
                                    <Select
                                      value={col.type}
                                      onValueChange={(v) => updateColumn(idx, "type", v)}
                                    >
                                      <SelectTrigger className="w-32">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {COLUMN_TYPES.map((t) => (
                                          <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                    <Input
                                      value={col.value}
                                      onChange={(e) => updateColumn(idx, "value", e.target.value)}
                                      placeholder="Value/Variable"
                                      className="flex-1"
                                    />
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => removeColumn(idx)}
                                      disabled={editingTable.columns.length <= 1}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            <div>
                              <Label className="text-xs text-muted-foreground">Description</Label>
                              <p className="text-sm mt-1">{selectedItem.data.description || "No description"}</p>
                            </div>
                            <div>
                              <Label className="text-xs text-muted-foreground">Columns</Label>
                              <div className="mt-2 space-y-1">
                                {selectedItem.data.columns.map((col, idx) => (
                                  <div key={idx} className="flex items-center gap-2 text-sm">
                                    <Badge variant="outline" className="font-mono text-xs">{col.header}</Badge>
                                    <span className="text-muted-foreground">
                                      {COLUMN_TYPES.find(t => t.value === col.type)?.label || col.type}
                                    </span>
                                    {col.value && <span className="font-mono text-xs text-primary">{col.value}</span>}
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </div>
              
              {/* Preview Panel */}
              <div className="w-1/2 flex flex-col min-h-0">
                <div className="p-2 border-b bg-muted/30 flex-shrink-0">
                  <h3 className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                    <Eye className="h-3 w-3" />
                    HTML Preview
                  </h3>
                </div>
                <ScrollArea className="flex-1">
                  <div className="p-4">
                    {previewLoading ? (
                      <Skeleton className="h-32 w-full" />
                    ) : (
                      <div
                        className="prose prose-sm dark:prose-invert max-w-none"
                        dangerouslySetInnerHTML={{ __html: previewHtml?.html || "<p class='text-muted-foreground'>No preview available</p>" }}
                      />
                    )}
                  </div>
                </ScrollArea>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Block Component Dialog */}
      <Dialog open={isBlockDialogOpen} onOpenChange={setIsBlockDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingBlock ? "Edit Block Component" : duplicateFrom ? "Duplicate Block Component" : "Create Block Component"}
            </DialogTitle>
            <DialogDescription>
              {editingBlock ? "Update the block component content." : "Create a new block component for contract generation."}
            </DialogDescription>
          </DialogHeader>
          <Form {...blockForm}>
            <form onSubmit={blockForm.handleSubmit(handleBlockSubmit)} className="space-y-4">
              <FormField
                control={blockForm.control}
                name="tagName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tag Name</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="BLOCK_SECTION_NAME"
                        disabled={!!editingBlock}
                        className="font-mono"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={blockForm.control}
                name="serviceModel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Service Model</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select service model..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="CRC">CRC (Client-Retained Contractor)</SelectItem>
                        <SelectItem value="CMOS">CMOS (Company-Managed On-Site)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={blockForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Brief description of this component" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={blockForm.control}
                name="content"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>HTML Content</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="<p>Enter HTML content here...</p>"
                        className="font-mono min-h-[200px]"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setIsBlockDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createBlockMutation.isPending || updateBlockMutation.isPending}>
                  {editingBlock ? "Save Changes" : "Create Component"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
      {/* Table Create Dialog */}
      <Dialog open={isTableDialogOpen} onOpenChange={setIsTableDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create Custom Table</DialogTitle>
            <DialogDescription>Define a new table component for contracts.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Table Name</Label>
              <Input
                value={newTableName}
                onChange={(e) => setNewTableName(e.target.value)}
                placeholder="e.g., Warranty Terms Table"
                className="mt-1"
              />
              {newTableName && (
                <p className="text-xs text-muted-foreground mt-1">
                  Variable: <span className="font-mono">{`{{${slugifyToVariable(newTableName)}}}`}</span>
                </p>
              )}
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={newTableDescription}
                onChange={(e) => setNewTableDescription(e.target.value)}
                placeholder="What does this table display?"
                className="mt-1"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Columns</Label>
                <Button variant="outline" size="sm" onClick={addColumn}>
                  <Plus className="h-3 w-3 mr-1" />
                  Add Column
                </Button>
              </div>
              <div className="space-y-2">
                {newTableColumns.map((col, idx) => (
                  <div
                    key={idx}
                    draggable
                    onDragStart={() => handleDragStart(idx)}
                    onDragOver={(e) => handleDragOver(e, idx)}
                    onDragEnd={handleDragEnd}
                    className="flex items-center gap-2 p-2 border rounded bg-background"
                  >
                    <GripVertical className="h-4 w-4 text-muted-foreground cursor-move" />
                    <Input
                      value={col.header}
                      onChange={(e) => updateColumn(idx, "header", e.target.value)}
                      placeholder="Header"
                      className="flex-1"
                    />
                    <Select value={col.type} onValueChange={(v) => updateColumn(idx, "type", v)}>
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {COLUMN_TYPES.map((t) => (
                          <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      value={col.value}
                      onChange={(e) => updateColumn(idx, "value", e.target.value)}
                      placeholder="Value/Variable"
                      className="flex-1"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeColumn(idx)}
                      disabled={newTableColumns.length <= 1}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setIsTableDialogOpen(false); resetTableForm(); }}>
              Cancel
            </Button>
            <Button onClick={handleTableCreate} disabled={createTableMutation.isPending}>
              Create Table
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Delete Block Confirmation */}
      <AlertDialog open={!!deleteBlock} onOpenChange={() => setDeleteBlock(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Block Component?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the block component "{deleteBlock?.tag_name}" ({deleteBlock?.service_model}). 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteBlock && deleteBlockMutation.mutate(deleteBlock.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Delete Table Confirmation */}
      <AlertDialog open={!!deleteTable} onOpenChange={() => setDeleteTable(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Custom Table?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the table "{deleteTable?.display_name}". 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTable && deleteTableMutation.mutate(deleteTable.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </div>
    </AdminLayout>
  );
}

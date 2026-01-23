import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Search, Plus, Pencil, Trash2, Link2, FileText, ChevronDown, ChevronRight } from "lucide-react";

interface ClauseUsage {
  id: number;
  clauseCode: string;
  name: string;
  contractType: string;
  hierarchyLevel: string;
}

interface VariableMapping {
  id: number;
  variableName: string;
  displayName: string | null;
  category: string | null;
  dataType: string;
  defaultValue: string | null;
  isRequired: boolean;
  description: string | null;
  erpSource: string | null;
  usedInContracts: string[] | null;
  clauseUsage: ClauseUsage[];
  clauseCount: number;
}

interface VariableMappingsResponse {
  variables: VariableMapping[];
  stats: {
    totalFields: number;
    erpMapped: number;
    required: number;
  };
}

const DATA_TYPES = [
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "currency", label: "Currency" },
  { value: "date", label: "Date" },
  { value: "boolean", label: "Boolean" },
];

const CATEGORIES = [
  { value: "client", label: "Client" },
  { value: "project", label: "Project" },
  { value: "financial", label: "Financial" },
  { value: "dates", label: "Dates" },
  { value: "warranty", label: "Warranty" },
  { value: "llc", label: "LLC" },
  { value: "site", label: "Site" },
  { value: "contractor", label: "Contractor" },
];

export default function VariableMappings() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingVariable, setEditingVariable] = useState<VariableMapping | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const { toast } = useToast();

  // Form state for add/edit
  const [formData, setFormData] = useState({
    variableName: "",
    displayName: "",
    category: "",
    dataType: "text",
    defaultValue: "",
    isRequired: false,
    description: "",
    erpSource: "",
  });

  const { data, isLoading } = useQuery<VariableMappingsResponse>({
    queryKey: ["/api/variable-mappings", searchTerm],
    queryFn: async () => {
      const params = searchTerm ? `?search=${encodeURIComponent(searchTerm)}` : "";
      const response = await fetch(`/api/variable-mappings${params}`);
      if (!response.ok) throw new Error("Failed to fetch variables");
      return response.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return apiRequest("POST", "/api/variable-mappings", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/variable-mappings"] });
      setIsAddDialogOpen(false);
      resetForm();
      toast({ title: "Variable created", description: "The variable has been added successfully." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: typeof formData }) => {
      return apiRequest("PATCH", `/api/variable-mappings/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/variable-mappings"] });
      setEditingVariable(null);
      resetForm();
      toast({ title: "Variable updated", description: "The variable has been updated successfully." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/variable-mappings/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/variable-mappings"] });
      toast({ title: "Variable deleted", description: "The variable has been removed." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({
      variableName: "",
      displayName: "",
      category: "",
      dataType: "text",
      defaultValue: "",
      isRequired: false,
      description: "",
      erpSource: "",
    });
  };

  const handleEdit = (variable: VariableMapping) => {
    setEditingVariable(variable);
    setFormData({
      variableName: variable.variableName,
      displayName: variable.displayName || "",
      category: variable.category || "",
      dataType: variable.dataType || "text",
      defaultValue: variable.defaultValue || "",
      isRequired: variable.isRequired,
      description: variable.description || "",
      erpSource: variable.erpSource || "",
    });
  };

  const handleSubmit = () => {
    if (editingVariable) {
      updateMutation.mutate({ id: editingVariable.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const toggleRowExpanded = (id: number) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  const stats = data?.stats || { totalFields: 0, erpMapped: 0, required: 0 };
  const variables = data?.variables || [];

  return (
    <div className="flex-1 p-6 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground" data-testid="text-page-title">
            Variable Mappings
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure fields that can be populated from your ERP system
          </p>
        </div>
        <Dialog open={isAddDialogOpen || !!editingVariable} onOpenChange={(open) => {
          if (!open) {
            setIsAddDialogOpen(false);
            setEditingVariable(null);
            resetForm();
          }
        }}>
          <DialogTrigger asChild>
            <Button onClick={() => setIsAddDialogOpen(true)} data-testid="button-add-field">
              <Plus className="h-4 w-4 mr-2" />
              Add Field
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>{editingVariable ? "Edit Variable" : "Add New Variable"}</DialogTitle>
              <DialogDescription>
                {editingVariable ? "Update the variable configuration." : "Define a new contract variable."}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="variableName">Variable Name</Label>
                <Input
                  id="variableName"
                  placeholder="e.g., CLIENT_LEGAL_NAME"
                  value={formData.variableName}
                  onChange={(e) => setFormData({ ...formData, variableName: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "_") })}
                  data-testid="input-variable-name"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="displayName">Display Label</Label>
                <Input
                  id="displayName"
                  placeholder="e.g., Buyer Legal Name"
                  value={formData.displayName}
                  onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                  data-testid="input-display-name"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Category</Label>
                  <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
                    <SelectTrigger data-testid="select-category">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((cat) => (
                        <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Data Type</Label>
                  <Select value={formData.dataType} onValueChange={(value) => setFormData({ ...formData, dataType: value })}>
                    <SelectTrigger data-testid="select-data-type">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {DATA_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="erpSource">ERP Source</Label>
                <Input
                  id="erpSource"
                  placeholder="e.g., Customers.LegalName"
                  value={formData.erpSource}
                  onChange={(e) => setFormData({ ...formData, erpSource: e.target.value })}
                  data-testid="input-erp-source"
                />
                <p className="text-xs text-muted-foreground">Odoo field path for automatic population</p>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="isRequired"
                  checked={formData.isRequired}
                  onCheckedChange={(checked) => setFormData({ ...formData, isRequired: !!checked })}
                  data-testid="checkbox-required"
                />
                <Label htmlFor="isRequired" className="text-sm font-normal">
                  Required field
                </Label>
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline" data-testid="button-cancel-variable">Cancel</Button>
              </DialogClose>
              <Button 
                onClick={handleSubmit} 
                disabled={!formData.variableName || createMutation.isPending || updateMutation.isPending}
                data-testid="button-save-variable"
              >
                {(createMutation.isPending || updateMutation.isPending) ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card data-testid="card-total-fields">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Fields</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold" data-testid="stat-total-fields">{stats.totalFields}</span>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <FileText className="h-3 w-3" />
                  Defined fields
                </span>
              </div>
            )}
          </CardContent>
        </Card>
        <Card data-testid="card-erp-mapped">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">ERP Mapped</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold" data-testid="stat-erp-mapped">{stats.erpMapped}</span>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Link2 className="h-3 w-3" />
                  Connected to ERP
                </span>
              </div>
            )}
          </CardContent>
        </Card>
        <Card data-testid="card-required">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Required</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold" data-testid="stat-required">{stats.required}</span>
                <span className="text-xs text-muted-foreground">Must be filled</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search fields..."
          className="pl-10"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          data-testid="input-search-fields"
        />
      </div>

      {/* Field Definitions Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Field Definitions</CardTitle>
          <CardDescription>Manage fields that can be used in contract templates</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : variables.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <p>No variables found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[250px]">Field Key</TableHead>
                  <TableHead>Label</TableHead>
                  <TableHead className="w-[100px]">Type</TableHead>
                  <TableHead>ERP Source</TableHead>
                  <TableHead className="w-[120px]">Clause Usage</TableHead>
                  <TableHead className="w-[100px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {variables.map((variable) => (
                  <Collapsible key={variable.id} asChild open={expandedRows.has(variable.id)}>
                    <>
                      <TableRow data-testid={`row-variable-${variable.id}`}>
                        <TableCell>
                          <code className={`text-sm font-mono px-1.5 py-0.5 rounded ${variable.isRequired ? 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400' : 'bg-muted'}`}>
                            {variable.variableName}
                          </code>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {variable.displayName || "-"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="capitalize">
                            {variable.dataType}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {variable.erpSource ? (
                            <span className="flex items-center gap-1 text-sm">
                              <Link2 className="h-3 w-3 text-green-500" />
                              {variable.erpSource}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {variable.clauseCount > 0 ? (
                            <CollapsibleTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-auto py-1 px-2"
                                onClick={() => toggleRowExpanded(variable.id)}
                                data-testid={`button-expand-clauses-${variable.id}`}
                              >
                                <span className="flex items-center gap-1">
                                  {expandedRows.has(variable.id) ? (
                                    <ChevronDown className="h-3 w-3" />
                                  ) : (
                                    <ChevronRight className="h-3 w-3" />
                                  )}
                                  {variable.clauseCount} clause{variable.clauseCount !== 1 ? "s" : ""}
                                </span>
                              </Button>
                            </CollapsibleTrigger>
                          ) : (
                            <span className="text-muted-foreground text-sm">0 clauses</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(variable)}
                              data-testid={`button-edit-${variable.id}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                if (confirm("Are you sure you want to delete this variable?")) {
                                  deleteMutation.mutate(variable.id);
                                }
                              }}
                              data-testid={`button-delete-${variable.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                      <CollapsibleContent asChild>
                        <TableRow className="bg-muted/30">
                          <TableCell colSpan={6} className="py-3">
                            <div className="pl-4">
                              <p className="text-xs font-medium text-muted-foreground mb-2">Used in clauses:</p>
                              <div className="flex flex-wrap gap-2">
                                {variable.clauseUsage.map((clause) => (
                                  <Badge key={clause.id} variant="outline" className="text-xs" data-testid={`badge-clause-${clause.id}`}>
                                    <span className="font-mono mr-1">{clause.clauseCode}</span>
                                    <span className="text-muted-foreground">({clause.contractType})</span>
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      </CollapsibleContent>
                    </>
                  </Collapsible>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

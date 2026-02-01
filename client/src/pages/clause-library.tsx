import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  Search,
  FileText,
  ChevronDown,
  ChevronRight,
  Edit,
  Save,
  X,
  AlertTriangle,
  Zap,
  Code,
  Hash,
  Layers,
  BookOpen,
  RotateCcw,
  Settings,
  CheckSquare,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface Clause {
  id: number;
  clause_code: string;
  parent_clause_id: number | null;
  hierarchy_level: number;
  sort_order: number;
  name: string;
  category: string;
  contract_type: string;
  content: string;
  variables_used: string[] | null;
  conditions: any;
  risk_level: string;
  negotiable: boolean;
  created_at: string;
  updated_at: string;
}

interface ClauseStats {
  total: string;
  contract_types: string;
  categories: string;
  conditional: string;
}

interface ClauseResponse {
  clauses: Clause[];
  stats: ClauseStats;
}

const CONTRACT_TYPES = [
  { value: "ALL", label: "All Contract Types" },
  { value: "ONE Agreement", label: "ONE Agreement" },
  { value: "MANUFACTURING", label: "Manufacturing Subcontract" },
  { value: "ONSITE", label: "OnSite Subcontract" },
];

const HIERARCHY_LEVELS = [
  { value: "all", label: "All Levels" },
  { value: "1", label: "Sections (Level 1)" },
  { value: "2", label: "Subsections (Level 2)" },
  { value: "3", label: "Paragraphs (Level 3)" },
  { value: "4", label: "Sub-headers (Level 4)" },
  { value: "5", label: "Body Text (Level 5)" },
  { value: "6", label: "Conspicuous (Level 6)" },
  { value: "7", label: "List Items (Level 7)" },
  { value: "8", label: "Nested List (Level 8)" },
];

const EDIT_HIERARCHY_OPTIONS = [
  { value: 1, label: "Level 1 - Heading 1" },
  { value: 2, label: "Level 2 - Heading 2" },
  { value: 3, label: "Level 3 - Heading 3" },
  { value: 4, label: "Level 4 - Heading 4" },
  { value: 5, label: "Level 5 - Normal Text" },
  { value: 6, label: "Level 6 - Heading 6" },
  { value: 7, label: "Level 7 - Heading 5" },
  { value: 8, label: "Level 8 - Nested List" },
];

export default function ClauseLibrary() {
  const [searchTerm, setSearchTerm] = useState("");
  const [contractType, setContractType] = useState("ALL");
  const [hierarchyLevel, setHierarchyLevel] = useState("all");
  const [selectedClause, setSelectedClause] = useState<Clause | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<Partial<Clause>>({});
  const [expandedClauses, setExpandedClauses] = useState<Set<number>>(new Set());
  const [inlineEditingId, setInlineEditingId] = useState<number | null>(null);
  const [inlineEditContent, setInlineEditContent] = useState("");
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingClause, setEditingClause] = useState<Clause | null>(null);
  const [editHierarchyLevel, setEditHierarchyLevel] = useState<number>(3);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [massHierarchyLevel, setMassHierarchyLevel] = useState<string>("");
  const [massContractType, setMassContractType] = useState<string>("");
  const { toast } = useToast();

  const clearFilters = () => {
    setSearchTerm("");
    setContractType("ALL");
    setHierarchyLevel("all");
  };

  const hasActiveFilters = searchTerm !== "" || contractType !== "ALL" || hierarchyLevel !== "all";

  const toggleSelectClause = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAllVisible = () => {
    const allIds = new Set((data?.clauses || []).map(c => c.id));
    setSelectedIds(allIds);
  };

  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  const openEditModal = (clause: Clause, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingClause(clause);
    setEditHierarchyLevel(clause.hierarchy_level);
    setEditModalOpen(true);
  };

  const { data, isLoading, error } = useQuery<ClauseResponse>({
    queryKey: ["/api/clauses", contractType, hierarchyLevel, searchTerm],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (contractType !== "ALL") params.append("contractType", contractType);
      if (hierarchyLevel !== "all") params.append("hierarchyLevel", hierarchyLevel);
      if (searchTerm) params.append("search", searchTerm);
      
      const response = await fetch(`/api/clauses?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch clauses");
      return response.json();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<Clause>) => {
      if (!selectedClause) throw new Error("No clause selected");
      const response = await apiRequest("PATCH", `/api/clauses/${selectedClause.id}`, updates);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clauses"] });
      setIsEditing(false);
      toast({
        title: "Clause Updated",
        description: "The clause has been updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update clause. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    updateMutation.mutate(editData);
  };

  const hierarchyUpdateMutation = useMutation({
    mutationFn: async ({ id, hierarchy_level }: { id: number; hierarchy_level: number }) => {
      const response = await apiRequest("PATCH", `/api/clauses/${id}`, { hierarchy_level });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clauses"] });
      setEditModalOpen(false);
      setEditingClause(null);
      toast({
        title: "Hierarchy Level Updated",
        description: "The clause hierarchy level has been updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update hierarchy level. Please try again.",
        variant: "destructive",
      });
    },
  });

  const saveHierarchyLevel = () => {
    if (!editingClause) return;
    hierarchyUpdateMutation.mutate({ id: editingClause.id, hierarchy_level: editHierarchyLevel });
  };

  const inlineUpdateMutation = useMutation({
    mutationFn: async ({ id, content }: { id: number; content: string }) => {
      const response = await apiRequest("PATCH", `/api/clauses/${id}`, { content });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clauses"] });
      setInlineEditingId(null);
      setInlineEditContent("");
      toast({
        title: "Clause Updated",
        description: "The clause content has been updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update clause. Please try again.",
        variant: "destructive",
      });
    },
  });

  const startInlineEdit = (clause: Clause) => {
    setInlineEditingId(clause.id);
    setInlineEditContent(clause.content || "");
  };

  const saveInlineEdit = (id: number) => {
    inlineUpdateMutation.mutate({ id, content: inlineEditContent });
  };

  const cancelInlineEdit = () => {
    setInlineEditingId(null);
    setInlineEditContent("");
  };

  const massHierarchyMutation = useMutation({
    mutationFn: async ({ ids, hierarchy_level }: { ids: number[]; hierarchy_level: number }) => {
      const results = await Promise.all(
        ids.map(id => apiRequest("PATCH", `/api/clauses/${id}`, { hierarchy_level }))
      );
      return results;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/clauses"] });
      setSelectedIds(new Set());
      setMassHierarchyLevel("");
      toast({
        title: "Hierarchy Levels Updated",
        description: `Successfully updated ${variables.ids.length} clause(s) to Level ${variables.hierarchy_level}.`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update hierarchy levels. Please try again.",
        variant: "destructive",
      });
    },
  });

  const massContractTypeMutation = useMutation({
    mutationFn: async ({ ids, contract_type }: { ids: number[]; contract_type: string }) => {
      const results = await Promise.all(
        ids.map(id => apiRequest("PATCH", `/api/clauses/${id}`, { contract_type }))
      );
      return results;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/clauses"] });
      setSelectedIds(new Set());
      setMassContractType("");
      toast({
        title: "Contract Types Updated",
        description: `Successfully updated ${variables.ids.length} clause(s) to ${variables.contract_type}.`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update contract types. Please try again.",
        variant: "destructive",
      });
    },
  });

  const applyMassHierarchy = () => {
    if (!massHierarchyLevel || selectedIds.size === 0) return;
    massHierarchyMutation.mutate({
      ids: Array.from(selectedIds),
      hierarchy_level: parseInt(massHierarchyLevel, 10),
    });
  };

  const applyMassContractType = () => {
    if (!massContractType || selectedIds.size === 0) return;
    massContractTypeMutation.mutate({
      ids: Array.from(selectedIds),
      contract_type: massContractType,
    });
  };

  const toggleExpanded = (id: number) => {
    setExpandedClauses(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const clauses = data?.clauses || [];
  const stats = data?.stats;

  const getHierarchyIcon = (level: number) => {
    switch (level) {
      case 1: return <Layers className="h-4 w-4" />;
      case 2: return <Hash className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  const getRiskBadge = (riskLevel: string) => {
    switch (riskLevel?.toLowerCase()) {
      case "high":
        return <Badge variant="destructive" className="text-xs">High Risk</Badge>;
      case "medium":
        return <Badge variant="secondary" className="text-xs">Medium Risk</Badge>;
      default:
        return <Badge variant="outline" className="text-xs">Low Risk</Badge>;
    }
  };

  const highlightVariables = (content: string) => {
    if (!content) return "";
    return content.replace(/\{\{([A-Z0-9_]+)\}\}/g, '<span class="bg-primary/20 text-primary px-1 rounded font-mono text-sm">{{$1}}</span>');
  };

  // Escape HTML to prevent XSS
  const escapeHtml = (text: string) => {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };

  // Format content by converting markdown-style tables and bullets to HTML
  const formatContent = (content: string) => {
    if (!content) return "";
    
    const lines = content.split('\n');
    const outputBlocks: string[] = [];
    let i = 0;
    
    while (i < lines.length) {
      const line = lines[i].trim();
      
      // Detect table: line starts and ends with | and has multiple cells
      if (line.startsWith('|') && line.endsWith('|') && line.split('|').length > 2) {
        // Collect all table rows
        const tableLines: string[] = [];
        while (i < lines.length) {
          const tLine = lines[i].trim();
          if (tLine.startsWith('|') && tLine.endsWith('|')) {
            tableLines.push(tLine);
            i++;
          } else {
            break;
          }
        }
        
        // Build table HTML
        let tableHtml = '<table class="w-full text-sm border-collapse mb-4"><tbody>';
        let isHeader = true;
        
        for (const tLine of tableLines) {
          // Skip separator rows (|---|---|---| with any number of columns)
          if (tLine.match(/^\|[\s\-:|]+\|$/)) continue;
          
          const cells = tLine.split('|').slice(1, -1).map(c => escapeHtml(c.trim()));
          if (cells.length > 0) {
            const tag = isHeader ? 'th' : 'td';
            const cellClass = isHeader 
              ? 'border border-border bg-muted/50 px-3 py-2 text-left font-medium'
              : 'border border-border px-3 py-2';
            tableHtml += `<tr>${cells.map(c => `<${tag} class="${cellClass}">${c}</${tag}>`).join('')}</tr>`;
            isHeader = false;
          }
        }
        tableHtml += '</tbody></table>';
        outputBlocks.push(tableHtml);
        continue;
      }
      
      // Detect bullet list: line starts with • or - followed by space
      if (line.startsWith('•') || (line.startsWith('- ') && !line.startsWith('---'))) {
        const listItems: string[] = [];
        while (i < lines.length) {
          const bulletLine = lines[i].trim();
          if (bulletLine.startsWith('•') || (bulletLine.startsWith('- ') && !bulletLine.startsWith('---'))) {
            listItems.push(escapeHtml(bulletLine.replace(/^[•\-]\s*/, '')));
            i++;
          } else {
            break;
          }
        }
        const listHtml = `<ul class="list-disc pl-4 my-2">${listItems.map(item => `<li class="ml-4">${item}</li>`).join('')}</ul>`;
        outputBlocks.push(listHtml);
        continue;
      }
      
      // Empty line creates paragraph break (skip consecutive empties)
      if (line === '') {
        // Only add <br/> if the last block wasn't already a break
        if (outputBlocks.length === 0 || !outputBlocks[outputBlocks.length - 1].endsWith('<br/>')) {
          outputBlocks.push('<br/>');
        }
        i++;
        continue;
      }
      
      // Regular text - collect consecutive non-special lines
      const textLines: string[] = [];
      while (i < lines.length) {
        const tLine = lines[i].trim();
        const isBullet = tLine.startsWith('•') || (tLine.startsWith('- ') && !tLine.startsWith('---'));
        const isTable = tLine.startsWith('|') && tLine.endsWith('|');
        if (tLine === '' || isBullet || isTable) {
          break;
        }
        textLines.push(escapeHtml(tLine));
        i++;
      }
      if (textLines.length > 0) {
        outputBlocks.push(`<p class="my-1">${textLines.join('<br/>')}</p>`);
      }
    }
    
    let formatted = outputBlocks.join('');
    
    // Wrap in container
    formatted = `<div class="prose prose-sm max-w-none dark:prose-invert">${formatted}</div>`;
    
    // Highlight variables (after escaping, so we unescape the variable pattern)
    formatted = formatted.replace(/\{\{([A-Z0-9_]+)\}\}/g, '<span class="bg-primary/20 text-primary px-1 rounded font-mono text-sm">{{$1}}</span>');
    
    return formatted;
  };

  const getHierarchyStyles = (level: number) => {
    switch (level) {
      case 1:
        return {
          headerClass: "text-center text-[#1a73e8] font-bold text-base uppercase tracking-wide py-2",
          bodyClass: "text-center text-sm mt-2",
          wrapper: "bg-blue-50/50 dark:bg-blue-950/20 p-4"
        };
      case 2:
        return {
          headerClass: "text-[#1a73e8] font-semibold text-sm",
          bodyClass: "text-sm leading-relaxed mt-1 ml-2",
          wrapper: "py-2"
        };
      case 3:
        return {
          headerClass: "font-medium text-sm ml-4",
          bodyClass: "text-sm leading-relaxed ml-4 mt-1",
          wrapper: "py-1"
        };
      case 4:
        return {
          headerClass: "font-medium text-sm italic ml-6",
          bodyClass: "text-sm leading-relaxed ml-6 mt-1",
          wrapper: "py-1"
        };
      case 5:
        return {
          headerClass: "text-sm ml-8",
          bodyClass: "text-sm leading-relaxed text-justify ml-8 mt-1",
          wrapper: "py-1"
        };
      case 6:
        return {
          headerClass: "font-bold uppercase text-sm ml-8",
          bodyClass: "text-sm leading-relaxed text-justify ml-8 mt-1",
          wrapper: "py-1"
        };
      case 7:
        return {
          headerClass: "text-sm ml-10",
          bodyClass: "text-sm leading-relaxed ml-12 mt-1",
          wrapper: "py-1",
          isListItem: true
        };
      default:
        return {
          headerClass: "text-sm",
          bodyClass: "text-sm leading-relaxed",
          wrapper: ""
        };
    }
  };

  const formatStyledContent = (clause: Clause) => {
    const styles = getHierarchyStyles(clause.hierarchy_level);
    const content = clause.content || "";
    const name = clause.name || "";
    const level = clause.hierarchy_level;
    
    let formattedContent = formatContent(content);
    
    const isLevel7 = level === 7;
    const headerPrefix = isLevel7 ? '<span class="font-mono mr-2">i.</span>' : '';
    
    return `
      <div class="${styles.wrapper}">
        <div class="${styles.headerClass} mb-1">${headerPrefix}${escapeHtml(name)}</div>
        <div class="${styles.bodyClass}">${formattedContent}</div>
      </div>
    `;
  };

  const getHeaderBodyPreview = (clause: Clause) => {
    const name = clause.name || "";
    const content = clause.content || "";
    
    const plainContent = content
      .replace(/<[^>]*>/g, ' ')
      .replace(/\{\{[A-Z0-9_]+\}\}/g, '[...]')
      .replace(/\s+/g, ' ')
      .trim();
    
    const truncatedBody = plainContent.length > 150 
      ? plainContent.substring(0, 150) + "..." 
      : plainContent;
    
    return { header: name, body: truncatedBody };
  };

  return (
    <div className="flex-1 p-6 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-semibold" data-testid="text-page-title">Clause Library</h1>
            <p className="text-muted-foreground">
              Browse, filter, and edit contract clauses
            </p>
          </div>
          {stats && (
            <div className="flex gap-6">
              <div className="text-center">
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total Clauses</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">{stats.conditional}</p>
                <p className="text-xs text-muted-foreground">Conditional</p>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex flex-col md:flex-row gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search clauses by name, code, or content..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9"
                      data-testid="input-search-clauses"
                    />
                  </div>
                  <Select value={contractType} onValueChange={setContractType}>
                    <SelectTrigger className="w-full md:w-48" data-testid="select-contract-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CONTRACT_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={hierarchyLevel} onValueChange={setHierarchyLevel}>
                    <SelectTrigger className="w-full md:w-40" data-testid="select-hierarchy">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {HIERARCHY_LEVELS.map((level) => (
                        <SelectItem key={level.value} value={level.value}>
                          {level.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {hasActiveFilters && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={clearFilters}
                      className="shrink-0"
                      data-testid="button-clear-filters"
                    >
                      <RotateCcw className="h-4 w-4 mr-1" />
                      Clear Filters
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-3">
                    {[...Array(5)].map((_, i) => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </div>
                ) : error ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
                    <p>Failed to load clauses</p>
                  </div>
                ) : clauses.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No clauses found</p>
                    <p className="text-sm mt-1">Try adjusting your filters or search term</p>
                  </div>
                ) : (
                  <>
                    {selectedIds.size > 0 && (
                      <div className="mb-4 p-3 bg-muted/50 rounded-lg border" data-testid="mass-actions-bar">
                        <div className="flex items-center gap-4 flex-wrap">
                          <div className="flex items-center gap-2">
                            <CheckSquare className="h-4 w-4 text-primary" />
                            <span className="text-sm font-medium">{selectedIds.size} selected</span>
                          </div>
                          <Separator orientation="vertical" className="h-6" />
                          <div className="flex items-center gap-2">
                            <Select value={massHierarchyLevel} onValueChange={setMassHierarchyLevel}>
                              <SelectTrigger className="w-[180px] h-8" data-testid="select-mass-hierarchy">
                                <SelectValue placeholder="Change Level..." />
                              </SelectTrigger>
                              <SelectContent>
                                {EDIT_HIERARCHY_OPTIONS.map((option) => (
                                  <SelectItem key={option.value} value={String(option.value)}>
                                    {option.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button
                              size="sm"
                              onClick={applyMassHierarchy}
                              disabled={!massHierarchyLevel || massHierarchyMutation.isPending}
                              data-testid="button-apply-mass-hierarchy"
                            >
                              Apply
                            </Button>
                          </div>
                          <Separator orientation="vertical" className="h-6" />
                          <div className="flex items-center gap-2">
                            <Select value={massContractType} onValueChange={setMassContractType}>
                              <SelectTrigger className="w-[180px] h-8" data-testid="select-mass-contract-type">
                                <SelectValue placeholder="Change Type..." />
                              </SelectTrigger>
                              <SelectContent>
                                {CONTRACT_TYPES.filter(t => t.value !== "ALL").map((type) => (
                                  <SelectItem key={type.value} value={type.value}>
                                    {type.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button
                              size="sm"
                              onClick={applyMassContractType}
                              disabled={!massContractType || massContractTypeMutation.isPending}
                              data-testid="button-apply-mass-contract-type"
                            >
                              Apply
                            </Button>
                          </div>
                          <div className="ml-auto flex items-center gap-2">
                            <Button variant="ghost" size="sm" onClick={selectAllVisible} data-testid="button-select-all">
                              Select All
                            </Button>
                            <Button variant="ghost" size="sm" onClick={deselectAll} data-testid="button-deselect-all">
                              Deselect All
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                    <div className="space-y-2 max-h-[600px] overflow-y-auto">
                    {clauses.map((clause) => (
                      <Collapsible
                        key={clause.id}
                        open={expandedClauses.has(clause.id)}
                        onOpenChange={() => toggleExpanded(clause.id)}
                      >
                        <div
                          className={`border rounded-lg transition-colors ${
                            selectedClause?.id === clause.id ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                          }`}
                        >
                          <CollapsibleTrigger className="w-full" asChild>
                            <div
                              className="flex items-center gap-3 p-3 cursor-pointer"
                              onClick={() => {
                                setSelectedClause(clause);
                                setIsEditing(false);
                              }}
                              data-testid={`clause-row-${clause.id}`}
                            >
                              <Checkbox
                                checked={selectedIds.has(clause.id)}
                                onCheckedChange={() => toggleSelectClause(clause.id)}
                                onClick={(e) => e.stopPropagation()}
                                data-testid={`checkbox-clause-${clause.id}`}
                              />
                              <div className="text-muted-foreground">
                                {expandedClauses.has(clause.id) ? (
                                  <ChevronDown className="h-4 w-4" />
                                ) : (
                                  <ChevronRight className="h-4 w-4" />
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-muted-foreground">
                                {getHierarchyIcon(clause.hierarchy_level)}
                              </div>
                              <div className="flex-1 text-left min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <Badge variant="outline" className="font-mono text-xs">
                                    {clause.clause_code}
                                  </Badge>
                                  <span className="font-bold text-[#1a73e8] truncate" data-testid={`header-preview-${clause.id}`}>
                                    {getHeaderBodyPreview(clause).header || <span className="text-red-500 italic">(No Header)</span>}
                                  </span>
                                </div>
                                <div className="text-xs text-muted-foreground mt-1 line-clamp-2" data-testid={`body-preview-${clause.id}`}>
                                  {getHeaderBodyPreview(clause).body || <span className="italic">(No Body Content)</span>}
                                </div>
                                <div className="flex items-center gap-2 mt-1 flex-wrap">
                                  <Badge variant="secondary" className="text-xs">
                                    {clause.contract_type}
                                  </Badge>
                                  <Badge 
                                    variant="outline" 
                                    className={`text-xs ${clause.hierarchy_level === 1 ? 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border-blue-300' : ''}`}
                                  >
                                    L{clause.hierarchy_level}
                                  </Badge>
                                  {clause.category && (
                                    <span className="text-xs text-muted-foreground">{clause.category}</span>
                                  )}
                                  {clause.conditions && (
                                    <Badge className="text-xs bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/30">
                                      <Zap className="h-3 w-3 mr-1" />
                                      Conditional
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              {clause.negotiable && (
                                <Badge variant="outline" className="text-xs shrink-0">
                                  Negotiable
                                </Badge>
                              )}
                            </div>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="px-3 pb-3 pt-0">
                              <Separator className="mb-3" />
                              <div className="flex items-center justify-end gap-2 mb-2">
                                {inlineEditingId === clause.id ? (
                                  <>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        cancelInlineEdit();
                                      }}
                                      data-testid={`button-cancel-inline-${clause.id}`}
                                    >
                                      <X className="h-4 w-4 mr-1" />
                                      Cancel
                                    </Button>
                                    <Button
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        saveInlineEdit(clause.id);
                                      }}
                                      disabled={inlineUpdateMutation.isPending}
                                      data-testid={`button-save-inline-${clause.id}`}
                                    >
                                      <Save className="h-4 w-4 mr-1" />
                                      Save
                                    </Button>
                                  </>
                                ) : (
                                  <>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={(e) => openEditModal(clause, e)}
                                      data-testid={`button-settings-${clause.id}`}
                                    >
                                      <Settings className="h-4 w-4 mr-1" />
                                      Level
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        startInlineEdit(clause);
                                      }}
                                      data-testid={`button-edit-inline-${clause.id}`}
                                    >
                                      <Edit className="h-4 w-4 mr-1" />
                                      Edit Content
                                    </Button>
                                  </>
                                )}
                              </div>
                              {inlineEditingId === clause.id ? (
                                <RichTextEditor
                                  content={inlineEditContent}
                                  onChange={setInlineEditContent}
                                  className="min-h-[200px]"
                                />
                              ) : (
                                <div
                                  className="max-w-none"
                                  dangerouslySetInnerHTML={{ __html: formatStyledContent(clause) }}
                                />
                              )}
                              {clause.variables_used && clause.variables_used.length > 0 && (
                                <div className="mt-3 flex flex-wrap gap-1">
                                  {clause.variables_used.map((v) => (
                                    <Badge key={v} variant="outline" className="font-mono text-xs">
                                      {v}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                              {clause.conditions && (
                                <div className="mt-3 p-2 bg-amber-500/10 rounded-lg">
                                  <p className="text-xs font-medium text-amber-700 dark:text-amber-400 flex items-center gap-1">
                                    <Zap className="h-3 w-3" />
                                    Conditional Logic
                                  </p>
                                  <pre className="text-xs mt-1 font-mono overflow-x-auto">
                                    {JSON.stringify(clause.conditions, null, 2)}
                                  </pre>
                                </div>
                              )}
                            </div>
                          </CollapsibleContent>
                        </div>
                      </Collapsible>
                    ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            {selectedClause ? (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Clause Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="font-mono">
                      {selectedClause.clause_code}
                    </Badge>
                    {getRiskBadge(selectedClause.risk_level)}
                    {selectedClause.negotiable && (
                      <Badge variant="secondary">Negotiable</Badge>
                    )}
                  </div>

                  <div>
                    <h4 className="font-medium mb-1">{selectedClause.name}</h4>
                    <p className="text-sm text-muted-foreground">
                      {selectedClause.category} | Level {selectedClause.hierarchy_level}
                    </p>
                  </div>

                  {selectedClause.variables_used && selectedClause.variables_used.length > 0 && (
                    <>
                      <Separator />
                      <div>
                        <h5 className="text-sm font-medium mb-2 flex items-center gap-1">
                          <Code className="h-4 w-4" />
                          Variables Used ({selectedClause.variables_used.length})
                        </h5>
                        <div className="flex flex-wrap gap-1">
                          {selectedClause.variables_used.map((v) => (
                            <Badge key={v} variant="outline" className="font-mono text-xs">
                              {v}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </>
                  )}

                  {selectedClause.conditions && (
                    <>
                      <Separator />
                      <div>
                        <h5 className="text-sm font-medium mb-2 flex items-center gap-1">
                          <Zap className="h-4 w-4 text-amber-500" />
                          Conditional Logic
                        </h5>
                        <div className="p-2 bg-amber-500/10 rounded-lg">
                          <pre className="text-xs font-mono overflow-x-auto">
                            {JSON.stringify(selectedClause.conditions, null, 2)}
                          </pre>
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Select a clause to view details</p>
                  <p className="text-sm mt-1">Click on any clause in the list</p>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Quick Stats</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Showing</span>
                  <span className="font-medium">{clauses.length} clauses</span>
                </div>
                {stats && (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Contract Types</span>
                      <span className="font-medium">{stats.contract_types}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Categories</span>
                      <span className="font-medium">{stats.categories}</span>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Clause Settings</DialogTitle>
          </DialogHeader>
          {editingClause && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Clause Code</Label>
                <p className="text-sm text-muted-foreground font-mono">{editingClause.clause_code}</p>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Clause Name</Label>
                <p className="text-sm text-muted-foreground">{editingClause.name}</p>
              </div>
              <Separator />
              <div className="space-y-2">
                <Label htmlFor="hierarchy-level" className="text-sm font-medium">
                  Hierarchy Level
                </Label>
                <Select
                  value={String(editHierarchyLevel)}
                  onValueChange={(value) => setEditHierarchyLevel(parseInt(value, 10))}
                >
                  <SelectTrigger className="w-full" data-testid="select-edit-hierarchy">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EDIT_HIERARCHY_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={String(option.value)}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Changing the hierarchy level affects how this clause is numbered and styled in contracts.
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditModalOpen(false)}
              data-testid="button-cancel-edit-modal"
            >
              Cancel
            </Button>
            <Button
              onClick={saveHierarchyLevel}
              disabled={hierarchyUpdateMutation.isPending}
              data-testid="button-save-hierarchy"
            >
              {hierarchyUpdateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

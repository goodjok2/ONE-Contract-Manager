import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  FileText,
  Plus,
  Edit,
  Trash2,
  Save,
  X,
  Zap,
  FileCode,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface Exhibit {
  id: number;
  letter: string;
  title: string;
  content: string;
  isDynamic: boolean;
  disclosureCode: string | null;
  contractTypes: string[] | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string | null;
}

const CONTRACT_TYPES = [
  { value: "MASTER_EF", label: "Master Purchase Agreement" },
  { value: "ONE", label: "ONE Agreement (Archived)" },
  { value: "MANUFACTURING", label: "Manufacturing (Archived)" },
  { value: "ONSITE", label: "OnSite (Archived)" },
];

const EXHIBIT_LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];

export default function ExhibitsPage() {
  const [selectedExhibit, setSelectedExhibit] = useState<Exhibit | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [editData, setEditData] = useState<Partial<Exhibit>>({});
  const { toast } = useToast();

  const { data: exhibits, isLoading, error } = useQuery<Exhibit[]>({
    queryKey: ["/api/exhibits"],
  });

  const updateMutation = useMutation({
    mutationFn: async (data: { id: number; updates: Partial<Exhibit> }) => {
      const response = await apiRequest("PUT", `/api/exhibits/${data.id}`, data.updates);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/exhibits"] });
      setIsEditing(false);
      setSelectedExhibit(null);
      toast({ title: "Exhibit updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update exhibit", variant: "destructive" });
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: Partial<Exhibit>) => {
      const response = await apiRequest("POST", "/api/exhibits", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/exhibits"] });
      setIsCreating(false);
      setEditData({});
      toast({ title: "Exhibit created successfully" });
    },
    onError: () => {
      toast({ title: "Failed to create exhibit", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest("DELETE", `/api/exhibits/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/exhibits"] });
      setSelectedExhibit(null);
      toast({ title: "Exhibit deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete exhibit", variant: "destructive" });
    },
  });

  const handleEdit = (exhibit: Exhibit) => {
    setSelectedExhibit(exhibit);
    setEditData({
      letter: exhibit.letter,
      title: exhibit.title,
      content: exhibit.content,
      isDynamic: exhibit.isDynamic,
      disclosureCode: exhibit.disclosureCode,
      contractTypes: exhibit.contractTypes,
      sortOrder: exhibit.sortOrder,
      isActive: exhibit.isActive,
    });
    setIsEditing(true);
  };

  const handleSave = () => {
    if (selectedExhibit) {
      updateMutation.mutate({ id: selectedExhibit.id, updates: editData });
    }
  };

  const handleCreate = () => {
    createMutation.mutate({
      letter: editData.letter || "A",
      title: editData.title || "New Exhibit",
      content: editData.content || "",
      isDynamic: editData.isDynamic || false,
      disclosureCode: editData.disclosureCode || null,
      contractTypes: editData.contractTypes || ["MASTER_EF"],
      sortOrder: editData.sortOrder || (exhibits?.length || 0) + 1,
      isActive: editData.isActive !== false,
    });
  };

  const toggleContractType = (type: string) => {
    const current = editData.contractTypes || [];
    if (current.includes(type)) {
      setEditData({ ...editData, contractTypes: current.filter(t => t !== type) });
    } else {
      setEditData({ ...editData, contractTypes: [...current, type] });
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Card className="border-destructive">
          <CardContent className="p-6">
            <p className="text-destructive">Failed to load exhibits. Please try again.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Exhibit Library</h1>
          <p className="text-muted-foreground">Manage contract exhibits and attachments</p>
        </div>
        <Dialog open={isCreating} onOpenChange={setIsCreating}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-exhibit" onClick={() => setEditData({})}>
              <Plus className="w-4 h-4 mr-2" />
              New Exhibit
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Exhibit</DialogTitle>
              <DialogDescription>Add a new exhibit to the contract library</DialogDescription>
            </DialogHeader>
            <ExhibitForm
              data={editData}
              onChange={setEditData}
              onToggleContractType={toggleContractType}
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreating(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={createMutation.isPending} data-testid="button-save-new-exhibit">
                {createMutation.isPending ? "Creating..." : "Create Exhibit"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {exhibits?.map((exhibit) => (
          <Card 
            key={exhibit.id} 
            className={`hover-elevate cursor-pointer ${!exhibit.isActive ? 'opacity-60' : ''}`}
            onClick={() => setSelectedExhibit(exhibit)}
            data-testid={`card-exhibit-${exhibit.id}`}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="font-mono text-lg">
                    {exhibit.letter}
                  </Badge>
                  <CardTitle className="text-lg">{exhibit.title}</CardTitle>
                </div>
                {exhibit.isDynamic && (
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <Zap className="w-3 h-3" />
                    Dynamic
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {exhibit.content.replace(/<[^>]*>/g, '').substring(0, 150)}...
                </p>
                <div className="flex flex-wrap gap-1">
                  {exhibit.contractTypes?.map(type => (
                    <Badge key={type} variant="outline" className="text-xs">
                      {type}
                    </Badge>
                  ))}
                </div>
                {!exhibit.isActive && (
                  <Badge variant="destructive" className="text-xs">Inactive</Badge>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {exhibits?.length === 0 && (
        <Card className="p-12 text-center">
          <FileCode className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No Exhibits Found</h3>
          <p className="text-muted-foreground mb-4">Create your first exhibit to get started.</p>
          <Button onClick={() => setIsCreating(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Create Exhibit
          </Button>
        </Card>
      )}

      <Dialog open={!!selectedExhibit && !isEditing} onOpenChange={(open) => !open && setSelectedExhibit(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          {selectedExhibit && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="font-mono text-lg">
                    {selectedExhibit.letter}
                  </Badge>
                  <DialogTitle>{selectedExhibit.title}</DialogTitle>
                </div>
                <DialogDescription>
                  {selectedExhibit.isDynamic ? "Dynamic exhibit with state-specific content" : "Static exhibit"}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label className="text-sm text-muted-foreground">Contract Types</Label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {selectedExhibit.contractTypes?.map(type => (
                      <Badge key={type} variant="outline">{type}</Badge>
                    ))}
                  </div>
                </div>
                {selectedExhibit.isDynamic && selectedExhibit.disclosureCode && (
                  <div>
                    <Label className="text-sm text-muted-foreground">Disclosure Code</Label>
                    <p className="font-mono text-sm">{selectedExhibit.disclosureCode}</p>
                  </div>
                )}
                <div>
                  <Label className="text-sm text-muted-foreground">Content Preview</Label>
                  <div 
                    className="mt-1 p-4 bg-muted rounded-md prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: selectedExhibit.content }}
                  />
                </div>
              </div>
              <DialogFooter className="gap-2">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm" data-testid="button-delete-exhibit">
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Exhibit?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete Exhibit {selectedExhibit.letter} - {selectedExhibit.title}. 
                        This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => deleteMutation.mutate(selectedExhibit.id)}
                        className="bg-destructive text-destructive-foreground"
                        data-testid="button-confirm-delete"
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                <Button onClick={() => handleEdit(selectedExhibit)} data-testid="button-edit-exhibit">
                  <Edit className="w-4 h-4 mr-2" />
                  Edit
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isEditing} onOpenChange={(open) => !open && setIsEditing(false)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Exhibit {editData.letter}</DialogTitle>
            <DialogDescription>Update exhibit details and content</DialogDescription>
          </DialogHeader>
          <ExhibitForm
            data={editData}
            onChange={setEditData}
            onToggleContractType={toggleContractType}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditing(false)}>
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={updateMutation.isPending} data-testid="button-save-exhibit">
              <Save className="w-4 h-4 mr-2" />
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ExhibitForm({
  data,
  onChange,
  onToggleContractType,
}: {
  data: Partial<Exhibit>;
  onChange: (data: Partial<Exhibit>) => void;
  onToggleContractType: (type: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="letter">Exhibit Letter</Label>
          <Select
            value={data.letter || "A"}
            onValueChange={(value) => onChange({ ...data, letter: value })}
          >
            <SelectTrigger data-testid="select-exhibit-letter">
              <SelectValue placeholder="Select letter" />
            </SelectTrigger>
            <SelectContent>
              {EXHIBIT_LETTERS.map(letter => (
                <SelectItem key={letter} value={letter}>
                  Exhibit {letter}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="sortOrder">Sort Order</Label>
          <Input
            id="sortOrder"
            type="number"
            value={data.sortOrder || 0}
            onChange={(e) => onChange({ ...data, sortOrder: parseInt(e.target.value) || 0 })}
            data-testid="input-sort-order"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          value={data.title || ""}
          onChange={(e) => onChange({ ...data, title: e.target.value })}
          placeholder="Exhibit title"
          data-testid="input-exhibit-title"
        />
      </div>

      <div className="space-y-2">
        <Label>Contract Types</Label>
        <div className="flex flex-wrap gap-2">
          {CONTRACT_TYPES.map(type => (
            <Badge
              key={type.value}
              variant={data.contractTypes?.includes(type.value) ? "default" : "outline"}
              className="cursor-pointer toggle-elevate"
              onClick={() => onToggleContractType(type.value)}
              data-testid={`badge-contract-type-${type.value}`}
            >
              {type.label}
            </Badge>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Switch
            id="isActive"
            checked={data.isActive !== false}
            onCheckedChange={(checked) => onChange({ ...data, isActive: checked })}
            data-testid="switch-is-active"
          />
          <Label htmlFor="isActive">Active</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            id="isDynamic"
            checked={data.isDynamic || false}
            onCheckedChange={(checked) => onChange({ ...data, isDynamic: checked })}
            data-testid="switch-is-dynamic"
          />
          <Label htmlFor="isDynamic">Dynamic (State-specific)</Label>
        </div>
      </div>

      {data.isDynamic && (
        <div className="space-y-2">
          <Label htmlFor="disclosureCode">Disclosure Code</Label>
          <Input
            id="disclosureCode"
            value={data.disclosureCode || ""}
            onChange={(e) => onChange({ ...data, disclosureCode: e.target.value })}
            placeholder="e.g., WARRANTY_EXCLUSIVITY"
            data-testid="input-disclosure-code"
          />
          <p className="text-xs text-muted-foreground">
            Used to look up state-specific content from the state_disclosures table
          </p>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="content">Content (HTML)</Label>
        <Textarea
          id="content"
          value={data.content || ""}
          onChange={(e) => onChange({ ...data, content: e.target.value })}
          placeholder="Enter exhibit content (HTML supported). Use {{VARIABLE_NAME}} for dynamic values."
          className="min-h-[200px] font-mono text-sm"
          data-testid="textarea-exhibit-content"
        />
        <p className="text-xs text-muted-foreground">
          Supports HTML and variable placeholders like {"{{PRICING_BREAKDOWN_TABLE}}"} or {"{{PROJECT_STATE}}"}
        </p>
      </div>
    </div>
  );
}

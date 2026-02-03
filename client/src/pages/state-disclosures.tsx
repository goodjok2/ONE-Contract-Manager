import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Plus,
  Edit,
  Trash2,
  Save,
  X,
  Scale,
  Search,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface StateDisclosure {
  id: number;
  code: string;
  state: string;
  content: string;
  createdAt: string;
  updatedAt: string | null;
}

const US_STATES = [
  { code: "AZ", name: "Arizona" },
  { code: "CA", name: "California" },
  { code: "CO", name: "Colorado" },
  { code: "FL", name: "Florida" },
  { code: "GA", name: "Georgia" },
  { code: "ID", name: "Idaho" },
  { code: "IL", name: "Illinois" },
  { code: "MA", name: "Massachusetts" },
  { code: "MI", name: "Michigan" },
  { code: "NV", name: "Nevada" },
  { code: "NY", name: "New York" },
  { code: "OR", name: "Oregon" },
  { code: "PA", name: "Pennsylvania" },
  { code: "TX", name: "Texas" },
  { code: "UT", name: "Utah" },
  { code: "WA", name: "Washington" },
];

export default function StateDisclosuresPage() {
  const [selectedDisclosure, setSelectedDisclosure] = useState<StateDisclosure | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [editData, setEditData] = useState<Partial<StateDisclosure>>({});
  const [filterState, setFilterState] = useState<string>("all");
  const [filterCode, setFilterCode] = useState<string>("");
  const { toast } = useToast();

  const { data: disclosures, isLoading, error } = useQuery<StateDisclosure[]>({
    queryKey: ["/api/state-disclosures"],
  });

  const updateMutation = useMutation({
    mutationFn: async (data: { id: number; updates: Partial<StateDisclosure> }) => {
      const response = await apiRequest("PUT", `/api/state-disclosures/${data.id}`, data.updates);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/state-disclosures"] });
      setIsEditing(false);
      setSelectedDisclosure(null);
      toast({ title: "State disclosure updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update state disclosure", variant: "destructive" });
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: Partial<StateDisclosure>) => {
      const response = await apiRequest("POST", "/api/state-disclosures", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/state-disclosures"] });
      setIsCreating(false);
      setEditData({});
      toast({ title: "State disclosure created successfully" });
    },
    onError: () => {
      toast({ title: "Failed to create state disclosure", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest("DELETE", `/api/state-disclosures/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/state-disclosures"] });
      setSelectedDisclosure(null);
      toast({ title: "State disclosure deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete state disclosure", variant: "destructive" });
    },
  });

  const handleEdit = (disclosure: StateDisclosure) => {
    setSelectedDisclosure(disclosure);
    setEditData({
      code: disclosure.code,
      state: disclosure.state,
      content: disclosure.content,
    });
    setIsEditing(true);
  };

  const handleSave = () => {
    if (selectedDisclosure) {
      updateMutation.mutate({ id: selectedDisclosure.id, updates: editData });
    }
  };

  const handleCreate = () => {
    if (!editData.code || !editData.state || !editData.content) {
      toast({ title: "Please fill in all required fields", variant: "destructive" });
      return;
    }
    createMutation.mutate({
      code: editData.code,
      state: editData.state,
      content: editData.content,
    });
  };

  const filteredDisclosures = disclosures?.filter(d => {
    const stateMatch = filterState === "all" || d.state === filterState;
    const codeMatch = !filterCode || d.code.toLowerCase().includes(filterCode.toLowerCase());
    return stateMatch && codeMatch;
  });

  const uniqueCodes = Array.from(new Set(disclosures?.map(d => d.code) || [])).sort();
  const stateStats = disclosures?.reduce((acc, d) => {
    acc[d.state] = (acc[d.state] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) || {};

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Card className="border-destructive">
          <CardContent className="p-6">
            <p className="text-destructive">Failed to load state disclosures. Please try again.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">State Disclosures</h1>
          <p className="text-muted-foreground">Manage state-specific legal disclosures for contracts</p>
        </div>
        <Dialog open={isCreating} onOpenChange={setIsCreating}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-disclosure" onClick={() => setEditData({})}>
              <Plus className="w-4 h-4 mr-2" />
              New Disclosure
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New State Disclosure</DialogTitle>
              <DialogDescription>Add a new state-specific legal disclosure</DialogDescription>
            </DialogHeader>
            <DisclosureForm data={editData} onChange={setEditData} />
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreating(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={createMutation.isPending} data-testid="button-save-new-disclosure">
                {createMutation.isPending ? "Creating..." : "Create Disclosure"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2">
        {US_STATES.map(state => (
          <Badge
            key={state.code}
            variant={filterState === state.code ? "default" : "outline"}
            className="cursor-pointer justify-center toggle-elevate"
            onClick={() => setFilterState(filterState === state.code ? "all" : state.code)}
            data-testid={`badge-filter-state-${state.code}`}
          >
            {state.code} ({stateStats[state.code] || 0})
          </Badge>
        ))}
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Filter by disclosure code..."
            value={filterCode}
            onChange={(e) => setFilterCode(e.target.value)}
            className="pl-10"
            data-testid="input-filter-code"
          />
        </div>
        {(filterState !== "all" || filterCode) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setFilterState("all"); setFilterCode(""); }}
            data-testid="button-clear-filters"
          >
            <X className="w-4 h-4 mr-1" />
            Clear Filters
          </Button>
        )}
        <div className="text-sm text-muted-foreground">
          Showing {filteredDisclosures?.length || 0} of {disclosures?.length || 0} disclosures
        </div>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-24">State</TableHead>
              <TableHead className="w-48">Disclosure Code</TableHead>
              <TableHead>Content Preview</TableHead>
              <TableHead className="w-32 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredDisclosures?.map((disclosure) => (
              <TableRow key={disclosure.id} data-testid={`row-disclosure-${disclosure.id}`}>
                <TableCell>
                  <Badge variant="outline">{disclosure.state}</Badge>
                </TableCell>
                <TableCell className="font-mono text-sm">{disclosure.code}</TableCell>
                <TableCell className="text-sm text-muted-foreground max-w-md truncate">
                  {disclosure.content.replace(/<[^>]*>/g, '').substring(0, 100)}...
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => { setSelectedDisclosure(disclosure); }}
                      data-testid={`button-view-disclosure-${disclosure.id}`}
                    >
                      <Scale className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(disclosure)}
                      data-testid={`button-edit-disclosure-${disclosure.id}`}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" data-testid={`button-delete-disclosure-${disclosure.id}`}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Disclosure?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete the {disclosure.state} - {disclosure.code} disclosure.
                            This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteMutation.mutate(disclosure.id)}
                            className="bg-destructive text-destructive-foreground"
                            data-testid="button-confirm-delete"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {filteredDisclosures?.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-12">
                  <Scale className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No Disclosures Found</h3>
                  <p className="text-muted-foreground mb-4">
                    {filterState !== "all" || filterCode
                      ? "Try adjusting your filters."
                      : "Create your first state disclosure to get started."}
                  </p>
                  {filterState === "all" && !filterCode && (
                    <Button onClick={() => setIsCreating(true)}>
                      <Plus className="w-4 h-4 mr-2" />
                      Create Disclosure
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={!!selectedDisclosure && !isEditing} onOpenChange={(open) => !open && setSelectedDisclosure(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          {selectedDisclosure && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{selectedDisclosure.state}</Badge>
                  <DialogTitle className="font-mono">{selectedDisclosure.code}</DialogTitle>
                </div>
                <DialogDescription>
                  State-specific disclosure content
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label className="text-sm text-muted-foreground">State</Label>
                  <p>{US_STATES.find(s => s.code === selectedDisclosure.state)?.name || selectedDisclosure.state}</p>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Disclosure Code</Label>
                  <p className="font-mono">{selectedDisclosure.code}</p>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Content</Label>
                  <div 
                    className="mt-1 p-4 bg-muted rounded-md prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: selectedDisclosure.content }}
                  />
                </div>
              </div>
              <DialogFooter className="gap-2">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm" data-testid="button-delete-disclosure">
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Disclosure?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete the {selectedDisclosure.state} - {selectedDisclosure.code} disclosure.
                        This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => deleteMutation.mutate(selectedDisclosure.id)}
                        className="bg-destructive text-destructive-foreground"
                        data-testid="button-confirm-delete-modal"
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                <Button onClick={() => handleEdit(selectedDisclosure)} data-testid="button-edit-disclosure">
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
            <DialogTitle>Edit State Disclosure</DialogTitle>
            <DialogDescription>Update disclosure details and content</DialogDescription>
          </DialogHeader>
          <DisclosureForm data={editData} onChange={setEditData} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditing(false)}>
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={updateMutation.isPending} data-testid="button-save-disclosure">
              <Save className="w-4 h-4 mr-2" />
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DisclosureForm({
  data,
  onChange,
}: {
  data: Partial<StateDisclosure>;
  onChange: (data: Partial<StateDisclosure>) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="state">State</Label>
          <Select
            value={data.state || ""}
            onValueChange={(value) => onChange({ ...data, state: value })}
          >
            <SelectTrigger data-testid="select-disclosure-state">
              <SelectValue placeholder="Select state" />
            </SelectTrigger>
            <SelectContent>
              {US_STATES.map(state => (
                <SelectItem key={state.code} value={state.code}>
                  {state.name} ({state.code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="code">Disclosure Code</Label>
          <Input
            id="code"
            value={data.code || ""}
            onChange={(e) => onChange({ ...data, code: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '_') })}
            placeholder="e.g., WARRANTY_EXCLUSIVITY"
            data-testid="input-disclosure-code"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="content">Content (HTML)</Label>
        <Textarea
          id="content"
          value={data.content || ""}
          onChange={(e) => onChange({ ...data, content: e.target.value })}
          placeholder="Enter disclosure content (HTML supported)"
          className="min-h-[300px] font-mono text-sm"
          data-testid="textarea-disclosure-content"
        />
        <p className="text-xs text-muted-foreground">
          Supports HTML formatting. This content will be injected into contracts based on the disclosure code and project state.
        </p>
      </div>
    </div>
  );
}

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AdminLayout } from "@/components/admin-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

const US_STATES = [
  "AZ", "CA", "CO", "FL", "GA", "ID", "IL", "MA", "MI", "NV", "NY", "OR", "PA", "TX", "UT", "WA"
];

interface StateDisclosure {
  id: number;
  state: string;
  disclosure_type: string;
  title: string;
  content?: string;
  requires_initials: boolean;
  is_active: boolean;
}

const stateDisclosureSchema = z.object({
  state: z.string().min(1, "State is required"),
  disclosureType: z.string().min(1, "Disclosure type is required"),
  title: z.string().min(1, "Title is required"),
  content: z.string().optional(),
  requiresInitials: z.boolean().default(false),
});

type StateDisclosureFormValues = z.infer<typeof stateDisclosureSchema>;

export default function AdminStateDisclosures() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingDisclosure, setEditingDisclosure] = useState<StateDisclosure | null>(null);
  const [deleteDisclosure, setDeleteDisclosure] = useState<StateDisclosure | null>(null);
  const { toast } = useToast();

  const { data: disclosures, isLoading } = useQuery<StateDisclosure[]>({
    queryKey: ["/api/state-disclosures"],
  });

  const form = useForm<StateDisclosureFormValues>({
    resolver: zodResolver(stateDisclosureSchema),
    defaultValues: {
      state: "",
      disclosureType: "",
      title: "",
      content: "",
      requiresInitials: false,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: StateDisclosureFormValues) => {
      return apiRequest("POST", "/api/state-disclosures", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/state-disclosures"] });
      setIsDialogOpen(false);
      form.reset();
      toast({ title: "State disclosure created successfully" });
    },
    onError: () => {
      toast({ title: "Failed to create state disclosure", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: StateDisclosureFormValues }) => {
      return apiRequest("PATCH", `/api/state-disclosures/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/state-disclosures"] });
      setIsDialogOpen(false);
      setEditingDisclosure(null);
      form.reset();
      toast({ title: "State disclosure updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update state disclosure", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/state-disclosures/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/state-disclosures"] });
      setDeleteDisclosure(null);
      toast({ title: "State disclosure deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete state disclosure", variant: "destructive" });
    },
  });

  const handleOpenCreate = () => {
    setEditingDisclosure(null);
    form.reset();
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (disclosure: StateDisclosure) => {
    setEditingDisclosure(disclosure);
    form.reset({
      state: disclosure.state,
      disclosureType: disclosure.disclosure_type,
      title: disclosure.title,
      content: disclosure.content || "",
      requiresInitials: disclosure.requires_initials,
    });
    setIsDialogOpen(true);
  };

  const onSubmit = (data: StateDisclosureFormValues) => {
    if (editingDisclosure) {
      updateMutation.mutate({ id: editingDisclosure.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold" data-testid="text-page-title">
              State Disclosures
            </h1>
            <p className="text-muted-foreground mt-1">
              Manage state-specific legal disclosures
            </p>
          </div>
          <Button onClick={handleOpenCreate} data-testid="button-add-disclosure">
            <Plus className="h-4 w-4 mr-2" />
            Add Disclosure
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>State</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Initials</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {disclosures?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      No state disclosures found. Click "Add Disclosure" to create one.
                    </TableCell>
                  </TableRow>
                ) : (
                  disclosures?.map((disclosure) => (
                    <TableRow key={disclosure.id} data-testid={`row-disclosure-${disclosure.id}`}>
                      <TableCell>
                        <Badge variant="outline">{disclosure.state}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {disclosure.disclosure_type}
                      </TableCell>
                      <TableCell className="font-medium">{disclosure.title}</TableCell>
                      <TableCell>
                        {disclosure.requires_initials ? (
                          <Badge variant="secondary">Required</Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleOpenEdit(disclosure)}
                            data-testid={`button-edit-${disclosure.id}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setDeleteDisclosure(disclosure)}
                            data-testid={`button-delete-${disclosure.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editingDisclosure ? "Edit State Disclosure" : "Add State Disclosure"}
              </DialogTitle>
              <DialogDescription>
                {editingDisclosure
                  ? "Update the state disclosure details below."
                  : "Enter the details for the new state disclosure."}
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="state"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>State</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-state">
                              <SelectValue placeholder="Select state" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {US_STATES.map((state) => (
                              <SelectItem key={state} value={state}>
                                {state}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="disclosureType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Disclosure Type</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="e.g., WARRANTY" data-testid="input-type" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-title" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="content"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Content</FormLabel>
                      <FormControl>
                        <Textarea {...field} rows={4} data-testid="input-content" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={createMutation.isPending || updateMutation.isPending}
                    data-testid="button-submit"
                  >
                    {createMutation.isPending || updateMutation.isPending
                      ? "Saving..."
                      : editingDisclosure
                      ? "Update"
                      : "Create"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        <AlertDialog open={!!deleteDisclosure} onOpenChange={() => setDeleteDisclosure(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete State Disclosure</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete "{deleteDisclosure?.title}"? This action cannot
                be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteDisclosure && deleteMutation.mutate(deleteDisclosure.id)}
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

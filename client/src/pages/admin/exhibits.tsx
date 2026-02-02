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

interface Exhibit {
  id: number;
  exhibit_code: string;
  name: string;
  description?: string;
  content?: string;
  contract_types?: string[];
  is_active: boolean;
}

const exhibitSchema = z.object({
  exhibitCode: z.string().min(1, "Exhibit code is required"),
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  content: z.string().optional(),
  contractTypes: z.array(z.string()).optional(),
});

type ExhibitFormValues = z.infer<typeof exhibitSchema>;

export default function AdminExhibits() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingExhibit, setEditingExhibit] = useState<Exhibit | null>(null);
  const [deleteExhibit, setDeleteExhibit] = useState<Exhibit | null>(null);
  const { toast } = useToast();

  const { data: exhibits, isLoading } = useQuery<Exhibit[]>({
    queryKey: ["/api/exhibits"],
  });

  const form = useForm<ExhibitFormValues>({
    resolver: zodResolver(exhibitSchema),
    defaultValues: {
      exhibitCode: "",
      name: "",
      description: "",
      content: "",
      contractTypes: [],
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: ExhibitFormValues) => {
      return apiRequest("POST", "/api/exhibits", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/exhibits"] });
      setIsDialogOpen(false);
      form.reset();
      toast({ title: "Exhibit created successfully" });
    },
    onError: () => {
      toast({ title: "Failed to create exhibit", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: ExhibitFormValues }) => {
      return apiRequest("PATCH", `/api/exhibits/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/exhibits"] });
      setIsDialogOpen(false);
      setEditingExhibit(null);
      form.reset();
      toast({ title: "Exhibit updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update exhibit", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/exhibits/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/exhibits"] });
      setDeleteExhibit(null);
      toast({ title: "Exhibit deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete exhibit", variant: "destructive" });
    },
  });

  const handleOpenCreate = () => {
    setEditingExhibit(null);
    form.reset();
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (exhibit: Exhibit) => {
    setEditingExhibit(exhibit);
    form.reset({
      exhibitCode: exhibit.exhibit_code,
      name: exhibit.name,
      description: exhibit.description || "",
      content: exhibit.content || "",
      contractTypes: exhibit.contract_types || [],
    });
    setIsDialogOpen(true);
  };

  const onSubmit = (data: ExhibitFormValues) => {
    if (editingExhibit) {
      updateMutation.mutate({ id: editingExhibit.id, data });
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
              Exhibits
            </h1>
            <p className="text-muted-foreground mt-1">
              Manage contract exhibits
            </p>
          </div>
          <Button onClick={handleOpenCreate} data-testid="button-add-exhibit">
            <Plus className="h-4 w-4 mr-2" />
            Add Exhibit
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
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Contract Types</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {exhibits?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                      No exhibits found. Click "Add Exhibit" to create one.
                    </TableCell>
                  </TableRow>
                ) : (
                  exhibits?.map((exhibit) => (
                    <TableRow key={exhibit.id} data-testid={`row-exhibit-${exhibit.id}`}>
                      <TableCell className="font-medium">{exhibit.exhibit_code}</TableCell>
                      <TableCell>{exhibit.name}</TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          {exhibit.contract_types?.map((type) => (
                            <Badge key={type} variant="secondary" className="text-xs">
                              {type}
                            </Badge>
                          )) || "-"}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleOpenEdit(exhibit)}
                            data-testid={`button-edit-${exhibit.id}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setDeleteExhibit(exhibit)}
                            data-testid={`button-delete-${exhibit.id}`}
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
                {editingExhibit ? "Edit Exhibit" : "Add Exhibit"}
              </DialogTitle>
              <DialogDescription>
                {editingExhibit
                  ? "Update the exhibit details below."
                  : "Enter the details for the new exhibit."}
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="exhibitCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Exhibit Code</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="e.g., EXHIBIT_A" data-testid="input-exhibit-code" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Name</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea {...field} data-testid="input-description" />
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
                      : editingExhibit
                      ? "Update"
                      : "Create"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        <AlertDialog open={!!deleteExhibit} onOpenChange={() => setDeleteExhibit(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Exhibit</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete "{deleteExhibit?.name}"? This action cannot
                be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteExhibit && deleteMutation.mutate(deleteExhibit.id)}
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

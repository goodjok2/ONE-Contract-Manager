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
  FormDescription,
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

interface VariableMapping {
  id: number;
  variable_name: string;
  source_path: string;
  description?: string;
}

const variableSchema = z.object({
  variableName: z.string().min(1, "Variable name is required"),
  sourcePath: z.string().min(1, "Source path is required"),
  description: z.string().optional(),
});

type VariableFormValues = z.infer<typeof variableSchema>;

export default function AdminVariables() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingVariable, setEditingVariable] = useState<VariableMapping | null>(null);
  const [deleteVariable, setDeleteVariable] = useState<VariableMapping | null>(null);
  const { toast } = useToast();

  const { data: variables, isLoading } = useQuery<VariableMapping[]>({
    queryKey: ["/api/variable-mappings"],
  });

  const form = useForm<VariableFormValues>({
    resolver: zodResolver(variableSchema),
    defaultValues: {
      variableName: "",
      sourcePath: "",
      description: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: VariableFormValues) => {
      return apiRequest("POST", "/api/variable-mappings", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/variable-mappings"] });
      setIsDialogOpen(false);
      form.reset();
      toast({ title: "Variable mapping created successfully" });
    },
    onError: () => {
      toast({ title: "Failed to create variable mapping", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: VariableFormValues }) => {
      return apiRequest("PATCH", `/api/variable-mappings/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/variable-mappings"] });
      setIsDialogOpen(false);
      setEditingVariable(null);
      form.reset();
      toast({ title: "Variable mapping updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update variable mapping", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/variable-mappings/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/variable-mappings"] });
      setDeleteVariable(null);
      toast({ title: "Variable mapping deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete variable mapping", variant: "destructive" });
    },
  });

  const handleOpenCreate = () => {
    setEditingVariable(null);
    form.reset();
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (variable: VariableMapping) => {
    setEditingVariable(variable);
    form.reset({
      variableName: variable.variable_name,
      sourcePath: variable.source_path,
      description: variable.description || "",
    });
    setIsDialogOpen(true);
  };

  const onSubmit = (data: VariableFormValues) => {
    if (editingVariable) {
      updateMutation.mutate({ id: editingVariable.id, data });
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
              Variable Mappings
            </h1>
            <p className="text-muted-foreground mt-1">
              Configure contract variable mappings and data sources
            </p>
          </div>
          <Button onClick={handleOpenCreate} data-testid="button-add-variable">
            <Plus className="h-4 w-4 mr-2" />
            Add Variable
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
                  <TableHead>Variable Name</TableHead>
                  <TableHead>Source Path</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {variables?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                      No variable mappings found. Click "Add Variable" to create one.
                    </TableCell>
                  </TableRow>
                ) : (
                  variables?.map((variable) => (
                    <TableRow key={variable.id} data-testid={`row-variable-${variable.id}`}>
                      <TableCell className="font-mono text-sm">{variable.variable_name}</TableCell>
                      <TableCell className="font-mono text-sm text-muted-foreground">
                        {variable.source_path}
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {variable.description || "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleOpenEdit(variable)}
                            data-testid={`button-edit-${variable.id}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setDeleteVariable(variable)}
                            data-testid={`button-delete-${variable.id}`}
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
                {editingVariable ? "Edit Variable Mapping" : "Add Variable Mapping"}
              </DialogTitle>
              <DialogDescription>
                {editingVariable
                  ? "Update the variable mapping details below."
                  : "Enter the details for the new variable mapping."}
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="variableName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Variable Name</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          placeholder="{{CLIENT_ADDRESS}}" 
                          className="font-mono"
                          data-testid="input-variable-name" 
                        />
                      </FormControl>
                      <FormDescription>
                        Use double curly braces, e.g., {"{{CLIENT_NAME}}"}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="sourcePath"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Source Path</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          placeholder="project.client.address"
                          className="font-mono"
                          data-testid="input-source-path" 
                        />
                      </FormControl>
                      <FormDescription>
                        Dot notation path to the data source
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

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
                      : editingVariable
                      ? "Update"
                      : "Create"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        <AlertDialog open={!!deleteVariable} onOpenChange={() => setDeleteVariable(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Variable Mapping</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete "{deleteVariable?.variable_name}"? This action cannot
                be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteVariable && deleteMutation.mutate(deleteVariable.id)}
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

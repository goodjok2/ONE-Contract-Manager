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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Plus, Pencil, Trash2, Lock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface ComponentItem {
  id: number;
  tag_name: string;
  content: string;
  description?: string;
  service_model?: string;
  is_system: boolean;
}

const componentSchema = z.object({
  tagName: z.string().min(1, "Tag name is required"),
  content: z.string().min(1, "Content is required"),
  description: z.string().optional(),
  serviceModel: z.string().optional(),
});

type ComponentFormValues = z.infer<typeof componentSchema>;

export default function AdminComponents() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingComponent, setEditingComponent] = useState<ComponentItem | null>(null);
  const [deleteComponent, setDeleteComponent] = useState<ComponentItem | null>(null);
  const { toast } = useToast();

  const { data: components, isLoading } = useQuery<ComponentItem[]>({
    queryKey: ["/api/components"],
  });

  const form = useForm<ComponentFormValues>({
    resolver: zodResolver(componentSchema),
    defaultValues: {
      tagName: "",
      content: "",
      description: "",
      serviceModel: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: ComponentFormValues) => {
      return apiRequest("POST", "/api/components", {
        ...data,
        serviceModel: data.serviceModel || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/components"] });
      setIsDialogOpen(false);
      form.reset();
      toast({ title: "Component created successfully" });
    },
    onError: () => {
      toast({ title: "Failed to create component", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: ComponentFormValues }) => {
      return apiRequest("PATCH", `/api/components/${id}`, {
        ...data,
        serviceModel: data.serviceModel || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/components"] });
      setIsDialogOpen(false);
      setEditingComponent(null);
      form.reset();
      toast({ title: "Component updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update component", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/components/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/components"] });
      setDeleteComponent(null);
      toast({ title: "Component deleted successfully" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to delete component", 
        description: error?.message || "System components cannot be deleted",
        variant: "destructive" 
      });
    },
  });

  const handleOpenCreate = () => {
    setEditingComponent(null);
    form.reset();
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (component: ComponentItem) => {
    setEditingComponent(component);
    form.reset({
      tagName: component.tag_name,
      content: component.content,
      description: component.description || "",
      serviceModel: component.service_model || "",
    });
    setIsDialogOpen(true);
  };

  const onSubmit = (data: ComponentFormValues) => {
    if (editingComponent) {
      updateMutation.mutate({ id: editingComponent.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const getServiceModelBadge = (model?: string) => {
    if (!model) return <Badge variant="outline">All</Badge>;
    if (model === "CRC") return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">CRC</Badge>;
    if (model === "CMOS") return <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">CMOS</Badge>;
    return <Badge variant="secondary">{model}</Badge>;
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold" data-testid="text-page-title">
              Component Library
            </h1>
            <p className="text-muted-foreground mt-1">
              Manage dynamic text blocks for contract generation
            </p>
          </div>
          <Button onClick={handleOpenCreate} data-testid="button-add-component">
            <Plus className="h-4 w-4 mr-2" />
            Add Component
          </Button>
        </div>

        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-40 w-full" />
            ))}
          </div>
        ) : components?.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No components found. Click "Add Component" to create one.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {components?.map((component) => (
              <Card key={component.id} data-testid={`card-component-${component.id}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <CardTitle className="text-base font-mono flex items-center gap-2">
                        {component.tag_name}
                        {component.is_system && (
                          <Lock className="h-3 w-3 text-muted-foreground" />
                        )}
                      </CardTitle>
                      <CardDescription className="text-sm">
                        {component.description || "No description"}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      {getServiceModelBadge(component.service_model)}
                      <div className="flex gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleOpenEdit(component)}
                          data-testid={`button-edit-${component.id}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {!component.is_system && (
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setDeleteComponent(component)}
                            data-testid={`button-delete-${component.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-xs font-mono bg-muted p-3 rounded-md max-h-24 overflow-y-auto whitespace-pre-wrap">
                    {component.content.substring(0, 300)}
                    {component.content.length > 300 && "..."}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingComponent ? "Edit Component" : "Add Component"}
              </DialogTitle>
              <DialogDescription>
                {editingComponent
                  ? "Update the component details below."
                  : "Enter the details for the new text block component."}
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="tagName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tag Name</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            placeholder="BLOCK_ON_SITE_SCOPE" 
                            className="font-mono"
                            disabled={editingComponent?.is_system}
                            data-testid="input-tag-name" 
                          />
                        </FormControl>
                        <FormDescription>
                          Unique identifier for this component
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="serviceModel"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Service Model</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-service-model">
                              <SelectValue placeholder="Select service model" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="all">All (Default)</SelectItem>
                            <SelectItem value="CRC">CRC Only</SelectItem>
                            <SelectItem value="CMOS">CMOS Only</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Which service model this applies to
                        </FormDescription>
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
                        <Input {...field} placeholder="Brief description of this component" data-testid="input-description" />
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
                      <FormLabel>Content (HTML)</FormLabel>
                      <FormControl>
                        <Textarea 
                          {...field} 
                          className="font-mono text-sm min-h-[200px]"
                          placeholder="<p>Enter your HTML content here...</p>"
                          data-testid="input-content" 
                        />
                      </FormControl>
                      <FormDescription>
                        HTML content that will be injected into contracts
                      </FormDescription>
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
                      : editingComponent
                      ? "Update"
                      : "Create"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        <AlertDialog open={!!deleteComponent} onOpenChange={() => setDeleteComponent(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Component</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete "{deleteComponent?.tag_name}"? This action cannot
                be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteComponent && deleteMutation.mutate(deleteComponent.id)}
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

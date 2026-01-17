import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Plus, Building2, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { insertLLCSchema, type LLC } from "@shared/schema";

const llcFormSchema = insertLLCSchema.extend({
  name: z.string().min(1, "LLC name is required"),
  projectName: z.string().min(1, "Project name is required"),
});

type LLCFormValues = z.infer<typeof llcFormSchema>;

export default function LLCAdmin() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const { toast } = useToast();

  const form = useForm<LLCFormValues>({
    resolver: zodResolver(llcFormSchema),
    defaultValues: {
      name: "",
      projectName: "",
      status: "pending",
      stateOfFormation: "Delaware",
      einNumber: null,
      registeredAgent: null,
      formationDate: null,
    },
  });

  const { data: llcs = [], isLoading } = useQuery<LLC[]>({
    queryKey: ["/api/llcs"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: LLCFormValues) => {
      const response = await apiRequest("POST", "/api/llcs", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/llcs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      setIsCreateOpen(false);
      form.reset();
      toast({
        title: "LLC Created",
        description: "The new LLC has been created successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create LLC. Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/llcs/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/llcs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({
        title: "LLC Deleted",
        description: "The LLC has been deleted successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete LLC. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: LLCFormValues) => {
    createMutation.mutate(data);
  };

  return (
    <div className="flex-1 p-6 md:p-8">
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground" data-testid="text-page-title">
            LLC Administration
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage child entities for construction projects
          </p>
        </div>
        
        <Dialog open={isCreateOpen} onOpenChange={(open) => {
          setIsCreateOpen(open);
          if (!open) form.reset();
        }}>
          <DialogTrigger asChild>
            <Button data-testid="button-new-llc">
              <Plus className="h-4 w-4 mr-2" />
              New LLC
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Create New LLC</DialogTitle>
              <DialogDescription>
                Create a new child LLC entity for a construction project.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>LLC Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Dvele Partners [Project] LLC"
                          data-testid="input-llc-name"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="projectName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Project Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Willow Creek Residence"
                          data-testid="input-project-name"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value || "pending"}>
                        <FormControl>
                          <SelectTrigger data-testid="select-status">
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="in_formation">In Formation</SelectItem>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="dissolved">Dissolved</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="stateOfFormation"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>State of Formation</FormLabel>
                      <FormControl>
                        <Input
                          data-testid="input-state"
                          {...field}
                          value={field.value || "Delaware"}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button 
                    type="submit" 
                    disabled={createMutation.isPending}
                    data-testid="button-submit-llc"
                  >
                    {createMutation.isPending ? "Creating..." : "Create LLC"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Card data-testid="card-llc-list">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">All LLCs</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-8 w-8 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                  <Skeleton className="h-5 w-20 rounded-full" />
                </div>
              ))}
            </div>
          ) : llcs.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-xs font-medium uppercase tracking-wide text-muted-foreground py-3 px-4 text-left">
                      LLC Name
                    </th>
                    <th className="text-xs font-medium uppercase tracking-wide text-muted-foreground py-3 px-4 text-left">
                      Project
                    </th>
                    <th className="text-xs font-medium uppercase tracking-wide text-muted-foreground py-3 px-4 text-left">
                      Status
                    </th>
                    <th className="text-xs font-medium uppercase tracking-wide text-muted-foreground py-3 px-4 text-left">
                      State
                    </th>
                    <th className="text-xs font-medium uppercase tracking-wide text-muted-foreground py-3 px-4 text-left">
                      Formation Date
                    </th>
                    <th className="text-xs font-medium uppercase tracking-wide text-muted-foreground py-3 px-4 text-right">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {llcs.map((llc) => (
                    <tr 
                      key={llc.id} 
                      className="border-b last:border-b-0 hover-elevate"
                      data-testid={`row-llc-${llc.id}`}
                    >
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                            <Building2 className="h-4 w-4 text-primary" />
                          </div>
                          <span className="text-sm font-medium">{llc.name}</span>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <span className="text-sm text-muted-foreground">{llc.projectName}</span>
                      </td>
                      <td className="py-4 px-4">
                        <LLCStatusBadge status={llc.status} />
                      </td>
                      <td className="py-4 px-4">
                        <span className="text-sm">{llc.stateOfFormation}</span>
                      </td>
                      <td className="py-4 px-4">
                        <span className="text-sm text-muted-foreground">
                          {llc.formationDate 
                            ? new Date(llc.formationDate).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric'
                              })
                            : "—"
                          }
                        </span>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => deleteMutation.mutate(llc.id)}
                          disabled={deleteMutation.isPending}
                          data-testid={`button-delete-${llc.id}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-12 text-center text-muted-foreground">
              <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-sm font-medium">No LLCs yet</p>
              <p className="text-xs mt-1">Create your first LLC to get started</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function LLCStatusBadge({ status }: { status: string }) {
  const statusConfig: Record<string, { label: string; className: string }> = {
    pending: { 
      label: "Pending", 
      className: "bg-muted text-muted-foreground" 
    },
    in_formation: { 
      label: "In Formation", 
      className: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400" 
    },
    active: { 
      label: "Active", 
      className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400" 
    },
    dissolved: { 
      label: "Dissolved", 
      className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" 
    },
  };

  const config = statusConfig[status] || statusConfig.pending;

  return (
    <span 
      className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${config.className}`}
      data-testid={`badge-status-${status}`}
    >
      {config.label}
    </span>
  );
}

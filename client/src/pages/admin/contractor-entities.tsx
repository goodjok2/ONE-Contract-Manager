import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AdminLayout } from "@/components/admin-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

const CONTRACTOR_TYPES = [
  { value: "manufacturer", label: "Manufacturer" },
  { value: "onsite", label: "Onsite Contractor" },
  { value: "subcontractor", label: "Subcontractor" },
];

const US_STATES = [
  "AZ", "CA", "CO", "FL", "GA", "ID", "IL", "MA", "MI", "NV", "NY", "OR", "PA", "TX", "UT", "WA"
];

interface ContractorEntity {
  id: number;
  legal_name: string;
  contractor_type: string;
  entity_type?: string;
  state: string;
  license_number?: string;
  is_active: boolean;
}

const contractorEntitySchema = z.object({
  legalName: z.string().min(1, "Legal name is required"),
  contractorType: z.string().min(1, "Contractor type is required"),
  entityType: z.string().optional(),
  state: z.string().min(1, "State is required"),
  licenseNumber: z.string().optional(),
  contactName: z.string().optional(),
  contactEmail: z.string().email().optional().or(z.literal("")),
  contactPhone: z.string().optional(),
});

type ContractorEntityFormValues = z.infer<typeof contractorEntitySchema>;

export default function AdminContractorEntities() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEntity, setEditingEntity] = useState<ContractorEntity | null>(null);
  const [deleteEntity, setDeleteEntity] = useState<ContractorEntity | null>(null);
  const { toast } = useToast();

  const { data: entities, isLoading } = useQuery<ContractorEntity[]>({
    queryKey: ["/api/contractor-entities"],
  });

  const form = useForm<ContractorEntityFormValues>({
    resolver: zodResolver(contractorEntitySchema),
    defaultValues: {
      legalName: "",
      contractorType: "",
      entityType: "LLC",
      state: "",
      licenseNumber: "",
      contactName: "",
      contactEmail: "",
      contactPhone: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: ContractorEntityFormValues) => {
      return apiRequest("POST", "/api/contractor-entities", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contractor-entities"] });
      setIsDialogOpen(false);
      form.reset();
      toast({ title: "Contractor entity created successfully" });
    },
    onError: () => {
      toast({ title: "Failed to create contractor entity", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: ContractorEntityFormValues }) => {
      return apiRequest("PATCH", `/api/contractor-entities/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contractor-entities"] });
      setIsDialogOpen(false);
      setEditingEntity(null);
      form.reset();
      toast({ title: "Contractor entity updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update contractor entity", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/contractor-entities/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contractor-entities"] });
      setDeleteEntity(null);
      toast({ title: "Contractor entity deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete contractor entity", variant: "destructive" });
    },
  });

  const handleOpenCreate = () => {
    setEditingEntity(null);
    form.reset();
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (entity: ContractorEntity) => {
    setEditingEntity(entity);
    form.reset({
      legalName: entity.legal_name,
      contractorType: entity.contractor_type,
      entityType: entity.entity_type || "LLC",
      state: entity.state,
      licenseNumber: entity.license_number || "",
    });
    setIsDialogOpen(true);
  };

  const onSubmit = (data: ContractorEntityFormValues) => {
    if (editingEntity) {
      updateMutation.mutate({ id: editingEntity.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const getContractorTypeLabel = (value: string) => {
    return CONTRACTOR_TYPES.find((t) => t.value === value)?.label || value;
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold" data-testid="text-page-title">
              Contractor Entities
            </h1>
            <p className="text-muted-foreground mt-1">
              Manage contractor and manufacturer entities
            </p>
          </div>
          <Button onClick={handleOpenCreate} data-testid="button-add-entity">
            <Plus className="h-4 w-4 mr-2" />
            Add Contractor
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
                  <TableHead>Legal Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>License</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entities?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      No contractor entities found. Click "Add Contractor" to create one.
                    </TableCell>
                  </TableRow>
                ) : (
                  entities?.map((entity) => (
                    <TableRow key={entity.id} data-testid={`row-entity-${entity.id}`}>
                      <TableCell className="font-medium">{entity.legal_name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {getContractorTypeLabel(entity.contractor_type)}
                        </Badge>
                      </TableCell>
                      <TableCell>{entity.state}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {entity.license_number || "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleOpenEdit(entity)}
                            data-testid={`button-edit-${entity.id}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setDeleteEntity(entity)}
                            data-testid={`button-delete-${entity.id}`}
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
                {editingEntity ? "Edit Contractor Entity" : "Add Contractor Entity"}
              </DialogTitle>
              <DialogDescription>
                {editingEntity
                  ? "Update the contractor entity details below."
                  : "Enter the details for the new contractor entity."}
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="legalName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Legal Name</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-legal-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="contractorType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Contractor Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-contractor-type">
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {CONTRACTOR_TYPES.map((type) => (
                              <SelectItem key={type.value} value={type.value}>
                                {type.label}
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
                </div>

                <FormField
                  control={form.control}
                  name="licenseNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>License Number (optional)</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-license" />
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
                      : editingEntity
                      ? "Update"
                      : "Create"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        <AlertDialog open={!!deleteEntity} onOpenChange={() => setDeleteEntity(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Contractor Entity</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete "{deleteEntity?.legal_name}"? This action cannot
                be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteEntity && deleteMutation.mutate(deleteEntity.id)}
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

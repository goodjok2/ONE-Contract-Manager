import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Download, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface Project {
  id: number;
  projectNumber: string;
  name: string;
  status: string;
  state: string | null;
  createdAt: string | null;
  client: {
    id: number;
    legalName: string;
    email: string | null;
  } | null;
  childLlc: {
    id: number;
    legalName: string;
  } | null;
  financials: {
    id: number;
    designFee: number | null;
    prelimOffsite: number | null;
    prelimOnsite: number | null;
    finalOffsite: number | null;
    refinedOnsite: number | null;
    isLocked: boolean | null;
  } | null;
}

export default function Dashboard() {
  const { toast } = useToast();
  const [greenLightModal, setGreenLightModal] = useState<{
    open: boolean;
    project: Project | null;
  }>({ open: false, project: null });
  const [finalOffsite, setFinalOffsite] = useState<number>(0);
  const [refinedOnsite, setRefinedOnsite] = useState<number>(0);

  const { data: projects = [], isLoading } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const greenLightMutation = useMutation({
    mutationFn: async ({
      projectId,
      finalOffsite,
      refinedOnsite,
    }: {
      projectId: number;
      finalOffsite: number;
      refinedOnsite: number;
    }) => {
      const response = await apiRequest(
        "PATCH",
        `/api/projects/${projectId}/green-light`,
        { finalOffsite, refinedOnsite }
      );
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({
        title: "Green Light Approved",
        description: "The project financials have been locked.",
      });
      setGreenLightModal({ open: false, project: null });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to approve green light. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleDownloadContract = async (project: Project) => {
    try {
      const response = await fetch(`/api/projects/${project.id}/contract`, {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Failed to download contract");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${project.projectNumber}-contract.docx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Contract Downloaded",
        description: "The contract has been downloaded successfully.",
      });
    } catch {
      toast({
        title: "Error",
        description: "Failed to download contract. Please try again.",
        variant: "destructive",
      });
    }
  };

  const openGreenLightModal = (project: Project) => {
    setFinalOffsite(project.financials?.finalOffsite ?? project.financials?.prelimOffsite ?? 0);
    setRefinedOnsite(project.financials?.refinedOnsite ?? project.financials?.prelimOnsite ?? 0);
    setGreenLightModal({ open: true, project });
  };

  const handleApprove = () => {
    if (greenLightModal.project) {
      greenLightMutation.mutate({
        projectId: greenLightModal.project.id,
        finalOffsite,
        refinedOnsite,
      });
    }
  };

  const formatCurrency = (value: number | null | undefined) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value ?? 0);
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      Draft: { variant: "secondary", label: "Draft" },
      "In Progress": { variant: "default", label: "In Progress" },
      "Green Lit": { variant: "default", label: "Green Lit" },
      Completed: { variant: "outline", label: "Completed" },
    };
    const config = statusConfig[status] || { variant: "secondary" as const, label: status };
    return (
      <Badge variant={config.variant} data-testid={`badge-status-${status.toLowerCase().replace(/\s+/g, "-")}`}>
        {config.label}
      </Badge>
    );
  };

  return (
    <div className="flex-1 p-6 md:p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-foreground" data-testid="text-page-title">
          Dashboard
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your projects and contracts
        </p>
      </div>

      <Card data-testid="card-projects-table">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Projects</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : projects.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <p className="text-sm">No projects yet</p>
              <p className="text-xs mt-1">Create your first agreement to get started</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Project #</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>LLC Name</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.map((project) => (
                  <TableRow key={project.id} data-testid={`row-project-${project.id}`}>
                    <TableCell
                      className="font-medium"
                      data-testid={`text-project-number-${project.id}`}
                    >
                      {project.projectNumber}
                    </TableCell>
                    <TableCell data-testid={`text-project-name-${project.id}`}>
                      {project.name}
                    </TableCell>
                    <TableCell>{getStatusBadge(project.status)}</TableCell>
                    <TableCell data-testid={`text-llc-name-${project.id}`}>
                      {project.childLlc?.legalName ?? "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2 flex-wrap">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDownloadContract(project)}
                          data-testid={`button-download-contract-${project.id}`}
                        >
                          <Download className="h-4 w-4 mr-1" />
                          Download
                        </Button>
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => openGreenLightModal(project)}
                          disabled={project.financials?.isLocked === true}
                          data-testid={`button-green-light-${project.id}`}
                        >
                          <Zap className="h-4 w-4 mr-1" />
                          Green Light
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={greenLightModal.open}
        onOpenChange={(open) => {
          if (!open) {
            setGreenLightModal({ open: false, project: null });
          }
        }}
      >
        <DialogContent data-testid="modal-green-light">
          <DialogHeader>
            <DialogTitle>Green Light Approval</DialogTitle>
            <DialogDescription>
              Review and finalize the project financials for{" "}
              {greenLightModal.project?.name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="prelimOffsite">Preliminary Offsite Price</Label>
              <Input
                id="prelimOffsite"
                type="text"
                value={formatCurrency(greenLightModal.project?.financials?.prelimOffsite)}
                disabled
                data-testid="input-prelim-offsite-readonly"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="finalOffsite">Final Offsite Price</Label>
              <Input
                id="finalOffsite"
                type="number"
                value={finalOffsite}
                onChange={(e) => setFinalOffsite(Number(e.target.value))}
                disabled={greenLightModal.project?.financials?.isLocked === true}
                data-testid="input-final-offsite"
              />
              {greenLightModal.project?.financials?.isLocked && (
                <p className="text-xs text-muted-foreground">Locked</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="refinedOnsite">Refined Onsite Price</Label>
              <Input
                id="refinedOnsite"
                type="number"
                value={refinedOnsite}
                onChange={(e) => setRefinedOnsite(Number(e.target.value))}
                data-testid="input-refined-onsite"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setGreenLightModal({ open: false, project: null })}
              data-testid="button-modal-cancel"
            >
              Cancel
            </Button>
            <Button
              onClick={handleApprove}
              disabled={greenLightMutation.isPending}
              data-testid="button-modal-approve"
            >
              {greenLightMutation.isPending ? "Approving..." : "Approve"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

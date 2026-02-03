import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { format } from "date-fns";
import { Loader2, Pencil, Eye } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Contract {
  id: number;
  projectId: number;
  contractType: string;
  version: number;
  status: string;
  generatedAt: string;
  generatedBy: string | null;
  templateVersion: string | null;
  fileName: string | null;
  notes: string | null;
  projectName: string;
  projectNumber: string;
}

function getStatusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  switch (status?.toLowerCase()) {
    case "approved":
    case "signed":
      return "default";
    case "pending_review":
      return "secondary";
    case "expired":
      return "destructive";
    default:
      return "outline";
  }
}

function formatStatus(status: string): string {
  if (!status) return "Draft";
  return status
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

export default function ContractsPage() {
  const { data: contracts, isLoading } = useQuery<Contract[]>({
    queryKey: ["/api/contracts"],
    select: (data: any) => {
      if (Array.isArray(data)) {
        return data.filter((item: any) => item.id && !item.packageId);
      }
      return [];
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold" data-testid="text-page-title">
          Active Contracts
        </h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Contracts</CardTitle>
        </CardHeader>
        <CardContent>
          {!contracts || contracts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No contracts found. Create a new contract to get started.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Project Name</TableHead>
                  <TableHead>Contract Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contracts.map((contract) => (
                  <TableRow key={contract.id} data-testid={`row-contract-${contract.id}`}>
                    <TableCell className="font-medium">
                      {contract.projectName || `Project ${contract.projectId}`}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{contract.contractType}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusVariant(contract.status)}>
                        {formatStatus(contract.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {contract.generatedAt
                        ? format(new Date(contract.generatedAt), "MMM d, yyyy")
                        : "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link href={`/contracts/${contract.id}/edit`}>
                          <Button
                            size="sm"
                            variant="default"
                            data-testid={`button-edit-${contract.id}`}
                          >
                            <Pencil className="h-4 w-4 mr-1" />
                            Edit
                          </Button>
                        </Link>
                        <Link href={`/contracts/${contract.id}`}>
                          <Button
                            size="sm"
                            variant="outline"
                            data-testid={`button-preview-${contract.id}`}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            Preview
                          </Button>
                        </Link>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

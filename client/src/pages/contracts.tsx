import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FileCheck, Plus } from "lucide-react";
import { Link } from "wouter";
import type { Contract } from "@shared/schema";

export default function Contracts() {
  const { data: contracts = [], isLoading } = useQuery<Contract[]>({
    queryKey: ["/api/contracts"],
  });

  const formatCurrency = (value: string | null) => {
    if (!value) return "$0";
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(parseFloat(value));
  };

  return (
    <div className="flex-1 p-6 md:p-8">
      <div className="flex items-center justify-between gap-4 flex-wrap mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-foreground" data-testid="text-page-title">
            Active Contracts
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            View and manage all your contracts
          </p>
        </div>
        <Link href="/agreements/new">
          <Button data-testid="button-new-contract">
            <Plus className="h-4 w-4 mr-2" />
            New Contract
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">All Contracts</CardTitle>
          <CardDescription>Complete list of contracts in your system</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center justify-between py-4 border-b last:border-b-0">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                  <Skeleton className="h-6 w-20" />
                </div>
              ))}
            </div>
          ) : contracts.length > 0 ? (
            <div className="space-y-2">
              {contracts.map((contract, index) => (
                <div 
                  key={contract.id} 
                  className="flex items-center justify-between gap-4 py-4 px-3 rounded-lg hover-elevate"
                  data-testid={`row-contract-${index}`}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{contract.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {contract.clientName} • {formatCurrency(contract.contractValue)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <StatusBadge status={contract.status} />
                    <Button variant="outline" size="sm" data-testid={`button-view-contract-${index}`}>
                      View
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center text-muted-foreground">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mx-auto mb-4">
                <FileCheck className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium">No contracts yet</p>
              <p className="text-xs mt-1">Create your first contract to get started</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    draft: { label: "Draft", variant: "secondary" },
    pending_review: { label: "Pending Review", variant: "outline" },
    approved: { label: "Approved", variant: "default" },
    signed: { label: "Signed", variant: "default" },
    expired: { label: "Expired", variant: "destructive" },
  };

  const config = statusConfig[status] || statusConfig.draft;

  return (
    <Badge variant={config.variant}>
      {config.label}
    </Badge>
  );
}

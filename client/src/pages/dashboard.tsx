import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { FileText, Clock, CheckCircle, Plus, Users, Building2, DollarSign } from "lucide-react";
import type { DashboardStats, Contract, LLC } from "@shared/schema";

interface StatCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon: React.ComponentType<{ className?: string }>;
  testId: string;
  isLoading?: boolean;
}

function StatCard({ title, value, description, icon: Icon, testId, isLoading }: StatCardProps) {
  return (
    <Card data-testid={testId}>
      <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="h-4 w-4 text-primary" />
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-8 w-24" />
        ) : (
          <div className="text-2xl font-bold" data-testid={`${testId}-value`}>
            {value}
          </div>
        )}
        {description && (
          <p className="text-xs text-muted-foreground mt-1">
            {description}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

const TEMPLATES = [
  {
    id: "dtc",
    name: "DTC Standard Agreement",
    description: "Standard contract for Direct-to-Consumer individual home buyers....",
    icon: Users,
  },
  {
    id: "b2b",
    name: "B2B Developer Agreement", 
    description: "Standard contract for Business-to-Business developers and landowners....",
    icon: Building2,
  },
];

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats"],
  });

  const { data: contracts = [], isLoading: contractsLoading } = useQuery<Contract[]>({
    queryKey: ["/api/contracts"],
  });

  const { data: llcs = [], isLoading: llcsLoading } = useQuery<LLC[]>({
    queryKey: ["/api/llcs"],
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const recentContracts = contracts.slice(-3).reverse();
  const recentLLCs = llcs.slice(-3).reverse();

  return (
    <div className="flex-1 p-6 md:p-8">
      <div className="flex items-center justify-between gap-4 flex-wrap mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-foreground" data-testid="text-page-title">
            Dashboard
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Overview of your contracts and LLC entities
          </p>
        </div>
        <Link href="/agreements/new">
          <Button data-testid="button-new-contract">
            <Plus className="h-4 w-4 mr-2" />
            New Contract
          </Button>
        </Link>
      </div>

      {/* Original Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <StatCard
          title="Active Projects"
          value={stats?.activeProjects ?? 0}
          description="Projects currently in progress"
          icon={Building2}
          testId="card-active-projects"
          isLoading={statsLoading}
        />
        <StatCard
          title="Pending LLCs"
          value={stats?.pendingLLCs ?? 0}
          description="Awaiting formation"
          icon={Clock}
          testId="card-pending-llcs"
          isLoading={statsLoading}
        />
        <StatCard
          title="Total Contract Value"
          value={formatCurrency(stats?.totalContractValue ?? 0)}
          description="Across all active contracts"
          icon={DollarSign}
          testId="card-total-value"
          isLoading={statsLoading}
        />
      </div>

      {/* Contract Status Stats Row (New) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          title="Total Contracts"
          value={stats?.totalContracts ?? 0}
          description="All time"
          icon={FileText}
          testId="card-total-contracts"
          isLoading={statsLoading}
        />
        <StatCard
          title="Drafts"
          value={stats?.drafts ?? 0}
          description="In progress"
          icon={FileText}
          testId="card-drafts"
          isLoading={statsLoading}
        />
        <StatCard
          title="Pending Review"
          value={stats?.pendingReview ?? 0}
          description="Awaiting approval"
          icon={Clock}
          testId="card-pending-review"
          isLoading={statsLoading}
        />
        <StatCard
          title="Signed"
          value={stats?.signed ?? 0}
          description="Completed"
          icon={CheckCircle}
          testId="card-signed"
          isLoading={statsLoading}
        />
      </div>

      {/* Recent Activity Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <Card data-testid="card-recent-contracts">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Recent Contracts</CardTitle>
            <CardDescription>Your most recently updated contracts</CardDescription>
          </CardHeader>
          <CardContent>
            {contractsLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center justify-between py-3 border-b last:border-b-0">
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                    <Skeleton className="h-5 w-20 rounded-full" />
                  </div>
                ))}
              </div>
            ) : recentContracts.length > 0 ? (
              <div className="space-y-2">
                {recentContracts.map((contract, index) => (
                  <div 
                    key={contract.id} 
                    className="flex items-center justify-between gap-4 py-3 px-3 rounded-lg hover-elevate"
                    data-testid={`row-contract-${index}`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted shrink-0">
                        <Users className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{contract.title}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {contract.id.slice(0, 16)} • {contract.clientName}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <StatusBadge status={contract.status} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-muted-foreground">
                <p className="text-sm">No contracts yet</p>
                <p className="text-xs mt-1">Create your first agreement to get started</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-recent-llcs">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Recent LLCs</CardTitle>
            <CardDescription>Recently created child entities</CardDescription>
          </CardHeader>
          <CardContent>
            {llcsLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center justify-between py-3 border-b last:border-b-0">
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                    <Skeleton className="h-5 w-20 rounded-full" />
                  </div>
                ))}
              </div>
            ) : recentLLCs.length > 0 ? (
              <div className="space-y-2">
                {recentLLCs.map((llc, index) => (
                  <div 
                    key={llc.id} 
                    className="flex items-center justify-between gap-4 py-3 px-3 rounded-lg hover-elevate"
                    data-testid={`row-llc-${index}`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted shrink-0">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{llc.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {llc.projectName}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <LLCStatusBadge status={llc.status} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-muted-foreground">
                <p className="text-sm">No LLCs yet</p>
                <p className="text-xs mt-1">Create an LLC in the admin section</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Start Templates (New) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <Card data-testid="card-quick-templates">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Quick Start Templates</CardTitle>
            <CardDescription>Start a new contract from a template</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {TEMPLATES.map((template) => (
                <div 
                  key={template.id}
                  className="flex items-center justify-between gap-4 py-3 px-3 rounded-lg hover-elevate"
                  data-testid={`template-${template.id}`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted shrink-0">
                      <template.icon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{template.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {template.description}
                      </p>
                    </div>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    data-testid={`button-use-template-${template.id}`}
                  >
                    Use Template
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Contract Value Overview (New) */}
        <Card data-testid="card-value-overview">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Contract Value Overview</CardTitle>
            <CardDescription>Summary of contract values by status</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-lg bg-muted/50 text-center" data-testid="value-drafts">
                <p className="text-sm text-muted-foreground mb-1">Drafts Value</p>
                {statsLoading ? (
                  <Skeleton className="h-8 w-20 mx-auto" />
                ) : (
                  <p className="text-2xl font-bold">{formatCurrency(stats?.draftsValue ?? 0)}</p>
                )}
              </div>
              <div className="p-4 rounded-lg bg-muted/50 text-center" data-testid="value-pending">
                <p className="text-sm text-muted-foreground mb-1">Pending Value</p>
                {statsLoading ? (
                  <Skeleton className="h-8 w-20 mx-auto" />
                ) : (
                  <p className="text-2xl font-bold">{formatCurrency(stats?.pendingValue ?? 0)}</p>
                )}
              </div>
              <div className="p-4 rounded-lg bg-muted/50 text-center" data-testid="value-signed">
                <p className="text-sm text-muted-foreground mb-1">Signed Value</p>
                {statsLoading ? (
                  <Skeleton className="h-8 w-20 mx-auto" />
                ) : (
                  <p className="text-2xl font-bold">{formatCurrency(stats?.signedValue ?? 0)}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    draft: { 
      label: "Draft", 
      variant: "secondary"
    },
    pending_review: { 
      label: "Pending Review", 
      variant: "outline"
    },
    approved: { 
      label: "Approved", 
      variant: "default"
    },
    signed: { 
      label: "Signed", 
      variant: "default"
    },
    expired: { 
      label: "Expired", 
      variant: "destructive"
    },
  };

  const config = statusConfig[status] || statusConfig.draft;

  return (
    <Badge variant={config.variant} data-testid={`badge-status-${status}`}>
      {config.label}
    </Badge>
  );
}

function LLCStatusBadge({ status }: { status: string }) {
  const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    pending: { 
      label: "Pending", 
      variant: "outline"
    },
    formed: { 
      label: "Formed", 
      variant: "default"
    },
    dissolved: { 
      label: "Dissolved", 
      variant: "destructive"
    },
  };

  const config = statusConfig[status] || statusConfig.pending;

  return (
    <Badge variant={config.variant} data-testid={`badge-llc-status-${status}`}>
      {config.label}
    </Badge>
  );
}

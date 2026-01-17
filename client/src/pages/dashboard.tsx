import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Building2, Clock, DollarSign } from "lucide-react";
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
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-foreground" data-testid="text-page-title">
          Dashboard
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Overview of your contracts and LLC entities
        </p>
      </div>

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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card data-testid="card-recent-contracts">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Recent Contracts</CardTitle>
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
              <div className="space-y-4">
                {recentContracts.map((contract, index) => (
                  <div 
                    key={contract.id} 
                    className="flex items-center justify-between py-3 border-b last:border-b-0"
                    data-testid={`row-contract-${index}`}
                  >
                    <div>
                      <p className="text-sm font-medium">{contract.title}</p>
                      <p className="text-xs text-muted-foreground">{contract.clientName}</p>
                    </div>
                    <StatusBadge status={contract.status} />
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
          </CardHeader>
          <CardContent>
            {llcsLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center justify-between py-3 border-b last:border-b-0">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-5 w-20 rounded-full" />
                  </div>
                ))}
              </div>
            ) : recentLLCs.length > 0 ? (
              <div className="space-y-4">
                {recentLLCs.map((llc, index) => (
                  <div 
                    key={llc.id} 
                    className="flex items-center justify-between py-3 border-b last:border-b-0"
                    data-testid={`row-llc-${index}`}
                  >
                    <p className="text-sm font-medium">{llc.name}</p>
                    <LLCStatusBadge status={llc.status} />
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-muted-foreground">
                <p className="text-sm">No LLCs yet</p>
                <p className="text-xs mt-1">Create your first LLC to get started</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const statusConfig: Record<string, { label: string; className: string }> = {
    draft: { 
      label: "Draft", 
      className: "bg-muted text-muted-foreground" 
    },
    pending_review: { 
      label: "Pending Review", 
      className: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400" 
    },
    approved: { 
      label: "Approved", 
      className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" 
    },
    signed: { 
      label: "Signed", 
      className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400" 
    },
    expired: { 
      label: "Expired", 
      className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" 
    },
  };

  const config = statusConfig[status] || statusConfig.draft;

  return (
    <span 
      className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${config.className}`}
      data-testid={`badge-status-${status}`}
    >
      {config.label}
    </span>
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
      data-testid={`badge-llc-status-${status}`}
    >
      {config.label}
    </span>
  );
}

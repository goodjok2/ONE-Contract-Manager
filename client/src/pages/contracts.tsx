import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { FileCheck, Plus, ChevronDown, ChevronRight, FileText, Package, Pencil } from "lucide-react";
import { Link } from "wouter";

interface ContractInfo {
  id: number;
  contractType: string;
  fileName: string;
  status: string;
  generatedAt: string;
}

interface ContractPackage {
  packageId: number;
  projectId: number;
  projectName: string;
  projectNumber: string;
  status: string;
  contractValue: number;
  generatedAt: string;
  contracts: ContractInfo[];
  title: string;
  clientName: string;
  contractCount: number;
  isDraft?: boolean;
}

export default function Contracts() {
  const { data: packages = [], isLoading } = useQuery<ContractPackage[]>({
    queryKey: ["/api/contracts"],
  });
  
  const [expandedPackages, setExpandedPackages] = useState<Set<number>>(new Set());

  const togglePackage = (packageId: number) => {
    setExpandedPackages(prev => {
      const newSet = new Set(prev);
      if (newSet.has(packageId)) {
        newSet.delete(packageId);
      } else {
        newSet.add(packageId);
      }
      return newSet;
    });
  };

  const formatCurrency = (value: number | null) => {
    if (!value) return "$0";
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };
  
  const formatContractType = (type: string) => {
    const typeMap: Record<string, string> = {
      'one_agreement': 'ONE Agreement',
      'manufacturing_sub': 'Manufacturing Subcontract',
      'onsite_sub': 'OnSite Subcontract',
    };
    return typeMap[type] || type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  };

  return (
    <div className="flex-1 p-6 md:p-8">
      <div className="flex items-center justify-between gap-4 flex-wrap mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-foreground" data-testid="text-page-title">
            Active Contracts
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            View and manage all your contract packages
          </p>
        </div>
        <Link href="/generate-contracts">
          <Button data-testid="button-new-contract">
            <Plus className="h-4 w-4 mr-2" />
            New Contract Package
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Contract Packages</CardTitle>
          <CardDescription>Each package contains ONE Agreement, Manufacturing Subcontract, and OnSite Subcontract</CardDescription>
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
          ) : packages.length > 0 ? (
            <div className="space-y-2">
              {packages.map((pkg, index) => (
                pkg.isDraft ? (
                  <div 
                    key={pkg.packageId}
                    className="rounded-lg border bg-card"
                    data-testid={`row-package-${index}`}
                  >
                    <div className="flex items-center justify-between gap-4 py-4 px-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-amber-500/10">
                          <Pencil className="h-5 w-5 text-amber-600" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium">{pkg.projectName}</p>
                            <Badge variant="secondary" className="text-xs">
                              Draft
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {pkg.projectNumber} • Not yet generated
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <Link href={`/generate-contracts?projectId=${pkg.projectId}`}>
                          <Button variant="outline" size="sm" data-testid={`button-resume-draft-${pkg.projectId}`}>
                            <Pencil className="h-3 w-3 mr-2" />
                            Resume Draft
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </div>
                ) : (
                  <Collapsible 
                    key={pkg.packageId}
                    open={expandedPackages.has(pkg.packageId)}
                    onOpenChange={() => togglePackage(pkg.packageId)}
                  >
                    <div 
                      className="rounded-lg border bg-card"
                      data-testid={`row-package-${index}`}
                    >
                      <CollapsibleTrigger asChild>
                        <div className="flex items-center justify-between gap-4 py-4 px-4 cursor-pointer hover-elevate rounded-lg">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
                              <Package className="h-5 w-5 text-primary" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-medium">{pkg.projectName}</p>
                                <Badge variant="outline" className="text-xs">
                                  {pkg.contractCount} contracts
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {pkg.projectNumber} • {formatCurrency(pkg.contractValue)}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <StatusBadge status={pkg.status} />
                            {expandedPackages.has(pkg.packageId) ? (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                        </div>
                      </CollapsibleTrigger>
                      
                      <CollapsibleContent>
                        <div className="border-t px-4 py-3 bg-muted/30">
                          <p className="text-xs font-medium text-muted-foreground mb-3">Contracts in this package:</p>
                          <div className="space-y-2">
                            {pkg.contracts.map((contract) => (
                              <div 
                                key={contract.id}
                                className="flex items-center justify-between gap-4 py-2 px-3 rounded-md bg-background"
                                data-testid={`row-contract-${contract.id}`}
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                                  <div className="min-w-0">
                                    <p className="text-sm font-medium">{formatContractType(contract.contractType)}</p>
                                    <p className="text-xs text-muted-foreground truncate">{contract.fileName}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <StatusBadge status={contract.status} size="sm" />
                                  <Link href={`/contracts/${contract.id}`}>
                                    <Button variant="outline" size="sm" data-testid={`button-view-contract-${contract.id}`}>
                                      View
                                    </Button>
                                  </Link>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                )
              ))}
            </div>
          ) : (
            <div className="py-12 text-center text-muted-foreground">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mx-auto mb-4">
                <FileCheck className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium">No contract packages yet</p>
              <p className="text-xs mt-1">Create your first contract package to get started</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatusBadge({ status, size = "default" }: { status: string; size?: "default" | "sm" }) {
  const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    draft: { label: "Draft", variant: "secondary" },
    pending_review: { label: "Pending Review", variant: "outline" },
    approved: { label: "Approved", variant: "default" },
    signed: { label: "Signed", variant: "default" },
    expired: { label: "Expired", variant: "destructive" },
  };

  const config = statusConfig[status] || { label: status, variant: "secondary" as const };
  
  return (
    <Badge 
      variant={config.variant} 
      className={size === "sm" ? "text-xs px-2 py-0" : ""}
      data-testid={`badge-status-${status}`}
    >
      {config.label}
    </Badge>
  );
}

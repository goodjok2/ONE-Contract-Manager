import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { FileCheck, Plus, ChevronDown, ChevronRight, FileText, Package, Pencil, Download, Code, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
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
  const { toast } = useToast();
  
  const [expandedPackages, setExpandedPackages] = useState<Set<number>>(new Set());
  const [generatingContract, setGeneratingContract] = useState<number | null>(null);

  const getContractTypeForApi = (type: string): string => {
    const typeMap: Record<string, string> = {
      'one_agreement': 'ONE',
      'manufacturing_sub': 'MANUFACTURING',
      'onsite_sub': 'ONSITE',
      'master_ef': 'MASTER_EF',
      'ONE Agreement': 'ONE',
      'Manufacturing Subcontract': 'MANUFACTURING',
      'OnSite Subcontract': 'ONSITE',
      'Master Ef': 'MASTER_EF',
      'ONE': 'ONE',
      'MANUFACTURING': 'MANUFACTURING',
      'ONSITE': 'ONSITE',
      'MASTER_EF': 'MASTER_EF',
    };
    return typeMap[type] || type.toUpperCase();
  };

  const handleHtmlPreview = async (projectId: number, contractType: string, contractId: number) => {
    setGeneratingContract(contractId);
    try {
      const response = await fetch('/api/contracts/draft-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contractType: getContractTypeForApi(contractType),
          projectId,
        }),
      });
      if (!response.ok) throw new Error('Failed to generate preview');
      const html = await response.text();
      const newWindow = window.open('', '_blank');
      if (newWindow) {
        newWindow.document.write(html);
        newWindow.document.close();
      }
    } catch (error) {
      console.error('Preview error:', error);
      toast({ title: "Preview Failed", description: "Failed to generate HTML preview.", variant: "destructive" });
    } finally {
      setGeneratingContract(null);
    }
  };

  const handleDownloadPdf = async (projectId: number, contractType: string, contractId: number, projectNumber: string) => {
    setGeneratingContract(contractId);
    try {
      const response = await fetch('/api/contracts/download-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contractType: getContractTypeForApi(contractType),
          projectId,
        }),
      });
      if (!response.ok) throw new Error('Failed to generate PDF');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${projectNumber}_${formatContractType(contractType).replace(/\s+/g, '_')}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download error:', error);
      toast({ title: "Download Failed", description: "Failed to download PDF.", variant: "destructive" });
    } finally {
      setGeneratingContract(null);
    }
  };

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
      'master_ef': 'Master EF',
      'MASTER_EF': 'Master EF',
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
                            {pkg.status === "draft" && (
                              <Link href={`/generate-contracts?projectId=${pkg.projectId}`}>
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  data-testid={`button-edit-package-${pkg.projectId}`}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Pencil className="h-3 w-3 mr-2" />
                                  Edit
                                </Button>
                              </Link>
                            )}
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
                                  <Button 
                                    variant="ghost" 
                                    size="icon"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleHtmlPreview(pkg.projectId, contract.contractType, contract.id);
                                    }}
                                    disabled={generatingContract === contract.id}
                                    data-testid={`button-html-preview-${contract.id}`}
                                    title="View HTML"
                                  >
                                    <Code className="h-4 w-4" />
                                  </Button>
                                  <Button 
                                    variant="ghost" 
                                    size="icon"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDownloadPdf(pkg.projectId, contract.contractType, contract.id, pkg.projectNumber);
                                    }}
                                    disabled={generatingContract === contract.id}
                                    data-testid={`button-download-${contract.id}`}
                                    title="Download PDF"
                                  >
                                    <Download className="h-4 w-4" />
                                  </Button>
                                  <Link href={`/contracts/${contract.id}/edit`}>
                                    <Button variant="outline" size="sm" data-testid={`button-edit-contract-${contract.id}`}>
                                      <Pencil className="h-3 w-3 mr-2" />
                                      Edit
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

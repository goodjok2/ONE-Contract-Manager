import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin-layout";
import { Button } from "@/components/ui/button";
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
import { Plus, Eye, ExternalLink } from "lucide-react";
import { Link } from "wouter";

interface LLC {
  id: number;
  name: string;
  project_name?: string;
  state_of_formation?: string;
  status?: string;
}

const statusColors: Record<string, string> = {
  forming: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  active: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  closed: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
};

export default function AdminLLCs() {
  const { data: llcs, isLoading } = useQuery<LLC[]>({
    queryKey: ["/api/llcs"],
  });

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold" data-testid="text-page-title">
              LLCs
            </h1>
            <p className="text-muted-foreground mt-1">
              Manage project-specific LLCs
            </p>
          </div>
          <Link href="/llc-admin">
            <Button data-testid="button-manage-llcs">
              <ExternalLink className="h-4 w-4 mr-2" />
              Open LLC Manager
            </Button>
          </Link>
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
                  <TableHead>Name</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {llcs?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      No LLCs found.
                    </TableCell>
                  </TableRow>
                ) : (
                  llcs?.map((llc) => (
                    <TableRow key={llc.id} data-testid={`row-llc-${llc.id}`}>
                      <TableCell className="font-medium">{llc.name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {llc.project_name || "-"}
                      </TableCell>
                      <TableCell>{llc.state_of_formation || "-"}</TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={statusColors[llc.status || "forming"]}
                        >
                          {llc.status || "forming"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Link href={`/llc-admin/${llc.id}`}>
                          <Button size="icon" variant="ghost" data-testid={`button-view-${llc.id}`}>
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

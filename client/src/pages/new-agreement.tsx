import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FilePlus, Upload, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { LLC, InsertContract } from "@shared/schema";

export default function NewAgreement() {
  const [showForm, setShowForm] = useState(false);
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const { data: llcs = [] } = useQuery<LLC[]>({
    queryKey: ["/api/llcs"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertContract) => {
      const response = await apiRequest("POST", "/api/contracts", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({
        title: "Contract Created",
        description: "The new contract has been created successfully.",
      });
      navigate("/");
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create contract. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const contractValue = formData.get("contractValue") as string;
    
    const data: InsertContract = {
      title: formData.get("title") as string,
      clientName: formData.get("clientName") as string,
      status: formData.get("status") as string,
      description: formData.get("description") as string || null,
      llcId: (formData.get("llcId") as string) || null,
      contractValue: contractValue ? contractValue : null,
    };
    createMutation.mutate(data);
  };

  if (showForm) {
    return (
      <div className="flex-1 p-6 md:p-8">
        <div className="mb-8">
          <Button 
            variant="ghost" 
            className="mb-4 -ml-2"
            onClick={() => setShowForm(false)}
            data-testid="button-back"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <h1 className="text-2xl font-semibold text-foreground" data-testid="text-page-title">
            Create New Agreement
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Fill in the contract details below
          </p>
        </div>

        <div className="max-w-2xl">
          <Card data-testid="card-agreement-form">
            <CardHeader>
              <CardTitle className="text-lg">Contract Details</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="title">Contract Title</Label>
                  <Input
                    id="title"
                    name="title"
                    placeholder="Enter contract title"
                    required
                    data-testid="input-title"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="clientName">Client Name</Label>
                  <Input
                    id="clientName"
                    name="clientName"
                    placeholder="Enter client name"
                    required
                    data-testid="input-client"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="status">Status</Label>
                    <Select name="status" defaultValue="draft">
                      <SelectTrigger data-testid="select-status">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="pending_review">Pending Review</SelectItem>
                        <SelectItem value="approved">Approved</SelectItem>
                        <SelectItem value="signed">Signed</SelectItem>
                        <SelectItem value="expired">Expired</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="llcId">Associated LLC</Label>
                    <Select name="llcId">
                      <SelectTrigger data-testid="select-llc">
                        <SelectValue placeholder="Select LLC (optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        {llcs.map((llc) => (
                          <SelectItem key={llc.id} value={llc.id}>
                            {llc.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="contractValue">Contract Value ($)</Label>
                  <Input
                    id="contractValue"
                    name="contractValue"
                    type="number"
                    placeholder="Enter contract value"
                    min="0"
                    step="0.01"
                    data-testid="input-value"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    name="description"
                    placeholder="Enter contract description (optional)"
                    className="min-h-32"
                    data-testid="input-description"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <Button 
                    type="button" 
                    variant="outline"
                    onClick={() => setShowForm(false)}
                    data-testid="button-cancel"
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={createMutation.isPending}
                    data-testid="button-submit"
                  >
                    {createMutation.isPending ? "Creating..." : "Create Contract"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-6 md:p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-foreground" data-testid="text-page-title">
          New Agreement
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Create a new contract and associate it with an LLC
        </p>
      </div>

      <div className="max-w-2xl">
        <Card data-testid="card-new-agreement">
          <CardHeader>
            <CardTitle className="text-lg">Create Contract</CardTitle>
            <CardDescription>
              Start a new agreement by filling out the form below or uploading an existing document.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div 
              className="border-2 border-dashed rounded-lg p-12 text-center hover-elevate cursor-pointer transition-colors"
              data-testid="dropzone-upload"
            >
              <Upload className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
              <p className="text-sm font-medium text-foreground mb-1">
                Drop your contract here
              </p>
              <p className="text-xs text-muted-foreground">
                PDF, DOC, or DOCX up to 10MB
              </p>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">Or</span>
              </div>
            </div>

            <Button 
              className="w-full" 
              onClick={() => setShowForm(true)}
              data-testid="button-create-manual"
            >
              <FilePlus className="h-4 w-4 mr-2" />
              Create Agreement Manually
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

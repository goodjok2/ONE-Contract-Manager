import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { 
  ArrowLeft, Building2, FileText, Users, Calendar, 
  Edit, Save, AlertTriangle, CheckCircle2, Clock, 
  XCircle, MapPin, Hash, Plus, Trash2, ExternalLink
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { type LLC } from "@shared/schema";

interface Member {
  name: string;
  role: string;
  percentage: number;
}

export default function LLCDetail() {
  const { id } = useParams<{ id: string }>();
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<Partial<LLC>>({});
  const [newMember, setNewMember] = useState<Member>({ name: "", role: "Member", percentage: 0 });
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const { toast } = useToast();

  const { data: llc, isLoading, error } = useQuery<LLC>({
    queryKey: ["/api/llcs", id],
    enabled: !!id,
  });

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<LLC>) => {
      const response = await apiRequest("PATCH", `/api/llcs/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/llcs", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/llcs"] });
      setIsEditing(false);
      toast({
        title: "LLC Updated",
        description: "The LLC has been updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update LLC. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    updateMutation.mutate(editData);
  };

  const handleAddMember = () => {
    if (!llc) return;
    
    const currentMembers: Member[] = llc.members ? JSON.parse(llc.members) : [];
    const updatedMembers = [...currentMembers, newMember];
    
    updateMutation.mutate({ members: JSON.stringify(updatedMembers) });
    setNewMember({ name: "", role: "Member", percentage: 0 });
    setIsAddMemberOpen(false);
  };

  const handleRemoveMember = (index: number) => {
    if (!llc) return;
    
    const currentMembers: Member[] = llc.members ? JSON.parse(llc.members) : [];
    const updatedMembers = currentMembers.filter((_, i) => i !== index);
    
    updateMutation.mutate({ members: JSON.stringify(updatedMembers) });
  };

  if (isLoading) {
    return (
      <div className="flex-1 p-6 md:p-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (error || !llc) {
    return (
      <div className="flex-1 p-6 md:p-8">
        <div className="max-w-4xl mx-auto text-center py-12">
          <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-destructive" />
          <h2 className="text-xl font-semibold mb-2">LLC Not Found</h2>
          <p className="text-muted-foreground mb-4">The requested LLC could not be found.</p>
          <Link href="/llc-admin">
            <Button>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to LLC Admin
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const members: Member[] = llc.members ? JSON.parse(llc.members) : [];

  return (
    <div className="flex-1 p-6 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <Link href="/llc-admin">
              <Button variant="ghost" size="icon" data-testid="button-back">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-semibold" data-testid="text-llc-name">{llc.name}</h1>
              <p className="text-sm text-muted-foreground">{llc.projectName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <LLCStatusBadge status={llc.status || "forming"} />
            {isEditing ? (
              <>
                <Button variant="outline" onClick={() => setIsEditing(false)}>Cancel</Button>
                <Button onClick={handleSave} disabled={updateMutation.isPending}>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </Button>
              </>
            ) : (
              <Button variant="outline" onClick={() => {
                setEditData({
                  einNumber: llc.einNumber,
                  registeredAgent: llc.registeredAgent,
                  registeredAgentAddress: llc.registeredAgentAddress,
                  address: llc.address,
                  city: llc.city,
                  state: llc.state,
                  zip: llc.zip,
                  annualReportDueDate: llc.annualReportDueDate,
                });
                setIsEditing(true);
              }} data-testid="button-edit">
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
            )}
          </div>
        </div>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
            <TabsTrigger value="documents" data-testid="tab-documents">Documents</TabsTrigger>
            <TabsTrigger value="members" data-testid="tab-members">Members</TabsTrigger>
            <TabsTrigger value="compliance" data-testid="tab-compliance">Compliance</TabsTrigger>
          </TabsList>
          
          <TabsContent value="overview" className="mt-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Entity Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">State of Formation</span>
                    <span className="font-medium">{llc.stateOfFormation || "Delaware"}</span>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">EIN</span>
                    {isEditing ? (
                      <Input
                        value={editData.einNumber || ""}
                        onChange={(e) => setEditData({ ...editData, einNumber: e.target.value })}
                        placeholder="XX-XXXXXXX"
                        className="w-32"
                      />
                    ) : (
                      <span className="font-medium">{llc.einNumber || "Not set"}</span>
                    )}
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Formation Date</span>
                    <span className="font-medium">
                      {llc.formationDate 
                        ? new Date(llc.formationDate).toLocaleDateString() 
                        : "Not set"
                      }
                    </span>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Status</span>
                    <Select
                      value={llc.status || "forming"}
                      onValueChange={(value) => updateMutation.mutate({ status: value })}
                      disabled={updateMutation.isPending}
                    >
                      <SelectTrigger className="w-32">
                        {updateMutation.isPending ? (
                          <span className="text-muted-foreground">Updating...</span>
                        ) : (
                          <SelectValue />
                        )}
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="forming">Forming</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="closed">Closed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Registered Agent</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {isEditing ? (
                    <>
                      <div>
                        <label className="text-sm text-muted-foreground">Agent Name</label>
                        <Input
                          value={editData.registeredAgent || ""}
                          onChange={(e) => setEditData({ ...editData, registeredAgent: e.target.value })}
                          placeholder="Registered Agent Name"
                        />
                      </div>
                      <div>
                        <label className="text-sm text-muted-foreground">Address</label>
                        <Textarea
                          value={editData.registeredAgentAddress || ""}
                          onChange={(e) => setEditData({ ...editData, registeredAgentAddress: e.target.value })}
                          placeholder="Full address"
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <span className="text-sm text-muted-foreground block mb-1">Agent Name</span>
                        <span className="font-medium">{llc.registeredAgent || "Not set"}</span>
                      </div>
                      {llc.registeredAgentAddress && (
                        <div>
                          <span className="text-sm text-muted-foreground block mb-1">Address</span>
                          <span className="text-sm">{llc.registeredAgentAddress}</span>
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Business Address</CardTitle>
              </CardHeader>
              <CardContent>
                {isEditing ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <label className="text-sm text-muted-foreground">Street Address</label>
                      <Input
                        value={editData.address || ""}
                        onChange={(e) => setEditData({ ...editData, address: e.target.value })}
                        placeholder="Street address"
                      />
                    </div>
                    <div>
                      <label className="text-sm text-muted-foreground">City</label>
                      <Input
                        value={editData.city || ""}
                        onChange={(e) => setEditData({ ...editData, city: e.target.value })}
                        placeholder="City"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm text-muted-foreground">State</label>
                        <Input
                          value={editData.state || ""}
                          onChange={(e) => setEditData({ ...editData, state: e.target.value })}
                          placeholder="State"
                        />
                      </div>
                      <div>
                        <label className="text-sm text-muted-foreground">ZIP</label>
                        <Input
                          value={editData.zip || ""}
                          onChange={(e) => setEditData({ ...editData, zip: e.target.value })}
                          placeholder="ZIP"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div>
                    {llc.address ? (
                      <p className="text-sm">
                        {llc.address}<br />
                        {llc.city && `${llc.city}, `}{llc.state} {llc.zip}
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground">No address set</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="documents" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Formation Documents</CardTitle>
                <CardDescription>Legal documents associated with this LLC</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-sm">No documents uploaded yet</p>
                  <p className="text-xs mt-1">Document management coming soon</p>
                </div>
              </CardContent>
            </Card>

            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="text-lg">Associated Contracts</CardTitle>
                <CardDescription>Contracts linked to this LLC</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-sm">No contracts linked yet</p>
                  <Link href="/generate-contracts">
                    <Button variant="outline" size="sm" className="mt-4">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Generate Contracts
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="members" className="mt-6">
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Members & Ownership</CardTitle>
                  <CardDescription>LLC ownership structure</CardDescription>
                </div>
                <Dialog open={isAddMemberOpen} onOpenChange={setIsAddMemberOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" data-testid="button-add-member">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Member
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add Member</DialogTitle>
                      <DialogDescription>Add a new member to this LLC</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div>
                        <label className="text-sm font-medium">Name</label>
                        <Input
                          value={newMember.name}
                          onChange={(e) => setNewMember({ ...newMember, name: e.target.value })}
                          placeholder="Member name"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium">Role</label>
                        <Select
                          value={newMember.role}
                          onValueChange={(value) => setNewMember({ ...newMember, role: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Managing Member">Managing Member</SelectItem>
                            <SelectItem value="Member">Member</SelectItem>
                            <SelectItem value="Non-Voting Member">Non-Voting Member</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-sm font-medium">Ownership %</label>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          value={newMember.percentage}
                          onChange={(e) => setNewMember({ ...newMember, percentage: Number(e.target.value) })}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsAddMemberOpen(false)}>Cancel</Button>
                      <Button onClick={handleAddMember} disabled={!newMember.name}>Add Member</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                {members.length > 0 ? (
                  <div className="space-y-3">
                    {members.map((member, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                            <Users className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium">{member.name}</p>
                            <p className="text-sm text-muted-foreground">{member.role}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="font-medium">{member.percentage}%</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveMember(index)}
                            data-testid={`button-remove-member-${index}`}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    <div className="pt-2 border-t">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Total Ownership</span>
                        <span className="font-medium">
                          {members.reduce((sum, m) => sum + m.percentage, 0)}%
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="text-sm">No members added yet</p>
                    <p className="text-xs mt-1">Click "Add Member" to add ownership details</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="compliance" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Annual Compliance</CardTitle>
                <CardDescription>Track annual report and compliance requirements</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Calendar className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">Annual Report</p>
                      <p className="text-sm text-muted-foreground">
                        Due: {llc.annualReportDueDate 
                          ? new Date(llc.annualReportDueDate).toLocaleDateString() 
                          : "Not set"
                        }
                      </p>
                    </div>
                  </div>
                  <Select
                    value={llc.annualReportStatus || "pending"}
                    onValueChange={(value) => updateMutation.mutate({ annualReportStatus: value })}
                    disabled={updateMutation.isPending}
                  >
                    <SelectTrigger className="w-32">
                      {updateMutation.isPending ? (
                        <span className="text-muted-foreground">Updating...</span>
                      ) : (
                        <SelectValue />
                      )}
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="filed">Filed</SelectItem>
                      <SelectItem value="overdue">Overdue</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {isEditing && (
                  <div>
                    <label className="text-sm text-muted-foreground">Annual Report Due Date</label>
                    <Input
                      type="date"
                      value={editData.annualReportDueDate || ""}
                      onChange={(e) => setEditData({ ...editData, annualReportDueDate: e.target.value })}
                    />
                  </div>
                )}

                {(llc.status === "active" && (!llc.einNumber || !llc.registeredAgent)) && (
                  <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5" />
                      <div>
                        <p className="font-medium text-amber-700 dark:text-amber-400">Missing Information</p>
                        <ul className="text-sm text-amber-600 dark:text-amber-500 mt-1 space-y-1">
                          {!llc.einNumber && <li>EIN number not recorded</li>}
                          {!llc.registeredAgent && <li>Registered agent not set</li>}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function LLCStatusBadge({ status }: { status: string }) {
  const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    forming: { label: "Forming", variant: "secondary" },
    active: { label: "Active", variant: "default" },
    closed: { label: "Closed", variant: "outline" },
  };

  const config = statusConfig[status] || statusConfig.forming;

  return (
    <Badge variant={config.variant} data-testid={`badge-status-${status}`}>
      {config.label}
    </Badge>
  );
}

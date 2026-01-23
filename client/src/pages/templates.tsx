import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, Building2 } from "lucide-react";

const TEMPLATES = [
  {
    id: "dtc",
    name: "DTC Standard Agreement",
    description: "Standard contract for Direct-to-Consumer individual home buyers. Includes standard warranty terms and financing options.",
    icon: Users,
    category: "Consumer",
    serviceModel: "CMOS",
  },
  {
    id: "b2b",
    name: "B2B Developer Agreement", 
    description: "Standard contract for Business-to-Business developers and landowners. Includes bulk pricing and commercial terms.",
    icon: Building2,
    category: "Business",
    serviceModel: "CRC",
  },
];

export default function Templates() {
  return (
    <div className="flex-1 p-6 md:p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-foreground" data-testid="text-page-title">
          Templates
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Contract templates for quick agreement creation
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {TEMPLATES.map((template) => (
          <Card key={template.id} data-testid={`card-template-${template.id}`}>
            <CardHeader>
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                  <template.icon className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-base">{template.name}</CardTitle>
                  <CardDescription className="mt-1">{template.description}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between gap-4">
                <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                  {template.category}
                </span>
                <Link href="/generate-contracts">
                  <Button data-testid={`button-use-template-${template.id}`}>
                    Use Template
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

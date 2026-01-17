import { Card, CardContent, CardTitle, CardDescription } from "@/components/ui/card";
import { MapPin } from "lucide-react";

export default function StateRequirements() {
  return (
    <div className="flex-1 p-6 md:p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-foreground" data-testid="text-page-title">
          State Requirements
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure state-specific contract requirements and regulations
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
            <MapPin className="h-8 w-8 text-muted-foreground" />
          </div>
          <CardTitle className="text-lg mb-2">Coming Soon</CardTitle>
          <CardDescription className="text-center max-w-md">
            State requirements configuration will allow you to set up 
            state-specific building codes, licensing requirements, and contract terms.
          </CardDescription>
        </CardContent>
      </Card>
    </div>
  );
}

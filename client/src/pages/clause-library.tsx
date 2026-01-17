import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Library } from "lucide-react";

export default function ClauseLibrary() {
  return (
    <div className="flex-1 p-6 md:p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-foreground" data-testid="text-page-title">
          Clause Library
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage reusable contract clauses and templates
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
            <Library className="h-8 w-8 text-muted-foreground" />
          </div>
          <CardTitle className="text-lg mb-2">Coming Soon</CardTitle>
          <CardDescription className="text-center max-w-md">
            The clause library will allow you to create and manage reusable contract sections 
            that can be inserted into your agreements.
          </CardDescription>
        </CardContent>
      </Card>
    </div>
  );
}

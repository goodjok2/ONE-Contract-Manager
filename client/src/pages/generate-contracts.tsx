import { WizardProvider, WizardShell } from '@/components/wizard';

export default function GenerateContractsPage() {
  return (
    <div className="container mx-auto py-8">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold mb-2">Generate Contracts</h1>
        <p className="text-muted-foreground">
          Create contract package for your project in 9 easy steps
        </p>
      </div>
      
      <WizardProvider>
        <WizardShell />
      </WizardProvider>
    </div>
  );
}

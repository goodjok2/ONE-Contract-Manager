import { WizardProvider, WizardShell } from '@/components/wizard';
import { useSearch } from 'wouter';

export default function GenerateContractsPage() {
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const projectId = params.get('projectId');
  
  return (
    <div className="container mx-auto py-8">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold mb-2">
          {projectId ? 'Resume Contract Draft' : 'Generate Contracts'}
        </h1>
        <p className="text-muted-foreground">
          {projectId 
            ? 'Continue working on your saved contract draft'
            : 'Create contract package for your project in 9 easy steps'}
        </p>
      </div>
      
      <WizardProvider loadProjectId={projectId}>
        <WizardShell />
      </WizardProvider>
    </div>
  );
}

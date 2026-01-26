export function generateLLCName(projectAddress: string, projectName?: string): string {
  // Prefer site address, fallback to project name
  const source = (projectAddress && projectAddress.trim() !== '') 
    ? projectAddress 
    : (projectName || '');
  
  if (!source || source.trim() === '') {
    return '';
  }
  const cleanSource = source.replace(/[^a-zA-Z0-9\s]/g, '').trim();
  return `DP ${cleanSource} LLC`;
}

export function canEditLLCName(status: string): boolean {
  return status !== 'active' && status !== 'formed';
}

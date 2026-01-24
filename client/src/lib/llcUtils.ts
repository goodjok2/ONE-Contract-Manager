export function generateLLCName(projectAddress: string): string {
  if (!projectAddress || projectAddress.trim() === '') {
    return '';
  }
  const cleanAddress = projectAddress.replace(/[^a-zA-Z0-9\s]/g, '').trim();
  return `DP ${cleanAddress} LLC`;
}

export function canEditLLCName(status: string): boolean {
  return status !== 'active' && status !== 'formed';
}

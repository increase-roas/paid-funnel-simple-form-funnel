const duplicateLeadDetectionRequirements = [
  /funnelConfig\.validation\.duplicateWindowHours/,
  /SELECT\s+id,\s*source\s+FROM\s+leads/,
  /status\s+IN\s*\(\s*['"]qualified['"]\s*,\s*['"]delivered['"]\s*\)/,
  /phone_e164\s*=\s*\?/,
  /email_normalized\s*=\s*\?/,
  /duplicate\.source\s*!==\s*['"]phone['"]/,
  /code:\s*['"]duplicate['"]/,
  /mergeLeadId:\s*duplicate\.id/,
] as const;

export function hasDuplicateLeadDetectionContract(source: string): boolean {
  return duplicateLeadDetectionRequirements.every(requirement => requirement.test(source));
}

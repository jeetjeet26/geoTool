const DOMAIN_REGEX = /^(?:https?:\/\/)?([^\s/?#]+)(?:[/?#]|$)/i;

export function normalizeDomain(input: string): string {
  const trimmed = input.trim().toLowerCase();
  const match = trimmed.match(DOMAIN_REGEX);
  if (!match || !match[1]) {
    return trimmed.replace(/^www\./, '');
  }
  return match[1].replace(/^www\./, '');
}

export function isBrandDomain(domain: string, brandDomains: string[]): boolean {
  const normalized = normalizeDomain(domain);
  return brandDomains.map(normalizeDomain).some((candidate) => candidate === normalized);
}

export const DEFAULT_COMPANY_ID = 'default-company';

export interface TenantContext {
  companyId: string;
  companyName: string;
}

export interface CompanyLookup {
  findCompanyById(companyId: string): Promise<{ id: string; name: string } | null>;
}

export class TenantNotFoundError extends Error {
  public constructor(companyId: string) {
    super(`Configured company "${companyId}" was not found.`);
    this.name = 'TenantNotFoundError';
  }
}

export function configuredCompanyId(value: string | undefined): string {
  const normalized = value?.trim();
  return normalized || DEFAULT_COMPANY_ID;
}

export async function resolveTenantContext(
  lookup: CompanyLookup,
  configuredId: string | undefined,
): Promise<TenantContext> {
  const companyId = configuredCompanyId(configuredId);
  const company = await lookup.findCompanyById(companyId);

  if (!company) {
    throw new TenantNotFoundError(companyId);
  }

  return {
    companyId: company.id,
    companyName: company.name,
  };
}

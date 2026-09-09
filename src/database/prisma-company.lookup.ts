import type { PrismaClient } from '@prisma/client';

import type { CompanyLookup } from '../tenant/tenant.context.js';

export class PrismaCompanyLookup implements CompanyLookup {
  public constructor(private readonly prisma: PrismaClient) {}

  public findCompanyById(
    companyId: string,
  ): Promise<{ id: string; name: string } | null> {
    return this.prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true, name: true },
    });
  }
}

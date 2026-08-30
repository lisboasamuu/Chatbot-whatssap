import type { PrismaClient } from '@prisma/client';
import type { PlatformAdminRepository } from '../platform-admin/platform-admin.repository.js';
import type {
  BusinessHourInput, CompanySettingsInput, CompanyStatus, MessageTemplateInput,
  PlatformCompanyDetail, PlatformCompanySummary,
} from '../platform-admin/platform-admin.types.js';

const emptySettings:CompanySettingsInput={pixEnabled:false,pixKey:null,pixRecipientName:null,depositType:'NONE',depositValue:null};

export class PrismaPlatformAdminRepository implements PlatformAdminRepository {
  public constructor(private readonly prisma:PrismaClient) {}

  private async detail(companyId:string):Promise<PlatformCompanyDetail|null> {
    const company=await this.prisma.company.findUnique({
      where:{id:companyId},
      include:{
        _count:{select:{customers:true}},
        businessHours:{orderBy:[{weekday:'asc'},{startTime:'asc'}]},
        messageTemplates:{orderBy:{type:'asc'}},
        settings:true,
      },
    });
    if (!company) return null;
    const appointmentCount=await this.prisma.appointment.count({where:{companyId}});
    return {
      id:company.id,name:company.name,status:company.status as CompanyStatus,timezone:company.timezone,
      createdAt:company.createdAt,updatedAt:company.updatedAt,customerCount:company._count.customers,appointmentCount,
      businessHours:company.businessHours.map(h=>({weekday:h.weekday as BusinessHourInput['weekday'],startTime:h.startTime,endTime:h.endTime})),
      messageTemplates:company.messageTemplates.map(t=>({type:t.type as MessageTemplateInput['type'],body:t.body})),
      settings:company.settings ? {
        pixEnabled:company.settings.pixEnabled,pixKey:company.settings.pixKey,pixRecipientName:company.settings.pixRecipientName,
        depositType:company.settings.depositType as CompanySettingsInput['depositType'],depositValue:company.settings.depositValue,
      } : emptySettings,
    };
  }

  public async listCompanies():Promise<PlatformCompanySummary[]> {
    const rows=await this.prisma.company.findMany({orderBy:{createdAt:'desc'},include:{_count:{select:{customers:true}}}});
    const counts=await this.prisma.appointment.groupBy({by:['companyId'],_count:{_all:true}});
    const byCompany=new Map(counts.map(c=>[c.companyId,c._count._all]));
    return rows.map(c=>({
      id:c.id,name:c.name,status:c.status as CompanyStatus,timezone:c.timezone,createdAt:c.createdAt,updatedAt:c.updatedAt,
      customerCount:c._count.customers,appointmentCount:byCompany.get(c.id)??0,
    }));
  }
  public getCompany(companyId:string){ return this.detail(companyId); }
  public async createCompany(input:{name:string;timezone:string}):Promise<PlatformCompanyDetail> {
    const created=await this.prisma.company.create({data:{name:input.name,timezone:input.timezone,status:'INACTIVE',settings:{create:{}}}});
    return (await this.detail(created.id))!;
  }
  public async updateCompany(companyId:string,input:{name?:string;timezone?:string;status?:CompanyStatus}):Promise<PlatformCompanyDetail|null> {
    const exists=await this.prisma.company.findUnique({where:{id:companyId},select:{id:true}});
    if (!exists) return null;
    await this.prisma.company.update({where:{id:companyId},data:input});
    return this.detail(companyId);
  }
  public async replaceBusinessHours(companyId:string,hours:BusinessHourInput[]):Promise<boolean>{
    const exists=await this.prisma.company.findUnique({where:{id:companyId},select:{id:true}}); if(!exists)return false;
    await this.prisma.$transaction(async tx=>{
      await tx.businessHour.deleteMany({where:{companyId}});
      if(hours.length) await tx.businessHour.createMany({data:hours.map(h=>({companyId,...h}))});
    }); return true;
  }
  public async replaceMessageTemplates(companyId:string,templates:MessageTemplateInput[]):Promise<boolean>{
    const exists=await this.prisma.company.findUnique({where:{id:companyId},select:{id:true}}); if(!exists)return false;
    await this.prisma.$transaction(async tx=>{
      await tx.messageTemplate.deleteMany({where:{companyId}});
      if(templates.length) await tx.messageTemplate.createMany({data:templates.map(t=>({companyId,...t}))});
    }); return true;
  }
  public async upsertSettings(companyId:string,settings:CompanySettingsInput):Promise<boolean>{
    const exists=await this.prisma.company.findUnique({where:{id:companyId},select:{id:true}}); if(!exists)return false;
    await this.prisma.companySettings.upsert({where:{companyId},create:{companyId,...settings},update:settings}); return true;
  }
  public async getTotals(){
    const [totalCompanies,activeCompanies,inactiveCompanies,totalAppointments]=await Promise.all([
      this.prisma.company.count(),this.prisma.company.count({where:{status:'ACTIVE'}}),
      this.prisma.company.count({where:{status:'INACTIVE'}}),this.prisma.appointment.count(),
    ]);
    return {totalCompanies,activeCompanies,inactiveCompanies,totalAppointments};
  }
}

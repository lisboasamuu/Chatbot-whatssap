import assert from 'node:assert/strict';
import test from 'node:test';
import type { PlatformAdminRepository } from './platform-admin.repository.js';
import { PlatformAdminService, PlatformValidationError } from './platform-admin.service.js';
import type {
  BusinessHourInput, CompanySettingsInput, CompanyStatus, MessageTemplateInput,
  PlatformCompanyDetail, PlatformCompanySummary, ReminderConfigurationInput,
} from './platform-admin.types.js';

class FakeRepository implements PlatformAdminRepository {
  public companies = new Map<string,PlatformCompanyDetail>();
  public constructor() {
    this.companies.set('a',{id:'a',name:'Empresa A',status:'ACTIVE',timezone:'America/Sao_Paulo',createdAt:new Date(),updatedAt:new Date(),customerCount:1,appointmentCount:1,businessHours:[],messageTemplates:[],settings:{pixEnabled:false,pixKey:null,pixRecipientName:null,depositType:'NONE',depositValue:null},reminders:{enabled:false,offsets:[]},whatsappEnabled:true,access:{configured:false,email:null}});
  }
  async listCompanies():Promise<PlatformCompanySummary[]>{return [...this.companies.values()];}
  async getCompany(id:string){return this.companies.get(id)??null;}
  async createCompany(input:{name:string;timezone:string}){const c={...(this.companies.get('a')!),id:'b',name:input.name,timezone:input.timezone,customerCount:0,appointmentCount:0};this.companies.set('b',c);return c;}
  async updateCompany(id:string,input:{name?:string;timezone?:string;status?:CompanyStatus}){const c=this.companies.get(id);if(!c)return null;const n={...c,...input};this.companies.set(id,n);return n;}
  async replaceBusinessHours(id:string,hours:BusinessHourInput[]){const c=this.companies.get(id);if(!c)return false;c.businessHours=hours;return true;}
  async replaceMessageTemplates(id:string,templates:MessageTemplateInput[]){const c=this.companies.get(id);if(!c)return false;c.messageTemplates=templates;return true;}
  async upsertSettings(id:string,settings:CompanySettingsInput){const c=this.companies.get(id);if(!c)return false;c.settings=settings;return true;}
  async updateReminderConfiguration(id:string,configuration:ReminderConfigurationInput){const c=this.companies.get(id);if(!c)return false;c.reminders={enabled:configuration.enabled,offsets:configuration.offsets};c.messageTemplates=[...c.messageTemplates.filter(template=>template.type!=='REMINDER'),...(configuration.message?[{type:'REMINDER' as const,body:configuration.message}]:[])];return true;}
  async upsertCompanyAccess(id:string,email:string,_passwordHash:string|null){const c=this.companies.get(id);if(!c)return false;c.access={configured:true,email};return true;}
  async getTotals(){return {totalCompanies:this.companies.size,activeCompanies:[...this.companies.values()].filter(c=>c.status==='ACTIVE').length,inactiveCompanies:[...this.companies.values()].filter(c=>c.status==='INACTIVE').length,totalAppointments:1};}
}
test('platform admin creates and deactivates companies without deleting history',async()=>{
  const repo=new FakeRepository(),service=new PlatformAdminService(repo);
  const created=await service.createCompany({name:'  Empresa B  ',timezone:'America/Sao_Paulo'});
  assert.equal(created.name,'Empresa B');
  const inactive=await service.updateCompany(created.id,{status:'INACTIVE'});
  assert.equal(inactive.status,'INACTIVE');
  assert.equal(repo.companies.has(created.id),true);
});
test('business hours accepts multiple periods and rejects overlap/start >= end',async()=>{
  const service=new PlatformAdminService(new FakeRepository());
  const saved=await service.replaceBusinessHours('a',[
    {weekday:'MONDAY',startTime:'08:00',endTime:'12:00'},
    {weekday:'MONDAY',startTime:'13:00',endTime:'18:00'},
  ]);
  assert.equal(saved.businessHours.length,2);
  await assert.rejects(()=>service.replaceBusinessHours('a',[
    {weekday:'MONDAY',startTime:'08:00',endTime:'13:00'},
    {weekday:'MONDAY',startTime:'12:00',endTime:'18:00'},
  ]),PlatformValidationError);
  await assert.rejects(()=>service.replaceBusinessHours('a',[{weekday:'MONDAY',startTime:'12:00',endTime:'12:00'}]),PlatformValidationError);
});
test('message templates support unicode, fallback by omission and reject unknown placeholders',async()=>{
  const service=new PlatformAdminService(new FakeRepository());
  const saved=await service.replaceMessageTemplates('a',[{type:'WELCOME',body:'Olá 👋'}]);
  assert.deepEqual(saved.messageTemplates,[{type:'WELCOME',body:'Olá 👋'}]);
  await assert.rejects(()=>service.replaceMessageTemplates('a',[{type:'WELCOME',body:'Olá {{script}}'}]),PlatformValidationError);
});
test('pix settings validate NONE, FIXED and PERCENTAGE without floats',async()=>{
  const service=new PlatformAdminService(new FakeRepository());
  let saved=await service.updateSettings('a',{pixEnabled:false,pixKey:null,pixRecipientName:null,depositType:'NONE',depositValue:null});
  assert.equal(saved.settings.depositValue,null);
  saved=await service.updateSettings('a',{pixEnabled:true,pixKey:'email@pix',pixRecipientName:'Empresa A',depositType:'FIXED',depositValue:2500});
  assert.equal(saved.settings.depositValue,2500);
  saved=await service.updateSettings('a',{pixEnabled:true,pixKey:'email@pix',pixRecipientName:'Empresa A',depositType:'PERCENTAGE',depositValue:5000});
  assert.equal(saved.settings.depositValue,5000);
  await assert.rejects(()=>service.updateSettings('a',{pixEnabled:true,pixKey:'email@pix',pixRecipientName:'Empresa A',depositType:'PERCENTAGE',depositValue:10001}),PlatformValidationError);
});

test('reminder configuration accepts only presets and validates reminder placeholders',async()=>{
  const service=new PlatformAdminService(new FakeRepository());
  const saved=await service.updateReminderConfiguration('a',{
    enabled:true,
    offsets:[1440,60,30],
    message:'Olá {{customerName}}, seu horário é {{date}} às {{time}} na {{companyName}}.',
  });
  assert.deepEqual(saved.reminders,{enabled:true,offsets:[1440,60,30]});
  assert.equal(saved.messageTemplates.find(template=>template.type==='REMINDER')?.body.includes('{{customerName}}'),true);
  await assert.rejects(()=>service.updateReminderConfiguration('a',{enabled:true,offsets:[15],message:null}),PlatformValidationError);
  await assert.rejects(()=>service.updateReminderConfiguration('a',{enabled:true,offsets:[30],message:'{{serviceName}}'}),PlatformValidationError);
});

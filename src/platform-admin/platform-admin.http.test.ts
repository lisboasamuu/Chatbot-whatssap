import assert from 'node:assert/strict';
import test from 'node:test';
import type { AddressInfo } from 'node:net';

import { createAdminHttpServer } from '../admin/admin.http.js';
import type { AdminRepository } from '../admin/admin.repository.js';
import { AdminService } from '../admin/admin.service.js';
import type { AdminAppointment, AdminConversation, AdminCustomer, AdminCustomerDetail } from '../admin/admin.types.js';
import { PlatformAdminAuth } from './platform-admin.auth.js';
import type { PlatformAdminRepository } from './platform-admin.repository.js';
import { PlatformAdminService } from './platform-admin.service.js';
import type {
  BusinessHourInput,
  CompanySettingsInput,
  CompanyStatus,
  MessageTemplateInput,
  PlatformCompanyDetail,
  PlatformCompanySummary,
} from './platform-admin.types.js';

class EmptyAdminRepository implements AdminRepository {
  async countCustomers(_companyId:string){ return 0; }
  async countAppointmentsOnDate(_companyId:string,_date:string){ return 0; }
  async countUpcomingAppointments(_companyId:string,_date:string,_time:string){ return 0; }
  async listUpcomingAppointments(_companyId:string,_date:string,_time:string,_limit:number):Promise<AdminAppointment[]>{ return []; }
  async listCustomers(_companyId:string):Promise<AdminCustomer[]>{ return []; }
  async findCustomerById(_companyId:string,_customerId:string):Promise<AdminCustomerDetail|null>{ return null; }
  async findConversationByCustomerId(_companyId:string,_customerId:string):Promise<AdminConversation|null>{ return null; }
}

class PlatformRepository implements PlatformAdminRepository {
  private readonly company:PlatformCompanyDetail={
    id:'company-a',name:'Company A',status:'ACTIVE',timezone:'America/Sao_Paulo',
    createdAt:new Date('2026-08-30T00:00:00Z'),updatedAt:new Date('2026-08-30T00:00:00Z'),
    customerCount:0,appointmentCount:0,businessHours:[],messageTemplates:[],
    settings:{pixEnabled:false,pixKey:null,pixRecipientName:null,depositType:'NONE',depositValue:null},
  };
  async listCompanies():Promise<PlatformCompanySummary[]>{ return [this.company]; }
  async getCompany(id:string){ return id===this.company.id?this.company:null; }
  async createCompany(input:{name:string;timezone:string}){ return {...this.company,id:'created',name:input.name,timezone:input.timezone,status:'INACTIVE' as const}; }
  async updateCompany(id:string,input:{name?:string;timezone?:string;status?:CompanyStatus}){ return id===this.company.id?{...this.company,...input}:null; }
  async replaceBusinessHours(id:string,_hours:BusinessHourInput[]){ return id===this.company.id; }
  async replaceMessageTemplates(id:string,_templates:MessageTemplateInput[]){ return id===this.company.id; }
  async upsertSettings(id:string,_settings:CompanySettingsInput){ return id===this.company.id; }
  async getTotals(){ return {totalCompanies:1,activeCompanies:1,inactiveCompanies:0,totalAppointments:0}; }
}

async function withPlatformServer(callback:(baseUrl:string)=>Promise<void>):Promise<void>{
  const adminService=new AdminService(
    new EmptyAdminRepository(),
    {companyId:'company-a',companyName:'Company A'},
  );
  const server=createAdminHttpServer(adminService,{
    service:new PlatformAdminService(new PlatformRepository()),
    auth:new PlatformAdminAuth('this-is-a-strong-admin-password',false),
  });
  await new Promise<void>((resolve)=>server.listen(0,'127.0.0.1',resolve));
  const {port}=server.address() as AddressInfo;
  try { await callback(`http://127.0.0.1:${port}`); }
  finally { await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve())); }
}

test('platform API rejects unauthenticated and arbitrary tenant headers',async()=>{
  await withPlatformServer(async baseUrl=>{
    const response=await fetch(`${baseUrl}/api/platform/companies`,{
      headers:{'X-Company-Id':'company-a'},
    });
    assert.equal(response.status,401);
  });
});

test('authorized platform admin can login and list companies',async()=>{
  await withPlatformServer(async baseUrl=>{
    const login=await fetch(`${baseUrl}/api/platform/auth/login`,{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({password:'this-is-a-strong-admin-password'}),
    });
    assert.equal(login.status,200);
    const cookie=login.headers.get('set-cookie');
    assert.ok(cookie);
    assert.match(cookie,/HttpOnly/);
    const response=await fetch(`${baseUrl}/api/platform/companies`,{
      headers:{Cookie:cookie.split(';')[0]!},
    });
    assert.equal(response.status,200);
    const body=await response.json() as {companies:Array<{id:string}>};
    assert.deepEqual(body.companies.map(c=>c.id),['company-a']);
  });
});

test('invalid platform password is rejected without leaking details',async()=>{
  await withPlatformServer(async baseUrl=>{
    const response=await fetch(`${baseUrl}/api/platform/auth/login`,{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({password:'wrong-password'}),
    });
    const body=await response.text();
    assert.equal(response.status,401);
    assert.doesNotMatch(body,/this-is-a-strong-admin-password/);
  });
});

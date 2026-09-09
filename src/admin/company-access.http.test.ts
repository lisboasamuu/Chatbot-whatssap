import assert from 'node:assert/strict';
import test from 'node:test';
import type { AddressInfo } from 'node:net';
import { CompanyHttpAuth } from '../company-auth/company-auth.http.js';
import type { CompanyAuthRepository, CompanyCredentialRecord, CompanySessionRecord } from '../company-auth/company-auth.repository.js';
import { CompanyAuthService } from '../company-auth/company-auth.service.js';
import { hashPassword } from '../company-auth/password.js';
import { PlatformAdminAuth } from '../platform-admin/platform-admin.auth.js';
import type { PlatformAdminRepository } from '../platform-admin/platform-admin.repository.js';
import { PlatformAdminService } from '../platform-admin/platform-admin.service.js';
import type { PlatformCompanyDetail } from '../platform-admin/platform-admin.types.js';
import type { CompanyRuntimeManager, ManagedWhatsAppStatus } from '../runtime/company-runtime.manager.js';
import type { AdminRepository } from './admin.repository.js';
import { createAdminHttpServer } from './admin.http.js';
import { AdminService } from './admin.service.js';
import type { AdminAppointment, AdminConversation, AdminCustomer, AdminCustomerDetail } from './admin.types.js';

class AuthRepo implements CompanyAuthRepository {
  credential!:CompanyCredentialRecord; sessions=new Map<string,CompanySessionRecord>();
  async findCredentialByEmail(email:string){return email===this.credential.email?this.credential:null;}
  async findSessionByTokenHash(hash:string){return this.sessions.get(hash)??null;}
  async createSession(credentialId:string,tokenHash:string,now:Date,expiresAt:Date){this.sessions.set(tokenHash,{id:tokenHash,tokenHash,createdAt:now,lastSeenAt:now,expiresAt,credential:this.credential});}
  async touchSession(id:string,lastSeenAt:Date){const s=this.sessions.get(id);if(s)s.lastSeenAt=lastSeenAt;}
  async deleteSessionByTokenHash(hash:string){this.sessions.delete(hash);}
  async deleteSessionById(id:string){this.sessions.delete(id);}
  async deleteExpiredSessions(){}
}
class AdminRepo implements AdminRepository {
  async countCustomers(companyId:string){return companyId==='company-a'?1:0;} async countAppointmentsOnDate(){return 0;} async countUpcomingAppointments(){return 0;}
  async listUpcomingAppointments(_c:string,_d:string,_t:string,_l:number):Promise<AdminAppointment[]>{return [];} async listCustomers(companyId:string):Promise<AdminCustomer[]>{return companyId==='company-a'?[{id:'customer-a',externalId:'a@c.us',name:'A',createdAt:new Date(),appointmentCount:0}]:[];}
  async findCustomerById(companyId:string,customerId:string):Promise<AdminCustomerDetail|null>{if(companyId==='company-a'&&customerId==='customer-a')return{id:'customer-a',externalId:'a@c.us',name:'A',createdAt:new Date(),updatedAt:new Date(),appointmentCount:0,appointments:[]};return null;}
  async findConversationByCustomerId(_companyId:string,_customerId:string):Promise<AdminConversation|null>{return null;}
}
class PlatformRepo implements PlatformAdminRepository {
  private detail:PlatformCompanyDetail={id:'company-a',name:'Company A',status:'ACTIVE',timezone:'America/Sao_Paulo',createdAt:new Date(),updatedAt:new Date(),customerCount:1,appointmentCount:0,businessHours:[],messageTemplates:[],settings:{pixEnabled:false,pixKey:null,pixRecipientName:null,depositType:'NONE',depositValue:null},reminders:{enabled:false,offsets:[]},whatsappEnabled:true,access:{configured:true,email:'owner@company.test'}};
  async listCompanies(){return [this.detail];} async getCompany(id:string){return id==='company-a'?this.detail:null;} async createCompany(){return this.detail;} async updateCompany(){return this.detail;} async replaceBusinessHours(){return true;} async replaceMessageTemplates(){return true;} async upsertSettings(){return true;} async updateReminderConfiguration(){return true;} async upsertCompanyAccess(){return true;} async getTotals(){return{totalCompanies:1,activeCompanies:1,inactiveCompanies:0,totalAppointments:0};}
}
class RuntimeStub {
  public lastCompanyId:string|null=null; public disconnectCalls=0;
  async getWhatsAppStatus(companyId:string):Promise<ManagedWhatsAppStatus>{this.lastCompanyId=companyId;return{state:'CONNECTED',ready:true,qrAvailable:false,lastError:null,enabled:true};}
  getQrValue(companyId:string){this.lastCompanyId=companyId;return null;}
  async connectWhatsApp(companyId:string){return this.getWhatsAppStatus(companyId);} async disconnectWhatsApp(companyId:string){this.disconnectCalls+=1;return this.getWhatsAppStatus(companyId);}
}

async function withServer(callback:(base:string,runtime:RuntimeStub)=>Promise<void>){
  const authRepo=new AuthRepo();authRepo.credential={id:'cred-a',companyId:'company-a',email:'owner@company.test',passwordHash:await hashPassword('very-secure-pass'),company:{id:'company-a',name:'Company A',status:'ACTIVE',timezone:'America/Sao_Paulo'}};
  const adminRepo=new AdminRepo(),platformService=new PlatformAdminService(new PlatformRepo()),runtime=new RuntimeStub();
  const server=createAdminHttpServer(new AdminService(adminRepo,{companyId:'legacy',companyName:'Legacy'}),{service:platformService,auth:new PlatformAdminAuth('this-is-a-platform-password',false,'http://localhost:5173')},{auth:new CompanyHttpAuth(new CompanyAuthService(authRepo,'01234567890123456789012345678901'),false,'http://localhost:5173',false),repository:adminRepo,configuration:platformService,runtime:runtime as unknown as CompanyRuntimeManager});
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const {port}=server.address() as AddressInfo;try{await callback(`http://127.0.0.1:${port}`,runtime);}finally{await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));}
}
async function login(base:string){const response=await fetch(`${base}/api/auth/login`,{method:'POST',headers:{'Content-Type':'application/json',Origin:'http://localhost:5173'},body:JSON.stringify({email:'owner@company.test',password:'very-secure-pass'})});assert.equal(response.status,200);return response.headers.get('set-cookie')!.split(';')[0]!;}

test('company APIs require a company session',async()=>{await withServer(async base=>{assert.equal((await fetch(`${base}/api/customers`)).status,401);});});
test('authenticated company cannot switch tenant using headers, query strings or known resource ids',async()=>{await withServer(async base=>{const cookie=await login(base);const list=await fetch(`${base}/api/customers?companyId=company-b`,{headers:{Cookie:cookie,'X-Company-Id':'company-b'}});assert.equal(list.status,200);const body=await list.json() as {customers:Array<{id:string}>};assert.deepEqual(body.customers.map(x=>x.id),['customer-a']);assert.equal((await fetch(`${base}/api/customers/customer-b`,{headers:{Cookie:cookie}})).status,404);});});
test('company session never grants Platform Admin access',async()=>{await withServer(async base=>{const cookie=await login(base);assert.equal((await fetch(`${base}/api/platform/summary`,{headers:{Cookie:cookie}})).status,401);});});
test('WhatsApp status is resolved only from authenticated company and web logout does not disconnect it',async()=>{await withServer(async(base,runtime)=>{const cookie=await login(base);const status=await fetch(`${base}/api/whatsapp/qr?companyId=company-b`,{headers:{Cookie:cookie}});assert.equal(status.status,200);assert.equal(runtime.lastCompanyId,'company-a');const logout=await fetch(`${base}/api/auth/logout`,{method:'POST',headers:{Cookie:cookie,Origin:'http://localhost:5173'}});assert.equal(logout.status,200);assert.equal(runtime.disconnectCalls,0);});});

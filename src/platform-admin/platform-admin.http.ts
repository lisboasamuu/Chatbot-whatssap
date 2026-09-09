import type { IncomingMessage, ServerResponse } from 'node:http';
import { PlatformAdminAuth } from './platform-admin.auth.js';
import { PlatformAdminService, PlatformNotFoundError, PlatformValidationError } from './platform-admin.service.js';

const MAX_BODY_BYTES = 64 * 1024;

function sendJson(response:ServerResponse,status:number,body:unknown):void{
  response.statusCode=status;
  response.setHeader('Content-Type','application/json; charset=utf-8');
  response.setHeader('Cache-Control','no-store');
  response.end(JSON.stringify(body));
}
function sendError(response:ServerResponse,status:number,code:string,message:string):void{
  sendJson(response,status,{error:{code,message}});
}
async function readJson(request:IncomingMessage):Promise<Record<string,unknown>>{
  const chunks:Buffer[]=[]; let total=0;
  for await (const chunk of request) {
    const buffer=Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk);
    total+=buffer.length;
    if(total>MAX_BODY_BYTES) throw new PlatformValidationError('Corpo da requisição muito grande.');
    chunks.push(buffer);
  }
  if(!chunks.length) return {};
  try {
    const value=JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
    if(!value || typeof value!=='object' || Array.isArray(value)) throw new Error();
    return value as Record<string,unknown>;
  } catch { throw new PlatformValidationError('JSON inválido.'); }
}
function companyRoute(pathname:string):{id:string;section:string|null}|null{
  const m=/^\/api\/platform\/companies\/([^/]+)(?:\/(business-hours|messages|settings|reminders|access))?$/.exec(pathname);
  if(!m)return null;
  try{return {id:decodeURIComponent(m[1]!),section:m[2]??null};}catch{return null;}
}
function mutation(method:string|undefined):boolean{return method==='POST'||method==='PUT'||method==='PATCH'||method==='DELETE';}

export interface PlatformHttpDependencies { service:PlatformAdminService; auth:PlatformAdminAuth; refreshCompanyRuntimes?:()=>Promise<void>; }

export async function handlePlatformRequest(
  request:IncomingMessage,response:ServerResponse,deps:PlatformHttpDependencies,
):Promise<boolean>{
  const url=new URL(request.url??'/','http://localhost');
  if(!url.pathname.startsWith('/api/platform/')) return false;

  if(url.pathname==='/api/platform/auth/login' && request.method==='POST'){
    if(!deps.auth.isSameOrigin(request)){sendError(response,403,'FORBIDDEN','Origem não permitida.');return true;}
    const body=await readJson(request);
    const password=typeof body.password==='string'?body.password:'';
    if(!deps.auth.verifyPassword(password,request)){
      sendError(response,401,'INVALID_CREDENTIALS','Credenciais inválidas ou limite de tentativas atingido.');
      return true;
    }
    deps.auth.createSession(response); sendJson(response,200,{authenticated:true}); return true;
  }

  if(!deps.auth.isAuthenticated(request)){sendError(response,401,'UNAUTHORIZED','Autenticação do Platform Admin necessária.');return true;}
  if(mutation(request.method) && !deps.auth.isSameOrigin(request)){sendError(response,403,'FORBIDDEN','Origem não permitida.');return true;}

  if(url.pathname==='/api/platform/auth/session' && request.method==='GET'){sendJson(response,200,{authenticated:true});return true;}
  if(url.pathname==='/api/platform/auth/logout' && request.method==='POST'){deps.auth.clearSession(request,response);sendJson(response,200,{authenticated:false});return true;}
  if(url.pathname==='/api/platform/summary' && request.method==='GET'){sendJson(response,200,await deps.service.getSummary());return true;}
  if(url.pathname==='/api/platform/companies' && request.method==='GET'){sendJson(response,200,{companies:await deps.service.listCompanies()});return true;}
  if(url.pathname==='/api/platform/companies' && request.method==='POST'){
    const body=await readJson(request); sendJson(response,201,{company:await deps.service.createCompany(body)}); return true;
  }

  const route=companyRoute(url.pathname);
  if(route){
    if(!route.section && request.method==='GET'){sendJson(response,200,{company:await deps.service.getCompany(route.id)});return true;}
    if(!route.section && request.method==='PATCH'){
      const body=await readJson(request); const company=await deps.service.updateCompany(route.id,body); await deps.refreshCompanyRuntimes?.(); sendJson(response,200,{company});return true;
    }
    if(route.section==='business-hours' && request.method==='PUT'){
      const body=await readJson(request); sendJson(response,200,{company:await deps.service.replaceBusinessHours(route.id,body.hours)});return true;
    }
    if(route.section==='messages' && request.method==='PUT'){
      const body=await readJson(request); sendJson(response,200,{company:await deps.service.replaceMessageTemplates(route.id,body.templates)});return true;
    }
    if(route.section==='settings' && request.method==='PUT'){
      const body=await readJson(request); sendJson(response,200,{company:await deps.service.updateSettings(route.id,body)});return true;
    }
    if(route.section==='reminders' && request.method==='PUT'){
      const body=await readJson(request); sendJson(response,200,{company:await deps.service.updateReminderConfiguration(route.id,body)});return true;
    }
    if(route.section==='access' && request.method==='PUT'){
      const body=await readJson(request); sendJson(response,200,{company:await deps.service.updateCompanyAccess(route.id,body)});return true;
    }
  }

  sendError(response,404,'NOT_FOUND','Recurso não encontrado.'); return true;
}

export function handlePlatformError(response:ServerResponse,error:unknown):boolean{
  if(error instanceof PlatformValidationError){sendError(response,400,'VALIDATION_ERROR',error.message);return true;}
  if(error instanceof PlatformNotFoundError){sendError(response,404,'NOT_FOUND',error.message);return true;}
  return false;
}

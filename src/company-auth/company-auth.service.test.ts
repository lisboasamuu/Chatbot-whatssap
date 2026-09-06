import assert from 'node:assert/strict';
import test from 'node:test';
import type {
  CompanyAuthRepository, CompanyCredentialRecord, CompanySessionRecord,
} from './company-auth.repository.js';
import {
  CompanyAuthService, CompanyInactiveError, InvalidCompanyCredentialsError,
} from './company-auth.service.js';
import { hashPassword, verifyPassword } from './password.js';

class MemoryAuthRepository implements CompanyAuthRepository {
  public credential: CompanyCredentialRecord | null = null;
  public sessions = new Map<string, CompanySessionRecord>();
  public async findCredentialByEmail(email:string){return this.credential?.email===email?this.credential:null;}
  public async findSessionByTokenHash(tokenHash:string){return this.sessions.get(tokenHash)??null;}
  public async createSession(credentialId:string,tokenHash:string,now:Date,expiresAt:Date){
    if(!this.credential||this.credential.id!==credentialId)throw new Error('credential missing');
    this.sessions.set(tokenHash,{id:'session',tokenHash,createdAt:now,lastSeenAt:now,expiresAt,credential:this.credential});
  }
  public async touchSession(sessionId:string,lastSeenAt:Date){for(const session of this.sessions.values())if(session.id===sessionId)session.lastSeenAt=lastSeenAt;}
  public async deleteSessionByTokenHash(tokenHash:string){this.sessions.delete(tokenHash);}
  public async deleteSessionById(sessionId:string){for(const [key,session] of this.sessions)if(session.id===sessionId)this.sessions.delete(key);}
  public async deleteExpiredSessions(now:Date){for(const [key,session] of this.sessions)if(session.expiresAt<=now)this.sessions.delete(key);}
}

async function repository(status:'ACTIVE'|'INACTIVE'='ACTIVE'){
  const repo=new MemoryAuthRepository();
  repo.credential={id:'credential-a',companyId:'company-a',email:'owner@company.test',passwordHash:await hashPassword('very-secure-pass'),company:{id:'company-a',name:'Company A',status,timezone:'America/Sao_Paulo'}};
  return repo;
}

test('scrypt password hashing never stores plaintext and verifies the correct secret',async()=>{
  const encoded=await hashPassword('my-strong-password');
  assert.notEqual(encoded,'my-strong-password');assert.match(encoded,/^scrypt\$/);
  assert.equal(await verifyPassword('my-strong-password',encoded),true);
  assert.equal(await verifyPassword('wrong-password',encoded),false);
});

test('company auth creates a persistent opaque session and logout invalidates it',async()=>{
  const repo=await repository();
  const service=new CompanyAuthService(repo,'01234567890123456789012345678901');
  const login=await service.login(' OWNER@COMPANY.TEST ','very-secure-pass');
  assert.equal(login.company.companyId,'company-a');assert.ok(login.token.length>30);
  assert.equal((await service.authenticate(login.token))?.companyId,'company-a');
  await service.logout(login.token);assert.equal(await service.authenticate(login.token),null);
});

test('invalid email and password use the same generic error',async()=>{
  const service=new CompanyAuthService(await repository(),'01234567890123456789012345678901');
  await assert.rejects(()=>service.login('missing@company.test','very-secure-pass'),InvalidCompanyCredentialsError);
  await assert.rejects(()=>service.login('owner@company.test','wrong-password'),InvalidCompanyCredentialsError);
});

test('inactive company cannot login or keep using an existing session',async()=>{
  const repo=await repository();
  const service=new CompanyAuthService(repo,'01234567890123456789012345678901');
  const login=await service.login('owner@company.test','very-secure-pass');
  repo.credential!.company.status='INACTIVE';
  await assert.rejects(()=>service.authenticate(login.token),CompanyInactiveError);
  await assert.rejects(()=>service.login('owner@company.test','very-secure-pass'),CompanyInactiveError);
});

test('idle sessions expire with 401 semantics at the service boundary',async()=>{
  const repo=await repository();let now=new Date('2026-09-04T03:00:00.000Z');
  const service=new CompanyAuthService(repo,'01234567890123456789012345678901',()=>now);
  const login=await service.login('owner@company.test','very-secure-pass');
  for(const session of repo.sessions.values())session.lastSeenAt=new Date(now);
  now=new Date(now.getTime()+31*60*1000);
  assert.equal(await service.authenticate(login.token),null);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { PlatformAdminAuth } from './platform-admin.auth.js';

function request(cookie?:string):IncomingMessage {
  return {
    headers: cookie ? {cookie,host:'localhost:3001',origin:'http://localhost:3001'} : {host:'localhost:3001',origin:'http://localhost:3001'},
    socket:{remoteAddress:'127.0.0.1'},
  } as unknown as IncomingMessage;
}
function response():ServerResponse & {headers:Map<string,string>} {
  const headers=new Map<string,string>();
  return {headers,setHeader(name:string,value:string|number|string[]){headers.set(name,String(value));return this;}} as unknown as ServerResponse & {headers:Map<string,string>};
}
test('platform auth creates HttpOnly Strict session and invalidates it on logout',()=>{
  const auth=new PlatformAdminAuth('a-very-strong-platform-password',false);
  const req=request();
  assert.equal(auth.verifyPassword('a-very-strong-platform-password',req),true);
  const res=response();auth.createSession(res);
  const cookie=res.headers.get('Set-Cookie')!;
  assert.match(cookie,/HttpOnly/);assert.match(cookie,/SameSite=Strict/);
  const tokenCookie=cookie.split(';')[0]!;
  assert.equal(auth.isAuthenticated(request(tokenCookie)),true);
  const logout=response();auth.clearSession(request(tokenCookie),logout);
  assert.equal(auth.isAuthenticated(request(tokenCookie)),false);
});
test('platform auth rate limits repeated invalid passwords and rejects foreign origin',()=>{
  const auth=new PlatformAdminAuth('a-very-strong-platform-password',false);
  const req=request();
  for(let i=0;i<5;i++) assert.equal(auth.verifyPassword('wrong',req),false);
  assert.equal(auth.verifyPassword('a-very-strong-platform-password',req),false);
  const foreign={...req,headers:{host:'localhost:3001',origin:'https://evil.example'}} as IncomingMessage;
  assert.equal(auth.isSameOrigin(foreign),false);
});

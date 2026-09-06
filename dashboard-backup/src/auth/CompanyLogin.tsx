import { useState, type FormEvent, type ReactNode } from 'react';
import { api } from '../lib/api';
import type { AuthenticatedCompany } from '../types';

export function CompanyLogin({onLogin}:{onLogin:(company:AuthenticatedCompany)=>void}):ReactNode {
  const [email,setEmail]=useState(''); const [password,setPassword]=useState('');
  const [error,setError]=useState(''); const [loading,setLoading]=useState(false);
  async function submit(event:FormEvent){event.preventDefault();setLoading(true);setError('');try{onLogin(await api.companyLogin(email,password));}catch(e){setError(e instanceof Error?e.message:'Não foi possível entrar.');}finally{setLoading(false);}}
  return <div className="grid min-h-screen place-items-center bg-slate-950 px-4 text-slate-100"><div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-7 shadow-2xl">
    <div className="mb-7"><div className="mb-4 grid h-11 w-11 place-items-center rounded-xl bg-cyan-400 font-black text-slate-950">S</div><p className="text-xs font-semibold uppercase tracking-[.28em] text-cyan-400">S-TECH</p><h1 className="mt-2 text-2xl font-semibold">Acesso da empresa</h1><p className="mt-2 text-sm text-slate-400">Entre para acessar somente os dados e a conexão WhatsApp da sua empresa.</p></div>
    <form onSubmit={submit} className="space-y-4"><label className="block text-sm text-slate-300">E-mail<input autoFocus type="email" autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-3 outline-none focus:border-cyan-400"/></label><label className="block text-sm text-slate-300">Senha<input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-3 outline-none focus:border-cyan-400"/></label>{error&&<p role="alert" className="rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}<button disabled={loading||!email||!password} className="w-full rounded-xl bg-cyan-400 px-4 py-3 font-semibold text-slate-950 disabled:opacity-50">{loading?'Entrando…':'Entrar'}</button></form>
  </div></div>;
}

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PlatformAdmin } from './PlatformAdmin';

describe('PlatformAdmin',()=>{
  beforeEach(()=>{vi.restoreAllMocks();});
  it('shows protected login when session is missing',async()=>{
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:false,json:async()=>({error:{message:'Autenticação necessária.'}})}));
    render(<PlatformAdmin/>);
    expect(await screen.findByText('Acesso privado à administração da plataforma.')).toBeInTheDocument();
    expect(screen.getByLabelText('Senha administrativa')).toBeInTheDocument();
  });
  it('renders empty state and real summary after authenticated session',async()=>{
    const fetchMock=vi.fn()
      .mockResolvedValueOnce({ok:true,json:async()=>({authenticated:true})})
      .mockResolvedValueOnce({ok:true,json:async()=>({totalCompanies:0,activeCompanies:0,inactiveCompanies:0,totalAppointments:0})})
      .mockResolvedValueOnce({ok:true,json:async()=>({companies:[]})});
    vi.stubGlobal('fetch',fetchMock);
    render(<PlatformAdmin/>);
    await waitFor(()=>expect(screen.getAllByText('0').length).toBeGreaterThan(0));
  });
  it('login sends password and transitions to authenticated loading',async()=>{
    const fetchMock=vi.fn()
      .mockResolvedValueOnce({ok:false,json:async()=>({error:{message:'Autenticação necessária.'}})})
      .mockResolvedValueOnce({ok:true,json:async()=>({authenticated:true})})
      .mockResolvedValueOnce({ok:true,json:async()=>({totalCompanies:0,activeCompanies:0,inactiveCompanies:0,totalAppointments:0})})
      .mockResolvedValueOnce({ok:true,json:async()=>({companies:[]})});
    vi.stubGlobal('fetch',fetchMock);
    render(<PlatformAdmin/>);
    const user=userEvent.setup();
    await user.type(await screen.findByLabelText('Senha administrativa'),'senha-forte');
    await user.click(screen.getByRole('button',{name:'Entrar com segurança'}));
    await waitFor(()=>expect(screen.getByText('Total de empresas')).toBeInTheDocument());
  });

  it('configures reminder presets and a friendly custom message without technical input',async()=>{
    const company={
      id:'company-a',name:'Empresa A',status:'ACTIVE',timezone:'America/Sao_Paulo',
      createdAt:'2026-09-04T00:00:00.000Z',updatedAt:'2026-09-04T00:00:00.000Z',
      customerCount:1,appointmentCount:1,businessHours:[],messageTemplates:[],
      settings:{pixEnabled:false,pixKey:null,pixRecipientName:null,depositType:'NONE',depositValue:null},
      reminders:{enabled:false,offsets:[]},whatsappEnabled:true,access:{configured:false,email:null},
    };
    let reminderPayload:unknown=null;
    const fetchMock=vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
      const path=String(input);
      if(path==='/api/platform/auth/session')return {ok:true,json:async()=>({authenticated:true})};
      if(path==='/api/platform/summary')return {ok:true,json:async()=>({totalCompanies:1,activeCompanies:1,inactiveCompanies:0,totalAppointments:1})};
      if(path==='/api/platform/companies')return {ok:true,json:async()=>({companies:[company]})};
      if(path==='/api/platform/companies/company-a/reminders'){
        reminderPayload=JSON.parse(String(init?.body));
        return {ok:true,json:async()=>({company:{...company,reminders:{enabled:true,offsets:[1440,60]},messageTemplates:[{type:'REMINDER',body:'Oi {{customerName}}'}]}})};
      }
      if(path==='/api/platform/companies/company-a')return {ok:true,json:async()=>({company})};
      throw new Error(`Unexpected request: ${path}`);
    });
    vi.stubGlobal('fetch',fetchMock);
    render(<PlatformAdmin/>);
    const user=userEvent.setup();
    await user.click(await screen.findByRole('button',{name:'Gerenciar empresas'}));
    await user.click(screen.getByRole('button',{name:'Configurar'}));
    await user.click(await screen.findByRole('button',{name:'Lembretes'}));
    await user.click(screen.getByLabelText('Ativar lembretes'));
    await user.click(screen.getByLabelText('24 horas antes'));
    await user.click(screen.getByLabelText('1 hora antes'));
    fireEvent.change(screen.getByLabelText('Mensagem do lembrete'),{target:{value:'Oi {{customerName}}'}});
    await user.click(screen.getByRole('button',{name:'Salvar lembretes'}));
    await waitFor(()=>expect(reminderPayload).toEqual({enabled:true,offsets:[1440,60],message:'Oi {{customerName}}'}));
    expect(await screen.findByText('Configuração de lembretes salva.')).toBeInTheDocument();
  });
});

import { render, screen, waitFor } from '@testing-library/react';
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
});

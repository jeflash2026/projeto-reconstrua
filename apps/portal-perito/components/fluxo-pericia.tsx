'use client';
// FLUXO DA PERÍCIA (Decreto 2026-07-24) — ações do perito por cliente:
//  • Baixar (unitário/lote) ⇒ inicia a perícia (10 dias) e move o cliente de aba;
//  • Adicionar credenciais (e-mail/senha/provedor do pedido administrativo);
//  • Adicionar a resposta do banco.
// O download do arquivo continua sendo pela rota-proxy (Bearer server-side).
import { useState, type ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import {
  iniciarPericia,
  iniciarPericiaTodos,
  salvarCredenciais,
  salvarRespostaBanco,
} from '../lib/actions';
import type { ClienteComHiscon } from '../lib/api';

function baixar(url: string): void {
  const a = document.createElement('a');
  a.href = url;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** Unitário: baixa o PACOTE COMPLETO do cliente (planilha do guia v2 + os
 *  documentos do pedido administrativo — procuração assinada, RG, comprovante
 *  e os originais) e inicia a perícia (10 dias). Decreto 2026-08-04: o CSV
 *  descia sozinho e o perito ficava sem os documentos para protocolar. */
export function BaixarEIniciar({ c }: { c: ClienteComHiscon }): ReactElement {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const acao = async (): Promise<void> => {
    if (busy) return;
    setBusy(true);
    await iniciarPericia(c.chatId, c.clienteId, c.quem);
    baixar(`/perito/api/pacote/${encodeURIComponent(c.clienteId)}`);
    router.refresh();
    setBusy(false);
  };
  return (
    <button className="btn primary" disabled={busy} onClick={() => void acao()}>
      {busy ? 'Baixando…' : 'Baixar pacote (planilha + documentos) e iniciar'}
    </button>
  );
}

/** Lote: baixa o .zip de todos os aguardando e inicia a perícia de todos. */
export function BaixarTodosEIniciar({
  aguardando,
}: {
  aguardando: readonly ClienteComHiscon[];
}): ReactElement {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const acao = async (): Promise<void> => {
    if (busy || aguardando.length === 0) return;
    setBusy(true);
    await iniciarPericiaTodos(
      aguardando.map((c) => ({ chatId: c.chatId, clienteId: c.clienteId, quem: c.quem })),
    );
    baixar('/perito/api/planilhas-zip');
    router.refresh();
    setBusy(false);
  };
  return (
    <button
      className="btn primary"
      disabled={busy || aguardando.length === 0}
      onClick={() => void acao()}
    >
      {busy ? 'Baixando…' : `Baixar TODOS e iniciar perícia (${String(aguardando.length)} · .zip)`}
    </button>
  );
}

/** Credenciais do pedido administrativo: e-mail, senha e provedor/site. */
export function CredenciaisForm({
  chatId,
  atual,
}: {
  chatId: string;
  atual: { email: string; senha: string; provedor: string } | null;
}): ReactElement {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [email, setEmail] = useState(atual?.email ?? '');
  const [senha, setSenha] = useState(atual?.senha ?? '');
  const [provedor, setProvedor] = useState(atual?.provedor ?? '');
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const salvar = async (): Promise<void> => {
    if (busy) return;
    if (email.trim() === '' || senha.trim() === '' || provedor.trim() === '') {
      setErro('Preencha e-mail, senha e provedor.');
      return;
    }
    setBusy(true);
    setErro(null);
    const r = await salvarCredenciais(chatId, email.trim(), senha.trim(), provedor.trim());
    if (!r.ok) {
      setErro('Falha ao salvar.');
      setBusy(false);
      return;
    }
    setAberto(false);
    router.refresh();
    setBusy(false);
  };

  if (!aberto) {
    return (
      <button
        className="btn"
        onClick={() => {
          setAberto(true);
        }}
      >
        {atual ? 'Editar credenciais' : 'Adicionar credenciais'}
      </button>
    );
  }
  return (
    <div
      className="form-row"
      style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6, maxWidth: 360 }}
    >
      <input
        placeholder="Provedor / site (ex.: Meu INSS, gov.br)"
        value={provedor}
        onChange={(e) => {
          setProvedor(e.target.value);
        }}
      />
      <input
        placeholder="E-mail criado"
        value={email}
        onChange={(e) => {
          setEmail(e.target.value);
        }}
      />
      <input
        placeholder="Senha"
        value={senha}
        onChange={(e) => {
          setSenha(e.target.value);
        }}
      />
      <div className="form-row" style={{ gap: 6 }}>
        <button className="btn primary" disabled={busy} onClick={() => void salvar()}>
          {busy ? 'Salvando…' : 'Salvar credenciais'}
        </button>
        <button
          className="btn"
          disabled={busy}
          onClick={() => {
            setAberto(false);
          }}
        >
          Cancelar
        </button>
      </div>
      {erro !== null ? <span className="error-box">{erro}</span> : null}
    </div>
  );
}

/** Resposta do banco ao pedido administrativo. */
export function RespostaBancoForm({
  chatId,
  atual,
}: {
  chatId: string;
  atual: { texto: string; registradaEm: string } | null;
}): ReactElement {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState(atual?.texto ?? '');
  const [busy, setBusy] = useState(false);

  const salvar = async (): Promise<void> => {
    if (busy || texto.trim() === '') return;
    setBusy(true);
    const r = await salvarRespostaBanco(chatId, texto.trim());
    if (r.ok) {
      setAberto(false);
      router.refresh();
    }
    setBusy(false);
  };

  if (!aberto) {
    return (
      <button
        className="btn"
        onClick={() => {
          setAberto(true);
        }}
      >
        {atual ? 'Editar resposta do banco' : 'Adicionar resposta do banco'}
      </button>
    );
  }
  return (
    <div
      className="form-row"
      style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6, maxWidth: 420 }}
    >
      <textarea
        rows={3}
        placeholder="Cole aqui a resposta do banco ao pedido administrativo."
        value={texto}
        onChange={(e) => {
          setTexto(e.target.value);
        }}
      />
      <div className="form-row" style={{ gap: 6 }}>
        <button className="btn primary" disabled={busy} onClick={() => void salvar()}>
          {busy ? 'Salvando…' : 'Salvar resposta'}
        </button>
        <button
          className="btn"
          disabled={busy}
          onClick={() => {
            setAberto(false);
          }}
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

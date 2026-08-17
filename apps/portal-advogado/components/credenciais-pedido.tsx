'use client';
// CREDENCIAIS DO PEDIDO ADMINISTRATIVO (decisão do dono, 2026-08-13) — o e-mail
// e a senha da caixa por onde o banco responde ao pedido do cliente.
//
// Antes elas paravam no Admin: o advogado via o prazo de 10 dias vencer e não
// tinha como abrir a caixa para buscar a resposta. Agora seguem com o caso.
//
// A senha NÃO vem no carregamento da página: ela só é buscada quando o advogado
// pede. Isso evita o pior cenário de vazamento — a senha visível numa tela
// aberta ao lado de outra pessoa, ou num print de outra coisa. Cada revelação
// fica registrada no servidor (quem, qual pedido, quando).
import { useState, type ReactElement } from 'react';

interface Credenciais {
  email: string;
  senha: string;
  provedor: string;
}

export default function CredenciaisPedido({ missionId }: { missionId: string }): ReactElement {
  const [cred, setCred] = useState<Credenciais | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function revelar(): Promise<void> {
    setErro(null);
    setBusy(true);
    try {
      const res = await fetch(`/advogado/api/credenciais/${encodeURIComponent(missionId)}`, {
        cache: 'no-store',
      });
      const dados = (await res.json()) as { credenciais?: Credenciais; error?: string };
      if (!res.ok || dados.credenciais === undefined) {
        setErro(dados.error ?? 'não foi possível obter as credenciais');
        return;
      }
      setCred(dados.credenciais);
    } catch {
      setErro('falha de rede — tente de novo');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <h3 style={{ marginTop: 0 }}>Credenciais do pedido administrativo</h3>
      <p className="page-sub" style={{ marginTop: 0 }}>
        A caixa de e-mail por onde o banco responde a este pedido. Use para buscar a resposta e
        juntá-la ao processo.
      </p>
      {cred === null ? (
        <>
          <button className="btn primary" disabled={busy} onClick={() => void revelar()}>
            {busy ? 'Buscando…' : 'Mostrar credenciais'}
          </button>
          <p className="page-sub" style={{ marginTop: 8, marginBottom: 0 }}>
            A senha aparece só depois deste clique, e o acesso fica registrado.
          </p>
        </>
      ) : (
        <div className="mono" style={{ fontSize: 13, lineHeight: 1.9 }}>
          <div>
            <strong>Site:</strong> {cred.provedor}
          </div>
          <div>
            <strong>E-mail:</strong> {cred.email}
          </div>
          <div>
            <strong>Senha:</strong> {cred.senha}
          </div>
        </div>
      )}
      {erro !== null ? (
        <div className="error-box" style={{ marginTop: 8 }}>
          {erro}
        </div>
      ) : null}
    </div>
  );
}

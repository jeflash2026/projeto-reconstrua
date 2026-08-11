'use client';
// TRANSFERÊNCIA DE NÚMERO (2026-08-11) — o cliente trocou de chip e quer
// continuar o MESMO atendimento (caso Maria da Piedade Roza). Duas etapas:
// primeiro a PRÉVIA (só leitura, mostra o que vai se mover), depois a troca com
// confirmação. Nenhuma mensagem é enviada ao cliente.
import { useState, type ReactElement } from 'react';
import {
  previaTransferenciaNumero,
  transferirNumero,
  type PreviaTransferencia,
} from '../lib/actions';

function soDigitos(v: string): string {
  return v.replace(/\D/g, '');
}

export default function TransferenciaNumero(): ReactElement {
  const [origem, setOrigem] = useState('');
  const [destino, setDestino] = useState('');
  const [previa, setPrevia] = useState<PreviaTransferencia | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const validos = soDigitos(origem).length >= 12 && soDigitos(destino).length >= 12;

  async function verificar(): Promise<void> {
    setErro(null);
    setAviso(null);
    setPrevia(null);
    setBusy(true);
    const r = await previaTransferenciaNumero(origem.trim(), destino.trim());
    setBusy(false);
    if (r === null) {
      setErro('API indisponível (ou ainda sem o deploy desta versão).');
      return;
    }
    setPrevia(r);
  }

  async function transferir(): Promise<void> {
    if (previa === null) return;
    if (
      !window.confirm(
        `Transferir o atendimento de ${previa.origem} para ${previa.destino}? ${previa.linhasOrigem} registro(s) mudam de número. O estado anterior fica guardado.`,
      )
    )
      return;
    setErro(null);
    setBusy(true);
    const r = await transferirNumero(origem.trim(), destino.trim());
    setBusy(false);
    if (!r.ok) {
      setErro(r.error ?? 'falha na transferência');
      return;
    }
    setAviso(
      `Pronto: ${r.linhasMovidas ?? 0} registro(s) agora pertencem ao número novo. A cliente segue com o mesmo cadastro e histórico.`,
    );
    setPrevia(null);
  }

  return (
    <>
      <div className="card" style={{ marginBottom: 16 }}>
        <h3>Números</h3>
        <p className="page-sub">
          Use o número completo com DDI e DDD, como aparece no painel (ex.: 553182232880). Tudo o
          que era do número antigo — conversa, CPF, HISCON, documentos, confirmação e cadastro —
          passa a ser do novo.
        </p>
        <div className="form-row" style={{ flexWrap: 'wrap', gap: 8 }}>
          <input
            type="text"
            placeholder="Número atual (de onde sai)"
            value={origem}
            autoComplete="off"
            onChange={(e) => {
              setOrigem(e.target.value);
              setPrevia(null);
            }}
          />
          <input
            type="text"
            placeholder="Número novo (para onde vai)"
            value={destino}
            autoComplete="off"
            onChange={(e) => {
              setDestino(e.target.value);
              setPrevia(null);
            }}
          />
          <button disabled={busy || !validos} onClick={() => void verificar()}>
            Verificar
          </button>
        </div>
        {erro !== null ? <div className="error-box">{erro}</div> : null}
        {aviso !== null ? (
          <div className="badge ok" style={{ marginTop: 8 }}>
            {aviso}
          </div>
        ) : null}
      </div>

      {previa !== null ? (
        <div className="card">
          <h3>O que vai se mover</h3>
          <p className="page-sub">
            De <span className="mono">{previa.origem}</span> para{' '}
            <span className="mono">{previa.destino}</span> — {previa.linhasOrigem} registro(s), dos
            quais {previa.mensagens} mensagem(ns) de conversa.
            {previa.linhasDestino > 0
              ? ` O número novo já tinha ${previa.linhasDestino} registro(s): o atendimento antigo prevalece, e o estado anterior fica guardado.`
              : ''}
          </p>
          {previa.podeTransferir ? (
            <>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Onde</th>
                      <th>Registros</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previa.grupos.map((g) => (
                      <tr key={g.namespace}>
                        <td className="mono">{g.namespace}</td>
                        <td>{g.linhas}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                className="primary"
                style={{ marginTop: 12 }}
                disabled={busy}
                onClick={() => void transferir()}
              >
                Transferir atendimento
              </button>
            </>
          ) : (
            <div className="error-box">
              Não dá para transferir: {previa.motivo ?? 'nada encontrado'}. Confira se o número de
              origem está exatamente como aparece no painel.
            </div>
          )}
        </div>
      ) : null}
    </>
  );
}

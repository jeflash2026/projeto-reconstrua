'use client';
// 15C-2 · TELA 2 — ações da solicitação: Reabrir, Cancelar, Copiar link do
// documento. Confirmação inline (motivo obrigatório) e feedback imediato.
import { useState, useTransition, type ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import type { Solicitacao } from '../lib/api';
import { cancelarSolicitacao, reabrirSolicitacao } from '../lib/actions';

const SolicitacaoAcoes = ({ s }: { s: Solicitacao }): ReactElement => {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [modo, setModo] = useState<'nenhum' | 'reabrir' | 'cancelar'>('nenhum');
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  const aberta =
    s.status === 'PENDING' || s.status === 'REOPENED' || s.status === 'AWAITING_CONFIRMATION';

  const executar = (): void => {
    if (motivo.trim() === '') {
      setErro('Descreva o motivo — ele fica registrado no histórico.');
      return;
    }
    setErro(null);
    iniciar(() => {
      // Transition síncrona + IIFE async (tipagens React 18 e 19).
      void (async () => {
        const r =
          modo === 'reabrir'
            ? await reabrirSolicitacao(s.requestId, motivo.trim())
            : await cancelarSolicitacao(s.requestId, motivo.trim());
        if (!r.ok) {
          setErro(r.error);
          return;
        }
        setModo('nenhum');
        setMotivo('');
        router.refresh();
      })();
    });
  };

  const copiarLink = (): void => {
    if (s.fulfilledBy === null) return;
    void navigator.clipboard.writeText(
      `${window.location.origin}/solicitacoes/doc/${encodeURIComponent(s.caseId)}/${encodeURIComponent(s.fulfilledBy)}`,
    );
    setCopiado(true);
    window.setTimeout(() => {
      setCopiado(false);
    }, 2000);
  };

  return (
    <div className="sol-acoes">
      {s.fulfilledBy !== null ? (
        <>
          <a
            className="sol-btn sol-btn-primario"
            href={`/solicitacoes/doc/${encodeURIComponent(s.caseId)}/${encodeURIComponent(s.fulfilledBy)}`}
            target="_blank"
            rel="noreferrer"
          >
            Abrir documento
          </a>
          <button className="sol-btn" onClick={copiarLink}>
            {copiado ? 'Link copiado ✓' : 'Copiar link do documento'}
          </button>
        </>
      ) : null}
      {s.status === 'RECEIVED' ? (
        <button
          className="sol-btn sol-btn-atencao"
          onClick={() => {
            setModo(modo === 'reabrir' ? 'nenhum' : 'reabrir');
            setErro(null);
          }}
          disabled={pendente}
        >
          Reabrir
        </button>
      ) : null}
      {aberta ? (
        <button
          className="sol-btn sol-btn-perigo"
          onClick={() => {
            setModo(modo === 'cancelar' ? 'nenhum' : 'cancelar');
            setErro(null);
          }}
          disabled={pendente}
        >
          Cancelar
        </button>
      ) : null}

      {modo !== 'nenhum' ? (
        <div className="sol-confirma">
          <p className="sol-confirma-titulo">
            {modo === 'reabrir'
              ? 'Reabrir esta solicitação? A AHRI voltará a pedir o documento ao cliente. O histórico é preservado.'
              : 'Cancelar esta solicitação? A AHRI deixará de cobrar o cliente.'}
          </p>
          <input
            className="sol-input"
            placeholder={
              modo === 'reabrir'
                ? 'Motivo (ex.: documento sem assinatura)'
                : 'Motivo do cancelamento'
            }
            value={motivo}
            onChange={(e) => {
              setMotivo(e.target.value);
            }}
            autoFocus
          />
          {erro ? <p className="sol-erro">{erro}</p> : null}
          <div className="sol-confirma-botoes">
            <button
              className={`sol-btn ${modo === 'reabrir' ? 'sol-btn-atencao' : 'sol-btn-perigo'}`}
              onClick={executar}
              disabled={pendente}
            >
              {pendente
                ? 'Enviando…'
                : modo === 'reabrir'
                  ? 'Confirmar reabertura'
                  : 'Confirmar cancelamento'}
            </button>
            <button
              className="sol-btn"
              onClick={() => {
                setModo('nenhum');
                setErro(null);
              }}
              disabled={pendente}
            >
              Voltar
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default SolicitacaoAcoes;

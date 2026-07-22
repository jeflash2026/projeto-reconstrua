'use client';
// JORNADA A (R4) + JORNADA B (B-R4) — os atos do Admin, direto na lista única:
// definir a MODALIDADE (VENDA | SOCIEDADE), VENDER (comprador + confirmação) e
// ESCOLHER O SÓCIO quando o prazo administrativo venceu (AGUARDANDO_SOCIO) —
// reutilizando INTEGRALMENTE o assignCase existente (BL-3.4; Regra 3). Nenhum
// caminho paralelo de escrita. Padrão de EncerrarForm/AssignForm.
import { useState, type ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import { assignCase, definirModalidade, venderCliente } from '../lib/actions';
import type { ClienteStatus } from '../lib/api';

export interface AdvogadoOption {
  readonly id: string;
  readonly name: string;
}

const JornadaAcoes = ({
  clienteId,
  missionId,
  status,
  advogados,
}: {
  clienteId: string;
  missionId: string | null;
  status: ClienteStatus;
  advogados: readonly AdvogadoOption[];
}): ReactElement | null => {
  const router = useRouter();
  const [comprador, setComprador] = useState('');
  const [advogadoId, setAdvogadoId] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const decidir = async (modalidade: 'VENDA' | 'SOCIEDADE'): Promise<void> => {
    if (busy) return;
    setBusy(true);
    setErro(null);
    const result = await definirModalidade(clienteId, modalidade);
    if (result) router.refresh();
    else setErro('Falha ao definir a modalidade.');
    setBusy(false);
  };

  const vender = async (): Promise<void> => {
    if (busy) return;
    setBusy(true);
    setErro(null);
    const result = await venderCliente(clienteId, comprador.trim());
    if (result && result.vendido) {
      setConfirming(false);
      router.refresh();
    } else {
      setErro('Falha ao vender (o caso continua pronto?).');
    }
    setBusy(false);
  };

  if (status === 'PRONTO_AGUARDANDO_MODALIDADE') {
    return (
      <div className="form-row" style={{ margin: 0 }}>
        <button
          className="primary"
          disabled={busy}
          onClick={() => {
            void decidir('VENDA');
          }}
        >
          Venda
        </button>
        <button
          disabled={busy}
          onClick={() => {
            void decidir('SOCIEDADE');
          }}
        >
          Sociedade
        </button>
        {erro ? <span style={{ color: 'var(--text-dim)' }}>{erro}</span> : null}
      </div>
    );
  }

  if (status === 'AGUARDANDO_SOCIO') {
    const atribuir = async (): Promise<void> => {
      if (busy || missionId === null || advogadoId === '') return;
      setBusy(true);
      setErro(null);
      const result = await assignCase(missionId, advogadoId, 'admin');
      if (result)
        router.refresh(); // status vira EM_PROCESSO por derivação
      else setErro('Falha ao atribuir (servidor do Advogado configurado?).');
      setBusy(false);
    };
    if (advogados.length === 0) {
      return <span style={{ color: 'var(--text-dim)' }}>cadastre um advogado em Advogados</span>;
    }
    return (
      <div className="form-row" style={{ margin: 0 }}>
        <select
          value={advogadoId}
          onChange={(e) => {
            setAdvogadoId(e.target.value);
          }}
        >
          <option value="">Escolher sócio…</option>
          {advogados.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        <button
          className="primary"
          disabled={busy || advogadoId === '' || missionId === null}
          onClick={() => {
            void atribuir();
          }}
        >
          Atribuir sócio
        </button>
        {erro ? <span style={{ color: 'var(--text-dim)' }}>{erro}</span> : null}
      </div>
    );
  }

  if (status === 'PRONTO_AGUARDANDO_VENDA') {
    return (
      <div className="form-row" style={{ margin: 0 }}>
        <input
          type="text"
          placeholder="Advogado/escritório comprador"
          value={comprador}
          onChange={(e) => {
            setComprador(e.target.value);
          }}
        />
        {confirming ? (
          <>
            <button
              className="primary"
              disabled={busy || comprador.trim() === ''}
              onClick={() => {
                void vender();
              }}
            >
              Confirmar venda
            </button>
            <button
              disabled={busy}
              onClick={() => {
                setConfirming(false);
              }}
            >
              Cancelar
            </button>
          </>
        ) : (
          <button
            className="primary"
            disabled={busy || comprador.trim() === ''}
            onClick={() => {
              setConfirming(true);
              setErro(null);
            }}
          >
            Vender
          </button>
        )}
        {erro ? <span style={{ color: 'var(--text-dim)' }}>{erro}</span> : null}
      </div>
    );
  }

  return null; // demais status não têm ato do Admin nesta jornada
};

export default JornadaAcoes;

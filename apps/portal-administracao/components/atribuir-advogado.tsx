'use client';
// Decreto Tráfego Pago — atribuição de cliente pronto a um advogado da equipe.
// Reusa assignCase (BL-3.4) — a mesma op.work.assign; a rota agora também faz a
// AHRI avisar o advogado no canal cadastrado.
import { useState, useTransition, type ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import { assignCase, type ClientePronto } from '../lib/actions';

const AtribuirAdvogado = ({
  prontos,
  advogados,
}: {
  prontos: ClientePronto[];
  advogados: { id: string; name: string }[];
}): ReactElement => {
  const router = useRouter();
  const [escolhas, setEscolhas] = useState<Record<string, string>>({});
  const [resultado, setResultado] = useState<Record<string, string>>({});
  const [pendente, iniciar] = useTransition();

  const atribuir = (missionId: string): void => {
    const advogadoId = escolhas[missionId] ?? '';
    if (advogadoId === '') {
      setResultado((r) => ({ ...r, [missionId]: 'Escolha um advogado primeiro.' }));
      return;
    }
    iniciar(() => {
      // Transition síncrona + IIFE async (tipagens React 18 e 19).
      void (async () => {
        const r = await assignCase(missionId, advogadoId, 'administrador');
        if (r === null) {
          setResultado((s) => ({ ...s, [missionId]: 'Falha na atribuição — tente novamente.' }));
          return;
        }
        const aviso =
          r.aviso === 'enviado'
            ? 'Atribuído — a AHRI avisou o advogado no WhatsApp dele. ✅'
            : r.aviso === 'sem-canal'
              ? 'Atribuído — mas o advogado ainda NÃO cadastrou o WhatsApp no perfil dele (sem aviso).'
              : 'Atribuído — o aviso ao advogado falhou (ver logs).';
        setResultado((s) => ({ ...s, [missionId]: aviso }));
        router.refresh();
      })();
    });
  };

  return (
    <div className="card">
      <table className="table">
        <thead>
          <tr>
            <th>Cliente</th>
            <th>Status</th>
            <th>Advogado</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {prontos.map((c) => (
            <tr key={c.missionId}>
              <td>
                <strong>{c.nome}</strong>
                <div className="mono" style={{ fontSize: 12, opacity: 0.7 }}>
                  {c.chatId.split('@')[0]}
                </div>
              </td>
              <td>
                {/* Decreto 2026-08-04 (noite): a documentação completa LIBERA
                    já; os 10 dias são só INFORMATIVOS — pedido feito dia X →
                    contagem regressiva → luz verde ao expirar. */}
                <span className="badge accent">
                  {c.status === 'DOC_COMPLETA'
                    ? '✅ documentação completa — liberado'
                    : c.status === 'AGUARDANDO_10_DIAS'
                      ? 'prazo de 10 dias em curso'
                      : 'aguardando sócio'}
                </span>
                <div style={{ fontSize: 12, marginTop: 4, opacity: 0.85 }}>
                  {c.pericia == null ? (
                    <span>pedido administrativo ainda não feito pelo perito</span>
                  ) : c.pericia.expirado ? (
                    <span style={{ color: '#39d98a', fontWeight: 600 }}>
                      🟢 pedido feito em{' '}
                      {new Date(c.pericia.iniciadaEm).toLocaleDateString('pt-BR')} — prazo de 10
                      dias EXPIRADO, luz verde para o advogado assumir
                    </span>
                  ) : (
                    <span>
                      ⏳ pedido feito em{' '}
                      {new Date(c.pericia.iniciadaEm).toLocaleDateString('pt-BR')} — faltam{' '}
                      {Math.floor(c.pericia.horasRestantes / 24)}d {c.pericia.horasRestantes % 24}h
                      para o prazo de 10 dias expirar
                    </span>
                  )}
                </div>
              </td>
              <td>
                <select
                  className="sol-input"
                  value={escolhas[c.missionId] ?? ''}
                  onChange={(e) => {
                    setEscolhas((s) => ({ ...s, [c.missionId]: e.target.value }));
                  }}
                >
                  <option value="">Escolher advogado…</option>
                  {advogados.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </td>
              <td>
                <button
                  className="btn"
                  onClick={() => {
                    atribuir(c.missionId);
                  }}
                  disabled={pendente}
                >
                  {pendente ? 'Encaminhando…' : 'Encaminhar'}
                </button>
                {resultado[c.missionId] ? (
                  <div style={{ fontSize: 12, marginTop: 4 }}>{resultado[c.missionId]}</div>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default AtribuirAdvogado;

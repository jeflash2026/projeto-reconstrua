'use client';
// BOTÃO DO DISPARO (2026-08-06; lote + escopo em 2026-08-11) — decreto do
// dono: nada automático; o lote só sai daqui, com confirmação explícita. Com o
// template documentos_pendentes APROVADO, a cobrança passa a alcançar TODOS os
// clientes da mesa com documentação incompleta (não só os marcados como
// "aguardando devolução") — o ritual é um clique por dia.
import { useState, type ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import { dispararApresentacaoHumanizado } from '../lib/actions';

const DispararApresentacao = ({
  elegiveis,
  semRetorno,
  uf = null,
}: {
  /** Todos os incompletos elegíveis do recorte (fora os disparados nas 24h). */
  elegiveis: number;
  /** Quantos deles são a fila clássica: documentação enviada e sem retorno. */
  semRetorno: number;
  /** Recorte por ESTADO (2026-08-07): null = fila inteira. */
  uf?: string | null;
}): ReactElement => {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [limite, setLimite] = useState('60');
  const [apenasSemRetorno, setApenasSemRetorno] = useState(false);
  const [resultado, setResultado] = useState<{
    enviados: number;
    falhas: { nome: string; erro: string }[];
  } | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const universo = apenasSemRetorno ? semRetorno : elegiveis;
  const alvo = Math.min(universo, Math.max(1, Number(limite) || 60));

  const disparar = async (): Promise<void> => {
    const confirmado = window.confirm(
      `Disparar a mensagem da Layara para ${String(alvo)} cliente(s)${uf !== null ? ` de ${uf}` : ''}?\n\n` +
        `Escopo: ${apenasSemRetorno ? 'só quem está sem retorno após o envio da documentação' : 'todos os clientes da mesa com documentação incompleta'}.\n\n` +
        'Cada um recebe UMA mensagem — quem entregou parte recebe a cobrança SÓ do que falta (documentos_pendentes); quem não entregou nada recebe a apresentação. Fica de fora automaticamente quem já recebeu template nas últimas 24h e quem escreveu no último dia.',
    );
    if (!confirmado) return;
    setBusy(true);
    setErro(null);
    setResultado(null);
    try {
      const r = await dispararApresentacaoHumanizado(uf ?? undefined, alvo, apenasSemRetorno);
      if (r === null) setErro('falha no disparo — a API não respondeu; confira e tente de novo');
      else {
        setResultado(r);
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="form-row" style={{ flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-dim)' }}>
          Tamanho do lote:{' '}
          <input
            type="number"
            min={1}
            max={300}
            value={limite}
            onChange={(e) => setLimite(e.target.value)}
            style={{ width: 80 }}
          />
        </label>
        <label
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--text-dim)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <input
            type="checkbox"
            checked={apenasSemRetorno}
            onChange={(e) => setApenasSemRetorno(e.target.checked)}
          />
          só quem está sem retorno ({semRetorno})
        </label>
        <button
          type="button"
          className="primary"
          disabled={busy || universo === 0}
          onClick={() => void disparar()}
        >
          {busy
            ? 'Disparando… (ritmo suave, aguarde)'
            : `📣 Disparar para ${String(alvo)} cliente(s)${uf !== null ? ` de ${uf}` : ''}`}
        </button>
      </div>
      <p className="page-sub" style={{ margin: '6px 0 0' }}>
        Ritual diário: quem já recebeu template nas últimas 24h e quem escreveu no último dia ficam
        fora sozinhos — a secretária está no caso deles.
      </p>
      {erro !== null ? <div className="error-box">{erro}</div> : null}
      {resultado !== null ? (
        <div className="card" style={{ marginTop: 10 }}>
          <strong>{resultado.enviados} enviada(s) com sucesso.</strong>
          {resultado.falhas.length > 0 ? (
            <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: 13 }}>
              {resultado.falhas.map((f, i) => (
                <li key={i}>
                  {f.nome} — {f.erro}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

export default DispararApresentacao;

'use client';
// BOTÃO DO REAQUECIMENTO FASE 1 (2026-08-07; UF + limite em 2026-08-09, pós-
// desbloqueio) — decreto do dono: nada automático; o lote só sai daqui, com
// confirmação explícita. O template sai pelo número OFICIAL da AHRI; quando o
// lead responde, o funil retoma sozinho de onde parou.
import { useState, type ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import { dispararReaquecimentoFase1 } from '../lib/actions';

const DispararFase1 = ({
  elegiveis,
  uf,
}: {
  elegiveis: number;
  /** UF escolhida nos chips da fila (null = todos os estados). */
  uf: string | null;
}): ReactElement => {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [limite, setLimite] = useState('30');
  const [resultado, setResultado] = useState<{
    enviados: number;
    falhas: { nome: string; erro: string }[];
  } | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const alvo = Math.min(elegiveis, Math.max(1, Number(limite) || 30));

  const disparar = async (): Promise<void> => {
    const confirmado = window.confirm(
      `Reaquecer ${String(alvo)} lead(s) da FASE 1${uf !== null ? ` de ${uf}` : ' (todos os estados)'}?\n\nCada lead recebe UMA mensagem (template reaquecimento_fase1 pelo número oficial da AHRI); quem já recebeu nas últimas 24h fica fora. A conta acabou de sair de uma restrição — mantenha lotes pequenos.`,
    );
    if (!confirmado) return;
    setBusy(true);
    setErro(null);
    setResultado(null);
    try {
      const r = await dispararReaquecimentoFase1(uf ?? undefined, alvo);
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
      <div className="form-row" style={{ flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-dim)' }}>
          Tamanho do lote:{' '}
          <input
            type="number"
            min={1}
            max={200}
            value={limite}
            onChange={(e) => setLimite(e.target.value)}
            style={{ width: 80 }}
          />
        </label>
        <button
          type="button"
          className="primary"
          disabled={busy || elegiveis === 0}
          onClick={() => void disparar()}
        >
          {busy
            ? 'Reaquecendo… (ritmo suave, aguarde)'
            : `🔥 Reaquecer ${String(alvo)} lead(s)${uf !== null ? ` de ${uf}` : ''}`}
        </button>
      </div>
      <p className="page-sub" style={{ margin: '6px 0 0' }}>
        Conta recém-desbloqueada: comece com lotes de 20–30 por dia e aumente aos poucos conforme a
        qualidade se mantiver verde no Gerenciador da Meta.
      </p>
      {erro !== null ? <div className="error-box">{erro}</div> : null}
      {resultado !== null ? (
        <div className="card" style={{ marginTop: 10 }}>
          <strong>{resultado.enviados} enviada(s) com sucesso.</strong>
          {resultado.falhas.length > 0 ? (
            <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: 13 }}>
              {resultado.falhas.slice(0, 20).map((f, i) => (
                <li key={i}>
                  {f.nome} — {f.erro}
                </li>
              ))}
              {resultado.falhas.length > 20 ? (
                <li>… e mais {resultado.falhas.length - 20} falha(s)</li>
              ) : null}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

export default DispararFase1;

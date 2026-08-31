'use client';
// HISCON EM LOTE por advogado (2026-08-31) — o dono escolhe o advogado, baixa
// o ZIP com todos os HISCONs dos clientes JÁ ATRIBUÍDOS a ele, ou gera um link
// tokenizado (7 dias) para repassar. O link é público mas assinado — só abre o
// pacote daquele advogado, e morre sozinho no vencimento.
import { useEffect, useState, type ReactElement } from 'react';
import {
  gerarLinkHiscons,
  listarAdvogadosHisconLote,
  type AdvogadoHisconLote,
  type LinkHisconsResultado,
} from '../lib/actions';

export default function HisconLote(): ReactElement {
  const [advogados, setAdvogados] = useState<AdvogadoHisconLote[] | null>(null);
  const [advogadoId, setAdvogadoId] = useState('');
  const [link, setLink] = useState<LinkHisconsResultado | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void listarAdvogadosHisconLote().then(setAdvogados);
  }, []);

  async function gerar(): Promise<void> {
    if (advogadoId === '') return;
    setBusy(true);
    setLink(null);
    setCopiado(false);
    setLink(await gerarLinkHiscons(advogadoId));
    setBusy(false);
  }

  async function copiar(): Promise<void> {
    if (!link?.url) return;
    try {
      await navigator.clipboard.writeText(link.url);
      setCopiado(true);
    } catch {
      /* clipboard bloqueado: o campo continua selecionável à mão */
    }
  }

  const escolhido = advogados?.find((a) => a.id === advogadoId) ?? null;

  return (
    <>
      <div className="card" style={{ marginBottom: 16 }}>
        <h3>Advogado</h3>
        {advogados === null ? (
          <div className="empty">Carregando advogados…</div>
        ) : advogados.length === 0 ? (
          <div className="empty">Nenhum advogado ativo no cadastro.</div>
        ) : (
          <div className="form-row" style={{ flexWrap: 'wrap', gap: 8 }}>
            <select
              value={advogadoId}
              onChange={(e) => {
                setAdvogadoId(e.target.value);
                setLink(null);
                setCopiado(false);
              }}
            >
              <option value="">Escolha o advogado…</option>
              {advogados.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nome} — {a.clientes} cliente(s) atribuído(s)
                </option>
              ))}
            </select>
            <button
              disabled={advogadoId === '' || busy}
              onClick={() => {
                // basePath /admin: URL crua NÃO ganha o prefixo — manual.
                window.location.href = `/admin/api/hiscons-zip?advogadoId=${encodeURIComponent(advogadoId)}`;
              }}
            >
              Baixar ZIP agora
            </button>
            <button
              className="primary"
              disabled={advogadoId === '' || busy}
              onClick={() => void gerar()}
            >
              {busy ? 'Gerando…' : 'Gerar link para repassar'}
            </button>
          </div>
        )}
        {escolhido !== null && escolhido.clientes === 0 ? (
          <div className="error-box" style={{ marginTop: 8 }}>
            Este advogado ainda não tem clientes atribuídos — o pacote sairia vazio.
          </div>
        ) : null}
      </div>

      {link !== null ? (
        link.ok && link.url !== undefined ? (
          <div className="card">
            <h3>Link pronto</h3>
            <p className="page-sub">
              Vale por {link.validadeDias ?? 7} dias e baixa o pacote SÓ deste advogado, montado na
              hora do clique (clientes atribuídos naquele momento). {link.comHiscon ?? 0} HISCON(s)
              de {link.total ?? 0} cliente(s) atribuído(s).
            </p>
            <div className="form-row" style={{ flexWrap: 'wrap', gap: 8 }}>
              <input
                type="text"
                readOnly
                value={link.url}
                style={{ flex: 1, minWidth: 260 }}
                onFocus={(e) => e.target.select()}
              />
              <button onClick={() => void copiar()}>{copiado ? 'Copiado ✓' : 'Copiar link'}</button>
            </div>
            {link.faltantes !== undefined && link.faltantes.length > 0 ? (
              <p className="page-sub" style={{ marginTop: 8 }}>
                Sem HISCON disponível ({link.faltantes.length}): {link.faltantes.join('; ')}
              </p>
            ) : null}
          </div>
        ) : (
          <div className="error-box">{link.error ?? 'falha ao gerar o link'}</div>
        )
      ) : null}
    </>
  );
}

'use client';
// PAINEL CONVERSAS (pedido do dono, 2026-08-05) — a janela estilo WhatsApp do
// canal da equipe: lista de conversas com o NOME do cliente (a plataforma já
// sabe quem é cada número), busca, chat ao lado, e os PAINÉIS INTELIGENTES:
//  • Aguardando sua resposta — o cliente falou por último;
//  • Não lidas — mensagens novas desde a última abertura;
//  • Procuração enviada sem retorno (2+ dias) — a fila de COBRANÇA: a
//    secretária enviou a documentação e o cliente sumiu (entram aqui também
//    clientes da mesa que nem conversa no sistema têm ainda).
// Clicar num painel FILTRA a lista para exatamente aqueles casos.
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactElement } from 'react';
import type { ResumoChat } from '../lib/api';
import ChatConversa from './chat-conversa';

/** A fatia da mesa que o painel precisa (vem do server component). */
export interface ClienteDaMesa {
  chatId: string;
  nome: string;
  uf: string;
  completo: boolean;
  aguardandoAssinatura: boolean;
  aguardandoDesde: string | null;
  descartado: boolean;
}

type Filtro = 'todas' | 'aguardando' | 'nao-lidas' | 'cobranca';

const DOIS_DIAS_MS = 2 * 24 * 60 * 60 * 1000;

function horaCurta(iso: string | null): string {
  if (iso === null) return '';
  const d = new Date(iso);
  const hoje = new Date();
  return d.toDateString() === hoje.toDateString()
    ? d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function diasDeSilencio(ultimaEntradaEm: string | null, desde: string | null): number {
  const referencia = ultimaEntradaEm ?? desde;
  if (referencia === null) return 0;
  return Math.floor((Date.now() - new Date(referencia).getTime()) / (24 * 60 * 60 * 1000));
}

interface Linha {
  chatId: string;
  nome: string;
  telefone: string;
  uf: string;
  previa: string;
  ultimaEm: string | null;
  naoLidas: number;
  aguardandoResposta: boolean;
  emCobranca: boolean;
  diasSilencio: number;
  temConversa: boolean;
}

export default function ConversasPainel({ clientes }: { clientes: ClienteDaMesa[] }): ReactElement {
  const [conversas, setConversas] = useState<ResumoChat[]>([]);
  const [filtro, setFiltro] = useState<Filtro>('todas');
  // Filtro por ESTADO (pedido do dono, 2026-08-05): a secretária escolhe a UF
  // e a lista mostra só as conversas daquele estado — igual à mesa.
  const [uf, setUf] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [selecionado, setSelecionado] = useState<string | null>(null);

  const carregar = useCallback(async (): Promise<void> => {
    try {
      const res = await fetch('/humanizado/api/chat', { cache: 'no-store' });
      if (!res.ok) return;
      const data = (await res.json()) as { conversas?: ResumoChat[] };
      setConversas(data.conversas ?? []);
    } catch {
      /* rede piscou — a próxima rodada tenta */
    }
  }, []);

  useEffect(() => {
    void carregar();
    const timer = setInterval(() => void carregar(), 10000);
    return () => clearInterval(timer);
  }, [carregar]);

  const porChat = useMemo(() => new Map(clientes.map((c) => [c.chatId, c])), [clientes]);

  // A LISTA: toda conversa existente + clientes da mesa em COBRANÇA que ainda
  // nem têm conversa no sistema (o ponto do painel é ir atrás deles).
  const linhas = useMemo((): Linha[] => {
    const agora = Date.now();
    const vistos = new Set<string>();
    const out: Linha[] = [];
    for (const cv of conversas) {
      vistos.add(cv.chatId);
      const cliente = porChat.get(cv.chatId) ?? null;
      const ultimaEntradaEm = cv.ultimaEntradaEm ?? null;
      const silencioMs =
        ultimaEntradaEm !== null ? agora - new Date(ultimaEntradaEm).getTime() : Infinity;
      const emCobranca =
        cliente !== null &&
        cliente.aguardandoAssinatura &&
        !cliente.completo &&
        !cliente.descartado &&
        silencioMs > DOIS_DIAS_MS;
      out.push({
        chatId: cv.chatId,
        nome: cliente?.nome ?? cv.chatId.split('@')[0] ?? cv.chatId,
        telefone: cv.chatId.split('@')[0] ?? cv.chatId,
        uf: cliente?.uf || 'SEM UF',
        previa: cv.previa,
        ultimaEm: cv.ultimaEm,
        naoLidas: cv.naoLidas,
        aguardandoResposta: (cv.ultimaDirecao ?? null) === 'entrada',
        emCobranca,
        diasSilencio: diasDeSilencio(ultimaEntradaEm, cliente?.aguardandoDesde ?? null),
        temConversa: true,
      });
    }
    for (const c of clientes) {
      if (vistos.has(c.chatId)) continue;
      if (!(c.aguardandoAssinatura && !c.completo && !c.descartado)) continue;
      const desdeMs = c.aguardandoDesde !== null ? new Date(c.aguardandoDesde).getTime() : null;
      if (desdeMs !== null && agora - desdeMs <= DOIS_DIAS_MS) continue;
      out.push({
        chatId: c.chatId,
        nome: c.nome,
        telefone: c.chatId.split('@')[0] ?? c.chatId,
        uf: c.uf || 'SEM UF',
        previa: 'sem conversa no sistema ainda — inicie pelo template',
        ultimaEm: null,
        naoLidas: 0,
        aguardandoResposta: false,
        emCobranca: true,
        diasSilencio: diasDeSilencio(null, c.aguardandoDesde),
        temConversa: false,
      });
    }
    return out.sort((a, b) => (b.ultimaEm ?? '').localeCompare(a.ultimaEm ?? ''));
  }, [conversas, clientes, porChat]);

  const totais = useMemo(
    () => ({
      aguardando: linhas.filter((l) => l.aguardandoResposta).length,
      naoLidas: linhas.reduce((s, l) => s + l.naoLidas, 0),
      cobranca: linhas.filter((l) => l.emCobranca).length,
    }),
    [linhas],
  );

  // Contagem por UF (sobre a lista já filtrada pelos PAINÉIS — os chips mostram
  // o tamanho de cada fila dentro do recorte escolhido).
  const porUf = useMemo(() => {
    const base =
      filtro === 'aguardando'
        ? linhas.filter((l) => l.aguardandoResposta)
        : filtro === 'nao-lidas'
          ? linhas.filter((l) => l.naoLidas > 0)
          : filtro === 'cobranca'
            ? linhas.filter((l) => l.emCobranca)
            : linhas;
    const contagens = new Map<string, number>();
    for (const l of base) contagens.set(l.uf, (contagens.get(l.uf) ?? 0) + 1);
    return [...contagens.entries()].sort(([a], [b]) =>
      a === 'SEM UF' ? 1 : b === 'SEM UF' ? -1 : a.localeCompare(b),
    );
  }, [linhas, filtro]);

  const filtradas = useMemo(() => {
    let base = linhas;
    if (filtro === 'aguardando') base = base.filter((l) => l.aguardandoResposta);
    if (filtro === 'nao-lidas') base = base.filter((l) => l.naoLidas > 0);
    if (filtro === 'cobranca') base = base.filter((l) => l.emCobranca);
    if (uf !== null) base = base.filter((l) => l.uf === uf);
    const q = busca.trim().toLowerCase();
    const qDig = busca.replace(/\D/g, '');
    if (q !== '')
      base = base.filter(
        (l) => l.nome.toLowerCase().includes(q) || (qDig !== '' && l.telefone.includes(qDig)),
      );
    return base;
  }, [linhas, filtro, uf, busca]);

  const clienteSelecionado = selecionado !== null ? (porChat.get(selecionado) ?? null) : null;

  const paineis: readonly { chave: Filtro; valor: number; rotulo: string; dica: string }[] = [
    {
      chave: 'aguardando',
      valor: totais.aguardando,
      rotulo: 'Aguardando sua resposta',
      dica: 'O cliente falou por último — responda',
    },
    {
      chave: 'nao-lidas',
      valor: totais.naoLidas,
      rotulo: 'Mensagens não lidas',
      dica: 'Chegaram desde a última vez que você abriu a conversa',
    },
    {
      chave: 'cobranca',
      valor: totais.cobranca,
      rotulo: 'Procuração enviada sem retorno (2+ dias)',
      dica: 'Documentação enviada e o cliente sumiu — hora de cobrar',
    },
  ];

  return (
    <div>
      {/* ── PAINÉIS INTELIGENTES: clicar filtra a lista ─────────────────────── */}
      <div className="cv-paineis">
        {paineis.map((p) => (
          <button
            key={p.chave}
            type="button"
            className={`cv-painel ${p.chave}${filtro === p.chave ? ' ativo' : ''}`}
            title={p.dica}
            onClick={() => setFiltro(filtro === p.chave ? 'todas' : p.chave)}
          >
            <span className="cv-valor">{p.valor}</span>
            <span className="cv-rotulo">{p.rotulo}</span>
          </button>
        ))}
      </div>
      {filtro !== 'todas' ? (
        <div className="cv-filtro-aviso">
          Mostrando só: <strong>{paineis.find((p) => p.chave === filtro)?.rotulo}</strong>{' '}
          <button type="button" className="btn mini" onClick={() => setFiltro('todas')}>
            ver todas
          </button>
        </div>
      ) : null}

      {/* ── FILTRO POR ESTADO (pedido do dono): a mesma régua da mesa — a
          secretária escolhe a UF e a lista mostra só aquele estado ─────────── */}
      <div className="filtro-uf">
        <button
          type="button"
          className={`chip-uf${uf === null ? ' ativo' : ''}`}
          onClick={() => setUf(null)}
        >
          Todos <span className="chip-num">{porUf.reduce((s, [, n]) => s + n, 0)}</span>
        </button>
        {porUf.map(([sigla, quantos]) => (
          <button
            key={sigla}
            type="button"
            className={`chip-uf${uf === sigla ? ' ativo' : ''}`}
            onClick={() => setUf(uf === sigla ? null : sigla)}
          >
            {sigla} <span className="chip-num">{quantos}</span>
          </button>
        ))}
      </div>

      {/* ── DOIS PAINÉIS: lista à esquerda, conversa à direita ─────────────── */}
      <div className="cv-janela">
        <aside className="cv-lista">
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar cliente por nome ou telefone…"
            aria-label="Buscar conversa"
          />
          <div className="cv-itens">
            {filtradas.length === 0 ? (
              <div className="empty" style={{ padding: 16 }}>
                {filtro === 'todas' && busca === ''
                  ? 'Nenhuma conversa ainda — elas nascem quando um cliente escreve para o número da equipe ou quando você inicia pelo template.'
                  : 'Nada neste filtro.'}
              </div>
            ) : (
              filtradas.map((l) => (
                <button
                  key={l.chatId}
                  type="button"
                  className={`cv-item${selecionado === l.chatId ? ' ativo' : ''}`}
                  onClick={() => setSelecionado(l.chatId)}
                >
                  <div className="cv-item-topo">
                    <span className="cv-nome">{l.nome}</span>
                    <span className="cv-hora">{horaCurta(l.ultimaEm)}</span>
                  </div>
                  <div className="cv-item-baixo">
                    <span className="cv-previa">{l.previa}</span>
                    {l.naoLidas > 0 ? <span className="cv-badge">{l.naoLidas}</span> : null}
                  </div>
                  <div className="cv-selos">
                    {l.aguardandoResposta ? (
                      <span className="cv-selo aguardando">responder</span>
                    ) : null}
                    {l.emCobranca ? (
                      <span className="cv-selo cobranca">sem retorno há {l.diasSilencio}d</span>
                    ) : null}
                    {!l.temConversa ? <span className="cv-selo nova">sem conversa</span> : null}
                  </div>
                </button>
              ))
            )}
          </div>
        </aside>

        <section className="cv-conversa">
          {selecionado === null ? (
            <div className="cv-vazio">
              Escolha um cliente na lista ao lado para abrir a conversa.
            </div>
          ) : (
            <>
              <div className="cv-cabecalho">
                <div>
                  <strong>
                    {clienteSelecionado?.nome ?? selecionado.split('@')[0] ?? selecionado}
                  </strong>{' '}
                  <span className="mono" style={{ fontSize: 12, color: 'var(--texto-dim)' }}>
                    {selecionado.split('@')[0]}
                  </span>
                  {clienteSelecionado !== null ? (
                    <span className="badge" style={{ marginLeft: 6 }}>
                      {clienteSelecionado.uf}
                    </span>
                  ) : null}
                </div>
                <a
                  className="btn mini"
                  href={`/humanizado/chat/${encodeURIComponent(selecionado)}`}
                >
                  abrir em página cheia
                </a>
              </div>
              {/* key = chatId: trocar de cliente REMONTA o chat (zera o estado). */}
              <ChatConversa key={selecionado} chatId={selecionado} />
            </>
          )}
        </section>
      </div>
    </div>
  );
}

'use client';
// FOUNDER CONSOLE · JARVIS (decreto 2026-07-29) — a AHRI como assistente
// executiva do fundador: responde QUALQUER pergunta com os números reais dos
// Read Models e executa comandos administrativos ("mova 20 contratos para o
// advogado X") SEMPRE com plano + confirmação explícita — nada move sozinho.
import { useEffect, useRef, useState, type ReactElement } from 'react';
import {
  cobrarCpfJarvis,
  enviarMensagemJarvis,
  executarJarvis,
  fetchFounderBriefing,
  perguntarJarvis,
  type JarvisCobranca,
  type JarvisMensagem,
  type JarvisPlano,
} from '../lib/actions';

interface ChatMessage {
  from: 'ahri' | 'founder';
  text: string;
  provenance: string | null;
  plano?: JarvisPlano;
  cobranca?: JarvisCobranca;
  mensagem?: JarvisMensagem;
}

/** Card da MENSAGEM DITADA (decreto 2026-07-30): destinatário + texto EXATO +
 *  confirmação — o único jeito da AHRI falar proativamente com um cliente. */
const MensagemCard = ({
  mensagem,
  onResultado,
}: {
  mensagem: JarvisMensagem;
  onResultado: (texto: string) => void;
}): ReactElement => {
  const [busy, setBusy] = useState(false);
  const [feito, setFeito] = useState(false);

  const confirmar = async (): Promise<void> => {
    if (busy) return;
    setBusy(true);
    const r = await enviarMensagemJarvis(mensagem.id);
    if (r === null) onResultado('A API não respondeu — a mensagem NÃO foi enviada.');
    else if (r.ok) onResultado(`Enviado para ${mensagem.nome}, palavra por palavra.`);
    else onResultado(`Não enviei: ${r.erro ?? 'falha'}`);
    setFeito(true);
    setBusy(false);
  };

  if (feito) return <></>;
  return (
    <div className="card" style={{ marginTop: 8 }}>
      <div style={{ fontSize: 13, marginBottom: 6 }}>
        Para: <strong>{mensagem.nome}</strong> ({mensagem.chatId.split('@')[0]})
      </div>
      <blockquote
        style={{
          borderLeft: '3px solid #888',
          margin: 0,
          padding: '6px 10px',
          whiteSpace: 'pre-wrap',
        }}
      >
        {mensagem.texto}
      </blockquote>
      <div className="form-row" style={{ marginTop: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <button className="primary" disabled={busy} onClick={() => void confirmar()}>
          {busy ? 'Enviando…' : 'Confirmar — enviar exatamente assim'}
        </button>
        <button
          disabled={busy}
          onClick={() => {
            setFeito(true);
            onResultado('Envio cancelado — nada foi enviado.');
          }}
        >
          Cancelar
        </button>
      </div>
    </div>
  );
};

/** Card da COBRANÇA DE CPF pendente: lista nominal + confirmação do disparo. */
const CobrancaCard = ({
  cobranca,
  onResultado,
}: {
  cobranca: JarvisCobranca;
  onResultado: (texto: string) => void;
}): ReactElement => {
  const [busy, setBusy] = useState(false);
  const [feito, setFeito] = useState(false);

  const confirmar = async (): Promise<void> => {
    if (busy) return;
    setBusy(true);
    const r = await cobrarCpfJarvis(cobranca.id);
    if (r === null) onResultado('A API não respondeu — NENHUMA cobrança foi enviada.');
    else if (r.pulados === 0)
      onResultado(
        `Feito! Enviei o pedido do CPF para ${String(r.enviados)} cliente(s) pelo WhatsApp.`,
      );
    else
      onResultado(
        `Enviei o pedido do CPF para ${String(r.enviados)} cliente(s). ` +
          `${String(r.pulados)} ficaram de fora: ${r.erros.join('; ')}`,
      );
    setFeito(true);
    setBusy(false);
  };

  if (feito) return <></>;
  return (
    <div className="card" style={{ marginTop: 8 }}>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Cliente</th>
              <th>WhatsApp</th>
            </tr>
          </thead>
          <tbody>
            {cobranca.itens.map((i) => (
              <tr key={i.chatId}>
                <td style={{ fontWeight: 600 }}>{i.nome}</td>
                <td>{i.telefone}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="form-row" style={{ marginTop: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <button className="primary" disabled={busy} onClick={() => void confirmar()}>
          {busy
            ? 'Enviando…'
            : `Confirmar — pedir o CPF a ${String(cobranca.itens.length)} cliente(s)`}
        </button>
        <button
          disabled={busy}
          onClick={() => {
            setFeito(true);
            onResultado('Cobrança cancelada — nada foi enviado.');
          }}
        >
          Cancelar
        </button>
      </div>
    </div>
  );
};

/** Card do PLANO pendente: resumo por cliente + escolha do advogado + confirmação. */
const PlanoCard = ({
  plano,
  onResultado,
}: {
  plano: JarvisPlano;
  onResultado: (texto: string) => void;
}): ReactElement => {
  const [advogadoId, setAdvogadoId] = useState(
    plano.advogadoSugeridoId ?? plano.advogados[0]?.id ?? '',
  );
  const [busy, setBusy] = useState(false);
  const [feito, setFeito] = useState(false);

  const confirmar = async (): Promise<void> => {
    if (busy || advogadoId === '') return;
    setBusy(true);
    const r = await executarJarvis(plano.id, advogadoId);
    const advogado = plano.advogados.find((a) => a.id === advogadoId)?.name ?? 'o advogado';
    if (r === null) onResultado('A API não respondeu — o plano NÃO foi executado.');
    else if (r.ok)
      onResultado(
        `Feito! Encaminhei ${String(r.clientes)} cliente(s) — ${String(r.contratos)} contrato(s) — para ${advogado}. Eles já aparecem em "Meus Clientes" no portal dele, e o advogado foi avisado pelo WhatsApp.`,
      );
    else
      onResultado(
        `Executei com ressalvas: ${String(r.clientes)} cliente(s) atribuídos, mas houve falha em: ${r.erros.join('; ')}`,
      );
    setFeito(true);
    setBusy(false);
  };

  if (feito) return <></>;
  return (
    <div className="card" style={{ marginTop: 8 }}>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Contratos</th>
              <th>Peso (lotes de 3/banco)</th>
              <th>Ativos</th>
              <th>Suspensos</th>
              <th>Outros</th>
            </tr>
          </thead>
          <tbody>
            {plano.plano.itens.map((i) => (
              <tr key={i.chatId}>
                <td style={{ fontWeight: 600 }}>{i.nome}</td>
                <td>{i.contratos}</td>
                <td>{i.peso}</td>
                <td>{i.ativos}</td>
                <td>{i.suspensos}</td>
                <td>{i.outros}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="form-row" style={{ marginTop: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          Advogado responsável:
          <select
            value={advogadoId}
            onChange={(e) => {
              setAdvogadoId(e.target.value);
            }}
            disabled={busy}
          >
            {plano.advogados.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.casos} caso(s))
              </option>
            ))}
          </select>
        </label>
        <button
          className="primary"
          disabled={busy || advogadoId === ''}
          onClick={() => void confirmar()}
        >
          {busy
            ? 'Executando…'
            : `Confirmar — mover ${String(plano.plano.totalContratos)} contrato(s) (peso ${String(plano.plano.totalPeso)})`}
        </button>
        <button
          disabled={busy}
          onClick={() => {
            setFeito(true);
            onResultado('Plano cancelado — nada foi movido.');
          }}
        >
          Cancelar
        </button>
      </div>
    </div>
  );
};

const FounderChat = (): ReactElement => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [offline, setOffline] = useState(false);
  const logRef = useRef<HTMLDivElement | null>(null);

  // Abertura automática: a própria AHRI inicia com o briefing.
  useEffect(() => {
    void (async () => {
      const briefing = await fetchFounderBriefing();
      if (!briefing) {
        setOffline(true);
        return;
      }
      setMessages([{ from: 'ahri', text: briefing.greeting, provenance: briefing.provenance }]);
    })();
  }, []);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [messages]);

  const ask = async (): Promise<void> => {
    const pergunta = input.trim();
    if (pergunta === '' || busy) return;
    setInput('');
    setBusy(true);
    setMessages((prev) => [...prev, { from: 'founder', text: pergunta, provenance: null }]);
    const r = await perguntarJarvis(pergunta);
    setMessages((prev) => [
      ...prev,
      r
        ? {
            from: 'ahri',
            text: r.resposta,
            provenance: 'read-models',
            ...(r.plano !== undefined ? { plano: r.plano } : {}),
            ...(r.cobranca !== undefined ? { cobranca: r.cobranca } : {}),
            ...(r.mensagem !== undefined ? { mensagem: r.mensagem } : {}),
          }
        : {
            from: 'ahri',
            text: 'Não consegui falar com a operação agora (API indisponível).',
            provenance: null,
          },
    ]);
    setBusy(false);
  };

  return (
    <>
      <h1 className="page-title">Founder Console</h1>
      <p className="page-sub">
        A AHRI com a empresa inteira na cabeça: pergunte qualquer coisa (os números vêm dos Read
        Models) ou dê um comando — ex.: “mova 20 contratos para o advogado Cornélio”. Comandos
        sempre mostram o plano e pedem a sua confirmação.
      </p>
      {offline ? (
        <div className="error-box" style={{ marginBottom: 12 }}>
          API indisponível.
        </div>
      ) : null}
      {/* Decreto 2026-07-29: o console ocupa a PÁGINA TODA — é o posto de
          comando, não um mini-chat. A altura acompanha a janela. */}
      <div className="chat" style={{ display: 'flex', flexDirection: 'column' }}>
        <div
          className="chat-log card"
          ref={logRef}
          style={{ height: 'calc(100vh - 320px)', minHeight: 420, overflowY: 'auto' }}
        >
          {messages.map((m, i) => (
            <div key={i}>
              <div className={`msg ${m.from}`}>
                {m.text}
                {m.provenance ? <span className="prov">fonte: {m.provenance}</span> : null}
              </div>
              {m.plano ? (
                <PlanoCard
                  plano={m.plano}
                  onResultado={(texto) => {
                    setMessages((prev) => [
                      ...prev,
                      { from: 'ahri', text: texto, provenance: 'read-models' },
                    ]);
                  }}
                />
              ) : null}
              {m.cobranca ? (
                <CobrancaCard
                  cobranca={m.cobranca}
                  onResultado={(texto) => {
                    setMessages((prev) => [
                      ...prev,
                      { from: 'ahri', text: texto, provenance: 'read-models' },
                    ]);
                  }}
                />
              ) : null}
              {m.mensagem ? (
                <MensagemCard
                  mensagem={m.mensagem}
                  onResultado={(texto) => {
                    setMessages((prev) => [
                      ...prev,
                      { from: 'ahri', text: texto, provenance: 'read-models' },
                    ]);
                  }}
                />
              ) : null}
            </div>
          ))}
          {busy ? (
            <div className="msg ahri typing">
              <span className="ahri-dots" aria-hidden>
                <i />
                <i />
                <i />
              </span>
            </div>
          ) : null}
        </div>
        <div className="chat-input">
          <input
            placeholder="Pergunte qualquer coisa ou dê um comando…"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void ask();
            }}
          />
          <button
            className="primary"
            onClick={() => {
              void ask();
            }}
            disabled={busy}
          >
            Perguntar
          </button>
        </div>
      </div>
    </>
  );
};

export default FounderChat;

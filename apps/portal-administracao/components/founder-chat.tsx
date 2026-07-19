'use client';
// FOUNDER CONSOLE — uma conversa entre o fundador e a empresa (2E). A AHRI abre a
// conversa com o briefing automático; o campo único é "Pergunte qualquer coisa...".
// Toda resposta traz a PROVENIÊNCIA (fonte auditável); a AHRI recomenda e fundamenta,
// nunca decide administrativamente.
import { useEffect, useRef, useState, type ReactElement } from 'react';
import { askFounder, fetchFounderBriefing } from '../lib/actions';

interface ChatMessage {
  from: 'ahri' | 'founder';
  text: string;
  provenance: string | null;
}

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
    const question = input.trim();
    if (question === '' || busy) return;
    setInput('');
    setBusy(true);
    setMessages((prev) => [...prev, { from: 'founder', text: question, provenance: null }]);
    const answer = await askFounder(question);
    setMessages((prev) => [
      ...prev,
      answer
        ? { from: 'ahri', text: answer.answer, provenance: answer.provenance }
        : { from: 'ahri', text: 'Não consegui falar com a operação agora (API indisponível).', provenance: null },
    ]);
    setBusy(false);
  };

  return (
    <>
      <h1 className="page-title">Founder Console</h1>
      <p className="page-sub">Uma conversa com a empresa. Toda resposta nasce dos Read Models, com fonte.</p>
      {offline ? <div className="error-box" style={{ marginBottom: 12 }}>API indisponível.</div> : null}
      <div className="chat">
        <div className="chat-log card" ref={logRef} style={{ maxHeight: 480, overflowY: 'auto' }}>
          {messages.map((m, i) => (
            <div key={i} className={`msg ${m.from}`}>
              {m.text}
              {m.provenance ? <span className="prov">fonte: {m.provenance}</span> : null}
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
            placeholder="Pergunte qualquer coisa..."
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void ask();
            }}
          />
          <button className="primary" onClick={() => { void ask(); }} disabled={busy}>
            Perguntar
          </button>
        </div>
      </div>
    </>
  );
};

export default FounderChat;

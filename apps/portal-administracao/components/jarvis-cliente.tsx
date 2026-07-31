'use client';
// JARVIS NO CADASTRO (decreto 2026-07-31) — a caixa do Jarvis DENTRO da página
// do cliente: o comando já sai com este chatId em contexto. O uso nº 1 é o
// resgate de atendimento travado ("a AHRI parou de responder"): o botão/comando
// "retomar o atendimento" reprocessa a última mensagem DESTE cliente pela
// entrada única e a resposta sai pelo canal dele. Comandos que exigem
// confirmação (distribuição/cobrança/mensagem) continuam no Founder Console.
import { useState, type ReactElement } from 'react';
import { perguntarJarvis } from '../lib/actions';

const JarvisCliente = ({ chatId }: { chatId: string }): ReactElement => {
  const [pergunta, setPergunta] = useState('');
  const [resposta, setResposta] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const enviar = async (texto: string): Promise<void> => {
    const limpo = texto.trim();
    if (limpo === '' || ocupado) return;
    setOcupado(true);
    setResposta(null);
    try {
      const r = await perguntarJarvis(limpo, chatId);
      const pedeConfirmacao =
        r !== null &&
        (r.plano !== undefined || r.cobranca !== undefined || r.mensagem !== undefined);
      setResposta(
        r === null
          ? 'Jarvis indisponível — tente novamente.'
          : r.resposta +
              (pedeConfirmacao
                ? '\n\n(Este comando pede confirmação — confirme no Founder Console.)'
                : ''),
      );
    } finally {
      setOcupado(false);
      setPergunta('');
    }
  };

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <h3 style={{ margin: 0 }}>Jarvis deste cliente</h3>
        <button
          type="button"
          className="btn primary"
          disabled={ocupado}
          onClick={() => {
            void enviar('retomar o atendimento');
          }}
        >
          ⚡ Retomar atendimento
        </button>
      </div>
      <p className="page-sub" style={{ margin: '6px 0 8px' }}>
        O Jarvis já sabe que é sobre ESTE cliente. Se a AHRI parou de responder, clique em
        &quot;Retomar atendimento&quot; (ou digite &quot;retoma o atendimento&quot;): a última
        mensagem do cliente é reprocessada e a resposta sai pelo canal dele.
      </p>
      <form
        className="form-row"
        onSubmit={(e) => {
          e.preventDefault();
          void enviar(pergunta);
        }}
      >
        <input
          type="text"
          value={pergunta}
          onChange={(e) => {
            setPergunta(e.target.value);
          }}
          placeholder='Ex.: "retoma o atendimento"'
          disabled={ocupado}
        />
        <button type="submit" className="primary" disabled={ocupado}>
          {ocupado ? 'Executando…' : 'Enviar'}
        </button>
      </form>
      {resposta !== null ? (
        <pre
          style={{
            whiteSpace: 'pre-wrap',
            overflowWrap: 'anywhere',
            fontFamily: 'inherit',
            fontSize: 13.5,
            margin: '8px 0 0',
            padding: '10px 12px',
            borderRadius: 8,
            background: 'rgba(148,163,184,0.12)',
            border: '1px solid rgba(148,163,184,0.25)',
          }}
        >
          {resposta}
        </pre>
      ) : null}
    </div>
  );
};

export default JarvisCliente;

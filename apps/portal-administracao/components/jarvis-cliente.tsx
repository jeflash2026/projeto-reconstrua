'use client';
// JARVIS NO CADASTRO (decreto 2026-07-31) — a caixa do Jarvis DENTRO da página
// do cliente: o comando já sai com este chatId em contexto.
//  • RESGATE: "retomar o atendimento" reprocessa a última mensagem DESTE
//    cliente pela entrada única e a resposta sai pelo canal dele;
//  • MENSAGEM DITADA (2026-08-09): você escreve o texto, confere a prévia e
//    confirma — o texto sai EXATAMENTE como ditado, pelo canal do cliente.
//    Nada é enviado sem a confirmação (decreto 2026-07-30, fim dos automáticos).
import { useState, type ReactElement } from 'react';
import {
  enviarMensagemJarvis,
  perguntarJarvis,
  prepararMensagemCliente,
  type JarvisMensagem,
} from '../lib/actions';

const JarvisCliente = ({ chatId }: { chatId: string }): ReactElement => {
  const [pergunta, setPergunta] = useState('');
  const [resposta, setResposta] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  // MENSAGEM DITADA: rascunho → prévia (plano) → confirmação → enviada.
  const [rascunho, setRascunho] = useState('');
  const [pendente, setPendente] = useState<JarvisMensagem | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

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

  const preparar = async (): Promise<void> => {
    const limpo = rascunho.trim();
    if (limpo === '' || ocupado) return;
    setOcupado(true);
    setErro(null);
    setAviso(null);
    try {
      const r = await prepararMensagemCliente(chatId, limpo);
      if (r === null || r.mensagem === undefined) {
        setErro(r?.resposta ?? 'falha ao preparar a mensagem — tente de novo');
        return;
      }
      setPendente(r.mensagem);
    } finally {
      setOcupado(false);
    }
  };

  const confirmar = async (): Promise<void> => {
    if (pendente === null || ocupado) return;
    setOcupado(true);
    setErro(null);
    try {
      const r = await enviarMensagemJarvis(pendente.id);
      if (r === null || !r.ok) {
        setErro(r?.erro ?? 'falha no envio — o texto NÃO foi enviado');
        return;
      }
      setAviso(`Mensagem enviada para ${pendente.nome}.`);
      setPendente(null);
      setRascunho('');
    } finally {
      setOcupado(false);
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
        &quot;Retomar atendimento&quot;: a última mensagem do cliente é reprocessada e a resposta
        sai pelo canal dele.
      </p>

      {/* ── MENSAGEM DITADA (2026-08-09): o canal proativo com confirmação ── */}
      <div
        style={{
          margin: '12px 0',
          padding: '12px 14px',
          borderRadius: 8,
          background: 'rgba(148,163,184,0.10)',
          border: '1px solid rgba(148,163,184,0.25)',
        }}
      >
        <strong style={{ fontSize: 14 }}>✍️ Mensagem sua para o cliente</strong>
        <p className="page-sub" style={{ margin: '4px 0 8px' }}>
          Escreva e o texto sai EXATAMENTE assim, pelo canal do cliente, assinado como AHRI. Nada é
          enviado sem a sua confirmação.
        </p>
        <textarea
          value={rascunho}
          onChange={(e) => {
            setRascunho(e.target.value);
            setPendente(null);
          }}
          rows={3}
          disabled={ocupado}
          placeholder="Ex.: Paulo, sua análise já está pronta — para seguirmos, é só responder SIM aqui."
          style={{ width: '100%' }}
        />
        {pendente === null ? (
          <button
            type="button"
            className="btn"
            disabled={ocupado || rascunho.trim() === ''}
            onClick={() => {
              void preparar();
            }}
          >
            Preparar mensagem
          </button>
        ) : (
          <div>
            <div
              style={{
                margin: '8px 0',
                padding: '10px 12px',
                borderRadius: 8,
                background: 'rgba(34,197,94,0.10)',
                border: '1px solid rgba(34,197,94,0.35)',
                fontSize: 13.5,
                whiteSpace: 'pre-wrap',
              }}
            >
              <strong>Vai para {pendente.nome}, exatamente assim:</strong>
              {'\n\n'}
              {pendente.texto}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="primary"
                disabled={ocupado}
                onClick={() => {
                  void confirmar();
                }}
              >
                {ocupado ? 'Enviando…' : '✅ Confirmar e enviar'}
              </button>
              <button
                type="button"
                className="btn"
                disabled={ocupado}
                onClick={() => {
                  setPendente(null);
                }}
              >
                Editar o texto
              </button>
            </div>
          </div>
        )}
        {erro !== null ? <div className="error-box">{erro}</div> : null}
        {aviso !== null ? (
          <div className="badge ok" style={{ marginTop: 8 }}>
            {aviso}
          </div>
        ) : null}
      </div>

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

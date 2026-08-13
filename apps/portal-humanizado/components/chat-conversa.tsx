'use client';
// CHAT DO CANAL DA EQUIPE (decreto 2026-08-05) — a conversa 100% HUMANA do
// número (41) na Meta, dentro do portal:
//  • balões entrada/saída, atualização a cada 5s (a Meta entrega o inbound ao
//    webhook; o portal só lê a conversa gravada);
//  • enviar texto e ANEXAR PDF/foto (a procuração vai por aqui);
//  • anexo RECEBIDO ganha os botões "Confirmar como procuração/RG/comprovante"
//    — 1 clique salva no perfil do cliente (docs-equipe), mesma porta do
//    upload manual;
//  • fora da janela de 24h a Meta recusa texto livre — o botão do TEMPLATE
//    inicia a conversa do jeito aprovado; o erro volta legível.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ReactElement } from 'react';
import type { MensagemChat } from '../lib/api';

const ROTULOS: Record<string, string> = {
  procuracao: 'Procuração assinada',
  rg: 'RG',
  comprovante: 'Comprovante de endereço',
  // Decreto 2026-08-05: 4º documento obrigatório da fase 2.
  extrato_credito: 'Extrato INSS (3 meses)',
};

function horaBr(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

/** Primeiro nome com capitalização humana ("MARLENE" → "Marlene"). */
function primeiroNomeDe(nome: string | null): string {
  const bruto = (nome ?? '').trim().split(/\s+/)[0] ?? '';
  if (bruto === '') return 'Cliente';
  return bruto.charAt(0).toUpperCase() + bruto.slice(1).toLowerCase();
}

/** O que ainda falta, em nome de cliente — só para o botão dizer à secretária o
 *  que vai ser pedido. Quem MANDA na mensagem é o servidor (regra única). */
function faltamDe(docs: DocsCliente | null): string[] {
  if (docs === null) return [];
  const falta: string[] = [];
  if (!docs.procuracao) falta.push('procuração');
  if (!docs.rg) falta.push('RG');
  if (!docs.comprovante) falta.push('comprovante');
  if (docs.extratoCredito !== true) falta.push('extrato INSS');
  return falta;
}

export interface DocsCliente {
  procuracao: boolean;
  rg: boolean;
  comprovante: boolean;
  extratoCredito?: boolean;
}

export default function ChatConversa({
  chatId,
  nomeCliente = null,
  docs = null,
  aoConfirmarDoc,
  sugerirApresentacao = false,
}: {
  chatId: string;
  /** Nome do cliente (da mesa) — preenche o {{1}} dos templates. */
  nomeCliente?: string | null;
  /** Documentos já entregues — o botão de cobrança mostra só o que falta. */
  docs?: DocsCliente | null;
  /** A JANELA NÃO PODE FECHAR (2026-08-13): quando a conversa vive DENTRO do
   *  painel, confirmar um anexo não pode chamar router.refresh() — o portal tem
   *  loading.tsx, então o refresh troca a árvore inteira pela tela "Preparando a
   *  mesa…" e, na volta, a conversa aberta e o texto digitado se perdem. Com
   *  este aviso, o painel atualiza o selo do documento sozinho. Ausente (página
   *  /chat própria, onde não há o que perder) ⇒ mantém o refresh. */
  aoConfirmarDoc?: (tipo: string) => void;
  /** Botão "mensagem pronta" da mesa: chega com a APRESENTAÇÃO armada —
   *  um clique dispara o template contato_equipe com o nome do cliente. */
  sugerirApresentacao?: boolean;
}): ReactElement {
  const router = useRouter();
  const [apresentacaoArmada, setApresentacaoArmada] = useState(sugerirApresentacao);
  // ÁUDIO (decreto 2026-08-06): gravação em OGG/Opus — o ÚNICO formato de voz
  // que a Meta aceita (o MediaRecorder nativo grava WEBM, recusado por ela).
  const [gravando, setGravando] = useState(false);
  const gravadorRef = useRef<{ stop(): Promise<void> } | null>(null);
  const [mensagens, setMensagens] = useState<MensagemChat[] | null>(null);
  const [texto, setTexto] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const fimRef = useRef<HTMLDivElement | null>(null);
  const totalRef = useRef(0);
  const base = `/humanizado/api/chat/${encodeURIComponent(chatId)}`;
  // COBRANÇA CIRÚRGICA (2026-08-12, caso Sandra): o botão só existe se houver o
  // que pedir, e diz exatamente o quê. Sem cadastro na mesa, não há cobrança.
  const faltamRotulos = faltamDe(docs);
  const pendencias =
    docs === null
      ? 'Cliente sem cadastro na mesa — a cobrança precisa saber o que ele já entregou'
      : faltamRotulos.length === 0
        ? 'Este cliente já entregou toda a documentação'
        : null;

  const carregar = useCallback(async (): Promise<void> => {
    try {
      const res = await fetch(base, { cache: 'no-store' });
      if (!res.ok) return;
      const data = (await res.json()) as { mensagens?: MensagemChat[] };
      setMensagens(data.mensagens ?? []);
    } catch {
      /* rede piscou — a próxima rodada tenta de novo */
    }
  }, [base]);

  useEffect(() => {
    void carregar();
    // Abrir a conversa zera o contador de não lidas da caixa de entrada.
    void fetch(base, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ acao: 'lido' }),
    }).catch(() => undefined);
    const timer = setInterval(() => void carregar(), 5000);
    return () => clearInterval(timer);
  }, [base, carregar]);

  // Rola ao fim quando CHEGA mensagem (não a cada rodada do polling).
  useEffect(() => {
    const total = mensagens?.length ?? 0;
    if (total !== totalRef.current) {
      totalRef.current = total;
      fimRef.current?.scrollIntoView({ block: 'end' });
    }
  }, [mensagens]);

  // JANELA DE 24H RETROATIVA (2026-08-06): saída SEM fala do cliente nas 24h
  // anteriores quase certamente NÃO chegou (a Meta aceita e recusa depois; as
  // falhas antigas não ficaram registradas). O aviso é derivado do próprio
  // histórico; template fica de fora (ele atravessa a janela).
  const comJanela = useMemo(() => {
    if (mensagens === null) return null;
    let ultimaEntradaMs: number | null = null;
    return mensagens.map((m) => {
      if (m.direcao === 'entrada') {
        ultimaEntradaMs = new Date(m.em).getTime();
        return { m, foraDaJanela: false };
      }
      const foraDaJanela =
        m.tipo !== 'template' &&
        (ultimaEntradaMs === null ||
          new Date(m.em).getTime() - ultimaEntradaMs > 24 * 60 * 60 * 1000);
      return { m, foraDaJanela };
    });
  }, [mensagens]);

  async function acao(payload: Record<string, unknown>): Promise<boolean> {
    setErro(null);
    setAviso(null);
    setOcupado(true);
    try {
      const res = await fetch(base, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setErro(data.error ?? 'falha no envio');
        return false;
      }
      await carregar();
      return true;
    } catch {
      setErro('falha de rede — tente de novo');
      return false;
    } finally {
      setOcupado(false);
    }
  }

  async function enviarTexto(): Promise<void> {
    const limpo = texto.trim();
    if (limpo === '') return;
    if (await acao({ acao: 'texto', texto: limpo })) setTexto('');
  }

  function enviarArquivo(file: File): void {
    const leitor = new FileReader();
    leitor.onload = () => {
      const base64 = typeof leitor.result === 'string' ? leitor.result : '';
      void acao({ acao: 'documento', nome: file.name, base64 }).then((ok) => {
        if (ok) setAviso(`"${file.name}" enviado ao cliente.`);
      });
    };
    leitor.readAsDataURL(file);
  }

  // PROCURAÇÃO VIA TEMPLATE (2026-08-08): o PDF viaja no cabeçalho do modelo
  // aprovado envio_procuracao — a ÚNICA forma de entregar a procuração a quem
  // está há mais de 24h sem escrever (o anexo comum é descartado pela Meta).
  function enviarProcuracaoTemplate(file: File): void {
    const primeiro = primeiroNomeDe(nomeCliente);
    if (
      !window.confirm(
        `Enviar a PROCURAÇÃO via template para ${primeiro}? O PDF "${file.name}" vai dentro da mensagem aprovada — funciona mesmo com a janela de 24h fechada.`,
      )
    )
      return;
    const leitor = new FileReader();
    leitor.onload = () => {
      const base64 = typeof leitor.result === 'string' ? leitor.result : '';
      void acao({
        acao: 'template_documento',
        template: 'envio_procuracao',
        nome: file.name,
        base64,
      }).then((ok) => {
        if (ok) setAviso(`Procuração "${file.name}" enviada via template.`);
      });
    };
    leitor.readAsDataURL(file);
  }

  async function confirmar(m: MensagemChat, tipo: string): Promise<void> {
    const ok = await acao({ acao: 'confirmar', mensagemId: m.id, tipo });
    if (ok) {
      setAviso(`Anexo salvo no perfil do cliente como ${ROTULOS[tipo] ?? tipo}.`);
      // O selo do documento precisa atualizar — mas NUNCA às custas da conversa
      // aberta. Dentro do painel quem atualiza é o pai (sem remontar nada);
      // só a página /chat, que não tem o que perder, ainda usa o refresh.
      if (aoConfirmarDoc !== undefined) aoConfirmarDoc(tipo);
      else router.refresh();
    }
  }

  /** Um clique GRAVA, o segundo PARA e envia. O encoder (OGG/Opus) roda num
   *  worker servido pelo próprio portal — nada sai do navegador até o envio. */
  async function alternarGravacao(): Promise<void> {
    if (gravando) {
      setGravando(false);
      await gravadorRef.current?.stop().catch(() => undefined);
      return;
    }
    setErro(null);
    setAviso(null);
    try {
      const { default: Recorder } = await import('opus-recorder');
      const gravador = new Recorder({
        encoderPath: '/humanizado/encoderWorker.min.js',
        encoderApplication: 2048, // VOIP — otimizado para voz
        numberOfChannels: 1,
        streamPages: false,
      });
      gravador.ondataavailable = (dados) => {
        gravadorRef.current = null;
        gravador.close();
        const blob = new Blob([dados], { type: 'audio/ogg' });
        const leitor = new FileReader();
        leitor.onload = () => {
          const base64 = typeof leitor.result === 'string' ? leitor.result : '';
          if (base64 === '') return;
          void acao({ acao: 'audio', base64, mime: 'audio/ogg' }).then((ok) => {
            if (ok) setAviso('Áudio enviado ao cliente.');
          });
        };
        leitor.readAsDataURL(blob);
      };
      await gravador.start();
      gravadorRef.current = gravador;
      setGravando(true);
    } catch {
      setErro('não consegui acessar o microfone — verifique a permissão do navegador');
    }
  }

  return (
    <div className="chat-caixa">
      <div className="chat-mensagens">
        {mensagens === null ? (
          <div className="empty">Carregando a conversa…</div>
        ) : mensagens.length === 0 ? (
          <div className="empty">
            Nenhuma mensagem ainda. Se o cliente está há mais de 24h sem escrever, inicie pelo botão
            do template — a Meta só libera texto livre depois que ele responder.
          </div>
        ) : (
          (comJanela ?? []).map(({ m, foraDaJanela }) => (
            <div key={m.id} className={`chat-balao ${m.direcao}`}>
              {m.texto !== null && m.texto !== '' ? (
                <div className="chat-texto">{m.texto}</div>
              ) : null}
              {/* ÁUDIO: toca direto no chat (entrada e saída). */}
              {m.sha256 !== null && m.tipo === 'audio' ? (
                <div className="chat-anexo">
                  <audio
                    controls
                    preload="none"
                    src={`${base}/anexo/${encodeURIComponent(m.id)}`}
                    style={{ maxWidth: '100%', height: 36 }}
                  />
                </div>
              ) : m.sha256 !== null ? (
                <div className="chat-anexo">
                  📎{' '}
                  <a
                    href={`${base}/anexo/${encodeURIComponent(m.id)}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {m.nomeArquivo ?? (m.tipo === 'imagem' ? 'foto' : 'anexo')} — ver
                  </a>
                  {m.direcao === 'entrada' ? (
                    m.confirmadoComo !== null ? (
                      <span className="chat-selo">
                        ✓ salvo como {ROTULOS[m.confirmadoComo] ?? m.confirmadoComo}
                      </span>
                    ) : (
                      <span className="chat-confirmar">
                        {(['procuracao', 'rg', 'comprovante', 'extrato_credito'] as const).map(
                          (tipo) => (
                            <button
                              key={tipo}
                              type="button"
                              className="btn mini"
                              disabled={ocupado}
                              onClick={() => void confirmar(m, tipo)}
                            >
                              Confirmar: {ROTULOS[tipo]}
                            </button>
                          ),
                        )}
                      </span>
                    )
                  ) : null}
                </div>
              ) : null}
              {m.tipo === 'audio' && m.sha256 === null ? (
                <div className="chat-texto">[áudio recebido — indisponível]</div>
              ) : null}
              {/* FALHA DE ENTREGA (2026-08-06): a Meta aceitou e falhou depois
                  (ex.: janela de 24h) — o aviso aparece NA mensagem. */}
              {m.falha != null ? (
                <div
                  style={{
                    marginTop: 4,
                    fontSize: 12,
                    fontWeight: 600,
                    color: 'var(--vermelho, #a01e1e)',
                  }}
                >
                  ⚠ {m.falha}
                </div>
              ) : foraDaJanela ? (
                <div style={{ marginTop: 4, fontSize: 12, fontWeight: 600, color: '#8a6100' }}>
                  ⚠ provavelmente não entregue — o cliente não tinha escrito nas 24h anteriores
                  (inicie pelo template)
                </div>
              ) : null}
              <div className="chat-meta">
                {m.direcao === 'saida' ? `${m.autor ?? 'Equipe'} · ` : ''}
                {horaBr(m.em)}
              </div>
            </div>
          ))
        )}
        <div ref={fimRef} />
      </div>

      {erro !== null ? <div className="error-box">{erro}</div> : null}
      {aviso !== null ? <div className="chat-aviso">{aviso}</div> : null}

      {/* MENSAGEM PRONTA (botão vermelho da mesa): a apresentação da Layara
          armada — um clique dispara o template com o nome do cliente. */}
      {apresentacaoArmada ? (
        <div className="chat-cta">
          <div className="chat-cta-texto">
            <strong>Mensagem pronta:</strong> apresentação da Layara com o pedido dos documentos
            (RG, procuração assinada, comprovante e extrato de crédito do INSS), personalizada para{' '}
            <strong>{primeiroNomeDe(nomeCliente)}</strong>.
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn primary"
              disabled={ocupado}
              onClick={() => {
                void acao({
                  acao: 'template',
                  template: 'contato_equipe',
                  variaveis: [primeiroNomeDe(nomeCliente)],
                }).then((ok) => {
                  if (ok) {
                    setApresentacaoArmada(false);
                    setAviso('Apresentação enviada — aguarde o cliente responder.');
                  }
                });
              }}
            >
              Enviar agora para {primeiroNomeDe(nomeCliente)}
            </button>
            <button
              type="button"
              className="btn"
              disabled={ocupado}
              onClick={() => setApresentacaoArmada(false)}
            >
              Agora não
            </button>
          </div>
        </div>
      ) : null}

      <div className="chat-envio">
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void enviarTexto();
            }
          }}
          placeholder="Escreva a mensagem… (Enter envia, Shift+Enter quebra linha)"
          rows={2}
          disabled={ocupado}
        />
        <div className="chat-botoes">
          <button
            type="button"
            className="btn primary"
            disabled={ocupado || texto.trim() === ''}
            onClick={() => void enviarTexto()}
          >
            Enviar
          </button>
          <button
            type="button"
            className={`btn${gravando ? ' primary' : ''}`}
            disabled={ocupado && !gravando}
            title="Um clique grava, o segundo para e envia a mensagem de voz"
            onClick={() => void alternarGravacao()}
          >
            {gravando ? '⏹ Parar e enviar' : '🎤 Gravar áudio'}
          </button>
          <label className="btn">
            📎 Anexar PDF/foto
            <input
              type="file"
              accept="application/pdf,image/jpeg,image/png"
              style={{ display: 'none' }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file !== undefined) enviarArquivo(file);
                e.target.value = '';
              }}
            />
          </label>
          {/* TEMPLATES (2026-08-05): fora da janela de 24h a Meta só aceita
              modelo aprovado. Dois botões: apresentação (1º contato) e
              retomada (cliente que ficou de enviar documento e sumiu). O
              {{1}} do corpo é preenchido com o primeiro nome do cliente. */}
          <button
            type="button"
            className="btn"
            disabled={ocupado}
            title="1º contato: apresentação da Layara com o pedido dos documentos (template aprovado)"
            onClick={() => {
              const primeiro = primeiroNomeDe(nomeCliente);
              if (window.confirm(`Enviar a APRESENTAÇÃO da equipe para ${primeiro}?`))
                void acao({
                  acao: 'template',
                  template: 'contato_equipe',
                  variaveis: [primeiro],
                }).then((ok) => {
                  if (ok) setAviso('Apresentação enviada — aguarde o cliente responder.');
                });
            }}
          >
            Template: apresentação
          </button>
          <label
            className="btn"
            title="Envia a procuração em PDF DENTRO do template aprovado — funciona mesmo com a janela de 24h fechada"
          >
            Template: procuração (PDF)
            <input
              type="file"
              accept="application/pdf"
              style={{ display: 'none' }}
              disabled={ocupado}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file !== undefined) enviarProcuracaoTemplate(file);
                e.target.value = '';
              }}
            />
          </label>
          <button
            type="button"
            className="btn"
            disabled={ocupado || pendencias !== null}
            title={
              pendencias ??
              'Cobra SÓ o que falta no cadastro deste cliente (template aprovado, atravessa a janela de 24h)'
            }
            onClick={() => {
              const primeiro = primeiroNomeDe(nomeCliente);
              if (
                window.confirm(
                  `Cobrar de ${primeiro}: ${faltamRotulos.join(', ')}? Só isso será pedido — o que ela já entregou não entra na mensagem.`,
                )
              )
                // O SERVIDOR decide o texto lendo o cadastro na hora — o portal
                // só pede a cobrança (caso Sandra, 2026-08-12).
                void acao({ acao: 'template_cobranca' }).then((ok) => {
                  if (ok) setAviso(`Cobrança enviada: ${faltamRotulos.join(', ')}.`);
                });
            }}
          >
            {pendencias === null
              ? `Cobrar ${faltamRotulos.length === 1 ? faltamRotulos[0] : `${String(faltamRotulos.length)} documentos`}`
              : 'Nada a cobrar'}
          </button>
        </div>
      </div>
    </div>
  );
}

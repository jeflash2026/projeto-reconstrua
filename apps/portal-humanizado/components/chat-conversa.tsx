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
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import type { MensagemChat } from '../lib/api';

const ROTULOS: Record<string, string> = {
  procuracao: 'Procuração assinada',
  rg: 'RG',
  comprovante: 'Comprovante de endereço',
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

export default function ChatConversa({
  chatId,
  nomeCliente = null,
}: {
  chatId: string;
  /** Nome do cliente (da mesa) — preenche o {{1}} dos templates. */
  nomeCliente?: string | null;
}): ReactElement {
  const [mensagens, setMensagens] = useState<MensagemChat[] | null>(null);
  const [texto, setTexto] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const fimRef = useRef<HTMLDivElement | null>(null);
  const totalRef = useRef(0);
  const base = `/humanizado/api/chat/${encodeURIComponent(chatId)}`;

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

  async function confirmar(m: MensagemChat, tipo: string): Promise<void> {
    const ok = await acao({ acao: 'confirmar', mensagemId: m.id, tipo });
    if (ok) setAviso(`Anexo salvo no perfil do cliente como ${ROTULOS[tipo] ?? tipo}.`);
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
          mensagens.map((m) => (
            <div key={m.id} className={`chat-balao ${m.direcao}`}>
              {m.texto !== null && m.texto !== '' ? (
                <div className="chat-texto">{m.texto}</div>
              ) : null}
              {m.sha256 !== null ? (
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
                        {(['procuracao', 'rg', 'comprovante'] as const).map((tipo) => (
                          <button
                            key={tipo}
                            type="button"
                            className="btn mini"
                            disabled={ocupado}
                            onClick={() => void confirmar(m, tipo)}
                          >
                            Confirmar: {ROTULOS[tipo]}
                          </button>
                        ))}
                      </span>
                    )
                  ) : null}
                </div>
              ) : null}
              {m.tipo === 'audio' && m.sha256 === null ? (
                <div className="chat-texto">[áudio recebido — indisponível]</div>
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
          <button
            type="button"
            className="btn"
            disabled={ocupado}
            title="Retomada após 24h: lembrete da documentação pendente (template aprovado)"
            onClick={() => {
              const primeiro = primeiroNomeDe(nomeCliente);
              if (window.confirm(`Enviar a COBRANÇA da documentação para ${primeiro}?`))
                void acao({
                  acao: 'template',
                  template: 'retomada_documentos',
                  variaveis: [primeiro],
                }).then((ok) => {
                  if (ok) setAviso('Lembrete da documentação enviado.');
                });
            }}
          >
            Template: cobrar documentação
          </button>
        </div>
      </div>
    </div>
  );
}

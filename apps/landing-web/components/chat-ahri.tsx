'use client';
// ─────────────────────────────────────────────────────────────────────────────
// CAIXA DE CONVERSA DA AHRI (2026-09-21) — o atendimento acontece DENTRO do
// site, sem tirar o visitante da página.
//
// Por quê: a conta oficial do WhatsApp foi desativada em definitivo pela Meta e
// o número do Evolution está bloqueado para envio. O canal que sobra é o nosso.
// Mandar o visitante para outra página (/webchat) custa conversão — quem veio de
// anúncio abandona na troca de tela. Aqui a conversa abre por cima da página.
//
// Fala com a MESMA AHRI: as chamadas passam pelo SERVIDOR do site
// (/api/ahri/*), que repassa ao webchat da API. Assim a conversa funciona em
// qualquer endereço do domínio (com ou sem www) e em domínios novos de
// campanha, sem depender de configuração no proxy. Nada de canal novo.
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactElement } from 'react';
import { MessageCircle, Send, X } from 'lucide-react';
import { campanhaDaVisita } from '@/lib/whatsapp';
import { trackGoogleAdsContact } from '@/lib/google-ads';

/** Quem abre a conversa de fora (o formulário da página) dispara este evento. */
export const EVENTO_ABRIR_CHAT = 'ahri:abrir-chat';

export interface AberturaDoChat {
  readonly nome?: string;
  readonly telefone?: string;
  /** Primeira mensagem, quando o visitante já escreveu no formulário. */
  readonly relato?: string;
}

export function abrirChatAhri(dados: AberturaDoChat = {}): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<AberturaDoChat>(EVENTO_ABRIR_CHAT, { detail: dados }));
}

interface Mensagem {
  readonly de: 'cliente' | 'ahri';
  readonly texto: string;
  readonly em: string;
}

const CHAVE_TOKEN = 'wcToken';
const INTERVALO_POLLING_MS = 3000;

/** sessionStorage some em aba anônima e em navegador bloqueado: nunca quebrar. */
function lerToken(): string {
  try {
    return window.sessionStorage.getItem(CHAVE_TOKEN) ?? '';
  } catch {
    return '';
  }
}
function guardarToken(token: string): void {
  try {
    window.sessionStorage.setItem(CHAVE_TOKEN, token);
  } catch {
    /* segue sem persistir — a conversa desta aba continua funcionando */
  }
}
function esquecerToken(): void {
  try {
    window.sessionStorage.removeItem(CHAVE_TOKEN);
  } catch {
    /* nada a fazer */
  }
}

async function postar(caminho: string, corpo: unknown): Promise<Record<string, unknown>> {
  const resposta = await fetch(caminho, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(corpo),
  });
  return (await resposta.json()) as Record<string, unknown>;
}

export function ChatAhri(): ReactElement {
  const [aberto, setAberto] = useState(false);
  const [token, setToken] = useState('');
  const [mensagens, setMensagens] = useState<readonly Mensagem[]>([]);
  const [texto, setTexto] = useState('');
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [esperandoResposta, setEsperandoResposta] = useState(false);
  // Quem veio do formulário da página já informou tudo: não faz sentido pedir
  // um clique a mais só para repetir o que acabou de escrever.
  const [iniciarSozinho, setIniciarSozinho] = useState(false);
  const fimDaLista = useRef<HTMLDivElement | null>(null);
  const campoTexto = useRef<HTMLInputElement | null>(null);

  const carregarHistorico = useCallback(async (t: string): Promise<void> => {
    if (t === '') return;
    try {
      const r = await fetch(`/api/ahri/historico?token=${encodeURIComponent(t)}`);
      const j = (await r.json()) as { ok?: boolean; mensagens?: Mensagem[] };
      if (j.ok !== true) {
        // Sessão vencida: volta à identificação em vez de ficar em silêncio.
        esquecerToken();
        setToken('');
        return;
      }
      setMensagens(j.mensagens ?? []);
    } catch {
      /* rede instável: o próximo ciclo tenta de novo */
    }
  }, []);

  // Sessão desta aba (ou da página /webchat aberta antes): retoma a conversa.
  useEffect(() => {
    const salvo = lerToken();
    if (salvo === '') return;
    setToken(salvo);
    void carregarHistorico(salvo);
  }, [carregarHistorico]);

  // Abertura vinda da página (formulário "Quero entender meu caso").
  useEffect(() => {
    const aoAbrir = (evento: Event): void => {
      const dados = (evento as CustomEvent<AberturaDoChat>).detail ?? {};
      setAberto(true);
      if (dados.nome !== undefined && dados.nome !== '') setNome(dados.nome);
      if (dados.telefone !== undefined && dados.telefone !== '') setTelefone(dados.telefone);
      if (dados.relato !== undefined && dados.relato !== '') setTexto(dados.relato);
      if (
        dados.nome !== undefined &&
        dados.nome !== '' &&
        dados.telefone !== undefined &&
        dados.telefone !== ''
      )
        setIniciarSozinho(true);
    };
    window.addEventListener(EVENTO_ABRIR_CHAT, aoAbrir);
    return () => {
      window.removeEventListener(EVENTO_ABRIR_CHAT, aoAbrir);
    };
  }, []);

  // A resposta da AHRI chega pelo pipeline normal: a página pergunta de tempos
  // em tempos, como a página /webchat faz.
  useEffect(() => {
    if (!aberto || token === '') return;
    const id = window.setInterval(() => {
      void carregarHistorico(token);
    }, INTERVALO_POLLING_MS);
    return () => {
      window.clearInterval(id);
    };
  }, [aberto, token, carregarHistorico]);

  useEffect(() => {
    fimDaLista.current?.scrollIntoView({ block: 'end' });
    if (mensagens.length > 0 && mensagens[mensagens.length - 1]?.de === 'ahri')
      setEsperandoResposta(false);
  }, [mensagens]);

  useEffect(() => {
    if (aberto && token !== '') campoTexto.current?.focus();
  }, [aberto, token]);

  useEffect(() => {
    if (!aberto) return;
    const aoTeclar = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setAberto(false);
    };
    window.addEventListener('keydown', aoTeclar);
    return () => {
      window.removeEventListener('keydown', aoTeclar);
    };
  }, [aberto]);

  function identificar(evento: FormEvent<HTMLFormElement>): void {
    evento.preventDefault();
    void iniciarSessao();
  }

  async function iniciarSessao(): Promise<void> {
    if (ocupado || token !== '') return;
    setOcupado(true);
    setErro('');
    const j: Record<string, unknown> = await postar('/api/ahri/sessao', {
      nome,
      telefone,
      campanha: campanhaDaVisita(),
    }).catch(() => ({ ok: false, error: 'não foi possível iniciar agora' }));
    setOcupado(false);
    if (j['ok'] !== true) {
      setErro(typeof j['error'] === 'string' ? j['error'] : 'não foi possível iniciar agora');
      return;
    }
    const novo = typeof j['token'] === 'string' ? j['token'] : '';
    guardarToken(novo);
    setToken(novo);
    // CONVERSÃO "Contato": aqui é contato de verdade — a pessoa se identificou
    // e a conversa começou. Abrir a caixa, sozinho, não conta.
    trackGoogleAdsContact();
    if (texto.trim() !== '') await enviarTexto(novo, texto);
  }

  useEffect(() => {
    if (!iniciarSozinho || token !== '' || nome.trim() === '' || telefone.trim() === '') return;
    setIniciarSozinho(false);
    void iniciarSessao();
    // iniciarSessao lê o mesmo estado já observado acima (nome/telefone/token).
  }, [iniciarSozinho, token, nome, telefone]);

  async function enviarTexto(t: string, conteudo: string): Promise<void> {
    const limpo = conteudo.trim();
    if (limpo === '') return;
    setTexto('');
    setMensagens((atual) => [
      ...atual,
      { de: 'cliente', texto: limpo, em: new Date().toISOString() },
    ]);
    setEsperandoResposta(true);
    const j: Record<string, unknown> = await postar('/api/ahri/mensagem', {
      token: t,
      texto: limpo,
    }).catch(() => ({ ok: false }));
    if (j['ok'] !== true) {
      setEsperandoResposta(false);
      setErro('a mensagem não saiu; tente de novo');
      return;
    }
    window.setTimeout(() => {
      void carregarHistorico(t);
    }, 900);
  }

  return (
    <>
      <button
        type="button"
        className="ahri-bolha"
        aria-label={aberto ? 'Fechar a conversa' : 'Falar com a Ahri'}
        aria-expanded={aberto}
        onClick={() => {
          setAberto((v) => !v);
        }}
      >
        {aberto ? <X size={20} /> : <MessageCircle size={20} />}
        <span>{aberto ? 'Fechar' : 'Falar com a Ahri'}</span>
      </button>

      {aberto ? (
        <section className="ahri-chat" role="dialog" aria-label="Conversa com a Ahri">
          <header className="ahri-chat__topo">
            <div className="ahri-chat__quem">
              <span className="ahri-chat__avatar" aria-hidden="true">
                A
              </span>
              <div>
                <strong>Ahri</strong>
                <span>Consultora do Projeto Reconstrua</span>
              </div>
            </div>
            <button
              type="button"
              aria-label="Fechar a conversa"
              onClick={() => {
                setAberto(false);
              }}
            >
              <X size={18} />
            </button>
          </header>

          {token === '' ? (
            <form className="ahri-chat__entrada" onSubmit={identificar}>
              <p>
                Me diga como falar com você. A análise começa aqui mesmo, agora — e ninguém entra em
                contato sem a sua autorização.
              </p>
              <label>
                <span>Seu nome</span>
                <input
                  value={nome}
                  onChange={(e) => {
                    setNome(e.target.value);
                  }}
                  autoComplete="name"
                  required
                />
              </label>
              <label>
                <span>Seu WhatsApp com DDD</span>
                <input
                  value={telefone}
                  onChange={(e) => {
                    setTelefone(e.target.value);
                  }}
                  inputMode="numeric"
                  autoComplete="tel"
                  placeholder="(00) 00000-0000"
                  required
                />
              </label>
              {erro !== '' ? <p className="ahri-chat__erro">{erro}</p> : null}
              <button type="submit" disabled={ocupado}>
                {ocupado ? 'Abrindo…' : 'Começar a conversa'}
              </button>
            </form>
          ) : (
            <>
              <div className="ahri-chat__conversa">
                {mensagens.length === 0 ? (
                  <p className="ahri-chat__vazio">
                    Escreva a sua primeira mensagem. Pode contar com as suas palavras o que está
                    acontecendo com os descontos no seu benefício.
                  </p>
                ) : null}
                {mensagens.map((m, i) => (
                  <div key={`${m.em}-${String(i)}`} className={`ahri-balao ahri-balao--${m.de}`}>
                    {m.texto}
                  </div>
                ))}
                {esperandoResposta ? (
                  <div className="ahri-balao ahri-balao--ahri ahri-balao--digitando">
                    <span />
                    <span />
                    <span />
                  </div>
                ) : null}
                <div ref={fimDaLista} />
              </div>
              <form
                className="ahri-chat__campo"
                onSubmit={(e) => {
                  e.preventDefault();
                  void enviarTexto(token, texto);
                }}
              >
                <input
                  ref={campoTexto}
                  value={texto}
                  onChange={(e) => {
                    setTexto(e.target.value);
                  }}
                  placeholder="Escreva aqui…"
                  aria-label="Sua mensagem"
                />
                <button type="submit" aria-label="Enviar" disabled={texto.trim() === ''}>
                  <Send size={17} />
                </button>
              </form>
            </>
          )}
        </section>
      ) : null}
    </>
  );
}

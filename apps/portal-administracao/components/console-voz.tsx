'use client';
// ─────────────────────────────────────────────────────────────────────────────
// CONSOLE DE VOZ (2026-10-19, corrigido em 2026-10-20) — o dono conversa com a
// AHRI falando. O cérebro é o JARVIS, que já existe e responde fundamentado nos
// read models; a voz só abre e fecha a porta.
//
// DOIS MODOS, escolhidos sozinho no carregamento:
//
//   SERVIDOR   Whisper transcreve e o TTS responde. Melhor qualidade. Exige
//              OPENAI_API_KEY na API.
//   NAVEGADOR  o reconhecimento e a voz do próprio aparelho. Custo zero e
//              nenhuma conta nova, mas a voz soa mecânica e o Safari do iPhone
//              não reconhece fala.
//
// Por que os dois: em 2026-10-20 o dono tentou usar e levou "não entendi o
// áudio" no PC e no celular. A causa não era o áudio — era a chave da OpenAI
// nunca ter sido preenchida, e a minha mensagem tratava as duas coisas como
// uma. Agora a tela sabe qual modo está ativo, diz isso, e funciona hoje mesmo
// sem depender de conta nova.
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react';
import { ouvirAudio, falarTexto, perguntarJarvis, estadoDaVoz } from '../lib/actions';

type De = 'dono' | 'ahri';
interface Turno {
  de: De;
  texto: string;
  /** data: URL do MP3, quando a resposta veio falada pelo servidor. */
  audio?: string;
}
type Modo = 'carregando' | 'servidor' | 'navegador' | 'sem-voz';

// O reconhecimento de fala do navegador não está na lib de tipos deste
// projeto (é API de rascunho, só Chrome e Edge). Declaramos o mínimo que
// usamos — melhor isso que `any`, que esconderia erro de verdade.
interface ResultadoDeFala {
  readonly transcript: string;
}
interface EventoDeFala {
  readonly results: ArrayLike<ArrayLike<ResultadoDeFala>>;
}
interface ReconhecimentoDeFala {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((evento: EventoDeFala) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

/** O histórico que acompanha a pergunta — o mesmo teto do Founder Console. */
const TETO_HISTORICO = 12;

/** O reconhecimento de fala do navegador, onde existir (Chrome e Edge). */
function reconhecedorDoNavegador(): (new () => ReconhecimentoDeFala) | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => ReconhecimentoDeFala;
    webkitSpeechRecognition?: new () => ReconhecimentoDeFala;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** Lê o Blob gravado como base64 puro (sem o prefixo data:). */
function comoBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onloadend = () => {
      const r = typeof leitor.result === 'string' ? leitor.result : '';
      resolve(r.includes(',') ? r.slice(r.indexOf(',') + 1) : r);
    };
    leitor.onerror = () => {
      reject(new Error('não consegui ler o áudio gravado'));
    };
    leitor.readAsDataURL(blob);
  });
}

const ConsoleVoz = (): ReactElement => {
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [modo, setModo] = useState<Modo>('carregando');
  const [gravando, setGravando] = useState(false);
  const [etapa, setEtapa] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [digitado, setDigitado] = useState('');
  const [falaAtiva, setFalaAtiva] = useState(true);

  const gravadorRef = useRef<MediaRecorder | null>(null);
  const pedacosRef = useRef<Blob[]>([]);
  const reconhecedorRef = useRef<ReconhecimentoDeFala | null>(null);
  const fimRef = useRef<HTMLDivElement | null>(null);

  // Qual modo usar: servidor se houver chave; senão o navegador, se ele souber.
  useEffect(() => {
    let vivo = true;
    void (async () => {
      const estado = await estadoDaVoz();
      if (!vivo) return;
      if (estado?.disponivel === true) setModo('servidor');
      else setModo(reconhecedorDoNavegador() !== null ? 'navegador' : 'sem-voz');
    })();
    return () => {
      vivo = false;
    };
  }, []);

  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [turnos, etapa]);

  /** Fala a resposta: TTS do servidor quando há; senão a voz do aparelho. */
  const dizerEmVoz = useCallback(
    async (texto: string): Promise<void> => {
      if (!falaAtiva) return;
      setEtapa('falando…');
      if (modo === 'servidor') {
        const voz = await falarTexto(texto);
        if (voz?.audioBase64 != null && voz.audioBase64 !== '') {
          const url = `data:${voz.mime ?? 'audio/mpeg'};base64,${voz.audioBase64}`;
          setTurnos((anteriores) =>
            anteriores.map((t, i) => (i === anteriores.length - 1 ? { ...t, audio: url } : t)),
          );
          void new Audio(url).play().catch(() => undefined); // autoplay barrado ⇒ o controle do turno toca
        }
        return;
      }
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        const fala = new SpeechSynthesisUtterance(texto);
        fala.lang = 'pt-BR';
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(fala);
      }
    },
    [falaAtiva, modo],
  );

  /** O miolo: pergunta (já em texto) → Jarvis → fala. */
  const perguntar = useCallback(
    async (pergunta: string, historico: Turno[]): Promise<void> => {
      setEtapa('pensando…');
      const resumo = historico.slice(-TETO_HISTORICO).map((t) => ({ de: t.de, texto: t.texto }));
      const r = await perguntarJarvis(pergunta, undefined, resumo);
      const resposta = r?.resposta ?? 'Não consegui responder agora. Tenta de novo?';
      setTurnos((anteriores) => [...anteriores, { de: 'ahri', texto: resposta }]);
      await dizerEmVoz(resposta);
      setEtapa(null);
    },
    [dizerEmVoz],
  );

  /** Põe a pergunta na tela e manda ao Jarvis (sem depender do estado anterior). */
  const seguirCom = useCallback(
    async (texto: string): Promise<void> => {
      const turnoDono: Turno = { de: 'dono', texto };
      let historico: Turno[] = [];
      setTurnos((anteriores) => {
        historico = anteriores;
        return [...anteriores, turnoDono];
      });
      await perguntar(texto, [...historico, turnoDono]);
    },
    [perguntar],
  );

  const enviarAudio = useCallback(
    async (blob: Blob): Promise<void> => {
      setErro(null);
      setEtapa('ouvindo…');
      try {
        const base64 = await comoBase64(blob);
        const ouvido = await ouvirAudio(base64, blob.type || 'audio/webm');
        if (ouvido === null || ouvido.texto.trim() === '') {
          setEtapa(null);
          setErro('Não entendi o áudio. Fala de novo, um pouco mais perto do microfone.');
          return;
        }
        await seguirCom(ouvido.texto);
      } catch (e) {
        setEtapa(null);
        setErro(e instanceof Error ? e.message : 'falha ao enviar o áudio');
      }
    },
    [seguirCom],
  );

  /** Modo SERVIDOR: grava o trecho e manda inteiro para o Whisper. */
  const alternarGravacao = useCallback(async (): Promise<void> => {
    if (gravando) {
      gravadorRef.current?.stop();
      setGravando(false);
      return;
    }
    setErro(null);
    try {
      const fluxo = await navigator.mediaDevices.getUserMedia({ audio: true });
      const gravador = new MediaRecorder(fluxo);
      pedacosRef.current = [];
      gravador.ondataavailable = (evento) => {
        if (evento.data.size > 0) pedacosRef.current.push(evento.data);
      };
      gravador.onstop = () => {
        for (const faixa of fluxo.getTracks()) faixa.stop(); // apaga o indicador do navegador
        const blob = new Blob(pedacosRef.current, { type: gravador.mimeType });
        if (blob.size > 0) void enviarAudio(blob);
      };
      gravador.start();
      gravadorRef.current = gravador;
      setGravando(true);
    } catch {
      setErro(
        'Não consegui abrir o microfone. Autorize o acesso no navegador — e confira que o endereço está em HTTPS.',
      );
    }
  }, [gravando, enviarAudio]);

  /** Modo NAVEGADOR: o próprio aparelho reconhece e devolve o texto. */
  const alternarReconhecimento = useCallback((): void => {
    if (gravando) {
      reconhecedorRef.current?.stop();
      setGravando(false);
      return;
    }
    const Reconhecedor = reconhecedorDoNavegador();
    if (Reconhecedor === null) {
      setErro('Este navegador não reconhece fala. Use o Chrome, ou escreva a pergunta abaixo.');
      return;
    }
    setErro(null);
    const r = new Reconhecedor();
    r.lang = 'pt-BR';
    r.continuous = false;
    r.interimResults = false;
    r.onresult = (evento: EventoDeFala) => {
      const texto = (evento.results[0]?.[0]?.transcript ?? '').trim();
      setGravando(false);
      if (texto === '') {
        setErro('Não entendi. Fala de novo, um pouco mais perto do microfone.');
        return;
      }
      void seguirCom(texto);
    };
    r.onerror = () => {
      setGravando(false);
      setErro('O microfone não respondeu. Autorize o acesso e tente de novo.');
    };
    r.onend = () => {
      setGravando(false);
    };
    r.start();
    reconhecedorRef.current = r;
    setGravando(true);
  }, [gravando, seguirCom]);

  const enviarDigitado = useCallback(async (): Promise<void> => {
    const texto = digitado.trim();
    if (texto === '' || etapa !== null) return;
    setDigitado('');
    await seguirCom(texto);
  }, [digitado, etapa, seguirCom]);

  const ocupado = etapa !== null;
  const podeFalar = modo === 'servidor' || modo === 'navegador';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* ── Em que modo estamos: o dono precisa saber, não adivinhar ───── */}
      {modo === 'navegador' ? (
        <div className="aviso-box">
          Usando a voz do próprio aparelho (sem custo). Funciona no Chrome; no iPhone o
          reconhecimento falha. Para a voz boa da AHRI, configure a <code>OPENAI_API_KEY</code> na
          API.
        </div>
      ) : null}
      {modo === 'sem-voz' ? (
        <div className="error-box">
          Este navegador não reconhece fala e o servidor está sem <code>OPENAI_API_KEY</code>. Dá
          para conversar por escrito aqui embaixo enquanto isso.
        </div>
      ) : null}

      {/* ── A conversa ─────────────────────────────────────────────────── */}
      <div
        className="card"
        style={{ minHeight: 280, maxHeight: '52vh', overflowY: 'auto', padding: 16 }}
      >
        {turnos.length === 0 ? (
          <p className="page-sub" style={{ margin: 0 }}>
            Pergunte o que quiser. Sobre a operação — <em>quantos clientes entraram hoje</em>,{' '}
            <em>como está a carteira da Gracielly</em> — ou sobre qualquer outro assunto,{' '}
            <em>inclusive sobre ela mesma</em>.
          </p>
        ) : (
          turnos.map((t, i) => (
            <div
              key={`${String(i)}-${t.texto.slice(0, 12)}`}
              style={{
                margin: '0 0 12px',
                display: 'flex',
                justifyContent: t.de === 'dono' ? 'flex-end' : 'flex-start',
              }}
            >
              <div
                style={{
                  maxWidth: '82%',
                  padding: '10px 14px',
                  borderRadius: 14,
                  background: t.de === 'dono' ? '#1b1a18' : '#f2efe7',
                  color: t.de === 'dono' ? '#fff' : '#1b1a18',
                  whiteSpace: 'pre-wrap',
                  lineHeight: 1.45,
                }}
              >
                {t.texto}
                {t.audio !== undefined ? (
                  <audio controls src={t.audio} style={{ display: 'block', marginTop: 8 }} />
                ) : null}
              </div>
            </div>
          ))
        )}
        <div ref={fimRef} />
      </div>

      {erro !== null ? <div className="error-box">{erro}</div> : null}

      {/* ── O microfone ────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <button
          type="button"
          className="btn primary"
          disabled={ocupado || !podeFalar}
          onClick={() => {
            if (modo === 'servidor') void alternarGravacao();
            else alternarReconhecimento();
          }}
          style={{
            fontSize: 17,
            padding: '14px 26px',
            borderRadius: 999,
            background: gravando ? '#c1121f' : undefined,
          }}
        >
          {gravando ? '⏹ Parar' : '🎙 Falar'}
        </button>
        {ocupado ? <span className="badge">{etapa}</span> : null}
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          <input
            type="checkbox"
            checked={falaAtiva}
            onChange={(e) => {
              setFalaAtiva(e.target.checked);
            }}
          />
          responder em voz
        </label>
      </div>

      {/* ── A saída por texto: microfone bloqueado não trava a conversa ── */}
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={digitado}
          placeholder="…ou escreva a pergunta aqui"
          style={{ flex: 1 }}
          onChange={(e) => {
            setDigitado(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void enviarDigitado();
          }}
        />
        <button
          type="button"
          className="btn"
          disabled={ocupado || digitado.trim() === ''}
          onClick={() => {
            void enviarDigitado();
          }}
        >
          Enviar
        </button>
      </div>
    </div>
  );
};

export default ConsoleVoz;

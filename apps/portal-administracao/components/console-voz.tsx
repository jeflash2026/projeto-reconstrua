'use client';
// ─────────────────────────────────────────────────────────────────────────────
// CONSOLE DE VOZ (2026-10-19) — o dono conversa com a AHRI falando.
//
// Pedido: "um link onde eu acesse por PC ou celular e consiga conversar por
// áudio, e a AHRI me responder por áudio, sobre o Projeto Reconstrua ou
// qualquer pergunta".
//
// O cérebro é o JARVIS, que já existe e responde fundamentado nos read models
// — a voz não pensa nada por conta própria, só abre e fecha a porta. O ciclo:
//
//   microfone → /admin/voz/ouvir (Whisper) → transcrição NA TELA
//             → /admin/founder/jarvis      → resposta NA TELA
//             → /admin/voz/falar (TTS)     → áudio tocando
//
// A transcrição aparece ANTES da resposta de propósito: falar com máquina é
// desconfortável, e saber que foi ouvido corretamente vale mais que a pressa.
//
// Degrada por partes, nunca em branco: sem microfone, dá para digitar; sem
// transcrição, a tela diz; sem TTS, a resposta fica só escrita. Nenhuma dessas
// falhas derruba a conversa.
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react';
import { ouvirAudio, falarTexto, perguntarJarvis } from '../lib/actions';

type De = 'dono' | 'ahri';
interface Turno {
  de: De;
  texto: string;
  /** data: URL do MP3, quando a resposta saiu falada. */
  audio?: string;
}

/** O histórico que acompanha a pergunta — o mesmo teto do Founder Console. */
const TETO_HISTORICO = 12;

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
  const [gravando, setGravando] = useState(false);
  const [etapa, setEtapa] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [digitado, setDigitado] = useState('');
  const [falaAtiva, setFalaAtiva] = useState(true);

  const gravadorRef = useRef<MediaRecorder | null>(null);
  const pedacosRef = useRef<Blob[]>([]);
  const fimRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [turnos, etapa]);

  /** O miolo: pergunta (já em texto) → Jarvis → fala. */
  const perguntar = useCallback(
    async (pergunta: string, historico: Turno[]): Promise<void> => {
      setEtapa('pensando…');
      const resumo = historico.slice(-TETO_HISTORICO).map((t) => ({ de: t.de, texto: t.texto }));
      const r = await perguntarJarvis(pergunta, undefined, resumo);
      const resposta = r?.resposta ?? 'Não consegui responder agora. Tenta de novo?';
      setTurnos((anteriores) => [...anteriores, { de: 'ahri', texto: resposta }]);

      if (!falaAtiva) {
        setEtapa(null);
        return;
      }
      setEtapa('falando…');
      const voz = await falarTexto(resposta);
      if (voz?.audioBase64 != null && voz.audioBase64 !== '') {
        const url = `data:${voz.mime ?? 'audio/mpeg'};base64,${voz.audioBase64}`;
        setTurnos((anteriores) =>
          anteriores.map((t, i) => (i === anteriores.length - 1 ? { ...t, audio: url } : t)),
        );
        void new Audio(url).play().catch(() => undefined); // autoplay bloqueado ⇒ o botão do turno toca
      }
      setEtapa(null);
    },
    [falaAtiva],
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
        const turnoDono: Turno = { de: 'dono', texto: ouvido.texto };
        let historico: Turno[] = [];
        setTurnos((anteriores) => {
          historico = anteriores;
          return [...anteriores, turnoDono];
        });
        await perguntar(ouvido.texto, [...historico, turnoDono]);
      } catch (e) {
        setEtapa(null);
        setErro(e instanceof Error ? e.message : 'falha ao enviar o áudio');
      }
    },
    [perguntar],
  );

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
        // Solta o microfone: sem isto o indicador do navegador fica aceso.
        for (const faixa of fluxo.getTracks()) faixa.stop();
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

  const enviarDigitado = useCallback(async (): Promise<void> => {
    const texto = digitado.trim();
    if (texto === '' || etapa !== null) return;
    setDigitado('');
    const turnoDono: Turno = { de: 'dono', texto };
    let historico: Turno[] = [];
    setTurnos((anteriores) => {
      historico = anteriores;
      return [...anteriores, turnoDono];
    });
    await perguntar(texto, [...historico, turnoDono]);
  }, [digitado, etapa, perguntar]);

  const ocupado = etapa !== null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* ── A conversa ─────────────────────────────────────────────────── */}
      <div
        className="card"
        style={{ minHeight: 320, maxHeight: '52vh', overflowY: 'auto', padding: 16 }}
      >
        {turnos.length === 0 ? (
          <p className="page-sub" style={{ margin: 0 }}>
            Toque no microfone e pergunte. Por exemplo: <em>quantos clientes entraram hoje</em>,{' '}
            <em>como está a carteira da Gracielly</em> ou <em>quem está parado sem HISCON</em>.
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
          disabled={ocupado}
          onClick={() => {
            void alternarGravacao();
          }}
          style={{
            fontSize: 17,
            padding: '14px 26px',
            borderRadius: 999,
            background: gravando ? '#c1121f' : undefined,
          }}
        >
          {gravando ? '⏹ Parar e enviar' : '🎙 Falar'}
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

      {/* ── A saída por texto: microfone bloqueado não pode travar a conversa ── */}
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

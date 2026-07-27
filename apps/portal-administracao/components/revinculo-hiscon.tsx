'use client';
// REVÍNCULO DO HISCON (caso Roberto) — para cada chat cujo HISCON registrado
// não serve, mostra os PDFs da MESMA conversa que o leitor lê com auditoria
// conferida. O clique em "Religar" é a autorização EXPLÍCITA do dono (com
// confirmação em 2 passos); a API reverifica tudo do zero e guarda backup.
import { useRef, useState, type ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import {
  pdAplicarRevinculo,
  pdUploadHiscon,
  type RevinculoCandidato,
  type RevinculoLinha,
  type RevinculoUploadResultado,
} from '../lib/actions';

const dataCurta = (iso: string | null): string =>
  iso === null ? 'data desconhecida' : new Date(iso).toLocaleString('pt-BR');

const Candidato = ({
  chatId,
  candidato,
}: {
  chatId: string;
  candidato: RevinculoCandidato;
}): ReactElement => {
  const router = useRouter();
  const [confirmando, setConfirmando] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feito, setFeito] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const religar = async (): Promise<void> => {
    if (busy) return;
    setBusy(true);
    setErro(null);
    const r = await pdAplicarRevinculo(chatId, candidato.sha256);
    if (r === null) setErro('A API não respondeu — tente novamente.');
    else if (!r.ok) setErro(r.motivo);
    else {
      setFeito(
        `Religado: ${String(r.contratos)} contrato(s)` +
          (r.beneficiario !== null ? ` — ${r.beneficiario}` : ''),
      );
      router.refresh();
    }
    setBusy(false);
    setConfirmando(false);
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
      <div style={{ fontSize: 13 }}>
        <strong>{candidato.beneficiario ?? 'beneficiário não identificado'}</strong> ·{' '}
        {candidato.contratos} contrato(s)
        {candidato.declarado !== null
          ? ` · documento declara ${String(candidato.declarado.ativos)} ativo(s) / ${String(candidato.declarado.suspensos)} susp.`
          : ''}{' '}
        · recebido em {dataCurta(candidato.em)}
      </div>
      {feito !== null ? (
        <span className="badge accent">{feito}</span>
      ) : confirmando ? (
        <span style={{ display: 'inline-flex', gap: 8 }}>
          <button className="primary" disabled={busy} onClick={() => void religar()}>
            {busy ? 'Religando…' : 'Confirmar — religar a este PDF'}
          </button>
          <button
            disabled={busy}
            onClick={() => {
              setConfirmando(false);
            }}
          >
            Cancelar
          </button>
        </span>
      ) : (
        <button
          onClick={() => {
            setConfirmando(true);
          }}
        >
          Religar…
        </button>
      )}
      {erro !== null ? <span className="error-box">{erro}</span> : null}
    </div>
  );
};

/** Upload manual: o anexo original nunca foi capturado — o dono sobe o PDF do
 *  WhatsApp dele. 2 passos: dry-run (mostra o beneficiário) → confirmar. */
const EnviarHiscon = ({ chatId }: { chatId: string }): ReactElement => {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [base64, setBase64] = useState<string | null>(null);
  const [previa, setPrevia] = useState<RevinculoUploadResultado | null>(null);
  const [busy, setBusy] = useState(false);
  const [feito, setFeito] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const lerArquivo = (file: File): void => {
    setErro(null);
    setPrevia(null);
    const reader = new FileReader();
    reader.onload = () => {
      const conteudo = typeof reader.result === 'string' ? reader.result : '';
      const b64 = conteudo.includes(',') ? conteudo.slice(conteudo.indexOf(',') + 1) : conteudo;
      setBase64(b64);
      void (async () => {
        setBusy(true);
        const r = await pdUploadHiscon(chatId, b64, false); // DRY-RUN: nada gravado
        if (r === null) setErro('A API não respondeu — tente novamente.');
        else if (!r.ok) setErro(r.motivo);
        else setPrevia(r);
        setBusy(false);
      })();
    };
    reader.readAsDataURL(file);
  };

  const confirmar = async (): Promise<void> => {
    if (busy || base64 === null) return;
    setBusy(true);
    setErro(null);
    const r = await pdUploadHiscon(chatId, base64, true);
    if (r === null) setErro('A API não respondeu — tente novamente.');
    else if (!r.ok) setErro(r.motivo);
    else {
      setFeito(
        `Religado: ${String(r.contratos)} contrato(s)` +
          (r.beneficiario !== null ? ` — ${r.beneficiario}` : ''),
      );
      router.refresh();
    }
    setBusy(false);
    setPrevia(null);
  };

  if (feito !== null) return <span className="badge accent">{feito}</span>;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 6 }}>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) lerArquivo(file);
          e.target.value = '';
        }}
      />
      {previa !== null && previa.ok ? (
        <>
          <span style={{ fontSize: 13 }}>
            O PDF lê: <strong>{previa.beneficiario ?? 'beneficiário não identificado'}</strong> ·{' '}
            {previa.contratos} contrato(s)
            {previa.declarado !== null
              ? ` · declara ${String(previa.declarado.ativos)} ativo(s) / ${String(previa.declarado.suspensos)} susp.`
              : ''}{' '}
            — confira se o nome é deste cliente.
          </span>
          <button className="primary" disabled={busy} onClick={() => void confirmar()}>
            {busy ? 'Religando…' : 'Confirmar — religar a este PDF'}
          </button>
          <button
            disabled={busy}
            onClick={() => {
              setPrevia(null);
              setBase64(null);
            }}
          >
            Cancelar
          </button>
        </>
      ) : (
        <button disabled={busy} onClick={() => inputRef.current?.click()}>
          {busy ? 'Lendo o PDF…' : 'Enviar HISCON do meu WhatsApp (PDF)…'}
        </button>
      )}
      {erro !== null ? <span className="error-box">{erro}</span> : null}
    </div>
  );
};

const RevinculoHiscon = ({ linhas }: { linhas: RevinculoLinha[] }): ReactElement | null => {
  if (linhas.length === 0) return null;
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <h3>Revínculo — o HISCON registrado aponta ao anexo errado</h3>
      <p className="page-sub" style={{ marginTop: 4 }}>
        Para estes clientes, o documento registrado como HISCON não é legível — mas a conversa deles
        pode ter o PDF certo. Confira o <strong>nome do beneficiário</strong> e religue. O vínculo
        antigo fica guardado em backup (reversível) e a leitura nova entra na hora.
      </p>
      <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 12 }}>
        {linhas.map((l) => (
          <li key={l.chatId} style={{ borderTop: '1px solid var(--border, #333)', paddingTop: 10 }}>
            <div className="mono" style={{ fontSize: 13, marginBottom: 6 }}>
              {l.chatId} — <em>{l.motivoAtual}</em>
            </div>
            {l.candidatos.length === 0 ? (
              <div style={{ fontSize: 13 }}>
                Nenhum PDF legível encontrado nesta conversa — envie o arquivo do seu WhatsApp
                abaixo, ou peça o HISCON em PDF ao cliente.
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 8 }}>
                {l.candidatos.map((c) => (
                  <Candidato key={c.sha256} chatId={l.chatId} candidato={c} />
                ))}
              </div>
            )}
            <EnviarHiscon chatId={l.chatId} />
          </li>
        ))}
      </ul>
    </div>
  );
};

export default RevinculoHiscon;

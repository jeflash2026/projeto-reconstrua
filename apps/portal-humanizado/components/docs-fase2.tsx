'use client';
// DOCS DA FASE 2 (Onda 2, 2026-07-31) — o anexo dos 4 documentos pelo
// Atendimento Humanizado: procuração assinada, RG (frente e verso) e
// comprovante de endereço. Mesmo docs-equipe do Admin; o advogado destinado
// baixa tudo no portal dele. PDF/JPG/PNG até 20 MB.
//
// Caso REAL Helio Fontes (2026-08-03): o envio da procuração ficava
// "Enviando…" para sempre — o limite de 1 MB (server action + Fastify)
// derrubava a chamada sem erro visível. Além dos limites (corrigidos), aqui:
// o botão NUNCA trava (finally), o tamanho é conferido ANTES do envio e a
// página é atualizada ao concluir (selos ficam verdes; completos saem da fila).
import { useEffect, useState, type ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import { anexarDoc, listarDocs, removerDoc } from '../lib/actions';
import type { DocEquipe } from '../lib/api';

const TIPOS = [
  { valor: 'procuracao', rotulo: 'Procuração assinada' },
  { valor: 'rg', rotulo: 'RG (frente ou verso)' },
  { valor: 'comprovante', rotulo: 'Comprovante de endereço' },
  // Decreto 2026-08-05: 4º documento obrigatório da fase 2.
  { valor: 'extrato_credito', rotulo: 'Extrato de crédito do INSS (3 meses)' },
  { valor: 'outro', rotulo: 'Outro documento' },
];

const MAX_BYTES = 20 * 1024 * 1024; // a MESMA régua do DocsEquipeService

const DocsFase2 = ({ chatId }: { chatId: string }): ReactElement => {
  const router = useRouter();
  const [docs, setDocs] = useState<DocEquipe[]>([]);
  const [tipo, setTipo] = useState('procuracao');
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void listarDocs(chatId).then(setDocs);
  }, [chatId]);

  const enviar = async (): Promise<void> => {
    if (arquivo === null || busy) return;
    if (arquivo.size > MAX_BYTES) {
      setErro(
        `Arquivo de ${(arquivo.size / 1024 / 1024).toFixed(1)} MB — o limite é 20 MB. Reduza o PDF (ou envie por partes) e tente de novo.`,
      );
      return;
    }
    setBusy(true);
    setErro(null);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const r = reader.result;
          resolve(typeof r === 'string' ? r : '');
        };
        reader.onerror = () => {
          reject(new Error('falha na leitura do arquivo'));
        };
        reader.readAsDataURL(arquivo);
      });
      if (base64 === '') {
        setErro('não consegui ler o arquivo — tente novamente');
        return;
      }
      const r = await anexarDoc(chatId, tipo, arquivo.name, base64);
      if (!r.ok) {
        setErro(r.error ?? 'falha no envio — tente novamente');
        return;
      }
      setArquivo(null);
      setDocs(await listarDocs(chatId));
      // Atualiza a página: os selos ficam verdes e, com os 4 documentos, o
      // cliente sai da fila de pendentes e segue para o perito.
      router.refresh();
    } catch {
      setErro('falha no envio — verifique a conexão e tente novamente');
    } finally {
      setBusy(false); // o botão NUNCA fica preso em "Enviando…"
    }
  };

  const remover = async (id: string): Promise<void> => {
    await removerDoc(chatId, id);
    setDocs(await listarDocs(chatId));
    router.refresh();
  };

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <select
          value={tipo}
          onChange={(e) => {
            setTipo(e.target.value);
          }}
        >
          {TIPOS.map((t) => (
            <option key={t.valor} value={t.valor}>
              {t.rotulo}
            </option>
          ))}
        </select>
        <input
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          onChange={(e) => {
            setArquivo(e.target.files?.[0] ?? null);
            setErro(null);
          }}
        />
        <button
          type="button"
          className="btn primary"
          disabled={busy || arquivo === null}
          onClick={() => {
            void enviar();
          }}
        >
          {busy ? 'Enviando…' : 'Anexar'}
        </button>
      </div>
      {erro !== null ? <div className="error-box">{erro}</div> : null}
      {docs.length > 0 ? (
        <ul style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: 13 }}>
          {docs.map((d) => (
            <li key={d.id} style={{ margin: '3px 0' }}>
              <strong>{d.rotulo}</strong> — <span className="mono">{d.nome}</span>{' '}
              {/* Pedido do dono (2026-08-04): PRÉ-VISUALIZAR o anexo — a
                  secretária confere se enviou o arquivo certo. Abre em nova
                  aba (foto/PDF inline); âncora crua leva o basePath explícito
                  (lição do 'ver documento'). */}
              <a
                className="btn"
                style={{ fontSize: 11, padding: '1px 8px', marginLeft: 6 }}
                href={`/humanizado/api/doc/${encodeURIComponent(chatId)}/${encodeURIComponent(d.id)}`}
                target="_blank"
                rel="noreferrer"
              >
                ver
              </a>{' '}
              <button
                type="button"
                className="btn"
                style={{ fontSize: 11, padding: '1px 8px', marginLeft: 4 }}
                disabled={busy}
                onClick={() => {
                  void remover(d.id);
                }}
              >
                remover
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
};

export default DocsFase2;

'use client';
// DOCS DA FASE 2 (Onda 2, 2026-07-31) — o anexo dos 3 documentos pelo
// Atendimento Humanizado: procuração assinada, RG (frente e verso) e
// comprovante de endereço. Mesmo docs-equipe do Admin; o advogado destinado
// baixa tudo no portal dele. PDF/JPG/PNG até 20 MB.
import { useEffect, useState, type ReactElement } from 'react';
import { anexarDoc, listarDocs, removerDoc } from '../lib/actions';
import type { DocEquipe } from '../lib/api';

const TIPOS = [
  { valor: 'procuracao', rotulo: 'Procuração assinada' },
  { valor: 'rg', rotulo: 'RG (frente ou verso)' },
  { valor: 'comprovante', rotulo: 'Comprovante de endereço' },
  { valor: 'outro', rotulo: 'Outro documento' },
];

const DocsFase2 = ({ chatId }: { chatId: string }): ReactElement => {
  const [docs, setDocs] = useState<DocEquipe[]>([]);
  const [tipo, setTipo] = useState('procuracao');
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const carregar = async (): Promise<void> => {
    setDocs(await listarDocs(chatId));
  };
  useEffect(() => {
    void listarDocs(chatId).then(setDocs);
  }, [chatId]);

  const enviar = async (): Promise<void> => {
    if (arquivo === null || busy) return;
    setBusy(true);
    setErro(null);
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
    }).catch(() => '');
    if (base64 === '') {
      setErro('não consegui ler o arquivo — tente novamente');
      setBusy(false);
      return;
    }
    const r = await anexarDoc(chatId, tipo, arquivo.name, base64);
    if (!r.ok) setErro(r.error ?? 'falha no envio');
    setArquivo(null);
    await carregar();
    setBusy(false);
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
              <button
                type="button"
                className="btn"
                style={{ fontSize: 11, padding: '1px 8px', marginLeft: 6 }}
                onClick={() => {
                  void removerDoc(chatId, d.id).then(() => carregar());
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

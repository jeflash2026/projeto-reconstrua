'use client';
// DOCS DA EQUIPE (decreto 2026-07-30) — a fase 2 HUMANA da coleta: o time do
// dono anexa a PROCURAÇÃO ASSINADA, o RG e o COMPROVANTE DE ENDEREÇO ao
// cadastro do cliente concluso da fase 1. Os arquivos vão ao mesmo cofre dos
// documentos do WhatsApp e aparecem para download no Portal do Advogado.
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import {
  docsEquipeAnexar,
  docsEquipeListar,
  docsEquipeRemover,
  type DocEquipe,
} from '../lib/actions';

const TIPOS: ReadonlyArray<{ valor: string; rotulo: string }> = [
  { valor: 'procuracao', rotulo: 'Procuração assinada' },
  { valor: 'rg', rotulo: 'RG' },
  { valor: 'comprovante', rotulo: 'Comprovante de endereço' },
  // Decreto 2026-08-05: 4º documento obrigatório da fase 2.
  { valor: 'extrato_credito', rotulo: 'Extrato de crédito do INSS (3 meses)' },
  { valor: 'outro', rotulo: 'Outro documento' },
];

const DocsEquipe = ({ chatId }: { chatId: string }): ReactElement => {
  const [docs, setDocs] = useState<DocEquipe[]>([]);
  const [tipo, setTipo] = useState('procuracao');
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async (): Promise<void> => {
    const r = await docsEquipeListar(chatId);
    if (r) setDocs(r.docs);
  }, [chatId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const anexar = async (file: File): Promise<void> => {
    setBusy(true);
    setErro(null);
    const base64 = await new Promise<string>((resolve, reject) => {
      const leitor = new FileReader();
      leitor.onload = () => {
        resolve(typeof leitor.result === 'string' ? leitor.result : '');
      };
      leitor.onerror = () => {
        reject(new Error('falha na leitura do arquivo'));
      };
      leitor.readAsDataURL(file);
    }).catch(() => '');
    if (base64 === '') {
      setErro('Não consegui ler o arquivo — tente de novo.');
      setBusy(false);
      return;
    }
    const r = await docsEquipeAnexar(chatId, tipo, file.name, base64);
    if (!r || !r.ok) setErro(r?.error ?? 'Falha ao anexar (API indisponível).');
    await carregar();
    setBusy(false);
  };

  const remover = async (id: string): Promise<void> => {
    setBusy(true);
    await docsEquipeRemover(chatId, id);
    await carregar();
    setBusy(false);
  };

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <h3 style={{ marginTop: 0 }}>Documentos da equipe (fase 2 — procuração, RG, comprovante)</h3>
      <p className="page-sub" style={{ marginTop: -4 }}>
        Anexe aqui o que o time colher fora do WhatsApp — o advogado destinado baixa tudo no portal
        dele. PDF, JPG ou PNG, até 20 MB.
      </p>
      <div className="form-row" style={{ alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <select
          value={tipo}
          onChange={(e) => {
            setTipo(e.target.value);
          }}
          disabled={busy}
        >
          {TIPOS.map((t) => (
            <option key={t.valor} value={t.valor}>
              {t.rotulo}
            </option>
          ))}
        </select>
        <input
          type="file"
          accept="application/pdf,image/jpeg,image/png"
          disabled={busy}
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) void anexar(f);
          }}
        />
        {busy ? <span className="badge">Enviando…</span> : null}
      </div>
      {erro ? (
        <div className="error-box" style={{ marginTop: 8 }}>
          {erro}
        </div>
      ) : null}
      {docs.length === 0 ? (
        <div className="empty" style={{ marginTop: 8 }}>
          Nenhum documento da equipe anexado ainda.
        </div>
      ) : (
        <div className="table-wrap" style={{ marginTop: 10 }}>
          <table>
            <thead>
              <tr>
                <th>Documento</th>
                <th>Arquivo</th>
                <th>Anexado em</th>
                <th>Ação</th>
              </tr>
            </thead>
            <tbody>
              {docs.map((d) => (
                <tr key={d.id}>
                  <td style={{ fontWeight: 600 }}>{d.rotulo}</td>
                  <td className="mono" style={{ fontSize: 12 }}>
                    {d.nome}
                  </td>
                  <td>{new Date(d.em).toLocaleString('pt-BR')}</td>
                  <td>
                    <button disabled={busy} onClick={() => void remover(d.id)}>
                      Remover
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default DocsEquipe;

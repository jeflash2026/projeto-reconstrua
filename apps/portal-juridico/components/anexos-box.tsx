'use client';
// ANEXOS (cliente e contrato) — upload até 10 MB (PDF, Word, Excel, imagens,
// TXT, CSV ou ZIP) e lista com download, como no original.
import { useState, type ReactElement } from 'react';
import type { AnexoJuridico } from '../lib/api';

export default function AnexosBox({
  titulo,
  anexos,
  destino,
  baseDownload,
}: {
  titulo: string;
  anexos: AnexoJuridico[];
  destino: string;
  baseDownload: string;
}): ReactElement {
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  function enviar(file: File): void {
    setErro(null);
    setOcupado(true);
    const leitor = new FileReader();
    leitor.onload = () => {
      const base64 = typeof leitor.result === 'string' ? leitor.result : '';
      void fetch(destino, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ acao: 'anexo', nome: file.name, base64 }),
      })
        .then(async (res) => {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          if (!res.ok) setErro(data.error ?? 'falha no envio');
          else window.location.reload();
        })
        .catch(() => setErro('falha de rede — tente de novo'))
        .finally(() => setOcupado(false));
    };
    leitor.readAsDataURL(file);
  }

  return (
    <div className="secao-form">
      <h3>{titulo}</h3>
      <p className="subtitulo" style={{ marginBottom: 10 }}>
        PDF, Word, Excel, imagens, TXT, CSV ou ZIP até 10 MB por arquivo.
      </p>
      <label className="btn">
        {ocupado ? 'Enviando…' : '📎 Adicionar arquivo'}
        <input
          type="file"
          style={{ display: 'none' }}
          disabled={ocupado}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file !== undefined) enviar(file);
            e.target.value = '';
          }}
        />
      </label>
      {erro !== null ? <div className="erro-box">{erro}</div> : null}
      {anexos.length === 0 ? (
        <p style={{ color: 'var(--ink-dim)' }}>Nenhum anexo enviado.</p>
      ) : (
        <ul style={{ margin: '10px 0 0', paddingLeft: 18 }}>
          {anexos.map((a) => (
            <li key={a.id} style={{ marginBottom: 4 }}>
              <a href={`${baseDownload}/${a.id}`} target="_blank" rel="noreferrer">
                {a.nome}
              </a>{' '}
              <span style={{ color: 'var(--ink-dim)', fontSize: 13 }}>
                ({Math.max(1, Math.round(a.size / 1024))} KB)
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

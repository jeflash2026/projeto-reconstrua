// STATUS DA DOCUMENTAÇÃO NO CHAT (pedido do dono, 2026-08-06) — o cabeçalho da
// conversa mostra o que JÁ FOI confirmado e o que FALTA dos 4 documentos; com
// tudo em mãos, o destaque verde "cliente 100% concluído". Puro: recebe as
// flags da mesa (a mesma fonte dos cards) e só renderiza.
import type { ReactElement } from 'react';

export interface DocsFlags {
  procuracao: boolean;
  rg: boolean;
  comprovante: boolean;
  extratoCredito?: boolean;
}

const ITENS: readonly { chave: keyof DocsFlags; rotulo: string }[] = [
  { chave: 'procuracao', rotulo: 'Procuração' },
  { chave: 'rg', rotulo: 'RG' },
  { chave: 'comprovante', rotulo: 'Comprovante' },
  { chave: 'extratoCredito', rotulo: 'Extrato INSS (3m)' },
];

const StatusDocsCliente = ({
  docs,
  completo,
}: {
  docs: DocsFlags;
  completo: boolean;
}): ReactElement => {
  if (completo) {
    return (
      <div className="cliente-concluido">
        ✅ <strong>Cliente 100% concluído</strong> — documentação completa, seguiu para o perito.
      </div>
    );
  }
  const faltando = ITENS.filter((i) => docs[i.chave] !== true);
  return (
    <div className="docs-status">
      {ITENS.map((i) => (
        <span key={i.chave} className={`badge ${docs[i.chave] === true ? 'ok' : 'warn'}`}>
          {docs[i.chave] === true ? '✓' : '•'} {i.rotulo}
        </span>
      ))}
      {faltando.length > 0 ? (
        <span className="docs-falta">
          falta{faltando.length > 1 ? 'm' : ''}: {faltando.map((i) => i.rotulo).join(', ')}
        </span>
      ) : null}
    </div>
  );
};

export default StatusDocsCliente;

// CARREGAMENTO INSTANTÂNEO (2026-08-05, "o humanizado está lento para tudo") —
// sem este arquivo, o clique num link fica MUDO até a página nova terminar de
// montar no servidor e parece que nada aconteceu. Com ele, o Next troca a tela
// NA HORA do clique e mostra o preparo enquanto o servidor trabalha. Vale para
// todas as páginas do portal (mesa, conversas, chat).
import type { ReactElement } from 'react';

const Loading = (): ReactElement => (
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '55vh',
      gap: 14,
      color: 'var(--texto-dim, #667)',
    }}
  >
    <div
      style={{
        width: 42,
        height: 42,
        borderRadius: '50%',
        border: '4px solid var(--borda, #ddd)',
        borderTopColor: 'var(--vermelho, #a01e1e)',
        animation: 'girar 0.9s linear infinite',
      }}
    />
    <div style={{ fontSize: 14, fontWeight: 600 }}>Preparando a mesa…</div>
    <div style={{ fontSize: 12 }}>Clientes, conversas e documentos sendo organizados.</div>
    <style>{`@keyframes girar { to { transform: rotate(360deg); } }`}</style>
  </div>
);

export default Loading;

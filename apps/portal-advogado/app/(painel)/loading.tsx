// CARREGAMENTO INSTANTÂNEO (caso Gracielle, 2026-08-05) — sem este arquivo, o
// clique num link do painel fica MUDO até a página nova terminar de montar no
// servidor (a do cliente é pesada) e parece que "não abriu". Com ele, o Next
// troca a tela NA HORA do clique e mostra o preparo enquanto o servidor
// trabalha. Vale para TODAS as navegações do grupo autenticado.
import type { ReactElement } from 'react';

const Loading = (): ReactElement => (
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '50vh',
      gap: 14,
      color: 'var(--text-dim)',
    }}
  >
    <div
      style={{
        width: 42,
        height: 42,
        borderRadius: '50%',
        border: '4px solid var(--border, #333)',
        borderTopColor: 'var(--accent, #d4a437)',
        animation: 'girar 0.9s linear infinite',
      }}
    />
    <div style={{ fontSize: 14, fontWeight: 600 }}>Preparando o dossiê do cliente…</div>
    <div style={{ fontSize: 12 }}>Contratos, processos e documentos sendo organizados.</div>
    <style>{`@keyframes girar { to { transform: rotate(360deg); } }`}</style>
  </div>
);

export default Loading;

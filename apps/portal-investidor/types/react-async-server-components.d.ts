// ─────────────────────────────────────────────────────────────────────────────
// Async SERVER COMPONENTS no React 18 (Next 14) — suporte de TIPOS.
// O runtime já os suporta; o @types/react 18.x só aceita Promise como
// ReactNode através deste gancho OFICIAL de extensão (o comentário no próprio
// index.d.ts: "non-thenables need to be kept in sync with AwaitedReactNode").
// Sem isto, `tsc` em checkout LIMPO (CI Linux, Docker) rejeita
// `<ComponenteAsync />` com TS2786, enquanto ambientes com hoist contaminado
// pelo React 19 passam — este arquivo torna o veredito IGUAL em todo lugar.
// ─────────────────────────────────────────────────────────────────────────────
import type { ReactNode } from 'react';

declare module 'react' {
  interface DO_NOT_USE_OR_YOU_WILL_BE_FIRED_EXPERIMENTAL_REACT_NODES {
    promises: Promise<ReactNode>;
  }
}

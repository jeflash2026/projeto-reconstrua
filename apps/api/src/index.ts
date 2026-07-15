// ─────────────────────────────────────────────────────────────────────────────
// @reconstrua/api — Backend (Fastify). Raiz de composição (composition root).
//
// Responsabilidade futura: expor os casos de uso da Aplicação; é a ÚNICA
// superfície que ESCREVE no Event Store. Nenhuma interface lê o Event Store
// diretamente (decisão do fundador, item 12; DF-08).
//
// Sprint 0: VAZIO — nenhuma rota, nenhuma API implementada (por decisão do
// fundador). Marcador de aplicação apenas. O servidor Fastify será montado em
// sprint futura; nenhum servidor é iniciado nesta fase.
// ─────────────────────────────────────────────────────────────────────────────
export const APP = 'reconstrua/api' as const;

// Sprint 2B: superfície HTTP do Runtime de Conversa (webhook da Evolution).
export { buildServer, type ServerDeps } from './server.js';
export { mapAndProcess, type WebhookResult } from './conversation-webhook.js';

// Sprint 3A: API do Portal Administrativo (read models; nunca o Event Store direto).
export { buildAdminServer } from './admin/admin-server.js';

// Sprint 3B: API do Portal do Advogado (isolado por atribuição; AHRI sempre informada).
export { buildAdvogadoServer } from './advogado/advogado-server.js';

// Sprint 3D: Lawyer Experience (plantão, decisões, preparação noturna, métricas).
export { buildLawyerExperienceServer } from './lawyer-experience/lawyer-experience-server.js';

// Sprint 4A: Produção Real (config, monitor, go-live bloqueante, primeiro cliente).
export { buildProductionServer } from './production/production-server.js';

// Sprint 2E: Founder Console (superfície HTTP "Pergunte qualquer coisa").
export { buildFounderConsoleServer, type FounderConsoleServerDeps } from './founder-console-route.js';

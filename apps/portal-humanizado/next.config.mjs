/** @type {import('next').NextConfig} */
// Portal do ATENDIMENTO HUMANIZADO (Onda 2, decreto 2026-07-31) — APARTADO do
// Admin: a secretária só vê a mesa dela (clientes que CONFIRMARAM o parecer,
// contato pelo WhatsApp humanizado e o anexo dos 3 documentos da fase 2).
// Vive sob /humanizado no mesmo domínio; o NPM faz proxy /humanizado → :3500.
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  basePath: '/humanizado',
  eslint: { ignoreDuringBuilds: true },
  // O gate de TIPOS é o CI (pnpm typecheck + build a cada push, resolução
  // real do workspace). Dentro da imagem Docker o pnpm re-resolve @types de
  // forma não-determinística — o build da imagem SÓ compila.
  typescript: { ignoreBuildErrors: true },
};

export default nextConfig;

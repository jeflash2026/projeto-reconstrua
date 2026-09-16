/** @type {import('next').NextConfig} */
// Portal do INVESTIDOR (2026-09-16) — APARTADO do Admin: o investidor só vê a
// PRÓPRIA carteira de créditos judiciais (clientes por iniciais). Login por
// CPF + senha; a senha nasce pelo link do Admin. Vive sob /investidor no mesmo
// domínio; o NPM faz proxy /investidor → portal-investidor:3900.
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  basePath: '/investidor',
  eslint: { ignoreDuringBuilds: true },
  // O gate de TIPOS é o CI (pnpm typecheck + build a cada push). Dentro da imagem
  // Docker o pnpm re-resolve @types de forma não-determinística — a imagem SÓ compila.
  typescript: { ignoreBuildErrors: true },
};

export default nextConfig;

/** @type {import('next').NextConfig} */
// Portal do SÓCIO (Decreto 2026-07-23) — APARTADO do Admin: o sócio só vê o
// PRÓPRIO rateio (participação, valor, base). Login por CPF+senha; cadastro pelo
// link do Admin. Vive sob /socios no mesmo domínio; o NPM faz proxy /socios → :3600.
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  basePath: '/socios',
  eslint: { ignoreDuringBuilds: true },
  // O gate de TIPOS é o CI (pnpm typecheck + build a cada push). Dentro da imagem
  // Docker o pnpm re-resolve @types de forma não-determinística — a imagem SÓ compila.
  typescript: { ignoreBuildErrors: true },
};

export default nextConfig;

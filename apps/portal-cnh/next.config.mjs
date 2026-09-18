/** @type {import('next').NextConfig} */
// Painel da RECONSTRUA CNH (2026-09-18) — APARTADO do Reconstrua: o funil de
// captação da tese de CNH (leads, conversas da AHRI, follow-ups, aceites).
// Vive sob /cnh no mesmo domínio; o NPM faz proxy /cnh → porta 3950. Fala só
// com o serviço cnh-api (Bearer server-side).
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  basePath: '/cnh',
  eslint: { ignoreDuringBuilds: true },
  // O gate de TIPOS é o CI (typecheck + build a cada push); na imagem Docker a
  // resolução de @types não é determinística — a imagem SÓ compila.
  typescript: { ignoreBuildErrors: true },
};

export default nextConfig;

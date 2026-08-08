/** @type {import('next').NextConfig} */
// PAINEL JURÍDICO (decreto 2026-08-08) — o 2º painel (dono + sócio): gestão do
// pós-protocolo (clientes, processos judiciais, guias, perícias), espelho do
// "Contratos Advocacia". Vive sob /juridico; o NPM faz proxy /juridico → :3800.
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  basePath: '/juridico',
  // Anexos de até 10 MB sobem em base64 (+33%) pelo proxy do portal.
  experimental: { serverActions: { bodySizeLimit: '20mb' } },
  eslint: { ignoreDuringBuilds: true },
  // O gate de TIPOS é o CI (pnpm typecheck + build a cada push) — a imagem
  // Docker só compila (mesma regra dos demais portais).
  typescript: { ignoreBuildErrors: true },
};

export default nextConfig;

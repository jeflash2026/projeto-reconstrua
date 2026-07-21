/** @type {import('next').NextConfig} */
// Portal do PERITO (Decreto 2026-07-21) — APARTADO do Admin: o perito só vê a
// função dele (fila, planilha, confirmar pedidos, contagem regressiva dos 10
// dias). Vive sob /perito no mesmo domínio; o NPM faz proxy /perito → :3400.
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  basePath: '/perito',
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;

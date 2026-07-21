/** @type {import('next').NextConfig} */
// Portal do PERITO (Decreto 2026-07-21) — APARTADO do Admin: o perito só vê a
// função dele (fila, planilha, confirmar pedidos, contagem regressiva dos 10
// dias). Vive sob /perito no mesmo domínio; o NPM faz proxy /perito → :3400.
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  basePath: '/perito',
  eslint: { ignoreDuringBuilds: true },
  // O gate de TIPOS é o CI (pnpm typecheck + build a cada push, resolução
  // real do workspace). Dentro da imagem Docker o pnpm re-resolve @types de
  // forma não-determinística — o build da imagem SÓ compila.
  typescript: { ignoreBuildErrors: true },
};

export default nextConfig;

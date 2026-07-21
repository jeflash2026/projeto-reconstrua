/** @type {import('next').NextConfig} */
// Portal do Cliente — a "carta viva" da AHRI (5 documentos fundadores congelados).
// SOMENTE renderiza a projeção segura servida pela API (Princípio 3); nenhuma
// lógica própria, nenhuma escrita. Vive sob /portal no MESMO domínio.
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  basePath: '/portal',
  // Lint e typecheck rodam como gates próprios; o build não duplica.
  eslint: { ignoreDuringBuilds: true },
  // O gate de TIPOS é o CI (pnpm typecheck + build a cada push, resolução
  // real do workspace). Dentro da imagem Docker o pnpm re-resolve @types de
  // forma não-determinística — o build da imagem SÓ compila.
  typescript: { ignoreBuildErrors: true },
};

export default nextConfig;

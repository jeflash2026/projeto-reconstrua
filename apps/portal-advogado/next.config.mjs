/** @type {import('next').NextConfig} */
// Portal do Advogado — trabalho jurídico sobre processos ATRIBUÍDOS. SOMENTE
// consome Read Models (DF-08; item 12); comunicação com o cliente é da AHRI.
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Plataforma inteira em UM domínio: o portal do Advogado vive sob /advogado
  // (NPM: /advogado → portal-advogado:3200; links/assets prefixados pelo Next).
  basePath: '/advogado',
  eslint: { ignoreDuringBuilds: true },
  // O gate de TIPOS é o CI (pnpm typecheck + build a cada push, resolução
  // real do workspace). Dentro da imagem Docker o pnpm re-resolve @types de
  // forma não-determinística — o build da imagem SÓ compila.
  typescript: { ignoreBuildErrors: true },
};

export default nextConfig;

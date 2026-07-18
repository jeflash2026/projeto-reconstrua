/** @type {import('next').NextConfig} */
// Portal Administração — governança operacional e supervisão. SOMENTE consome
// Read Models (DF-08; item 12). Critérios completos de autorização/visibilidade
// pertencem à Governança (DF-12) e serão configurados, não inventados.
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Plataforma inteira em UM domínio: o portal Admin vive sob /admin (links,
  // assets e actions são prefixados automaticamente pelo Next). O NPM faz proxy
  // de /admin → portal-admin:3100 e de /pericias → /admin/pericias (URL preservada).
  basePath: '/admin',
  // Lint e typecheck rodam como gates próprios (pnpm lint/typecheck); o build não duplica.
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;

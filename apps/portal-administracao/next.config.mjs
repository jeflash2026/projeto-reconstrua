/** @type {import('next').NextConfig} */
// Portal Administração — governança operacional e supervisão. SOMENTE consome
// Read Models (DF-08; item 12). Critérios completos de autorização/visibilidade
// pertencem à Governança (DF-12) e serão configurados, não inventados.
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Lint e typecheck rodam como gates próprios (pnpm lint/typecheck); o build não duplica.
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;

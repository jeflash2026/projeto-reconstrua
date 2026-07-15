/** @type {import('next').NextConfig} */
// Portal Cliente — superfície que SOMENTE consome Read Models da Verdade
// Operacional (DF-08; decisão do fundador, item 12). Nenhum acesso ao Event Store.
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
};

export default nextConfig;

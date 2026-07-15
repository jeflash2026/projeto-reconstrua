/** @type {import('next').NextConfig} */
// Portal Operação — console dos Responsáveis (Operador/Advogado/Perito/Supervisor).
// SOMENTE consome Read Models (DF-08; item 12). Ações de escrita passam pela API
// (composition root), nunca tocam o Event Store diretamente.
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
};

export default nextConfig;

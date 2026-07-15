/** @type {import('next').NextConfig} */
// Portal do Advogado — trabalho jurídico sobre processos ATRIBUÍDOS. SOMENTE
// consome Read Models (DF-08; item 12); comunicação com o cliente é da AHRI.
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;

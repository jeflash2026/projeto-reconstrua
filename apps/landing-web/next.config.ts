import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Tipos são gate do CI; o build da imagem só compila (resolução de @types
  // dentro do Docker é não-determinística no workspace misto React 18/19).
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  images: {
    formats: ['image/avif', 'image/webp'],
  },
};

export default nextConfig;

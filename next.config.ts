import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

export default function nextConfig(phase: string): NextConfig {
  const isDev = phase === PHASE_DEVELOPMENT_SERVER;

  return {
    output: "standalone",
    // Разделяем артефакты dev и build, чтобы они не конфликтовали и не ломали чанки.
    // Разделяем артефакты dev и build, чтобы они не конфликтовали и не ломали чанки.
    distDir: isDev ? ".next-dev" : ".next",
    reactStrictMode: false,
    typescript: {
      ignoreBuildErrors: true,
    },
    eslint: {
      ignoreDuringBuilds: true,
    },
    webpack: (config, { dev }) => {
      // На некоторых окружениях (например, Node 24+) webpack persistent cache в dev может ломаться
      // и приводить к ошибкам вида "Cannot find module './NNN.js'". Отключаем cache в dev.
      if (dev) {
        config.cache = false;
      }
      return config;
    },
    experimental: {
      cpus: 2,
    },
  };
}

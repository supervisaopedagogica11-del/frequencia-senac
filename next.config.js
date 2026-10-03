import path from "node:path";
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // somente para testes locais: MOCK_FIREBASE=1 troca o Firebase por um banco em memória
  ...(process.env.MOCK_FIREBASE === "1" ? {
    distDir: ".next-mock",
    webpack: (config) => {
      const m = path.resolve("tests/mock");
      config.resolve.alias = { ...config.resolve.alias, "firebase/app$": `${m}/app.js`, "firebase/auth$": `${m}/auth.js`, "firebase/firestore$": `${m}/firestore.js` };
      return config;
    },
  } : {}),
};
export default nextConfig;

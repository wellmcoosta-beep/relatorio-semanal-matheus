/** @type {import('next').NextConfig} */
module.exports = {
  experimental: {
    serverComponentsExternalPackages: ['@sparticuz/chromium', 'puppeteer-core'],
    outputFileTracingIncludes: {
      '/api/relatorio-semanal': ['./node_modules/@sparticuz/chromium/**'],
    },
  },
}

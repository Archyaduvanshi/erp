// Use the existing deployed origin unless a custom public domain is configured.
export function publicSeo(siteUrl = 'https://erpfrontend-kohl.vercel.app') {
  const parsed = new URL(siteUrl);
  if (!['https:', 'http:'].includes(parsed.protocol) || parsed.username || parsed.password) throw new Error('VITE_PUBLIC_SITE_URL must be a public HTTP(S) origin.');
  const origin = parsed.origin;
  const routes = ['/', '/privacy', '/terms'];
  return {
    name: 'vidyantra-public-seo',
    transformIndexHtml(html) { return html.replaceAll('__PUBLIC_SITE_URL__', origin); },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: `User-agent: *\nAllow: /\nDisallow: /platform\nDisallow: /college\nDisallow: /student\nDisallow: /teacher\nDisallow: /login\nDisallow: /register\nDisallow: /forgot-password\nDisallow: /reset-password\nDisallow: /change-password\nSitemap: ${origin}/sitemap.xml\n` });
      this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${routes.map(path => `<url><loc>${origin}${path}</loc></url>`).join('')}</urlset>\n` });
    },
  };
}

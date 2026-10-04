import { SITE } from '@/lib/seo';

export const dynamic = 'force-static';

// Written as plain text rather than through the typed robots file: Clean-param is not among its fields.
// Yandex reads it as "these marks in an address do not make a new page".
const RULES = `User-agent: *
Allow: /
Clean-param: utm_source&utm_medium&utm_campaign&utm_content&utm_term&yclid&ysclid&gclid&fbclid

Sitemap: ${SITE}/sitemap.xml
`;

export function GET() {
  return new Response(RULES, { headers: { 'content-type': 'text/plain; charset=utf-8' } });
}

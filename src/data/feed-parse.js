// Feed parsing shared by the build script (Node) and live refresh (browser). Pure functions, no DOM.
const EXCERPT = 220;
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'", rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', mdash: '—', ndash: '–', hellip: '…' };

const decode = (s) => s.replace(/&(#x?[0-9a-f]+|\w+);/gi, (m, e) => {
  if (e[0] === '#') return String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
  return ENT[e.toLowerCase()] ?? m;
});
export const clean = (s = '') => decode(decode(s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')).replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
export const cut = (s, n = EXCERPT) => (s.length > n ? s.slice(0, s.lastIndexOf(' ', n) > 0 ? s.lastIndexOf(' ', n) : n) + '…' : s);
export const hashId = (s) => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0; return 'd' + Math.abs(h).toString(36); };

function tag(block, names) {
  for (const n of names) {
    const m = block.match(new RegExp(`<${n}(?:\\s[^>]*)?>([\\s\\S]*?)</${n}>`, 'i'));
    if (m && clean(m[1])) return m[1];
  }
  return '';
}
function link(block) {
  const alt = block.match(/<link[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["']/i) || block.match(/<link[^>]*href=["']([^"']+)["'][^>]*\/?>/i);
  if (alt) return decode(alt[1]);
  return clean(tag(block, ['link', 'guid']));
}

export const hasItems = (xml) => /<item[\s>]|<entry[\s>]/i.test(xml);

export function parseFeed(xml) {
  const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>|<entry[\s>][\s\S]*?<\/entry>/gi) || [];
  return blocks.map((b) => {
    const date = clean(tag(b, ['pubDate', 'published', 'updated', 'dc:date', 'prism:publicationDate']));
    return {
      title: clean(tag(b, ['title'])),
      url: link(b),
      date: date && !isNaN(Date.parse(date)) ? new Date(date).toISOString() : null,
      excerpt: cut(clean(tag(b, ['description', 'summary', 'content:encoded', 'content', 'dc:description']))),
    };
  }).filter((x) => x.title && /^https?:/.test(x.url));
}

// feed items of one source → app items (newest first, ≤ perSource per group, within maxAgeDays)
export function sourceItems(src, xml, { perSource = 8, maxAgeDays = 60 } = {}) {
  const cutoff = Date.now() - maxAgeDays * 86400000;
  const per = {};
  return parseFeed(xml)
    .filter((x) => !x.date || Date.parse(x.date) >= cutoff)
    .map((x) => {
      let group = src.group, kind = src.kind || 'article';
      if (src.split === 'nature' && /\/articles\/s\d/.test(x.url)) { group = 'research'; kind = 'research'; } // s41586 = paper, d41586 = news
      return { id: hashId(x.url), ...x, source: src.name, group, kind };
    })
    .sort((a, b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0))
    .filter((x) => (per[x.group] = (per[x.group] || 0) + 1) <= perSource);
}

// OpenAlex (CORS-enabled, works in the browser too). Core journals only (OpenAlex/CWTS is_core),
// so newest-first doesn't surface low-quality venues. sort: null = relevance to the query.
export function openAlexUrl(query, { perQuery = 4, sinceDays = 365, sort = 'cited_by_count:desc' } = {}) {
  const since = new Date(Date.now() - sinceDays * 86400000).toISOString().slice(0, 10);
  return `https://api.openalex.org/works?search=${encodeURIComponent(query)}&filter=is_oa:true,type:article,has_abstract:true,primary_location.source.is_core:true,from_publication_date:${since}${sort ? '&sort=' + sort : ''}&per-page=${perQuery}&select=id,title,doi,publication_date,primary_location,abstract_inverted_index`;
}
export function openAlexItems(json) {
  return (json.results || []).map((w) => {
    const words = [];
    Object.entries(w.abstract_inverted_index || {}).forEach(([word, pos]) => pos.forEach((p) => { words[p] = word; }));
    const url = w.doi || w.primary_location?.landing_page_url || w.id;
    return {
      id: hashId(url), title: clean(w.title || ''), url,
      date: w.publication_date ? new Date(w.publication_date).toISOString() : null,
      excerpt: cut(words.filter(Boolean).join(' ')),
      source: w.primary_location?.source?.display_name || 'OpenAlex', group: 'research', kind: 'research',
    };
  }).filter((x) => x.title);
}

// Add-button icons: one per section, same family as the home "Add idea" flower.
const plus = '<circle cx="15" cy="15" r="8" fill="var(--surface)" stroke="var(--ink)" stroke-width="1.6"/><path d="M15 11v8M11 15h8" stroke="var(--ink)" stroke-width="2.2" stroke-linecap="round"/>';

const art = {
  flower: `${[0, 72, 144, 216, 288].map((a) => `<ellipse cx="0" cy="-12" rx="7.5" ry="12" transform="rotate(${a})" fill="var(--petal)"/>`).join('')}<circle r="8" fill="var(--sun)"/>`,
  butterfly: `<g transform="rotate(-8)"><ellipse cx="-9" cy="-6" rx="10" ry="8" fill="#c99ae0"/><ellipse cx="9" cy="-6" rx="10" ry="8" fill="#c99ae0"/>
    <ellipse cx="-7" cy="7" rx="7" ry="6" fill="#86bde6"/><ellipse cx="7" cy="7" rx="7" ry="6" fill="#86bde6"/>
    <rect x="-1.6" y="-12" width="3.2" height="24" rx="1.6" fill="var(--bark)"/><path d="M-1 -12q-3-6-7-7M1 -12q3-6 7-7" stroke="var(--bark)" stroke-width="1.4" fill="none" stroke-linecap="round"/></g>`,
  apple: `<path d="M0 -10c-6-5-17-3-17 9 0 10 8 19 13 19 2 0 3-1 4-1s2 1 4 1c5 0 13-9 13-19 0-12-11-14-17-9z" fill="var(--fruit)"/>
    <ellipse cx="-8" cy="-2" rx="3" ry="5" fill="#fff" opacity=".35"/><path d="M0 -10q1-7 5-10" stroke="var(--bark)" stroke-width="2.2" fill="none" stroke-linecap="round"/>
    <ellipse cx="9" cy="-18" rx="7" ry="3.5" transform="rotate(-25 9 -18)" fill="var(--leaf)"/>`,
  sunflower: `${Array.from({ length: 12 }, (_, i) => `<ellipse cx="0" cy="-14" rx="4.5" ry="9" transform="rotate(${i * 30})" fill="var(--sun)"/>`).join('')}<circle r="9" fill="var(--bark)"/><circle cx="-3" cy="-3" r="2.5" fill="#fff" opacity=".25"/>`,
};

export const icon = (kind, { badge = true } = {}) =>
  `<svg viewBox="-30 -30 60 60" aria-hidden="true">${art[kind]}${badge ? plus : ''}</svg>`;

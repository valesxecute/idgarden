// Garden sprites: SVG strings for plants (4 stages), cloche, tree + fruit, sunflower, butterfly, decor.
import { Store } from '../core/store.js';

export const hash = (s) => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h); };
export const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const FLOWER = ['#f08f7a', '#f5c869', '#c99ae0', '#f4a6bf', '#86bde6', '#f4ad6d'];
export const hueOf = (id) => FLOWER[hash(id) % FLOWER.length];

export function leaf(x, y, dir, size = 9, rot = 0) {
  const r = dir * (35 + rot);
  return `<g transform="rotate(${-r} ${x} ${y})"><ellipse cx="${x + dir * size * 0.6}" cy="${y}" rx="${size}" ry="${size * 0.45}" fill="var(--leaf)"/>
    <ellipse cx="${x + dir * size * 0.5}" cy="${y - size * 0.12}" rx="${size * 0.55}" ry="${size * 0.16}" fill="var(--leaf-hi)"/></g>`;
}
export const shadow = (rx, ry = rx * 0.28) => `<ellipse cx="${-rx * 0.35}" cy="1.5" rx="${rx}" ry="${ry}" fill="var(--shadow-c)"/>`;

export function plant(stage, hue) {
  switch (stage) {
    case 'seed':
      return `${shadow(13)}<ellipse cx="0" cy="0" rx="13" ry="4" fill="var(--soil)"/>
        <g class="bob"><ellipse cx="0" cy="-4" rx="4.5" ry="6" fill="var(--seed)" transform="rotate(20 0 -4)"/>
        <ellipse cx="-1.2" cy="-6" rx="1.3" ry="2" fill="#fff" opacity=".55" transform="rotate(20 0 -4)"/></g>`;
    case 'sprout':
      return `${shadow(12)}<ellipse cx="0" cy="0" rx="12" ry="3.5" fill="var(--soil)"/>
        <g class="sway"><path d="M0 0 Q1 -10 0 -20" stroke="var(--stem)" stroke-width="2.4" fill="none" stroke-linecap="round"/>
        ${leaf(0, -18, -1, 8)}${leaf(0, -18, 1, 8)}</g>`;
    case 'plant':
      return `${shadow(15)}<ellipse cx="0" cy="0" rx="14" ry="4" fill="var(--soil)"/>
        <g class="sway"><path d="M0 0 Q2 -20 0 -40" stroke="var(--stem)" stroke-width="2.8" fill="none" stroke-linecap="round"/>
        ${leaf(0, -14, -1, 10)}${leaf(0, -22, 1, 11)}${leaf(0, -31, -1, 10)}${leaf(0, -38, 1, 8)}</g>`;
    default: {
      const petals = Array.from({ length: 6 }, (_, i) => {
        const a = (i * 60 * Math.PI) / 180;
        const cx = Math.cos(a) * 6.2, cy = -52 + Math.sin(a) * 6.2;
        return `<ellipse cx="${cx}" cy="${cy}" rx="6" ry="4" transform="rotate(${i * 60} ${cx} ${cy})" fill="${hue}"/>`;
      }).join('');
      return `${shadow(16)}<ellipse cx="0" cy="0" rx="15" ry="4" fill="var(--soil)"/>
        <g class="sway"><path d="M0 0 Q3 -26 0 -50" stroke="var(--stem)" stroke-width="3" fill="none" stroke-linecap="round"/>
        ${leaf(0, -14, -1, 11)}${leaf(0, -24, 1, 12)}${leaf(0, -35, -1, 10)}
        ${petals}<circle cx="0" cy="-52" r="4.4" fill="#fbe3a0"/><circle cx="-1.4" cy="-53.4" r="1.3" fill="#fff" opacity=".7"/></g>`;
    }
  }
}

export const STAGE_H = { seed: 12, sprout: 26, plant: 46, bloom: 62 };

export function cloche(stage) {
  const h = STAGE_H[stage] + 12, w = 22;
  return `<path d="M${-w} 2 L${-w} ${-h + w} A${w} ${w} 0 0 1 ${w} ${-h + w} L${w} 2 Z" fill="var(--glass)" stroke="var(--glass-stroke)" stroke-width="1.2"/>
    <circle cx="0" cy="${-h - 3}" r="3" fill="var(--glass-stroke)"/>
    <path d="M${-w + 5} ${-h + w} A${w - 5} ${w - 5} 0 0 1 ${-4} ${-h + 6}" stroke="#fff" stroke-opacity=".7" stroke-width="2.2" fill="none" stroke-linecap="round"/>`;
}

export function tree(progress, fruits, completed) {
  const s = 0.65 + 0.45 * (progress / 100);
  const spots = [[-26, -96], [22, -104], [-6, -120], [32, -82], [-38, -76], [8, -88], [-18, -108], [26, -122], [-30, -126], [40, -102]];
  const fruit = spots.slice(0, Math.min(fruits, spots.length))
    .map(([x, y]) => `<g class="fruit"><circle cx="${x}" cy="${y}" r="6" fill="var(--fruit)"/><circle cx="${x - 2}" cy="${y - 2}" r="1.8" fill="#fff" opacity=".6"/>
      <path d="M${x} ${y - 5.5} q2 -3 4.5 -3" stroke="var(--stem)" stroke-width="1.4" fill="none" stroke-linecap="round"/></g>`)
    .join('');
  return `${shadow(44, 9)}<ellipse cx="0" cy="0" rx="30" ry="6" fill="var(--soil)"/>
    <g transform="scale(${s.toFixed(2)})">
      <path d="M-7 0 Q-5 -40 -4 -70 L4 -70 Q5 -40 7 0 Z" fill="var(--bark)"/>
      <path d="M-7 0 Q-5 -40 -4 -70 L-1 -70 Q-2 -40 -3 0 Z" fill="#000" opacity=".12"/>
      <path d="M-2 -55 Q-18 -66 -24 -78" stroke="var(--bark)" stroke-width="4" fill="none" stroke-linecap="round"/>
      <path d="M2 -60 Q16 -70 22 -84" stroke="var(--bark)" stroke-width="4" fill="none" stroke-linecap="round"/>
      <g class="sway-slow">
        <circle cx="-22" cy="-92" r="30" fill="var(--canopy-2)"/>
        <circle cx="22" cy="-96" r="32" fill="var(--canopy-2)"/>
        <circle cx="0" cy="-118" r="32" fill="url(#canopyShade)"/>
        <circle cx="-26" cy="-112" r="22" fill="url(#canopyShade)"/>
        <circle cx="28" cy="-114" r="22" fill="url(#canopyShade)"/>
        <ellipse cx="-12" cy="-132" rx="14" ry="8" fill="#fff" opacity=".12"/>
        ${fruit}
      </g>
      ${completed ? '<text x="0" y="-160" text-anchor="middle" font-size="16">✨</text>' : ''}
    </g>`;
}

export function sunflower(progress) {
  const h = 30 + progress * 0.7;
  const petals = Array.from({ length: 12 }, (_, i) => `<ellipse cx="0" cy="${-h - 9}" rx="2.8" ry="6.2" fill="var(--sun)" transform="rotate(${i * 30} 0 ${-h})"/>`).join('');
  return `${shadow(8)}<g class="sway-slow"><path d="M0 0 Q2 ${-h / 2} 0 ${-h}" stroke="var(--stem)" stroke-width="2.6" fill="none" stroke-linecap="round"/>
    ${leaf(0, -h * 0.4, -1, 9)}${leaf(0, -h * 0.6, 1, 9)}
    ${petals}<circle cx="0" cy="${-h}" r="6" fill="var(--bark)"/><circle cx="-1.8" cy="${-h - 1.8}" r="1.5" fill="#fff" opacity=".35"/></g>`;
}

export function butterfly(hue) {
  return `<g class="flutter"><ellipse cx="-4.5" cy="0" rx="5" ry="3.8" fill="${hue}"/>
    <ellipse cx="4.5" cy="0" rx="5" ry="3.8" fill="${hue}"/>
    <ellipse cx="-3.2" cy="4.4" rx="3.2" ry="2.6" fill="${hue}" opacity=".8"/>
    <ellipse cx="3.2" cy="4.4" rx="3.2" ry="2.6" fill="${hue}" opacity=".8"/>
    <rect x="-.8" y="-3.5" width="1.6" height="10" rx=".8" fill="var(--bark)"/></g>`;
}

export const tuft = (x, y, s = 1) => `<path d="M${x - 5 * s} ${y} q${2 * s} ${-7 * s} ${3 * s} ${-10 * s} M${x} ${y} q0 ${-8 * s} ${1 * s} ${-12 * s} M${x + 5 * s} ${y} q${-2 * s} ${-7 * s} ${-3 * s} ${-10 * s}" stroke="var(--grass-tuft)" stroke-width="${1.8 * s}" fill="none" stroke-linecap="round"/>`;
export const tinyFlower = (x, y, c) => `<g><circle cx="${x}" cy="${y - 3}" r="2.6" fill="${c}"/><circle cx="${x}" cy="${y - 3}" r="1" fill="#fff8d6"/></g>`;

// standalone plant for lists / the terrarium
export function plantIcon(idea, { size = 56 } = {}) {
  const stage = Store.ideaStage(idea);
  return `<svg viewBox="-28 -72 56 80" width="${size}" height="${size * 80 / 56}" class="plant-icon" aria-hidden="true">${plant(stage, hueOf(idea.id))}</svg>`;
}


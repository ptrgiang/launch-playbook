#!/usr/bin/env node
// Render a scatter chart (votes vs comments) for the launch corpus.
// Usage: node tools/chart-votes-comments.mjs > chart.svg

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = fileURLToPath(new URL('../data/launches/', import.meta.url));
const files = fs.readdirSync(dir).filter(f => f.endsWith('.json') && !f.startsWith('_'));
const pts = files.map(f => {
  const j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  return { slug: j.slug, votes: j.votes, comments: j.comments };
}).sort((a, b) => b.votes - a.votes);

const W = 1200, H = 800;
const ML = 90, MR = 40, MT = 70, MB = 80; // margins
const PW = W - ML - MR, PH = H - MT - MB;
const maxX = Math.max(...pts.map(p => p.comments)) * 1.08;
const minY = Math.floor(Math.min(...pts.map(p => p.votes)) / 100) * 100 - 50;
const maxY = Math.max(...pts.map(p => p.votes)) * 1.06;
const x = v => ML + (v / maxX) * PW;
const y = v => MT + PH - ((v - minY) / (maxY - minY)) * PH;

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const labeled = new Set(['ami-ai', 'jev', 'gpt-6-astra-2', 'creem-2-0', 'voiskey', 'empacer']);
const labelPos = {
  'ami-ai': [6, -14], 'jev': [8, 0], 'gpt-6-astra-2': [8, 0],
  'creem-2-0': [6, -14], 'voiskey': [6, -14], 'empacer': [8, 0],
};

let dots = '';
for (const p of pts) {
  dots += `<circle cx="${x(p.comments).toFixed(1)}" cy="${y(p.votes).toFixed(1)}" r="9" fill="#2f6df6" fill-opacity="0.85"/>`;
  if (labeled.has(p.slug)) {
    const [dx, dy] = labelPos[p.slug] || [8, 0];
    dots += `<text x="${x(p.comments) + dx}" y="${y(p.votes) + dy}" font-size="19" fill="#e8e8e8" font-family="Arial">${esc(p.slug.replace(/-\d+$/,'').replace(/-/g,' '))}</text>`;
  }
}

// gridlines
let grid = '';
for (let v = 0; v <= 220; v += 55) grid += `<line x1="${x(v)}" y1="${MT}" x2="${x(v)}" y2="${MT+PH}" stroke="#333"/>` +
  `<text x="${x(v)}" y="${H-MB+30}" font-size="17" fill="#999" text-anchor="middle" font-family="Arial">${v}</text>`;
for (let v = 400; v <= 750; v += 50) grid += `<line x1="${ML}" y1="${y(v)}" x2="${ML+PW}" y2="${y(v)}" stroke="#333"/>` +
  `<text x="${ML-12}" y="${y(v)+6}" font-size="17" fill="#999" text-anchor="end" font-family="Arial">${v}</text>`;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<rect width="${W}" height="${H}" fill="#14161a"/>
<text x="${ML}" y="40" font-size="26" font-weight="bold" fill="#f0f0f0" font-family="Arial">Top 20 Product Hunt launches (last 90 days): votes vs comments</text>
<text x="${ML}" y="62" font-size="18" fill="#e8b34b" font-family="Arial">604 votes with 16 comments vs 704 votes with 217 comments. No correlation.</text>
${grid}
<line x1="${ML}" y1="${MT+PH}" x2="${ML+PW}" y2="${MT+PH}" stroke="#666"/>
<line x1="${ML}" y1="${MT}" x2="${ML}" y2="${MT+PH}" stroke="#666"/>
<text x="${ML + PW/2}" y="${H-18}" font-size="19" fill="#bbb" text-anchor="middle" font-family="Arial">comments</text>
<text x="24" y="${MT + PH/2}" font-size="19" fill="#bbb" text-anchor="middle" font-family="Arial" transform="rotate(-90 24 ${MT + PH/2})">votes</text>
${dots}
</svg>`;
process.stdout.write(svg);

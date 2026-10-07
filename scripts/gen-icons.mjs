import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const out = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/assets/icons');
fs.mkdirSync(out, { recursive: true });

const S = (w, h, body, vb) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${vb || `0 0 ${w} ${h}`}" fill="none" stroke-linecap="round" stroke-linejoin="round">${body}</svg>\n`;
const st = (c = '#101010', w = 2) => `stroke="${c}" stroke-width="${w}"`;

const icons = {
  // pencil held by the drawer
  'drawer': S(24, 24, `<path d="M4 20l1-5L16.5 3.5a2.2 2.2 0 013 3L8 18z" ${st('#ef5c3c', 2.2)}/><path d="M14.5 5.5l3 3M4 20l4-1" ${st('#ef5c3c', 2.2)}/>`),
  'drawer-small': S(18, 18, `<path d="M3 15l.8-3.8L12.4 2.6a1.7 1.7 0 112.4 2.4L6.2 13.6z" ${st('#ef5c3c', 1.8)}/><path d="M11 4l2.4 2.4" ${st('#ef5c3c', 1.8)}/>`),
  'replay': S(24, 24, `<path d="M12 3.5a8.5 8.5 0 11-7 3.7M12 8.5a3.7 3.7 0 103.2 1.8" ${st('#101010', 2.2)}/><path d="M4 3.8l1.4 3.6L9 6" ${st('#101010', 2.2)}/>`),
  'guess': S(16, 16, `<path d="M3.5 3.5l9 9M12.5 3.5l-9 9" ${st('#ef5c3c', 2.2)}/>`),
  'guess-correct': S(16, 16, `<path d="M2.8 8.6l3.6 3.6L13.4 3.8" ${st('#219650', 2.4)}/>`),
  'log-guessers': S(16, 16, `<path d="M8 2.5v7.2" ${st('#101010', 2.2)}/><circle cx="8" cy="13.3" r="0.6" ${st('#101010', 1.6)}/>`),
  'disconnect': S(24, 24, `<path d="M9 9l6 6M7 11l-2.2 2.2a3 3 0 004.2 4.2L11.2 15M13 9l2.2-2.2a3 3 0 014.2 4.2L17.2 13.2M5 19l-2 2M19 5l2-2M8 7l1.6 1.6M15.4 14.4L17 16" ${st('#ef5c3c', 2)}/>`),
  'sound-on': S(28, 24, `<path d="M4 9h4l6-5v16l-6-5H4z" ${st('#101010', 2)}/><path d="M18 8.5c1.6 1.6 1.6 5.4 0 7M21 5.5c3.4 3.4 3.4 9.6 0 13" ${st('#101010', 2)}/>`),
  'sound-off': S(28, 24, `<path d="M4 9h4l6-5v16l-6-5H4z" ${st('#101010', 2)}/><path d="M18 9l6 6M24 9l-6 6" ${st('#101010', 2)}/>`),
  'leave': S(28, 24, `<path d="M5 3.5l8 1.8v13.4l-8 1.8z" ${st('#ef5c3c', 2)}/><path d="M10 11l-.2 3M17 12h7M21 8.5l3.4 3.5-3.4 3.5" ${st('#ef5c3c', 2)}/>`),
  'tool-pencil': S(36, 36, `<path d="M7 29l1.4-6.6L24 6.8a3.6 3.6 0 015.2 5.2L13.6 27.6z" ${st('#101010', 2.2)}/><path d="M21.5 9.5l5 5M7 29l6.2-1.2" ${st('#101010', 2.2)}/>`),
  'tool-eraser': S(36, 36, `<path d="M6 24L21 9a3 3 0 014.2 0l3.8 3.8a3 3 0 010 4.2L19 27H11z" ${st('#101010', 2.2)}/><path d="M14 16l8 8M11 27h20" ${st('#101010', 2.2)}/>`),
  'tool-clear': S(36, 36, `<path d="M8 10h20M14 10V7h8v3M11 10l1.2 19h11.6L25 10M15.5 15v10M20.5 15v10" ${st('#101010', 2.2)}/>`),
  'arrow-prev': S(36, 18, `<path d="M33 9H5M13 2L4 9l9 7" ${st('#101010', 3)}/>`),
  'arrow-next': S(36, 18, `<path d="M3 9h28M23 2l9 7-9 7" ${st('#101010', 3)}/>`),
  'close': S(16, 16, `<path d="M2.5 2.5l11 11M13.5 2.5l-11 11" ${st('#ef5c3c', 2.4)}/>`),
  'preview': S(16, 16, `<path d="M1.5 8C3.4 4.8 5.6 3.4 8 3.4S12.6 4.8 14.5 8C12.6 11.2 10.4 12.6 8 12.6S3.4 11.2 1.5 8z" ${st('#101010', 1.4)}/><circle cx="8" cy="8" r="2.1" ${st('#101010', 1.4)}/>`),
  'trophy': S(24, 24, `<path d="M7 4h10v5a5 5 0 01-10 0zM7 6H4c0 3 1.2 4.6 3.4 5M17 6h3c0 3-1.2 4.6-3.4 5M12 14v4M8.5 20h7" ${st('#ffa620', 2)}/>`),
  'headstart': S(24, 24, `<circle cx="12" cy="13.5" r="7.5" ${st('#ffa620', 2)}/><path d="M12 9.5v4l2.8 1.6M9 2.8h6M5 5.5l1.8 1.8M19 5.5l-1.8 1.8" ${st('#ffa620', 2)}/>`),
  'headstart-large': S(40, 40, `<circle cx="20" cy="22.5" r="13.5" ${st('#ffa620', 3)}/><path d="M20 15v8l5 3M14 4.5h12M7 8l3 3M33 8l-3 3" ${st('#ffa620', 3)}/>`),
  'check-big': S(36, 36, `<path d="M5 20l9 9L32 6" ${st('#219650', 5)}/>`),
  'check-small': S(16, 16, `<path d="M2.8 8.6l3.6 3.6L13.4 3.8" ${st('#219650', 2.2)}/>`),
  'selection-arrow': S(36, 66, `<path d="M19 62C13 46 24 28 17 7M7 20l10-13 11 12" ${st('#2689ac', 3.2)}/>`),
  'blank': S(42, 4, `<path d="M2 2.4c8-1.4 16 1.2 24 0s10-.8 14-.4" ${st('#c8c4a8', 3)}/>`),
  'line-256': S(256, 8, `<path d="M3 5c40-3 70 2.6 120 0s80-2.6 130-.6" ${st('#101010', 3)}/>`),
  'line-128': S(128, 4, `<path d="M2 2.6c20-1.8 40 1.4 62 0s40-1.4 62-.6" ${st('#101010', 2.6)}/>`),
  'line-236': S(236, 7, `<path d="M2 4c40-2.4 70 2 116 0s80-2 116-.4" ${st('#ef5c3c', 3)}/>`),
  'divider': `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="400" viewBox="0 0 10 400" preserveAspectRatio="none" fill="none"><path d="M5 0C4 40 6.2 80 5 120S4 200 5.4 240 4.2 330 5 400" stroke="#8a8670" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linecap="round"/></svg>
`,
  'face': S(81, 75, `<circle cx="40" cy="37" r="30" ${st('#101010', 3)}/><circle cx="30" cy="30" r="3" fill="#101010"/><circle cx="50" cy="30" r="3" fill="#101010"/><path d="M29 50c7-4 16-4 23 0" ${st('#101010', 3)}/>`),
  'trophy-large': S(75, 78, `<path d="M20 8h35v22a17.5 17.5 0 01-35 0z" fill="#ffd45e" ${st('#101010', 3)}/><path d="M20 15H8c0 14 4.5 20 13 23M55 15h12c0 14-4.5 20-13 23" ${st('#101010', 3)}/><path d="M37.5 48v14M25 70h25M30 62h15" ${st('#101010', 3)}/><path d="M27 15v12" ${st('#fff', 3)}/>`),
  'battle': S(128, 128, `<path d="M20 108L80 28l-4-8 12-8 8 12-8 12-6-4-60 80z" fill="#fff" ${st('#101010', 4)}/><path d="M108 108L48 28l4-8-12-8-8 12 8 12 6-4 60 80z" fill="#fff" ${st('#101010', 4)}/><path d="M26 98l12 12M102 98L90 110" ${st('#101010', 4)}/>`),
  'duel': S(90, 90, `<path d="M12 76L62 16l-3-6 9-6 6 9-6 9-5-3L18 80z" ${st('#101010', 3.5)}/><path d="M78 76L28 16l3-6-9-6-6 9 6 9 5-3 44 60z" ${st('#101010', 3.5)}/>`),
  'how-team': S(24, 24, `<path d="M4 20L18 5M20 20L6 5M3 3l4 1.5M21 3l-4 1.5" ${st('#ffa620', 2.2)}/><path d="M3 21l3-1M21 21l-3-1" ${st('#ffa620', 2.2)}/>`),
  'how-draw': S(24, 24, `<path d="M4 20l1-5L16.5 3.5a2.2 2.2 0 013 3L8 18z" ${st('#ef5c3c', 2)}/><path d="M14.5 5.5l3 3" ${st('#ef5c3c', 2)}/>`),
  'how-replay': S(24, 24, `<path d="M12 3.5a8.5 8.5 0 11-7 3.7M12 8.5a3.7 3.7 0 103.2 1.8" ${st('#219650', 2.2)}/><path d="M4 3.8l1.4 3.6L9 6" ${st('#219650', 2.2)}/>`),
  'replay-green': S(24, 24, `<path d="M12 3.5a8.5 8.5 0 11-7 3.7M12 8.5a3.7 3.7 0 103.2 1.8" ${st('#219650', 2.2)}/><path d="M4 3.8l1.4 3.6L9 6" ${st('#219650', 2.2)}/>`),
  'favicon': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#fffad4"/><path d="M8 25l1.4-6.4L22 6a3 3 0 014.2 4.2L13.6 22.8z" fill="#87e0ff" stroke="#101010" stroke-width="2" stroke-linejoin="round"/></svg>\n`,
};

for (const [name, svg] of Object.entries(icons)) fs.writeFileSync(path.join(out, `${name}.svg`), svg);
fs.writeFileSync(path.resolve(out, '../../../public/favicon.svg'), icons.favicon);
console.log(Object.keys(icons).length, 'icons written');

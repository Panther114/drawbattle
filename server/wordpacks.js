import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));

function read(file) {
  const p = path.join(dir, file);
  return fs
    .readFileSync(p, 'utf8')
    .split(/\r?\n/)
    .map((w) => w.trim())
    .filter((w) => w.length > 0);
}

const standard = [...new Set(read('words-standard.txt'))];

// word counts / ids / names mirror the official draw battle packs
const OFFICIAL = [
  { id: 110943, name: 'draw battle!', description: 'the standard draw battle word pack', words: standard },
  {
    id: 606337,
    name: 'draw battle! kids',
    description: 'a selection of kid-friendly words from the standard word pack',
    words: standard.filter((w) => !w.includes(' ') && w.length <= 7),
  },
  {
    id: 771362,
    name: 'draw battle! expert',
    description: 'a selection of difficult words from the standard word pack',
    words: standard.filter((w) => w.includes(' ') || w.length >= 9),
  },
  { id: 916804, name: 'movies', description: 'titles of popular films', words: read('packs/movies.txt') },
  { id: 796082, name: '2020', description: 'words related to the year 2020', words: read('packs/y2020.txt') },
  { id: 977559, name: '2021', description: 'words related to the year 2021', words: read('packs/y2021.txt') },
  { id: 775386, name: '2022', description: 'words related to the year 2022', words: read('packs/y2022.txt') },
  {
    id: 332670,
    name: 'holidays',
    description: 'words related to Christmas and the holiday season',
    words: read('packs/holidays.txt'),
  },
  {
    id: 252520,
    name: 'election 2020',
    description: 'words related to the 2020 US election',
    words: read('packs/election2020.txt'),
  },
  { id: 138239, name: 'Pokemon (gen 1)', description: 'the original 151 Pokemon', words: read('packs/pokemon.txt') },
  {
    id: 746986,
    name: 'Harry Potter',
    description: 'words from the Harry Potter book series',
    words: read('packs/harrypotter.txt'),
  },
  {
    id: 923879,
    name: 'Animal Crossing',
    description: 'words from Animal Crossing: New Horizons',
    words: read('packs/animalcrossing.txt'),
  },
];

const COMMUNITY = [
  {
    id: 766264,
    name: 'Anime',
    authorName: 'SteakStrips',
    description: 'names of various anime series',
    words: ['Naruto', 'One Piece', 'Attack on Titan', 'Death Note', 'Bleach', 'Dragon Ball', 'Pokemon', 'Sailor Moon', 'Cowboy Bebop', 'Spirited Away', 'My Hero Academia', 'Demon Slayer', 'Fairy Tail', 'Hunter x Hunter', 'Tokyo Ghoul', 'Fullmetal Alchemist Brotherhood'],
  },
  {
    id: 122568,
    name: 'chess',
    authorName: 'jeev',
    description: 'words related to the game of chess',
    words: ['pawn', 'knight', 'bishop', 'rook', 'queen', 'king', 'castling', 'en passant', 'checkmate', 'stalemate', 'fork', 'pin', 'skewer', 'gambit', 'opening', 'endgame', 'blunder', 'grandmaster', 'chess clock', 'promotion', 'back rank', 'discovered check'],
  },
  {
    id: 187539,
    name: 'kitchen',
    authorName: 'chef',
    description: 'things you find in a kitchen',
    words: ['whisk', 'spatula', 'colander', 'ladle', 'rolling pin', 'cutting board', 'grater', 'peeler', 'oven mitt', 'tongs', 'measuring cup', 'blender', 'toaster', 'kettle', 'microwave', 'apron', 'sink', 'pot', 'pan', 'timer'],
  },
  {
    id: 301122,
    name: 'space',
    authorName: 'astro',
    description: 'words about outer space',
    words: ['black hole', 'comet', 'asteroid', 'nebula', 'galaxy', 'Saturn', 'Jupiter', 'Mars', 'Venus', 'Mercury', 'Neptune', 'Uranus', 'space station', 'rocket', 'astronaut', 'telescope', 'supernova', 'meteor shower', 'eclipse', 'satellite', 'moon landing', 'rover'],
  },
  {
    id: 488812,
    name: 'sports',
    authorName: 'coach',
    description: 'a mix of sports and sporting equipment',
    words: ['basketball', 'volleyball', 'golf club', 'tennis racket', 'hockey stick', 'baseball bat', 'surfing', 'archery', 'fencing', 'gymnastics', 'rowing', 'skiing', 'snowboarding', 'weightlifting', 'high jump', 'pole vault', 'marathon', 'swimming', 'boxing glove', 'cricket'],
  },
  {
    id: 592001,
    name: 'music',
    authorName: 'dj',
    description: 'instruments and music words',
    words: ['guitar', 'drum kit', 'piano', 'violin', 'trumpet', 'harmonica', 'accordion', 'tambourine', 'microphone', 'headphones', 'vinyl record', 'orchestra', 'conductor', 'sheet music', 'metronome', 'ukulele', 'bagpipes', 'cymbal', 'choir', 'karaoke'],
  },
];

function meta(p) {
  const out = {
    id: p.id,
    name: p.name,
    numWords: p.words.length,
    sampleWords: p.words.slice(0, 4),
  };
  if (p.authorName) out.authorName = p.authorName;
  if (p.description) out.description = p.description;
  return out;
}

const byId = new Map();
for (const p of [...OFFICIAL, ...COMMUNITY]) byId.set(p.id, p);

export const DEFAULT_WORD_LIST_ID = 110943;
export const officialMeta = () => OFFICIAL.map(meta);
export const communityMeta = () => COMMUNITY.map(meta);
export const getWordListMeta = (id) => (byId.has(id) ? meta(byId.get(id)) : undefined);
export const getWords = (id) => (byId.has(id) ? byId.get(id).words : undefined);
export const wordListExists = (id) => byId.has(id);

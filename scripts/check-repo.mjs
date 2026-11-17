import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseLevels } from '../web-prototype/js/levels.js';
import { parseArtworks } from '../web-prototype/js/collection.js';
import { parseArtworkManifest, parsePictureMatchLevels } from '../web-prototype/js/picture-match/levels.js';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const required = [
  'README.md',
  'AGENTS.md',
  'CLAUDE.md',
  'docs/GAME_DESIGN_SPEC.md',
  'docs/LEVEL_SAMPLE.json',
  'docs/TECH_NOTES.md',
  'docs/PICTURE_MATCH_SPEC.md',
  'src-concept/scene_map.md',
  'web-prototype/index.html',
  'web-prototype/legacy-solitaire.html',
  'web-prototype/css/picture-match.css',
  'web-prototype/data/picture-match-artworks.json',
  'web-prototype/data/picture-match-levels.json',
  'web-prototype/js/picture-match/rules.js',
  'web-prototype/js/picture-match/levels.js',
  'web-prototype/js/picture-match/save.js',
  'web-prototype/js/picture-match/main.js',
  'web-prototype/data/levels.json',
  'web-prototype/data/artworks.json',
  'web-prototype/js/levels.js',
  'web-prototype/js/collection.js',
  'web-prototype/css/style.css',
  'web-prototype/js/game-state.js',
  'web-prototype/js/rules.js',
  'web-prototype/js/reveal.js',
  'web-prototype/js/artwork.js',
  'web-prototype/js/tutorial.js',
  'web-prototype/js/media.js',
  'web-prototype/js/save.js',
  'web-prototype/js/main.js'
];

const missing = [];
for (const file of required) {
  try {
    await access(path.join(rootDir, file));
  } catch {
    missing.push(file);
  }
}

if (missing.length) {
  console.error('Missing required files:');
  for (const file of missing) console.error(`- ${file}`);
  process.exit(1);
}

const legacyLevels = parseLevels(JSON.parse(await readFile(path.join(rootDir, 'web-prototype/data/levels.json'), 'utf8')));
const legacyArtworks = parseArtworks(JSON.parse(await readFile(path.join(rootDir, 'web-prototype/data/artworks.json'), 'utf8')), legacyLevels);

const pmManifest = parseArtworkManifest(JSON.parse(await readFile(path.join(rootDir, 'web-prototype/data/picture-match-artworks.json'), 'utf8')));
for (const art of pmManifest.artworks) {
  const topFile = path.join(rootDir, 'web-prototype', art.top.replace(/^\.\//, ''));
  const bottomFile = path.join(rootDir, 'web-prototype', art.bottom.replace(/^\.\//, ''));
  await access(topFile);
  await access(bottomFile);
  for (const imageFile of [topFile, bottomFile]) {
    const imageBytes = await readFile(imageFile);
    if (imageBytes.length < 24 || imageBytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' ||
        imageBytes.readUInt32BE(16) !== 128 || imageBytes.readUInt32BE(20) !== 176) {
      throw new Error(`Invalid 128x176 PNG: ${imageFile}`);
    }
  }
}

const pmLevels = parsePictureMatchLevels(
  JSON.parse(await readFile(path.join(rootDir, 'web-prototype/data/picture-match-levels.json'), 'utf8')),
  pmManifest
);

console.log(`Repository check passed. Legacy: ${legacyLevels.length} levels, ${legacyArtworks.length} artworks. PictureMatch: ${pmLevels.length} levels, ${pmManifest.artworks.length * 2} PNGs verified.`);

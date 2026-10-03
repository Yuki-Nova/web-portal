import fs from 'node:fs';
import path from 'node:path';

const htmlPath = path.resolve('../my-oss-gallery/docs/index.html');
const catPath = path.resolve('../my-oss-gallery/categories.json');
const outPath = path.resolve('src/data/gallery.json');

const html = fs.readFileSync(htmlPath, 'utf8');
const dataMatch = html.match(/<script id="gallery-data" type="application\/json">([\s\S]*?)<\/script>/);

let categories = {};
try {
  categories = JSON.parse(fs.readFileSync(catPath, 'utf8'));
} catch (e) {
  console.warn('Could not read categories.json', e.message);
}

if (dataMatch) {
  const images = JSON.parse(dataMatch[1]);
  const merged = images.map(img => ({
    key: img.key,
    name: img.name,
    url: img.url,
    thumb: img.thumb,
    time: img.time,
    category: categories[img.key] || '未分类'
  }));

  fs.writeFileSync(outPath, JSON.stringify(merged, null, 2), 'utf8');
  console.log(`Successfully generated gallery.json with ${merged.length} images.`);
} else {
  console.error('Failed to locate gallery-data script tag in HTML.');
}

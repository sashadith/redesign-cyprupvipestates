// scripts/importProjects.cjs

const path = require('path');
const fs = require('fs');
const { createClient } = require('@sanity/client');
const { parse } = require('csv-parse/sync');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

// — Sanity клиент
const client = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET,
  apiVersion: '2025-08-04',
  token: process.env.SANITY_API_TOKEN,
  useCdn: false,
});

const CSV_PATH = path.resolve(__dirname, 'projects.csv');
const LOCAL_IMG_DIR = path.resolve(__dirname, 'images');
const LANGS = ['de', 'pl', 'en', 'ru'];
const DEFAULT_LANG = 'de';

// Приводим к ISO "YYYY-MM-01". Принимает "YYYY-MM", "MM-YYYY", "YYYY-MM-DD", "YYYY.MM", "MM.YYYY".
function normalizeMonthYear(input) {
  if (!input) return null;
  const s = String(input).trim();

  // 1) "YYYY-MM" или "YYYY/MM"
  let m = s.match(/^(\d{4})[-\/](\d{1,2})$/);
  if (m) {
    const year = m[1];
    const month = String(Math.min(Math.max(parseInt(m[2], 10), 1), 12)).padStart(2, '0');
    return `${year}-${month}-01`;
  }

  // 2) "MM-YYYY" или "MM/YYYY"
  m = s.match(/^(\d{1,2})[-\/](\d{4})$/);
  if (m) {
    const month = String(Math.min(Math.max(parseInt(m[1], 10), 1), 12)).padStart(2, '0');
    const year = m[2];
    return `${year}-${month}-01`;
  }

  // 3) Уже "YYYY-MM-DD" — оставим как есть
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // 4) "YYYY.MM" или "MM.YYYY"
  m = s.match(/^(\d{4})\.(\d{1,2})$/) || s.match(/^(\d{1,2})\.(\d{4})$/);
  if (m) {
    const a = m[1], b = m[2];
    const year = a.length === 4 ? a : b;
    const monthNum = a.length === 4 ? b : a;
    const month = String(Math.min(Math.max(parseInt(monthNum, 10), 1), 12)).padStart(2, '0');
    return `${year}-${month}-01`;
  }

  // 5) Иначе — не пишем мусор
  return null;
}

// текст → PortableText блоки
// function textToPortableText(text = '') {
//   return text
//     .split(/\r?\n/)
//     .map(l => l.trim()).filter(Boolean)
//     .map((l, i) => ({
//       _key: `pt-${i}-${Date.now()}`,
//       _type: 'block',
//       style: 'normal',
//       markDefs: [],
//       children: [{ _key: `span-${i}-${Date.now()}`, _type: 'span', text: l, marks: [] }]
//     }));
// }

function parseCsvWithSecondHeader(csvText) {
  const cleaned = String(csvText).replace(/^\uFEFF/, '');
  const lines = cleaned.split(/\r?\n/);
  if (lines.length < 2) return [];

  const headerLine = lines[1]; // 2-я строка = машинные колонки
  const [columns] = parse(headerLine, {
    relax_quotes: true,
    skip_empty_lines: true,
    relax_column_count: true,
  });

  return parse(cleaned, {
    columns,
    from_line: 3,          // данные с 3-й строки
    skip_empty_lines: true,
    relax_quotes: true,
    relax_column_count: true,
  });
}

// --- Мини-Markdown → Portable Text (H1–H3, списки, жирный/курсив, ссылки)
function mdToPT(text = '') {
  const lines = String(text).replace(/\r\n/g, '\n').split('\n');
  const blocks = [];

  // Парсинг инлайновых марок: ссылки, жирный, курсив
  const parseInline = (str, i) => {
    const children = [];
    const markDefs = [];

    // 1) Ссылки вида [Anchor](https://example.com)
    const linkRegex = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
    let last = 0;
    let m;

    const pushText = (t) => {
      if (!t) return;
      children.push({
        _key: `span-${i}-${children.length}-${Date.now()}`,
        _type: 'span',
        text: t,
        marks: []
      });
    };

    while ((m = linkRegex.exec(str)) !== null) {
      const before = str.slice(last, m.index);
      if (before) pushText(before);

      const key = `link-${i}-${markDefs.length}-${Date.now()}`;
      markDefs.push({ _key: key, _type: 'link', href: m[2] });
      children.push({
        _key: `span-${i}-${children.length}-${Date.now()}`,
        _type: 'span',
        text: m[1],
        marks: [key]
      });

      last = m.index + m[0].length;
    }
    const tail = str.slice(last);
    if (tail) pushText(tail);

    // 2) Жирный/курсив поверх уже созданных children
    const applyMarks = (node, mark) => {
      const isBold = mark === 'strong';
      const re = isBold ? /\*\*([^*]+)\*\*/g : /\*([^*]+)\*/g;
      const src = node.text;

      let lastIdx = 0;
      let mm;
      const out = [];

      while ((mm = re.exec(src)) !== null) {
        if (mm.index > lastIdx) {
          out.push({
            ...node,
            _key: node._key + `-t${out.length}`,
            text: src.slice(lastIdx, mm.index),
            marks: node.marks || []
          });
        }
        out.push({
          ...node,
          _key: node._key + `-m${out.length}`,
          text: mm[1],
          marks: [...(node.marks || []), mark]
        });
        lastIdx = mm.index + mm[0].length;
      }
      if (lastIdx < src.length) {
        out.push({
          ...node,
          _key: node._key + `-t${out.length}`,
          text: src.slice(lastIdx),
          marks: node.marks || []
        });
      }
      return out;
    };

    let flat = [];
    children.forEach(n => {
      // bold
      const withBold = applyMarks(n, 'strong');
      // italic
      withBold.forEach(b => {
        const withItalic = applyMarks(b, 'em');
        flat.push(...withItalic);
      });
    });

    if (flat.length === 0) {
      flat = [{
        _key: `span-${i}-0-${Date.now()}`,
        _type: 'span',
        text: '',
        marks: []
      }];
    }

    return { children: flat, markDefs };
  };

  lines.forEach((raw, i) => {
    const line = raw.replace(/\t/g, '    ');
    if (!line.trim()) return; // пустая строка = разрыв абзаца/списка

    // Заголовки
    let m;
    if ((m = line.match(/^###\s+(.*)$/))) {
      const { children, markDefs } = parseInline(m[1], i);
      blocks.push({
        _key: `pt-${i}-${Date.now()}`,
        _type: 'block',
        style: 'h3',
        markDefs,
        children
      });
      return;
    }
    if ((m = line.match(/^##\s+(.*)$/))) {
      const { children, markDefs } = parseInline(m[1], i);
      blocks.push({
        _key: `pt-${i}-${Date.now()}`,
        _type: 'block',
        style: 'h2',
        markDefs,
        children
      });
      return;
    }
    if ((m = line.match(/^#\s+(.*)$/))) {
      const { children, markDefs } = parseInline(m[1], i);
      blocks.push({
        _key: `pt-${i}-${Date.now()}`,
        _type: 'block',
        style: 'h1',
        markDefs,
        children
      });
      return;
    }

    // Маркированные списки: -, *
    if ((m = line.match(/^(?:-|\*)\s+(.*)$/))) {
      const { children, markDefs } = parseInline(m[1], i);
      blocks.push({
        _key: `pt-${i}-${Date.now()}`,
        _type: 'block',
        style: 'normal',
        listItem: 'bullet',
        level: 1,
        markDefs,
        children
      });
      return;
    }

    // Нумерованные списки: 1. 2. ...
    if ((m = line.match(/^\d+\.\s+(.*)$/))) {
      const { children, markDefs } = parseInline(m[1], i);
      blocks.push({
        _key: `pt-${i}-${Date.now()}`,
        _type: 'block',
        style: 'normal',
        listItem: 'number',
        level: 1,
        markDefs,
        children
      });
      return;
    }

    // Обычный параграф
    const { children, markDefs } = parseInline(line, i);
    blocks.push({
      _key: `pt-${i}-${Date.now()}`,
      _type: 'block',
      style: 'normal',
      markDefs,
      children
    });
  });

  return blocks;
}

function isImageFile(name) {
  return /\.(jpe?g|png|webp)$/i.test(name);
}

function walkDir(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkDir(full));
    else if (entry.isFile() && isImageFile(entry.name)) out.push(full);
  }
  return out;
}

function resolveImageSourcesFromCSV(row) {
  const raw = (row.images_paths || '').trim();

  // A) список через запятую — оставляем как было
  if (raw.includes(',')) {
    return raw.split(',').map(s => s.trim()).filter(Boolean);
  }

  // B) "folder:project-001" или просто "project-001"
  const folderPrefix = raw.match(/^folder:(.+)$/i);
  const folderName = folderPrefix ? folderPrefix[1].trim() : raw;

  // C) пусто → папка по умолчанию = row.id
  const effectiveFolder = folderName || String(row.id || '').trim();
  if (!effectiveFolder) return [];

  const dir = path.join(LOCAL_IMG_DIR, effectiveFolder);
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
    // если это не папка — считаем, что это одиночный путь/URL (совместимость)
    return raw ? [raw] : [];
  }

  const files = fs.readdirSync(dir)
    .filter(isImageFile)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

  // Возвращаем relative path от LOCAL_IMG_DIR, например "project-001/01.jpg"
  return files.map(f => `${effectiveFolder}/${f}`);
}

// предзагрузка локальных картинок (рекурсивно), ключ = relative path от LOCAL_IMG_DIR
async function preloadImages() {
  const map = {};
  const files = walkDir(LOCAL_IMG_DIR);

  for (const absPath of files) {
    const rel = path.relative(LOCAL_IMG_DIR, absPath).replace(/\\/g, '/'); // важно для Windows
    try {
      const { _id } = await client.assets.upload(
        'image',
        fs.createReadStream(absPath),
        { filename: path.basename(absPath) }
      );

      // главное: хранить по относительному пути
      map[rel] = _id;

      // fallback по basename, чтобы не сломать старые CSV
      map[path.basename(rel)] ??= _id;

      console.log(`📦 Preloaded ${rel} → ${_id}`);
    } catch (e) {
      console.error(`⚠️ ${rel}: ${e.message}`);
    }
  }
  return map;
}

// загрузка картинки (URL или локальный через map)
// --- uploadImage: мягкий режим и fallback в папку images
async function uploadImage(src, localMap, { strict = true } = {}) {
  if (!src) return null;

  const cleaned = src.trim().replace(/\\/g, '/');

  // 1) точное совпадение по relative path (например "project-001/01.jpg")
  if (localMap[cleaned]) return localMap[cleaned];

  // 2) fallback по basename (например "01.jpg")
  const b = path.basename(cleaned);
  if (localMap[b]) return localMap[b];

  // URL
  if (/^https?:\/\//.test(cleaned)) {
    const res = await fetch(cleaned);
    if (!res.ok) {
      if (!strict) return null;
      throw new Error(res.statusText);
    }
    const buf = Buffer.from(await res.arrayBuffer());
    const fn = path.basename(new URL(cleaned).pathname);
    const { _id } = await client.assets.upload('image', buf, { filename: fn });
    return _id;
  }

  // Локальный путь: пробуем как есть...
  let abs = path.resolve(__dirname, cleaned);

  // ...и fallback в каталог изображений по basename
  if (!fs.existsSync(abs)) {
    abs = path.join(LOCAL_IMG_DIR, b);
  }

  if (!fs.existsSync(abs)) {
    if (!strict) return null;
    throw new Error(`Not found: ${abs}`);
  }

  const { _id } = await client.assets.upload('image', fs.createReadStream(abs), { filename: path.basename(abs) });
  return _id;
}

async function run() {
  // 1) Словарь developers
  const devs = await client.fetch(`*[_type=="developer"]{_id,language,slug,title}`);
  const devMap = {};
  devs.forEach(d => {
    const lang = d.language, slug = d.slug?.[lang]?.current;
    if (slug) devMap[`${lang}:${slug}`] = d._id;
    if (d.title) devMap[`${lang}:${d.title}`] = d._id;
  });

  // 2) Предзагрузка картинок
  const localMap = await preloadImages();

  // 3) Чтение CSV
  const csv = fs.readFileSync(CSV_PATH, 'utf8');
  const rows = parseCsvWithSecondHeader(csv);

  for (const row of rows) {
    if (!row.id) {
      console.warn('⚠️ row.id is empty, skipping row:', row);
      continue;
    }
    const baseId = `project-${row.id}`;
    const metaRefs = [];

    for (const lang of LANGS) {
      const docId = lang === DEFAULT_LANG ? baseId : `${baseId}.${lang}`;

      // — SEO
      const seo = {
        metaTitle: row[`seo_metaTitle_${lang}`] || '',
        metaDescription: row[`seo_metaDescription_${lang}`] || ''
      };

      // — локализованные строки
      const title = row[`title_${lang}`] || '';
      const excerpt = row[`excerpt_${lang}`] || '';
      const slug = row[`slug_${lang}`] || '';
      const computedAlt = (seo.metaTitle || title || slug || '').trim();

      // — previewImage + alt
      let previewRef = null;
      if (row.previewImage_path) {
        try {
          previewRef = await uploadImage(row.previewImage_path, localMap, { strict: false });
          if (!previewRef) console.warn(`⚠️ preview image not found: ${row.previewImage_path}`);
        } catch (e) {
          console.warn(`⚠️ preview upload failed: ${e.message}`);
        }
      }

      // — videoPreview: всегда такое же, как previewImage
      const videoId = row.videoId || '';
      const videoPreviewRef = videoId ? previewRef : null;
      if (videoId && !previewRef) {
        console.warn(`⚠️ videoId задан, но previewImage_path пустой/не найден (row id=${row.id}). videoPreview не будет.`);
      }

      // — галерея (ALT для всех изображений = computedAlt)
      const imgFiles = resolveImageSourcesFromCSV(row);
      // const alts = (row[`images_alts_${lang}`] || '').split('/').map(s => s.trim());
      const imagesSettled = await Promise.allSettled(
        imgFiles.map(async (fn, i) => {
          const ref = await uploadImage(fn, localMap, { strict: false }); // не валим процесс
          if (!ref) {
            console.warn(`⚠️ image skipped (not found): ${fn}`);
            return null;
          }
          return {
            _key: `img-${lang}-${i}-${Date.now()}`,
            _type: 'image',
            asset: { _ref: ref },
            alt: computedAlt
          };
        })
      );
      const images = imagesSettled
        .filter(r => r.status === 'fulfilled' && r.value)
        .map(r => r.value);

      // // — description и fullDescription как единый массив блоков
      // const description = textToPortableText(row[`description_${lang}`] || '');
      // const fullDescription = textToPortableText(row[`fullDescription_${lang}`] || '');

      // — description / fullDescription: поддержка мини-Markdown
      const description = mdToPT(row[`description_${lang}`] || '');
      const fullDescription = mdToPT(row[`fullDescription_${lang}`] || '');

      // — location
      const lat = parseFloat(row.location_lat) || 0;
      const lng = parseFloat(row.location_lng) || 0;

      // — developer по slug/title/UUID
      const rawDev = (row[`developer_${lang}`] || '').trim();
      let devRef = /^[0-9a-fA-F-]{36}$/.test(rawDev)
        ? rawDev
        : devMap[`${lang}:${rawDev}`];
      if (!devRef && rawDev) console.warn(`⚠️ Developer not found "${rawDev}" for ${lang}`);

      // — keyFeatures (не локализованы)
      const completionRaw = row.keyFeatures_completionDate || row.completionDate || '';
      const completionDate = normalizeMonthYear(completionRaw);

      const keyFeatures = {
        city: row.keyFeatures_city || '',
        propertyType: row.keyFeatures_propertyType || '',
        bedrooms: row.keyFeatures_bedrooms || '',
        coveredArea: row.keyFeatures_coveredArea || '',
        plotSize: row.keyFeatures_plotSize || '',
        ...(completionDate && { completionDate }), // пишем только валидное
        price: parseFloat(row.keyFeatures_price) || 0
      };

      if (completionRaw && !completionDate) {
        console.warn(`⚠️ Invalid completionDate "${completionRaw}" for row id=${row.id}`);
      }

      // — distances
      const distances = {
        beach: row.distances_beach || '',
        restaurants: row.distances_restaurants || '',
        shops: row.distances_shops || '',
        airport: row.distances_airport || '',
        hospital: row.distances_hospital || '',
        school: row.distances_school || '',
        cityCenter: row.distances_cityCenter || '',
        golfCourt: row.distances_golfCourt || ''
      };

      // — FAQ (Q::A) по '$'
      const faqParts = (row[`faq_${lang}`] || '')
        .split('$')
        .map(s => s.trim())
        .filter(Boolean);
      const faqItems = faqParts.map((item, i) => {
        const [q, a] = item.split('::').map(s => s.trim());
        return {
          _key: `faq-${lang}-${i}-${Date.now()}`,
          question: q || '',
          answer: mdToPT(a || '')
        };
      });

      // — собираем документ
      const doc = {
        _id: docId,
        _type: 'project',
        __i18n_lang: lang,
        __i18n_base: baseId,

        seo,
        title,
        excerpt,

        ...(previewRef && {
          previewImage: {
            _type: 'image',
            asset: { _ref: previewRef },
            alt: computedAlt
          }
        }),

        slug: { _type: 'localizedSlug', [lang]: { _type: 'slug', current: slug } },

        videoId,
        ...(videoPreviewRef && {
          videoPreview: {
            _type: 'image',
            asset: { _ref: videoPreviewRef },
            alt: computedAlt
          }
        }),

        images,
        ...(description.length > 0 && { description }),
        ...(fullDescription.length > 0 && { fullDescription }),
        location: { lat, lng },
        ...(devRef && { developer: { _type: 'reference', _ref: devRef } }),

        keyFeatures,
        distances,
        ...(faqItems.length > 0 && {
          faq: { _type: 'accordionBlock', items: faqItems }
        }),

        publishedAt: row.publishedAt,
        language: lang
      };

      try {
        await client.createOrReplace(doc);
        console.log(`✅ Imported ${docId}`);
      } catch (err) {
        console.error(`❌ ${docId}:`, err.message);
      }
      metaRefs.push({ _key: lang, value: { _type: 'reference', _ref: docId } });
    }

    // — translation.metadata
    const metaDoc = {
      _id: `${baseId}.i18n`,
      _type: 'translation.metadata',
      documentId: baseId,
      translations: metaRefs
    };
    try {
      await client.createOrReplace(metaDoc);
      console.log(`🔗 Meta: ${metaDoc._id}`);
    } catch (err) {
      console.error(`❌ Meta ${metaDoc._id}:`, err.message);
    }
  }
}

run().catch(e => {
  console.error('💥 Fatal:', e.message);
  process.exit(1);
});

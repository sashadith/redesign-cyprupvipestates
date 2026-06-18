// scripts/importLandings.cjs
/* eslint-disable no-console */
const path = require('path');
const fs = require('fs');
const { createClient } = require('@sanity/client');
const { parse } = require('csv-parse/sync');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

const client = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET,
  apiVersion: '2025-08-04',
  token: process.env.SANITY_API_TOKEN,
  useCdn: false,
});

const CSV_PATH = path.resolve(__dirname, 'landings.csv');
const LOCAL_IMG_DIR = path.resolve(__dirname, 'images');
const LANGS = ['de', 'pl', 'en', 'ru'];
const DEFAULT_LANG = 'de';

const FAQ_DEFAULT_TITLES = {
  en: 'Frequently asked questions',
  de: 'Häufig gestellte Fragen',
  pl: 'Najczęściej zadawane pytania',
  ru: 'Часто задаваемые вопросы',
};

// ---------- utils ----------
const nonEmpty = (v) => v !== undefined && v !== null && String(v).trim() !== '';

function parseCsvWithSecondHeader(csvText) {
  const cleaned = String(csvText).replace(/^\uFEFF/, '');
  const lines = cleaned.split(/\r?\n/);
  if (lines.length < 2) return [];

  // строка 2 = машинные названия колонок
  const headerLine = lines[1];

  // парсим заголовок корректно (с учётом кавычек и запятых)
  const [columns] = parse(headerLine, {
    relax_quotes: true,
    skip_empty_lines: true,
    relax_column_count: true,
  });

  // парсим весь CSV, но:
  // - columns: columns (вручную заданные имена)
  // - from_line: 3 (данные начинаются с 3-й строки)
  return parse(cleaned, {
    columns,
    from_line: 3,
    skip_empty_lines: true,
    relax_quotes: true,
  });
}

// mini-Markdown → Portable Text (H1–H3, списки, жирный/курсив, ссылки)
function mdToPT(text = '') {
  const lines = String(text).replace(/\r\n/g, '\n').split('\n');
  const blocks = [];

  const parseInline = (str, i) => {
    const children = [];
    const markDefs = [];

    // 1) ссылки [Anchor](https://example.com)
    const linkRegex = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
    let last = 0;
    let m;

    const pushText = (t) => {
      if (!t) return;
      children.push({
        _key: `span-${i}-${children.length}-${Date.now()}`,
        _type: 'span',
        text: t,
        marks: [],
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
        marks: [key],
      });

      last = m.index + m[0].length;
    }
    const tail = str.slice(last);
    if (tail) pushText(tail);

    // 2) жирный / курсив
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
            marks: node.marks || [],
          });
        }
        out.push({
          ...node,
          _key: node._key + `-m${out.length}`,
          text: mm[1],
          marks: [...(node.marks || []), mark],
        });
        lastIdx = mm.index + mm[0].length;
      }
      if (lastIdx < src.length) {
        out.push({
          ...node,
          _key: node._key + `-t${out.length}`,
          text: src.slice(lastIdx),
          marks: node.marks || [],
        });
      }
      return out;
    };

    let flat = [];
    children.forEach((n) => {
      const withBold = applyMarks(n, 'strong');
      withBold.forEach((b) => {
        const withItalic = applyMarks(b, 'em');
        flat.push(...withItalic);
      });
    });

    if (flat.length === 0) {
      flat = [
        {
          _key: `span-${i}-0-${Date.now()}`,
          _type: 'span',
          text: '',
          marks: [],
        },
      ];
    }

    return { children: flat, markDefs };
  };

  lines.forEach((raw, i) => {
    const line = raw.replace(/\t/g, '    ');
    if (!line.trim()) return;

    let m;

    // ### H3
    if ((m = line.match(/^###\s+(.*)$/))) {
      const { children, markDefs } = parseInline(m[1], i);
      blocks.push({
        _key: `pt-${i}-${Date.now()}`,
        _type: 'block',
        style: 'h3',
        markDefs,
        children,
      });
      return;
    }

    // ## H2
    if ((m = line.match(/^##\s+(.*)$/))) {
      const { children, markDefs } = parseInline(m[1], i);
      blocks.push({
        _key: `pt-${i}-${Date.now()}`,
        _type: 'block',
        style: 'h2',
        markDefs,
        children,
      });
      return;
    }

    // # H1
    if ((m = line.match(/^#\s+(.*)$/))) {
      const { children, markDefs } = parseInline(m[1], i);
      blocks.push({
        _key: `pt-${i}-${Date.now()}`,
        _type: 'block',
        style: 'h1',
        markDefs,
        children,
      });
      return;
    }

    // маркированный список - / *
    if ((m = line.match(/^(?:-|\*)\s+(.*)$/))) {
      const { children, markDefs } = parseInline(m[1], i);
      blocks.push({
        _key: `pt-${i}-${Date.now()}`,
        _type: 'block',
        style: 'normal',
        listItem: 'bullet',
        level: 1,
        markDefs,
        children,
      });
      return;
    }

    // нумерованный список 1. 2. ...
    if ((m = line.match(/^\d+\.\s+(.*)$/))) {
      const { children, markDefs } = parseInline(m[1], i);
      blocks.push({
        _key: `pt-${i}-${Date.now()}`,
        _type: 'block',
        style: 'normal',
        listItem: 'number',
        level: 1,
        markDefs,
        children,
      });
      return;
    }

    // обычный параграф
    const { children, markDefs } = parseInline(line, i);
    blocks.push({
      _key: `pt-${i}-${Date.now()}`,
      _type: 'block',
      style: 'normal',
      markDefs,
      children,
    });
  });

  return blocks;
}

function truncate(str = '', n = 200) {
  const s = String(str).replace(/\s+/g, ' ').trim();
  return s.length > n ? s.slice(0, n).trim() : s;
}

async function preloadImages() {
  const map = {};
  if (!fs.existsSync(LOCAL_IMG_DIR)) return map;
  const files = fs.readdirSync(LOCAL_IMG_DIR).filter(f => /\.(jpe?g|png|webp)$/i.test(f));
  for (const file of files) {
    const full = path.join(LOCAL_IMG_DIR, file);
    try {
      const { _id } = await client.assets.upload('image', fs.createReadStream(full), { filename: file });
      map[file] = _id;
      console.log(`📦 Preloaded ${file} → ${_id}`);
    } catch (e) {
      console.error(`⚠️ preload ${file}: ${e.message}`);
    }
  }
  return map;
}

async function uploadImage(src, localMap, { strict = true } = {}) {
  if (!nonEmpty(src)) return null;

  const trimmed = String(src).trim();
  const b = path.basename(trimmed);

  // 1) если уже предзагружено — сразу отдаем asset id
  if (localMap[b]) return localMap[b];

  // 2) URL-картинка
  if (/^https?:\/\//.test(trimmed)) {
    const res = await fetch(trimmed);
    if (!res.ok) {
      if (!strict) return null;
      throw new Error(res.statusText);
    }
    const buf = Buffer.from(await res.arrayBuffer());
    const fn = path.basename(new URL(trimmed).pathname);
    const { _id } = await client.assets.upload('image', buf, { filename: fn });
    return _id;
  }

  // 3) Локальный путь: сначала пробуем как есть...
  let abs = path.resolve(__dirname, trimmed);

  // ...потом fallback в каталог LOCAL_IMG_DIR
  if (!fs.existsSync(abs)) {
    abs = path.join(LOCAL_IMG_DIR, b);
  }

  // если файла нет — мягкий режим или ошибка
  if (!fs.existsSync(abs)) {
    if (!strict) return null;
    throw new Error(`Not found: ${abs}`);
  }

  const { _id } = await client.assets.upload(
    'image',
    fs.createReadStream(abs),
    { filename: path.basename(abs) }
  );
  return _id;
}


/**
 * ЯЗЫКОЗАВИСИМАЯ карта проектов:
 *  - bySlug:  Map<`${lang}:${slug}`, _id>
 *  - byTitle: Map<`${lang}:${lower(title)}`, _id>
 * ДОПОЛНИТЕЛЬНО:
 *  - anySlug: Map<lower(slug), _id> — кросс-языковой фолбэк, если slug заполнен только в одной локали.
 *
 * ВАЖНО: собираем по slug.de/en/pl/ru, НЕ используем поле document.language.
 */
async function buildProjectRefMap() {
  const all = await client.fetch(`*[_type=="project"]{
    _id,
    title,
    "slug_de": slug.de.current,
    "slug_en": slug.en.current,
    "slug_pl": slug.pl.current,
    "slug_ru": slug.ru.current
  }`);

  const bySlug = new Map();
  const byTitle = new Map();
  const anySlug = new Map();
  const lower = (s) => String(s || '').trim().toLowerCase();

  for (const p of all) {
    const mapSlug = (langKey, slugVal) => {
      if (!slugVal) return;
      const trimmed = String(slugVal).trim();
      bySlug.set(`${langKey}:${trimmed}`, p._id);
      anySlug.set(lower(trimmed), p._id);
    };
    mapSlug('de', p.slug_de);
    mapSlug('en', p.slug_en);
    mapSlug('pl', p.slug_pl);
    mapSlug('ru', p.slug_ru);

    if (p.title) {
      const t = lower(p.title);
      byTitle.set(`de:${t}`, p._id);
      byTitle.set(`en:${t}`, p._id);
      byTitle.set(`pl:${t}`, p._id);
      byTitle.set(`ru:${t}`, p._id);
    }
  }

  console.log(`🔎 Project index built: bySlug=${bySlug.size}, byTitle=${byTitle.size}, anySlug=${anySlug.size}`);
  return { bySlug, byTitle, anySlug };
}

async function findParentForLang(parentSlug, lang) {
  if (!nonEmpty(parentSlug)) return null;
  const doc = await client.fetch(
    `*[_type=="singlepage" && language==$lang && slug[$lang].current==$slug][0]{_id}`,
    { lang, slug: String(parentSlug).trim() }
  );
  if (!doc?._id) {
    console.warn(`⚠️ parent not found for lang=${lang}, slug="${parentSlug}"`);
  }
  return doc?._id || null;
}

// ---------- main ----------
async function run() {
  const localMap = await preloadImages();

  const { bySlug: projectBySlug, byTitle: projectByTitle, anySlug: projectAnySlug } = await buildProjectRefMap();
  const lower = (s) => String(s || '').trim().toLowerCase();

  const csv = fs.readFileSync(CSV_PATH, 'utf8');
  const rows = parseCsvWithSecondHeader(csv);

  for (const row of rows) {
    const baseId = `single-${row.id}`;
    const metaRefs = [];
    const tx = client.transaction();

    // Preview Image (общий ассет)
    // Preview Image (общий ассет)
    let previewRef = null;
    if (nonEmpty(row.previewImage_path)) {
      try {
        // strict: false — не валим процесс, если картинки нет
        previewRef = await uploadImage(row.previewImage_path, localMap, { strict: false });
        if (!previewRef) {
          console.warn(`⚠️ preview image not found: ${row.previewImage_path}`);
        }
      } catch (e) {
        console.warn(`⚠️ preview upload failed: ${e.message}`);
      }
    }

    for (const lang of LANGS) {
      const docId = lang === DEFAULT_LANG ? baseId : `${baseId}.${lang}`;

      // → Title из Intro Title
      const introTitle = row[`landingIntro_title_${lang}`] || '';
      const title = introTitle;

      // → Excerpt из Intro Description (обрезаем до 200)
      const introDesc = row[`landingIntro_desc_${lang}`] || '';
      const excerpt = nonEmpty(introDesc) ? truncate(introDesc, 200) : '';

      // Остальные поля
      const slug = row[`slug_${lang}`] || '';
      const seo_metaTitle = row[`seo_metaTitle_${lang}`] || '';
      const seo_metaDescription = row[`seo_metaDescription_${lang}`] || '';
      const introSubtitle = row[`landingIntro_subtitle_${lang}`] || '';
      const introBtn = row[`landingIntro_button_${lang}`] || '';

      // alt как в проектах: metaTitle → title → slug
      const computedAlt = (seo_metaTitle || title || slug || '').trim();

      const previewImage = previewRef
        ? {
          _type: 'image',
          asset: { _type: 'reference', _ref: previewRef },
          ...(nonEmpty(computedAlt) && { alt: computedAlt }),
        }
        : null;

      // landingIntroBlock (картинка = previewImage)
      const introHasAny =
        nonEmpty(introSubtitle) ||
        nonEmpty(introTitle) ||
        nonEmpty(introDesc) ||
        nonEmpty(introBtn) ||
        previewRef;

      const introBlock = introHasAny
        ? {
          _key: `b-intro-${lang}-${Date.now()}`,
          _type: 'landingIntroBlock',
          ...(nonEmpty(introSubtitle) && { subtitle: introSubtitle }),
          ...(nonEmpty(introTitle) && { title: introTitle }),
          ...(nonEmpty(introDesc) && { description: introDesc }),
          ...(nonEmpty(introBtn) && { buttonLabel: introBtn }),
          ...(previewRef && {
            image: {
              _type: 'image',
              asset: { _type: 'reference', _ref: previewRef },
              ...(nonEmpty(computedAlt) && { alt: computedAlt }),
            },
          }),
        }
        : null;

      // landingProjectsBlock
      const lpTitle = row[`landingProjects_title_${lang}`] || row.landingProjects_title || '';
      const lpCity = row.landingProjects_city || '';
      const lpType = row.landingProjects_propertyType || '';

      // слаги из одной общей колонки, игнорируем '...'
      const rawKeys = String(row['landingProjects_projects_slugs'] || '')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
        .filter(s => s !== '...');

      let lpProjects = null;

      if (rawKeys.length) {
        const resolved = [];
        const seen = new Set();

        for (const keyRaw of rawKeys) {
          const key = String(keyRaw).trim();
          if (!key || key === '...') continue;
          const kLower = lower(key);
          if (seen.has(kLower)) continue;
          seen.add(kLower);

          // 1) строго по языку и слагу
          const idBySlug = projectBySlug.get(`${lang}:${key}`);
          if (idBySlug) { resolved.push(idBySlug); continue; }

          // 2) по title в этом же языке
          const idByTitle = projectByTitle.get(`${lang}:${kLower}`);
          if (idByTitle) { resolved.push(idByTitle); continue; }

          // 3) кросс-языковой фолбэк: этот слаг в любой локали
          const idAny = projectAnySlug.get(kLower);
          if (idAny) {
            resolved.push(idAny);
            console.warn(`ℹ️ using slug from another locale for key="${key}" (lang=${lang}) — заполните slug.${lang}.current в Sanity`);
            continue;
          }

          console.warn(`⚠️ project not found for lang=${lang}, key="${key}" (slug/title)`);
        }

        if (resolved.length) {
          const ts = Date.now();
          lpProjects = resolved.map((id, i) => ({
            _key: `pr-${i}-${ts}`,
            _type: 'reference',
            _ref: id,
          }));
        }
      }

      const projectsBlock =
        nonEmpty(lpTitle) || nonEmpty(lpCity) || nonEmpty(lpType) || lpProjects
          ? {
            _key: `b-proj-${lang}-${Date.now()}`,
            _type: 'landingProjectsBlock',
            ...(nonEmpty(lpTitle) && { title: lpTitle }),
            ...(nonEmpty(lpCity) && { filterCity: lpCity }),
            ...(nonEmpty(lpType) && { filterPropertyType: lpType }),
            ...(lpProjects && { projects: lpProjects }),
          }
          : null;

      // landingTextStart
      const tStartText = row[`textStart_${lang}`] || '';
      const textStartBlock = nonEmpty(tStartText)
        ? { _key: `b-tstart-${lang}-${Date.now()}`, _type: 'landingTextStart', content: mdToPT(tStartText) }
        : null;

      // landingTextFirst
      const tfText = row[`textFirst_${lang}`] || '';
      const textFirstBlock = nonEmpty(tfText)
        ? { _key: `b-tf-${lang}-${Date.now()}`, _type: 'landingTextFirst', content: mdToPT(tfText) }
        : null;

      // landingFaqBlock
      let faqTitle = row[`faq_title_${lang}`] || '';      // <- теперь let
      const faqRaw = row[`faq_${lang}`] || '';

      const faqItems = String(faqRaw)
        .split('$')
        .map(s => s.trim())
        .filter(Boolean)
        .map((it, i) => {
          const [q, a] = it.split('::').map(t => t.trim());
          const item = {
            _key: `faq-${lang}-${i}-${Date.now()}`,
            ...(nonEmpty(q) && { question: q }),
            ...(nonEmpty(a) && { answer: mdToPT(a) }),
          };
          return item;
        })
        .filter(obj => obj.question || obj.answer);

      // если в CSV заголовок пустой, но есть хотя бы один FAQ — подставляем дефолтный
      if (!nonEmpty(faqTitle) && faqItems.length) {
        faqTitle = FAQ_DEFAULT_TITLES[lang] || 'FAQ';
      }

      const faqBlock =
        nonEmpty(faqTitle) || faqItems.length
          ? {
            _key: `b-faq-${lang}-${Date.now()}`,
            _type: 'landingFaqBlock',
            ...(nonEmpty(faqTitle) && { title: faqTitle }),
            ...(faqItems.length && { faq: { _type: 'accordionBlock', items: faqItems } }),
          }
          : null;

      // landingTextSecond
      const tsText = row[`textSecond_${lang}`] || '';
      const textSecondBlock = nonEmpty(tsText)
        ? { _key: `b-ts-${lang}-${Date.now()}`, _type: 'landingTextSecond', content: mdToPT(tsText) }
        : null;

      // contentBlocks
      const contentBlocks = [
        introBlock,
        textStartBlock,
        projectsBlock,
        textFirstBlock,
        faqBlock,
        textSecondBlock,
      ].filter(Boolean);

      // parentPage (опционально)
      const parentSlug = row[`parent_slug_${lang}`] || '';
      const parentId = await findParentForLang(parentSlug, lang).catch(() => null);
      const parentRef = parentId ? { _type: 'reference', _ref: parentId } : null;

      // собираем документ — пишем только непустые поля
      const doc = {
        _id: docId,
        _type: 'singlepage',
        __i18n_lang: lang,
        __i18n_base: baseId,

        ...(nonEmpty(title) && { title }),
        ...(nonEmpty(slug) && { slug: { _type: 'localizedSlug', [lang]: { _type: 'slug', current: slug } } }),
        ...(nonEmpty(excerpt) && { excerpt }),
        ...(nonEmpty(seo_metaTitle) || nonEmpty(seo_metaDescription)
          ? {
            seo: {
              ...(nonEmpty(seo_metaTitle) && { metaTitle: seo_metaTitle }),
              ...(nonEmpty(seo_metaDescription) && { metaDescription: seo_metaDescription }),
            },
          }
          : {}),

        ...(previewImage && { previewImage }),
        ...(contentBlocks.length && { contentBlocks }),
        ...(parentRef && { parentPage: parentRef }),
        language: lang,
      };

      tx.createOrReplace(doc);
      metaRefs.push({
        _key: lang,
        value: { _type: 'reference', _ref: docId },
      });
    }

    // translation.metadata — без лишних полей
    tx.createOrReplace({
      _id: `${baseId}.i18n`,
      _type: 'translation.metadata',
      translations: metaRefs,
    });

    try {
      await tx.commit();
      console.log(`✅ Imported ${baseId} (+i18n)`);
    } catch (e) {
      const msg = String(e?.message || e);
      // Если схема не принимает reference в списке — перезапишем документ, заменив ссылки на строки
      if (/items? of type reference not valid for this list/i.test(msg) || /type reference not valid/i.test(msg)) {
        console.warn(`↻ Fallback to slug strings for ${baseId} due to schema constraints...`);

        for (const lang of LANGS) {
          const docId = lang === DEFAULT_LANG ? baseId : `${baseId}.${lang}`;
          try {
            const doc = await client.getDocument(docId);
            if (!doc?.contentBlocks) continue;

            const patchedBlocks = doc.contentBlocks.map(block => {
              if (block?._type !== 'landingProjectsBlock') return block;

              const slugsCell = String(row['landingProjects_projects_slugs'] || '')
                .split(',')
                .map(s => String(s).trim())
                .filter(Boolean)
                .filter(s => s !== '...');

              return { ...block, projects: slugsCell };
            });

            await client.patch(docId).set({ contentBlocks: patchedBlocks }).commit();
            console.log(`✅ Fallback saved for ${docId}`);
          } catch (err2) {
            console.error(`❌ Fallback failed for ${docId}: ${err2.message}`);
          }
        }
      } else {
        console.error(`❌ ${baseId}: ${msg}`);
      }
    }
  }
}

run().catch(e => {
  console.error('💥 Fatal:', e);
  process.exit(1);
});

// scripts/updateProjects.cjs

const path = require('path')
const fs = require('fs')
const { createClient } = require('@sanity/client')
const { parse } = require('csv-parse/sync')
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') })

// — Инициализация Sanity-клиента
const client = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET,
  apiVersion: '2025-08-04',
  token: process.env.SANITY_API_TOKEN,
  useCdn: false,
})

// — Путь к CSV и папка с локальными картинками
const CSV_PATH = path.resolve(__dirname, 'projects.csv')
const LOCAL_IMG_DIR = path.resolve(__dirname, 'images')

// — Языки и основной
const LANGS = ['de', 'pl', 'en', 'ru']
const DEFAULT_LANG = 'de'

// — Функция для PortableText-блоков
function textToPortableText(text = '') {
  return text
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean)
    .map((l, i) => ({
      _key: `pt-${i}-${Date.now()}`,
      _type: 'block',
      style: 'normal',
      markDefs: [],
      children: [{
        _key: `span-${i}-${Date.now()}`,
        _type: 'span',
        text: l,
        marks: []
      }]
    }))
}

// — Предзагрузка локальных картинок для ускорения
async function preloadImages() {
  const map = {}
  if (!fs.existsSync(LOCAL_IMG_DIR)) return map
  for (const file of fs.readdirSync(LOCAL_IMG_DIR).filter(f => /\.(jpe?g|png|webp)$/i.test(f))) {
    const full = path.join(LOCAL_IMG_DIR, file)
    try {
      const { _id } = await client.assets.upload('image', fs.createReadStream(full), { filename: file })
      map[file] = _id
      console.log(`📦 Preloaded ${file} → ${_id}`)
    } catch (e) {
      console.error(`⚠️ Failed to preload ${file}: ${e.message}`)
    }
  }
  console.log('✅ All local images preloaded, moving on to CSV…')
  return map
}

// — Универсальная загрузка картинки (URL или локальная по map)
async function uploadImage(src, localMap) {
  if (!src) return null
  const bn = path.basename(src.trim())
  if (localMap[bn]) return localMap[bn]
  if (/^https?:\/\//.test(src)) {
    const res = await fetch(src)
    if (!res.ok) throw new Error(`Fetch ${src} failed: ${res.statusText}`)
    const buf = Buffer.from(await res.arrayBuffer())
    const fn = path.basename(new URL(src).pathname)
    const { _id } = await client.assets.upload('image', buf, { filename: fn })
    return _id
  }
  const abs = path.resolve(__dirname, src)
  if (!fs.existsSync(abs)) throw new Error(`File not found: ${abs}`)
  const { _id } = await client.assets.upload('image', fs.createReadStream(abs), { filename: path.basename(abs) })
  return _id
}

async function run() {
  // 1) Предзагрузить локальные изображения
  const localMap = await preloadImages()

  // 2) Прочитать и распарсить CSV (начиная со 2-й строки, чтобы пропустить заголовки)
  const csv = fs.readFileSync(CSV_PATH, 'utf8')
  const rows = parse(csv, { columns: true, skip_empty_lines: true, from_line: 2 })

  for (const row of rows) {
    const baseId = `project-${row.id}`
    const metaRefs = []

    for (const lang of LANGS) {
      // составляем ID документа: для de — просто baseId, для других — baseId.<lang>
      const docId = lang === DEFAULT_LANG ? baseId : `${baseId}.${lang}`

      // ------------------
      //  Собираем поля для патча
      // ------------------

      // SEO
      const seo = {
        metaTitle: row[`seo_metaTitle_${lang}`] || '',
        metaDescription: row[`seo_metaDescription_${lang}`] || ''
      }

      // простые локализованные строки
      const title = row[`title_${lang}`] || ''
      const excerpt = row[`excerpt_${lang}`] || ''
      const slugCurrent = row[`slug_${lang}`] || ''

      // previewImage + alt
      let previewRef = null
      if (row.previewImage_path) {
        try {
          previewRef = await uploadImage(row.previewImage_path, localMap)
        } catch (e) {
          console.error(`⚠️ preview upload failed: ${e.message}`)
        }
      }

      // videoId + videoPreview
      const videoId = row.videoId || ''
      let videoPreviewRef = null
      if (row.videoPreview_path) {
        try {
          videoPreviewRef = await uploadImage(row.videoPreview_path, localMap)
        } catch (e) {
          console.error(`⚠️ videoPreview upload failed: ${e.message}`)
        }
      }

      // галерея картинок + локализованные ALT через '/'
      const imgFiles = (row.images_paths || '').split(',').map(s => s.trim()).filter(Boolean)
      const alts = (row[`images_alts_${lang}`] || '').split('/').map(s => s.trim())
      const images = await Promise.all(imgFiles.map(async (fn, i) => {
        const ref = await uploadImage(fn, localMap)
        return {
          _key: `img-${lang}-${i}-${Date.now()}`,
          _type: 'image',
          asset: { _ref: ref },
          alt: alts[i] || ''
        }
      }))

      // ОДИН блок description и ОДИН блок fullDescription
      const description = textToPortableText(row[`description_${lang}`] || '')
      const fullDescription = textToPortableText(row[`fullDescription_${lang}`] || '')

      // location
      const lat = parseFloat(row.location_lat) || 0
      const lng = parseFloat(row.location_lng) || 0

      // developer reference по slug/title/UUID
      let devRef = null
      const rawDev = (row[`developer_${lang}`] || '').trim()
      if (/^[0-9a-fA-F-]{36}$/.test(rawDev)) {
        devRef = rawDev
      } else if (rawDev) {
        // подставьте свою логику поиска по слагу/тайтлу, если нужно
        console.warn(`⚠️ Dev lookup by name/slug not implemented, got "${rawDev}"`)
      }

      // keyFeatures (не локализованы)
      const keyFeatures = {
        city: row.keyFeatures_city || '',
        propertyType: row.keyFeatures_propertyType || '',
        bedrooms: row.keyFeatures_bedrooms || '',
        coveredArea: row.keyFeatures_coveredArea || '',
        plotSize: row.keyFeatures_plotSize || '',
        energyEfficiency: row.keyFeatures_energyEfficiency || '',
        price: parseFloat(row.keyFeatures_price) || 0
      }

      // distances
      const distances = {
        beach: row.distances_beach || '',
        restaurants: row.distances_restaurants || '',
        shops: row.distances_shops || '',
        airport: row.distances_airport || '',
        hospital: row.distances_hospital || '',
        school: row.distances_school || '',
        cityCenter: row.distances_cityCenter || '',
        golfCourt: row.distances_golfCourt || ''
      }

      // FAQ (Q::A) разделённых '$'
      const faqParts = (row[`faq_${lang}`] || '').split('$').map(s => s.trim()).filter(Boolean)
      const faqItems = faqParts.map((item, i) => {
        const [q, a] = item.split('::').map(s => s.trim())
        return {
          _key: `faq-${lang}-${i}-${Date.now()}`,
          question: q || '',
          answer: textToPortableText(a || '')
        }
      })

      // ------------------
      //  Собираем объект полей для патча
      // ------------------
      const fieldsToUpdate = {
        seo,
        title,
        excerpt,
        slug: { _type: 'localizedSlug', [lang]: { _type: 'slug', current: slugCurrent } },
        videoId,
        keyFeatures,
        distances,
        publishedAt: row.publishedAt,
      }

      if (previewRef) {
        fieldsToUpdate.previewImage = {
          _type: 'image',
          asset: { _ref: previewRef },
          alt: row[`previewImage_alt_${lang}`] || ''
        }
      }
      if (videoPreviewRef) {
        fieldsToUpdate.videoPreview = {
          _type: 'image',
          asset: { _ref: videoPreviewRef },
          alt: row[`videoPreview_alt_${lang}`] || ''
        }
      }
      if (images.length) {
        fieldsToUpdate.images = images
      }
      if (description.length) {
        fieldsToUpdate.description = description
      }
      if (fullDescription.length) {
        fieldsToUpdate.fullDescription = fullDescription
      }
      if (devRef) {
        fieldsToUpdate.developer = { _type: 'reference', _ref: devRef }
      }
      if (faqItems.length) {
        fieldsToUpdate.faq = { _type: 'accordionBlock', items: faqItems }
      }
      // всегда обновляем геопоинт
      fieldsToUpdate.location = { lat, lng }

      // ------------------
      //  Выполняем PATCH
      // ------------------
      try {
        await client
          .patch(docId)
          .set(fieldsToUpdate)
          .commit()
        console.log(`✅ Patched ${docId}`)
      } catch (err) {
        console.error(`❌ Patch ${docId}:`, err.message)
      }

      metaRefs.push({ _key: lang, value: { _type: 'reference', _ref: docId } })
    }

    // — обновление metadata (при необходимости)
    try {
      await client
        .patch(`${baseId}.i18n`)
        .set({ translations: metaRefs })
        .commit()
      console.log(`🔗 Meta-patched ${baseId}.i18n`)
    } catch (err) {
      console.error(`❌ Meta patch ${baseId}.i18n:`, err.message)
    }
  }
}

run().catch(err => {
  console.error('💥 Fatal:', err.message)
  process.exit(1)
})

const csv = require('csvtojson');
const fs = require('fs');

const LANGS = ['en', 'de', 'ru', 'pl'];

const getLocalizedField = (item, fieldName, lang) => item[`${fieldName}${lang.toUpperCase()}`] || '';

const toPortableText = (text) => {
  return text
    ? [{ _type: 'block', style: 'normal', children: [{ _type: 'span', text: text, marks: [] }] }]
    : [];
};

csv()
  .fromFile('import-data/Projects.csv')
  .then((projects) => {
    const sanityDocs = [];

    projects.forEach((item) => {
      const localizedSlug = LANGS.reduce((acc, lang) => {
        acc[lang] = { current: item.slug };
        return acc;
      }, {});

      LANGS.forEach((lang) => {
        sanityDocs.push({
          _id: `project-${item.slug}-${lang}`,
          _type: 'project',
          slug: localizedSlug,
          language: lang,
          title: item.title,
          excerpt: item.excerpt,
          keyFeatures: {
            city: item.city,
            propertyType: item.propertyType,
            bedrooms: item.bedrooms,
            coveredArea: item.coveredArea,
            plotSize: item.plotSize,
            energyEfficiency: item.energyEfficiency,
            price: parseInt(item.price),
          },
          location: {
            lat: parseFloat(item.lat),
            lng: parseFloat(item.lng),
          },
          distances: {
            beach: item.beach,
            restaurants: item.restaurants,
            shops: item.shops,
            airport: item.airport,
            hospital: item.hospital,
            school: item.school,
            cityCenter: item.cityCenter,
            golfCourt: item.golfCourt,
          },
          seo: {
            metaTitle: getLocalizedField(item, 'metaTitle', lang),
            metaDescription: getLocalizedField(item, 'metaDescription', lang),
          },
          description: toPortableText(getLocalizedField(item, 'description', lang)),
          fullDescription: toPortableText(getLocalizedField(item, 'fullDescription', lang)),
        });
      });
    });

    fs.writeFileSync('projects-i18n.json', JSON.stringify(sanityDocs, null, 2));
    console.log('Sanity JSON (i18n) file created with Portable Text!');
  });

const fs = require('fs');

const json = JSON.parse(fs.readFileSync('import-data/projects-i18n.json', 'utf8'));
const ndjson = json.map(doc => JSON.stringify(doc)).join('\n');

fs.writeFileSync('import-data/projects-i18n.ndjson', ndjson);

console.log('✅ NDJSON file created: import-data/projects-i18n.ndjson');

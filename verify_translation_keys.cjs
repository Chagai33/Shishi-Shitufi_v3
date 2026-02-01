const fs = require('fs');
const path = require('path');

console.log('Script started');

const srcDir = 'c:\\Shishi-Shitufi_newV3V3\\src';
console.log('srcDir:', srcDir);

const hePath = path.join(srcDir, 'locales', 'he.json');
const enPath = path.join(srcDir, 'locales', 'en.json');
const esPath = path.join(srcDir, 'locales', 'es.json');

let he, en, es;

try {
    console.log('Reading HE...');
    he = JSON.parse(fs.readFileSync(hePath, 'utf8')).translation;
    console.log('Reading EN...');
    en = JSON.parse(fs.readFileSync(enPath, 'utf8')).translation;
    console.log('Reading ES...');
    es = JSON.parse(fs.readFileSync(esPath, 'utf8')).translation;
} catch (e) {
    console.error('Error reading JSON files:', e);
    process.exit(1);
}

function flattenKeys(obj, prefix = '') {
    let keys = [];
    for (const key in obj) {
        if (typeof obj[key] === 'object' && obj[key] !== null) {
            keys = keys.concat(flattenKeys(obj[key], prefix + key + '.'));
        } else {
            keys.push(prefix + key);
        }
    }
    return keys;
}

const heKeys = new Set(flattenKeys(he));
const enKeys = new Set(flattenKeys(en));
const esKeys = new Set(flattenKeys(es));

console.log('Total HE keys:', heKeys.size);
console.log('Total EN keys:', enKeys.size);
console.log('Total ES keys:', esKeys.size);

// Find keys in EN/ES but missing in HE
const missingInHeFromEn = [...enKeys].filter(k => !heKeys.has(k));
const missingInHeFromEs = [...esKeys].filter(k => !heKeys.has(k));

console.log('\n--- Keys in EN but missing in HE ---');
console.log(JSON.stringify(missingInHeFromEn, null, 2));
console.log('\n--- Keys in ES but missing in HE ---');
console.log(JSON.stringify(missingInHeFromEs, null, 2));

// Scan code for keys
function scanDir(dir, fileList = []) {
    try {
        const files = fs.readdirSync(dir);
        files.forEach(file => {
            const filePath = path.join(dir, file);
            try {
                const stat = fs.statSync(filePath);
                if (stat.isDirectory()) {
                    scanDir(filePath, fileList);
                } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
                    fileList.push(filePath);
                }
            } catch (err) {
                console.error('Error stating file:', filePath, err.message);
            }
        });
    } catch (err) {
        console.error('Error reading dir:', dir, err.message);
    }
    return fileList;
}

console.log('Scanning source files...');
const files = scanDir(srcDir);
console.log('Found files:', files.length);

const usedKeys = new Set();
const keyRegex = /[^a-zA-Z0-9]t\(['"]([a-zA-Z0-9_.]+)['"]\)/g;
const i18nKeyRegex = /i18nKey=['"]([a-zA-Z0-9_.]+)['"]/g;
const i18nTRegex = /i18n\.t\(['"]([a-zA-Z0-9_.]+)['"]\)/g;

files.forEach(file => {
    try {
        const content = fs.readFileSync(file, 'utf8');
        let match;
        while ((match = keyRegex.exec(content)) !== null) {
            usedKeys.add(match[1]);
        }
        while ((match = i18nKeyRegex.exec(content)) !== null) {
            usedKeys.add(match[1]);
        }
        while ((match = i18nTRegex.exec(content)) !== null) {
            usedKeys.add(match[1]);
        }
    } catch (err) {
        console.error('Error reading file:', file, err.message);
    }
});

console.log('Total unique keys used in code:', usedKeys.size);

console.log('\n--- Keys used in code but missing in HE ---');
const missingInHeFromCode = [...usedKeys].filter(k => !heKeys.has(k));
console.log(JSON.stringify(missingInHeFromCode, null, 2));
console.log('Done');

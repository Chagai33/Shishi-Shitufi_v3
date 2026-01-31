const fs = require('fs');
const path = require('path');

// List of files to check (from user's list)
const filesToCheck = [
    'src/pages/EventPage.tsx',
    'src/pages/DashboardPage.tsx',
    'src/pages/LandingPage.tsx',
    'src/pages/LoginPage.tsx',
    'src/components/Admin/BulkItemsManager.tsx',
    'src/components/Admin/ImportItemsModal.tsx',
    'src/components/Admin/PresetListsManager.tsx',
    'src/components/Common/LanguageSwitcher.tsx',
    'src/components/Common/LoadingSpinner.tsx',
    'src/components/Common/NavigationMenu.tsx',
    'src/components/Events/AssignmentModal.tsx',
    'src/components/Events/CategorySelector.tsx',
    'src/components/Events/EditItemModal.tsx',
    'src/components/Events/EventsList.tsx',
    'src/components/Events/UserMenuItemForm.tsx',
    'src/components/Layout/Footer.tsx',
    'src/components/Layout/Header.tsx',
    'src/hooks/useAuth.ts'
];

const hePath = 'src/locales/he.json';

// Load Hebrew translations
const heContent = JSON.parse(fs.readFileSync(hePath, 'utf8'));

// Flatten keys function (handling 'translation' wrapper if present)
function flattenKeys(obj, prefix = '') {
    let keys = [];
    for (const k in obj) {
        if (typeof obj[k] === 'object' && obj[k] !== null) {
            keys = keys.concat(flattenKeys(obj[k], prefix + k + '.'));
        } else {
            keys.push(prefix + k);
        }
    }
    return keys;
}

// Adjust for 'translation' wrapper if i18next extracts it
// If the file structure is { translation: { ... } }, effectively keys are translation.foo.bar
// BUT valid keys in code are foo.bar (if default NS is translation and resources structure is correct)
// OR valid keys are translation.foo.bar?
// We will store BOTH forms to be safe, or check structure.
const flatKeys = new Set(flattenKeys(heContent));

// Identify if 'translation' is top level
let standardizedKeys = new Set();
// If 'translation' is at the root, we assume usage is WITHOUT 'translation.' prefix
// unless namespace logic differs.
// We will add versions with and without 'translation.' prefix from the set if it starts with it.
flatKeys.forEach(k => {
    standardizedKeys.add(k);
    if (k.startsWith('translation.')) {
        standardizedKeys.add(k.replace('translation.', ''));
    }
});

console.log(`Loaded ${flatKeys.size} translation keys.`);

const tRegex = /\bt\(['"]([^'"]+)['"]\)/g;
// Regex for Hebrew characters (range \u0590-\u05FF)
const hebrewRegex = /[\u0590-\u05FF]+/g;

let missingKeys = [];
let hardcodedHebrew = [];

filesToCheck.forEach(file => {
    const fullPath = path.resolve('C:/Shishi-Shitufi_newV3V3', file);
    if (!fs.existsSync(fullPath)) {
        console.warn(`File not found: ${file}`);
        return;
    }

    const content = fs.readFileSync(fullPath, 'utf8');
    const lines = content.split('\n');

    lines.forEach((line, index) => {
        const lineNum = index + 1;

        // Check for t('key')
        let match;
        while ((match = tRegex.exec(line)) !== null) {
            const key = match[1];
            // Ignore dynamic keys that contain ${} or similar (simple check)
            if (key.includes('${') || key.includes('+')) continue;

            if (!standardizedKeys.has(key)) {
                missingKeys.push({ file, line: lineNum, key });
            }
        }

        // Check for Hardcoded Hebrew
        // Exclude lines with known safe patterns (comments, console.log not skipped but maybe valid)
        // Skip lines that look like import statements
        if (line.trim().startsWith('import ') || line.trim().startsWith('//')) return;

        // We want to find Hebrew that is NOT inside t('...') 
        // Simple heuristic: if line has Hebrew, print it.
        // Can be noisy but useful.
        if (hebrewRegex.test(line)) {
            // Check if it's inside a t() call? Hard to do with regex perfectly.
            // But if we see Hebrew literals ` "..." ` or ` '...' ` or ` >...< `
            hardcodedHebrew.push({ file, line: lineNum, content: line.trim() });
        }
    });
});

console.log('\n--- Missing Keys (used in code but not in he.json) ---');
if (missingKeys.length === 0) console.log('None found.');
else missingKeys.forEach(m => console.log(`${m.file}:${m.line} - ${m.key}`));

console.log('\n--- Potential Hardcoded Hebrew ---');
if (hardcodedHebrew.length === 0) console.log('None found.');
else hardcodedHebrew.forEach(h => console.log(`${h.file}:${h.line} - ${h.content}`));

const fs = require('fs');
const path = require('path');

const srcDir = 'c:\\Shishi-Shitufi_newV3V3\\src';
const localesDir = path.join(srcDir, 'locales');

const files = {
    he: path.join(localesDir, 'he.json'),
    en: path.join(localesDir, 'en.json'),
    es: path.join(localesDir, 'es.json'),
};

const additions = {
    dashboard: {
        general: { he: "שגיאה כללית", en: "General Error", es: "Error General" }
    },
    eventPage: {
        assignment: {
            addMoreSuccess: { he: "הוסף בהצלחה", en: "Added successfully", es: "Añadido con éxito" },
            addMoreTitle: { he: "הוסף עוד פריטים", en: "Add More Items", es: "Añadir Más Artículos" },
            quantityToAdd: { he: "כמות להוספה", en: "Quantity to Add", es: "Cantidad a Añadir" },
            add: { he: "הוסף", en: "Add", es: "Añadir" }
        }
    }
};

const statsFix = {
    he: { required: "חובה", optional: "רשות", requiredTooltip: "פריטי חובה", optionalTooltip: "פריטי רשות" },
    en: { required: "Required", optional: "Optional", requiredTooltip: "Required Items", optionalTooltip: "Optional Items" },
    es: { required: "Obligatorio", optional: "Opcional", requiredTooltip: "Artículos Obligatorios", optionalTooltip: "Artículos Opcionales" }
};

['he', 'en', 'es'].forEach(lang => {
    try {
        const filePath = files[lang];
        let data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

        // Fix eventPage.stats.required / optional
        if (data.translation && data.translation.eventPage && data.translation.eventPage.stats) {
            const stats = data.translation.eventPage.stats;

            // Fix Required
            if (typeof stats.required === 'string') {
                stats.required = {
                    text: stats.required,
                    tooltip: statsFix[lang].requiredTooltip
                };
            } else if (typeof stats.required === 'object') {
                // If corrupted (numbered keys) or just object
                // If it has '0', '1' keys it's corrupted from string merge
                if ('0' in stats.required) {
                    stats.required = {
                        text: statsFix[lang].required,
                        tooltip: statsFix[lang].requiredTooltip
                    };
                } else {
                    // Assume it's okay or partial, ensure text exists
                    if (!stats.required.text) stats.required.text = statsFix[lang].required;
                    if (!stats.required.tooltip) stats.required.tooltip = statsFix[lang].requiredTooltip;
                }
            }

            // Fix Optional
            if (typeof stats.optional === 'string') {
                stats.optional = {
                    text: stats.optional,
                    tooltip: statsFix[lang].optionalTooltip
                };
            } else if (typeof stats.optional === 'object') {
                if ('0' in stats.optional) {
                    stats.optional = {
                        text: statsFix[lang].optional,
                        tooltip: statsFix[lang].optionalTooltip
                    };
                } else {
                    if (!stats.optional.text) stats.optional.text = statsFix[lang].optional;
                    if (!stats.optional.tooltip) stats.optional.tooltip = statsFix[lang].optionalTooltip;
                }
            }
        }

        // Add remaining keys
        // Dashboard
        if (!data.translation.dashboard) data.translation.dashboard = {};
        data.translation.dashboard.general = additions.dashboard.general[lang];

        // Assignment
        if (!data.translation.eventPage) data.translation.eventPage = {};
        if (!data.translation.eventPage.assignment) data.translation.eventPage.assignment = {};

        Object.keys(additions.eventPage.assignment).forEach(key => {
            data.translation.eventPage.assignment[key] = additions.eventPage.assignment[key][lang];
        });

        fs.writeFileSync(filePath, JSON.stringify(data, null, 4), 'utf8');
        console.log(`Fixed ${lang}.json`);

    } catch (e) {
        console.error(`Error fixing ${lang}:`, e);
    }
});

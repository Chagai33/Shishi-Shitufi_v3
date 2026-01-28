const fs = require('fs');
const path = require('path');

const srcDir = 'c:\\Shishi-Shitufi_newV3V3\\src';
const localesDir = path.join(srcDir, 'locales');

const files = {
    he: path.join(localesDir, 'he.json'),
    en: path.join(localesDir, 'en.json'),
    es: path.join(localesDir, 'es.json'),
};

const missingTranslations = {
    bulkEdit: {
        filters: {
            allOf: { he: "הכל מתוך הרשימה", en: "All of the list", es: "Todo de la lista" },
            assigned: { he: "שובצו", en: "Assigned", es: "Asignado" },
            unassigned: { he: "לא שובצו", en: "Unassigned", es: "No asignado" },
            allEvents: { he: "כל האירועים", en: "All Events", es: "Todos los eventos" },
            search: { he: "חיפוש", en: "Search", es: "Buscar" },
            event: { he: "אירוע", en: "Event", es: "Evento" },
            category: { he: "קטגוריה", en: "Category", es: "Categoría" },
            all: { he: "הכל", en: "All", es: "Todo" },
            assignment: { he: "שיבוץ", en: "Assignment", es: "Asignación" },
            createdBy: { he: "נוצר ע\"י", en: "Created By", es: "Creado Por" },
            admin: { he: "מנהל", en: "Admin", es: "Admin" },
            users: { he: "משתמשים", en: "Users", es: "Usuarios" }
        },
        messages: {
            itemUpdated: { he: "הפריט עודכן בהצלחה", en: "Item updated successfully", es: "Artículo actualizado con éxito" },
            errorUpdating: { he: "שגיאה בעדכון הפריט", en: "Error updating item", es: "Error al actualizar el artículo" },
            errorGeneral: { he: "אירעה שגיאה כללית", en: "General error occurred", es: "Ocurrió un error general" },
            selectAction: { he: "בחר פעולה מהרשימה", en: "Select an action", es: "Seleccione una acción" },
            noAssignedToCancel: { he: "אין שיבוצים לביטול בפריטים שנבחרו", en: "No assignments to cancel in selected items", es: "No hay asignaciones para cancelar en los artículos seleccionados" },
            error: { he: "שגיאה", en: "Error", es: "Error" },
            enterItemName: { he: "נא להזין שם פריט", en: "Please enter item name", es: "Por favor ingrese el nombre del artículo" },
            selectEvent: { he: "בחר אירוע", en: "Select Event", es: "Seleccionar Evento" },
            itemAdded: { he: "הפריט נוסף בהצלחה", en: "Item added successfully", es: "Artículo añadido con éxito" },
            errorAdding: { he: "שגיאה בהוספת הפריט", en: "Error adding item", es: "Error al añadir artículo" },
            selectToSave: { he: "בחר פריטים לשמירה", en: "Select items to save", es: "Seleccione artículos para guardar" },
            enterListNameError: { he: "שגיאה: נא להזין שם לרשימה", en: "Error: Please enter list name", es: "Error: Por favor ingrese el nombre de la lista" },
            errorSavingList: { he: "שגיאה בשמירת הרשימה", en: "Error saving list", es: "Error al guardar la lista" }
        },
        actions: {
            cancelAssignments: { he: "בטל שיבוצים", en: "Cancel Assignments", es: "Cancelar Asignaciones" },
            changeCategory: { he: "שנה קטגוריה", en: "Change Category", es: "Cambiar Categoría" },
            changeRequired: { he: "שנה סטטוס חובה", en: "Change Required Status", es: "Cambiar Estado Obligatorio" },
            delete: { he: "מחק פריטים", en: "Delete Items", es: "Eliminar Artículos" },
            saveAsList: { he: "שמור כרשימה", en: "Save as List", es: "Guardar como Lista" },
            execute: { he: "בצע", en: "Execute", es: "Ejecutar" },
            cancel: { he: "ביטול", en: "Cancel", es: "Cancelar" }
        },
        saveAll: { he: "שמור הכל", en: "Save All", es: "Guardar Todo" },
        cancelEdit: { he: "בטל עריכה", en: "Cancel Edit", es: "Cancelar Edición" },
        editAll: { he: "ערוך הכל", en: "Edit All", es: "Editar Todo" },
        addItem: { he: "הוסף פריט", en: "Add Item", es: "Añadir Artículo" },
        import: { he: "ייבוא", en: "Import", es: "Importar" },
        table: {
            noItems: { he: "אין פריטים", en: "No items", es: "No hay artículos" },
            noItemsDesc: { he: "לא נמצאו פריטים לתצוגה", en: "No items found to display", es: "No se encontraron artículos para mostrar" },
            items: { he: "פריטים", en: "Items", es: "Artículos" },
            name: { he: "שם", en: "Name", es: "Nombre" },
            event: { he: "אירוע", en: "Event", es: "Evento" },
            quantity: { he: "כמות", en: "Quantity", es: "Cantidad" },
            notes: { he: "הערות", en: "Notes", es: "Notas" },
            required: { he: "חובה", en: "Required", es: "Obligatorio" },
            splittable: { he: "ניתן לפיצול", en: "Splittable", es: "Divisible" },
            assignment: { he: "שיבוץ", en: "Assignment", es: "Asignación" }
        }
    },
    items: {
        tables: { he: "שולחנות", en: "Tables", es: "Mesas" },
        chairs: { he: "כיסאות", en: "Chairs", es: "Sillas" },
        tablecloths: { he: "מפות", en: "Tablecloths", es: "Manteles" },
        plates: { he: "צלחות", en: "Plates", es: "Platos" },
        cups: { he: "כוסות", en: "Cups", es: "Vasos" },
        cutlery: { he: "סכו\"ם", en: "Cutlery", es: "Cubiertos" },
        trays: { he: "מגשים", en: "Trays", es: "Bandejas" },
        waterPitchers: { he: "קנקני מים", en: "Water Pitchers", es: "Jarras de agua" },
        napkins: { he: "מפיות", en: "Napkins", es: "Servilletas" },
        challah: { he: "חלה", en: "Challah", es: "Jalá" },
        redWine: { he: "יין אדום", en: "Red Wine", es: "Vino Tinto" },
        whiteWine: { he: "יין לבן", en: "White Wine", es: "Vino Blanco" },
        greenSalad: { he: "סלט ירוק", en: "Green Salad", es: "Ensalada Verde" },
        hummus: { he: "חומוס", en: "Hummus", es: "Hummus" },
        tahini: { he: "טחינה", en: "Tahini", es: "Tahini" },
        pitas: { he: "פיתות", en: "Pitas", es: "Pitas" },
        cheeses: { he: "גבינות", en: "Cheeses", es: "Quesos" },
        fruit: { he: "פירות", en: "Fruit", es: "Frutas" },
        cake: { he: "עוגה", en: "Cake", es: "Pastel" },
        juice: { he: "מיץ", en: "Juice", es: "Jugo" },
        water: { he: "מים", en: "Water", es: "Agua" }
    },
    common: {
        user: { he: "משתמש", en: "User", es: "Usuario" },
        errorOccurred: { he: "אירעה שגיאה", en: "An error occurred", es: "Ocurrió un error" },
        saving: { he: "שומר...", en: "Saving...", es: "Guardando..." },
        saveChanges: { he: "שמור שינויים", en: "Save Changes", es: "Guardar Cambios" },
        backToHome: { he: "חזרה לדף הבית", en: "Back to Home", es: "Volver al Inicio" },
        clearSearch: { he: "נקה חיפוש", en: "Clear Search", es: "Borrar Búsqueda" },
        errors: {
            general: { he: "שגיאה כללית", en: "General error", es: "Error general" }
        }
    },
    eventPage: {
        assignment: {
            nameRequired: { he: "שם הוא חובה", en: "Name is required", es: "El nombre es obligatorio" },
            quantityPositive: { he: "הכמות חייבת להיות חיובית", en: "Quantity must be positive", es: "La cantidad debe ser positiva" },
            updateSuccess: { he: "עודכן בהצלחה", en: "Updated successfully", es: "Actualizado con éxito" },
            newNamePlaceholder: { he: "שם חדש", en: "New Name", es: "Nuevo Nombre" },
            quantityToBring: { he: "כמות להביא", en: "Quantity to bring", es: "Cantidad a traer" },
            confirmAssignment: { he: "אשר שיבוץ", en: "Confirm Assignment", es: "Confirmar Asignación" }
        },
        adminPanelTooltip: { he: "פאנל ניהול", en: "Admin Panel", es: "Panel de Admin" },
        adminPanel: { he: "פאנל ניהול", en: "Admin Panel", es: "Panel de Admin" },
        stats: {
            required: { tooltip: { he: "פריטי חובה", en: "Required Items", es: "Artículos Obligatorios" } },
            optional: { tooltip: { he: "פריטי רשות", en: "Optional Items", es: "Artículos Opcionales" } }
        },
        searchPlaceholder: { he: "חפש...", en: "Search...", es: "Buscar..." },
        backToCategories: { he: "חזרה לקטגוריות", en: "Back to Categories", es: "Volver a Categorías" },
        list: {
            searchResults: { he: "תוצאות חיפוש", en: "Search Results", es: "Resultados de Búsqueda" },
            noItems: { he: "אין פריטים", en: "No items", es: "No hay artículos" }
        },
        category: {
            addItemTooltip: { he: "הוסף פריט לקטגוריה זו", en: "Add item to this category", es: "Añadir artículo a esta categoría" },
            addItem: { he: "הוסף פריט", en: "Add Item", es: "Añadir Artículo" }
        },
        promo: {
            register: { he: "הירשם", en: "Register", es: "Registrarse" }
        }
    },
    importModal: {
        preview: {
            table: {
                yes: { he: "כן", en: "Yes", es: "Sí" },
                no: { he: "לא", en: "No", es: "No" }
            }
        },
        methods: {
            desc: { he: "בחר שיטת ייבוא", en: "Select import method", es: "Seleccione método de importación" }
        }
    },
    errors: {
        auth: {
            userNotFound: { he: "משתמש לא נמצא", en: "User not found", es: "Usuario no encontrado" },
            wrongPassword: { he: "סיסמה שגויה", en: "Wrong password", es: "Contraseña incorrecta" },
            emailInUse: { he: "האימייל כבר בשימוש", en: "Email already in use", es: "El correo ya está en uso" },
            tooManyRequests: { he: "יותר מדי בקשות, נסה שוב מאוחר יותר", en: "Too many requests, try again later", es: "Demasiadas solicitudes, intente más tarde" },
            permissionDenied: { he: "אין הרשאה", en: "Permission denied", es: "Permiso denegado" }
        }
    }
};

function deepMerge(target, source) {
    for (const key of Object.keys(source)) {
        if (source[key] instanceof Object && !Array.isArray(source[key]) && key in target) {
            Object.assign(source[key], deepMerge(target[key], source[key]));
        }
    }
    Object.assign(target || {}, source);
    return target;
}

function extractLang(source, lang) {
    const result = {};
    for (const key in source) {
        if (key === lang && typeof source[key] === 'string') {
            return source[key];
        }
        if (typeof source[key] === 'object' && source[key] !== null) {
            if (source[key][lang]) {
                result[key] = source[key][lang];
            } else {
                const nested = extractLang(source[key], lang);
                if (Object.keys(nested).length > 0) {
                    result[key] = nested;
                }
            }
        }
    }
    return result;
}


['he', 'en', 'es'].forEach(lang => {
    try {
        console.log(`Processing ${lang}...`);
        const filePath = files[lang];
        const currentData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const newTranslations = extractLang(missingTranslations, lang);

        // Merge into currentData.translation
        deepMerge(currentData.translation, newTranslations);

        fs.writeFileSync(filePath, JSON.stringify(currentData, null, 4), 'utf8');
        console.log(`Updated ${lang}.json`);
    } catch (e) {
        console.error(`Error processing ${lang}:`, e);
    }
});

console.log('Done updating locales.');

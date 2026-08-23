# 04 — שדרוג firebase-functions SDK

> 🟠 **בינוני.** Firebase מזהיר במפורש על שינויים שוברים.

## המצב

`functions/package.json`:

```json
"firebase-functions": "^4.0.1",
"firebase-admin": "^11.0.1"
```

בפועל מותקן `firebase-functions@4.9.0`. Firebase מודיע בכל פריסה:

> package.json indicates an outdated version of firebase-functions. Please upgrade using `npm install --save firebase-functions@latest`.
> **Please note that there will be breaking changes when you upgrade.**

> You are using a version of firebase-functions SDK (4.9.0) that does not have support for the newest Firebase Extensions features. Please update to >=5.1.0.

## הסיבוך האמיתי — הקוד מערבב v1 ו-v2

זו הנקודה שהופכת את השדרוג הזה למסובך יותר משדרוג רגיל.

| קובץ | API | קוד |
|---|---|---|
| `functions/index.js` | **v1** | `functions.https.onCall(...)`, `functions.auth.user().onDelete(...)` |
| `functions/smartImport.js` | **v2** | `require("firebase-functions/v2/https")`, `onCall(...)` |

`onUserDeleted` משתמש ב-`functions.auth.user().onDelete()` — טריגר Auth בסגנון v1. **זו הנקודה הרגישה ביותר בשדרוג.** יש לבדוק מה מצב הטריגר הזה בגרסה שאליה משדרגים לפני שנוגעים.

בנוסף, שתי הפונקציות ב-`index.js` פרוסות כ-**1st Gen** ו-`parseShoppingList` כ-**2nd Gen** (נראה בבירור בפלט הפריסה). ערבוב דורות עובד, אבל מוסיף שכבת מורכבות לשדרוג.

## ⚠️ תנאי מקדים

**לבצע רק אחרי [01-node-runtime.md](01-node-runtime.md).**

שדרוג runtime ושדרוג SDK בו-זמנית = אם משהו נשבר, אין דרך לדעת מה אשם. Node קודם, לוודא שהכל עובד, ורק אז SDK.

## מה לעשות

### שלב 1 — מחקר לפני נגיעה

לפני כל שינוי קוד, לקרוא את מדריך המיגרציה הרשמי של Firebase לגרסה הרלוונטית, ולברר ספציפית:

- מה קרה ל-`functions.auth.user().onDelete()` — האם עדיין נתמך? מה התחליף?
- האם `functions.https.onCall` בסגנון v1 עדיין עובד?
- אילו שינויים שוברים נוספים רלוונטיים לקוד הקיים?

**לא לשדרג לפני שיש תשובות לשלוש השאלות האלה.**

### שלב 2 — שדרוג

```bash
cd functions
npm install --save firebase-functions@latest firebase-admin@latest
```

### שלב 3 — התאמת הקוד

לפי מה שהתגלה בשלב 1. סביר שיידרש להמיר את `index.js` ל-v2.

### שלב 4 — בדיקה מקומית

```bash
firebase emulators:start --only functions
```

### שלב 5 — פריסה

```powershell
$env:FUNCTIONS_DISCOVERY_TIMEOUT=60; firebase deploy --only functions
```

## בדיקות אחרי פריסה

- [ ] `parseShoppingList` — ייבוא חכם עם טקסט
- [ ] `parseShoppingList` — ייבוא חכם עם תמונה
- [ ] `deleteUserAccount` — עם חשבון בדיקה בלבד
- [ ] `onUserDeleted` — **הכי חשוב לבדוק, והכי מסוכן.** ראה אזהרה למטה
- [ ] `firebase functions:log` נקי

## ⚠️ אזהרה חמורה על בדיקת onUserDeleted

הפונקציה הזו:
- מוחקת את כל האירועים שהמשתמש ארגן
- מוחקת את כל הפריטים שהמשתמש יצר
- מוחקת בשרשור את כל השיבוצים על הפריטים האלה

**הכל בלתי הפיך.**

אם השדרוג ישבור את הטריגר בשקט, התסמין יהיה נתונים יתומים שמצטברים בלי שאף אחד ישים לב — כי שום דבר לא קורס, פשוט הניקוי מפסיק לרוץ. שווה לבדוק אקטיבית ולא להניח.

לבדוק **אך ורק** עם חשבון בדיקה ייעודי, באירוע בדיקה, שאין בו שום נתון אמיתי.

## תועלת צפויה

- רוב הפגיעויות ב-[03](03-dependencies.md) ייעלמו
- תמיכה בפיצ'רים חדשים של Firebase
- יציאה ממצב של גרסה שלא מקבלת עדכוני אבטחה

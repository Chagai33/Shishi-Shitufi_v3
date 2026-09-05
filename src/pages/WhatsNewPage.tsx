// src/pages/WhatsNewPage.tsx

import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

// The page that tells people what the product does.
//
// It was a list of defects and their repairs until 05/09/2026. The product
// owner decided that is not what this page is for: a person opening it wants
// to know what they can do, not what used to be broken. It now reads as a
// capability page, and nothing on it names a bug.
//
// Three rules for whoever updates this page next:
//   1. The link to it lives in the footer and nowhere else.
//   2. Hebrew and English only. The Spanish file is not touched.
//   3. The address stays /updates even if the wording on screen changes.
// See DOCS/PLANING/61-whats-new-page.md.
//
// And one rule that matters more than the three:
//   EVERY CLAIM ON THIS PAGE IS REACHABLE BY A REAL USER TODAY. The features
//   here were mapped against the code before they were written down, and a
//   number of things that exist in the codebase were deliberately left off
//   because no live screen reaches them: Spanish, event duplication, sharing
//   from inside the event page, the participants list for anyone who is not
//   the organiser, and the host name field on the event form. Do not add a
//   capability here from a component you found. Add it once you have opened
//   the product and used it.
//
// Two rendering details that are not decoration:
//   - Every section heading carries its own classes. The stylesheet also
//     defines .prose h3, at the same values as the const below, so the two
//     agree and this page renders the same either way. Keep them in step: an
//     element selector in the stylesheet beats a utility class written here,
//     so if the two ever disagree the stylesheet is what shows.
//   - Each language block declares its own dir. Without it both halves inherit
//     the interface language's direction, and one of them is always laid out
//     backwards. See DOCS/PLANING/62-legal-pages-headings-and-direction.md.

const sectionHeading = 'text-lg font-semibold text-neutral-800 mt-6 mb-2';

const WhatsNewPage: React.FC = () => (
  <div className="legal-page-container">
    <div className="max-w-4xl mx-auto">
      <Link
        to="/"
        className="inline-flex items-center text-sm font-medium text-primary hover:text-primary/80 transition-colors mb-6"
      >
        <ArrowRight size={16} className="ml-1" />
        חזור לדף הבית
      </Link>

      <div lang="he" dir="rtl">
        <h1 className="text-3xl font-bold mb-4">מה חדש</h1>

        <div className="prose">
          <h2>ספטמבר 2026</h2>

          <p>
            שישי שיתופי מארגן ארוחה שיתופית מהרגע שהחלטתם לעשות אותה ועד השאלה מי מביא את הלחם.
            הנה מה שהוא יודע לעשות היום.
          </p>

          <h3 className={sectionHeading}>האירוע מתחיל מתבנית, וממשיך כרצונכם</h3>

          <p>
            <strong>שמונה תבניות מוכנות:</strong>{' '}
            ארוחת שישי, על האש, פיקניק, מסיבת כיתה, מסיבה, ארוחה חלבית, טיול, ואירוע בלי קטגוריות בכלל.
            כל תבנית מגיעה עם חלוקה לקטגוריות שמתאימה לסוג האירוע.
          </p>

          <p>
            <strong>ואחרי שבחרתם, הרשימה שלכם.</strong>{' '}
            אפשר להוסיף קטגוריה, לשנות שם, לבחור אייקון מתוך עשרים ואחד, לסדר מחדש ולמחוק.
            את הרשימה שבניתם אפשר לשמור כתבנית אישית ולהשתמש בה באירוע הבא.
          </p>

          <h3 className={sectionHeading}>אתם מחליטים מה המשתתפים יכולים לעשות</h3>

          <p>
            שלושה מתגים נפרדים לכל אירוע:{' '}
            <strong>האם משתתף רשאי להוסיף פריט משלו</strong> וכמה פריטים,{' '}
            <strong>האם אפשר להציע טרמפ</strong>, ו<strong>האם אפשר לבקש טרמפ</strong>.
            שלושתם עצמאיים, וכיבוי של אחד אינו נוגע באחרים.
          </p>

          <p>
            את האירוע עצמו אפשר לסמן פעיל או לא פעיל בכל רגע, וזה מה שפותח וסוגר את ההרשמות.
          </p>

          <h3 className={sectionHeading}>הרשימה נכנסת בלי שתקלידו אותה</h3>

          <p>
            <strong>הייבוא החכם קורא רשימה בכל צורה שיש לכם אותה:</strong>{' '}
            מוקלדת, מוכתבת בקול, מודבקת מהודעה, או מצולמת.
            הוא מוציא ממנה שמות פריטים וכמויות, ומסווג אותם לקטגוריות של האירוע שלכם ולא לרשימה גנרית.
          </p>

          <p>
            <strong>ואפשר גם מקובץ.</strong>{' '}
            אקסל או CSV, עם דוח שאומר מה נקרא ומה לא.
            ורשימה מוכנה ששמרתם בעבר נטענת מאותו חלון.
          </p>

          <p>
            <strong>בכל אחת מהדרכים, שום דבר לא נשמר לפני שראיתם אותו.</strong>{' '}
            מסך התצוגה המקדימה נותן לערוך שם, כמות, קטגוריה והערה, ולהוריד פריטים שלא רציתם.
            הוא גם מזהה כפילויות מול מה שכבר קיים באירוע, ואומר לכם אם חרגתם מהמכסה.
          </p>

          <p>
            <strong>ואם שיניתם את הקטגוריות של אירוע שכבר רץ</strong>, ההגירה החכמה מסדרת מחדש את מה
            שכבר בפנים. השיבוצים נשמרים, וכל פריט שהיא לא זיהתה נשאר במקומו במקום להיעלם.
          </p>

          <h3 className={sectionHeading}>ניהול הרשימה בכמות</h3>

          <p>
            מסך אחד עם כל הפריטים של האירוע, חיפוש וארבעה מסננים.
            מסמנים כמה פריטים ומבצעים פעולה אחת על כולם:{' '}
            <strong>מחיקה, העברה לקטגוריה אחרת, סימון כפריט נדרש, או ביטול שיבוצים</strong>.
          </p>

          <p>
            לכל פריט יש כמות, אפשרות לחלק אותה בין כמה אנשים, סימון אם הוא חובה, והערה.
          </p>

          <h3 className={sectionHeading}>המשתתפים נכנסים מקישור, בלי חשבון ובלי הורדה</h3>

          <p>
            <strong>קישור, שם אחד, וזהו.</strong>{' '}
            אין הרשמה, אין סיסמה, ואין אפליקציה להתקין.
          </p>

          <p>
            <strong>אפשר לקחת פריט שלם או חלק ממנו</strong>, והמונה לא נותן לקחת יותר ממה שחסר.
            מי שלקח שלושה מתוך עשרה יכול להוסיף עוד אחר כך, בלי להתחיל מחדש.
            אפשר להשאיר הערה עם מה שאתם מביאים, ואפשר לערוך או לבטל בכל רגע.
          </p>

          <p>
            כל קטגוריה מציגה כמה כבר נלקח מתוך מה שצריך, ויש חיפוש לפי שם פריט.
          </p>

          <h3 className={sectionHeading}>טרמפים</h3>

          <p>
            <strong>להציע נסיעה, או לבקש אחת.</strong>{' '}
            עם נקודת יציאה, מספר מקומות, שעת יציאה, וכמה גמישות יש בה.
          </p>

          <p>
            <strong>הלוך וחזור נכתב כשני כיוונים ומוצג ככרטיס אחד.</strong>{' '}
            אפשר להצטרף לשניהם בפעולה אחת, ולבטל כיוון אחד או את שניהם מתוך שאלה שאומרת במפורש
            על מה אתם מוותרים.
          </p>

          <p>
            <strong>מספר טלפון מוצג רק בין הנהג לנוסעים שלו</strong>, עם כפתור חיוג וכפתור וואטסאפ לידו.
            שאר המשתתפים באירוע אינם רואים אותו.
          </p>

          <p>
            <strong>וטרמפים אינם נספרים במכסת הפריטים שלכם.</strong>{' '}
            יש להם מכסה משלהם, ומי שפרסם כמה נסיעות עדיין יכול להביא אוכל.
          </p>

          <p>
            <strong>למארגן יש מסך של נהגים ונוסעים:</strong>{' '}
            מי נוסע עם מי, כמה מקומות נשארו פנויים, ומי ביקש טרמפ ועדיין אין לו.
          </p>

          <h3 className={sectionHeading}>הלוח של המארגן</h3>

          <p>
            האירועים מחולקים לפעילים ולשעברו, עם מונה לכל צד.
            כל כרטיס מראה כמה מהפריטים כבר נלקחו, כמה משתתפים יש, ומתריע אם פריט נפל מחוץ
            לקטגוריות של האירוע. את הקישור הציבורי מעתיקים משם בלחיצה.
          </p>

          <h3 className={sectionHeading}>החשבון והמידע שלכם</h3>

          <p>
            <strong>ההרשמה שולחת מייל שמאמת את הכתובת</strong>, ויש "שכחתי סיסמה" שמחזיר אתכם לחשבון.
            מיילים נשלחים בשפה שבה המסך שלכם מוצג.
          </p>

          <p>
            <strong>מחיקת חשבון נוקבת בכתובת שעומדת להימחק ומבקשת מכם להקליד אותה</strong>, כדי שלא
            תמחקו את החשבון הלא נכון. היא מוחקת את האירועים שיצרתם ואת כל מה שלקחתם על עצמכם
            אצל אחרים.
          </p>

          <p>
            <strong>ומי שהצטרף בלי חשבון אינו נשאר בלי שליטה:</strong>{' '}
            באותה כותרת תחתונה יש לו כפתור למחיקת המידע שלו, וגם מסלול להסרה מאירוע יחיד.
          </p>

          <h3 className={sectionHeading}>עברית ואנגלית</h3>

          <p>
            כפתור הגלובוס מחליף את שפת הממשק, והעמוד מתהפך לכיוון הנכון יחד איתה.
          </p>

          <p>
            <strong>תנאי השימוש ומדיניות הפרטיות מתפרסמים בשתי השפות</strong>, כל אחת בכיוון שלה,
            ומקושרים מהכותרת התחתונה של כל עמוד.
          </p>
        </div>
      </div>

      <hr className="my-10" />

      <div lang="en" dir="ltr">
        <h1 className="text-3xl font-bold mb-4">What's New</h1>

        <div className="prose">
          <h2>September 2026</h2>

          <p>
            Shishi Shitufi organises a shared meal from the moment you decide to have one all the
            way down to who is bringing the bread. Here is what it can do today.
          </p>

          <h3 className={sectionHeading}>An event starts from a template and carries on your way</h3>

          <p>
            <strong>Eight ready-made templates:</strong>{' '}
            Friday dinner, barbecue, picnic, class party, party, dairy meal, trip, and an event with
            no categories at all. Each one arrives with a breakdown of categories that suits that
            kind of gathering.
          </p>

          <p>
            <strong>And once you have picked one, the list is yours.</strong>{' '}
            Add a category, rename it, choose an icon out of twenty one, reorder, delete. The list
            you build can be saved as a personal template and used again for the next event.
          </p>

          <h3 className={sectionHeading}>You decide what participants are allowed to do</h3>

          <p>
            Three separate switches per event:{' '}
            <strong>whether a participant may add an item of their own</strong> and how many,{' '}
            <strong>whether rides may be offered</strong>, and{' '}
            <strong>whether rides may be requested</strong>. All three are independent, and turning
            one off does not touch the others.
          </p>

          <p>
            The event itself can be marked active or inactive at any moment, and that is what opens
            and closes sign-ups.
          </p>

          <h3 className={sectionHeading}>The list gets in without you typing it</h3>

          <p>
            <strong>Smart import reads a list in whatever form you happen to have it:</strong>{' '}
            typed, dictated out loud, pasted from a message, or photographed. It pulls out item
            names and quantities, and sorts them into your event's own categories rather than into
            some generic list.
          </p>

          <p>
            <strong>Or from a file.</strong>{' '}
            Excel or CSV, with a report telling you what was read and what was not. A preset list
            you saved earlier loads from the same window.
          </p>

          <p>
            <strong>Whichever route you take, nothing is saved before you have seen it.</strong>{' '}
            The preview screen lets you edit a name, a quantity, a category and a note, and drop
            anything you did not want. It also spots duplicates against what is already in the
            event, and tells you if you have gone over your allowance.
          </p>

          <p>
            <strong>And if you change the categories of an event that is already running</strong>,
            the smart migration re-sorts what is already inside. Sign-ups are kept, and any item it
            did not recognise stays where it was instead of disappearing.
          </p>

          <h3 className={sectionHeading}>Managing the list in bulk</h3>

          <p>
            One screen with every item in the event, a search box and four filters. Select several
            items and perform a single action on all of them:{' '}
            <strong>delete, move to another category, mark as required, or cancel assignments</strong>.
          </p>

          <p>
            Every item carries a quantity, the option to split it between several people, a flag for
            whether it is required, and a note.
          </p>

          <h3 className={sectionHeading}>Participants arrive from a link, with no account and no download</h3>

          <p>
            <strong>A link, one name, and that is it.</strong>{' '}
            No sign-up, no password, and no app to install.
          </p>

          <p>
            <strong>You can take on a whole item or part of one</strong>, and the counter will not
            let you take more than is still missing. Somebody who took three out of ten can add more
            later without starting over. You can leave a note with what you are bringing, and edit
            or cancel at any time.
          </p>

          <p>
            Every category shows how much of what is needed has already been claimed, and there is a
            search box for finding an item by name.
          </p>

          <h3 className={sectionHeading}>Rides</h3>

          <p>
            <strong>Offer a lift, or ask for one.</strong>{' '}
            With a departure point, a number of seats, a departure time, and how flexible that time
            is.
          </p>

          <p>
            <strong>A return trip is written as two directions and drawn as one card.</strong>{' '}
            You can join both in a single action, and cancel one direction or both from a question
            that says explicitly what you are giving up.
          </p>

          <p>
            <strong>A phone number is shown only between a driver and their own passengers</strong>,
            with a call button and a WhatsApp button beside it. Nobody else at the event sees it.
          </p>

          <p>
            <strong>And rides do not count against your item allowance.</strong>{' '}
            They have an allowance of their own, so somebody who posted a few journeys can still
            bring food.
          </p>

          <p>
            <strong>The organiser gets a drivers and passengers view:</strong>{' '}
            who is travelling with whom, how many seats are left, and who asked for a ride and still
            does not have one.
          </p>

          <h3 className={sectionHeading}>The organiser's board</h3>

          <p>
            Events are split into active and past, each side with its own counter. Every card shows
            how many items have been claimed, how many participants there are, and warns you if an
            item has fallen outside the event's categories. The public link is copied from there in
            one press.
          </p>

          <h3 className={sectionHeading}>Your account and your information</h3>

          <p>
            <strong>Signing up sends a mail that confirms your address</strong>, and there is a
            "forgot my password" route that gets you back into your account. Mail is sent in the
            language your screen is in.
          </p>

          <p>
            <strong>Deleting an account names the exact address about to go and asks you to type
            it</strong>, so that you do not delete the wrong one. It removes the events you created
            and everything you took on in other people's events.
          </p>

          <p>
            <strong>And somebody who joined without an account is not left without control:</strong>{' '}
            the same footer gives them a button to delete their information, alongside a route for
            removing themselves from a single event.
          </p>

          <h3 className={sectionHeading}>Hebrew and English</h3>

          <p>
            The globe button switches the interface language, and the page turns around to the right
            direction along with it.
          </p>

          <p>
            <strong>The Terms of Use and the Privacy Policy are published in both languages</strong>,
            each in its own direction, and are linked from the footer of every page.
          </p>
        </div>
      </div>
    </div>
  </div>
);

export default WhatsNewPage;

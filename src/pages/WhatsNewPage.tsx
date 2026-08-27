// src/pages/WhatsNewPage.tsx

import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

// The page that tells people what changed in the product.
//
// The text on this page is not the developer's to edit. It is written and
// decided by the product owner in DOCS/PLANING/CHANGELOG-USERS.md, and it is
// copied here word for word: nothing added, nothing removed, nothing reworded.
// The security section is deliberately general, by the owner's decision, and
// must not be given detail.
//
// Three rules for whoever updates this page next:
//   1. The link to it lives in the footer and nowhere else.
//   2. Hebrew and English only. The Spanish file is not touched.
//   3. The address stays /updates even if the wording on screen changes.
// See DOCS/PLANING/61-whats-new-page.md.
//
// Two rendering details that are not decoration:
//   - Every section heading carries its own classes. The stylesheet defines
//     .prose h1 and .prose h2 only, and an element selector there beats a
//     utility class, so an h3 with no rule of its own renders exactly like a
//     paragraph and the six sections would vanish into one wall of text.
//   - Each language block declares its own dir. Without it both halves inherit
//     the interface language's direction, and one of them is always laid out
//     backwards. The legal pages carry that defect today.
//     See DOCS/PLANING/62-legal-pages-headings-and-direction.md.

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
        <h1 className="text-3xl font-bold mb-4">מה השתנה</h1>

        <div className="prose">
          <h2>עדכון אוגוסט 2026</h2>

          <p>הפעם הזו הייתה בעיקר תיקונים. חלק מהדברים למטה פשוט לא עבדו, וחלקם עבדו בדרך שהטעתה אתכם.</p>

          <h3 className={sectionHeading}>דברים שלא עבדו, ועכשיו עובדים</h3>

          <p>
            <strong>הוספת פריט משלכם לאירוע.</strong>{' '}
            משתתף שניסה להוסיף משהו שהוא מביא קיבל שגיאה, גם באירועים שבהם המארגן אישר את זה במפורש. זה תוקן.
          </p>

          <p>
            <strong>הצעת טרמפ באירוע שבו הוספת פריטים כבויה.</strong>{' '}
            שתי ההגדרות האלה נפרדות בטופס האירוע, אבל בפועל כיבוי אחת חסם גם את השנייה. עכשיו הן באמת נפרדות.
          </p>

          <p>
            <strong>טרמפים כבר לא נחשבים במכסת הפריטים שלכם.</strong>{' '}
            מי שפרסם כמה נסיעות גילה פתאום שהוא לא יכול להביא אוכל. זה לא היה אמור לקרות, וזה תוקן.
          </p>

          <p>
            <strong>מי שיצר פריט יכול עכשיו למחוק אותו.</strong>{' '}
            קודם אפשר היה לערוך אבל לא למחוק.
          </p>

          <p>
            <strong>"שכחתי סיסמה" קיים עכשיו.</strong>{' '}
            עד היום מי ששכח את הסיסמה שלו פשוט לא יכול היה לחזור לחשבון.
          </p>

          <h3 className={sectionHeading}>הסיווג האוטומטי של פריטים</h3>

          <p>
            <strong>הכפתור שמסווג פריטים לקטגוריות הפסיק להזרים הכל ל"אחר".</strong>{' '}
            מי שהשתמש בהגירה חכמה כדי לסדר מחדש את הקטגוריות של אירוע גילה שכל הפריטים נוחתים בקטגוריה אחת, וכל העבודה הידנית חזרה אליו.
          </p>

          <p>
            <strong>ובנוסף, ההגירה החכמה כבר לא מוחקת פריטים.</strong>{' '}
            אם הסיווג האוטומטי פספס פריט, הוא נשאר באירוע עם הקטגוריה שהייתה לו.{' '}
            <strong>ומסך התצוגה המקדימה אומר לכם מראש מה לא סווג</strong>, לפני שאתם מאשרים.
          </p>

          <h3 className={sectionHeading}>רשימת המשתתפים</h3>

          <p>
            <strong>משתמשים רשומים נספרים עכשיו כמשתתפים.</strong>{' '}
            אם נרשמתם למוצר עם אימייל וסיסמה ולקחתם על עצמכם להביא משהו, לא הופעתם ברשימת המשתתפים של האירוע ולא נספרתם במונה שהמארגן רואה.{' '}
            <strong>מארגנים ראו מספר נמוך מהאמת.</strong>
          </p>

          <h3 className={sectionHeading}>המידע שלכם, והשליטה עליו</h3>

          <p>
            <strong>מי שנכנס לאירוע דרך קישור בלי להירשם יכול עכשיו לבקש שהמידע שלו יימחק.</strong>{' '}
            עד היום האפשרות הזו הוצגה רק למשתמשים רשומים, ודווקא מי שלא נרשם הוא זה שהשם שלו נשאר.
          </p>

          <p>
            <strong>מחיקת חשבון מוחקת עכשיו את הכל.</strong>{' '}
            היו מקרים שבהם חלק מהמידע נשאר במסד אחרי מחיקה, בלי שאיש ידע.{' '}
            <strong>וחלון האישור אומר עכשיו במפורש איזה חשבון עומד להימחק ומבקש מכם להקליד את הכתובת</strong>, כדי שלא תמחקו את החשבון הלא נכון.
          </p>

          <p>
            <strong>והרשמה שולחת עכשיו מייל שמאשר שהכתובת שלכם.</strong>
          </p>

          <h3 className={sectionHeading}>הודעות שאומרות מה קרה</h3>

          <p>
            כמה הודעות שגיאה במוצר הפנו את המשתמש להגדרות של כלי פיתוח, וזה לא עזר לאיש.{' '}
            <strong>ההודעות נוסחו מחדש כך שיאמרו מה קרה ומה אפשר לעשות.</strong>{' '}
            גם ניסוחי הכמויות תוקנו לעברית תקינה.
          </p>

          <h3 className={sectionHeading}>אבטחה ופרטיות</h3>

          <p>
            <strong>נסגרו מספר פערים בהרשאות הגישה לנתונים.</strong>{' '}
            בלי לפרט, השורה התחתונה היא שהמידע באירוע נגיש עכשיו רק למי שאמור לגשת אליו, ושפעולות במוצר נבדקות בשרת ולא רק במסך.
          </p>

          <p>
            <strong>וניקינו מהמסד מידע שלא היה צריך להישמר מלכתחילה</strong>, בעיקר רשומות ריקות שנוצרו אוטומטית לכל מי שפתח קישור.
          </p>
        </div>
      </div>

      <hr className="my-10" />

      <div lang="en" dir="ltr">
        <h1 className="text-3xl font-bold mb-4">What Changed</h1>

        <div className="prose">
          <h2>August 2026 Update</h2>

          <p>This time it was mostly fixes. Some of the things below simply did not work, and some of them worked in a way that misled you.</p>

          <h3 className={sectionHeading}>Things that did not work, and now do</h3>

          <p>
            <strong>Adding an item of your own to an event.</strong>{' '}
            A participant who tried to add something they were bringing got an error, even at events where the organizer had explicitly allowed it. This is fixed.
          </p>

          <p>
            <strong>Offering a ride at an event where adding items is turned off.</strong>{' '}
            These two settings are separate in the event form, but in practice turning one off blocked the other as well. Now they really are separate.
          </p>

          <p>
            <strong>Rides no longer count toward your item quota.</strong>{' '}
            Anyone who posted a few trips suddenly found they could not bring food. That was not supposed to happen, and it is fixed.
          </p>

          <p>
            <strong>Whoever created an item can now delete it.</strong>{' '}
            Before, you could edit but not delete.
          </p>

          <p>
            <strong>"Forgot password" now exists.</strong>{' '}
            Until today, anyone who forgot their password simply could not get back into their account.
          </p>

          <h3 className={sectionHeading}>The automatic sorting of items</h3>

          <p>
            <strong>The button that sorts items into categories has stopped funneling everything into "Other".</strong>{' '}
            Anyone who used the smart migration to rearrange an event's categories found that every item landed in one category, and all the manual work came back to them.
          </p>

          <p>
            <strong>And on top of that, the smart migration no longer deletes items.</strong>{' '}
            If the automatic sorting missed an item, it stays in the event with the category it already had.{' '}
            <strong>And the preview screen tells you in advance what was not sorted</strong>, before you confirm.
          </p>

          <h3 className={sectionHeading}>The participants list</h3>

          <p>
            <strong>Registered users now count as participants.</strong>{' '}
            If you signed up to the product with an email address and a password and took it on yourself to bring something, you did not appear in the event's participants list and you were not counted in the number the organizer sees.{' '}
            <strong>Organizers saw a number lower than the truth.</strong>
          </p>

          <h3 className={sectionHeading}>Your information, and your control over it</h3>

          <p>
            <strong>Anyone who joined an event through a link without signing up can now ask for their information to be deleted.</strong>{' '}
            Until today this option was offered only to registered users, and it was precisely the person who did not sign up whose name stayed behind.
          </p>

          <p>
            <strong>Deleting an account now deletes everything.</strong>{' '}
            There were cases where part of the information stayed in the database after a deletion, with nobody knowing.{' '}
            <strong>And the confirmation window now says explicitly which account is about to be deleted and asks you to type the address</strong>, so that you do not delete the wrong account.
          </p>

          <p>
            <strong>And signing up now sends an email that confirms your address.</strong>
          </p>

          <h3 className={sectionHeading}>Messages that say what happened</h3>

          <p>
            A few error messages in the product sent the user to the settings of a developer tool, and that helped nobody.{' '}
            <strong>The messages were rewritten so that they say what happened and what you can do.</strong>{' '}
            The wording of quantities was corrected to proper Hebrew as well.
          </p>

          <h3 className={sectionHeading}>Security and privacy</h3>

          <p>
            <strong>A number of gaps in the permissions for access to the data have been closed.</strong>{' '}
            Without going into detail, the bottom line is that information in an event is now reachable only by those who are supposed to reach it, and that actions in the product are checked on the server and not only on the screen.
          </p>

          <p>
            <strong>And we cleaned out of the database information that should not have been kept in the first place</strong>, mostly empty records that were created automatically for everyone who opened a link.
          </p>
        </div>
      </div>
    </div>
  </div>
);

export default WhatsNewPage;

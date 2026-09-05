// src/pages/PrivacyPolicyPage.tsx

import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

const PrivacyPolicyPage: React.FC = () => (
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
        <h1 className="text-3xl font-bold mb-4">מדיניות פרטיות לאפליקציית "שישי שיתופי"</h1>
        <p className="text-sm text-neutral-500 mb-6">תאריך עדכון אחרון: 29 באוגוסט 2026</p>

        <div className="prose">
          <p>אנו מכבדים את פרטיות המשתמשים שלנו ("<strong>אתה</strong>", "<strong>המשתמש</strong>") ומחויבים להגן עליה. מדיניות פרטיות זו מתארת איזה מידע אישי אנו אוספים, כיצד אנו משתמשים בו, עם מי אנו חולקים אותו, ומהן זכויותיך בנוגע למידע זה.</p>

          <h2>1. איזה מידע אנו אוספים?</h2>
          <p>אנו אוספים את סוגי המידע המינימליים הבאים:</p>
          <ul>
              <li><strong>עבור מנהלי אירועים:</strong> שם להצגה, כתובת דוא"ל וסיסמה מוצפנת.</li>
              <li><strong>עבור משתתפים (אורחים):</strong> שם להצגה. בעת כניסה ראשונה, מוקצה לך מזהה אנונימי וייחודי.</li>
              <li><strong>מספר טלפון, בטרמפים בלבד:</strong> כדי לקשר בין נהגים לנוסעים באירוע, מערכת הטרמפים דורשת מספר טלפון. המספר נאסף וייחשף למשתתפים הרלוונטיים באותו אירוע ולמארגן האירוע, לשם תיאום הנסיעה. אם אינך מעוניין בחשיפת מספר הטלפון שלך, אל תציע ואל תצטרף לטרמפים. בכל שאר חלקי השירות לא נדרש מספר טלפון.</li>
              <li><strong>תוכן שנוצר על ידך:</strong> פרטי אירועים (כותרת, תאריך ומיקום), שמות פריטים, הערות, ונקודת האיסוף בטרמפ. המיקום ונקודת האיסוף הם כתובת או שם מקום שאדם מקליד בעצמו, ולא מיקום שנקרא מהמכשיר.</li>
              <li><strong>מונה השימוש בייבוא החכם:</strong> מספר הפעולות שביצעת ב"ייבוא חכם" ומועד תחילת חלון הספירה, לצורך אכיפת מגבלת שימוש הוגן. המונה אינו מכיל תוכן של רשימות.</li>
          </ul>

          <h2>2. כיצד אנו משתמשים במידע?</h2>
          <p>השימוש במידע נועד אך ורק כדי לאפשר את תפקודה התקין של האפליקציה, להציג מי מביא כל פריט, ולאפשר למנהלים לנהל את האירועים.</p>

          <h2>3. שיתוף מידע עם צדדים שלישיים</h2>
          <p>אנו לא מוכרים או משתפים את המידע האישי שלך, למעט במקרים הבאים:</p>
          <ul>
              <li><strong>משתתפי האירוע:</strong> שמך להצגה והפריטים ששובצת אליהם יהיו גלויים לשאר המשתתפים באותו אירוע.</li>
              <li><strong>Google Firebase:</strong> האפליקציה בנויה על פלטפורמת Firebase של Google, המשמשת לאימות, אחסון נתונים ואבטחה. המידע שלך נשמר בשרתים של גוגל וכפוף למדיניות הפרטיות שלהם. שירותי Firebase עשויים לאסוף מזהים טכניים (כמו כתובת IP) לצורכי תפעול ואבטחה.</li>
              <li><strong>שירותי הבינה המלאכותית של Google (Google AI Studio):</strong> כאשר נעשה שימוש ב"ייבוא חכם", הטקסט או התמונה שהוזנו נשלחים לשירות הבינה המלאכותית של Google לצורך זיהוי הפריטים. <strong>Google עשויה להשתמש בתוכן הזה כדי לשפר ולפתח את מוצריה, וגישה אנושית מטעמה לתוכן זה עשויה להתבצע.</strong> כללי השימוש בכלי, לרבות מה אין להזין אליו, מפורטים בתנאי השימוש.</li>
              <li><strong>Google Analytics:</strong> האפליקציה משתמשת בשירות Google Analytics כדי לאסוף מידע סטטיסטי על השימוש, כגון שגיאות, סוג הדפדפן ומספר הכניסות, לצורך שיפור ביצועי האפליקציה. האפליקציה אינה מבקשת הרשאת מיקום ואינה ניגשת לחיישן המיקום (GPS) של המכשיר שלך.</li>
          </ul>

          <h2>4. העברת נתונים בינלאומית</h2>
          <p>השימוש ב-Firebase כרוך בכך שהמידע שלך עשוי להיות מאוחסן בשרתים הממוקמים מחוץ לגבולות מדינת ישראל. אנו מסתמכים על כך שגוגל נוקטת באמצעי אבטחה העומדים בסטנדרטים בינלאומיים.</p>

          <h2>5. שמירת מידע ומדיניות גיבויים</h2>
          <p>אנו שומרים מידע אישי רק למשך הזמן הנחוץ למטרות שלשמן הוא נאסף.</p>
          <ul>
              <li><strong>מידע פעיל:</strong> מידע אישי של מנהל או משתתף נשמר במערכת הפעילה כל עוד החשבון או האירוע קיימים. עם קבלת בקשה למחיקת חשבון, המידע יוסר מהמערכת הפעילה באופן מיידי.</li>
              <li><strong>גיבויים:</strong> לצורכי שחזור במקרה של כשל טכני (Disaster Recovery), בסיס הנתונים מגובה אוטומטית על ידי Firebase בגיבוי יומי. הגיבויים מוחזקים ומנוהלים על ידי Google ואינם בשליטתנו. מידע שנמחק מהמערכת הפעילה עשוי להישאר בעותקי הגיבוי לתקופה מוגבלת, ואין באפשרותנו לאתר או למחוק רשומה בודדת מתוך עותק גיבוי.</li>
          </ul>

          <h2>6. פרטיות ילדים</h2>
          <p>השירות אינו מיועד לשימוש על ידי ילדים מתחת לגיל 16. איננו אוספים ביודעין מידע אישי מילדים.</p>

          <h2>7. זכויות המשתמש</h2>
          <p>
            על פי חוק הגנת הפרטיות, אתה זכאי לעיין במידע האישי שלך, לבקש לתקן אותו או לבקש את מחיקתו. 
            למימוש זכויות אלו, או בכל שאלה אחרת בנושאי פרטיות, אנא פנה אלינו באחת מהדרכים הבאות:
          </p>
          <ul>
              <li>
                  באמצעות <a href="https://docs.google.com/forms/d/1V45Zzte9AJ9okw11Dhg0750xzt8T9t8Q0mGHjwg_BUc/preview" target="_blank" rel="noopener noreferrer">טופס הפניות הייעודי שלנו</a>.
              </li>
              <li>
                  דרך כתובת המייל: <a href="mailto:Shishi.Shitufi.App@gmail.com">Shishi.Shitufi.App@gmail.com</a>.
              </li>
          </ul>

          <h2>8. שינויים במדיניות הפרטיות</h2>
          <p>אנו שומרים לעצמנו את הזכות לעדכן מדיניות זו מעת לעת.</p>

        </div>
      </div>

      <hr className="my-8" />

      <div lang="en" dir="ltr">
        <h1 className="text-3xl font-bold mb-4">Privacy Policy (English)</h1>

        <div className="prose">
            <h2>1. What Information Do We Collect?</h2>
            <p>We collect the following minimal types of information:</p>
            <ul>
                <li><strong>For Event Managers:</strong> Display name, email address, and an encrypted password.</li>
                <li><strong>For Participants (Guests):</strong> A display name. Upon first entry, you are assigned a unique anonymous identifier.</li>
                <li><strong>A Phone Number, for Rides Only:</strong> In order to connect drivers and passengers in an event, the rides system requires a phone number. The number is collected and is exposed to the relevant participants in that event and to the event organizer, for the purpose of coordinating the ride. If you do not wish to expose your phone number, do not offer or join rides. No other part of the Service asks for a phone number.</li>
                <li><strong>Content You Create:</strong> Event details (title, date, and location), item names, notes, and the ride pickup point. The location and the pickup point are an address or a place name that a person types in, not a position read from the device.</li>
                <li><strong>Smart Import Usage Counter:</strong> The number of "Smart Import" operations you performed and the time the counting window started, in order to enforce a fair use limit. The counter holds no list content.</li>
            </ul>

            <h2>2. How Do We Use the Information?</h2>
            <p>The use of the information is solely to enable the proper functioning of the Application, to show who is bringing each item, and to allow managers to manage their events.</p>

            <h2>3. Sharing Information with Third Parties</h2>
            <p>We do not sell or share your personal information, except in the following cases:</p>
            <ul>
                <li><strong>Event Participants:</strong> Your display name and the items you are assigned to will be visible to other participants in that specific event.</li>
                <li><strong>Google Firebase:</strong> The Application is built on Google's Firebase platform, which is used for authentication, data storage, and security. Your information is stored on Google's servers and is subject to their privacy policy. Firebase services may collect technical identifiers (like IP addresses) for operational and security purposes.</li>
                <li><strong>Google Artificial Intelligence Services (Google AI Studio):</strong> When the "Smart Import" is used, the text or image entered is sent to Google's artificial intelligence service in order to identify the items. <strong>Google may use that content to improve and develop its products, and human reviewers on its behalf may read it.</strong> The rules for using the tool, including what must not be entered into it, are set out in the Terms of Use.</li>
                <li><strong>Google Analytics:</strong> The Application uses the Google Analytics service to collect statistical information about usage, such as errors, browser type, and application visits, in order to improve the Application's performance. The Application does not ask for location permission and does not read your device's GPS sensor.</li>
            </ul>

            <h2>4. International Data Transfer</h2>
            <p>Using Firebase involves your information potentially being stored on servers located outside the borders of the State of Israel. We rely on Google to employ security measures that meet international standards.</p>

            <h2>5. Data Retention and Backup Policy</h2>
            <p>We retain personal information only for the necessary duration.</p>
             <ul>
                <li><strong>Active Data:</strong> Personal information of a manager or participant is stored in the active system as long as the account or event exists. Upon a deletion request, the information will be immediately removed from the active system.</li>
                <li><strong>Backups:</strong> For disaster recovery purposes, the database is backed up automatically by Firebase, once a day. The backups are held and operated by Google and are not under our control. Information deleted from the active system may remain in the backup copies for a limited period, and we are not able to locate or delete an individual record inside a backup copy.</li>
            </ul>
            
            <h2>6. Children's Privacy</h2>
            <p>The service is not intended for use by children under the age of 16. We do not knowingly collect personal information from children.</p>

            <h2>7. User Rights</h2>
        <p>
          Under the Privacy Protection Law, you are entitled to review your personal information, request its correction, or request its deletion. 
          To exercise these rights, or for any other privacy-related questions, please contact us in one of the following ways:
        </p>
        <ul>
            <li>
                Using our <a href="https://docs.google.com/forms/d/1V45Zzte9AJ9okw11Dhg0750xzt8T9t8Q0mGHjwg_BUc/preview" target="_blank" rel="noopener noreferrer">dedicated contact form</a>.
            </li>
            <li>
                Via email at: <a href="mailto:Shishi.Shitufi.App@gmail.com">Shishi.Shitufi.App@gmail.com</a>.
            </li>
        </ul>
            
            <h2>8. Changes to the Privacy Policy</h2>
            <p>We reserve the right to update this policy from time to time.</p>
        </div>
      </div>
    </div>
  </div>
);

export default PrivacyPolicyPage;
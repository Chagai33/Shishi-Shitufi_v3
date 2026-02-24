// src/pages/TermsPage.tsx

import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

const TermsPage: React.FC = () => (
  <div className="legal-page-container">
    <div className="max-w-4xl mx-auto">
      <Link
        to="/"
        className="inline-flex items-center text-sm font-medium text-primary hover:text-primary/80 transition-colors mb-6"
      >
        <ArrowRight size={16} className="ml-1" />
        חזור לדף הבית
      </Link>

      <h1 className="text-3xl font-bold mb-4">תקנון ותנאי שימוש - שישי שיתופי</h1>
      <p className="text-sm text-neutral-500 mb-6">תאריך עדכון אחרון: פברואר 2026</p>

      <div className="prose">
        <p>ברוכים הבאים ל"שישי שיתופי" (להלן: "<strong>האפליקציה</strong>" או "<strong>השירות</strong>"), פלטפורמת תכנון האירועים הקהילתיים שפותחה במסגרת פרויקט Web Coding על ידי חגי יחיאל (להלן: "<strong>המפתח</strong>").</p>
        <p>השימוש באפליקציה, שירותיה ותכניה כפוף לתנאים המפורטים להלן ("<strong>תנאי השימוש</strong>" ו"<strong>מדיניות הפרטיות</strong>"). אנא קרא אותם בעיון. שימושך באפליקציה, בכל דרך שהיא, לרבות יצירת אירוע או השתתפות בו, מהווה הסכמה בלתי מסויגת לתנאים אלו במלואם. אם אינך מסכים להם, אינך רשאי לעשות שימוש בשירות.</p>

        <h2 className="text-2xl font-bold mt-8 mb-4">חלק א': תנאי שימוש</h2>

        <h3>1. מהות השירות</h3>
        <p>האפליקציה מספקת כלי עזר חינמי לתיאום דיגיטלי של ארוחות שיתופיות קהילתיות (Potluck). האפליקציה מאפשרת למארגני אירועים ("<strong>מנהלים</strong>") ליצור עמודי אירוע, להגדיר חוסרים, ולשתף את הקישור עם חברי הקהילה ("<strong>משתתפים</strong>"), היכולים לשבץ את עצמם להבאת פריטים או להציע/לבקש טרמפים לאירוע.</p>

        <h3>2. כשרות משפטית וגיל המשתמשים</h3>
        <p>השימוש באפליקציה מותר אך ורק למשתמשים בני <strong>18 שנים ומעלה</strong>, בעלי כשרות משפטית להתקשר בהסכם זה. קטינים תחת גיל 18 אינם מורשים לעשות שימוש באפליקציה, והאחריות למניעת גישה מקטינים חלה על המשתמש (ובפרט על מנהלי האירוע המפיצים את הקישורים לאירועים). בעצם שימושך באפליקציה, הינך מצהיר ומתחייב כי הנך מעל גיל 18.</p>

        <h3>3. חשבונות מנהלים ומשתתפים</h3>
        <ul>
          <li><strong>מנהלים:</strong> יצירת אירועים דורשת פתיחת חשבון באמצעות מסירת כתובת דוא"ל, שם להצגה וסיסמה. מנהל האירוע אחראי בלעדי לכל פעולה המתבצעת בחשבונו, והוא מוסמך לשנות הגדרות ולהסיר משתתפים.</li>
          <li><strong>משתתפים:</strong> ההצטרפות כמשתתף (אורח) אינה דורשת פתיחת חשבון או סיסמה. עם זאת, בעת לקיחת התחייבות (הבאת פריט או הצטרפות לטרמפ), תידרש להזין שם להצגה. במקרה של תיאום נסיעה (טרמפ), תידרש להזין גם מספר טלפון תקף.</li>
        </ul>

        <h3>4. פטור מוחלט מאחריות - מזון והסעות בהתנדבות (Carpooling)</h3>
        <p>כאפליקציית עזר חינמית המתווכת בלבד לחלוקת נטל:</p>
        <ul>
          <li><strong>איכות ובטיחות המזון:</strong> המפתח אינו צד לאירועים. אין למפתח כל שליטה ו/או אחריות לגבי המזון, טיבו, בטיחותו, כשרותו, חומרי הגלם שבו או התאמתו לרגישויות ואלרגיות. כל נזק, ישיר או עקיף (לרבות נזק בריאותי), כתוצאה משימוש במוצרים שסופקו באירוע, הוא באחריות המארגנים והמשתתפים הרלוונטיים בלבד.</li>
          <li><strong>נסיעות וטרמפים:</strong> מערכת ה"טרמפים" נועדה אך ורק לעזור למשתמשים לתאם הגעה משותפת לאירוע בהתנדבות (ללא מטרת רווח או לעיתים תוך חלוקה בהוצאות הנסיעה הישירות בלבד, בהתאם למותר בחוק). המפתח אינו בודק ואינו אחראי לזהות הנהגים או הנוסעים, לזהירותם, להכשרתם, לתקינות כלי הרכב, או לקיום רישיונות נהיגה וביטוחי חובה מכסים הסעת נוסעים. <strong>נסיעה מתבצעת על אחריותם הבלעדית והמלאה של הנהג והנוסעים בלבד</strong>. המפתח לא יישא בשום חבות או אחריות מכל סוג שהוא לנזק גוף, רכוש, תאונות, או עוגמת נפש שייגרמו בקשר ישיר או עקיף לשימוש במערך ההיסעים של האפליקציה.</li>
          <li><strong>זמינות המערכת (As-Is):</strong> השירות מסופק "כפי שהוא". ייתכנו תקלות, באגים, שגיאות, או אובדן נתונים. המפתח אינו מתחייב לזמינות האפליקציה לאורך זמן, ושומר לעצמו את הזכות להפסיק או לשנות את פעילותה בכל עת, ללא הודעה מוקדמת.</li>
        </ul>

        <h3>5. שימוש בשירותי צד שלישי המוטמעים באפליקציה</h3>
        <ul>
          <li><strong>תשתיות חיצוניות:</strong> מערכת האפליקציה כוללת קישורים והפניות ליישומים ומערכות חיצוניות (כגון Waze, Google Maps, Apple Maps, Google Calendar). השימוש בשירותים אלו כפוף לתנאי השימוש הרשמיים ולמדיניות הפרטיות של החברות המפעילות אותם.</li>
          <li><strong>ייבוא חכם (Smart Import):</strong> המערכת נעזרת בשירותי הבינה המלאכותית של Google (Google AI Studio) לעיבוד טקסטים או תמונות שמוזנים על ידי מנהלי אירועים לבניית רשימות פריטים מהירה.
            <ul>
              <li>תוכן שאתה מזין לשירות "ייבוא חכם" נשלח לצד שלישי ויכול לשמש את גוגל כדי לשפר ולפתח את מוצריה. גישה אנושית מטעם גוגל עשויה להתבצע לטקסטים אלו.</li>
              <li>לפיכך, <strong>חל עליך איסור מוחלט</strong> להזין למערכת פרטים אישיים, שמות אנשים, טלפונים, פרטים פיננסיים, מידע רפואי או כל מידע רגיש ואישי אחר אודות משתתפים. הכלי נועד אך ורק לניתוח שמות מוצרי מזון.</li>
              <li>טכנולוגיית ה-AI ניסיונית ועשויה לספק תוצאות שגויות. מנהל האירוע נדרש לאמת את נכונות הרשימה בטרם פרסומה.</li>
            </ul>
          </li>
        </ul>

        <h3>6. תוכן משתמשים (User-Generated Content)</h3>
        <p>הינך האחראי הבלעדי לכל תוכן שאתה (כמנהל או כמשתתף) יוצר ומעלה לאפליקציה. אין להעלות לשירות תוכן בלתי חוקי, פוגעני, גזעני, מאיים, מהווה לשון הרע, או המפר זכויות יוצרים ופגיעה בפרטיות של דרג שלישי. כל זכויות הקניין באפליקציה ובקוד המקור שלה שייכות למפתח, ואייקונים בממשק מקורם באתר Flaticon.</p>

        <h2 className="text-2xl font-bold mt-8 mb-4">חלק ב': מדיניות פרטיות</h2>

        <h3>1. איזה מידע אנו אוספים ומה השימוש בו?</h3>
        <ul>
          <li><strong>ממנהלי אירועים (מארגנים):</strong> אנו אוספים ומאחסנים בגוגל את כתובת הדוא"ל, סיסמה מוצפנת, ושם תצוגה כדי לספק גישה וזיהוי מאובטח לחשבונך.</li>
          <li><strong>ממשתתפים (אורחים):</strong> אנו שומרים את השם (להצגה) שהזנת כדי להציגו למארגן ולחברי הקבוצה.</li>
          <li><strong>תכונת הטרמפים (טלפונים):</strong> על מנת לקשר בין נהגים לנוסעים באירוע מסוים, מערכת הטרמפים דורשת הזנת <strong>מספר טלפון</strong>. הוספת מספר טלפון לאפליקציה מהווה הסכמה שפרט זה ייאסף על ידי המערכת וייחשף אך ורק למשתתפים הרלוונטיים באותו אירוע ולמנהל הקבוצה, לשם תיאום הנסיעה. אם אינך מעוניין בחשיפת מספר הטלפון שלך - אל תשתמש במערכת תיאום הטרמפים.</li>
          <li><strong>Cookies ו-Local Storage:</strong> האפליקציה עושה שימוש בטכנולוגיית Local Storage של הדפדפן ובשירותי הזיהוי של Firebase כדי לאפשר למשתמש להישאר מחובר למערכת ולשמור על העדפות שפה.</li>
          <li><strong>נתונים טכניים (אנליטיקה):</strong> האפליקציה משתמשת בשירות Google Analytics כדי לאסוף מידע סטטיסטי-אנונימי לשיפור ביצועיה. האפליקציה אינה אוספת נתוני מיקום (GPS).</li>
        </ul>

        <h3>2. היכן אנחנו שומרים את המידע שלך?</h3>
        <p>האפליקציה פועלת על תשתית הענן של חברת Google. בסיס הנתונים מאוחסן בשרתים ב-US (Data location: us-central1). בשימושך באפליקציה, אתה נותן את הסכמתך להעברת נתוניך ועיבודם במסגרת חברת Google. מאגרי המידע מגובים תקופתית באופן המחופה אוטומטית.</p>

        <h3>3. מחיקת חשבון וזכות להישכח (Right to be Forgotten)</h3>
        <ul>
          <li><strong>עבור מנהלים (בעלי חשבון רשום):</strong> בממשק ההגדרות של האפליקציה קיים כפתור "מחיקת חשבון". לחיצה עליו מוחקת בו-זמנית ובאופן טוטאלי את נתוני המשתמש משרתי ההזדהות, מסירה את היסטוריית האירועים שיצר מכלי האחסון, ומוחקת את כלל הפריטים וההתחייבויות שלקח על עצמו באירועים אחרים (לרבות שמו ומספרו).</li>
          <li><strong>עבור משתמשי קצה וטרמפים:</strong> משתתף יכול לפתוח את שיבוציו באירוע פעיל (הזמין כ-48 שעות מיום האירוע) ולבטל את שיוכו לפריטים ולתיאום הטרמפ, פעולה המסירה ממאגר הנתונים המרכזי (Live Database) את מספר הטלפון ושמו מאותו אירוע.</li>
          <li>מודגש כי גיבויים היסטוריים המוצפנים בשרתי גוגל נמחקים ונשחקים רק בחלוף תקופת המחזור כחלק מטכנולוגיה סגורה, ואין המפתח מסוגל טכנית לנקות ידנית גיבוי שנסגר.</li>
        </ul>

        <h3>4. תקשורת ודיוור עתידי</h3>
        <p>המפתח רשאי להשתמש בכתובת הדוא"ל שהוזנה בידי מנהלי קבוצות כדי לשלוח עדכוני תוכנה, הודעות טכורות והודעות אבטחה (ללא מטרות פרסום ושיווק של חברות אחרות).</p>

        <h3>5. סמכות שיפוט וייצוג בבתי משפט</h3>
        <p>על תנאי שימוש אלו יחולו דיני מדינת ישראל. סמכות השיפוט הבלעדית בכל סכסוך הנוגע לאפליקציה תהא נתונה לבתי המשפט במחוז תל אביב-יפו.</p>

        <h3>6. יצירת קשר עם המפתח</h3>
        <p>המפתח שומר לעצמו את הזכות המלאה לשנות, ולעדכן מסמך זה ללא התראה מוקדמת מראש. פניות יתבצעו דרך:</p>
        <ul>
          <li>
            באמצעות <a href="https://docs.google.com/forms/d/1V45Zzte9AJ9okw11Dhg0750xzt8T9t8Q0mGHjwg_BUc/preview" target="_blank" rel="noopener noreferrer">טופס יצירת הקשר</a>.
          </li>
          <li>
            דרך כתובת המייל: <a href="mailto:Shishi.Shitufi.App@gmail.com">Shishi.Shitufi.App@gmail.com</a>.
          </li>
        </ul>

        <hr className="my-10" />
        <h1 className="text-3xl font-bold mt-12 mb-4" lang="en">Terms of Use & Privacy Policy - Shishi Shitufi</h1>
        <p className="text-sm text-neutral-500 mb-6" lang="en">Last Updated: February 2026</p>

        <div lang="en">
          <p>Welcome to "Shishi Shitufi" (hereinafter: "<strong>The Application</strong>" or "<strong>The Service</strong>"), a community potluck event planning platform developed by Chagai Yechiel (hereinafter: "<strong>The Developer</strong>").</p>
          <p>Your use of the Application, its services, and content is subject to the terms detailed below ("<strong>Terms of Use</strong>" and "<strong>Privacy Policy</strong>"). Please read them carefully. Your use of the Application in any way, including creating an event or participating in one, constitutes unconditional agreement to these terms in full. If you do not agree to them, you may not use the Service.</p>

          <h2 className="text-2xl font-bold mt-8 mb-4">Part A: Terms of Use</h2>

          <h3>1. Definition of the Service</h3>
          <p>The Application provides a free auxiliary tool for the digital coordination of community potluck meals. The Application allows event organizers ("<strong>Managers</strong>") to create event pages, define missing items, and share the link with community members ("<strong>Participants</strong>"), who can assign themselves to bring items or offer/request rides to the event.</p>

          <h3>2. Legal Capacity and Age of Use</h3>
          <p>Use of the Application is permitted solely for users who are <strong>18 years of age and older</strong>, possessing the legal capacity to enter into this agreement. Minors under the age of 18 are not permitted to use the Application, and the responsibility to prevent access by minors lies with the user (and particularly on the event managers who distribute the event links). By using the Application, you declare and warrant that you are over the age of 18.</p>

          <h3>3. Manager and Participant Accounts</h3>
          <ul>
            <li><strong>Managers:</strong> Creating events requires opening an account by providing an email address, display name, and password. The event manager is solely responsible for any action taken within their account, and is authorized to change settings and remove participants.</li>
            <li><strong>Participants:</strong> Joining as a participant (guest) does not require opening an account or a password. However, when making a commitment (bringing an item or joining a ride), you will be required to enter a display name. In the case of ride coordination (carpooling), you will also be required to enter a valid phone number.</li>
          </ul>

          <h3>4. Absolute Exemption from Liability - Food and Voluntary Rides (Carpooling)</h3>
          <p>As a free auxiliary application that serves only to intermediate the distribution of the burden:</p>
          <ul>
            <li><strong>Food Quality and Safety:</strong> The Developer is not a party to the events. The Developer has no control and/or responsibility regarding the food, its nature, safety, kashrut, raw materials, or its suitability for sensitivities and allergies. Any damage, direct or indirect (including health damage), as a result of using the products provided at the event, is the sole responsibility of the relevant organizers and participants.</li>
            <li><strong>Rides and Carpooling:</strong> The "Rides" system is designed solely to help users coordinate joint arrival to the event on a voluntary basis (not for profit, or sometimes with the sharing of direct travel expenses only, as permitted by law). The Developer does not verify and is not responsible for the identity of the drivers or passengers, their caution, training, vehicle roadworthiness, or the existence of driving licenses and mandatory / third-party insurance covering the transportation of passengers. <strong>A ride is carried out at the sole and full responsibility of the driver and passengers only.</strong> The Developer shall not bear any liability or responsibility of any kind for bodily injury, property damage, accidents, or distress caused directly or indirectly in connection with the use of the Application's ride system.</li>
            <li><strong>System Availability (As-Is):</strong> The Service is provided "as is". There may be malfunctions, bugs, errors, or data loss. The Developer does not commit to the long-term availability of the Application, and reserves the right to stop or change its activity at any time, without prior notice.</li>
          </ul>

          <h3>5. Use of Third-Party Services Embedded in the Application</h3>
          <ul>
            <li><strong>External Infrastructures:</strong> The Application system includes links and referrals to external applications and systems (such as Waze, Google Maps, Apple Maps, Google Calendar). Use of these services is subject to the official terms of use and privacy policies of the companies operating them.</li>
            <li><strong>Smart Import:</strong> The system utilizes Google's Artificial Intelligence services (Google AI Studio) to process texts or images entered by event managers to quickly build item lists.
              <ul>
                <li>Content (Prompts) that you enter into the "Smart Import" service is sent to a third party and may be used by Google to improve and develop its products (in accordance with Google API Terms for Unpaid services). Human reviewers on behalf of Google may read these inputs.</li>
                <li>Therefore, <strong>you are strictly prohibited</strong> from entering names of people, phone numbers, financial details, medical records, or any other sensitive and personal information about participants into the Smart Import (AI) system. The tool is intended solely for analyzing generic grocery lists.</li>
                <li>AI technology is experimental and may provide incorrect results (Hallucinations). The event manager is required to review the extracted items and verify their accuracy before publishing them to the participants.</li>
              </ul>
            </li>
          </ul>

          <h3>6. User-Generated Content</h3>
          <p>You are solely responsible for any content you (as a manager or participant) create and upload to the Application. You may not upload content to the Service that is illegal, offensive, racist, threatening, defamatory, or violates copyrights and privacy of a third party. All property rights in the Application and its source code belong to the Developer, and interface icons originate from the Flaticon website.</p>

          <h2 className="text-2xl font-bold mt-8 mb-4">Part B: Privacy Policy</h2>

          <h3>1. What Information Do We Collect and How is it Used?</h3>
          <ul>
            <li><strong>From Event Managers (Organizers):</strong> We collect and store in Google the email address, encrypted password, and display name to provide access and secure identification for your account.</li>
            <li><strong>From Participants (Guests):</strong> We save the display name you entered to show it to the organizer and group members.</li>
            <li><strong>The Rides Feature (Phone Numbers):</strong> In order to connect drivers and passengers in a specific event, the rides system requires the entry of a <strong>phone number</strong> of the ride creator and the passenger. Adding a phone number to the Application constitutes consent that this detail will be collected by the system and exposed solely to the relevant participants in that event and the group manager, for the purpose of resolving the voluntary ride process. The Developer is not responsible for harassment, spam, or any misuse made by participants who were exposed to this information. If you do not wish to expose your phone number - do not join or offer rides in the system.</li>
            <li><strong>Cookies and Local Storage:</strong> The Application uses the browser's Local Storage technology and Firebase authentication services to allow the user to stay connected to the system and maintain language preferences.</li>
            <li><strong>Technical Data (Analytics):</strong> The Application uses the Google Analytics cloud service to collect anonymous-statistical information (such as errors, browser type, and application visits) to improve its performance. The Application <strong>does not</strong> collect GPS location data of the users at all.</li>
          </ul>

          <h3>2. Where Do We Store Your Information?</h3>
          <p>The Application operates on the cloud infrastructure of Google, as a Firebase service. The database and user database are stored on secure servers located in the United States (Data location: us-central1). By using the Application, you give your consent to the transfer of your data and its processing on servers in the US. Databases are periodically backed up as a routine part of Google's recovery and crash protection capabilities.</p>

          <h3>3. Account Deletion and Right to be Forgotten</h3>
          <ul>
            <li><strong>For Managers (Registered Account Holders):</strong> In the Application's settings interface, there is an "Account Deletion" button. Clicking it automatically and immediately triggers a cloud function that completely deletes the user's data from the authentication servers, removes the history of events they created from the Database, and deletes all items and commitments they took upon themselves as a participant in events of other organizers (including their name and number, which are deleted). Following deletion, this data will not be recoverable for the user or other participants.</li>
            <li><strong>For End Users and Rides:</strong> Every event is configured by default and according to the organizer's settings to become "inactive" (meaning new commitments, such as ride requests, cannot be added) approximately 48 hours after the event date. At any stage while the event is active, and using the device where the assignment was made in the same browser, the user can open their assignments and cancel their association with items and ride coordination, an action which removes their phone number and name from the central database (Live Database) for that event.</li>
            <li>It is emphasized that historical backups encrypted on Google servers erode and are deleted over time (the backups overlap over a short period backwards), but the deletion from this database is performed passively and there is no specific possibility to "clean" a specific point in time from the closed backup files.</li>
          </ul>

          <h3>4. Future Communication and Mailing</h3>
          <p>The Developer may, from time to time, use the email address entered by group managers to send relevant software updates, security messages, and updates on future changes to the regulations. Mostly, I will contact you at this address only regarding technical matters directly related to the continued provision of an ongoing user experience (not for the purpose of sales and advertising marketing of other companies).</p>

          <h3>5. Jurisdiction and Representation in Courts</h3>
          <p>These Terms of Use shall be governed by the laws of the State of Israel. Exclusive jurisdiction regarding any dispute concerning the Application shall be vested in the competent courts in the Tel Aviv-Jaffa district.</p>

          <h3>6. Contacting the Developer</h3>
          <p>The Developer reserves the full right to change and update the Terms of Use and Privacy Policy at any time. Any material change will be indicated in the Application. By continuing to use the Application after the publication date of the new rules, you confirm your consent to the updated terms. The Service is provided "As Is" on behalf of a developer from the "Web Coding" group. The Application does not have a corporate entity or company (P.C.), and the official online address for inquiries will be made in writing via:</p>
          <ul>
            <li>Using our <a href="https://docs.google.com/forms/d/e/1FAIpQLScliYWHohU4JSq1Xm3d_0auBCetq4BgoDp0vc7M9SCbIT6cbw/viewform" target="_blank" rel="noopener noreferrer">dedicated contact form</a>.</li>
            <li>Via email at: <a href="mailto:Shishi.Shitufi.App@gmail.com">Shishi.Shitufi.App@gmail.com</a>.</li>
          </ul>
        </div>
      </div>
    </div>
  </div>
);

export default TermsPage;
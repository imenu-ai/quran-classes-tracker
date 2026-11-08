# Google Play listing

What goes into the Play Console for "تحفيظ القرآن" (PLAN.md 2.16). Default language: Arabic, with an English (United States) translation. The texts follow `app-store.md`; keep both files in step with what's submitted. Never put passwords here; the demo accounts' passwords go only into the Play Console.

## Create the app

| Field            | Value                                              |
| ---------------- | -------------------------------------------------- |
| App name         | تحفيظ القرآن                                       |
| Default language | Arabic – ar                                        |
| App or game      | App                                                |
| Free or paid     | Free (can't be changed to paid later)              |
| Package name     | `ai.imenu.quran` (set by the first uploaded build) |
| Category         | Education                                          |
| Contact email    | mhmdtshref@gmail.com                               |
| Website          | https://quran.imenu.ai                             |
| Privacy policy   | https://quran.imenu.ai/privacy                     |
| Countries        | All countries and regions                          |

Play app names don't have to be unique, so the English title can stay "Quran Memorization".

## Arabic (default)

**App name** (30): تحفيظ القرآن

**Short description** (80):
سجّل حضور طلاب الحلقة وتسميعهم ودرجاتهم، حتى دون إنترنت، وتابع تقدّم كل طالب.

**Full description** (4000):

تطبيق لمراكز تحفيظ القرآن الكريم: يسجّل المعلم في الحلقة حضور الطلاب وتسميعهم ودرجاتهم وواجباتهم، ويتابع المركز تقدّم كل طالب.

للمعلم
• حضور الطالب أو غيابه بلمسة، مع العذر عند الحاجة.
• التسميع من سورة أو أكثر، بالآيات أو بصفحات المصحف، مع درجة الحفظ ودرجة السلوك من 0 إلى 10 بأنصاف الدرجات.
• «لم يحفظ» حين لا يحفظ الطالب واجبه: يبقى الواجب للدرس التالي دون أن يتأثر معدّل حفظه، مع درجة السلوك.
• تسجيل جلسة في يوم سابق.
• الواجب التالي مقترح تلقائيًا من آخر ما حفظه الطالب.
• الاختبارات بدرجة واحدة، منفصلة عن المعدّلات.
• جدول شهري لكل طالب بالحضور والمقاطع والدرجات والمعدّلات.

للمركز
• يسجّل المدير مركزه ويضيف المعلمين، ويحدد لكل معلم حلقاته وصلاحياته.
• إحصائيات كل حلقة: نسبة الحضور ومعدّلات الحفظ والسلوك وترتيب الطلاب.
• طباعة كشف شهري لكل طالب، أو مشاركته ملف PDF.
• رابط خاص لكل ولي أمر يتابع منه شهر ابنه برقم هويته، دون حساب.

يعمل دون إنترنت
كل ما تسجّله يُحفظ على الجهاز أولًا، ثم يُزامن تلقائيًا عند عودة الاتصال، وتظهر حالة المزامنة دائمًا.

مصمّم للعربية
واجهة عربية من اليمين إلى اليسار، على الهواتف والأجهزة اللوحية، وعلى الويب أيضًا.

الخصوصية
لا إعلانات ولا تتبع. يستطيع كل مستخدم حذف حسابه، ويستطيع المدير حذف المركز وكل بياناته من الإعدادات.

## English (United States)

**App name** (30): Quran Memorization

**Short description** (80):
Record attendance, recitations and marks in Quran classes, even offline.

**Full description** (4000):

An app for Quran memorization centers: teachers record their students' attendance, recitations, marks and homework during class, and the center follows each student's progress.

For teachers
• Mark a student present or absent with one tap, with an excuse when needed.
• Record a recitation of one or more suras, by ayahs or by mushaf pages, with a memorization mark and a behavior mark from 0 to 10 in halves.
• "Not memorized" when a student isn't ready: the homework stays for the next lesson without affecting his memorization average, and he still gets a behavior mark.
• Record a session on an earlier day.
• The next homework is suggested from what the student memorized last.
• Exams with a single mark, kept out of the averages.
• A monthly table per student with attendance, portions, marks and averages.

For the center
• The admin registers the center, adds teachers, and chooses each teacher's classes and permissions.
• Class statistics: attendance rate, memorization and behavior averages, and a student ranking.
• Print a monthly sheet per student, or share it as a PDF.
• A private link for each parent to follow their child's month with their ID number, no account needed.

Works offline
Everything you record is saved on the device first and syncs automatically when you're back online; the sync state is always shown.

Made for Arabic
An Arabic, right-to-left interface on phones and tablets, and on the web too.

Privacy
No ads and no tracking. Every user can delete their account, and an admin can delete the center with all its data, in Settings.

## Graphics

In `store/play/`:

| Asset                    | File                     | Play's rule                             |
| ------------------------ | ------------------------ | --------------------------------------- |
| App icon                 | `icon-512.png`           | 512 × 512 PNG; Play rounds the corners  |
| Feature graphic, Arabic  | `feature-graphic-ar.png` | 1024 × 500 PNG or JPEG, no transparency |
| Feature graphic, English | `feature-graphic-en.png` | the same                                |

Screenshots: 2–8 per device type, PNG or JPEG, each side 320–3840 px, the long side at most twice the short one (a 1080 × 2400 phone screen must be cropped to 1080 × 2160 or less). Phone shots are required; 7" and 10" tablet shots let Play show the app as tablet-ready.

The shots are in `store/play/screenshots/`: `phone/` (1080 × 1920, `qct_phone` at 360 dp) and `tablet/` (2560 × 1600, `qct_tablet`; the same set fits both tablet slots). They follow the shot list in `app-store.md`, without the parent link: they were taken against a local copy of the demo center (same `center:create` and `dev:seed` data), and that screen prints the server's address, which would read `localhost`. The print preview's small QR code points to `localhost` too, and its system dialog is in English, the emulator's language.

## App content (Policy and programs → App content)

| Declaration        | Answer                                                                                                |
| ------------------ | ----------------------------------------------------------------------------------------------------- |
| Privacy policy     | https://quran.imenu.ai/privacy                                                                        |
| Ads                | No ads                                                                                                |
| App access         | All or some functionality is restricted. Add the demo admin (and teacher) with the instructions below |
| Content rating     | Category "Reference, news, or educational"; No to every question. Expected: Everyone / PEGI 3         |
| Target audience    | 18 and over only (teachers and admins use the app, not students); doesn't appeal to children          |
| News app           | No                                                                                                    |
| Data safety        | See below                                                                                             |
| Government app     | No                                                                                                    |
| Financial features | None                                                                                                  |
| Health             | None                                                                                                  |
| Advertising ID     | No (the app doesn't declare `AD_ID`)                                                                  |

**App access instructions** (the form has a username, a password and "any other information"):

- Username: `demo_admin`, password in the Play Console only.
- Any other information: "Center code: 689723. Everyone signs in with their center's 6-digit code first, then the username and password. The interface is Arabic only. A teacher account is also available: demo_teacher (password …). Please use the teacher account to try account deletion (Settings → Account → Delete account), so the demo center stays for later reviews."

The build asks for no permission that needs a declaration (no location, SMS, call log, contacts, media, camera or microphone).

## Data safety

Collects data: **Yes**. Shares data with third parties: **No** (the hosting providers process it for us, which isn't sharing). Nothing is processed ephemerally.

| Category            | Data type                    | Required or optional | Purposes                              | What it is                                                           |
| ------------------- | ---------------------------- | -------------------- | ------------------------------------- | -------------------------------------------------------------------- |
| Personal info       | Name                         | Required             | App functionality, Account management | Users' names; students' names entered by the center                  |
| Personal info       | Email address                | Required             | App functionality, Account management | Admins' email, for password reset                                    |
| Personal info       | Phone number                 | Optional             | App functionality                     | Optional user phone numbers                                          |
| Personal info       | User IDs                     | Required             | App functionality, Account management | The account id                                                       |
| Personal info       | Other info                   | Required             | App functionality                     | Students' birth years and parents' ID numbers, entered by the center |
| App activity        | Other user-generated content | Required             | App functionality                     | Classes, attendance, recitations, marks, homework, notes             |
| Device or other IDs | Device or other IDs          | Required             | App functionality                     | A random id the app creates per install, used for syncing            |

Security practices:

- Data is encrypted in transit: **Yes** (HTTPS only).
- Users can ask for their data to be deleted: **Yes**.
- Account creation: **Username and password**.
- Account deletion URL: **https://quran.imenu.ai/support** (its "Deleting your account or the center" section: deleting on the website without the app, what's deleted and what stays, and the email route).
- Independent security review: No.

## Testing and release

- **The first upload is manual.** Google's API can't create an app's first release, so download the `.aab` from the EAS build page and upload it in the Play Console. Later builds can go through `eas submit` once a Google service account is set up (README → "Releasing the app").
- **A new personal developer account** must run a closed test with at least 12 testers, opted in for 14 days in a row, before it can apply for production. An organization account goes straight to production.

**Release notes** (Play's format, 500 characters per language). 1.0.0 had "الإصدار الأول." / "First release."; 1.1.0:

```
<ar>
• الدرجات من 0 إلى 10 بأنصاف الدرجات (مثل 9.5).
• «لم يحفظ» في قائمة درجة الحفظ بدل تأجيل التسميع، مع درجة السلوك في ذلك اليوم.
• الواجب أو الاختبار من أكثر من سورة، أو سورة كاملة.
• إدخال الواجب بصفحات المصحف.
• إضافة جلسة في يوم سابق.
</ar>
<en-US>
• Marks from 0 to 10 in halves (such as 9.5).
• "Not memorized" in the memorization mark list instead of postponing, with that day's behavior mark.
• Homework or an exam of several suras, or a whole sura.
• Homework given as mushaf pages.
• Add a session on an earlier day.
</en-US>
```

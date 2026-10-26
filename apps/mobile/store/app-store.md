# App Store listing

What goes into App Store Connect for "تحفيظ القرآن" (PLAN.md 2.16). Primary language: Arabic, with an English localization. Keep this file in step with what's submitted. Never put passwords here; the demo accounts' passwords go only into App Store Connect.

## App information

| Field              | Value                                                                    |
| ------------------ | ------------------------------------------------------------------------ |
| Bundle ID          | `ai.imenu.quran`                                                         |
| SKU                | `ai.imenu.quran`                                                         |
| Primary category   | Education                                                                |
| Secondary category | Productivity                                                             |
| Price              | Free                                                                     |
| Availability       | All countries and regions                                                |
| Copyright          | © 2026 Mohammed Alsharif                                                 |
| Privacy policy URL | https://quran.imenu.ai/privacy                                           |
| Support URL        | https://quran.imenu.ai/support                                           |
| Marketing URL      | (none)                                                                   |
| Age rating         | 4+ (every content question: None; no web access, no UGC shared publicly) |
| Content rights     | No third-party content                                                   |
| Export compliance  | Standard encryption only (`ITSAppUsesNonExemptEncryption: false`)        |

App names are unique across the App Store. If "تحفيظ القرآن" is taken, use "تحفيظ القرآن - متابعة الحلقات" (the app's own name on the phone stays "تحفيظ القرآن").

## Arabic (primary)

**Name** (30): تحفيظ القرآن

**Subtitle** (30): متابعة حلقات تحفيظ القرآن

**Promotional text** (170):
سجّل الحضور والتسميع والدرجات في الحلقة، حتى دون إنترنت، وتابع تقدّم كل طالب شهرًا بشهر.

**Description** (4000):

تطبيق لمراكز تحفيظ القرآن الكريم: يسجّل المعلم في الحلقة حضور الطلاب وتسميعهم ودرجاتهم وواجباتهم، ويتابع المركز تقدّم كل طالب.

للمعلم
• حضور الطالب أو غيابه بلمسة، مع العذر عند الحاجة.
• التسميع من أي سورة وآية، مع درجة الحفظ ودرجة السلوك.
• تأجيل التسميع إلى الدرس التالي دون أن يتأثر معدّل الطالب.
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
واجهة عربية من اليمين إلى اليسار، تعمل على iPhone وiPad، وعلى الويب أيضًا.

الخصوصية
لا إعلانات ولا تتبع. يستطيع كل مستخدم حذف حسابه، ويستطيع المدير حذف المركز وكل بياناته من الإعدادات.

**Keywords** (100, no spaces after commas):
قرآن,تحفيظ,حلقة,حلقات,معلم,طلاب,حضور,تسميع,حفظ,مركز,درجات,مصحف

**What's new** (first version): الإصدار الأول.

## English

**Name** (30): Quran Memorization

**Subtitle** (30): Track memorization classes

**Promotional text** (170):
Record attendance, recitations and marks in class, even offline, and follow each student's progress month by month.

**Description** (4000):

An app for Quran memorization centers: teachers record their students' attendance, recitations, marks and homework during class, and the center follows each student's progress.

For teachers
• Mark a student present or absent with one tap, with an excuse when needed.
• Record a recitation from any sura and ayah, with a memorization mark and a behavior mark.
• Postpone a recitation to the next lesson without affecting the student's average.
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
An Arabic, right-to-left interface on iPhone and iPad, and on the web too.

Privacy
No ads and no tracking. Every user can delete their account, and an admin can delete the center with all its data, in Settings.

**Keywords** (100):
quran,memorization,hifz,tahfiz,class,teacher,students,attendance,recitation,marks,islamic,school

**What's new** (first version): First release.

## App Review

**Sign-in information** (App Review needs an account; the app has no guest mode):

- Center code: `689723` (the demo center "مركز النور التجريبي" on production, with sample classes, students and marks)
- Admin: username `demo_admin`, password in App Store Connect only
- Teacher: username `demo_teacher` (one class, can run lessons and see reports), password in App Store Connect only

**Notes** (English):

> Sign in with the center code, username and password above: everyone signs in with their center's 6-digit code first. The admin account sees everything (classes, users, settings); the teacher account sees only its assigned class.
>
> The interface is Arabic only (right to left). Main screens: الحلقات (Classes), البحث (Search), المستخدمون (Users, admins only), الإعدادات (Settings).
>
> Account deletion: Settings (الإعدادات) → Account (الحساب) → "حذف الحساب" (Delete account). The center's only admin is asked to make another user an admin first or delete the whole center: Settings → Center (المركز) → "حذف المركز" (Delete the center). Please use the teacher account to try account deletion, so the demo center stays for later reviews.
>
> New centers can also register from the sign-in screen ("سجّل مركزك").

If a reviewer deletes the demo center anyway, recreate it (README → "Releasing the app").

## App privacy (the "nutrition label")

Tracking: **No** (no data is used to track users or shared with data brokers or for ads).

Data collected, all **linked to the user**, all for **App Functionality** only, none for tracking:

| Category     | Type               | What it is                                                           |
| ------------ | ------------------ | -------------------------------------------------------------------- |
| Contact Info | Name               | Users' names; students' names entered by the center                  |
| Contact Info | Email Address      | Admins' email, for password reset                                    |
| Contact Info | Phone Number       | Optional user phone numbers                                          |
| User Content | Other User Content | Classes, attendance, recitations, marks, homework, notes             |
| Identifiers  | User ID            | The account id                                                       |
| Identifiers  | Device ID          | A random id the app creates per install, used for syncing            |
| Other Data   | Other Data Types   | Students' birth years and parents' ID numbers, entered by the center |

Not collected: location, health, financial info, contacts, browsing or search history, purchases, usage data, diagnostics (no analytics or crash reporting SDKs).

## Screenshots

Apple requires iPhone 6.9" (1320 × 2868 or 1290 × 2796) and iPad 13" (2064 × 2752 or 2048 × 2732) screenshots; one set is reused for the smaller sizes. Take them from the TestFlight build, signed in as `demo_admin` in the demo center, in light mode, with notifications silenced. Screenshots from other device sizes can be fitted to these sizes afterwards. Without an iPad, take the iPad set in Appetize.io from the `simulator` build profile (README → "Releasing the app").

Shot list, in this order, on both iPhone and iPad (iPad in landscape):

1. **Classes** (الحلقات): the home screen with both classes.
2. **A class**: حلقة الفجر, its students.
3. **A student, today**: present, with a homework item opened showing its two marks.
4. **The month table**: the same student's month opened.
5. **Class statistics**: حلقة الفجر, all time.
6. **Printing**: a student's month sheet in the print preview (طباعة الشهر).
7. **The parent link**: its QR code screen (رابط ولي الأمر).

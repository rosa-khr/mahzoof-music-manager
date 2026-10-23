# طرح پیش از پیاده‌سازی — خروجی اول بخش ۱۹

معماری: Modular Monolith؛ Angular standalone با strict و Reactive Forms و routeهای lazy؛ API با Node.js و Express؛ SQLite رابطه‌ای با foreign keys، WAL و تراکنش BEGIN IMMEDIATE. انتخاب SQLite برای استقرار تک‌نمونه آموزشگاه، بکاپ ساده و راه‌اندازی بدون سرویس جانبی است. داده اصلی فقط در سرور است.

مدل: User/Session/AuthAttempt، Student/Guardian، Subject، Enrollment، ClassOffering، Term، StudentTerm، Session/Attendance، Invoice، Payment/PaymentAllocation، BankAccount، AuditLog و جدول migration. کد هنرجو و شماره ترم یکتا؛ عضویت و صورتحساب مستقل؛ پرداخت و تخصیص جدا؛ مبلغ صحیح در واحد تومان یا سنت دلار. محاسبات در تراکنش و کنترل نسخه حضور و idempotency پرداخت.

امنیت: رمز scrypt، نشست تصادفی با hash در دیتابیس و cookie HttpOnly/SameSite، کنترل Origin و CSRF برای mutation، محدودیت ورود، مجوز سروری و حذف فیلد مالی برای منشی و داده آموزشی غیرضروری برای حسابدار. اولین مدیر با CLI و رمز محیطی، بدون رمز ثابت.

برنامه: ۱) تثبیت نسخه رسمی Angular و زیرساخت ۲) migration و سرویس‌های دامنه ۳) ورود و پرونده و مسیر کامل خصوصی ۴) تست خودکار API و مرورگر و build ۵) مستند وضعیت، اجرا و موانع.

طراحی رابط — تصمیم به‌روز ۲۰ اکتبر ۲۰۲۶: کاربر صریحاً پیاده‌سازی مستقل با الهام از Metronic 8 Demo 1 را مجاز و نبود بسته را غیرمسدود اعلام کرد. این تصمیم جای شرط پیشین دریافت بسته را می‌گیرد. shell راست با حالت جمع‌شده و drawer موبایل، Header/Breadcrumb/Field/Badge/Icon مشترک، متغیرهای طراحی و breakpointهای مرکزی؛ بدون کپی دارایی اختصاصی دمو. هیچ پلاگین قالب مالک DOM نیست. فونت محلی Dana و آیکون‌های خطی SVG مستقل‌اند. اطلاعات و APIها و مجوزها تغییر نکرده‌اند.

PWA: manifest و service-worker build فقط برای shell عمومی؛ نصب/آپدیت و دستگاه‌ها مربوط به مرحله نهایی است.

اطلاعات پایه — درخواست جدید: migration 003 سه جدول مستقل teaching_types/instructors/instruments با وضعیت و version می‌افزاید. عنوان دلخواه نوع تدریس طبق پاسخ صریح کاربر مستقل از mode/structure کلاس است؛ instruments نیز جایگزین subjects نیست. API مشترک allowlist جدول/ستون، فیلتر AG Grid پارامتری، شمارش و pagination سرور و audit تراکنشی دارد. نام ساز و نوع تدریس کلید نرمال‌شده یکتا دارند؛ مدرسین هم‌نام مجازند. قالب مشترک list/editor، metadata مسیر و Reactive Forms/Select2 دارد. URL فیلتر و صفحه از لیست به ویرایش و بازگشت حفظ می‌شود. این مرحله CRUD اطلاعات پایه است؛ روابط انتخاب کلاس/ترم و حساب ورود مدرس به‌صورت خودکار ایجاد یا بازنویسی نمی‌شوند. migration 008 همان جدول قدیمی subjects را با آدرس، تلفن، وب‌سایت، شبکه اجتماعی و version توسعه می‌دهد؛ فقط نام اجباری است. `/api/subjects` برای گزینه‌های فعال فرم‌های آموزشی حفظ شده و CRUD مدیریتی نسخه‌دار در `/api/subject-catalog` با مجوز منوی `/subjects` ارائه می‌شود.

دراپ‌داون‌ها — درخواست بعدی کاربر: Select2 واقعی 4.1.0 و jQuery 3.7.1 محلی با CSS مستقل خنثی. directive مشترک روی select بومی قرار می‌گیرد؛ Angular SelectControlValueAccessor همچنان مالک مقدار است. رویداد jQuery به change بومی و تغییر برنامه‌ای به change.select2 محدود وصل می‌شود؛ MutationObserver گزینه‌ها/disabled و subscription فرم را همگام می‌کنند. lifecycle خروج، افزونه/observer/listener را پاک می‌کند. بسته جاوااسکریپت در chunk مشترک lazy فرم‌هاست؛ فایل اختصاصی Metronic یا CDN استفاده نمی‌شود. مرجع: [مترو‌نیک](https://preview.keenthemes.com/html/metronic/docs/?page=forms/select2)، [نصب رسمی](https://select2.org/getting-started/installation/)، [رویدادهای رسمی](https://select2.org/programmatic-control/events/).

نسخه‌ها از npm official dist-tag latest در شروع 22.2.3 بودند. برای جلوگیری از ورود خودکار runnerهای اختیاری CLI (Karma/Vitest/SSR) از peer resolution قدیمی npm در .npmrc استفاده شده؛ peerهای موردنیاز Angular/TS/RxJS صریح و هم‌نسخه/سازگار نصب می‌شوند. تست‌ها با Node test runner و Playwright مستقل‌اند. تغییر حالت این تنظیم نیازمند بازتولید lock و build مجدد است.

Angular 22 با حالت پیش‌فرض zoneless و ChangeDetectionStrategy.OnPush کار می‌کند؛ وضعیت ورود signal است و پس از پاسخ‌های async، کامپوننت با ChangeDetectorRef.markForCheck به‌روز می‌شود. نتیجه با آزمون مرورگر بررسی می‌شود. هیچ پلاگین Bootstrap JS مالک DOM نیست؛ وضعیت فرم‌ها و پنل عملیات با Angular کنترل می‌شود.


لیست‌ها — تصمیم اجرایی بعدی کاربر: همه لیست‌های موجود به AG Grid Community 36.2.0 با همان تم Material و مشخصات لیست محصولات اورنزا منتقل شدند. DataGrid مشترک lifecycle و استایل و ترجمه را مدیریت می‌کند. هنرجویان Infinite Row Model با فیلتر/مرتب‌سازی/صفحه‌بندی سرور دارند؛ قرارداد legacy API حفظ است. سایر لیست‌ها کل مجموعه مجاز پاسخ فعلی را در grid پردازش می‌کنند. اطلاعات پرونده در storage ذخیره نمی‌شود؛ فقط layout ستون‌ها ذخیره می‌شود. فایل LIST_UI_STANDARD.md معیار صفحات بعد است.

ثبت/ویرایش هنرجو — درخواست جدید: مسیرهای مستقل students/new و students/:id/edit با الگوی فرم چندبخشی اورنزا، ستون اصلی و ستون جانبی عکس/وضعیت و نوار ذخیره. رنگ خنثی حفظ می‌شود. عکس اختیاری در همان درخواست multipart همراه اطلاعات و به‌صورت اتمیک ثبت می‌شود؛ پردازش تصویر به WebP، سقف ۵ MiB و ۱۶ مگاپیکسل، نگهداری BLOB خصوصی در SQLite تا بکاپ فعلی شامل عکس هم باشد. migration 002 جدول عکس و نسخه رکورد را می‌افزاید. ویرایش با کنترل نسخه، حفظ ترم/مالی و عدم تغییر سرپرست مشترک سایر فرزندان انجام می‌شود؛ ویرایش حسابدار مجاز نیست.

# فونت رابط: دانا

آخرین انتخاب کاربر دانا است. فایل‌های موجود در پروژه محلی مجاور orenza/public/fonts به public/fonts/dana این پروژه کپی شده‌اند؛ اجرای این اپ به آن پروژه وابسته نیست.

| فایل اصلی | وزن CSS | اطلاعات وزن در فایل |
| --- | --- | --- |
| Dana-Light.ttf | 300 | Light / 300 |
| Dana-Regular.ttf | 400 | Regular / 400 |
| Dana-Medium.ttf | 500 | Medium / 500 |
| Dana-DemiBold.ttf | 600 | DemiBold / 600 |
| Dana-Bold.ttf | 700 | Bold / 700 |

نام خانواده و وزن‌ها از جدول‌های name و OS/2 فایل‌های اصلی بررسی شدند. فایل‌ها بدون تبدیل یا تغییر کپی شده‌اند. @font-faceها در src/styles.css با font-display: swap تعریف شده‌اند. متغیر Bootstrap خانواده Dana, sans-serif را برای متن و کنترل‌ها اعمال می‌کند. وزن معمولی در index.html preload می‌شود. فونت‌ها assets عمومی پوسته‌اند و در ngsw-config.json قرار دارند؛ داده‌های API در این کش قرار نمی‌گیرند.

Chrome بارگذاری هر پنج وزن و استفاده واقعی از Dana-Bold برای glyphهای فارسی عنوان را تأیید کرد. تست‌های عملکردی دسکتاپ و موبایل پس از تغییر فونت موفق شدند. گزارش در PROJECT_STATUS.md است.

# استقرار نسخه موبایل و وب

این برنامه Responsive و PWA است؛ اپ جداگانه Android/iOS لازم ندارد. کاربر پس از باز کردن دامنه با Chrome یا Safari می‌تواند گزینه «افزودن به صفحه اصلی / Install» را بزند. اطلاعات پرونده و API عمداً در Service Worker کش نمی‌شوند.

## نیازمندی سرور

- Ubuntu 24.04 یا سرور Linux مشابه
- Node.js شاخه 24، حداقل نسخه 24.15
- Nginx و یک دامنه متصل به IP سرور
- HTTPS معتبر؛ برای نصب PWA و کوکی امن الزامی است
- Chrome سازگار در صورت نیاز به «دانلود PDF»

## نصب اولین‌بار

بسته release را به سرور منتقل و سپس اجرا کنید:

```sh
sudo useradd --system --home /opt/mahzoof --shell /usr/sbin/nologin mahzoof
sudo mkdir -p /opt/mahzoof /var/lib/mahzoof /etc/mahzoof
sudo tar -xzf mahzoof-mobile-web-2026-10-24.tar.gz -C /opt/mahzoof
cd /opt/mahzoof
sudo npm ci --omit=dev
sudo chown -R root:root /opt/mahzoof
sudo chown -R mahzoof:mahzoof /var/lib/mahzoof
```

فایل `.env.production.example` را در `/etc/mahzoof/mahzoof.env` کپی کنید و `panel.example.com` را با دامنه واقعی عوض کنید:

```sh
sudo cp /opt/mahzoof/.env.production.example /etc/mahzoof/mahzoof.env
sudo chmod 600 /etc/mahzoof/mahzoof.env
sudo chown root:root /etc/mahzoof/mahzoof.env
```

سرویس را نصب کنید:

```sh
sudo cp /opt/mahzoof/deploy/mahzoof.service.example /etc/systemd/system/mahzoof.service
sudo systemctl daemon-reload
sudo systemctl enable --now mahzoof
curl http://127.0.0.1:3000/health
```

## ساخت اولین مدیر

رمز را داخل تاریخچه فرمان ننویسید:

```sh
read -s 'ADMIN_PASSWORD?رمز مدیر: '
sudo -u mahzoof env DB_PATH=/var/lib/mahzoof/mahzoof.sqlite ADMIN_USERNAME=admin ADMIN_PASSWORD="$ADMIN_PASSWORD" node /opt/mahzoof/server/cli.mjs create admin
unset ADMIN_PASSWORD
```

## دامنه و HTTPS

فایل `deploy/nginx.conf.example` را در Nginx کپی و نام دامنه نمونه را جایگزین کنید:

```sh
sudo cp /opt/mahzoof/deploy/nginx.conf.example /etc/nginx/sites-available/mahzoof
sudo ln -s /etc/nginx/sites-available/mahzoof /etc/nginx/sites-enabled/mahzoof
sudo nginx -t
sudo systemctl reload nginx
```

سپس برای دامنه گواهی HTTPS بگیرید (برای نمونه با Certbot) و مطمئن شوید مقدارهای زیر در فایل محیطی دقیق‌اند:

```text
APP_ORIGIN=https://panel.your-domain.ir
COOKIE_SECURE=true
```

پس از تغییر فایل محیطی:

```sh
sudo systemctl restart mahzoof
```

## نصب روی موبایل

1. دامنه HTTPS را در Chrome اندروید یا Safari آیفون باز کنید.
2. در اندروید «Install app / افزودن به صفحه اصلی» را بزنید.
3. در آیفون Share سپس «Add to Home Screen» را انتخاب کنید.
4. ورود و عملیات پرونده نیازمند اینترنت است؛ داده محرمانه آفلاین ذخیره نمی‌شود.

## به‌روزرسانی و بکاپ

قبل از هر به‌روزرسانی:

```sh
sudo systemctl stop mahzoof
sudo -u mahzoof env DB_PATH=/var/lib/mahzoof/mahzoof.sqlite node /opt/mahzoof/server/backup.mjs /var/lib/mahzoof/backup-before-update.sqlite
```

بسته جدید را در `/opt/mahzoof` جایگزین کنید، `npm ci --omit=dev` را اجرا و سرویس را بالا بیاورید. فایل `/var/lib/mahzoof/mahzoof.sqlite` را داخل پوشه برنامه یا بسته release قرار ندهید.

```sh
sudo systemctl start mahzoof
sudo systemctl status mahzoof
curl https://panel.your-domain.ir/health
```

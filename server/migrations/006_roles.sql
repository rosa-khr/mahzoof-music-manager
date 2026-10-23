CREATE TABLE roles (
 id INTEGER PRIMARY KEY,
 code TEXT NOT NULL UNIQUE,
 name TEXT NOT NULL,
 name_key TEXT NOT NULL UNIQUE,
 permissions TEXT NOT NULL DEFAULT '[]',
 is_admin INTEGER NOT NULL DEFAULT 0 CHECK(is_admin IN (0,1)),
 version INTEGER NOT NULL DEFAULT 1,
 CHECK((code='admin' AND is_admin=1) OR (code!='admin' AND is_admin=0))
);
INSERT INTO roles(id,code,name,name_key,is_admin) VALUES(1,'admin','مدیر','مدیر',1),(2,'secretary','منشی','منشی',0),(3,'accountant','حسابدار','حسابدار',0);
ALTER TABLE users ADD COLUMN role_id INTEGER REFERENCES roles(id);
UPDATE users SET role_id=(SELECT id FROM roles WHERE code=users.role);

ALTER TABLE roles ADD COLUMN active INTEGER NOT NULL DEFAULT 1
 CHECK(active IN (0,1) AND (is_admin=0 OR active=1));

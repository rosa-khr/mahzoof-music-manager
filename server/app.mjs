import { dateInZone } from "./dates.mjs";
import express from "express";
import helmet from "helmet";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { installAuth } from "./auth.mjs";
import { installMenuAccess } from "./permissions.mjs";
import { installRoles } from "./roles.mjs";
import { installUsers } from "./users.mjs";
import { installEducation, counters } from "./education.mjs";
import { installFinance } from "./finance.mjs";
import { installBaseData } from "./base-data.mjs";
import { installSubjects } from "./subjects.mjs";
import { installInstructorPhotos } from "./instructor-photos.mjs";
import { installSimplifiedFlow } from "./simplified-flow.mjs";
import { installPrivateDocuments } from './private-documents.mjs';
import { installTermAmendments } from './term-amendments.mjs';
import { installLearningPaths } from './learning-paths.mjs';
import { one, all } from "./db.mjs";
export function createApp(
  db,
  { origin = process.env.APP_ORIGIN || "http://localhost:4200" } = {},
) {
  const app = express();
  app.disable("x-powered-by");
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: { imgSrc: ["'self'", "data:", "blob:"] },
      },
    }),
  );
  app.use(express.json({ limit: "64kb" }));
  app.get("/health", (_req, res) => res.json({ ok: !!one(db, "SELECT 1") }));
  installAuth(app, db, origin);
  installMenuAccess(app);
  installRoles(app, db);
  app.get("/api/session-status-options", (req, res) =>
    res.json({
      items: all(db, "SELECT code,name FROM session_statuses ORDER BY id"),
    }),
  );
  installPrivateDocuments(app, db);
  installLearningPaths(app, db);
  installEducation(app, db);
  installFinance(app, db);
  installBaseData(app, db);
  installSubjects(app, db);
  installInstructorPhotos(app, db);
  installSimplifiedFlow(app, db);
  installTermAmendments(app, db);
  app.get("/api/today", (req, res) => {
    const out = {};
    if (req.user.education && req.user.permissions.includes("/students")) {
      const today = dateInZone();
      const rows = all(
        db,
        "SELECT a.id,a.status,a.version,s.starts_at,s.timezone,st.id student_term_id,e.student_id,su.first_name,su.last_name,COALESCE(i.name,sb.name) subject FROM attendance a JOIN sessions s ON s.id=a.session_id JOIN student_terms st ON st.id=a.student_term_id JOIN enrollments e ON e.id=st.enrollment_id JOIN class_offerings c ON c.id=(SELECT offering_id FROM terms WHERE id=st.term_id) JOIN students su ON su.id=e.student_id LEFT JOIN subjects sb ON sb.id=e.subject_id LEFT JOIN instruments i ON i.id=COALESCE(c.instrument_id,e.instrument_id) WHERE a.status='reserved' ORDER BY s.starts_at",
      );
      out.today = rows.filter((r) => dateInZone(r.starts_at) === today);
      out.pending = rows.filter((r) => Date.parse(r.starts_at) < Date.now());
      out.actionTerms = all(
        db,
        "SELECT st.id,st.status,e.student_id,s.first_name,s.last_name,COALESCE(i.name,sb.name) subject FROM student_terms st JOIN enrollments e ON e.id=st.enrollment_id JOIN class_offerings c ON c.id=(SELECT offering_id FROM terms WHERE id=st.term_id) JOIN students s ON s.id=e.student_id LEFT JOIN subjects sb ON sb.id=e.subject_id LEFT JOIN instruments i ON i.id=COALESCE(c.instrument_id,e.instrument_id) WHERE NOT EXISTS(SELECT 1 FROM student_terms next WHERE next.renewed_from=st.id)",
      )
        .map((t) => ({ ...t, counters: counters(db, t.id) }))
        .filter((t) => t.counters.remaining <= 1);
      out.activeStudents = one(
        db,
        "SELECT COUNT(*) n FROM students WHERE status='active'",
      ).n;
    }
    if (req.user.finance)
      out.debts = all(
        db,
        "SELECT i.currency,SUM(i.base_minor-i.discount_minor-COALESCE((SELECT SUM(a.amount_minor) FROM payment_allocations a JOIN payments p ON p.id=a.payment_id WHERE a.invoice_id=i.id AND p.status='confirmed'),0)) amount_minor FROM invoices i GROUP BY i.currency",
      );
    res.json(out);
  });
  installUsers(app, db);
  app.use("/api", (_req, res) =>
    res.status(404).json({ error: "مسیر API یافت نشد" }),
  );
  const web = resolve("dist/mahzoof/browser");
  if (existsSync(web)) {
    app.use(express.static(web, { index: false }));
    app.get("/{*path}", (req, res) => {
      if (req.path.includes(".")) return res.sendStatus(404);
      res.sendFile(resolve(web, "index.html"));
    });
  }
  app.use((err, req, res, _next) => {
    const status =
      err.status || (((err.errcode || 0) & 255) === 19 ? 409 : 500);
    if (status === 500) console.error(err);
    res.status(status).json({
      error:
        status === 500
          ? "خطای سرور؛ دوباره تلاش کنید"
          : status === 409 && !err.status
            ? "رکورد تکراری یا ناسازگار است"
            : err.message,
    });
  });
  return app;
}

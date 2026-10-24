import multer from "multer";
import sharp from "sharp";
import { randomUUID } from "node:crypto";
import { all, one, run, transaction, audit } from "./db.mjs";
import { ApiError, assert, integer } from "./validation.mjs";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 0, parts: 1 },
}).single("photo");

function parseUpload(req, res, next) {
  upload(req, res, (error) => {
    if (!error) return next();
    next(
      new ApiError(
        422,
        error.code === "LIMIT_FILE_SIZE"
          ? "حجم عکس باید حداکثر ۵ مگابایت باشد"
          : "فایل عکس نامعتبر است",
      ),
    );
  });
}

async function imageBuffer(file) {
  assert(file, "عکس مدرس انتخاب نشده است");
  assert(
    ["image/jpeg", "image/png", "image/webp"].includes(file.mimetype),
    "عکس باید JPG، PNG یا WebP باشد",
  );
  try {
    const image = sharp(file.buffer, { limitInputPixels: 16_000_000, failOn: "warning" });
    const metadata = await image.metadata();
    assert(["jpeg", "png", "webp"].includes(metadata.format) && !(metadata.pages > 1), "فقط عکس ثابت JPG، PNG یا WebP مجاز است");
    return await image.rotate().resize({ width: 800, height: 800, fit: "inside", withoutEnlargement: true }).webp({ quality: 85 }).toBuffer();
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(422, "عکس قابل خواندن نیست یا ابعاد آن بیش از ۱۶ مگاپیکسل است");
  }
}

export function installInstructorPhotos(app, db) {
  app.get("/api/instructors/instrument-options", (req, res) => {
    const instructorId = req.query.instructorId === undefined
      ? 0
      : integer(req.query.instructorId, "مدرس", 1);
    if (instructorId)
      assert(one(db, "SELECT 1 FROM instructors WHERE id=?", instructorId), "مدرس یافت نشد", 404);
    res.json({
      items: all(db,
        "SELECT id,name AS value FROM instruments WHERE status='active' OR EXISTS (SELECT 1 FROM instructor_instruments WHERE instructor_id=? AND instrument_id=instruments.id) ORDER BY name",
        instructorId,
      ),
    });
  });
  app.get("/api/instructors/:id/photo", (req, res) => {
    const id = integer(req.params.id, "مدرس");
    const photo = one(db, "SELECT data FROM instructor_photos WHERE instructor_id=?", id);
    assert(photo, "عکسی برای مدرس ثبت نشده است", 404);
    res.set({
      "Cache-Control": "private, no-store",
      Pragma: "no-cache",
      "Content-Type": "image/webp",
      "Content-Disposition": `inline; filename=\"instructor-${id}.webp\"`,
      Vary: "Cookie",
    }).send(Buffer.from(photo.data));
  });

  app.post("/api/instructors/:id/photo", parseUpload, async (req, res) => {
    const id = integer(req.params.id, "مدرس");
    assert(one(db, "SELECT 1 FROM instructors WHERE id=?", id), "مدرس یافت نشد", 404);
    const photo = await imageBuffer(req.file);
    transaction(db, () => {
      run(
        db,
        "INSERT INTO instructor_photos(instructor_id,data,revision) VALUES(?,?,?) ON CONFLICT(instructor_id) DO UPDATE SET data=excluded.data,revision=excluded.revision,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')",
        id,
        photo,
        randomUUID(),
      );
      audit(db, req.user, "instructor-photo-updated", id, {});
    });
    const revision = one(db, "SELECT revision FROM instructor_photos WHERE instructor_id=?", id).revision;
    res.json({ photo_url: `api/instructors/${id}/photo?v=${revision}` });
  });

  app.delete("/api/instructors/:id/photo", (req, res) => {
    const id = integer(req.params.id, "مدرس");
    assert(one(db, "SELECT 1 FROM instructors WHERE id=?", id), "مدرس یافت نشد", 404);
    transaction(db, () => {
      run(db, "DELETE FROM instructor_photos WHERE instructor_id=?", id);
      audit(db, req.user, "instructor-photo-deleted", id, {});
    });
    res.json({ ok: true });
  });
}

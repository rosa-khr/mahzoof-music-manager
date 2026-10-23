import { one, run } from './db.mjs';
import { assert, text } from './validation.mjs';
import { hashToken } from './auth.mjs';
export function requestReplay(db, req, scope, body = req.body) {
  const key = req.headers['idempotency-key'];
  if (!key) return null; // Preserve clients using the original API contract.
  text(key, 'شناسه درخواست', 100, true);
  assert(key.length >= 16, 'شناسه درخواست کوتاه است');
  const hash = hashToken(JSON.stringify(body));
  const old = one(db, 'SELECT * FROM workflow_requests WHERE request_key=?', key);
  if (old) assert(old.scope === scope && old.request_hash === hash && old.actor_id === req.user.id, 'شناسه درخواست با محتوای متفاوت استفاده شده است', 409);
  return { key, hash, targetId: old?.target_id };
}
export function saveRequest(db, req, replay, scope, id) {
  if (replay) run(db, 'INSERT INTO workflow_requests(request_key,scope,request_hash,target_id,actor_id) VALUES(?,?,?,?,?)', replay.key, scope, replay.hash, id, req.user.id);
}

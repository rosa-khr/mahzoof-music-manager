import { one, all, run, transaction, audit } from './db.mjs';
import { requireRole } from './auth.mjs';
import { assert, integer, text } from './validation.mjs';
import { calculateTuition } from './tuition.mjs';
import { financial, termView } from './education.mjs';
export function installTermAmendments(app,db) {
  app.patch('/api/terms/:id/tuition',(req,res)=> {
    requireRole(req,['admin']);
    const id=integer(req.params.id,'ترم'),b=req.body;
    transaction(db,()=> {
      const old=termView(db,id,req.user.role),invoice=old.invoice;
      assert(old.workflow_version>=3,'اصلاح این سابقه از گردش قدیمی انجام می‌شود');
      assert(old.version===integer(b.version,'نسخه'),'ترم تغییر کرده است؛ تازه‌سازی کنید',409);
      assert(invoice.allocated_minor===0,'دریافت ثبت‌شده ابتدا باید با دلیل و مجوز ابطال شود؛ مبلغ ترم تسویه‌شده خودکار تغییر نمی‌کند',409);
      const reason=text(b.reason,'دلیل اصلاح',1000,true);
      const quote=calculateTuition({...b,currency:invoice.currency});
      if(quote.net===0)assert(b.confirmZero===true,'شهریه صفر نیازمند تأیید مدیر است');
      assert(quote.quota >= (old.counters?.consumed || 0)+(old.counters?.reserved || 0),'سهم جدید از مصرف و رزرو فعلی کمتر است');
      const shared=one(db,'SELECT COUNT(*) n FROM student_terms WHERE term_id=?',old.term_id).n>1;
      assert(!shared || quote.duration===old.duration_minutes,'مدت کلاس گروهی در پرونده یک عضو قابل تغییر نیست');
      assert(!(old.sessions||[]).some(s=>s.status!=='reserved') || quote.duration===old.duration_minutes,'مدت توافق‌شده پس از ثبت نتیجه جلسات تغییر نمی‌کند؛ ترم جدید بسازید');
      run(db,'UPDATE student_terms SET quota=?,base_rate_minor_30=?,discount_type=?,discount_value=?,version=version+1 WHERE id=?',quote.quota,quote.rate,quote.discountType,quote.discountValue,id);
      run(db,'UPDATE terms SET duration_minutes=? WHERE id=?',quote.duration,old.term_id);
      run(db,'UPDATE invoices SET base_minor=?,discount_minor=?,reason=?,settlement_type=? WHERE id=?',quote.gross,quote.discount,reason,quote.net?'single':'free',invoice.id);
      audit(db,req.user,'term-tuition-amended',id,{reason,before:{rate:old.base_rate_minor_30,duration:old.duration_minutes,quota:old.quota,total:invoice.total_minor,discount:invoice.discount_minor},after:quote});
    });res.json(termView(db,id,req.user.role));
  });
  app.post('/api/payments/:id/void',(req,res)=> {
    requireRole(req,['admin']);const id=integer(req.params.id,'دریافت'),reason=text(req.body.reason,'دلیل ابطال',1000,true);
    transaction(db,()=> {
      const payment=one(db,'SELECT * FROM payments WHERE id=?',id);assert(payment,'دریافت یافت نشد',404);assert(payment.status==='confirmed','دریافت قبلاً باطل شده است',409);
      run(db,"UPDATE payments SET status='voided' WHERE id=?",id);
      run(db,"UPDATE full_tuition_receipts SET voided_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'),void_reason=?,void_actor_id=? WHERE payment_id=?",reason,req.user.id,id);
      audit(db,req.user,'payment-voided',id,{reason,amount:payment.amount_minor,currency:payment.currency});
    });res.json({ok:true});
  });
  app.get('/api/students/:id/workflow-history',(req,res)=> {
    requireRole(req,['admin']);const studentId=integer(req.params.id,'هنرجو');
    const rows=all(db,"SELECT id,action,target,summary,created_at FROM audit_log WHERE (action LIKE 'term-%' AND target IN (SELECT CAST(st.id AS TEXT) FROM student_terms st JOIN enrollments e ON e.id=st.enrollment_id WHERE e.student_id=?)) OR (action IN ('payment-voided','full-tuition-received') AND target IN (SELECT CAST(id AS TEXT) FROM payments WHERE student_id=?)) ORDER BY id DESC LIMIT 100",studentId,studentId);
    res.json({items:rows});
  });
}

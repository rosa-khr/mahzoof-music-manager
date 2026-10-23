import { all, one, run, transaction, audit } from './db.mjs';
import { requireRole } from './auth.mjs';
import { assert, integer, choice, text, timezone, date, money } from './validation.mjs';
import { educationSelection } from './student-workflow.mjs';
import { dateInZone } from './dates.mjs';
import { localToInstant } from '../shared/class-time.js';
import { hashToken } from './auth.mjs';

function validatedSchedules(body) {
  assert(Array.isArray(body.schedules) && body.schedules.length<=14,'برنامه هفتگی نامعتبر است');
  const rows=body.schedules.map(row=>({weekday:integer(row.weekday,'روز هفته',0,6),startTime:text(row.startTime,'ساعت شروع',5,true),durationMinutes:integer(row.durationMinutes||body.durationMinutes||30,'مدت جلسه',1,1440),timezone:timezone(row.timezone||body.timezone||'Asia/Tehran')}));
  assert(rows.every(row=>/^([01]\d|2[0-3]):[0-5]\d$/.test(row.startTime)),'ساعت شروع نامعتبر است');
  assert(new Set(rows.map(r=>r.weekday+':'+r.startTime)).size===rows.length,'نوبت هفتگی تکراری است');return rows;
}
export function installLearningPaths(app,db) {
  app.get('/api/students/duplicate-options',(req,res)=> {
    requireRole(req,['admin','secretary']);
    const first=text(req.query.firstName,'نام',100),last=text(req.query.lastName,'نام خانوادگی',100);
    if(!first||!last)return res.json({items:[]});
    res.json({items:all(db,'SELECT id,code,first_name,last_name,phone FROM students WHERE first_name=? AND last_name=? LIMIT 20',first,last)});
  });
  app.get('/api/students/group-options',(req,res)=> {
    requireRole(req,['admin','secretary']);
    res.json({items:all(db,"SELECT st.id,st.term_id,st.quota,c.instrument_id,c.instructor_id,c.teaching_type_id,c.academy_id,c.mode,c.teacher,t.duration_minutes,t.start_date,t.end_date,i.name subject FROM student_terms st JOIN terms t ON t.id=st.term_id JOIN class_offerings c ON c.id=t.offering_id JOIN instruments i ON i.id=c.instrument_id WHERE c.structure='group' AND st.status IN ('current','planned') GROUP BY st.term_id ORDER BY st.id DESC").map(g=>({...g,schedules:all(db,'SELECT weekday,start_time,duration_minutes,timezone FROM term_schedules WHERE student_term_id=?',g.id)}))});
  });
  app.post('/api/students/:id/enrollments',(req,res)=> {
    requireRole(req,['admin','secretary']);
    const studentId=integer(req.params.id,'هنرجو'),instrumentId=integer(req.body.instrumentId,'ساز');
    assert(one(db,'SELECT 1 FROM students WHERE id=?',studentId),'هنرجو یافت نشد',404);
    assert(one(db,"SELECT 1 FROM instruments WHERE id=? AND status='active'",instrumentId),'ساز فعال را انتخاب کنید');
    const id=transaction(db,()=> {
      assert(!one(db,'SELECT 1 FROM enrollments WHERE student_id=? AND instrument_id=?',studentId,instrumentId),'این مسیر آموزشی قبلاً ثبت شده است؛ ترم جدید بسازید',409);
      const policy=one(db,"SELECT id FROM registration_policies WHERE status='published' AND effective_on<=? ORDER BY effective_on DESC,version DESC LIMIT 1",dateInZone());
      const id=Number(run(db,'INSERT INTO enrollments(student_id,instrument_id,policy_id) VALUES(?,?,?)',studentId,instrumentId,policy?.id||null).lastInsertRowid);
      audit(db,req.user,'learning-path-created',id,{studentId,instrumentId});return id;
    });res.status(201).json({id});
  });
  app.patch('/api/enrollments/:id/settings',(req,res)=> {
    requireRole(req,['admin','secretary']);
    const id=integer(req.params.id,'مسیر'),b=req.body;
    const enrollment=one(db,'SELECT * FROM enrollments WHERE id=?',id);assert(enrollment?.instrument_id,'مسیر ساز مستقل را انتخاب کنید');
    const old=one(db,'SELECT * FROM enrollment_settings WHERE enrollment_id=?',id);
    assert((old?.version||0)===integer(b.version??0,'نسخه',0),'تنظیمات مسیر تغییر کرده است',409);
    const selection=educationSelection(db,{...b,instrumentId:enrollment.instrument_id},{paymentRequired:false});
    const duration=integer(b.durationMinutes||30,'مدت جلسه',1,1440),zone=timezone(b.timezone||'Asia/Tehran');
    const rows=validatedSchedules(b),effectiveFrom=date(b.effectiveFrom,true);
    assert(effectiveFrom>=dateInZone(),'تاریخ تغییر برنامه نباید در گذشته باشد');
    const group=one(db,"SELECT 1 FROM student_terms st JOIN terms t ON t.id=st.term_id JOIN class_offerings c ON c.id=t.offering_id WHERE st.enrollment_id=? AND c.structure='group' AND st.status IN ('current','planned')",id);
    assert(!group,'برنامه این مسیر از کلاس گروهی مشترک خوانده می‌شود؛ ویرایش فردی مجاز نیست');
    const future=all(db,"SELECT s.*,a.id attendance_id,a.version attendance_version FROM sessions s JOIN attendance a ON a.session_id=s.id JOIN student_terms st ON st.id=a.student_term_id WHERE st.enrollment_id=? AND a.status='reserved' AND s.starts_at>? ORDER BY s.starts_at",id,new Date().toISOString()).filter(s=>dateInZone(s.starts_at,s.timezone)>=effectiveFrom);
    const affected=future.map(s=> {
      const day=dateInZone(s.starts_at,s.timezone), weekday=new Date(day+'T00:00:00Z').getUTCDay();
      const row=rows.find(r=>r.weekday===weekday);
      return {id:s.id,attendanceId:s.attendance_id,version:s.attendance_version,before:s.starts_at,after:row?localToInstant(day,row.startTime,row.timezone):null,timezone:row?.timezone||s.timezone};
    });
    const token=hashToken(JSON.stringify({id,rows,effectiveFrom,affected}));
    if(b.preview===true)return res.json({affected,token});
    if(b.moveFuture===true) {
      assert(b.previewToken===token,'رزروها تغییر کرده‌اند؛ ابتدا دوباره بازبینی کنید',409);
      assert(affected.every(r=>r.after),'برای بعضی رزروها نوبت متناظر وجود ندارد؛ آن‌ها را جداگانه ویرایش کنید');
    }
    let toman=old?.rate_toman_30??null,usd=old?.rate_usd_cents_30??null;
    if(b.rateToman30!==undefined||b.rateUsd30!==undefined) {
      const nextToman=b.rateToman30===''?null:money(b.rateToman30,'TOMAN'),nextUsd=b.rateUsd30===''?null:money(b.rateUsd30,'USD');
      if(nextToman!==toman||nextUsd!==usd){requireRole(req,['admin']);text(b.reason,'دلیل نرخ اختصاصی',1000,true);}
      toman=nextToman;usd=nextUsd;
    }
    transaction(db,()=> {
      run(db,'INSERT INTO enrollment_settings(enrollment_id,instructor_id,teaching_type_id,academy_id,mode,structure,duration_minutes,timezone,rate_toman_30,rate_usd_cents_30) VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(enrollment_id) DO UPDATE SET instructor_id=excluded.instructor_id,teaching_type_id=excluded.teaching_type_id,academy_id=excluded.academy_id,mode=excluded.mode,structure=excluded.structure,duration_minutes=excluded.duration_minutes,timezone=excluded.timezone,rate_toman_30=excluded.rate_toman_30,rate_usd_cents_30=excluded.rate_usd_cents_30,version=version+1',id,selection.instructorId,selection.teachingTypeId,selection.academyId,selection.mode,choice(b.structure||'private',['private','group'],'نوع کلاس'),duration,zone,toman,usd);
      run(db,'UPDATE weekly_schedules SET active=0,version=version+1 WHERE enrollment_id=? AND active=1',id);
      for(const row of rows)run(db,'INSERT INTO weekly_schedules(enrollment_id,weekday,start_time,duration_minutes,timezone,effective_from) VALUES(?,?,?,?,?,?)',id,row.weekday,row.startTime,row.durationMinutes,row.timezone,effectiveFrom);
      if(b.moveFuture===true)for(const row of affected){assert(one(db,'SELECT COUNT(*) n FROM attendance WHERE session_id=?',row.id).n===1,'رزرو گروهی از پرونده فردی جابه‌جا نمی‌شود');run(db,'UPDATE sessions SET starts_at=?,timezone=? WHERE id=?',row.after,row.timezone,row.id);run(db,'UPDATE attendance SET version=version+1 WHERE id=?',row.attendanceId);}
      audit(db,req.user,'learning-path-settings-updated',id,{before:old,after:{duration,zone,toman,usd},reason:b.reason||'',effectiveFrom,moved:b.moveFuture?affected:[]});
    });res.json({ok:true});
  });
}

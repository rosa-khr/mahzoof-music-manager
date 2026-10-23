import multer from 'multer';
import sharp from 'sharp';
import { randomUUID } from 'node:crypto';
import { chromium } from 'playwright-core';
import { all, one, run, transaction, audit } from './db.mjs';
import { assert, integer, text, choice, ApiError } from './validation.mjs';
import { requireRole } from './auth.mjs';

const upload = multer({storage:multer.memoryStorage(),limits:{fileSize:8*1024*1024,files:1,fields:5}}).single('file');
const parse = (req,res,next)=>upload(req,res,error=>next(error ? new ApiError(422,'فایل باید حداکثر ۸ مگابایت باشد') : undefined));
let activePdfs = 0;

export function installPrivateDocuments(app,db) {
  app.get('/api/students/:id/documents', (req,res)=> {
    const studentId=integer(req.params.id,'هنرجو');
    assert(req.user.education || req.user.finance,'دسترسی مجاز نیست',403);
    res.json({items:all(db,`SELECT id,student_id,student_term_id,payment_id,kind,name,mime,created_at FROM private_documents WHERE student_id=? AND kind IN (${req.user.education && req.user.finance ? "'signed_registration','receipt'" : req.user.education ? "'signed_registration'" : "'receipt'"}) ORDER BY id DESC`,studentId)});
  });
  app.post('/api/students/:id/documents',parse,async(req,res)=> {
    const studentId=integer(req.params.id,'هنرجو'),kind=choice(req.body.kind,['signed_registration','receipt'],'نوع سند');
    assert(kind==='receipt'?req.user.finance:req.user.education,'دسترسی مجاز نیست',403);
    assert(one(db,'SELECT 1 FROM students WHERE id=?',studentId),'هنرجو یافت نشد',404);
    assert(req.file,'فایل را انتخاب کنید');
    let data=req.file.buffer,mime=req.file.mimetype;
    if(mime==='application/pdf') assert(data.subarray(0,5).toString()==='%PDF-','فایل PDF نامعتبر است');
    else {
      assert(['image/jpeg','image/png','image/webp'].includes(mime),'فقط PDF یا تصویر ثابت مجاز است');
      try {
        const image=sharp(data,{limitInputPixels:20000000});
        const meta=await image.metadata();assert(!(meta.pages>1),'تصویر متحرک مجاز نیست');
        data=await image.rotate().resize({width:2400,height:3400,fit:'inside',withoutEnlargement:true}).webp({quality:90}).toBuffer();mime='image/webp';
      } catch {throw new ApiError(422,'تصویر قابل خواندن نیست');}
    }
    const termId=req.body.termId?integer(req.body.termId,'ترم'):null;
    if(termId) assert(one(db,'SELECT 1 FROM student_terms st JOIN enrollments e ON e.id=st.enrollment_id WHERE st.id=? AND e.student_id=?',termId,studentId),'ترم متعلق به هنرجو نیست');
    const paymentId=req.body.paymentId?integer(req.body.paymentId,'دریافت'):null;
    if(paymentId) assert(one(db,'SELECT 1 FROM payments WHERE id=? AND student_id=?',paymentId,studentId),'دریافت متعلق به هنرجو نیست');
    const name=text(req.file.originalname,'نام فایل',200,true);
    const id=transaction(db,()=> {
      const id=Number(run(db,'INSERT INTO private_documents(student_id,student_term_id,payment_id,kind,name,mime,data,created_by) VALUES(?,?,?,?,?,?,?,?)',studentId,termId,paymentId,kind,name,mime,data,req.user.id).lastInsertRowid);
      audit(db,req.user,'private-document-uploaded',id,{studentId,kind,termId,paymentId});return id;
    });res.status(201).json({id});
  });
  app.get('/api/students/:id/documents/:documentId',(req,res)=> {
    const doc=one(db,'SELECT * FROM private_documents WHERE id=? AND student_id=?',integer(req.params.documentId,'سند'),integer(req.params.id,'هنرجو'));
    assert(doc,'سند یافت نشد',404);
    assert(doc.kind==='receipt'?req.user.finance:req.user.education,'دسترسی مجاز نیست',403);
    res.set({'Content-Type':doc.mime,'Content-Disposition':`attachment; filename="document-${doc.id}.${doc.mime==='application/pdf'?'pdf':'webp'}"`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}).send(Buffer.from(doc.data));
  });
  app.post('/api/settings/letterhead/logo',parse,async(req,res)=> {
    requireRole(req,['admin']);assert(req.file,'لوگو را انتخاب کنید');
    assert(['image/png','image/jpeg','image/webp'].includes(req.file.mimetype),'لوگو باید تصویر باشد');
    let data;
    try {data=await sharp(req.file.buffer,{limitInputPixels:16000000}).rotate().resize({width:1200,height:1600,fit:'inside',withoutEnlargement:true}).png().toBuffer();} catch {throw new ApiError(422,'لوگو قابل خواندن نیست');}
    const revision=randomUUID();
    transaction(db,()=>{run(db,'INSERT INTO letterhead_logo(id,data,revision) VALUES(1,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,revision=excluded.revision',data,revision);run(db,'UPDATE academy_letterhead SET logo_url=?,version=version+1 WHERE id=1','/api/students/letterhead-logo?v='+revision);audit(db,req.user,'letterhead-logo-updated',1,{});});
    res.json({ok:true});
  });
  // Kept under the student permission because it is used by every student print.
  app.get('/api/students/letterhead-logo',(_req,res)=> {
    const logo=one(db,'SELECT data FROM letterhead_logo WHERE id=1');assert(logo,'لوگو یافت نشد',404);
    res.type('png').set('Cache-Control','private, no-store').send(Buffer.from(logo.data));
  });
  app.get('/api/students/:id/registration.pdf',async(req,res)=> {
    assert(req.user.education,'چاپ پرونده نیازمند دسترسی آموزشی است',403);
    assert(activePdfs<2,'تولید PDF در حال انجام است؛ چند لحظه بعد تلاش کنید',429);
    const id=integer(req.params.id,'هنرجو'),termId=req.query.termId?integer(req.query.termId,'ترم'):null;
    assert(one(db,'SELECT 1 FROM students WHERE id=?',id),'هنرجو یافت نشد',404);
    if(termId) assert(one(db,'SELECT 1 FROM student_terms st JOIN enrollments e ON e.id=st.enrollment_id WHERE st.id=? AND e.student_id=?',termId,id),'ترم متعلق به هنرجو نیست');
    let browser;activePdfs++;
    try {
      browser=await chromium.launch({headless:true,...(process.env.PDF_CHROME_PATH?{executablePath:process.env.PDF_CHROME_PATH}:{channel:'chrome'})});
      const base=`http://127.0.0.1:${req.socket.localPort}`;
      const context=await browser.newContext({serviceWorkers:'block'});
      await context.addCookies([{name:'mahzoof_session',value:req.token,url:base,httpOnly:true,sameSite:'Strict'}]);
      await context.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort());
      const page=await context.newPage();
      await page.goto(`${base}/students/${id}/print${termId?'?term='+termId:''}`,{waitUntil:'networkidle',timeout:20000});
      await page.locator('.student-print-sheet').waitFor({timeout:15000});
      await page.evaluate(()=>document.fonts.ready);
      const buffer=await page.pdf({format:'A4',printBackground:true,preferCSSPageSize:true});
      res.type('pdf').set({'Content-Disposition':`attachment; filename="registration-${id}.pdf"`,'Cache-Control':'private, no-store'}).send(buffer);
    } catch {throw new ApiError(503,'تولید PDF ممکن نشد؛ دوباره تلاش کنید یا از چاپ مرورگر استفاده کنید');}
    finally {await browser?.close();activePdfs--;}
  });
}

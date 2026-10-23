import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject } from "@angular/core";
import { ActivatedRoute, RouterLink } from "@angular/router";
import { FormsModule } from "@angular/forms";
import { Api, errorMessage } from "../core/api";
import { Student } from "../core/models";
import { Money, PersianDate } from "../shared/ui";

@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, FormsModule, Money, PersianDate],
  template: `<div class="print-controls no-print">
      <a class="btn btn-light" [routerLink]="['/students', student?.id]">بازگشت به پرونده</a>
      @if (student && student.terms.length > 1) {
        <label>ترم
          <select [(ngModel)]="termId" (change)="loadPrint()">
            @for (term of student.terms; track term.id) { <option [ngValue]="term.id">{{ term.subject }} • ترم {{ term.number }}</option> }
          </select>
        </label>
      }
      <button class="btn btn-primary" [disabled]="!data" (click)="print()">چاپ / ذخیره PDF</button>
      <button class="btn btn-outline-primary" [disabled]="!data || busy" (click)="download()">{{ busy ? 'در حال تولید PDF…' : 'دانلود PDF' }}</button>
    </div>
    @if (error) { <p class="alert alert-danger no-print">{{ error }}</p> }
    @if (data; as d) {
      <article class="student-print-sheet" dir="rtl">
        <header class="print-letterhead">
          <div class="print-letterhead-logo">
            <img [src]="d.letterhead.logo_url" alt="لوگوی آموزشگاه" />
          </div>
          <div class="print-letterhead-title">
            <h1>{{ d.letterhead.name_fa }}</h1>
            @if (visible('name_en')) { <p>{{ d.letterhead.name_en }}</p> }
            @if (visible('subtitle')) { <b>{{ d.letterhead.subtitle }}</b> }
          </div>
          <address class="print-letterhead-contact">
            @if (visible('manager')) { <span><small>مسئول</small><strong>{{ d.letterhead.manager }}</strong></span> }
            @if (visible('phone')) { <span><small>تلفن</small><bdi>{{ d.letterhead.phone }}</bdi></span> }
            @if (visible('mobile')) { <span><small>همراه</small><bdi>{{ d.letterhead.mobile }}</bdi></span> }
            @if (visible('address')) { <span><small>نشانی</small><strong>{{ d.letterhead.address }}</strong></span> }
            @if (visible('website')) { <span><small>وب‌سایت</small><bdi dir="ltr">{{ d.letterhead.website }}</bdi></span> }
            @if (visible('instagram')) { <span><small>اینستاگرام</small><bdi dir="ltr">{{ d.letterhead.instagram }}</bdi></span> }
          </address>
        </header>
        <h2 class="print-document-title">فرم ثبت‌نام و پذیرش قوانین</h2>
        <section>
          <h3>مشخصات هنرجو</h3>
          <div class="print-grid">
          <div><small>نام هنرجو</small><b>{{ d.student.first_name }} {{ d.student.last_name }}</b></div>
          <div><small>کد هنرجویی</small><bdi>{{ d.student.code }}</bdi></div>
          <div><small>تاریخ ثبت‌نام</small><b>{{ d.term.registered_on | persianDate }}</b></div>
          <div><small>راه تماس</small><bdi>{{ d.student.phone || guardian?.phone || "" }}</bdi></div>
          <div><small>سرپرست</small><b>{{ guardian?.name || "" }} {{ guardian?.relationship || "" }}</b></div>
          <div><small>تحصیلات</small><b>{{ d.student.education_level || "" }}</b></div>
          <div><small>سن</small><b>{{ d.student.age == null ? '' : d.student.age + ' سال' }}</b></div>
          <div><small>شناسه</small><bdi>{{ d.student.national_id || '' }}</bdi></div>
          <div class="print-cell-wide"><small>نشانی</small><b>{{ d.student.address || '' }}</b></div>
          <div><small>شیوه آشنایی با آموزشگاه</small><b>{{ d.student.referral_source || "" }}</b></div>
          </div>
        </section>
        <section class="print-term-section"><h3>اطلاعات ساز و مسیر آموزشی</h3>
          @if (d.term.id) {
          <div class="print-grid">
            <div><small>شماره ترم</small><b>ترم {{ d.term.number }}</b></div>
            <div><small>وضعیت ترم</small><b>{{ termStatus(d.term.status) }}</b></div>
            <div><small>تاریخ ثبت ترم</small><b>{{ d.term.registered_on | persianDate }}</b></div>
            <div><small>ساز</small><b>{{ d.term.subject }}</b></div>
            <div><small>مدرس</small><b>{{ d.term.teacher }}</b></div>
            <div><small>شیوه برگزاری</small><b>{{ d.term.teaching_type || (d.term.mode === 'online' ? 'آنلاین' : 'حضوری') }}</b></div>
            <div><small>آموزشگاه / محل</small><b>{{ d.term.mode === 'online' ? 'آنلاین' : (d.term.academy || d.term.location || '—') }}</b></div>
            <div><small>نوع کلاس</small><b>{{ d.term.structure === 'group' ? 'گروهی' : 'خصوصی' }}</b></div>
            <div><small>تعداد جلسات ترم</small><b>{{ d.term.quota }} جلسه</b></div>
            <div><small>مدت هر جلسه</small><b>{{ d.term.duration_minutes }} دقیقه</b></div>
            <div><small>شروع ترم</small><b>{{ d.term.start_date | persianDate }}</b></div>
            <div><small>پایان پیشنهادی</small><b>{{ d.term.end_date | persianDate }}</b></div>
          </div>
          @if (d.schedules.length) {
            <div class="print-schedules"><b>برنامه هفتگی</b>
              @for (row of d.schedules; track row.id) { <p class="print-schedule">{{ scheduleText(row) }}</p> }
            </div>
          }
          } @else {
            <p class="print-empty-term">برای این هنرجو هنوز ساز یا ترمی ثبت نشده است.</p>
          }
          <div class="print-grid print-education-notes">
            <div><small>هدف ثبت‌نام</small><b>{{ d.student.registration_goal || "—" }}</b></div>
            <div><small>پیشینه هنری</small><b>{{ d.student.artistic_history || "—" }}</b></div>
            <div><small>مصاحبه</small><b>{{ d.student.interview_notes || "—" }}</b></div>
          </div>
        </section>
        @if (d.term.invoice; as invoice) {
          <section><h3>شهریه</h3><div class="print-grid">
            <div><small>قبل از تخفیف</small><b>{{ invoice.base_minor | money: invoice.currency }}</b></div>
            <div><small>تخفیف {{ d.term.discount_type === 'percent' ? d.term.discount_value + '٪' : d.term.discount_type === 'fixed' ? 'ثابت' : '' }}</small><b>{{ invoice.discount_minor | money: invoice.currency }}</b></div>
            <div><small>مبلغ نهایی</small><b>{{ invoice.total_minor | money: invoice.currency }}</b></div>
          </div></section>
        }
        <section class="print-policy"><h3>قوانین ثبت‌نام</h3>
          @if (d.policy) { <div [innerHTML]="d.policy.content_html"></div> }
          @else { <p>نسخه منتشرشده قوانین برای این ثبت‌نام ثبت نشده است.</p> }
          <p>اینجانب با مطالعه متن بالا، پذیرش قوانین ثبت‌نام را اعلام می‌کنم.</p>
        </section>
        <footer class="signature-grid">
          <div>نام هنرجو یا سرپرست:<br /><br />تاریخ:<br /><br />امضا:</div>
          <div>نام مسئول آموزشگاه:<br /><br />تاریخ:<br /><br />امضا و مهر:</div>
        </footer>
      </article>
    }`,
})
export class StudentPrint {
  api=inject(Api); route=inject(ActivatedRoute); cdr=inject(ChangeDetectorRef);
  student: Student | null=null; termId=0; data:any=null; error=""; busy=false;
  weekdays=["یکشنبه","دوشنبه","سه‌شنبه","چهارشنبه","پنجشنبه","جمعه","شنبه"];
  constructor(){void this.load();}
  get guardian(){return this.data?.guardians?.[0];}
  visible(key:string){return this.data?.letterhead.visible_fields.includes(key);}
  termStatus(status:string){return ({planned:'برنامه‌ریزی‌شده',current:'جاری',completed:'تکمیل‌شده',paused:'متوقف‌شده',cancelled:'لغوشده'} as Record<string,string>)[status]||status;}
  async load(){try{this.student=await this.api.get<Student>(`/students/${this.route.snapshot.paramMap.get('id')}`);this.termId=Number(this.route.snapshot.queryParamMap.get('term'))||this.student.terms[0]?.id||0;await this.loadPrint();}catch(e){this.error=errorMessage(e);}this.cdr.markForCheck();}
  async loadPrint(){if(!this.student)return;try{this.data=await this.api.get(`/students/${this.student.id}/print-data${this.termId?`?termId=${this.termId}`:""}`);this.error="";}catch(e){this.error=errorMessage(e);}this.cdr.markForCheck();}
  scheduleText(row:any){const [h,m]=row.start_time.split(':').map(Number), total=h*60+m+row.duration_minutes, end=`${String(Math.floor(total/60)%24).padStart(2,'0')}:${String(total%60).padStart(2,'0')}`;return `${this.weekdays[row.weekday]}، ${row.start_time} تا ${end}، مدت ${row.duration_minutes} دقیقه (${row.timezone})${total>=1440?'، پایان در روز بعد':''}`;}
  print(){window.print();}
  async download(){if(!this.student||this.busy)return;this.busy=true;this.error='';try{const file=await this.api.file(`/students/${this.student.id}/registration.pdf${this.termId?'?termId='+this.termId:''}`);const url=URL.createObjectURL(file);const link=document.createElement('a');link.href=url;link.download=`registration-${this.student.code}.pdf`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(e){this.error='تولید PDF انجام نشد؛ دوباره تلاش کنید. پرونده ذخیره‌شده محفوظ است.';}finally{this.busy=false;this.cdr.markForCheck();}}
}

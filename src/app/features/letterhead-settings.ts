import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject } from "@angular/core";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { Api, errorMessage } from "../core/api";
import { Field, PageHeader } from "../shared/ui";

interface Letterhead {
  version: number; name_fa: string; name_en: string; manager: string; phone: string;
  mobile: string; address: string; website: string; instagram: string; subtitle: string;
  visible_fields: string[]; logo_url: string;
}
@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, Field, PageHeader],
  template: `<app-header title="مشخصات و سربرگ" subtitle="یک منبع مشترک برای همه چاپ‌ها" />
    @if (error) { <p class="alert alert-danger">{{ error }}</p> }
    @if (message) { <p class="alert alert-success">{{ message }}</p> }
    <div class="settings-grid">
      <form class="card" [formGroup]="form" (ngSubmit)="save()">
        <div class="form-grid">
          <app-field><input id="lh-fa" formControlName="nameFa" /><label for="lh-fa">نام فارسی *</label></app-field>
          <app-field><input id="lh-en" formControlName="nameEn" dir="ltr" /><label for="lh-en">نام انگلیسی</label></app-field>
          <app-field><input id="lh-manager" formControlName="manager" /><label for="lh-manager">مسئول</label></app-field>
          <app-field><input id="lh-phone" formControlName="phone" dir="ltr" /><label for="lh-phone">تلفن ثابت</label></app-field>
          <app-field><input id="lh-mobile" formControlName="mobile" dir="ltr" /><label for="lh-mobile">تلفن همراه</label></app-field>
          <app-field><input id="lh-website" formControlName="website" dir="ltr" /><label for="lh-website">وب‌سایت</label></app-field>
          <app-field><input id="lh-instagram" formControlName="instagram" dir="ltr" /><label for="lh-instagram">اینستاگرام</label></app-field>
          <app-field><input id="lh-subtitle" formControlName="subtitle" /><label for="lh-subtitle">زیرعنوان</label></app-field>
        </div>
        <app-field><textarea id="lh-address" formControlName="address"></textarea><label for="lh-address">نشانی</label></app-field>
        <fieldset class="check-list"><legend>موارد قابل نمایش</legend>
          @for (item of fields; track item.key) { <label><input type="checkbox" [checked]="visible(item.key)" (change)="toggle(item.key, $event)" />{{ item.label }}</label> }
        </fieldset>
        <button class="btn btn-primary" [disabled]="busy">ذخیره تنظیمات</button>
        <label class="btn btn-light">انتخاب لوگو<input type="file" class="visually-hidden" accept="image/png,image/jpeg,image/webp" (change)="uploadLogo($event)" /></label>
      </form>
      <section class="card letterhead-preview" aria-label="پیش‌نمایش سربرگ">
        <img [src]="(data?.logo_url || 'brand/mahzoof-logo-transparent.png').replace('/', '')" alt="لوگوی آموزشگاه" />
        <div><h2>{{ form.controls.nameFa.value }}</h2><p>{{ form.controls.nameEn.value }}</p><p>{{ form.controls.subtitle.value }}</p></div>
        <address>{{ form.controls.address.value }}<br />{{ form.controls.phone.value }} • {{ form.controls.mobile.value }}</address>
      </section>
    </div>`,
})
export class LetterheadSettings {
  api = inject(Api); cdr = inject(ChangeDetectorRef); fb = inject(FormBuilder);
  data: Letterhead | null = null; busy = false; error = ""; message = "";
  fields = [{key:"name_en",label:"نام انگلیسی"},{key:"manager",label:"مسئول"},{key:"phone",label:"تلفن ثابت"},{key:"mobile",label:"تلفن همراه"},{key:"address",label:"نشانی"},{key:"website",label:"وب‌سایت"},{key:"instagram",label:"اینستاگرام"},{key:"subtitle",label:"زیرعنوان"}];
  form = this.fb.nonNullable.group({ nameFa:["",Validators.required],nameEn:"",manager:"",phone:"",mobile:"",address:"",website:"",instagram:"",subtitle:"",visibleFields:[[] as string[]] });
  constructor() { void this.load(); }
  async load() { try { this.data = await this.api.get<Letterhead>("/settings/letterhead"); const d=this.data; this.form.patchValue({nameFa:d.name_fa,nameEn:d.name_en,manager:d.manager,phone:d.phone,mobile:d.mobile,address:d.address,website:d.website,instagram:d.instagram,subtitle:d.subtitle,visibleFields:d.visible_fields}); } catch(e){this.error=errorMessage(e);} this.cdr.markForCheck(); }
  visible(key:string){return this.form.controls.visibleFields.value.includes(key);}
  toggle(key:string,event:Event){const checked=(event.target as HTMLInputElement).checked; const next=new Set(this.form.controls.visibleFields.value); checked?next.add(key):next.delete(key); this.form.controls.visibleFields.setValue([...next]);}
  async save(){if(!this.data||this.form.invalid||this.busy)return;this.busy=true;this.error="";try{const v=this.form.getRawValue();this.data=await this.api.patch<Letterhead>("/settings/letterhead",{...v,version:this.data.version});this.message="تنظیمات سربرگ ذخیره شد.";}catch(e){this.error=errorMessage(e);}finally{this.busy=false;this.cdr.markForCheck();}}
  async uploadLogo(event:Event){const input=event.target as HTMLInputElement,file=input.files?.[0];input.value='';if(!file)return;this.busy=true;try{const body=new FormData();body.append('file',file);await this.api.post('/settings/letterhead/logo',body);await this.load();this.message='لوگو ذخیره شد.';}catch(e){this.error=errorMessage(e);}finally{this.busy=false;this.cdr.markForCheck();}}
}

import { Component, Input, Output, EventEmitter, inject, ChangeDetectionStrategy, ChangeDetectorRef, OnInit } from '@angular/core';
import { ReactiveFormsModule, FormBuilder } from '@angular/forms';
import { Api, errorMessage } from '../core/api';
import { Student } from '../core/models';
import { EducationFields, EducationOptions, educationControls, emptyEducationOptions } from '../shared/education-fields';
import { Field, jalaliToday, toIso, PersianDate } from '../shared/ui';
import { Select2 } from '../shared/select2';
import { Datepicker } from '../shared/datepicker';
import { Switch } from '../shared/switch';
import { endTime } from '../../../shared/class-time.js';
import { DataGrid } from '../shared/data-grid';
import { ColDef } from 'ag-grid-community';

@Component({
  selector:'app-learning-path-editor',standalone:true,changeDetection:ChangeDetectionStrategy.OnPush,
  imports:[ReactiveFormsModule,EducationFields,Field,Select2,Datepicker,Switch,DataGrid],
  template:`<section class="card action-panel"><h2>{{ path ? 'برنامه و پیش‌فرض‌های مسیر '+path.subject : 'ثبت‌نام آموزشی جدید' }}</h2>
    <form [formGroup]="form" (ngSubmit)="save()">
      @if (!path) {<app-field><select appSelect2 id="path-instrument" formControlName="instrumentId"><option value="">انتخاب کنید</option>@for (item of options.instruments;track item.id){<option [value]="item.id">{{item.name}}</option>}</select><label for="path-instrument">ساز / واحد آموزشی *</label></app-field>}
      @else {
        <app-education-fields [group]="form" [options]="options" [paymentRequired]="false" />
        <div class="form-grid">
          <app-field><input id="path-duration" formControlName="durationMinutes" inputmode="numeric" /><label for="path-duration">مدت توافق‌شده پیش‌فرض</label></app-field>
          <app-field><input id="path-zone" formControlName="timezone" dir="ltr" /><label for="path-zone">منطقه زمانی IANA</label></app-field>
          <app-field><input id="path-effective" appDatepicker formControlName="effectiveFrom" dir="ltr" /><label for="path-effective">اعمال برنامه از تاریخ</label></app-field>
          @if (api.user()?.admin) {
            <app-field><input id="path-rate-toman" formControlName="rateToman30" inputmode="numeric" /><label for="path-rate-toman">نرخ اختصاصی ۳۰ دقیقه (تومان)</label></app-field>
            <app-field><input id="path-rate-usd" formControlName="rateUsd30" inputmode="decimal" /><label for="path-rate-usd">نرخ اختصاصی ۳۰ دقیقه (دلار)</label></app-field>
            <app-field><input id="path-rate-reason" formControlName="reason" /><label for="path-rate-reason">دلیل نرخ اختصاصی</label></app-field>
          }
        </div>
        <p class="form-text">خالی‌بودن نرخ اختصاصی یعنی استفاده از تعرفه عمومی ساز. تغییر پیش‌فرض‌ها روی مبالغ ترم‌های قبلی اثر ندارد.</p>
        <div formArrayName="schedules">@for (row of form.controls.schedules.controls;track row;let i=$index){<div [formGroupName]="i" class="form-grid">
          <app-field><select appSelect2 [id]="'path-day-'+i" formControlName="weekday">@for(day of days;track day.value){<option [value]="day.value">{{day.label}}</option>}</select><label [for]="'path-day-'+i">روز هفته</label></app-field>
          <app-field><input type="time" [id]="'path-time-'+i" formControlName="startTime" /><label [for]="'path-time-'+i">ساعت شروع</label></app-field>
          <span>پایان: {{endTime(row.controls.startTime.value,form.controls.durationMinutes.value)}}</span>
          <button type="button" class="btn btn-light btn-sm" (click)="form.controls.schedules.removeAt(i)">حذف نوبت</button>
        </div>}</div>
        <button type="button" class="btn btn-light btn-sm" (click)="add()">افزودن نوبت</button>
        <app-switch formControlName="moveFuture" label="جابه‌جایی رزروهای آینده پس از بازبینی" />
        @if(form.controls.moveFuture.value){<button type="button" class="btn btn-light" (click)="preview()">نمایش رزروهای متأثر</button>}
        @if(affected.length){<app-data-grid title="بازبینی رزروهای متأثر" [rows]="affected" [columns]="columns" stateKey="schedule-preview" height="280px" />}
      }
      @if(error){<p class="alert alert-danger" role="alert">{{error}}</p>}
      <div class="actions"><button class="btn btn-primary" [disabled]="busy">ذخیره</button><button type="button" class="btn btn-light" (click)="cancel.emit()">انصراف</button></div>
    </form></section>`,
})
export class LearningPathEditor implements OnInit {
  @Input() studentId=0;
  @Input() path:Student['enrollments'][number]|null=null;
  @Output() saved=new EventEmitter<void>(); @Output() cancel=new EventEmitter<void>();
  api=inject(Api);fb=inject(FormBuilder);cdr=inject(ChangeDetectorRef);options=emptyEducationOptions();busy=false;error='';endTime=endTime;previewToken='';previewBody='';affected:any[]=[];
  days=[{value:'6',label:'شنبه'},{value:'0',label:'یکشنبه'},{value:'1',label:'دوشنبه'},{value:'2',label:'سه‌شنبه'},{value:'3',label:'چهارشنبه'},{value:'4',label:'پنجشنبه'},{value:'5',label:'جمعه'}];
  form=this.fb.nonNullable.group({...educationControls(),durationMinutes:'30',timezone:'Asia/Tehran',effectiveFrom:jalaliToday(),rateToman30:'',rateUsd30:'',reason:'',moveFuture:false,schedules:this.fb.array<ReturnType<typeof this.row>>([])});
  row(){return this.fb.nonNullable.group({weekday:'6',startTime:''});} add(){this.form.controls.schedules.push(this.row());}
  date=new PersianDate();columns:ColDef[]=[{field:'id',headerName:'جلسه'},{field:'before',headerName:'زمان قبلی تهران',valueFormatter:p=>this.date.transform(p.value,'Asia/Tehran',true),minWidth:240},{field:'after',headerName:'زمان پیشنهادی تهران',valueFormatter:p=>p.value?this.date.transform(p.value,'Asia/Tehran',true):'نوبت متناظر ندارد',minWidth:240}];
  async ngOnInit(){try{this.options=await this.api.get<EducationOptions>('/students/education-options');const s=this.path?.settings;if(this.path){this.form.patchValue({instrumentId:String(this.path.instrument_id||''),instructorId:String(s?.['instructor_id']||''),teachingTypeId:String(s?.['teaching_type_id']||''),academyId:String(s?.['academy_id']||''),durationMinutes:String(s?.['duration_minutes']||30),timezone:String(s?.['timezone']||'Asia/Tehran'),rateToman30:s?.['rate_toman_30']==null?'':String(s['rate_toman_30']),rateUsd30:s?.['rate_usd_cents_30']==null?'':String(Number(s['rate_usd_cents_30'])/100)});this.form.controls.instrumentId.disable();for(const s of this.path.schedules||[]){const row=this.row();row.patchValue({weekday:String(s.weekday),startTime:s.start_time});this.form.controls.schedules.push(row);}}}catch(e){this.error=errorMessage(e);}this.cdr.markForCheck();}
  body(){const v=this.form.getRawValue();return {...v,...(!this.api.user()?.admin?{rateToman30:undefined,rateUsd30:undefined}:{}),version:Number(this.path?.settings?.['version']||0),effectiveFrom:toIso(v.effectiveFrom),schedules:v.schedules.map(r=>({...r,timezone:v.timezone,durationMinutes:v.durationMinutes}))};}
  async preview(){if(!this.path)return;this.error='';try{const body=this.body(),result=await this.api.patch<{affected:any[];token:string}>(`/enrollments/${this.path.id}/settings`,{...body,preview:true});this.affected=result.affected;this.previewToken=result.token;this.previewBody=JSON.stringify(body);}catch(e){this.error=errorMessage(e);}this.cdr.markForCheck();}
  async save(){if(this.busy)return;this.busy=true;this.error='';try{if(!this.path)await this.api.post(`/students/${this.studentId}/enrollments`,{instrumentId:this.form.controls.instrumentId.value});else{const body=this.body();if(body.moveFuture && this.previewBody!==JSON.stringify(body))throw Error('ابتدا رزروهای متأثر را با همین تنظیمات بازبینی کنید.');await this.api.patch(`/enrollments/${this.path.id}/settings`,{...body,previewToken:this.previewToken});}this.saved.emit();}catch(e){this.error=e instanceof Error && !('error'in e)?e.message:errorMessage(e);}finally{this.busy=false;this.cdr.markForCheck();}}
}

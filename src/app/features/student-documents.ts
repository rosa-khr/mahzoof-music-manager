import { Component, Input, inject, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Api, errorMessage } from '../core/api';
import { Student } from '../core/models';
import { DataGrid, actionColumn } from '../shared/data-grid';
import { ColDef } from 'ag-grid-community';
import { Select2 } from '../shared/select2';
import { Field, PersianDate } from '../shared/ui';
@Component({selector:'app-student-documents',standalone:true,changeDetection:ChangeDetectionStrategy.OnPush,imports:[ReactiveFormsModule,DataGrid,Select2,Field],template:`<section class="card"><h2>اسناد خصوصی پرونده</h2><p>چاپ به معنی امضا یا پذیرش نیست. نسخه امضاشده را در صورت نیاز بارگذاری کنید.</p><form [formGroup]="form" (ngSubmit)="upload()"><div class="form-grid"><app-field><select appSelect2 id="document-term" formControlName="termId"><option value="">پرونده بدون ترم</option>@for(t of student.terms;track t.id){<option [value]="t.id">{{t.subject}} • ترم {{t.number}}</option>}</select><label for="document-term">ثبت‌نام / ترم مربوط</label></app-field><input type="file" accept="application/pdf,image/png,image/jpeg,image/webp" aria-label="اسکن امضاشده" (change)="select($event)" /></div><button class="btn btn-primary" [disabled]="busy||!file">بارگذاری اسکن امضاشده</button></form>@if(error){<p class="alert alert-danger">{{error}}</p>}<app-data-grid title="اسناد خصوصی" [rows]="rows" [columns]="columns" stateKey="private-student-documents" height="320px" /></section>`})
export class StudentDocuments {
  @Input({required:true})student!:Student;api=inject(Api);fb=inject(FormBuilder);cdr=inject(ChangeDetectorRef);form=this.fb.nonNullable.group({termId:''});file:File|null=null;busy=false;error='';rows:any[]=[];date=new PersianDate();
  columns:ColDef[]=[{field:'name',headerName:'نام فایل',minWidth:230},{field:'kind',headerName:'نوع',valueFormatter:p=>p.value==='receipt'?'رسید دریافت':'نسخه امضاشده'},{field:'created_at',headerName:'تاریخ بارگذاری',valueFormatter:p=>this.date.transform(p.value)},actionColumn<any>(row=>[{label:'دانلود سند خصوصی',icon:'eye',run:()=>void this.download(row)}])];
  ngOnInit(){void this.load();}select(event:Event){this.file=(event.target as HTMLInputElement).files?.[0]||null;}
  async load(){try{this.rows=(await this.api.get<{items:any[]}>(`/students/${this.student.id}/documents`)).items;}catch(e){this.error=errorMessage(e);}this.cdr.markForCheck();}
  async upload(){if(!this.file||this.busy)return;this.busy=true;this.error='';try{const body=new FormData();body.append('file',this.file);body.append('kind','signed_registration');body.append('termId',this.form.controls.termId.value);await this.api.post(`/students/${this.student.id}/documents`,body);this.file=null;await this.load();}catch(e){this.error=errorMessage(e);}finally{this.busy=false;this.cdr.markForCheck();}}
  async download(row:any){try{const blob=await this.api.file(`/students/${this.student.id}/documents/${row.id}`),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=row.name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(e){this.error=errorMessage(e);this.cdr.markForCheck();}}
}

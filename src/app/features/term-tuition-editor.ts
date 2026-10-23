import { Component, Input, Output, EventEmitter, inject, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Api, errorMessage } from '../core/api';
import { Term } from '../core/models';
import { Field, Money } from '../shared/ui';
import { Select2 } from '../shared/select2';
import { Switch } from '../shared/switch';
import { confirmUserChange } from '../shared/confirm';
@Component({selector:'app-term-tuition-editor',standalone:true,changeDetection:ChangeDetectionStrategy.OnPush,imports:[ReactiveFormsModule,Field,Select2,Switch,Money],template:`<section class="card action-panel"><h2>اصلاح شهریه ترم {{term.number}}</h2><p>هر اصلاح با دلیل در سابقه ثبت می‌شود. دریافت تأییدشده باید ابتدا از مسیر ابطال دریافت تعیین تکلیف شود.</p><form [formGroup]="form" (ngSubmit)="save()"><div class="form-grid">
  <app-field><input id="amend-rate" formControlName="baseRate" inputmode="decimal" /><label for="amend-rate">نرخ پایه ۳۰ دقیقه</label></app-field>
  <app-field><input id="amend-duration" formControlName="durationMinutes" inputmode="numeric" /><label for="amend-duration">مدت توافق‌شده</label></app-field>
  <app-field><input id="amend-quota" formControlName="quota" inputmode="numeric" /><label for="amend-quota">تعداد جلسات</label></app-field>
  <app-field><select appSelect2 id="amend-type" formControlName="discountType" (change)="clearDiscount()"><option value="none">بدون تخفیف</option><option value="percent">درصدی</option><option value="fixed">مبلغ ثابت</option></select><label for="amend-type">نوع تخفیف</label></app-field>
  @if(form.controls.discountType.value==='percent'){<app-field><input id="amend-percent" formControlName="discountPercent" /><label for="amend-percent">درصد تخفیف</label></app-field>}
  @if(form.controls.discountType.value==='fixed'){<app-field><input id="amend-fixed" formControlName="discountAmount" /><label for="amend-fixed">مبلغ تخفیف</label></app-field>}
  <app-field><textarea id="amend-reason" formControlName="reason"></textarea><label for="amend-reason">دلیل اصلاح *</label></app-field>
  </div><p>مبلغ فعلی: {{term.invoice!.total_minor | money:term.invoice!.currency}} • مبلغ پیشنهادی: {{net | money:term.invoice!.currency}}</p><app-switch formControlName="confirmZero" label="در صورت شهریه صفر آن را تأیید می‌کنم" />
  @if(error){<p class="alert alert-danger">{{error}}</p>}<div class="actions"><button class="btn btn-primary" [disabled]="busy">بازبینی و ثبت اصلاح</button><button type="button" class="btn btn-light" (click)="cancel.emit()">انصراف</button></div></form></section>`})
export class TermTuitionEditor {
  @Input({required:true})term!:Term;@Output()saved=new EventEmitter<void>();@Output()cancel=new EventEmitter<void>();api=inject(Api);fb=inject(FormBuilder);cdr=inject(ChangeDetectorRef);error='';busy=false;
  form=this.fb.nonNullable.group({baseRate:'',durationMinutes:'30',quota:'4',discountType:'none',discountPercent:'',discountAmount:'',reason:'',confirmZero:false});
  ngOnInit(){this.form.patchValue({baseRate:String((this.term.base_rate_minor_30||0)/(this.term.invoice?.currency==='USD'?100:1)),durationMinutes:String(this.term.duration_minutes||30),quota:String(this.term.quota),discountType:this.term.discount_type==='legacy'?'none':this.term.discount_type||'none',discountPercent:this.term.discount_type==='percent'?String(this.term.discount_value):'',discountAmount:this.term.discount_type==='fixed'?String((this.term.discount_value||0)/(this.term.invoice?.currency==='USD'?100:1)):''});}
  clearDiscount(){this.form.patchValue({discountPercent:'',discountAmount:''});}
  get net(){const v=this.form.getRawValue(),factor=this.term.invoice?.currency==='USD'?100:1,gross=Number(v.baseRate)*factor*Number(v.durationMinutes)*Number(v.quota)/30;return Math.round(gross-(v.discountType==='percent'?gross*Number(v.discountPercent)/100:v.discountType==='fixed'?Number(v.discountAmount)*factor:0));}
  async save(){if(this.busy)return;this.error='';if(!this.form.controls.reason.value.trim()){this.error='دلیل اصلاح را وارد کنید.';return;}if(!await confirmUserChange('اصلاح شهریه ترم','مبلغ و جزئیات جدید با سابقه ذخیره شود؟'))return;this.busy=true;try{await this.api.patch(`/terms/${this.term.id}/tuition`,{...this.form.getRawValue(),version:this.term.version});this.saved.emit();}catch(e){this.error=errorMessage(e);}finally{this.busy=false;this.cdr.markForCheck();}}
}

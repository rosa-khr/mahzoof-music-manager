import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  ViewChild,
  inject,
} from "@angular/core";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { Api, errorMessage } from "../core/api";
import { Datepicker } from "../shared/datepicker";
import { Field, PageHeader, jalaliToday, toIso, toJalali, PersianDate } from "../shared/ui";
import { DataGrid, actionColumn } from '../shared/data-grid';
import { ColDef } from 'ag-grid-community';
import { confirmUserChange } from '../shared/confirm';

interface Policy {
  id: number;
  version: number;
  title: string;
  content_html: string;
  effective_on: string;
  status: "draft" | "published";
  published_at?: string | null;
}

@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, Datepicker, Field, PageHeader, DataGrid],
  template: `<app-header title="قوانین ثبت‌نام" subtitle="نسخه‌بندی، بازبینی و انتشار" />
    @if (error) { <p class="alert alert-danger" role="alert">{{ error }}</p> }
    @if (message) { <p class="alert alert-success" role="status">{{ message }}</p> }
    <div class="settings-grid">
      <section class="card">
        <h2>{{ draft ? "پیش‌نویس نسخه " + draft.version : "نسخه جدید" }}</h2>
        <form [formGroup]="form" (ngSubmit)="save()">
          <div class="form-grid">
            <app-field><input id="policy-title" formControlName="title" /><label for="policy-title">عنوان *</label></app-field>
            <app-field><input id="policy-date" appDatepicker formControlName="effectiveOn" dir="ltr" /><label for="policy-date">تاریخ اثرگذاری *</label></app-field>
          </div>
          <div class="editor-toolbar" role="toolbar" aria-label="ابزار ویرایش متن">
            <button type="button" class="btn btn-light btn-sm" (click)="format('bold')">پررنگ</button>
            <button type="button" class="btn btn-light btn-sm" (click)="format('insertUnorderedList')">فهرست</button>
            <button type="button" class="btn btn-light btn-sm" (click)="format('insertOrderedList')">شماره‌دار</button>
          </div>
          <div #editor class="policy-editor" contenteditable="true" dir="rtl" role="textbox" aria-multiline="true" aria-label="متن قوانین" (input)="editorInput()"></div>
          <div class="actions">
            <button class="btn btn-primary" [disabled]="busy">ذخیره پیش‌نویس</button>
            @if (draft && api.user()?.admin) {
              <button type="button" class="btn btn-outline-primary" [disabled]="busy" (click)="publish()">انتشار نسخه</button>
            }
          </div>
        </form>
      </section>
      <section class="card">
        <h2>نسخه‌های منتشرشده</h2>
        <app-data-grid title="نسخه‌های قوانین" [rows]="items" [columns]="columns" stateKey="registration-policy-versions" height="360px" />
        @if (selected) { <article class="policy-version"><h3>{{selected.title}} • نسخه {{selected.version}}</h3><div [innerHTML]="selected.content_html"></div></article> }
      </section>
    </div>`,
})
export class RegistrationPolicies {
  @ViewChild("editor") editor?: ElementRef<HTMLElement>;
  api = inject(Api);
  cdr = inject(ChangeDetectorRef);
  fb = inject(FormBuilder);
  form = this.fb.nonNullable.group({
    title: ["قوانین ثبت‌نام آموزشگاه", Validators.required],
    effectiveOn: [jalaliToday(), Validators.required],
    contentHtml: ["", Validators.required],
  });
  items: Policy[] = [];
  busy = false;
  error = "";
  message = "";
  selected:Policy|null=null;
  date = new PersianDate();
  columns:ColDef<Policy>[]=[{field:'version',headerName:'نسخه',minWidth:100},{field:'title',headerName:'عنوان',minWidth:180},{field:'status',headerName:'وضعیت',valueFormatter:p=>p.value==='draft'?'پیش‌نویس':'منتشرشده'},{field:'effective_on',headerName:'اثرگذاری',valueFormatter:p=>this.date.transform(p.value)},actionColumn<Policy>(p=>[{label:'مشاهده نسخه',icon:'eye',run:()=>{this.selected=p;this.cdr.markForCheck();}}])];
  get draft() { return this.items.find((item) => item.status === "draft") || null; }
  get published() { return this.items.filter((item) => item.status === "published"); }
  constructor() { void this.load(); }
  async load() {
    try {
      const result = await this.api.get<{ items: Policy[] }>("/registration-policies");
      this.items = result.items;
      if (this.draft) {
        this.form.patchValue({ title: this.draft.title, effectiveOn: toJalali(this.draft.effective_on), contentHtml: this.draft.content_html });
        queueMicrotask(() => { if (this.editor) this.editor.nativeElement.innerHTML = this.draft!.content_html; });
      }
    } catch (e) { this.error = errorMessage(e); }
    this.cdr.markForCheck();
  }
  format(command: string) { this.editor?.nativeElement.focus(); document.execCommand(command); this.editorInput(); }
  editorInput() { this.form.controls.contentHtml.setValue(this.editor?.nativeElement.innerHTML || ""); }
  async save() {
    this.editorInput();
    if (this.form.invalid || this.busy) return;
    this.busy = true; this.error = "";
    try {
      const value = this.form.getRawValue();
      const body = { title: value.title, contentHtml: value.contentHtml, effectiveOn: toIso(value.effectiveOn) };
      if (this.draft) await this.api.patch(`/registration-policies/${this.draft.id}`, body);
      else await this.api.post("/registration-policies", body);
      this.message = "پیش‌نویس ذخیره شد."; await this.load();
    } catch (e) { this.error = errorMessage(e); }
    finally { this.busy = false; this.cdr.markForCheck(); }
  }
  async publish() {
    if (!this.draft || this.busy) return;
    if(!await confirmUserChange('انتشار قوانین','این نسخه پس از انتشار تغییرناپذیر می‌شود و ثبت‌نام‌های بعدی به آن متصل می‌شوند. ادامه می‌دهید؟'))return;
    await this.save();
    if(this.error)return;
    this.busy = true; this.error = "";
    try { await this.api.post(`/registration-policies/${this.draft.id}/publish`, {}); this.message = "نسخه قوانین منتشر و تغییرناپذیر شد."; await this.load(); }
    catch (e) { this.error = errorMessage(e); }
    finally { this.busy = false; this.cdr.markForCheck(); }
  }
}

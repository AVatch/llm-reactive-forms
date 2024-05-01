import OpenAI from 'openai';

import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Subject, debounceTime, takeUntil } from 'rxjs';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent implements OnInit, OnDestroy {
  private ngUnsubscribe: Subject<void> = new Subject<void>();

  title = 'llm-reactive-forms';

  openai?: any;
  hint?: string = `✨ Start typing to fill out the form...`;
  loading = false;

  credentialsForm = new FormGroup({
    apiKey: new FormControl<string | null>(null, []),
  });

  llmForm = new FormGroup({
    text: new FormControl<string>('', []),
  });

  regularForm = new FormGroup({
    name: new FormGroup({
      first: new FormControl<string>('', []),
      last: new FormControl<string>('', []),
    }),
    address: new FormGroup({
      address01: new FormControl<string>('', []),
      address02: new FormControl<string | null>(null, []),
      city: new FormControl<string>('', []),
      state: new FormControl<string>('', []),
      zipcode: new FormControl<string>('', []),
    }),
  });

  constructor(private cdRef: ChangeDetectorRef) {}

  ngOnInit() {
    this.llmForm.valueChanges
      .pipe(debounceTime(300), takeUntil(this.ngUnsubscribe))
      .subscribe((_) => this.parse());
  }

  ngOnDestroy() {
    this.ngUnsubscribe.next();
    this.ngUnsubscribe.complete();
  }

  // -------------------------------------

  setClient() {
    const apiKey = this.credentialsForm.value?.apiKey;

    if (!apiKey) {
      alert('Please enter a valid Open AI key');
      return;
    }

    try {
      this.openai = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
    } catch (err) {
      this.openai = undefined;

      console.error(err);
      alert('Something went wrong');
    }
  }

  // -------------------------------------

  private async parse() {
    if (!this.openai) {
      alert('Please enter an OpenAI API Key');
      return;
    }

    const message = this.llmForm.value.text ?? '';

    if (message.trim() === '') return;

    // TODO: Would be fun to figure out how to
    // dynamically generate the form schema.

    const completion = await this.openai.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: `
          You are a helpful assistant designed to output JSON.
          You are assisting a human fill out a complicated form.
          
          The form has the following structure:
          """
          name:
            first: string
            last: string
          
          address:
            address01: string
            address02: string (optional)
            city: string
            state: string
            zipcode: string
          """
      
          Complete the following task.
          `.trim(),
        },
        {
          role: 'user',
          content: `
          Task:
          Given the following message, fill out the form from the message.
          If there are any missing fields that are requried by the form provide a 1 sentence helpful hint to the human for them to know how they should modify their message.
          The hint should be focused and instructional.
          When possible clean up the values of the form.
          Only provide hints for missing fields.
          If all required fields of the form are satisfied, set the "ready" field to true.

          Message:
          """
          ${message}
          """


          Your response should be in the following format:
          {
              "values": <JSON object of form fields>
              "hint": <1 sentence hint>
              "ready": <boolean when form is ready>
          }
          `.trim(),
        },
      ],
      model: 'gpt-3.5-turbo-0125',
      response_format: { type: 'json_object' },
    });

    const response = completion.choices.at(0)?.message?.content;

    try {
      const data = JSON.parse(response);

      this.regularForm.patchValue(data.values);

      this.hint = (data.hint ?? '').trim() !== '' ? `ℹ️ ${data.hint}` : ``;

      if (data.ready) {
        this.hint = '✅ Thanks, form is filled!';
      }

      this.cdRef.markForCheck();
    } catch (err) {
      console.error(err);
    }
  }
}

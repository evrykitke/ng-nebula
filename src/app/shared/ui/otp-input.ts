import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  computed,
  input,
  model,
  output,
  viewChildren,
} from '@angular/core';

/**
 * Segmented one-time-code input: one box per digit with auto-advance,
 * backspace navigation and paste distribution. `value` is the concatenated
 * digits; `completed` fires when every box is filled — pages typically
 * auto-submit on it.
 */
@Component({
  selector: 'app-otp-input',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex justify-center gap-2" (paste)="onPaste($event)">
      @for (i of indexes(); track i) {
        <input
          #box
          type="text"
          inputmode="numeric"
          autocomplete="one-time-code"
          maxlength="2"
          [value]="value()[i] ?? ''"
          [disabled]="disabled()"
          (input)="onInput(i, $event)"
          (keydown)="onKeydown(i, $event)"
          (focus)="select($event)"
          class="h-11 w-10 rounded-md border border-input bg-background text-center font-mono text-lg
                 text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
          [attr.aria-label]="'Digit ' + (i + 1)"
        />
      }
    </div>
  `,
})
export class OtpInput {
  readonly length = input(6);
  readonly disabled = input(false);
  readonly value = model('');
  readonly completed = output<string>();

  readonly indexes = computed(() => Array.from({ length: this.length() }, (_, i) => i));

  private readonly boxes = viewChildren<ElementRef<HTMLInputElement>>('box');

  constructor() {
    // Typing should be possible the moment the boxes appear.
    afterNextRender(() => this.focusBox(Math.min(this.value().length, this.length() - 1)));
  }

  onInput(index: number, event: Event): void {
    const box = event.target as HTMLInputElement;
    // maxlength 2 lets a second keystroke land in a filled box; keep the
    // newest digit(s) and let long strings (mobile autofill) distribute.
    const digits = box.value.replace(/\D/g, '');
    const incoming = digits.length > 1 && digits.startsWith(this.value()[index] ?? '')
      ? digits.slice(1)
      : digits;
    this.write(index, incoming);
  }

  onKeydown(index: number, event: KeyboardEvent): void {
    const current = this.value();
    if (event.key === 'Backspace') {
      event.preventDefault();
      if (current[index]) {
        this.value.set(current.slice(0, index) + current.slice(index + 1));
        this.focusBox(index);
      } else if (index > 0) {
        this.value.set(current.slice(0, index - 1) + current.slice(index));
        this.focusBox(index - 1);
      }
    } else if (event.key === 'ArrowLeft' && index > 0) {
      event.preventDefault();
      this.focusBox(index - 1);
    } else if (event.key === 'ArrowRight' && index < this.length() - 1) {
      event.preventDefault();
      this.focusBox(index + 1);
    }
  }

  onPaste(event: ClipboardEvent): void {
    event.preventDefault();
    const digits = (event.clipboardData?.getData('text') ?? '').replace(/\D/g, '');
    if (digits) this.write(0, digits);
  }

  select(event: FocusEvent): void {
    (event.target as HTMLInputElement).select();
  }

  /** Reset and focus the first box (e.g. after a failed verification). */
  clear(): void {
    this.value.set('');
    this.focusBox(0);
  }

  /** Place `digits` starting at `index`, advance focus, emit on completion. */
  private write(index: number, digits: string): void {
    const max = this.length();
    const chars = this.value().slice(0, max).split('');
    for (let i = 0; i < digits.length && index + i < max; i++) {
      chars[index + i] = digits[i];
    }
    const next = chars.join('').slice(0, max);
    this.value.set(next);
    this.focusBox(Math.min(index + digits.length, max - 1));
    if (next.length === max && !next.includes(' ')) this.completed.emit(next);
  }

  private focusBox(index: number): void {
    this.boxes()[index]?.nativeElement.focus();
  }
}

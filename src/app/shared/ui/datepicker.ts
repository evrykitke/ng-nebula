import { ChangeDetectionStrategy, Component, computed, input, model, signal } from '@angular/core';
import { OverlayModule } from '@angular/cdk/overlay';
import { DateTime } from 'luxon';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCalendar } from '@ng-icons/lucide';
import { UiCalendar } from './calendar';

/** Themed date picker: a trigger button + the Spartan calendar in a CDK overlay (no native popup). */
@Component({
  selector: 'app-datepicker',
  imports: [OverlayModule, NgIcon, UiCalendar],
  providers: [provideIcons({ lucideCalendar })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      cdkOverlayOrigin
      #origin="cdkOverlayOrigin"
      (click)="open.set(!open())"
      class="flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input
             bg-background px-3 text-sm outline-none transition-colors hover:bg-accent/40
             focus:ring-2 focus:ring-ring focus:ring-offset-1 focus:ring-offset-background"
      [class.text-foreground]="date()"
      [class.text-muted-foreground]="!date()"
    >
      <span>{{ display() }}</span>
      <ng-icon name="lucideCalendar" size="16" class="shrink-0 text-muted-foreground" />
    </button>

    <ng-template
      cdkConnectedOverlay
      [cdkConnectedOverlayOrigin]="origin"
      [cdkConnectedOverlayOpen]="open()"
      [cdkConnectedOverlayHasBackdrop]="true"
      cdkConnectedOverlayBackdropClass="cdk-overlay-transparent-backdrop"
      [cdkConnectedOverlayOffsetY]="6"
      (backdropClick)="open.set(false)"
    >
      <div class="overflow-hidden rounded-md border border-border bg-popover shadow-md">
        <app-calendar [date]="date()" (dateChange)="pick($event)" />
      </div>
    </ng-template>
  `,
})
export class UiDatepicker {
  readonly date = model<DateTime | undefined>();
  readonly placeholder = input('Pick a date');
  readonly open = signal(false);

  protected readonly display = computed(() => {
    const d = this.date();
    return d ? d.toFormat('dd LLL yyyy') : this.placeholder();
  });

  protected pick(d: DateTime | undefined): void {
    this.date.set(d);
    this.open.set(false);
  }
}

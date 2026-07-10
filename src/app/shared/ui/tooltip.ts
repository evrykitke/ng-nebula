import {
  ChangeDetectionStrategy,
  Component,
  Directive,
  ElementRef,
  inject,
  input,
  OnDestroy,
  signal,
} from '@angular/core';
import {
  ConnectedPosition,
  Overlay,
  OverlayRef,
  OverlayPositionBuilder,
} from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';

@Component({
  selector: 'app-tooltip-content',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="pointer-events-none rounded-md bg-popover px-2 py-1 text-xs font-medium text-popover-foreground
             shadow-md ring-1 ring-border"
    >
      {{ text() }}
    </div>
  `,
})
export class TooltipContent {
  readonly text = signal('');
}

type TooltipPosition = 'right' | 'bottom' | 'top' | 'left';

const POSITIONS: Record<TooltipPosition, ConnectedPosition> = {
  right: { originX: 'end', originY: 'center', overlayX: 'start', overlayY: 'center', offsetX: 8 },
  left: { originX: 'start', originY: 'center', overlayX: 'end', overlayY: 'center', offsetX: -8 },
  bottom: { originX: 'center', originY: 'bottom', overlayX: 'center', overlayY: 'top', offsetY: 8 },
  top: { originX: 'center', originY: 'top', overlayX: 'center', overlayY: 'bottom', offsetY: -8 },
};

/** Lightweight CDK-overlay tooltip: `<button uiTooltip="Label" tooltipPosition="right">`. */
@Directive({
  selector: '[uiTooltip]',
  host: {
    '(mouseenter)': 'show()',
    '(mouseleave)': 'hide()',
    '(focus)': 'show()',
    '(blur)': 'hide()',
  },
})
export class UiTooltip implements OnDestroy {
  private readonly overlay = inject(Overlay);
  private readonly positionBuilder = inject(OverlayPositionBuilder);
  private readonly host = inject(ElementRef<HTMLElement>);

  readonly uiTooltip = input<string | null | undefined>('');
  readonly tooltipPosition = input<TooltipPosition>('bottom');

  private overlayRef?: OverlayRef;

  show(): void {
    const text = this.uiTooltip();
    if (!text || this.overlayRef?.hasAttached()) return;

    const positionStrategy = this.positionBuilder
      .flexibleConnectedTo(this.host)
      .withPositions([POSITIONS[this.tooltipPosition()], POSITIONS.bottom]);

    this.overlayRef = this.overlay.create({ positionStrategy });
    const ref = this.overlayRef.attach(new ComponentPortal(TooltipContent));
    ref.instance.text.set(text);
  }

  hide(): void {
    this.overlayRef?.detach();
  }

  ngOnDestroy(): void {
    this.overlayRef?.dispose();
  }
}

import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { cva, type VariantProps } from 'class-variance-authority';

/**
 * Exported so anything drawing a status pill without this component — the
 * datatable renders thousands of cells and wants a class, not a component
 * instance — still draws *this* pill. One definition of what a badge looks
 * like, or the lists and the detail pages drift apart.
 */
export const badgeVariants = cva(
  'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium',
  {
    variants: {
      variant: {
        default: 'bg-secondary text-secondary-foreground',
        success: 'bg-success/10 text-success',
        warning: 'bg-warning/10 text-warning',
        danger: 'bg-destructive/10 text-destructive',
        info: 'bg-info/10 text-info',
        primary: 'bg-primary/10 text-primary',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

type BadgeVariant = VariantProps<typeof badgeVariants>['variant'];

/** Status badge. `<app-badge variant="success">Active</app-badge>` */
@Component({
  selector: 'app-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span [class]="cls()"><ng-content /></span>`,
})
export class Badge {
  readonly variant = input<BadgeVariant>('default');
  protected readonly cls = computed(() => badgeVariants({ variant: this.variant() }));
}

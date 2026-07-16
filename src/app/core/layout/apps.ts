/**
 * Every app this product runs, in the order the launcher and sidebar show them.
 *
 * The only place that knows the full set. An app arrives here and brings its own
 * menu and pages with it; nothing else needs telling.
 */
import { AppDef } from './app.model';
import { ACCOUNTING_APP } from '../../features/accounting/accounting.app';
import { INVENTORY_APP } from '../../features/scm/inventory/inventory.app';
import { PROCUREMENT_APP } from '../../features/scm/procurement/procurement.app';
import { SALES_APP } from '../../features/scm/sales/sales.app';
import { WORKSPACE_APP } from '../../features/workspace/workspace.app';

export const APPS: AppDef[] = [
  ACCOUNTING_APP,
  INVENTORY_APP,
  PROCUREMENT_APP,
  SALES_APP,
  WORKSPACE_APP,
];

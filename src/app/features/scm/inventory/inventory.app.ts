/**
 * The Inventory app: What the business holds and what it is worth.
 *
 * Its menu and its pages, in one place, beside the pages themselves. The shell
 * composes whatever apps it is given — see `core/layout/app.model`.
 */
import { defineApp } from '../../../core/layout/app.model';
import { permissionGuard } from '../../../core/auth/permission-guard';
import { Permissions } from '../../../core/auth/permissions.constants';

export const INVENTORY_APP = defineApp({
  nav: {
  label: 'Inventory',
  icon: 'lucideBoxes',
  exact: false,
  app: true,
  tone: 'amber',
  description:
    "What you hold and what it is worth: items, stock, movements and valuation.",
  children: [
    { label: 'Dashboard', icon: 'lucideChartColumn', route: '/inventory/dashboard' },
    {
      label: 'Items',
      icon: 'lucidePackage',
      route: '/inventory/items',
      permission: Permissions.itemsView,
    },
    {
      label: 'Stock Levels',
      icon: 'lucideLayers',
      route: '/inventory/stock/levels',
      permission: Permissions.itemsView,
    },
    {
      label: 'Movements',
      icon: 'lucideArrowLeftRight',
      route: '/inventory/movements',
      permission: Permissions.movementsView,
    },
    {
      label: 'Stock Ledger',
      icon: 'lucideHistory',
      route: '/inventory/stock/ledger',
      permission: Permissions.inventoryReportsView,
    },
    {
      label: 'Warehouses',
      icon: 'lucideWarehouse',
      route: '/inventory/warehouses',
      permission: Permissions.warehousesView,
    },
    {
      label: 'GL Reconciliation',
      icon: 'lucideScale',
      route: '/inventory/reconciliation',
      permission: Permissions.inventoryReportsView,
    },
    {
      label: 'Setup',
      icon: 'lucideSettings',
      route: '/inventory/setup',
      permission: Permissions.itemsView,
    },
  ],
  },
  routes: [
    {
      path: 'inventory/dashboard',
      loadComponent: () =>
        import('../../shared/module-dashboard.page').then((m) => m.ModuleDashboardPage),
    },
    {
      path: 'inventory/items',
      canActivate: [permissionGuard],
      data: { permission: Permissions.itemsView },
      loadComponent: () =>
        import('./items/items.page').then((m) => m.ItemsPage),
    },
    {
      path: 'inventory/items/new',
      canActivate: [permissionGuard],
      data: { permission: Permissions.itemsCreate },
      loadComponent: () =>
        import('./items/item-form.page').then((m) => m.ItemFormPage),
    },
    {
      path: 'inventory/items/:id/edit',
      canActivate: [permissionGuard],
      data: { permission: Permissions.itemsEdit },
      loadComponent: () =>
        import('./items/item-form.page').then((m) => m.ItemFormPage),
    },
    {
      path: 'inventory/items/:id',
      canActivate: [permissionGuard],
      data: { permission: Permissions.itemsView },
      loadComponent: () =>
        import('./items/item-detail.page').then((m) => m.ItemDetailPage),
    },
    {
      path: 'inventory/warehouses',
      canActivate: [permissionGuard],
      data: { permission: Permissions.warehousesView },
      loadComponent: () =>
        import('./warehouses/warehouses.page').then((m) => m.WarehousesPage),
    },
    {
      path: 'inventory/warehouses/new',
      canActivate: [permissionGuard],
      data: { permission: Permissions.warehousesManage },
      loadComponent: () =>
        import('./warehouses/warehouse-form.page').then(
          (m) => m.WarehouseFormPage,
        ),
    },
    {
      path: 'inventory/warehouses/:id/edit',
      canActivate: [permissionGuard],
      data: { permission: Permissions.warehousesManage },
      loadComponent: () =>
        import('./warehouses/warehouse-form.page').then(
          (m) => m.WarehouseFormPage,
        ),
    },
    {
      path: 'inventory/stock/levels',
      canActivate: [permissionGuard],
      data: { permission: Permissions.itemsView },
      loadComponent: () =>
        import('./stock/levels.page').then((m) => m.StockLevelsPage),
    },
    {
      path: 'inventory/stock/ledger',
      canActivate: [permissionGuard],
      data: { permission: Permissions.inventoryReportsView },
      loadComponent: () =>
        import('./stock/ledger.page').then((m) => m.StockLedgerPage),
    },
    {
      path: 'inventory/reconciliation',
      canActivate: [permissionGuard],
      data: { permission: Permissions.inventoryReportsView },
      loadComponent: () =>
        import('./stock/reconciliation.page').then(
          (m) => m.StockReconciliationPage,
        ),
    },
    {
      path: 'inventory/setup',
      canActivate: [permissionGuard],
      data: { permission: Permissions.itemsView },
      loadComponent: () =>
        import('./setup/inventory-setup.page').then(
          (m) => m.InventorySetupPage,
        ),
    },
    {
      path: 'inventory/movements',
      canActivate: [permissionGuard],
      data: { permission: Permissions.movementsView },
      loadComponent: () =>
        import('./movements/movements.page').then((m) => m.MovementsPage),
    },
    {
      path: 'inventory/movements/new/:type',
      canActivate: [permissionGuard],
      data: { permission: Permissions.movementsCreate },
      loadComponent: () =>
        import('./movements/move-form.page').then((m) => m.MoveFormPage),
    },
    {
      path: 'inventory/movements/:id/edit',
      canActivate: [permissionGuard],
      data: { permission: Permissions.movementsCreate },
      loadComponent: () =>
        import('./movements/move-form.page').then((m) => m.MoveFormPage),
    },
    {
      path: 'inventory/movements/:id',
      canActivate: [permissionGuard],
      data: { permission: Permissions.movementsView },
      loadComponent: () =>
        import('./movements/movement-detail.page').then(
          (m) => m.MovementDetailPage,
        ),
    },
  ],
});

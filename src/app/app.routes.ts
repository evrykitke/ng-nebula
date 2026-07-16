import { Routes } from '@angular/router';
import { AppShell } from './core/layout/app-shell/app-shell';
import { authGuard } from './core/auth/auth-guard';
import { permissionGuard } from './core/auth/permission-guard';
import { Permissions } from './core/auth/permissions.constants';

/**
 * Top-level routes. The login route lives outside the shell; feature areas
 * mount as lazy children of the shell behind the auth guard, and
 * permission-gated pages add `permissionGuard` with a `data.permission`.
 */
export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./core/auth/pages/login/login').then((m) => m.LoginPage),
  },
  {
    path: 'register',
    loadComponent: () => import('./core/auth/pages/register/register').then((m) => m.RegisterPage),
  },
  {
    path: '',
    component: AppShell,
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard.page').then((m) => m.DashboardPage),
      },
      {
        path: 'profile',
        loadComponent: () =>
          import('./features/profile/profile.page').then((m) => m.ProfilePage),
      },
      {
        path: 'workspace/apps',
        loadComponent: () => import('./features/workspace/apps.page').then((m) => m.AppsPage),
      },
      // Each app is getting its own landing page. The sidebar links to them
      // already, so they resolve to a placeholder that names what is coming
      // rather than 404ing.
      ...['accounting', 'inventory', 'procurement', 'sales'].map((app) => ({
        path: `${app}/dashboard`,
        loadComponent: () =>
          import('./features/shared/module-dashboard.page').then((m) => m.ModuleDashboardPage),
      })),
      {
        path: 'workspace/reports',
        loadComponent: () =>
          import('./features/workspace/reports.page').then((m) => m.ReportsPage),
      },
      {
        path: 'workspace/reports/:name',
        loadComponent: () =>
          import('./features/workspace/report-viewer.page').then((m) => m.ReportViewerPage),
      },
      {
        path: 'accounting/accounts',
        canActivate: [permissionGuard],
        data: { permission: Permissions.accountsView },
        loadComponent: () =>
          import('./features/accounting/accounts/accounts.page').then((m) => m.AccountsPage),
      },
      {
        path: 'accounting/accounts/:id/ledger',
        canActivate: [permissionGuard],
        data: { permission: Permissions.accountingReportsView },
        loadComponent: () =>
          import('./features/accounting/ledger/account-ledger.page').then(
            (m) => m.AccountLedgerPage,
          ),
      },
      {
        path: 'accounting/fiscal-years',
        canActivate: [permissionGuard],
        data: { permission: Permissions.fiscalYearsView },
        loadComponent: () =>
          import('./features/accounting/fiscal-years/fiscal-years.page').then(
            (m) => m.FiscalYearsPage,
          ),
      },
      {
        path: 'accounting/journal',
        canActivate: [permissionGuard],
        data: { permission: Permissions.journalView },
        loadComponent: () =>
          import('./features/accounting/journal/journal.page').then((m) => m.JournalPage),
      },
      {
        path: 'accounting/journal/new',
        canActivate: [permissionGuard],
        data: { permission: Permissions.journalCreate },
        loadComponent: () =>
          import('./features/accounting/journal/journal-entry-new.page').then(
            (m) => m.JournalEntryNewPage,
          ),
      },
      {
        path: 'accounting/journal/:id/edit',
        canActivate: [permissionGuard],
        data: { permission: Permissions.journalCreate },
        loadComponent: () =>
          import('./features/accounting/journal/journal-entry-new.page').then(
            (m) => m.JournalEntryNewPage,
          ),
      },
      {
        path: 'accounting/journal/:id',
        canActivate: [permissionGuard],
        data: { permission: Permissions.journalView },
        loadComponent: () =>
          import('./features/accounting/journal/journal-entry-detail.page').then(
            (m) => m.JournalEntryDetailPage,
          ),
      },
      {
        path: 'accounting/expenses',
        canActivate: [permissionGuard],
        data: { permission: Permissions.expensesView },
        loadComponent: () =>
          import('./features/accounting/expenses/expenses.page').then((m) => m.ExpensesPage),
      },
      {
        path: 'accounting/tax-codes',
        canActivate: [permissionGuard],
        data: { permission: Permissions.taxView },
        loadComponent: () =>
          import('./features/accounting/tax-codes/tax-codes.page').then((m) => m.TaxCodesPage),
      },
      {
        path: 'accounting/trial-balance',
        canActivate: [permissionGuard],
        data: { permission: Permissions.accountingReportsView },
        loadComponent: () =>
          import('./features/accounting/trial-balance/trial-balance.page').then(
            (m) => m.TrialBalancePage,
          ),
      },
      {
        path: 'accounting/balance-sheet',
        canActivate: [permissionGuard],
        data: { permission: Permissions.accountingReportsView },
        loadComponent: () =>
          import('./features/accounting/balance-sheet/balance-sheet.page').then(
            (m) => m.BalanceSheetPage,
          ),
      },
      {
        path: 'accounting/income-statement',
        canActivate: [permissionGuard],
        data: { permission: Permissions.accountingReportsView },
        loadComponent: () =>
          import('./features/accounting/income-statement/income-statement.page').then(
            (m) => m.IncomeStatementPage,
          ),
      },
      // --- Inventory ---
      {
        path: 'inventory/items',
        canActivate: [permissionGuard],
        data: { permission: Permissions.itemsView },
        loadComponent: () =>
          import('./features/scm/inventory/items/items.page').then((m) => m.ItemsPage),
      },
      {
        path: 'inventory/items/new',
        canActivate: [permissionGuard],
        data: { permission: Permissions.itemsCreate },
        loadComponent: () =>
          import('./features/scm/inventory/items/item-form.page').then((m) => m.ItemFormPage),
      },
      {
        path: 'inventory/items/:id/edit',
        canActivate: [permissionGuard],
        data: { permission: Permissions.itemsEdit },
        loadComponent: () =>
          import('./features/scm/inventory/items/item-form.page').then((m) => m.ItemFormPage),
      },
      {
        path: 'inventory/items/:id',
        canActivate: [permissionGuard],
        data: { permission: Permissions.itemsView },
        loadComponent: () =>
          import('./features/scm/inventory/items/item-detail.page').then((m) => m.ItemDetailPage),
      },
      {
        path: 'inventory/warehouses',
        canActivate: [permissionGuard],
        data: { permission: Permissions.warehousesView },
        loadComponent: () =>
          import('./features/scm/inventory/warehouses/warehouses.page').then((m) => m.WarehousesPage),
      },
      {
        path: 'inventory/warehouses/new',
        canActivate: [permissionGuard],
        data: { permission: Permissions.warehousesManage },
        loadComponent: () =>
          import('./features/scm/inventory/warehouses/warehouse-form.page').then(
            (m) => m.WarehouseFormPage,
          ),
      },
      {
        path: 'inventory/warehouses/:id/edit',
        canActivate: [permissionGuard],
        data: { permission: Permissions.warehousesManage },
        loadComponent: () =>
          import('./features/scm/inventory/warehouses/warehouse-form.page').then(
            (m) => m.WarehouseFormPage,
          ),
      },
      {
        path: 'inventory/stock/levels',
        canActivate: [permissionGuard],
        data: { permission: Permissions.itemsView },
        loadComponent: () =>
          import('./features/scm/inventory/stock/levels.page').then((m) => m.StockLevelsPage),
      },
      {
        path: 'inventory/stock/ledger',
        canActivate: [permissionGuard],
        data: { permission: Permissions.inventoryReportsView },
        loadComponent: () =>
          import('./features/scm/inventory/stock/ledger.page').then((m) => m.StockLedgerPage),
      },
      {
        path: 'inventory/reconciliation',
        canActivate: [permissionGuard],
        data: { permission: Permissions.inventoryReportsView },
        loadComponent: () =>
          import('./features/scm/inventory/stock/reconciliation.page').then(
            (m) => m.StockReconciliationPage,
          ),
      },
      {
        path: 'inventory/setup',
        canActivate: [permissionGuard],
        data: { permission: Permissions.itemsView },
        loadComponent: () =>
          import('./features/scm/inventory/setup/inventory-setup.page').then(
            (m) => m.InventorySetupPage,
          ),
      },
      {
        path: 'inventory/movements',
        canActivate: [permissionGuard],
        data: { permission: Permissions.movementsView },
        loadComponent: () =>
          import('./features/scm/inventory/movements/movements.page').then((m) => m.MovementsPage),
      },
      {
        path: 'inventory/movements/new/:type',
        canActivate: [permissionGuard],
        data: { permission: Permissions.movementsCreate },
        loadComponent: () =>
          import('./features/scm/inventory/movements/move-form.page').then((m) => m.MoveFormPage),
      },
      {
        path: 'inventory/movements/:id/edit',
        canActivate: [permissionGuard],
        data: { permission: Permissions.movementsCreate },
        loadComponent: () =>
          import('./features/scm/inventory/movements/move-form.page').then((m) => m.MoveFormPage),
      },
      {
        path: 'inventory/movements/:id',
        canActivate: [permissionGuard],
        data: { permission: Permissions.movementsView },
        loadComponent: () =>
          import('./features/scm/inventory/movements/movement-detail.page').then(
            (m) => m.MovementDetailPage,
          ),
      },
      // --- Procurement ---
      {
        path: 'procurement/suppliers',
        canActivate: [permissionGuard],
        data: { permission: Permissions.suppliersView },
        loadComponent: () =>
          import('./features/scm/procurement/suppliers/suppliers.page').then((m) => m.SuppliersPage),
      },
      {
        path: 'procurement/suppliers/new',
        canActivate: [permissionGuard],
        data: { permission: Permissions.suppliersCreate },
        loadComponent: () =>
          import('./features/scm/procurement/suppliers/supplier-form.page').then(
            (m) => m.SupplierFormPage,
          ),
      },
      {
        path: 'procurement/suppliers/:id/edit',
        canActivate: [permissionGuard],
        data: { permission: Permissions.suppliersEdit },
        loadComponent: () =>
          import('./features/scm/procurement/suppliers/supplier-form.page').then(
            (m) => m.SupplierFormPage,
          ),
      },
      {
        path: 'procurement/suppliers/:id',
        canActivate: [permissionGuard],
        data: { permission: Permissions.suppliersView },
        loadComponent: () =>
          import('./features/scm/procurement/suppliers/supplier-detail.page').then(
            (m) => m.SupplierDetailPage,
          ),
      },
      {
        path: 'procurement/requisitions',
        canActivate: [permissionGuard],
        data: { permission: Permissions.requisitionsView },
        loadComponent: () =>
          import('./features/scm/procurement/requisitions/requisitions.page').then(
            (m) => m.RequisitionsPage,
          ),
      },
      {
        path: 'procurement/requisitions/new',
        canActivate: [permissionGuard],
        data: { permission: Permissions.requisitionsCreate },
        loadComponent: () =>
          import('./features/scm/procurement/requisitions/requisition-form.page').then(
            (m) => m.RequisitionFormPage,
          ),
      },
      {
        path: 'procurement/requisitions/:id/edit',
        canActivate: [permissionGuard],
        data: { permission: Permissions.requisitionsCreate },
        loadComponent: () =>
          import('./features/scm/procurement/requisitions/requisition-form.page').then(
            (m) => m.RequisitionFormPage,
          ),
      },
      {
        path: 'procurement/requisitions/:id',
        canActivate: [permissionGuard],
        data: { permission: Permissions.requisitionsView },
        loadComponent: () =>
          import('./features/scm/procurement/requisitions/requisition-detail.page').then(
            (m) => m.RequisitionDetailPage,
          ),
      },
      {
        path: 'procurement/rfqs',
        canActivate: [permissionGuard],
        data: { permission: Permissions.rfqsView },
        loadComponent: () =>
          import('./features/scm/procurement/rfqs/rfqs.page').then((m) => m.RfqsPage),
      },
      {
        path: 'procurement/rfqs/new',
        canActivate: [permissionGuard],
        data: { permission: Permissions.rfqsCreate },
        loadComponent: () =>
          import('./features/scm/procurement/rfqs/rfq-form.page').then((m) => m.RfqFormPage),
      },
      {
        path: 'procurement/rfqs/:id/edit',
        canActivate: [permissionGuard],
        data: { permission: Permissions.rfqsCreate },
        loadComponent: () =>
          import('./features/scm/procurement/rfqs/rfq-form.page').then((m) => m.RfqFormPage),
      },
      {
        path: 'procurement/rfqs/:id',
        canActivate: [permissionGuard],
        data: { permission: Permissions.rfqsView },
        loadComponent: () =>
          import('./features/scm/procurement/rfqs/rfq-detail.page').then((m) => m.RfqDetailPage),
      },
      {
        path: 'procurement/orders',
        canActivate: [permissionGuard],
        data: { permission: Permissions.ordersView },
        loadComponent: () =>
          import('./features/scm/procurement/orders/orders.page').then((m) => m.OrdersPage),
      },
      {
        path: 'procurement/orders/new',
        canActivate: [permissionGuard],
        data: { permission: Permissions.ordersCreate },
        loadComponent: () =>
          import('./features/scm/procurement/orders/order-form.page').then((m) => m.OrderFormPage),
      },
      {
        path: 'procurement/orders/:id/edit',
        canActivate: [permissionGuard],
        data: { permission: Permissions.ordersCreate },
        loadComponent: () =>
          import('./features/scm/procurement/orders/order-form.page').then((m) => m.OrderFormPage),
      },
      {
        path: 'procurement/orders/:id',
        canActivate: [permissionGuard],
        data: { permission: Permissions.ordersView },
        loadComponent: () =>
          import('./features/scm/procurement/orders/order-detail.page').then((m) => m.OrderDetailPage),
      },
      {
        path: 'procurement/receipts',
        canActivate: [permissionGuard],
        data: { permission: Permissions.receiptsView },
        loadComponent: () =>
          import('./features/scm/procurement/receipts/receipts.page').then((m) => m.ReceiptsPage),
      },
      {
        path: 'procurement/receipts/new',
        canActivate: [permissionGuard],
        data: { permission: Permissions.receiptsCreate },
        loadComponent: () =>
          import('./features/scm/procurement/receipts/receipt-new.page').then((m) => m.ReceiptNewPage),
      },
      {
        path: 'procurement/receipts/:id',
        canActivate: [permissionGuard],
        data: { permission: Permissions.receiptsView },
        loadComponent: () =>
          import('./features/scm/procurement/receipts/receipt-detail.page').then(
            (m) => m.ReceiptDetailPage,
          ),
      },
      {
        path: 'procurement/returns',
        canActivate: [permissionGuard],
        data: { permission: Permissions.returnsView },
        loadComponent: () =>
          import('./features/scm/procurement/returns/returns.page').then((m) => m.ReturnsPage),
      },
      {
        path: 'procurement/returns/new',
        canActivate: [permissionGuard],
        data: { permission: Permissions.returnsCreate },
        loadComponent: () =>
          import('./features/scm/procurement/returns/return-new.page').then((m) => m.ReturnNewPage),
      },
      {
        path: 'procurement/returns/:id',
        canActivate: [permissionGuard],
        data: { permission: Permissions.returnsView },
        loadComponent: () =>
          import('./features/scm/procurement/returns/return-detail.page').then(
            (m) => m.ReturnDetailPage,
          ),
      },
      {
        path: 'procurement/invoices',
        canActivate: [permissionGuard],
        data: { permission: Permissions.purchaseInvoicesView },
        loadComponent: () =>
          import('./features/scm/procurement/invoices/invoices.page').then((m) => m.InvoicesPage),
      },
      {
        path: 'procurement/invoices/new',
        canActivate: [permissionGuard],
        data: { permission: Permissions.purchaseInvoicesCreate },
        loadComponent: () =>
          import('./features/scm/procurement/invoices/invoice-new.page').then((m) => m.InvoiceNewPage),
      },
      {
        path: 'procurement/invoices/:id',
        canActivate: [permissionGuard],
        data: { permission: Permissions.purchaseInvoicesView },
        loadComponent: () =>
          import('./features/scm/procurement/invoices/invoice-detail.page').then(
            (m) => m.InvoiceDetailPage,
          ),
      },
      {
        path: 'procurement/grni',
        canActivate: [permissionGuard],
        data: { permission: Permissions.procurementReportsView },
        loadComponent: () =>
          import('./features/scm/procurement/grni/grni.page').then((m) => m.GrniPage),
      },
      {
        path: 'procurement/payments',
        canActivate: [permissionGuard],
        data: { permission: Permissions.paymentsView },
        loadComponent: () =>
          import('./features/scm/procurement/payments/payments.page').then((m) => m.PaymentsPage),
      },
      {
        path: 'procurement/payments/new',
        canActivate: [permissionGuard],
        data: { permission: Permissions.paymentsCreate },
        loadComponent: () =>
          import('./features/scm/procurement/payments/payment-new.page').then(
            (m) => m.PaymentNewPage,
          ),
      },
      {
        path: 'procurement/payments/:id',
        canActivate: [permissionGuard],
        data: { permission: Permissions.paymentsView },
        loadComponent: () =>
          import('./features/scm/procurement/payments/payment-detail.page').then(
            (m) => m.PaymentDetailPage,
          ),
      },
      {
        path: 'procurement/reorder',
        canActivate: [permissionGuard],
        data: { permission: Permissions.ordersCreate },
        loadComponent: () =>
          import('./features/scm/procurement/reorder/reorder.page').then((m) => m.ReorderPage),
      },
      {
        path: 'procurement/reports',
        canActivate: [permissionGuard],
        data: { permission: Permissions.procurementReportsView },
        loadComponent: () =>
          import('./features/scm/procurement/reports/procurement-reports.page').then(
            (m) => m.ProcurementReportsPage,
          ),
      },
      // --- Sales (order-to-cash) ---
      {
        path: 'sales/customers',
        canActivate: [permissionGuard],
        data: { permission: Permissions.customersView },
        loadComponent: () =>
          import('./features/scm/sales/customers/customers.page').then((m) => m.CustomersPage),
      },
      {
        path: 'sales/customers/new',
        canActivate: [permissionGuard],
        data: { permission: Permissions.customersCreate },
        loadComponent: () =>
          import('./features/scm/sales/customers/customer-form.page').then((m) => m.CustomerFormPage),
      },
      {
        path: 'sales/customers/:id/edit',
        canActivate: [permissionGuard],
        data: { permission: Permissions.customersEdit },
        loadComponent: () =>
          import('./features/scm/sales/customers/customer-form.page').then((m) => m.CustomerFormPage),
      },
      {
        path: 'sales/customers/:id',
        canActivate: [permissionGuard],
        data: { permission: Permissions.customersView },
        loadComponent: () =>
          import('./features/scm/sales/customers/customer-detail.page').then(
            (m) => m.CustomerDetailPage,
          ),
      },
      {
        path: 'sales/customer-groups',
        canActivate: [permissionGuard],
        data: { permission: Permissions.customersView },
        loadComponent: () =>
          import('./features/scm/sales/customers/customer-groups.page').then(
            (m) => m.CustomerGroupsPage,
          ),
      },
      {
        path: 'sales/price-lists',
        canActivate: [permissionGuard],
        data: { permission: Permissions.pricingView },
        loadComponent: () =>
          import('./features/scm/sales/pricing/price-lists.page').then((m) => m.PriceListsPage),
      },
      {
        path: 'sales/price-lists/new',
        canActivate: [permissionGuard],
        data: { permission: Permissions.pricingManage },
        loadComponent: () =>
          import('./features/scm/sales/pricing/price-list-form.page').then((m) => m.PriceListFormPage),
      },
      {
        path: 'sales/price-lists/:id/edit',
        canActivate: [permissionGuard],
        data: { permission: Permissions.pricingManage },
        loadComponent: () =>
          import('./features/scm/sales/pricing/price-list-form.page').then((m) => m.PriceListFormPage),
      },
      {
        path: 'sales/price-lists/:id',
        canActivate: [permissionGuard],
        data: { permission: Permissions.pricingView },
        loadComponent: () =>
          import('./features/scm/sales/pricing/price-list-detail.page').then(
            (m) => m.PriceListDetailPage,
          ),
      },
      {
        path: 'sales/quotations',
        canActivate: [permissionGuard],
        data: { permission: Permissions.quotationsView },
        loadComponent: () =>
          import('./features/scm/sales/quotations/quotations.page').then((m) => m.QuotationsPage),
      },
      {
        path: 'sales/quotations/new',
        canActivate: [permissionGuard],
        data: { permission: Permissions.quotationsCreate },
        loadComponent: () =>
          import('./features/scm/sales/quotations/quotation-form.page').then((m) => m.QuotationFormPage),
      },
      {
        path: 'sales/quotations/:id/edit',
        canActivate: [permissionGuard],
        data: { permission: Permissions.quotationsCreate },
        loadComponent: () =>
          import('./features/scm/sales/quotations/quotation-form.page').then((m) => m.QuotationFormPage),
      },
      {
        path: 'sales/quotations/:id',
        canActivate: [permissionGuard],
        data: { permission: Permissions.quotationsView },
        loadComponent: () =>
          import('./features/scm/sales/quotations/quotation-detail.page').then(
            (m) => m.QuotationDetailPage,
          ),
      },
      {
        path: 'sales/orders',
        canActivate: [permissionGuard],
        data: { permission: Permissions.salesOrdersView },
        loadComponent: () =>
          import('./features/scm/sales/orders/sales-orders.page').then((m) => m.SalesOrdersPage),
      },
      {
        path: 'sales/orders/new',
        canActivate: [permissionGuard],
        data: { permission: Permissions.salesOrdersCreate },
        loadComponent: () =>
          import('./features/scm/sales/orders/sales-order-form.page').then((m) => m.SalesOrderFormPage),
      },
      {
        path: 'sales/orders/:id/edit',
        canActivate: [permissionGuard],
        data: { permission: Permissions.salesOrdersCreate },
        loadComponent: () =>
          import('./features/scm/sales/orders/sales-order-form.page').then((m) => m.SalesOrderFormPage),
      },
      {
        path: 'sales/orders/:id',
        canActivate: [permissionGuard],
        data: { permission: Permissions.salesOrdersView },
        loadComponent: () =>
          import('./features/scm/sales/orders/sales-order-detail.page').then(
            (m) => m.SalesOrderDetailPage,
          ),
      },
      {
        path: 'sales/deliveries',
        canActivate: [permissionGuard],
        data: { permission: Permissions.deliveriesView },
        loadComponent: () =>
          import('./features/scm/sales/deliveries/deliveries.page').then((m) => m.DeliveriesPage),
      },
      {
        path: 'sales/deliveries/new',
        canActivate: [permissionGuard],
        data: { permission: Permissions.deliveriesCreate },
        loadComponent: () =>
          import('./features/scm/sales/deliveries/delivery-new.page').then((m) => m.DeliveryNewPage),
      },
      {
        path: 'sales/deliveries/:id',
        canActivate: [permissionGuard],
        data: { permission: Permissions.deliveriesView },
        loadComponent: () =>
          import('./features/scm/sales/deliveries/delivery-detail.page').then(
            (m) => m.DeliveryDetailPage,
          ),
      },
      {
        path: 'sales/invoices',
        canActivate: [permissionGuard],
        data: { permission: Permissions.salesInvoicesView },
        loadComponent: () =>
          import('./features/scm/sales/invoices/sales-invoices.page').then((m) => m.SalesInvoicesPage),
      },
      {
        path: 'sales/invoices/new',
        canActivate: [permissionGuard],
        data: { permission: Permissions.salesInvoicesCreate },
        loadComponent: () =>
          import('./features/scm/sales/invoices/sales-invoice-new.page').then(
            (m) => m.SalesInvoiceNewPage,
          ),
      },
      {
        path: 'sales/invoices/:id',
        canActivate: [permissionGuard],
        data: { permission: Permissions.salesInvoicesView },
        loadComponent: () =>
          import('./features/scm/sales/invoices/sales-invoice-detail.page').then(
            (m) => m.SalesInvoiceDetailPage,
          ),
      },
      {
        path: 'sales/credit-notes',
        canActivate: [permissionGuard],
        data: { permission: Permissions.creditNotesView },
        loadComponent: () =>
          import('./features/scm/sales/credit-notes/credit-notes.page').then((m) => m.CreditNotesPage),
      },
      {
        path: 'sales/credit-notes/new',
        canActivate: [permissionGuard],
        data: { permission: Permissions.creditNotesCreate },
        loadComponent: () =>
          import('./features/scm/sales/credit-notes/credit-note-new.page').then(
            (m) => m.CreditNoteNewPage,
          ),
      },
      {
        path: 'sales/credit-notes/:id',
        canActivate: [permissionGuard],
        data: { permission: Permissions.creditNotesView },
        loadComponent: () =>
          import('./features/scm/sales/credit-notes/credit-note-detail.page').then(
            (m) => m.CreditNoteDetailPage,
          ),
      },
      {
        path: 'sales/payments',
        canActivate: [permissionGuard],
        data: { permission: Permissions.salesPaymentsView },
        loadComponent: () =>
          import('./features/scm/sales/payments/sales-payments.page').then((m) => m.SalesPaymentsPage),
      },
      {
        path: 'sales/payments/new',
        canActivate: [permissionGuard],
        data: { permission: Permissions.salesPaymentsCreate },
        loadComponent: () =>
          import('./features/scm/sales/payments/sales-payment-new.page').then(
            (m) => m.SalesPaymentNewPage,
          ),
      },
      {
        path: 'sales/payments/:id',
        canActivate: [permissionGuard],
        data: { permission: Permissions.salesPaymentsView },
        loadComponent: () =>
          import('./features/scm/sales/payments/sales-payment-detail.page').then(
            (m) => m.SalesPaymentDetailPage,
          ),
      },
      {
        path: 'sales/reports',
        canActivate: [permissionGuard],
        data: { permission: Permissions.salesReportsView },
        loadComponent: () =>
          import('./features/scm/sales/reports/sales-reports.page').then((m) => m.SalesReportsPage),
      },
      {
        path: 'administration',
        loadComponent: () =>
          import('./features/administration/administration-hub.page').then(
            (m) => m.AdministrationHubPage,
          ),
      },
      {
        path: 'administration/users',
        canActivate: [permissionGuard],
        data: { permission: Permissions.usersView },
        loadComponent: () =>
          import('./features/administration/users/users.page').then((m) => m.UsersPage),
      },
      {
        path: 'administration/users/:id/permissions',
        canActivate: [permissionGuard],
        data: { permission: Permissions.usersPermissions },
        loadComponent: () =>
          import('./features/administration/users/user-permissions.page').then(
            (m) => m.UserPermissionsPage,
          ),
      },
      {
        path: 'administration/roles',
        canActivate: [permissionGuard],
        data: { permission: Permissions.rolesView },
        loadComponent: () =>
          import('./features/administration/roles/roles.page').then((m) => m.RolesPage),
      },
      {
        path: 'administration/audit-logs',
        canActivate: [permissionGuard],
        data: { permission: Permissions.auditLogsView },
        loadComponent: () =>
          import('./features/administration/audit-logs/audit-logs.page').then(
            (m) => m.AuditLogsPage,
          ),
      },
      {
        path: 'administration/audit-logs/:id',
        canActivate: [permissionGuard],
        data: { permission: Permissions.auditLogsView },
        loadComponent: () =>
          import('./features/administration/audit-logs/audit-log-detail.page').then(
            (m) => m.AuditLogDetailPage,
          ),
      },
      {
        path: 'administration/settings',
        canActivate: [permissionGuard],
        data: { permission: Permissions.tenantSettings },
        loadComponent: () =>
          import('./features/administration/settings/tenant-settings.page').then(
            (m) => m.TenantSettingsPage,
          ),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];

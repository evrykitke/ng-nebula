/**
 * The Sales app: Selling, from a quotation to the customer’s payment.
 *
 * Its menu and its pages, in one place, beside the pages themselves. The shell
 * composes whatever apps it is given — see `core/layout/app.model`.
 */
import { defineApp } from '../../../core/layout/app.model';
import { permissionGuard } from '../../../core/auth/permission-guard';
import { Permissions } from '../../../core/auth/permissions.constants';

export const SALES_APP = defineApp({
  nav: {
  label: 'Sales',
  icon: 'lucideTrendingUp',
  exact: false,
  app: true,
  tone: 'emerald',
  description:
    "Selling — from a quotation, through orders and delivery, to the customer's payment.",
  children: [
    { label: 'Dashboard', icon: 'lucideChartColumn', route: '/sales/dashboard' },
    {
      label: 'Customers',
      icon: 'lucideUsers',
      route: '/sales/customers',
      permission: Permissions.customersView,
    },
    {
      label: 'Price Lists',
      icon: 'lucidePercent',
      route: '/sales/price-lists',
      permission: Permissions.pricingView,
    },
    {
      label: 'Quotations',
      icon: 'lucideFileText',
      route: '/sales/quotations',
      permission: Permissions.quotationsView,
    },
    {
      label: 'Sales Orders',
      icon: 'lucideClipboardList',
      route: '/sales/orders',
      permission: Permissions.salesOrdersView,
    },
    {
      label: 'Deliveries',
      icon: 'lucideTruck',
      route: '/sales/deliveries',
      permission: Permissions.deliveriesView,
    },
    {
      label: 'Sales Invoices',
      icon: 'lucideReceiptText',
      route: '/sales/invoices',
      permission: Permissions.salesInvoicesView,
    },
    {
      label: 'Credit Notes',
      icon: 'lucideUndo2',
      route: '/sales/credit-notes',
      permission: Permissions.creditNotesView,
    },
    {
      label: 'Customer Payments',
      icon: 'lucideBanknote',
      route: '/sales/payments',
      permission: Permissions.salesPaymentsView,
    },
    {
      label: 'Reports',
      icon: 'lucideChartColumn',
      route: '/sales/reports',
      permission: Permissions.salesReportsView,
    },
  ],
  },
  routes: [
    {
      path: 'sales/dashboard',
      loadComponent: () =>
        import('../../shared/module-dashboard.page').then((m) => m.ModuleDashboardPage),
    },
    {
      path: 'sales/customers',
      canActivate: [permissionGuard],
      data: { permission: Permissions.customersView },
      loadComponent: () =>
        import('./customers/customers.page').then((m) => m.CustomersPage),
    },
    {
      path: 'sales/customers/new',
      canActivate: [permissionGuard],
      data: { permission: Permissions.customersCreate },
      loadComponent: () =>
        import('./customers/customer-form.page').then((m) => m.CustomerFormPage),
    },
    {
      path: 'sales/customers/:id/edit',
      canActivate: [permissionGuard],
      data: { permission: Permissions.customersEdit },
      loadComponent: () =>
        import('./customers/customer-form.page').then((m) => m.CustomerFormPage),
    },
    {
      path: 'sales/customers/:id',
      canActivate: [permissionGuard],
      data: { permission: Permissions.customersView },
      loadComponent: () =>
        import('./customers/customer-detail.page').then(
          (m) => m.CustomerDetailPage,
        ),
    },
    {
      path: 'sales/customer-groups',
      canActivate: [permissionGuard],
      data: { permission: Permissions.customersView },
      loadComponent: () =>
        import('./customers/customer-groups.page').then(
          (m) => m.CustomerGroupsPage,
        ),
    },
    {
      path: 'sales/price-lists',
      canActivate: [permissionGuard],
      data: { permission: Permissions.pricingView },
      loadComponent: () =>
        import('./pricing/price-lists.page').then((m) => m.PriceListsPage),
    },
    {
      path: 'sales/price-lists/new',
      canActivate: [permissionGuard],
      data: { permission: Permissions.pricingManage },
      loadComponent: () =>
        import('./pricing/price-list-form.page').then((m) => m.PriceListFormPage),
    },
    {
      path: 'sales/price-lists/:id/edit',
      canActivate: [permissionGuard],
      data: { permission: Permissions.pricingManage },
      loadComponent: () =>
        import('./pricing/price-list-form.page').then((m) => m.PriceListFormPage),
    },
    {
      path: 'sales/price-lists/:id',
      canActivate: [permissionGuard],
      data: { permission: Permissions.pricingView },
      loadComponent: () =>
        import('./pricing/price-list-detail.page').then(
          (m) => m.PriceListDetailPage,
        ),
    },
    {
      path: 'sales/quotations',
      canActivate: [permissionGuard],
      data: { permission: Permissions.quotationsView },
      loadComponent: () =>
        import('./quotations/quotations.page').then((m) => m.QuotationsPage),
    },
    {
      path: 'sales/quotations/new',
      canActivate: [permissionGuard],
      data: { permission: Permissions.quotationsCreate },
      loadComponent: () =>
        import('./quotations/quotation-form.page').then((m) => m.QuotationFormPage),
    },
    {
      path: 'sales/quotations/:id/edit',
      canActivate: [permissionGuard],
      data: { permission: Permissions.quotationsCreate },
      loadComponent: () =>
        import('./quotations/quotation-form.page').then((m) => m.QuotationFormPage),
    },
    {
      path: 'sales/quotations/:id',
      canActivate: [permissionGuard],
      data: { permission: Permissions.quotationsView },
      loadComponent: () =>
        import('./quotations/quotation-detail.page').then(
          (m) => m.QuotationDetailPage,
        ),
    },
    {
      path: 'sales/orders',
      canActivate: [permissionGuard],
      data: { permission: Permissions.salesOrdersView },
      loadComponent: () =>
        import('./orders/sales-orders.page').then((m) => m.SalesOrdersPage),
    },
    {
      path: 'sales/orders/new',
      canActivate: [permissionGuard],
      data: { permission: Permissions.salesOrdersCreate },
      loadComponent: () =>
        import('./orders/sales-order-form.page').then((m) => m.SalesOrderFormPage),
    },
    {
      path: 'sales/orders/:id/edit',
      canActivate: [permissionGuard],
      data: { permission: Permissions.salesOrdersCreate },
      loadComponent: () =>
        import('./orders/sales-order-form.page').then((m) => m.SalesOrderFormPage),
    },
    {
      path: 'sales/orders/:id',
      canActivate: [permissionGuard],
      data: { permission: Permissions.salesOrdersView },
      loadComponent: () =>
        import('./orders/sales-order-detail.page').then(
          (m) => m.SalesOrderDetailPage,
        ),
    },
    {
      path: 'sales/deliveries',
      canActivate: [permissionGuard],
      data: { permission: Permissions.deliveriesView },
      loadComponent: () =>
        import('./deliveries/deliveries.page').then((m) => m.DeliveriesPage),
    },
    {
      path: 'sales/deliveries/new',
      canActivate: [permissionGuard],
      data: { permission: Permissions.deliveriesCreate },
      loadComponent: () =>
        import('./deliveries/delivery-new.page').then((m) => m.DeliveryNewPage),
    },
    {
      path: 'sales/deliveries/:id',
      canActivate: [permissionGuard],
      data: { permission: Permissions.deliveriesView },
      loadComponent: () =>
        import('./deliveries/delivery-detail.page').then(
          (m) => m.DeliveryDetailPage,
        ),
    },
    {
      path: 'sales/invoices',
      canActivate: [permissionGuard],
      data: { permission: Permissions.salesInvoicesView },
      loadComponent: () =>
        import('./invoices/sales-invoices.page').then((m) => m.SalesInvoicesPage),
    },
    {
      path: 'sales/invoices/new',
      canActivate: [permissionGuard],
      data: { permission: Permissions.salesInvoicesCreate },
      loadComponent: () =>
        import('./invoices/sales-invoice-new.page').then(
          (m) => m.SalesInvoiceNewPage,
        ),
    },
    {
      path: 'sales/invoices/:id',
      canActivate: [permissionGuard],
      data: { permission: Permissions.salesInvoicesView },
      loadComponent: () =>
        import('./invoices/sales-invoice-detail.page').then(
          (m) => m.SalesInvoiceDetailPage,
        ),
    },
    {
      path: 'sales/credit-notes',
      canActivate: [permissionGuard],
      data: { permission: Permissions.creditNotesView },
      loadComponent: () =>
        import('./credit-notes/credit-notes.page').then((m) => m.CreditNotesPage),
    },
    {
      path: 'sales/credit-notes/new',
      canActivate: [permissionGuard],
      data: { permission: Permissions.creditNotesCreate },
      loadComponent: () =>
        import('./credit-notes/credit-note-new.page').then(
          (m) => m.CreditNoteNewPage,
        ),
    },
    {
      path: 'sales/credit-notes/:id',
      canActivate: [permissionGuard],
      data: { permission: Permissions.creditNotesView },
      loadComponent: () =>
        import('./credit-notes/credit-note-detail.page').then(
          (m) => m.CreditNoteDetailPage,
        ),
    },
    {
      path: 'sales/payments',
      canActivate: [permissionGuard],
      data: { permission: Permissions.salesPaymentsView },
      loadComponent: () =>
        import('./payments/sales-payments.page').then((m) => m.SalesPaymentsPage),
    },
    {
      path: 'sales/payments/new',
      canActivate: [permissionGuard],
      data: { permission: Permissions.salesPaymentsCreate },
      loadComponent: () =>
        import('./payments/sales-payment-new.page').then(
          (m) => m.SalesPaymentNewPage,
        ),
    },
    {
      path: 'sales/payments/:id',
      canActivate: [permissionGuard],
      data: { permission: Permissions.salesPaymentsView },
      loadComponent: () =>
        import('./payments/sales-payment-detail.page').then(
          (m) => m.SalesPaymentDetailPage,
        ),
    },
    {
      path: 'sales/reports',
      canActivate: [permissionGuard],
      data: { permission: Permissions.salesReportsView },
      loadComponent: () =>
        import('./reports/sales-reports.page').then((m) => m.SalesReportsPage),
    },
  ],
});

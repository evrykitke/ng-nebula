/**
 * The Procurement app: Buying, from a requisition to the supplier’s bill.
 *
 * Its menu and its pages, in one place, beside the pages themselves. The shell
 * composes whatever apps it is given — see `core/layout/app.model`.
 */
import { defineApp } from '../../../core/layout/app.model';
import { permissionGuard } from '../../../core/auth/permission-guard';
import { Permissions } from '../../../core/auth/permissions.constants';

export const PROCUREMENT_APP = defineApp({
  nav: {
  label: 'Procurement',
  icon: 'lucideShoppingCart',
  exact: false,
  app: true,
  tone: 'violet',
  description:
    "Buying — from a requisition, through orders and receipts, to the supplier's bill.",
  children: [
    { label: 'Dashboard', icon: 'lucideChartColumn', route: '/procurement/dashboard' },
    {
      label: 'Suppliers',
      icon: 'lucideTruck',
      route: '/procurement/suppliers',
      permission: Permissions.suppliersView,
    },
    {
      label: 'Requisitions',
      icon: 'lucideClipboardList',
      route: '/procurement/requisitions',
      permission: Permissions.requisitionsView,
    },
    {
      label: 'RFQs',
      icon: 'lucideGitCompareArrows',
      route: '/procurement/rfqs',
      permission: Permissions.rfqsView,
    },
    {
      label: 'Purchase Orders',
      icon: 'lucideShoppingCart',
      route: '/procurement/orders',
      permission: Permissions.ordersView,
    },
    {
      label: 'Goods Receipts',
      icon: 'lucidePackageCheck',
      route: '/procurement/receipts',
      permission: Permissions.receiptsView,
    },
    {
      label: 'Returns',
      icon: 'lucidePackageX',
      route: '/procurement/returns',
      permission: Permissions.returnsView,
    },
    {
      label: 'Purchase Invoices',
      icon: 'lucideReceiptText',
      route: '/procurement/invoices',
      permission: Permissions.purchaseInvoicesView,
    },
    {
      label: 'GRNI',
      icon: 'lucidePackageCheck',
      route: '/procurement/grni',
      permission: Permissions.procurementReportsView,
    },
    {
      label: 'Supplier Payments',
      icon: 'lucideBanknote',
      route: '/procurement/payments',
      permission: Permissions.paymentsView,
    },
    {
      label: 'Auto-reorder',
      icon: 'lucideRefreshCw',
      route: '/procurement/reorder',
      permission: Permissions.ordersCreate,
    },
    {
      label: 'Reports',
      icon: 'lucideChartColumn',
      route: '/procurement/reports',
      permission: Permissions.procurementReportsView,
    },
  ],
  },
  routes: [
    {
      path: 'procurement/dashboard',
      loadComponent: () =>
        import('../../shared/module-dashboard.page').then((m) => m.ModuleDashboardPage),
    },
    {
      path: 'procurement/suppliers',
      canActivate: [permissionGuard],
      data: { permission: Permissions.suppliersView },
      loadComponent: () =>
        import('./suppliers/suppliers.page').then((m) => m.SuppliersPage),
    },
    {
      path: 'procurement/suppliers/new',
      canActivate: [permissionGuard],
      data: { permission: Permissions.suppliersCreate },
      loadComponent: () =>
        import('./suppliers/supplier-form.page').then(
          (m) => m.SupplierFormPage,
        ),
    },
    {
      path: 'procurement/suppliers/:id/edit',
      canActivate: [permissionGuard],
      data: { permission: Permissions.suppliersEdit },
      loadComponent: () =>
        import('./suppliers/supplier-form.page').then(
          (m) => m.SupplierFormPage,
        ),
    },
    {
      path: 'procurement/suppliers/:id',
      canActivate: [permissionGuard],
      data: { permission: Permissions.suppliersView },
      loadComponent: () =>
        import('./suppliers/supplier-detail.page').then(
          (m) => m.SupplierDetailPage,
        ),
    },
    {
      path: 'procurement/requisitions',
      canActivate: [permissionGuard],
      data: { permission: Permissions.requisitionsView },
      loadComponent: () =>
        import('./requisitions/requisitions.page').then(
          (m) => m.RequisitionsPage,
        ),
    },
    {
      path: 'procurement/requisitions/new',
      canActivate: [permissionGuard],
      data: { permission: Permissions.requisitionsCreate },
      loadComponent: () =>
        import('./requisitions/requisition-form.page').then(
          (m) => m.RequisitionFormPage,
        ),
    },
    {
      path: 'procurement/requisitions/:id/edit',
      canActivate: [permissionGuard],
      data: { permission: Permissions.requisitionsCreate },
      loadComponent: () =>
        import('./requisitions/requisition-form.page').then(
          (m) => m.RequisitionFormPage,
        ),
    },
    {
      path: 'procurement/requisitions/:id',
      canActivate: [permissionGuard],
      data: { permission: Permissions.requisitionsView },
      loadComponent: () =>
        import('./requisitions/requisition-detail.page').then(
          (m) => m.RequisitionDetailPage,
        ),
    },
    {
      path: 'procurement/rfqs',
      canActivate: [permissionGuard],
      data: { permission: Permissions.rfqsView },
      loadComponent: () =>
        import('./rfqs/rfqs.page').then((m) => m.RfqsPage),
    },
    {
      path: 'procurement/rfqs/new',
      canActivate: [permissionGuard],
      data: { permission: Permissions.rfqsCreate },
      loadComponent: () =>
        import('./rfqs/rfq-form.page').then((m) => m.RfqFormPage),
    },
    {
      path: 'procurement/rfqs/:id/edit',
      canActivate: [permissionGuard],
      data: { permission: Permissions.rfqsCreate },
      loadComponent: () =>
        import('./rfqs/rfq-form.page').then((m) => m.RfqFormPage),
    },
    {
      path: 'procurement/rfqs/:id',
      canActivate: [permissionGuard],
      data: { permission: Permissions.rfqsView },
      loadComponent: () =>
        import('./rfqs/rfq-detail.page').then((m) => m.RfqDetailPage),
    },
    {
      path: 'procurement/orders',
      canActivate: [permissionGuard],
      data: { permission: Permissions.ordersView },
      loadComponent: () =>
        import('./orders/orders.page').then((m) => m.OrdersPage),
    },
    {
      path: 'procurement/orders/new',
      canActivate: [permissionGuard],
      data: { permission: Permissions.ordersCreate },
      loadComponent: () =>
        import('./orders/order-form.page').then((m) => m.OrderFormPage),
    },
    {
      path: 'procurement/orders/:id/edit',
      canActivate: [permissionGuard],
      data: { permission: Permissions.ordersCreate },
      loadComponent: () =>
        import('./orders/order-form.page').then((m) => m.OrderFormPage),
    },
    {
      path: 'procurement/orders/:id',
      canActivate: [permissionGuard],
      data: { permission: Permissions.ordersView },
      loadComponent: () =>
        import('./orders/order-detail.page').then((m) => m.OrderDetailPage),
    },
    {
      path: 'procurement/receipts',
      canActivate: [permissionGuard],
      data: { permission: Permissions.receiptsView },
      loadComponent: () =>
        import('./receipts/receipts.page').then((m) => m.ReceiptsPage),
    },
    {
      path: 'procurement/receipts/new',
      canActivate: [permissionGuard],
      data: { permission: Permissions.receiptsCreate },
      loadComponent: () =>
        import('./receipts/receipt-new.page').then((m) => m.ReceiptNewPage),
    },
    {
      path: 'procurement/receipts/:id',
      canActivate: [permissionGuard],
      data: { permission: Permissions.receiptsView },
      loadComponent: () =>
        import('./receipts/receipt-detail.page').then(
          (m) => m.ReceiptDetailPage,
        ),
    },
    {
      path: 'procurement/returns',
      canActivate: [permissionGuard],
      data: { permission: Permissions.returnsView },
      loadComponent: () =>
        import('./returns/returns.page').then((m) => m.ReturnsPage),
    },
    {
      path: 'procurement/returns/new',
      canActivate: [permissionGuard],
      data: { permission: Permissions.returnsCreate },
      loadComponent: () =>
        import('./returns/return-new.page').then((m) => m.ReturnNewPage),
    },
    {
      path: 'procurement/returns/:id',
      canActivate: [permissionGuard],
      data: { permission: Permissions.returnsView },
      loadComponent: () =>
        import('./returns/return-detail.page').then(
          (m) => m.ReturnDetailPage,
        ),
    },
    {
      path: 'procurement/invoices',
      canActivate: [permissionGuard],
      data: { permission: Permissions.purchaseInvoicesView },
      loadComponent: () =>
        import('./invoices/invoices.page').then((m) => m.InvoicesPage),
    },
    {
      path: 'procurement/invoices/new',
      canActivate: [permissionGuard],
      data: { permission: Permissions.purchaseInvoicesCreate },
      loadComponent: () =>
        import('./invoices/invoice-new.page').then((m) => m.InvoiceNewPage),
    },
    {
      path: 'procurement/invoices/:id',
      canActivate: [permissionGuard],
      data: { permission: Permissions.purchaseInvoicesView },
      loadComponent: () =>
        import('./invoices/invoice-detail.page').then(
          (m) => m.InvoiceDetailPage,
        ),
    },
    {
      path: 'procurement/grni',
      canActivate: [permissionGuard],
      data: { permission: Permissions.procurementReportsView },
      loadComponent: () =>
        import('./grni/grni.page').then((m) => m.GrniPage),
    },
    {
      path: 'procurement/payments',
      canActivate: [permissionGuard],
      data: { permission: Permissions.paymentsView },
      loadComponent: () =>
        import('./payments/payments.page').then((m) => m.PaymentsPage),
    },
    {
      path: 'procurement/payments/new',
      canActivate: [permissionGuard],
      data: { permission: Permissions.paymentsCreate },
      loadComponent: () =>
        import('./payments/payment-new.page').then(
          (m) => m.PaymentNewPage,
        ),
    },
    {
      path: 'procurement/payments/:id',
      canActivate: [permissionGuard],
      data: { permission: Permissions.paymentsView },
      loadComponent: () =>
        import('./payments/payment-detail.page').then(
          (m) => m.PaymentDetailPage,
        ),
    },
    {
      path: 'procurement/reorder',
      canActivate: [permissionGuard],
      data: { permission: Permissions.ordersCreate },
      loadComponent: () =>
        import('./reorder/reorder.page').then((m) => m.ReorderPage),
    },
    {
      path: 'procurement/reports',
      canActivate: [permissionGuard],
      data: { permission: Permissions.procurementReportsView },
      loadComponent: () =>
        import('./reports/procurement-reports.page').then(
          (m) => m.ProcurementReportsPage,
        ),
    },
  ],
});

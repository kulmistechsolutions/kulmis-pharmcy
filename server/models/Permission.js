// Permission structure for users
export const PERMISSIONS = {
  // Sales module
  SALES_VIEW: 'sales:view',
  SALES_CREATE: 'sales:create',
  SALES_EDIT: 'sales:edit',
  SALES_DELETE: 'sales:delete',
  
  // Medicines module
  MEDICINES_VIEW: 'medicines:view',
  MEDICINES_CREATE: 'medicines:create',
  MEDICINES_EDIT: 'medicines:edit',
  MEDICINES_DELETE: 'medicines:delete',
  
  // Debts module
  DEBTS_VIEW: 'debts:view',
  DEBTS_CREATE: 'debts:create',
  DEBTS_EDIT: 'debts:edit',
  DEBTS_DELETE: 'debts:delete',
  DEBTS_PAYMENT: 'debts:payment',
  
  // Expenses module
  EXPENSES_VIEW: 'expenses:view',
  EXPENSES_CREATE: 'expenses:create',
  EXPENSES_EDIT: 'expenses:edit',
  EXPENSES_DELETE: 'expenses:delete',
  
  // Lab module
  LAB_VIEW: 'lab:view',
  LAB_PATIENTS: 'lab:patients',
  LAB_ORDERS: 'lab:orders',
  LAB_RESULTS: 'lab:results',
  LAB_TESTS: 'lab:tests',
  
  // Reports module
  REPORTS_VIEW: 'reports:view',
  REPORTS_EXPORT: 'reports:export',
  
  // Transactions module
  TRANSACTIONS_VIEW: 'transactions:view',
  TRANSACTIONS_EXPORT: 'transactions:export',
  
  // Settings module
  SETTINGS_VIEW: 'settings:view',
  SETTINGS_EDIT: 'settings:edit',
};

// Permission groups for easy selection
export const PERMISSION_GROUPS = {
  sales: [
    { key: PERMISSIONS.SALES_VIEW, label: 'View Sales' },
    { key: PERMISSIONS.SALES_CREATE, label: 'Create Sales' },
    { key: PERMISSIONS.SALES_EDIT, label: 'Edit Sales' },
    { key: PERMISSIONS.SALES_DELETE, label: 'Delete Sales' },
  ],
  medicines: [
    { key: PERMISSIONS.MEDICINES_VIEW, label: 'View Medicines' },
    { key: PERMISSIONS.MEDICINES_CREATE, label: 'Create Medicines' },
    { key: PERMISSIONS.MEDICINES_EDIT, label: 'Edit Medicines' },
    { key: PERMISSIONS.MEDICINES_DELETE, label: 'Delete Medicines' },
  ],
  debts: [
    { key: PERMISSIONS.DEBTS_VIEW, label: 'View Debts' },
    { key: PERMISSIONS.DEBTS_CREATE, label: 'Create Debts' },
    { key: PERMISSIONS.DEBTS_EDIT, label: 'Edit Debts' },
    { key: PERMISSIONS.DEBTS_DELETE, label: 'Delete Debts' },
    { key: PERMISSIONS.DEBTS_PAYMENT, label: 'Record Payments' },
  ],
  expenses: [
    { key: PERMISSIONS.EXPENSES_VIEW, label: 'View Expenses' },
    { key: PERMISSIONS.EXPENSES_CREATE, label: 'Create Expenses' },
    { key: PERMISSIONS.EXPENSES_EDIT, label: 'Edit Expenses' },
    { key: PERMISSIONS.EXPENSES_DELETE, label: 'Delete Expenses' },
  ],
  lab: [
    { key: PERMISSIONS.LAB_VIEW, label: 'View Lab' },
    { key: PERMISSIONS.LAB_PATIENTS, label: 'Manage Patients' },
    { key: PERMISSIONS.LAB_ORDERS, label: 'Manage Orders' },
    { key: PERMISSIONS.LAB_RESULTS, label: 'Enter Results' },
    { key: PERMISSIONS.LAB_TESTS, label: 'Manage Tests' },
  ],
  reports: [
    { key: PERMISSIONS.REPORTS_VIEW, label: 'View Reports' },
    { key: PERMISSIONS.REPORTS_EXPORT, label: 'Export Reports' },
  ],
  transactions: [
    { key: PERMISSIONS.TRANSACTIONS_VIEW, label: 'View Transactions' },
    { key: PERMISSIONS.TRANSACTIONS_EXPORT, label: 'Export Transactions' },
  ],
  settings: [
    { key: PERMISSIONS.SETTINGS_VIEW, label: 'View Settings' },
    { key: PERMISSIONS.SETTINGS_EDIT, label: 'Edit Settings' },
  ],
};














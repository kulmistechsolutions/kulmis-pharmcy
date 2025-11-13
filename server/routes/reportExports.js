import express from 'express';
import ExcelJS from 'exceljs';
import { protect, requireAnyPermission } from '../middleware/auth.js';
import Transaction from '../models/Transaction.js';
import LabCashierRecord from '../models/LabCashierRecord.js';
import Expense from '../models/Expense.js';
import Debt from '../models/Debt.js';
import Medicine from '../models/Medicine.js';
import User from '../models/User.js';

const router = express.Router();

const parseDateRange = (startDate, endDate) => {
  if (!startDate && !endDate) {
    return null;
  }

  const range = {};

  if (startDate) {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    range.$gte = start;
  }

  if (endDate) {
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    range.$lte = end;
  }

  return range;
};

const styleHeaderRow = (row, color = 'FF2563EB') => {
  row.height = 24;
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
    };
  });
};

const addNoDataRow = (sheet, message) => {
  const row = sheet.addRow([message]);
  sheet.mergeCells(row.number, 1, row.number, sheet.columnCount || 1);
  row.font = { italic: true, color: { argb: 'FF6B7280' } };
  row.alignment = { horizontal: 'center' };
};

const normalizeDebtValues = (debt = {}) => {
  const amountRaw = Number(debt.balance ?? debt.amount ?? debt.total ?? 0);
  const paidRaw = Number(debt.paid ?? debt.paid_amount ?? 0);
  const amount = Number.isFinite(amountRaw) ? amountRaw : 0;
  const paid = Number.isFinite(paidRaw) ? paidRaw : 0;
  const remainingValue = amount - paid;
  const remaining = Number.isFinite(remainingValue) ? Math.max(remainingValue, 0) : 0;
  return { amount, paid, remaining };
};

const formatActor = (name, role) => {
  if (!name && !role) {
    return 'Team Member';
  }
  if (!role) {
    return name || 'Team Member';
  }
  const normalizedRole = role
    .toString()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
  return `${name || 'Team Member'} (${normalizedRole})`;
};

const buildStaffSummary = (salesData = [], labRecords = []) => {
  const summary = new Map();

  const ensureEntry = (id, name, role) => {
    if (!id) return null;
    if (!summary.has(id)) {
      summary.set(id, {
        id,
        name: name || 'Team Member',
        role: role || 'staff',
        salesAmount: 0,
        labAmount: 0,
        transactions: 0,
        profit: 0,
      });
    }
    return summary.get(id);
  };

  salesData.forEach((sale) => {
    const id =
      (sale.processed_by_id && sale.processed_by_id.toString()) ||
      (sale.user_id && sale.user_id.toString()) ||
      '';
    const entry = ensureEntry(
      id,
      sale.processed_by_name || sale.user_name,
      sale.processed_by_role || sale.user_role
    );
    if (!entry) return;
    const totalSale = Number(sale.total_sale || 0);
    const profit = Number(sale.profit || 0);
    entry.salesAmount += Number.isFinite(totalSale) ? totalSale : 0;
    entry.transactions += 1;
    entry.profit += Number.isFinite(profit) ? profit : 0;
  });

  labRecords.forEach((record) => {
    const id =
      (record.processed_by_id && record.processed_by_id.toString()) ||
      (record.user_id && record.user_id.toString()) ||
      '';
    const entry = ensureEntry(
      id,
      record.processed_by_name || record.user_name || record.cashier_name,
      record.processed_by_role || record.user_role
    );
    if (!entry) return;
    const amount = Number(record.price || 0);
    if (Number.isFinite(amount)) {
      entry.labAmount += amount;
    }
    if (record.status === 'complete') {
      entry.transactions += 1;
    }
  });

  return Array.from(summary.values()).map((entry) => ({
    ...entry,
    total: entry.salesAmount + entry.labAmount,
  }));
};

router.use(protect);

router.get(
  '/export',
  requireAnyPermission('reports:export', 'reports:view', 'transactions:export'),
  async (req, res) => {
    try {
      const { type = 'overview', startDate, endDate, staffId } = req.query;
      const normalizedType = String(type).toLowerCase();
      const scopeIds = req.tenantScopeIds;
      const isSuperAdmin = req.user.role === 'super_admin';
      const isOwner = req.user.role === 'pharmacy_owner';
      const isStaff = req.user.role === 'staff';

      let effectiveStaffId =
        typeof staffId === 'string' && staffId.trim().length
          ? staffId.trim()
          : null;

      if (isStaff) {
        effectiveStaffId = req.user._id.toString();
      }

      if (
        effectiveStaffId &&
        !(
          isSuperAdmin ||
          isOwner ||
          (isStaff && effectiveStaffId === req.user._id.toString())
        )
      ) {
        return res.status(403).json({
          message: 'You are not allowed to export data for the selected staff member.',
        });
      }

      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Kulmis Pharmacy & Laboratory';
      workbook.created = new Date();

      const createdAtRange = parseDateRange(startDate, endDate);
      const dateRange = parseDateRange(startDate, endDate);

      const buildSalesSheet = async () => {
        const sheet = workbook.addWorksheet('Sales', {
          views: [{ state: 'frozen', ySplit: 1 }],
        });

        sheet.columns = [
          { header: 'Date', key: 'date', width: 18, style: { numFmt: 'mm/dd/yyyy' } },
          { header: 'Customer', key: 'customer', width: 28 },
          { header: 'Medicine', key: 'medicine', width: 26 },
          { header: 'Quantity', key: 'quantity', width: 12 },
          { header: 'Selling Price', key: 'selling_price', width: 16, style: { numFmt: '"$"#,##0.00' } },
          { header: 'Buying Price', key: 'buying_price', width: 16, style: { numFmt: '"$"#,##0.00' } },
          { header: 'Total Sale', key: 'total_sale', width: 16, style: { numFmt: '"$"#,##0.00' } },
          { header: 'Profit', key: 'profit', width: 14, style: { numFmt: '"$"#,##0.00' } },
          { header: 'Payment Method', key: 'payment_method', width: 18 },
          { header: 'Processed By', key: 'processed_by', width: 28 },
          { header: 'Status', key: 'status', width: 14 },
        ];

        styleHeaderRow(sheet.getRow(1), 'FF2563EB');

        const query = scopeIds ? { user_id: { $in: scopeIds } } : {};
        if (createdAtRange) {
          query.createdAt = createdAtRange;
        }
        if (effectiveStaffId) {
          query.processed_by_id = effectiveStaffId;
        }

        const transactions = await Transaction.find(query)
          .populate('medicine_id', 'name')
          .sort({ createdAt: -1 })
          .lean();

        let totalSale = 0;
        let totalProfit = 0;
        let totalCost = 0;
        let lossCount = 0;

        transactions.forEach((transaction) => {
          const saleAmount = Number(transaction.total_sale || 0);
          const profit = Number(transaction.profit || 0);
          const buyingPrice = Number(transaction.buying_price || 0);
          const quantity = Number(transaction.quantity || 0);
          const costAmount = buyingPrice * quantity;

          totalSale += Number.isFinite(saleAmount) ? saleAmount : 0;
          totalProfit += Number.isFinite(profit) ? profit : 0;
          totalCost += Number.isFinite(costAmount) ? costAmount : 0;
          if (transaction.is_loss_sale || profit < 0) {
            lossCount += 1;
          }

          sheet.addRow({
            date: transaction.createdAt ? new Date(transaction.createdAt) : null,
            customer: transaction.customer_name || 'Walk-in Customer',
            medicine: transaction.medicine_id?.name || 'N/A',
            quantity,
            selling_price: Number.isFinite(transaction.selling_price) ? transaction.selling_price : null,
            buying_price: buyingPrice,
            total_sale: saleAmount,
            profit,
            payment_method: transaction.payment_method || 'Cash',
            processed_by: formatActor(
              transaction.processed_by_name || transaction.user_name,
              transaction.processed_by_role || transaction.user_role
            ),
            status:
              transaction.is_loss_sale || profit < 0
                ? 'Loss'
                : profit === 0
                ? 'Break-even'
                : 'Profitable',
          });
        });

        if (!transactions.length) {
          addNoDataRow(sheet, 'No sales records found for the selected filters.');
        } else {
          sheet.addRow({});
          const totalsRow = sheet.addRow({
            customer: 'Totals',
            total_sale: totalSale,
            buying_price: totalCost,
            profit: totalProfit,
            status: lossCount > 0 ? `Loss Transactions: ${lossCount}` : 'All Profitable',
          });
          totalsRow.font = { bold: true };
          totalsRow.alignment = { horizontal: 'right' };
        }

        return { transactions, totalSale, totalProfit, totalCost, lossCount };
      };

      const buildLabSheet = async () => {
        const sheet = workbook.addWorksheet('Lab Reports', {
          views: [{ state: 'frozen', ySplit: 1 }],
        });

        sheet.columns = [
          { header: 'Date', key: 'date', width: 18, style: { numFmt: 'mm/dd/yyyy' } },
          { header: 'Patient', key: 'patient', width: 28 },
          { header: 'Sample Type', key: 'sample_type', width: 20 },
          { header: 'Diseases / Symptoms', key: 'diseases', width: 36 },
          { header: 'Status', key: 'status', width: 16 },
          { header: 'Processed By', key: 'processed_by', width: 28 },
          { header: 'Amount', key: 'amount', width: 16, style: { numFmt: '"$"#,##0.00' } },
        ];

        styleHeaderRow(sheet.getRow(1), 'FF16A34A');

        const query = scopeIds ? { user_id: { $in: scopeIds } } : {};
        if (dateRange) {
          query.date = dateRange;
        }
        if (effectiveStaffId) {
          query.processed_by_id = effectiveStaffId;
        }

        const records = await LabCashierRecord.find(query)
          .sort({ date: -1 })
          .lean();

        let totalAmount = 0;
        records.forEach((record) => {
          const amount = Number(record.price || 0);
          totalAmount += Number.isFinite(amount) ? amount : 0;
          const diseases = Array.isArray(record.diseases)
            ? record.diseases.join(', ')
            : record.diseases || 'N/A';

          sheet.addRow({
            date: record.date ? new Date(record.date) : record.createdAt ? new Date(record.createdAt) : null,
            patient: record.patient_name || 'N/A',
            sample_type: record.sample_type || 'N/A',
            diseases,
            status: record.status || 'process',
            processed_by: formatActor(
              record.processed_by_name || record.user_name || record.cashier_name,
              record.processed_by_role || record.user_role
            ),
            amount,
          });
        });

        if (!records.length) {
          addNoDataRow(sheet, 'No lab reports found for the selected filters.');
        } else {
          sheet.addRow({});
          const totalsRow = sheet.addRow({
            patient: 'Total Amount',
            amount: totalAmount,
          });
          totalsRow.font = { bold: true };
          totalsRow.alignment = { horizontal: 'right' };
        }

        return { records, totalAmount };
      };

      const buildExpenseSheet = async () => {
        const sheet = workbook.addWorksheet('Expenses', {
          views: [{ state: 'frozen', ySplit: 1 }],
        });

        sheet.columns = [
          { header: 'Date', key: 'date', width: 18, style: { numFmt: 'mm/dd/yyyy' } },
          { header: 'Category', key: 'category', width: 24 },
          { header: 'Description', key: 'description', width: 40 },
          { header: 'Amount', key: 'amount', width: 16, style: { numFmt: '"$"#,##0.00' } },
          { header: 'Recorded By', key: 'recorded_by', width: 28 },
        ];

        styleHeaderRow(sheet.getRow(1), 'FFEF4444');

        const query = scopeIds ? { user_id: { $in: scopeIds } } : {};
        if (createdAtRange) {
          query.date = createdAtRange;
        }

        const expenses = await Expense.find(query).sort({ date: -1 }).lean();
        let totalAmount = 0;

        expenses.forEach((expense) => {
          const amount = Number(expense.amount || 0);
          totalAmount += Number.isFinite(amount) ? amount : 0;
          sheet.addRow({
            date: expense.date ? new Date(expense.date) : null,
            category: expense.category || 'N/A',
            description: expense.description || '—',
            amount,
            recorded_by: expense.recorded_by_name || '',
          });
        });

        if (!expenses.length) {
          addNoDataRow(sheet, 'No expenses found for the selected filters.');
        } else {
          sheet.addRow({});
          const totalsRow = sheet.addRow({
            category: 'Total Expenses',
            amount: totalAmount,
          });
          totalsRow.font = { bold: true };
          totalsRow.alignment = { horizontal: 'right' };
        }

        return { expenses, totalAmount };
      };

      const buildDebtSheet = async () => {
        const sheet = workbook.addWorksheet('Debts', {
          views: [{ state: 'frozen', ySplit: 1 }],
        });

        sheet.columns = [
          { header: 'Date', key: 'date', width: 18, style: { numFmt: 'mm/dd/yyyy' } },
          { header: 'Debtor Name', key: 'debtor', width: 28 },
          { header: 'Phone', key: 'phone', width: 16 },
          { header: 'Amount', key: 'amount', width: 16, style: { numFmt: '"$"#,##0.00' } },
          { header: 'Paid', key: 'paid', width: 16, style: { numFmt: '"$"#,##0.00' } },
          { header: 'Remaining', key: 'remaining', width: 16, style: { numFmt: '"$"#,##0.00' } },
          { header: 'Status', key: 'status', width: 14 },
          { header: 'Due Date', key: 'due_date', width: 18, style: { numFmt: 'mm/dd/yyyy' } },
        ];

        styleHeaderRow(sheet.getRow(1), 'FFF97316');

        const query = scopeIds ? { user_id: { $in: scopeIds } } : {};
        if (createdAtRange) {
          query.createdAt = createdAtRange;
        }

        const debts = await Debt.find(query).sort({ createdAt: -1 }).lean();

        let totalAmount = 0;
        let totalPaid = 0;
        let totalRemaining = 0;

        debts.forEach((debt) => {
          const { amount, paid, remaining } = normalizeDebtValues(debt);
          totalAmount += amount;
          totalPaid += paid;
          totalRemaining += remaining;

          sheet.addRow({
            date: debt.createdAt ? new Date(debt.createdAt) : null,
            debtor: debt.debtor_name || 'N/A',
            phone: debt.phone || 'N/A',
            amount,
            paid,
            remaining,
            status: debt.status || 'Pending',
            due_date: debt.due_date ? new Date(debt.due_date) : null,
          });
        });

        if (!debts.length) {
          addNoDataRow(sheet, 'No debts found for the selected filters.');
        } else {
          sheet.addRow({});
          const totalsRow = sheet.addRow({
            debtor: 'Totals',
            amount: totalAmount,
            paid: totalPaid,
            remaining: totalRemaining,
          });
          totalsRow.font = { bold: true };
          totalsRow.alignment = { horizontal: 'right' };
        }

        return { debts, totals: { totalAmount, totalPaid, totalRemaining } };
      };

      const buildMedicineSheet = async () => {
        const sheet = workbook.addWorksheet('Medicines', {
          views: [{ state: 'frozen', ySplit: 1 }],
        });

        sheet.columns = [
          { header: 'Name', key: 'name', width: 32 },
          { header: 'Batch Number', key: 'batch', width: 18 },
          { header: 'Category', key: 'category', width: 18 },
          { header: 'Quantity', key: 'quantity', width: 12 },
          { header: 'Buying Price', key: 'buying_price', width: 16, style: { numFmt: '"$"#,##0.00' } },
          { header: 'Selling Price', key: 'selling_price', width: 16, style: { numFmt: '"$"#,##0.00' } },
          { header: 'Expiry Date', key: 'expiry_date', width: 18, style: { numFmt: 'mm/dd/yyyy' } },
          { header: 'Created At', key: 'created_at', width: 22, style: { numFmt: 'mm/dd/yyyy hh:mm' } },
        ];

        styleHeaderRow(sheet.getRow(1), 'FF0EA5E9');

        const query = scopeIds ? { user_id: { $in: scopeIds } } : {};
        const medicines = await Medicine.find(query).sort({ name: 1 }).lean();

        medicines.forEach((medicine) => {
          sheet.addRow({
            name: medicine.name,
            batch: medicine.batch || '—',
            category: medicine.category || '—',
            quantity: medicine.quantity || 0,
            buying_price: Number(medicine.buying_price || 0),
            selling_price: Number(medicine.selling_price || 0),
            expiry_date: medicine.expiry_date ? new Date(medicine.expiry_date) : null,
            created_at: medicine.createdAt ? new Date(medicine.createdAt) : null,
          });
        });

        if (!medicines.length) {
          addNoDataRow(sheet, 'No medicines found to export.');
        }

        return medicines;
      };

      const buildStaffSheet = async (salesData, labRecords) => {
        const sheet = workbook.addWorksheet('Staff Overview', {
          views: [{ state: 'frozen', ySplit: 1 }],
        });

        sheet.columns = [
          { header: 'Name', key: 'name', width: 28 },
          { header: 'Role', key: 'role', width: 18 },
          { header: 'Email', key: 'email', width: 28 },
          { header: 'Phone', key: 'phone', width: 18 },
          { header: 'Active', key: 'active', width: 10 },
          { header: 'Total Sales', key: 'salesAmount', width: 16, style: { numFmt: '"$"#,##0.00' } },
          { header: 'Lab Revenue', key: 'labAmount', width: 16, style: { numFmt: '"$"#,##0.00' } },
          { header: 'Profit', key: 'profit', width: 14, style: { numFmt: '"$"#,##0.00' } },
          { header: 'Transactions', key: 'transactions', width: 14 },
          { header: 'Created At', key: 'created_at', width: 20, style: { numFmt: 'mm/dd/yyyy hh:mm' } },
        ];

        styleHeaderRow(sheet.getRow(1), 'FF6366F1');

        const ownerId = req.accountId || req.user._id;
        const staffQuery = req.isSuperAdminRequest
          ? { role: { $in: ['pharmacy_owner', 'technician', 'staff'] } }
          : {
              $or: [
                { _id: ownerId },
                { created_by: ownerId },
              ],
            };

        const staffMembers = await User.find(staffQuery)
          .select('pharmacyName email phone role isActive createdAt')
          .sort({ createdAt: -1 })
          .lean();

        const performance = buildStaffSummary(salesData, labRecords);
        const performanceMap = new Map(performance.map((entry) => [entry.id, entry]));

        staffMembers.forEach((member) => {
          const metrics = performanceMap.get(member._id.toString()) || {
            salesAmount: 0,
            labAmount: 0,
            transactions: 0,
            profit: 0,
          };
          sheet.addRow({
            name: member.pharmacyName || member.email,
            role: member.role,
            email: member.email,
            phone: member.phone,
            active: member.isActive ? 'Yes' : 'No',
            salesAmount: metrics.salesAmount,
            labAmount: metrics.labAmount,
            profit: metrics.profit,
            transactions: metrics.transactions,
            created_at: member.createdAt ? new Date(member.createdAt) : null,
          });
        });

        if (!staffMembers.length) {
          addNoDataRow(sheet, 'No staff accounts found.');
        }
      };

      const buildOverviewSheets = async () => {
        const salesResult = await buildSalesSheet();
        const labResult = await buildLabSheet();
        const expenseResult = await buildExpenseSheet();
        const debtResult = await buildDebtSheet();

        const overviewSheet = workbook.addWorksheet('Executive Summary');
        overviewSheet.columns = [
          { header: 'Metric', key: 'metric', width: 32 },
          { header: 'Value', key: 'value', width: 20 },
          { header: 'Notes', key: 'notes', width: 40 },
        ];
        styleHeaderRow(overviewSheet.getRow(1), 'FF1F2937');

        const lossTransactions = salesResult.transactions.filter(
          (transaction) => Number(transaction.profit || 0) < 0 || transaction.is_loss_sale
        );
        const lossAmount = lossTransactions.reduce((sum, transaction) => {
          const profit = Number(transaction.profit || 0);
          return profit < 0 ? sum + Math.abs(profit) : sum;
        }, 0);
        const profitMargin = salesResult.totalSale > 0 ? salesResult.totalProfit / salesResult.totalSale : 0;

        const addMetricRow = (metric, value, formatter, notes) => {
          const row = overviewSheet.addRow({ metric, value, notes: notes || '' });
          if (formatter === 'currency') {
            row.getCell('value').numFmt = '"$"#,##0.00';
          } else if (formatter === 'percentage') {
            row.getCell('value').numFmt = '0.0%';
          } else if (formatter === 'integer') {
            row.getCell('value').numFmt = '0';
          }
          row.getCell('metric').font = { bold: true };
        };

        addMetricRow('Total Sales', salesResult.totalSale, 'currency');
        addMetricRow('Total Cost', salesResult.totalCost, 'currency');
        addMetricRow('Total Profit', salesResult.totalProfit, 'currency');
        addMetricRow('Total Expenses', expenseResult.totalAmount, 'currency');
        addMetricRow('Total Lab Revenue', labResult.totalAmount, 'currency');
        addMetricRow('Outstanding Debts', debtResult.totals.totalRemaining, 'currency');
        addMetricRow('Loss Transactions', salesResult.lossCount, 'integer');
        addMetricRow('Loss Impact', lossAmount, 'currency');
        addMetricRow('Profit Margin', profitMargin, 'percentage');

        overviewSheet.addRow({});
        overviewSheet.addRow({
          metric: 'Filters Applied',
          value: startDate || endDate ? `${startDate || 'Any'} → ${endDate || 'Any'}` : 'All time',
          notes: effectiveStaffId ? `Staff filter: ${effectiveStaffId}` : 'All staff',
        });

        const monthlySheet = workbook.addWorksheet('Monthly Performance', {
          views: [{ state: 'frozen', ySplit: 1 }],
        });

        monthlySheet.columns = [
          { header: 'Month', key: 'month', width: 18 },
          { header: 'Sales', key: 'sales', width: 16, style: { numFmt: '"$"#,##0.00' } },
          { header: 'Cost', key: 'cost', width: 16, style: { numFmt: '"$"#,##0.00' } },
          { header: 'Expenses', key: 'expenses', width: 16, style: { numFmt: '"$"#,##0.00' } },
          { header: 'Profit', key: 'profit', width: 16, style: { numFmt: '"$"#,##0.00' } },
        ];

        styleHeaderRow(monthlySheet.getRow(1), 'FF1D4ED8');

        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        for (let i = 5; i >= 0; i -= 1) {
          const date = new Date();
          date.setMonth(date.getMonth() - i);
          const monthIndex = date.getMonth();
          const year = date.getFullYear();

          const monthlySales = salesResult.transactions.filter((transaction) => {
            const created = transaction.createdAt ? new Date(transaction.createdAt) : null;
            return created && created.getMonth() === monthIndex && created.getFullYear() === year;
          });
          const monthlyExpenses = expenseResult.expenses.filter((expense) => {
            const expDate = expense.date ? new Date(expense.date) : null;
            return expDate && expDate.getMonth() === monthIndex && expDate.getFullYear() === year;
          });

          const salesTotal = monthlySales.reduce(
            (sum, record) => sum + Number(record.total_sale || 0),
            0
          );
          const profitTotal = monthlySales.reduce(
            (sum, record) => sum + Number(record.profit || 0),
            0
          );
          const costTotal = monthlySales.reduce(
            (sum, record) =>
              sum + (Number(record.total_sale || 0) - Number(record.profit || 0)),
            0
          );
          const expensesTotal = monthlyExpenses.reduce(
            (sum, record) => sum + Number(record.amount || 0),
            0
          );

          monthlySheet.addRow({
            month: `${months[monthIndex]} ${year}`,
            sales: salesTotal,
            cost: costTotal,
            expenses: expensesTotal,
            profit: profitTotal,
          });
        }

        await buildStaffSheet(salesResult.transactions, labResult.records);
      };

      if (normalizedType === 'overview') {
        await buildOverviewSheets();
      } else if (normalizedType === 'sales') {
        await buildSalesSheet();
      } else if (normalizedType === 'lab') {
        await buildLabSheet();
      } else if (normalizedType === 'expenses') {
        await buildExpenseSheet();
      } else if (normalizedType === 'debts') {
        await buildDebtSheet();
      } else if (normalizedType === 'medicines') {
        await buildMedicineSheet();
      } else if (normalizedType === 'staff') {
        const salesResult = await buildSalesSheet();
        const labResult = await buildLabSheet();
        const removable = ['Sales', 'Lab Reports'];
        removable.forEach((name) => {
          const worksheet = workbook.getWorksheet(name);
          if (worksheet) {
            workbook.removeWorksheet(worksheet.id);
          }
        });
        await buildStaffSheet(salesResult.transactions, labResult.records);
      } else if (normalizedType === 'transactions') {
        await buildSalesSheet();
        await buildLabSheet();
      } else {
        return res.status(400).json({ message: 'Unknown export type requested.' });
      }

      const buffer = await workbook.xlsx.writeBuffer();
      const safeType = normalizedType.replace(/[^a-z0-9_-]/gi, '_');

      res.setHeader(
        'Content-Disposition',
        `attachment; filename="reports_${safeType}_${Date.now()}.xlsx"`
      );
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );

      return res.send(Buffer.from(buffer));
    } catch (error) {
      console.error('Error exporting reports:', error);
      return res
        .status(500)
        .json({ message: error.message || 'Failed to export report.' });
    }
  }
);

export default router;





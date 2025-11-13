import express from 'express';
import ExcelJS from 'exceljs';
import { protect, requireAnyPermission } from '../middleware/auth.js';
import {
  fetchTransactions,
  fetchTransactionById,
  formatTransaction,
} from '../services/transactionLedgerService.js';

const router = express.Router();

router.use(protect);

const requireTransactionsView = requireAnyPermission(
  'transactions:view',
  'sales:view',
  'lab:view'
);

const parsePagination = (value, fallback) => {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

router.get('/', requireTransactionsView, async (req, res) => {
  try {
    const {
      page = '1',
      limit = '20',
      sort = 'desc',
      search,
      type,
      status,
      startDate,
      endDate,
      staffId,
    } = req.query;

    const result = await fetchTransactions({
      user: req.user,
      tenantScopeIds: req.tenantScopeIds,
      query: {
        search,
        type,
        status,
        startDate,
        endDate,
        staffId,
      },
      page: parsePagination(page, 1),
      limit: Math.min(parsePagination(limit, 20), 200),
      sortDir: sort === 'asc' ? 'asc' : 'desc',
    });

    res.json(result);
  } catch (error) {
    console.error('Failed to list transactions:', error);
    res.status(500).json({ message: error.message || 'Failed to load transactions.' });
  }
});

router.get(
  '/export/excel',
  requireAnyPermission('transactions:export', 'transactions:view'),
  async (req, res) => {
    try {
      const { sort = 'desc', search, type, status, startDate, endDate, staffId } = req.query;

      const result = await fetchTransactions({
        user: req.user,
        tenantScopeIds: req.tenantScopeIds,
        query: {
          search,
          type,
          status,
          startDate,
          endDate,
          staffId,
        },
        page: 1,
        limit: 5000,
        sortDir: sort === 'asc' ? 'asc' : 'desc',
      });

      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Kulmis Pharmacy & Laboratory';
      workbook.created = new Date();

      const sheet = workbook.addWorksheet('Transactions', {
        views: [{ state: 'frozen', ySplit: 1 }],
      });

      sheet.columns = [
        { header: 'Transaction ID', key: 'id', width: 26 },
        { header: 'Invoice #', key: 'invoice_number', width: 18 },
        { header: 'Date', key: 'date', width: 20, style: { numFmt: 'mm/dd/yyyy hh:mm' } },
        { header: 'Type', key: 'type', width: 16 },
        { header: 'Customer / Patient', key: 'customer', width: 28 },
        { header: 'Amount', key: 'amount', width: 14, style: { numFmt: '"$"#,##0.00' } },
        { header: 'Profit', key: 'profit', width: 14, style: { numFmt: '"$"#,##0.00' } },
        { header: 'Loss', key: 'loss', width: 14, style: { numFmt: '"$"#,##0.00' } },
        { header: 'Handled By', key: 'handled_by', width: 24 },
        { header: 'Status', key: 'status', width: 14 },
      ];

      result.results.forEach((txn) => {
        sheet.addRow({
          id: txn.id,
          invoice_number: txn.invoice_number || '—',
          date: txn.createdAt ? new Date(txn.createdAt) : null,
          type: txn.transaction_type,
          customer: txn.customer_name || '—',
          amount: txn.amount || 0,
          profit: txn.profit || 0,
          loss: txn.loss || 0,
          handled_by: txn.handled_by?.name
            ? `${txn.handled_by.name}${txn.handled_by.role ? ` (${txn.handled_by.role})` : ''}`
            : '—',
          status: txn.status || 'success',
        });
      });

      if (result.results.length === 0) {
        const row = sheet.addRow(['No transactions found for the selected filters.']);
        sheet.mergeCells(row.number, 1, row.number, sheet.columnCount || 1);
        row.font = { italic: true, color: { argb: 'FF6B7280' } };
        row.alignment = { horizontal: 'center' };
      }

      const buffer = await workbook.xlsx.writeBuffer();

      res.setHeader(
        'Content-Disposition',
        `attachment; filename="transactions_${Date.now()}.xlsx"`
      );
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );

      res.send(Buffer.from(buffer));
    } catch (error) {
      console.error('Failed to export transactions:', error);
      res.status(500).json({ message: error.message || 'Failed to export transactions.' });
    }
  }
);

router.get('/:id', requireTransactionsView, async (req, res) => {
  try {
    const transaction = await fetchTransactionById({
      user: req.user,
      tenantScopeIds: req.tenantScopeIds,
      id: req.params.id,
    });

    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }

    res.json(transaction);
  } catch (error) {
    console.error('Failed to fetch transaction:', error);
    res.status(500).json({ message: error.message || 'Failed to load transaction.' });
  }
});

export default router;


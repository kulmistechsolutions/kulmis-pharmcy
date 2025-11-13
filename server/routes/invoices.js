import express from 'express';
import { protect, requirePermission } from '../middleware/auth.js';
import '../models/Patient.js';
import '../models/LabOrder.js';
import {
  fetchInvoices,
  fetchInvoiceById,
  generateInvoicesPDF,
  generateInvoicesExcel,
  fetchInvoiceByNumber,
} from '../services/invoiceService.js';

const router = express.Router();

const buildFilters = (query = {}) => {
  const { search, type, status, startDate, endDate, sort } = query;
  return {
    search,
    type,
    status,
    startDate,
    endDate,
    sort,
  };
};

router.get('/export/pdf', protect, requirePermission('invoices:export'), async (req, res) => {
  try {
    const invoices = await fetchInvoices({ user: req.user, filters: buildFilters(req.query) });
    const buffer = await generateInvoicesPDF(invoices);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="invoices_${Date.now()}.pdf"`);
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/export/excel', protect, requirePermission('invoices:export'), async (req, res) => {
  try {
    const invoices = await fetchInvoices({ user: req.user, filters: buildFilters(req.query) });
    const buffer = await generateInvoicesExcel(invoices);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="invoices_${Date.now()}.xlsx"`);
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/:id/export/pdf', protect, requirePermission('invoices:export'), async (req, res) => {
  try {
    const invoice = await fetchInvoiceById({ user: req.user, id: req.params.id });
    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }
    const buffer = await generateInvoicesPDF([invoice]);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${invoice.invoice_number || 'invoice'}.pdf"`);
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/:id/export/excel', protect, requirePermission('invoices:export'), async (req, res) => {
  try {
    const invoice = await fetchInvoiceById({ user: req.user, id: req.params.id });
    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }
    const buffer = await generateInvoicesExcel([invoice]);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${invoice.invoice_number || 'invoice'}.xlsx"`);
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/', protect, requirePermission('invoices:view'), async (req, res) => {
  try {
    const invoices = await fetchInvoices({ user: req.user, filters: buildFilters(req.query) });
    res.json({ invoices });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/lookup/:invoiceNumber', protect, requirePermission('invoices:view'), async (req, res) => {
  try {
    const invoice = await fetchInvoiceByNumber({ user: req.user, number: req.params.invoiceNumber });
    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }
    res.json(invoice);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/:id', protect, requirePermission('invoices:view'), async (req, res) => {
  try {
    const invoice = await fetchInvoiceById({ user: req.user, id: req.params.id });
    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }
    res.json(invoice);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;


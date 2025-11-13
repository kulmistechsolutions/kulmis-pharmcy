import express from 'express';
import { body, validationResult } from 'express-validator';
import Medicine from '../models/Medicine.js';
import { protect, requirePermission, requireAnyPermission, requireOwner } from '../middleware/auth.js';
import multer from 'multer';
import XLSX from 'xlsx';

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

// @route   GET /api/medicines
// @desc    Get all medicines
// @access  Private
router.get('/', protect, requireAnyPermission('medicines:view', 'sales:view'), async (req, res) => {
  try {
    const { q, category, stock } = req.query;
    const scopeIds = req.tenantScopeIds;
    const query = scopeIds ? { user_id: { $in: scopeIds } } : {};

    if (q) {
      query.$or = [
        { name: { $regex: q, $options: 'i' } },
        { batch: { $regex: q, $options: 'i' } },
      ];
    }

    if (category) {
      query.category = category;
    }

    const medicines = await Medicine.find(query).sort({ createdAt: -1 });

    // Filter by stock status if needed
    let filtered = medicines;
    if (stock === 'low') {
      filtered = medicines.filter((m) => m.quantity < 10);
    } else if (stock === 'out') {
      filtered = medicines.filter((m) => m.quantity === 0);
    } else if (stock === 'expired') {
      const now = new Date();
      filtered = medicines.filter((m) => new Date(m.expiry_date) < now);
    }

    res.json(filtered);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   POST /api/medicines
// @desc    Create a new medicine
// @access  Private
router.post(
  '/',
  protect,
  requireOwner(),
  requirePermission('medicines:create'),
  [
    body('name').trim().notEmpty().withMessage('Medicine name is required'),
    body('batch').optional().trim(),
    body('expiry_date').notEmpty().withMessage('Expiry date is required'),
    body('quantity').isInt({ min: 0 }).withMessage('Quantity must be a positive number'),
    body('buying_price').isFloat({ min: 0 }).withMessage('Buying price must be positive'),
    body('selling_price').isFloat({ min: 0 }).withMessage('Selling price must be positive'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const ownerId = req.accountId || req.user._id;
      const medicine = await Medicine.create({
        ...req.body,
        user_id: ownerId,
      });

      res.status(201).json(medicine);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

// @route   PUT /api/medicines/:id
// @desc    Update medicine
// @access  Private
router.put('/:id', protect, requireOwner(), requirePermission('medicines:edit'), async (req, res) => {
  try {
    const ownerId = req.accountId || req.user._id;
    const medicine = await Medicine.findOneAndUpdate(
      { _id: req.params.id, user_id: ownerId },
      req.body,
      { new: true, runValidators: true }
    );

    if (!medicine) {
      return res.status(404).json({ message: 'Medicine not found' });
    }

    res.json(medicine);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   DELETE /api/medicines/:id
// @desc    Delete medicine
// @access  Private
router.delete('/:id', protect, requireOwner(), requirePermission('medicines:delete'), async (req, res) => {
  try {
    const ownerId = req.accountId || req.user._id;
    const medicine = await Medicine.findOneAndDelete({
      _id: req.params.id,
      user_id: ownerId,
    });

    if (!medicine) {
      return res.status(404).json({ message: 'Medicine not found' });
    }

    res.json({ message: 'Medicine deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/medicines/template
// @desc    Download Excel template for medicines import
// @access  Private
router.get('/template/download', protect, requireAnyPermission('medicines:view', 'sales:view'), async (_req, res) => {
  try {
    const workbook = XLSX.utils.book_new();
    const templateData = [
      [
        'Name *',
        'Batch Number',
        'Expiry Date (YYYY-MM-DD) *',
        'Quantity *',
        'Buying Price *',
        'Selling Price *',
        'Category',
      ],
      ['Paracetamol 500mg', 'BATCH-123', '2026-01-31', 50, 3.5, 5, 'Pain Relief'],
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(templateData);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Medicines Template');

    const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
    res.setHeader('Content-Disposition', 'attachment; filename="medicines_template.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/medicines/export
// @desc    Export all medicines to Excel
// @access  Private
router.get('/export', protect, requireAnyPermission('medicines:view', 'sales:view'), async (req, res) => {
  try {
    const scopeIds = req.tenantScopeIds;
    const query = scopeIds ? { user_id: { $in: scopeIds } } : {};
    const medicines = await Medicine.find(query).sort({ name: 1 });

    if (!medicines.length) {
      return res.status(404).json({ message: 'No medicines found to export' });
    }

    const rows = medicines.map((medicine) => ({
      Name: medicine.name,
      'Batch Number': medicine.batch || '',
      'Expiry Date': medicine.expiry_date ? new Date(medicine.expiry_date).toISOString().split('T')[0] : '',
      Quantity: medicine.quantity,
      'Buying Price': medicine.buying_price,
      'Selling Price': medicine.selling_price,
      Category: medicine.category || '',
      'Created At': medicine.createdAt ? new Date(medicine.createdAt).toLocaleString() : '',
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Medicines');

    const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
    res.setHeader('Content-Disposition', 'attachment; filename="medicines_export.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   POST /api/medicines/import
// @desc    Import medicines from Excel file
// @access  Private
router.post(
  '/import',
  protect,
  requireOwner(),
  requireAnyPermission('medicines:create', 'medicines:edit'),
  upload.single('file'),
  async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'Please upload an Excel file' });
  }

  try {
    const ownerId = req.accountId || req.user._id;
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    if (!worksheet) {
      return res.status(400).json({ message: 'Uploaded file does not contain any data' });
    }

    const rows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

    if (!rows.length) {
      return res.status(400).json({ message: 'No rows found in the uploaded file' });
    }

    const createdMedicines = [];
    const errors = [];

    rows.forEach((row, index) => {
      const lineNumber = index + 2; // Account for header row
      const name = (row['Name'] || row['Name *'] || '').toString().trim();
      const batch = (row['Batch Number'] || '').toString().trim();
      const expiryRaw =
        row['Expiry Date'] || row['Expiry Date (YYYY-MM-DD)'] || row['Expiry Date (YYYY-MM-DD) *'] || '';
      const quantityRaw = row['Quantity'] || row['Quantity *'] || '';
      const buyingRaw = row['Buying Price'] || row['Buying Price *'] || '';
      const sellingRaw = row['Selling Price'] || row['Selling Price *'] || '';
      const category = (row['Category'] || '').toString().trim();

      if (!name) {
        errors.push({ line: lineNumber, message: 'Name is required' });
        return;
      }

      if (!expiryRaw) {
        errors.push({ line: lineNumber, message: 'Expiry date is required' });
        return;
      }

      const expiryDate = new Date(expiryRaw);
      if (Number.isNaN(expiryDate.getTime())) {
        errors.push({ line: lineNumber, message: 'Expiry date must be a valid date (YYYY-MM-DD)' });
        return;
      }

      const quantity = parseInt(quantityRaw, 10);
      if (Number.isNaN(quantity) || quantity < 0) {
        errors.push({ line: lineNumber, message: 'Quantity must be a non-negative number' });
        return;
      }

      const buyingPrice = parseFloat(buyingRaw);
      if (Number.isNaN(buyingPrice) || buyingPrice < 0) {
        errors.push({ line: lineNumber, message: 'Buying price must be a non-negative number' });
        return;
      }

      const sellingPrice = parseFloat(sellingRaw);
      if (Number.isNaN(sellingPrice) || sellingPrice < 0) {
        errors.push({ line: lineNumber, message: 'Selling price must be a non-negative number' });
        return;
      }

      createdMedicines.push({
        name,
        batch: batch || undefined,
        expiry_date: expiryDate,
        quantity,
        buying_price: buyingPrice,
        selling_price: sellingPrice,
        category: category || undefined,
        user_id: ownerId,
      });
    });

    if (!createdMedicines.length) {
      return res.status(400).json({
        message: 'No valid medicine rows found in file',
        errors,
      });
    }

    await Medicine.insertMany(createdMedicines, { ordered: false });

    res.status(201).json({
      message: `Imported ${createdMedicines.length} medicines successfully`,
      summary: {
        inserted: createdMedicines.length,
        errors,
      },
    });
  } catch (error) {
    console.error('Error importing medicines:', error);
    res.status(500).json({ message: error.message });
  }
});

export default router;


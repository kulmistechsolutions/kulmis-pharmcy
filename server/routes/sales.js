import express from 'express';
import { body, validationResult } from 'express-validator';
import Transaction from '../models/Transaction.js';
import Medicine from '../models/Medicine.js';
import Invoice from '../models/Invoice.js';
import { protect, requirePermission } from '../middleware/auth.js';
import { createActivityLog, emitTenantEvent, emitUserEvent } from '../services/realtimeService.js';
import { recordTransaction } from '../services/transactionLedgerService.js';

const router = express.Router();

// @route   POST /api/sales
// @desc    Create a new sale
// @access  Private
router.post(
  '/',
  protect,
  requirePermission('sales:create'),
  [
    body('items').isArray({ min: 1 }).withMessage('At least one item is required'),
    body('items.*.medicine_id').notEmpty().withMessage('Medicine ID is required'),
    body('items.*.quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
    body('items.*.selling_price')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Selling price must be greater than or equal to 0'),
    body('items.*.allow_loss')
      .optional()
      .isBoolean()
      .withMessage('allow_loss must be a boolean value'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { items, customer_name, payment_method, discount = 0 } = req.body;
      const actorId = req.user?._id;
      const actorName =
        req.user?.pharmacyName ||
        req.user?.name ||
        req.user?.fullName ||
        req.user?.email ||
        'Team Member';
      const actorRole = req.user?.role || 'staff';

      // Process each item
      const transactions = [];
      const invoiceItems = [];
      const itemDetails = [];
      let totalProfit = 0;
      let totalCost = 0;
      let subtotal = 0;
      const lossItems = [];
      const zeroProfitItems = [];

      const ownerId = req.accountId || req.user._id;

      for (const item of items) {
        const medicine = await Medicine.findOne({
          _id: item.medicine_id,
          user_id: ownerId,
        });

        if (!medicine) {
          return res.status(404).json({ message: `Medicine ${item.medicine_id} not found` });
        }

        if (medicine.quantity < item.quantity) {
          return res.status(400).json({
            message: `Insufficient stock for ${medicine.name}. Available: ${medicine.quantity}`,
          });
        }

        const requestedSellingPrice =
          typeof item.selling_price === 'number'
            ? item.selling_price
            : typeof item.price === 'number'
            ? item.price
            : medicine.selling_price;

        const sellingPrice = Number.isFinite(requestedSellingPrice)
          ? requestedSellingPrice
          : medicine.selling_price;

        const allowLoss =
          item.allow_loss === true ||
          item.allow_loss === 'true' ||
          item.loss_override === true ||
          item.loss_override === 'true';

        if (sellingPrice < medicine.buying_price && !allowLoss) {
          return res.status(400).json({
            message: `Selling price for ${medicine.name} is below buying price. Confirmation required.`,
            code: 'LOSS_NOT_CONFIRMED',
            medicine: medicine.name,
            buying_price: medicine.buying_price,
            attempted_price: sellingPrice,
          });
        }

        const totalSale = sellingPrice * item.quantity;
        const totalCostForItem = medicine.buying_price * item.quantity;
        const profit = (sellingPrice - medicine.buying_price) * item.quantity;
        const isLossSale = sellingPrice < medicine.buying_price;
        const isZeroProfit = sellingPrice === medicine.buying_price;

        // Create transaction
        const transaction = await Transaction.create({
          user_id: ownerId,
          medicine_id: medicine._id,
          quantity: item.quantity,
          total_sale: totalSale,
          buying_price: medicine.buying_price,
          selling_price: sellingPrice,
          profit,
          is_loss_sale: isLossSale,
          customer_name,
          payment_method: payment_method || 'Cash',
          processed_by_id: actorId,
          processed_by_name: actorName,
          processed_by_role: actorRole,
          user_name: actorName,
        });

        transactions.push(transaction);
        itemDetails.push({
          transaction_id: transaction._id.toString(),
          medicine: medicine.name,
          buying_price: medicine.buying_price,
          selling_price: sellingPrice,
          quantity: item.quantity,
          profit,
          is_loss: isLossSale,
        });

        // Update medicine stock
        medicine.quantity -= item.quantity;
        await medicine.save();

        // Add to invoice items
        invoiceItems.push({
          title: medicine.name,
          qty: item.quantity,
          price: sellingPrice,
          total: totalSale,
        });

        subtotal += totalSale;
        totalProfit += profit;
        totalCost += totalCostForItem;

        if (isLossSale) {
          lossItems.push({
            medicine: medicine.name,
            buying_price: medicine.buying_price,
            selling_price: sellingPrice,
            quantity: item.quantity,
          });
        } else if (isZeroProfit) {
          zeroProfitItems.push({
            medicine: medicine.name,
            price: sellingPrice,
            quantity: item.quantity,
          });
        }
      }

      // Create invoice
      const total = subtotal - discount;
      const invoice = await Invoice.create({
        user_id: ownerId,
        type: 'pharmacy',
        customer_name: customer_name || 'Walk-in Customer',
        payment_method: payment_method || 'Cash',
        items: invoiceItems,
        subtotal,
        discount,
        tax: 0,
        total,
        status: 'Paid',
        meta: {
          source: 'sales',
        },
        user_name: actorName,
        user_role: actorRole,
        processed_by_id: actorId,
      });

      try {
        await recordTransaction({
          tenantId: ownerId,
          invoiceId: invoice._id,
          invoiceNumber: invoice.invoice_number,
          transactionType: 'sale',
          amount: total,
          profit: totalProfit,
          loss: lossItems.reduce((sum, item) => {
            const perUnitLoss = Math.max(0, item.buying_price - item.selling_price);
            return sum + perUnitLoss * item.quantity;
          }, 0),
          customerName: customer_name || 'Walk-in Customer',
          handledBy: {
            id: actorId,
            name: actorName,
            role: actorRole,
          },
          status: 'success',
          paymentMethod: payment_method || 'Cash',
          meta: {
            item_count: items.length,
            discount,
            loss_items: lossItems,
            zero_profit_items: zeroProfitItems,
          },
          app: req.app,
        });
      } catch (ledgerError) {
        console.error('Failed to record sale transaction ledger entry:', ledgerError);
      }

      const tenantId = ownerId ? ownerId.toString() : null;
      const saleEventPayload = {
        type: 'sale.created',
        amount: total,
        profit: totalProfit,
        cost: totalCost,
        loss: {
          count: lossItems.length,
          amount: lossItems.reduce((sum, item) => {
            const perUnitLoss = item.buying_price - item.selling_price;
            return perUnitLoss > 0 ? sum + perUnitLoss * item.quantity : sum;
          }, 0),
        },
        user: {
          id: actorId?.toString(),
          name: actorName,
          role: actorRole,
        },
        invoice: {
          id: invoice._id.toString(),
          number: invoice.invoice_number,
          createdAt: invoice.createdAt,
          customer: invoice.customer_name,
        },
        items: invoiceItems.length,
      };

      if (tenantId) {
        emitTenantEvent(req.app, tenantId, 'dashboard:metrics', saleEventPayload);
        emitTenantEvent(req.app, tenantId, 'sales:created', saleEventPayload);
      }

      if (actorId) {
        emitUserEvent(req.app, actorId, 'activity:ack', saleEventPayload);
      }

      await createActivityLog({
        tenantId,
        userId: actorId,
        userName: actorName,
        userRole: actorRole,
        module: 'sales',
        action: lossItems.length > 0 ? 'sale_loss' : 'sale_created',
        message:
          lossItems.length > 0
            ? `${actorName} processed a loss sale for ${customer_name || 'Walk-in Customer'}`
            : `${actorName} processed a sale for ${customer_name || 'Walk-in Customer'}`,
        amount: total,
        metadata: {
          invoice_id: invoice._id.toString(),
          transaction_ids: transactions.map((t) => t._id.toString()),
          item_count: items.length,
          total_profit: totalProfit,
          total_cost: totalCost,
          loss_items: lossItems,
          zero_profit_items: zeroProfitItems,
          items: itemDetails,
        },
      });

      res.status(201).json({
        transactions,
        invoice,
        totalProfit,
        totalCost,
        lossItems,
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

// @route   GET /api/sales
// @desc    Get all sales/transactions
// @access  Private
router.get('/', protect, requirePermission('sales:view'), async (req, res) => {
  try {
    const { date, startDate, endDate, staffId } = req.query;
    const scopeIds = req.tenantScopeIds;
    const query = scopeIds ? { user_id: { $in: scopeIds } } : {};

    const isSuperAdmin = req.user.role === 'super_admin';
    const isOwner = req.user.role === 'pharmacy_owner';
    const isStaff = req.user.role === 'staff';

    let effectiveStaffId = typeof staffId === 'string' && staffId.trim().length ? staffId.trim() : null;

    if (isStaff) {
      effectiveStaffId = req.user._id.toString();
    }

    if (effectiveStaffId) {
      if (
        isSuperAdmin ||
        isOwner ||
        (isStaff && effectiveStaffId === req.user._id.toString())
      ) {
        query.processed_by_id = effectiveStaffId;
      } else {
        return res.status(403).json({
          message: 'You are not allowed to view sales for the selected staff member.',
        });
      }
    }

    if (date) {
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(date);
      end.setHours(23, 59, 59, 999);
      query.createdAt = { $gte: start, $lte: end };
    } else if (startDate && endDate) {
      query.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    const transactions = await Transaction.find(query)
      .populate('medicine_id', 'name')
      .sort({ createdAt: -1 });

    res.json(transactions);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;


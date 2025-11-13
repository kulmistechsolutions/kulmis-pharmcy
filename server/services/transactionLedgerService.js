import mongoose from 'mongoose';
import Transaction from '../models/Transaction.js';
import { emitTenantEvent } from './realtimeService.js';

const toObjectId = (value) => {
  if (!value) return undefined;
  if (value instanceof mongoose.Types.ObjectId) return value;
  try {
    return new mongoose.Types.ObjectId(value);
  } catch {
    return undefined;
  }
};

export const recordTransaction = async ({
  tenantId,
  invoiceId,
  invoiceNumber,
  transactionType,
  amount = 0,
  profit = 0,
  loss = 0,
  customerName = '',
  handledBy = {},
  status = 'success',
  paymentMethod,
  notes,
  meta = {},
  app = null,
}) => {
  if (!tenantId) {
    throw new Error('tenantId is required to record a transaction');
  }

  const handledById = handledBy?.id || handledBy?._id;
  const handledName =
    handledBy?.name ||
    handledBy?.fullName ||
    handledBy?.pharmacyName ||
    handledBy?.email ||
    handledBy?.phone ||
    handledBy?.user_name ||
    null;
  const handledRole = handledBy?.role || handledBy?.user_role || handledBy?.processed_by_role || null;

  const payload = {
    tenant_id: toObjectId(tenantId),
    user_id: toObjectId(tenantId),
    invoice_id: toObjectId(invoiceId),
    invoice_number: invoiceNumber,
    transaction_type: transactionType,
    amount,
    profit_total: profit,
    loss_total: loss,
    customer_name: customerName,
    handled_by_id: toObjectId(handledById),
    handled_by_name: handledName,
    handled_by_role: handledRole,
    processed_by_id: toObjectId(handledById),
    processed_by_name: handledName,
    processed_by_role: handledRole,
    status,
    payment_method: paymentMethod,
    notes,
    meta,
    total_sale: amount,
  };

  let doc;
  if (invoiceId) {
    doc = await Transaction.findOneAndUpdate(
      { invoice_id: toObjectId(invoiceId) },
      {
        $set: {
          ...payload,
          updatedAt: new Date(),
        },
        $setOnInsert: {
          createdAt: new Date(),
        },
      },
      { new: true, upsert: true }
    );
  } else {
    doc = await Transaction.create(payload);
  }

  if (app && tenantId) {
    emitTenantEvent(app, tenantId.toString(), 'transactions:new', {
      transaction: formatTransaction(doc),
    });
  }

  return doc;
};

export const formatTransaction = (doc) => {
  if (!doc) return null;
  const source = doc.toObject ? doc.toObject({ virtuals: true }) : doc;
  return {
    id: source._id?.toString?.(),
    invoice_id: source.invoice_id,
    invoice_number: source.invoice_number,
    transaction_type: source.transaction_type,
    amount: Number(source.amount || source.total_sale || 0),
    profit: Number(
      source.profit_total ??
        source.profit ??
        0
    ),
    loss: Number(source.loss_total || (source.is_loss_sale ? Math.abs(source.profit || 0) : 0)),
    customer_name: source.customer_name || '',
    handled_by: {
      id: source.handled_by_id || source.processed_by_id,
      name: source.handled_by_name || source.processed_by_name || source.user_name,
      role: source.handled_by_role || source.processed_by_role,
    },
    status: source.status || 'success',
    createdAt: source.createdAt,
    updatedAt: source.updatedAt,
    payment_method: source.payment_method,
    notes: source.notes || '',
    meta: source.meta || {},
  };
};

const buildFilterQuery = ({ tenantScopeIds, query = {}, user }) => {
  const filters = { transaction_type: { $exists: true } };

  if (Array.isArray(tenantScopeIds) && tenantScopeIds.length > 0) {
    filters.tenant_id = { $in: tenantScopeIds.map((id) => toObjectId(id)) };
  }

  if (query.type && query.type !== 'all') {
    filters.transaction_type = query.type;
  }

  if (query.status && query.status !== 'all') {
    filters.status = query.status;
  }

  if (query.startDate || query.endDate) {
    filters.createdAt = {};
    if (query.startDate) {
      filters.createdAt.$gte = new Date(query.startDate);
    }
    if (query.endDate) {
      const end = new Date(query.endDate);
      end.setHours(23, 59, 59, 999);
      filters.createdAt.$lte = end;
    }
  }

  if (query.staffId && query.staffId !== 'all') {
    filters.$or = [
      { handled_by_id: toObjectId(query.staffId) },
      { processed_by_id: toObjectId(query.staffId) },
    ];
  } else if (user?.role === 'staff') {
    const id = user._id?.toString();
    filters.$or = [
      { handled_by_id: toObjectId(id) },
      { processed_by_id: toObjectId(id) },
    ];
  }

  if (query.search) {
    const regex = new RegExp(query.search, 'i');
    filters.$and = [
      {
        $or: [
          { invoice_number: regex },
          { customer_name: regex },
          { handled_by_name: regex },
          { 'meta.reference': regex },
        ],
      },
    ];
  }

  return filters;
};

export const fetchTransactions = async ({
  user,
  tenantScopeIds,
  query,
  page = 1,
  limit = 20,
  sortDir = 'desc',
}) => {
  const filters = buildFilterQuery({ tenantScopeIds, query, user });

  const skip = (page - 1) * limit;
  const sort = sortDir === 'asc' ? 1 : -1;

  const [total, rows] = await Promise.all([
    Transaction.countDocuments(filters),
    Transaction.find(filters)
      .sort({ createdAt: sort })
      .skip(skip)
      .limit(limit),
  ]);

  return {
    total,
    page,
    pages: Math.max(1, Math.ceil(total / limit)),
    results: rows.map(formatTransaction),
  };
};

export const fetchTransactionById = async ({ user, tenantScopeIds, id }) => {
  const filters = buildFilterQuery({ tenantScopeIds, query: {}, user });
  filters._id = toObjectId(id);

  const doc = await Transaction.findOne(filters);
  return formatTransaction(doc);
};



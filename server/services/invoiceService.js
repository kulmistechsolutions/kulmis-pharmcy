import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import mongoose from 'mongoose';
import Invoice from '../models/Invoice.js';
import LabInvoice from '../models/LabInvoice.js';
import LabCashierRecord from '../models/LabCashierRecord.js';
import PharmacySetting from '../models/PharmacySetting.js';
import User from '../models/User.js';

const formatCurrency = (value = 0) => {
  return `$${Number(value || 0).toFixed(2)}`;
};

const normalizeStatus = (status) => {
  if (!status) return 'Pending';
  const lower = status.toString().toLowerCase();
  if (lower === 'paid' || lower === 'complete') return 'Paid';
  if (lower === 'pending' || lower === 'process') return 'Pending';
  if (lower === 'cancelled' || lower === 'void') return 'Cancelled';
  return status;
};

const resolvePerformer = (input = {}) => {
  const meta = input.meta && typeof input.meta.get === 'function'
    ? Object.fromEntries(input.meta)
    : input.meta || {};

  const name =
    input.user_name ||
    input.processed_by_name ||
    input.cashier_name ||
    input.staff_name ||
    meta.cashier ||
    meta.processed_by ||
    input.cashierName ||
    null;

  const role =
    input.user_role ||
    input.processed_by_role ||
    input.staff_role ||
    meta.role ||
    input.role ||
    null;

  return {
    name: (name || '').toString().trim() || 'Team Member',
    role: (role || '').toString().trim() || 'staff',
  };
};

const toObjectIdString = (value) => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (mongoose.Types.ObjectId.isValid(value)) {
    return value.toString();
  }
  if (typeof value === 'object') {
    if (value._id) return toObjectIdString(value._id);
    if (value.id) return toObjectIdString(value.id);
  }
  if (value instanceof Date) return '';
  return value.toString ? value.toString() : '';
};

const buildBrandingPayload = (setting, owner) => {
  const fallbackName = owner?.pharmacyName || 'Kulmis Pharmacy & Laboratory';
  const fallbackPhone = owner?.phone || '';
  const fallbackEmail = owner?.email || '';

  return {
    pharmacyId: owner?._id?.toString?.() || '',
    name: setting?.name || fallbackName,
    phone: setting?.phone || fallbackPhone,
    email: setting?.email || fallbackEmail,
    address: setting?.address || '',
    about: setting?.about || '',
    owner_name: setting?.owner_name || '',
    logo_url: setting?.logo_url || '',
    logo_thumbnail_url: setting?.logo_thumbnail_url || '',
  };
};

const attachBrandingToInvoices = async (records = []) => {
  if (!records.length) {
    return [];
  }

  const ownerIds = Array.from(
    new Set(
      records
        .map((record) => toObjectIdString(record.owner_id || record.user_id || record.user?.id))
        .filter((id) => mongoose.Types.ObjectId.isValid(id))
    )
  );

  if (!ownerIds.length) {
    return records.map((record) => ({
      ...record,
      branding: buildBrandingPayload(null, null),
    }));
  }

  const [settingsDocs, ownerDocs] = await Promise.all([
    PharmacySetting.find({ pharmacy: { $in: ownerIds } }).lean(),
    User.find({ _id: { $in: ownerIds } }).select('pharmacyName email phone').lean(),
  ]);

  const settingsMap = new Map(settingsDocs.map((doc) => [doc.pharmacy.toString(), doc]));
  const ownerMap = new Map(ownerDocs.map((doc) => [doc._id.toString(), doc]));

  return records.map((record) => {
    const ownerId = toObjectIdString(record.owner_id || record.user_id);
    const setting = settingsMap.get(ownerId);
    const owner = ownerMap.get(ownerId);
    return {
      ...record,
      branding: buildBrandingPayload(setting, owner),
    };
  });
};

const loadLogoAssets = async (invoices = []) => {
  const cache = new Map();

  for (const invoice of invoices) {
    const logoUrl = invoice?.branding?.logo_url;
    if (!logoUrl || cache.has(logoUrl)) {
      continue;
    }

    try {
      const response = await fetch(logoUrl);
      if (!response.ok) {
        cache.set(logoUrl, null);
        continue;
      }
      const arrayBuffer = await response.arrayBuffer();
      cache.set(logoUrl, Buffer.from(arrayBuffer));
    } catch (error) {
      console.warn('Failed to fetch logo for invoice branding:', error.message);
      cache.set(logoUrl, null);
    }
  }

  return cache;
};

const salesInvoiceToDTO = (invoice) => {
  const performer = resolvePerformer(invoice);

  return {
    owner_id: toObjectIdString(invoice.user_id),
    id: invoice._id.toString(),
    invoice_id: invoice._id.toString(),
    invoice_number: invoice.invoice_number,
    type: 'pharmacy',
    customer: invoice.customer_name || invoice.patient_id?.name || 'Walk-in Customer',
    diseases: [],
    sample_type: null,
    amount: invoice.total || 0,
    status: normalizeStatus(invoice.status),
    date: invoice.createdAt,
    items: invoice.items || [],
    payment_method: invoice.payment_method || 'Cash',
    subtotal: invoice.subtotal || 0,
    discount: invoice.discount || 0,
    tax: invoice.tax || 0,
    meta: invoice.meta || {},
    processed_by_name: performer.name,
    processed_by_role: performer.role,
    user_name: performer.name,
    user_role: performer.role,
  };
};

const labRecordToDTO = (record, invoice) => {
  const recordPerformer = resolvePerformer(record);
  const invoicePerformer = invoice ? resolvePerformer(invoice) : recordPerformer;

  return {
    owner_id: toObjectIdString(record.user_id || invoice?.user_id),
    id: record._id.toString(),
    invoice_id: invoice?._id?.toString?.(),
    invoice_number:
      invoice?.invoice_number || record.invoice_number || `INV-${record._id.toString().slice(-6)}`,
    type: 'lab',
    customer: record.patient_name || 'N/A',
    diseases: record.diseases || [],
    sample_type: record.sample_type || 'N/A',
    amount: record.price || 0,
    status: normalizeStatus(record.status === 'complete' ? 'Paid' : record.status),
    date: record.date || record.createdAt,
    items: invoice?.items || [],
    payment_method: 'Cash',
    subtotal: record.price || 0,
    discount: 0,
    tax: 0,
    meta: {
      diseases: record.diseases || [],
    },
    processed_by_name: invoicePerformer.name,
    processed_by_role: invoicePerformer.role,
    user_name: invoicePerformer.name,
    user_role: invoicePerformer.role,
  };
};

export const fetchInvoices = async ({ user, filters = {} }) => {
  const {
    search,
    type,
    status,
    startDate,
    endDate,
    sort = 'desc',
    staffId,
  } = filters;

  const tenantScope =
    Array.isArray(user?.tenantScopeIds) && user.tenantScopeIds.length > 0
      ? user.tenantScopeIds
      : user?.tenantId
      ? [user.tenantId]
      : user?._id
      ? [user._id]
      : [];
  const isSuperAdmin = user?.role === 'super_admin';

  const invoiceQuery = Invoice.find();
  if (!isSuperAdmin && tenantScope.length > 0) {
    invoiceQuery.where('user_id').in(tenantScope);
  }

  if (staffId) {
    invoiceQuery.where('processed_by_id').equals(staffId);
  }

  if (startDate) {
    invoiceQuery.where('createdAt').gte(new Date(startDate));
  }
  if (endDate) {
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    invoiceQuery.where('createdAt').lte(end);
  }

  if (search) {
    invoiceQuery.or([
      { invoice_number: new RegExp(search, 'i') },
      { customer_name: new RegExp(search, 'i') },
    ]);
  }

  if (status) {
    invoiceQuery.where('status').equals(status);
  }

  invoiceQuery.sort({ createdAt: sort === 'asc' ? 1 : -1 });

  const salesInvoices = await invoiceQuery.lean();
  const salesDTO = salesInvoices.map(salesInvoiceToDTO);

  const labQuery = LabCashierRecord.find();

  if (!isSuperAdmin && tenantScope.length > 0) {
    labQuery.where('user_id').in(tenantScope);
  }

  if (staffId) {
    labQuery.where('processed_by_id').equals(staffId);
  }

  if (startDate) {
    labQuery.where('date').gte(new Date(startDate));
  }
  if (endDate) {
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    labQuery.where('date').lte(end);
  }

  const labRecords = await labQuery.lean();

  const recordIds = labRecords.map((record) => record._id);
  const labInvoices = await LabInvoice.find({ record_id: { $in: recordIds } }).lean();
  const invoiceMap = new Map(labInvoices.map((invoice) => [invoice.record_id.toString(), invoice]));

  let labDTO = labRecords
    .filter((record) => record.status === 'complete')
    .map((record) => labRecordToDTO(record, invoiceMap.get(record._id.toString())));

  if (search) {
    const regex = new RegExp(search, 'i');
    labDTO = labDTO.filter(
      (dto) => regex.test(dto.invoice_number) || regex.test(dto.customer) || dto.diseases.some((d) => regex.test(d))
    );
  }

  if (status) {
    labDTO = labDTO.filter((dto) => dto.status.toLowerCase() === status.toLowerCase());
  }

  let combined = [...salesDTO, ...labDTO];

  if (type && type !== 'all') {
    combined = combined.filter((dto) => dto.type === type);
  }

  combined.sort((a, b) => {
    const diff = new Date(a.date).getTime() - new Date(b.date).getTime();
    return sort === 'asc' ? diff : -diff;
  });

  return attachBrandingToInvoices(combined);
};

export const fetchInvoiceById = async ({ user, id }) => {
  if (!id) {
    return null;
  }

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return fetchInvoiceByNumber({ user, number: id });
  }

  const tenantScope =
    Array.isArray(user?.tenantScopeIds) && user.tenantScopeIds.length > 0
      ? user.tenantScopeIds
      : user?.tenantId
      ? [user.tenantId]
      : user?._id
      ? [user._id]
      : [];
  const isSuperAdmin = user?.role === 'super_admin';
  const scope = !isSuperAdmin && tenantScope.length > 0 ? { user_id: { $in: tenantScope } } : {};

  const invoice = await Invoice.findOne({ ...scope, _id: id })
    .populate('patient_id')
    .populate('user_id', 'pharmacyName')
    .lean();

  if (invoice) {
    const payload = {
      ...salesInvoiceToDTO(invoice),
      user: invoice.user_id,
      patient: invoice.patient_id,
    };
    const [enriched] = await attachBrandingToInvoices([payload]);
    return enriched;
  }

  const labRecord = await LabCashierRecord.findOne({
    _id: id,
    ...scope,
  }).lean();

  if (!labRecord) {
    return null;
  }

  const labInvoice = await LabInvoice.findOne({ record_id: labRecord._id }).lean();
  const dto = labRecordToDTO(labRecord, labInvoice);
  const payload = {
    ...dto,
    user: {},
    patient: { name: labRecord.patient_name, phone: labRecord.phone },
  };
  const [enriched] = await attachBrandingToInvoices([payload]);
  return enriched;
};

export const fetchInvoiceByNumber = async ({ user, number }) => {
  const normalizedNumber = typeof number === 'string' ? number.trim() : String(number || '').trim();
  if (!normalizedNumber) {
    return null;
  }

  const tenantScope =
    Array.isArray(user?.tenantScopeIds) && user.tenantScopeIds.length > 0
      ? user.tenantScopeIds
      : user?.tenantId
      ? [user.tenantId]
      : user?._id
      ? [user._id]
      : [];
  const isSuperAdmin = user?.role === 'super_admin';
  const scope = !isSuperAdmin && tenantScope.length > 0 ? { user_id: { $in: tenantScope } } : {};

  const invoice = await Invoice.findOne({ ...scope, invoice_number: normalizedNumber })
    .populate('patient_id')
    .populate('user_id', 'pharmacyName')
    .lean();

  if (invoice) {
    const payload = {
      ...salesInvoiceToDTO(invoice),
      user: invoice.user_id,
      patient: invoice.patient_id,
    };
    const [enriched] = await attachBrandingToInvoices([payload]);
    return enriched;
  }

  const labInvoice = await LabInvoice.findOne({ invoice_number: normalizedNumber }).lean();
  if (labInvoice) {
    const labScope = !isSuperAdmin && tenantScope.length > 0 ? { user_id: { $in: tenantScope } } : {};
    const labRecord = await LabCashierRecord.findOne({ ...labScope, _id: labInvoice.record_id }).lean();
    if (labRecord) {
      const dto = labRecordToDTO(labRecord, labInvoice);
      const payload = {
        ...dto,
        user: {},
        patient: { name: labRecord.patient_name, phone: labRecord.phone },
      };
      const [enriched] = await attachBrandingToInvoices([payload]);
      return enriched;
    }
  }

  const matches = await fetchInvoices({
    user,
    filters: { search: normalizedNumber },
  });
  return matches.find(
    (dto) => dto.invoice_number && dto.invoice_number.toLowerCase() === normalizedNumber.toLowerCase()
  ) || null;
};

export const generateInvoicesPDF = async (invoices) => {
  const invoicesWithBranding = await attachBrandingToInvoices(invoices);
  const logoAssets = await loadLogoAssets(invoicesWithBranding);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const buffers = [];

    const addInvoicePage = (invoice, index) => {
      if (index > 0) {
        doc.addPage();
      }

      const pageWidth = doc.page.width;
      const margin = doc.page.margins.left;
      let cursorY = margin;
      const branding = invoice.branding || {};
      const logoBuffer = branding.logo_url ? logoAssets.get(branding.logo_url) : null;

      const drawHeader = () => {
        const headerHeight = 110;
        const contentWidth = pageWidth - margin * 2;
        const gradient = doc.linearGradient(margin, cursorY, pageWidth - margin, cursorY + headerHeight);
        gradient.stop(0, '#2563eb');
        gradient.stop(1, '#1d4ed8');

        doc.save();
        doc.roundedRect(margin, cursorY, contentWidth, headerHeight, 12).fill(gradient);
        doc.restore();

        let textStartX = margin + 28;
        const textTop = cursorY + 24;

        if (logoBuffer) {
          try {
            doc.image(logoBuffer, margin + 28, cursorY + 22, {
              fit: [80, 60],
            });
            textStartX = margin + 120;
          } catch (error) {
            console.warn('Failed to render invoice logo:', error.message);
          }
        }

        const headerName = branding.name || 'Kulmis Pharmacy & Laboratory';

        doc.fillColor('#ffffff');
        doc.font('Helvetica-Bold')
          .fontSize(22)
          .text(headerName, textStartX, textTop, {
            width: contentWidth - (textStartX - margin) - 32,
          });

        const contactLines = [
          branding.phone ? `Phone: ${branding.phone}` : null,
          branding.email ? `Email: ${branding.email}` : null,
          branding.address || null,
        ].filter(Boolean);

        doc.font('Helvetica').fontSize(12);
        let infoY = textTop + 32;
        contactLines.forEach((line) => {
          doc.text(line, textStartX, infoY, {
            width: contentWidth - (textStartX - margin) - 32,
          });
          infoY += 14;
        });

        cursorY += headerHeight + 24;
      };

      const drawInfoCards = () => {
        const columnGap = 20;
        const columnWidth = (pageWidth - margin * 2 - columnGap) / 2;
        const cardRadius = 12;
        const cardPadding = 24;
        const contentWidth = columnWidth - cardPadding * 2;

        const measureText = (text, font, size, options = {}) => {
          if (!text) {
            return 0;
          }
          doc.font(font).fontSize(size);
          return doc.heightOfString(String(text), {
            width: contentWidth,
            lineGap: 2,
            ...options,
          });
        };

        const customerName =
          invoice.patient?.name ||
          invoice.patient_id?.name ||
          invoice.customer ||
          invoice.customer_name ||
          'Walk-in Customer';
        const customerPhone =
          invoice.patient?.phone || invoice.patient_id?.phone || invoice.meta?.phone || invoice.phone || '';
        const customerAddress =
          invoice.patient?.address || invoice.patient_id?.address || invoice.meta?.address || '';

        const billTitleHeight = measureText('Bill To', 'Helvetica-Bold', 12, {
          characterSpacing: 0.4,
          lineGap: 2,
        });
        const billNameHeight = measureText(customerName, 'Helvetica', 11, {
          characterSpacing: 0.25,
          lineGap: 3,
        });
        const billPhoneHeight = customerPhone
          ? measureText(`Phone: ${customerPhone}`, 'Helvetica', 10, {
              characterSpacing: 0.2,
              lineGap: 2,
            })
          : 0;
        const billAddressHeight = customerAddress
          ? measureText(`Address: ${customerAddress}`, 'Helvetica', 10, {
              characterSpacing: 0.2,
              lineGap: 2,
            })
          : 0;

        const billHeight =
          cardPadding +
          billTitleHeight +
          (billTitleHeight > 0 ? 16 : 0) +
          billNameHeight +
          (billPhoneHeight > 0 ? 10 + billPhoneHeight : 0) +
          (billAddressHeight > 0 ? 8 + billAddressHeight : 0) +
          cardPadding;

        const detailTitleHeight = measureText('Invoice Details', 'Helvetica-Bold', 12, { characterSpacing: 0.2 });
        const performerName = invoice.processed_by_name || invoice.user_name;
        const performerRole = invoice.processed_by_role || invoice.user_role;
        const performerValue = performerName
          ? `${performerName}${performerRole ? ` (${String(performerRole).replace(/_/g, ' ')})` : ''}`
          : null;

        const detailRows = [
          { label: 'Invoice #', value: invoice.invoice_number || 'N/A' },
          { label: 'Date', value: new Date(invoice.date).toLocaleDateString() },
          { label: 'Type', value: invoice.type === 'lab' ? 'Lab Cashier' : 'Pharmacy Sale' },
          invoice.payment_method ? { label: 'Payment', value: invoice.payment_method } : null,
          performerValue ? { label: 'Processed By', value: performerValue } : null,
        ].filter(Boolean);

        let detailRowsHeight = 0;
        detailRows.forEach((row, index) => {
          const text = `${row.label}: ${row.value}`;
          detailRowsHeight += measureText(text, 'Helvetica', 10, { characterSpacing: 0.2 });
          if (index < detailRows.length - 1) {
            detailRowsHeight += 6;
          }
        });

        const statusLabel = normalizeStatus(invoice.status || 'Paid');
        doc.font('Helvetica-Bold').fontSize(10);
        const statusWidth = doc.widthOfString(statusLabel, { characterSpacing: 0.3 }) + 24;
        const statusHeight = 22;

        const detailHeight =
          cardPadding +
          detailTitleHeight +
          (detailTitleHeight > 0 ? 14 : 0) +
          detailRowsHeight +
          14 + // spacing above status
          statusHeight +
          cardPadding;

        const cardHeight = Math.max(150, billHeight, detailHeight);

        // Bill To card background
        doc.save();
        doc.roundedRect(margin, cursorY, columnWidth, cardHeight, cardRadius).fill('#f3f4f6');
        doc.restore();

        // Bill To content
        const billTextX = margin + cardPadding;
        const billTextYStart = cursorY + cardPadding;
        let billTextY = billTextYStart;
        const billTextWidth = columnWidth - cardPadding * 2;

        doc.font('Helvetica-Bold')
          .fontSize(12)
          .fillColor('#0f172a')
          .text('Bill To', billTextX, billTextY, {
            width: billTextWidth,
            characterSpacing: 0.4,
            lineGap: 2,
          });
        billTextY += billTitleHeight + 28;

        doc.font('Helvetica')
          .fontSize(11)
          .fillColor('#111827')
          .text(customerName, billTextX, billTextY, {
            width: billTextWidth,
            characterSpacing: 0.25,
            lineGap: 3,
          });
        billTextY += billNameHeight + 12;

        if (customerPhone) {
          const phoneLabel = `Phone: ${customerPhone}`;
          doc.font('Helvetica')
            .fontSize(10)
            .fillColor('#4b5563')
            .text(phoneLabel, billTextX, billTextY, {
              width: billTextWidth,
              characterSpacing: 0.2,
              lineGap: 2,
            });
          billTextY += billPhoneHeight + 8;
        }

        if (customerAddress) {
          const addressLabel = `Address: ${customerAddress}`;
          doc.font('Helvetica')
            .fontSize(10)
            .fillColor('#4b5563')
            .text(addressLabel, billTextX, billTextY, {
              width: billTextWidth,
              characterSpacing: 0.2,
              lineGap: 2,
            });
          billTextY += billAddressHeight + 6;
        }

        // Invoice Details card background
        const detailX = margin + columnWidth + columnGap;
        doc.save();
        const detailGradient = doc.linearGradient(detailX, cursorY, detailX + columnWidth, cursorY + cardHeight);
        detailGradient.stop(0, '#eff6ff');
        detailGradient.stop(1, '#dbeafe');
        doc.roundedRect(detailX, cursorY, columnWidth, cardHeight, cardRadius).fill(detailGradient);
        doc.restore();

        const detailTextX = detailX + cardPadding;
        let detailTextY = cursorY + cardPadding;
        const detailTextWidth = columnWidth - cardPadding * 2;

        doc.font('Helvetica-Bold')
          .fontSize(12)
          .fillColor('#1d4ed8')
          .text('Invoice Details', detailTextX, detailTextY, { width: detailTextWidth, characterSpacing: 0.2 });
        detailTextY += detailTitleHeight + 14;

        doc.font('Helvetica').fontSize(10).fillColor('#111827');
        detailRows.forEach((row, index) => {
          const text = `${row.label}: ${row.value}`;
          doc.text(text, detailTextX, detailTextY, {
            width: detailTextWidth,
            characterSpacing: 0.2,
            lineGap: 2,
          });
          detailTextY += measureText(text, 'Helvetica', 10, { characterSpacing: 0.2 }) + (index < detailRows.length - 1 ? 6 : 0);
        });

        const statusColors = {
          Paid: '#16a34a',
          Pending: '#f97316',
          Cancelled: '#dc2626',
        };
        const statusColor = statusColors[statusLabel] || '#2563eb';

        const statusX = detailTextX + detailTextWidth - statusWidth;
        const statusY = cursorY + cardHeight - cardPadding - statusHeight;

        doc.save();
        doc.roundedRect(statusX, statusY, statusWidth, statusHeight, 8).fill(statusColor);
        doc.fillColor('#ffffff').text(statusLabel, statusX + 12, statusY + 5, { characterSpacing: 0.3 });
        doc.restore();

        cursorY += cardHeight + 24;
      };

      const drawLabDetails = () => {
        if (invoice.type !== 'lab') {
          return;
        }
        const columnGap = 20;
        const columnWidth = (pageWidth - margin * 2 - columnGap) / 2;
        const cardHeight = 90;

        const labCards = [
          {
            title: 'Sample Type',
            value: invoice.sample_type || 'N/A',
          },
          {
            title: 'Diseases / Symptoms',
            value:
              Array.isArray(invoice.diseases) && invoice.diseases.length
                ? invoice.diseases.join(', ')
                : 'N/A',
          },
        ];

        labCards.forEach((card, idx) => {
          const x = margin + idx * (columnWidth + columnGap);
          doc.save();
          doc.roundedRect(x, cursorY, columnWidth, cardHeight, 12).fill('#f9fafb');
          doc.fillColor('#111827').font('Helvetica-Bold').fontSize(11).text(card.title, x + 16, cursorY + 16);
          doc.font('Helvetica').fontSize(10).fillColor('#374151').text(card.value, {
            width: columnWidth - 32,
            align: 'left',
            continued: false,
          });
          doc.restore();
        });

        cursorY += cardHeight + 24;
      };

      const drawItemsTable = () => {
        const tableLeft = margin;
        const tableWidth = pageWidth - margin * 2;
        const headerHeight = 32;
        const rowHeight = 28;
        const tableRadius = 12;

        const headerGradient = doc.linearGradient(tableLeft, cursorY, tableLeft + tableWidth, cursorY);
        headerGradient.stop(0, '#f3f4f6');
        headerGradient.stop(1, '#e5e7eb');

        doc.save();
        doc.roundedRect(tableLeft, cursorY, tableWidth, headerHeight, tableRadius).fill(headerGradient);
        doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(11);

        if (invoice.type === 'lab') {
          doc.text('Description', tableLeft + 18, cursorY + 10, { width: tableWidth * 0.7 });
          doc.text('Amount', tableLeft + tableWidth - 120, cursorY + 10, { width: 100, align: 'right' });
        } else {
          doc.text('Item', tableLeft + 18, cursorY + 10, { width: tableWidth * 0.4 });
          doc.text('Qty', tableLeft + tableWidth * 0.48, cursorY + 10, { width: 50, align: 'center' });
          doc.text('Unit Price', tableLeft + tableWidth * 0.63, cursorY + 10, { width: 90, align: 'right' });
          doc.text('Total', tableLeft + tableWidth - 110, cursorY + 10, { width: 90, align: 'right' });
        }
        doc.restore();

        cursorY += headerHeight;

        const items = (invoice.items && invoice.items.length ? invoice.items : [
          {
            title:
              invoice.type === 'lab'
                ? invoice.diseases && invoice.diseases.length
                  ? `Lab Services: ${invoice.diseases.join(', ')}`
                  : 'Lab Service'
                : 'Sale',
            qty: invoice.type === 'lab' ? 1 : invoice.quantity || 1,
            price: invoice.type === 'lab' ? invoice.amount : invoice.amount,
            total: invoice.amount,
          },
        ]).slice(0);

        const bodyHeight = rowHeight * items.length;
        doc.save();
        doc.roundedRect(tableLeft, cursorY, tableWidth, bodyHeight, tableRadius).clip();
        doc.fillColor('#ffffff').rect(tableLeft, cursorY, tableWidth, bodyHeight).fill();

        items.forEach((item, idx) => {
          const y = cursorY + idx * rowHeight;
          doc.save();
          if (idx % 2 === 1) {
            doc.fillColor('#f8fafc').rect(tableLeft, y, tableWidth, rowHeight).fill();
          }
          doc.restore();

          doc.save();
          doc.lineWidth(0.5).strokeColor('#e2e8f0');
          doc.moveTo(tableLeft, y).lineTo(tableLeft + tableWidth, y).stroke();
          doc.restore();

          doc.save();
          doc.fillColor('#1f2937').font('Helvetica').fontSize(10);

          if (invoice.type === 'lab') {
            const description = item.title || item.name || 'Lab Service';
            doc.text(description, tableLeft + 18, y + 8, { width: tableWidth * 0.7 });
            doc.text(formatCurrency(item.total ?? item.price ?? invoice.amount), tableLeft + tableWidth - 120, y + 8, {
              width: 100,
              align: 'right',
            });
          } else {
            const title = item.title || item.name || 'Item';
            const qty = item.qty || item.quantity || 1;
            const unitPrice = item.price ?? (item.total && qty ? item.total / qty : 0) ?? 0;
            const total = item.total ?? unitPrice * qty;

            doc.text(title, tableLeft + 18, y + 8, { width: tableWidth * 0.4 });
            doc.text(qty.toString(), tableLeft + tableWidth * 0.48, y + 8, { width: 50, align: 'center' });
            doc.text(formatCurrency(unitPrice), tableLeft + tableWidth * 0.63, y + 8, { width: 90, align: 'right' });
            doc.text(formatCurrency(total), tableLeft + tableWidth - 110, y + 8, { width: 90, align: 'right' });
          }
          doc.restore();
        });

        doc.restore();

        // bottom border
        doc.save();
        doc.lineWidth(0.5).strokeColor('#e2e8f0');
        doc.moveTo(tableLeft, cursorY + bodyHeight).lineTo(tableLeft + tableWidth, cursorY + bodyHeight).stroke();
        doc.restore();

        cursorY += bodyHeight + 24;
      };

      const drawTotals = () => {
        const totalsWidth = 220;
        const totalsHeight = 120;
        const totalsX = pageWidth - margin - totalsWidth;
        const totalsY = cursorY;

        doc.save();
        doc.roundedRect(totalsX, totalsY, totalsWidth, totalsHeight, 12).fill('#f8fafc');
        doc.fillColor('#111827').font('Helvetica-Bold').fontSize(12).text('Summary', totalsX + 18, totalsY + 16);

        const totals = [
          invoice.subtotal !== undefined && invoice.subtotal !== invoice.total
            ? { label: 'Subtotal', value: formatCurrency(invoice.subtotal) }
            : null,
          invoice.discount ? { label: 'Discount', value: `-${formatCurrency(invoice.discount)}` } : null,
          invoice.tax ? { label: 'Tax', value: formatCurrency(invoice.tax) } : null,
          { label: 'Total', value: formatCurrency(invoice.total ?? invoice.amount ?? 0), strong: true },
        ].filter(Boolean);

        let y = totalsY + 44;
        totals.forEach((row) => {
          doc.font(row.strong ? 'Helvetica-Bold' : 'Helvetica');
          doc.fillColor('#4b5563').fontSize(10).text(row.label, totalsX + 18, y);
          doc.fillColor(row.strong ? '#1d4ed8' : '#111827')
            .fontSize(row.strong ? 12 : 10)
            .text(row.value, totalsX + 18, y, { width: totalsWidth - 36, align: 'right' });
          y += 20;
        });

        doc.restore();
        cursorY += totalsHeight + 24;
      };

      const drawFooter = () => {
        doc.strokeColor('#e2e8f0').lineWidth(1).moveTo(margin, cursorY).lineTo(pageWidth - margin, cursorY).stroke();
        cursorY += 16;
        doc.fillColor('#6b7280').font('Helvetica').fontSize(10).text('Thank you for your business!', margin, cursorY, {
          width: pageWidth - margin * 2,
          align: 'center',
        });
        cursorY += 20;
        const footerLineParts = [branding.name, branding.phone, branding.email].filter(Boolean);
        if (footerLineParts.length) {
          doc.fontSize(9)
            .fillColor('#9ca3af')
            .text(footerLineParts.join(' • '), margin, cursorY, {
              width: pageWidth - margin * 2,
              align: 'center',
            });
          cursorY += 16;
        }
        if (branding.address) {
          doc.fontSize(8)
            .fillColor('#9ca3af')
            .text(branding.address, margin, cursorY, {
              width: pageWidth - margin * 2,
              align: 'center',
            });
          cursorY += 12;
        }
      };

      drawHeader();
      drawInfoCards();
      drawLabDetails();
      drawItemsTable();
      drawTotals();
      drawFooter();
    };

    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => {
      resolve(Buffer.concat(buffers));
    });

    invoicesWithBranding.forEach((invoice, index) => addInvoicePage(invoice, index));

    doc.end();
  });
};

export const generateInvoicesExcel = async (invoices) => {
  const enrichedInvoices = await attachBrandingToInvoices(invoices);

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Invoices');

  worksheet.columns = [
    { header: 'Pharmacy', key: 'pharmacy', width: 26 },
    { header: 'Phone', key: 'phone', width: 18 },
    { header: 'Address', key: 'address', width: 32 },
    { header: 'Invoice #', key: 'invoice_number', width: 18 },
    { header: 'Customer', key: 'customer', width: 22 },
    { header: 'Type', key: 'type', width: 14 },
    { header: 'Processed By', key: 'processed_by', width: 24 },
    { header: 'Amount', key: 'amount', width: 14 },
    { header: 'Status', key: 'status', width: 14 },
    { header: 'Date', key: 'date', width: 18 },
  ];

  enrichedInvoices.forEach((invoice) => {
    const performerName = invoice.processed_by_name || invoice.user_name || 'Team Member';
    const performerRole = invoice.processed_by_role || invoice.user_role || '';
    const performer = performerRole
      ? `${performerName} (${String(performerRole).replace(/_/g, ' ')})`
      : performerName;
    const branding = invoice.branding || {};

    worksheet.addRow({
      pharmacy: branding.name || '',
      phone: branding.phone || '',
      address: branding.address || '',
      invoice_number: invoice.invoice_number,
      customer: invoice.customer,
      type: invoice.type === 'lab' ? 'Lab' : 'Sales',
      processed_by: performer,
      amount: invoice.amount,
      status: invoice.status,
      date: invoice.date ? new Date(invoice.date).toLocaleDateString() : '',
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
};

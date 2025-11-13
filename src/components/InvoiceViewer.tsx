import React, { useRef, useState, useEffect } from 'react'
import { Printer, Download, Building2, FileText } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { api } from '@/lib/api'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

interface InvoiceViewerProps {
  invoiceId?: string
  transactionId?: string
  type: 'pharmacy' | 'lab'
  initialInvoice?: any
  onClose: () => void
}

const isValidObjectId = (value?: string) => !!value && /^[a-fA-F0-9]{24}$/.test(value)

export const InvoiceViewer: React.FC<InvoiceViewerProps> = ({
  invoiceId,
  transactionId,
  type,
  initialInvoice,
  onClose,
}) => {
  const invoiceRef = useRef<HTMLDivElement>(null)
  const [invoice, setInvoice] = useState<any>(initialInvoice ?? null)
  const [loading, setLoading] = useState(initialInvoice ? false : true)
  const [generatingPDF, setGeneratingPDF] = useState(false)
  const branding = invoice?.branding || null

  const formatRole = (role?: string) => {
    if (!role) return ''
    return role
      .toString()
      .split('_')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ')
  }

  useEffect(() => {
    if (initialInvoice) {
      setInvoice(initialInvoice)
    }
  }, [initialInvoice])

  useEffect(() => {
    loadInvoice()
  }, [invoiceId, transactionId, type])

  const loadInvoice = async () => {
    try {
      if (initialInvoice && !invoiceId && !transactionId) {
        setInvoice(initialInvoice)
        setLoading(false)
        return
      }

      if (!invoiceId && !transactionId) {
        setLoading(false)
        return
      }

      setLoading(true)

      const fallbackToNumber = async (invoiceNumber?: string) => {
        if (!invoiceNumber) return false
        try {
          const fetched = (await api.getInvoiceByNumber(invoiceNumber)) as any
          setInvoice(fetched)
          return true
        } catch (err) {
          console.warn('Failed to load invoice by number fallback:', err)
          return false
        }
      }

      if (type === 'lab') {
        if (transactionId) {
          const record: any = await api.getLabCashierRecord(transactionId)

          if (record?.invoice?._id && isValidObjectId(record.invoice._id)) {
            try {
              const invoiceData = (await api.getInvoice(record.invoice._id)) as any
              setInvoice(invoiceData)
              return
            } catch (err) {
              console.warn('Failed to load lab invoice by id, falling back to record data:', err)
              if (await fallbackToNumber(record?.invoice?.invoice_number || initialInvoice?.invoice_number)) {
                return
              }
            }
          }

          const normalizedInvoice = {
            invoice_number:
              record?.invoice?.invoice_number || record?.invoice_number || `INV-${record?._id?.slice(-6) || 'LAB'}`,
            patient_id: { name: record?.patient_name, phone: record?.phone },
            patient: { name: record?.patient_name, phone: record?.phone },
            createdAt: record?.invoice?.created_at || record?.invoice?.createdAt || record?.date || record?.createdAt,
            date: record?.invoice?.created_at || record?.invoice?.createdAt || record?.date || record?.createdAt,
            items: [
              {
                title:
                  record?.diseases && record.diseases.length
                    ? `Lab Services: ${record.diseases.join(', ')}`
                    : 'Lab Service',
                qty: 1,
                price: record?.price || 0,
                total: record?.price || 0,
              },
            ],
            subtotal: record?.price || 0,
            total: record?.price || 0,
            status:
              record?.status === 'complete'
                ? 'Paid'
                : record?.status
                ? record.status.charAt(0).toUpperCase() + record.status.slice(1)
                : undefined,
            sample_type: record?.sample_type,
            diseases: record?.diseases,
            type: 'lab',
            processed_by_name:
              record?.invoice?.user_name ||
              record?.invoice?.processed_by_name ||
              record?.processed_by_name ||
              record?.user_name ||
              record?.cashier_name,
            processed_by_role:
              record?.invoice?.user_role ||
              record?.invoice?.processed_by_role ||
              record?.processed_by_role ||
              record?.user_role,
          }
          setInvoice(normalizedInvoice)
        } else if (invoiceId) {
          if (isValidObjectId(invoiceId)) {
            try {
              const invoiceData = (await api.getInvoice(invoiceId)) as any
              setInvoice(invoiceData)
            } catch (err) {
              console.warn('Failed to load lab invoice by id:', err)
              if (await fallbackToNumber(initialInvoice?.invoice_number || invoiceId)) {
                return
              }
              throw err
            }
          } else if (await fallbackToNumber(initialInvoice?.invoice_number || invoiceId)) {
            return
          }
        }
      } else {
        if (invoiceId) {
          if (isValidObjectId(invoiceId)) {
            try {
              const invoiceData = (await api.getInvoice(invoiceId)) as any
              setInvoice(invoiceData)
            } catch (e) {
              console.warn('Failed to load pharmacy invoice by id, trying number fallback:', e)
              if (await fallbackToNumber(initialInvoice?.invoice_number || invoice?.invoice_number)) {
                return
              }
              throw e
            }
          } else if (await fallbackToNumber(initialInvoice?.invoice_number || invoiceId)) {
            return
          }
        } else if (transactionId) {
          const sales = (await api.getSales()) as any[]
          const sale = sales.find((s: any) => s._id === transactionId)
          if (sale) {
            if (sale.invoice_id) {
              try {
                const invoiceData = await api.getInvoice(sale.invoice_id)
                setInvoice(invoiceData)
                return
              } catch (err) {
                console.warn('Failed to load sale invoice by stored id:', err)
                if (await fallbackToNumber(sale.invoice?.invoice_number || sale.invoice_number)) {
                  return
                }
              }
            }
            const saleTransactions = sales.filter((t: any) =>
              t.customer_name === sale.customer_name &&
              new Date(t.createdAt).toDateString() === new Date(sale.createdAt).toDateString()
            )

            const invoiceItems = saleTransactions.map((t: any) => ({
              title: t.medicine_id?.name || 'Medicine',
              qty: t.quantity || 1,
              price: t.total_sale / (t.quantity || 1),
              total: t.total_sale || 0,
            }))
            const totalAmount = saleTransactions.reduce((sum: number, t: any) => sum + (t.total_sale || 0), 0)

            setInvoice({
              invoice_number: `INV-PH-${sale._id.slice(-6).toUpperCase()}`,
              items: invoiceItems.length > 0 ? invoiceItems : [{
                title: 'Medicine Sale',
                qty: sale.quantity || 1,
                price: sale.total_sale || 0,
                total: sale.total_sale || 0,
              }],
              subtotal: sale.total_sale || 0,
              discount: 0,
              tax: 0,
              total: totalAmount || sale.total_sale || 0,
              status: 'Paid',
              createdAt: sale.createdAt,
              date: sale.createdAt,
              patient_id: {
                name: sale.customer_name || 'Walk-in Customer',
                phone: sale.customer_phone || '',
              },
              payment_method: sale.payment_method || 'Cash',
              type: 'pharmacy',
              processed_by_name: sale.processed_by_name || sale.user_name,
              processed_by_role: sale.processed_by_role || sale.user_role,
            })
          }
        }
      }
    } catch (error) {
      console.error('Failed to load invoice:', error)
    } finally {
      setLoading(false)
    }
  }

  const handlePrint = () => {
    window.print()
  }

  const handleDownloadPDF = async () => {
    if (!invoiceRef.current || !invoice) {
      alert('Invoice not ready. Please wait for it to load.')
      return
    }

    try {
      setGeneratingPDF(true)

      const canvas = await html2canvas(invoiceRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
      })

      const imgWidth = 210
      const pageHeight = 297
      const imgHeight = (canvas.height * imgWidth) / canvas.width
      let heightLeft = imgHeight

      const pdf = new jsPDF('p', 'mm', 'a4')
      let position = 0

      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, position, imgWidth, imgHeight)
      heightLeft -= pageHeight

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight
        pdf.addPage()
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, position, imgWidth, imgHeight)
        heightLeft -= pageHeight
      }

      const invoiceNumber = invoice.invoice_number || `INV-${Date.now()}`
      const filename = `Invoice-${invoiceNumber}.pdf`

      pdf.save(filename)
    } catch (error) {
      console.error('Error generating PDF:', error)
      alert('Failed to generate PDF. Please try again or use the print function.')
    } finally {
      setGeneratingPDF(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm px-2 sm:px-4"
      onClick={onClose}
    >
      <div
         className="bg-white w-full sm:max-w-4xl rounded-t-3xl sm:rounded-2xl shadow-2xl max-h-[88vh] sm:max-h-[90vh] overflow-y-auto relative"
         onClick={(e) => e.stopPropagation()}
       >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 sm:right-6 sm:top-6 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 w-9 h-9 flex items-center justify-center shadow-sm"
          aria-label="Close"
        >
          ✕
        </button>
        {/* Header with Actions */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
          <div className="flex items-center space-x-3">
            <FileText className="w-6 h-6 text-primary-600" />
            <div>
              <h2 className="text-xl font-bold text-gray-900">Invoice</h2>
              <p className="text-sm text-gray-600">
                {invoice ? `#${invoice.invoice_number || 'N/A'}` : 'Loading...'}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            {invoice && (
              <>
                <Button variant="outline" onClick={handleDownloadPDF} disabled={generatingPDF}>
                  <Download className="w-4 h-4 mr-2" />
                  {generatingPDF ? 'Generating...' : 'PDF'}
                </Button>
                <Button onClick={handlePrint}>
                  <Printer className="w-4 h-4 mr-2" />
                  Print
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Invoice Content */}
        <div id="invoice-print-area">
          <div ref={invoiceRef} className="p-6" id="invoice-content">
          {loading ? (
            <div className="text-center py-12">
              <p className="text-gray-600">Loading invoice...</p>
            </div>
          ) : !invoice ? (
            <div className="text-center py-12">
              <p className="text-gray-600">Invoice not found</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Business Header */}
              <div className="border-b border-gray-200 pb-6">
                <div className="flex flex-col items-center text-center space-y-3 mb-4">
                  {branding?.logo_url ? (
                    <div className="w-20 h-20 rounded-2xl overflow-hidden border border-gray-200 shadow-lg bg-white">
                      <img src={branding.logo_url} alt="Pharmacy logo" className="h-full w-full object-cover" />
                    </div>
                  ) : (
                    <div
                      className="w-20 h-20 bg-gradient-to-br from-primary-500 to-primary-600 rounded-2xl flex items-center justify-center shadow-lg"
                      style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)' }}
                    >
                      <Building2 className="w-12 h-12 text-white" />
                    </div>
                  )}
                  <div>
                    <h2 className="text-3xl font-extrabold text-gray-900 tracking-wide uppercase">
                      {branding?.name ||
                        invoice.user?.pharmacyName ||
                        invoice.user_id?.pharmacyName ||
                        'Kulmis Pharmacy & Laboratory'}
                    </h2>
                    <p className="text-base text-gray-600">
                      {branding?.about || 'Pharmacy & Laboratory Services'}
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      {[
                        branding?.phone || invoice.user_id?.phone,
                        branding?.email || invoice.user_id?.email,
                        branding?.address,
                      ]
                        .filter(Boolean)
                        .join(' • ') || 'Phone: +252 61 234 5678 • Email: support@kulmispharma.com'}
                    </p>
                  </div>
                </div>
                <div className="border-t border-gray-200 pt-4 text-center">
                  <p className="text-sm font-medium text-gray-500 uppercase tracking-[0.3em]">
                    Official Invoice
                  </p>
                </div>
              </div>

              {/* Invoice Info Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">Bill To:</h3>
                  <div
                    className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4 border border-gray-200"
                    style={{ background: 'linear-gradient(135deg, #f9fafb, #f3f4f6)' }}
                  >
                    <p className="font-bold text-gray-900 text-lg">
                      {invoice.patient_id?.name || invoice.patient?.name || invoice.customer || invoice.customer_name || 'Walk-in Customer'}
                    </p>
                    {invoice.patient_id?.phone || invoice.patient?.phone ? (
                      <p className="text-sm text-gray-600 mt-1">
                        <span className="font-medium">Phone:</span> {invoice.patient_id?.phone || invoice.patient?.phone}
                      </p>
                    ) : null}
                    {invoice.patient_id?.address && (
                      <p className="text-sm text-gray-600 mt-1">
                        <span className="font-medium">Address:</span> {invoice.patient_id.address}
                      </p>
                    )}
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">Invoice Details:</h3>
                  <div
                    className="bg-gradient-to-br from-primary-50 to-primary-100 rounded-xl p-4 border border-primary-200 space-y-2"
                    style={{ background: 'linear-gradient(135deg, #eff6ff, #dbeafe)' }}
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-700 font-medium">Invoice #:</span>
                      <span className="font-bold text-primary-700 text-lg">
                        {invoice.invoice_number || 'N/A'}
                      </span>
                    </div>
                    {invoice.order_id?.order_number && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-700 font-medium">Order #:</span>
                        <span className="font-medium text-gray-900">
                          {invoice.order_id.order_number}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-700 font-medium">Date:</span>
                      <span className="font-medium text-gray-900">
                        {invoice.createdAt
                          ? new Date(invoice.createdAt).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                            })
                          : new Date().toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-primary-200">
                      <span className="text-sm text-gray-700 font-medium">Status:</span>
                      <span className={`px-3 py-1 rounded-lg text-xs font-bold ${
                        invoice.status === 'Paid' 
                          ? 'bg-green-100 text-green-700' 
                          : invoice.status === 'Pending'
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {invoice.status || 'Paid'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

          {(invoice?.processed_by_name || invoice?.user_name) && (
            <div className="mt-6 flex flex-col md:flex-row md:items-center md:justify-between rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-3 text-sm text-blue-900">
              <span className="font-medium text-blue-700">Processed by</span>
              <span className="mt-1 md:mt-0 font-semibold text-blue-900">
                {invoice.processed_by_name || invoice.user_name}
                {invoice.processed_by_role ? ` (${formatRole(invoice.processed_by_role)})` : ''}
              </span>
            </div>
          )}

              {type === 'lab' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-4" style={{ background: '#f9fafb' }}>
                    <h4 className="text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide">Sample Type</h4>
                    <p className="text-base font-medium text-gray-900">{invoice.sample_type || 'N/A'}</p>
                  </div>
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-4" style={{ background: '#f9fafb' }}>
                    <h4 className="text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide">Diseases / Symptoms</h4>
                    <p className="text-sm text-gray-700 whitespace-pre-line">
                      {Array.isArray(invoice.diseases) && invoice.diseases.length
                        ? invoice.diseases.join(', ')
                        : 'N/A'}
                    </p>
                  </div>
                </div>
              )}

              {/* Items Table */}
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                {type === 'lab' ? (
                  <table className="w-full">
                    <thead
                      className="bg-gradient-to-r from-gray-50 to-gray-100"
                      style={{ background: 'linear-gradient(90deg, #f9fafb, #f3f4f6)' }}
                    >
                      <tr>
                        <th className="text-left py-4 px-6 font-bold text-gray-900">Description</th>
                        <th className="text-right py-4 px-6 font-bold text-gray-900">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {(invoice.items && invoice.items.length ? invoice.items : [
                        {
                          title:
                            invoice.diseases && invoice.diseases.length
                              ? `Lab Services: ${invoice.diseases.join(', ')}`
                              : 'Lab Service',
                          total: invoice.total || invoice.subtotal || 0,
                        },
                      ]).map((item: any, index: number) => (
                        <tr key={index} className="hover:bg-gray-50 transition-colors">
                          <td className="py-4 px-6 font-medium text-gray-900">{item.title || item.name}</td>
                          <td className="py-4 px-6 text-right font-bold text-gray-900">
                            ${(item.total ?? item.price ?? 0).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <table className="w-full">
                    <thead
                      className="bg-gradient-to-r from-gray-50 to-gray-100"
                      style={{ background: 'linear-gradient(90deg, #f9fafb, #f3f4f6)' }}
                    >
                      <tr>
                        <th className="text-left py-4 px-6 font-bold text-gray-900">Item</th>
                        <th className="text-center py-4 px-6 font-bold text-gray-900">Quantity</th>
                        <th className="text-right py-4 px-6 font-bold text-gray-900">Unit Price</th>
                        <th className="text-right py-4 px-6 font-bold text-gray-900">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {invoice.items?.map((item: any, index: number) => (
                        <tr key={index} className="hover:bg-gray-50 transition-colors">
                          <td className="py-4 px-6 font-medium text-gray-900">{item.title || item.name}</td>
                          <td className="py-4 px-6 text-center text-gray-600">{item.qty || 1}</td>
                          <td className="py-4 px-6 text-right text-gray-600">
                            ${(item.price || 0).toFixed(2)}
                          </td>
                          <td className="py-4 px-6 text-right font-bold text-gray-900">
                            ${(item.total || item.price * (item.qty || 1)).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Totals */}
              <div className="flex justify-end">
                <div className="w-full md:w-96 space-y-3">
                  {invoice.subtotal !== invoice.total && (
                    <div className="flex justify-between text-gray-700">
                      <span className="font-medium">Subtotal:</span>
                      <span className="font-semibold">${(invoice.subtotal || 0).toFixed(2)}</span>
                    </div>
                  )}
                  {invoice.discount > 0 && (
                    <div className="flex justify-between text-red-600">
                      <span className="font-medium">Discount:</span>
                      <span className="font-semibold">-${invoice.discount.toFixed(2)}</span>
                    </div>
                  )}
                  {invoice.tax > 0 && (
                    <div className="flex justify-between text-gray-700">
                      <span className="font-medium">Tax:</span>
                      <span className="font-semibold">${invoice.tax.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-xl font-bold text-gray-900 border-t-2 border-primary-500 pt-3">
                    <span>Total:</span>
                    <span className="text-primary-600">${(invoice.total || 0).toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="mt-8 pt-6 border-t border-gray-200 text-center">
                <p className="text-sm text-gray-600 mb-2">Thank you for your business!</p>
                <p className="text-xs text-gray-500">
                  {(branding?.name ||
                    invoice.user?.pharmacyName ||
                    invoice.user_id?.pharmacyName ||
                    'Kulmis Pharmacy & Laboratory')}{' '}
                  {branding?.phone || branding?.email
                    ? `• ${[branding?.phone, branding?.email].filter(Boolean).join(' • ')}`
                    : '• Professional Healthcare Services'}
                </p>
              </div>
            </div>
          )}
          </div>
        </div>
      </div>

      {/* Print Styles */}
      <style>{`
        @page {
          size: A4 portrait;
          margin: 15mm;
        }
        @media print {
          html, body {
            height: auto !important;
            background: #ffffff !important;
          }
          body {
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body * {
            visibility: hidden !important;
          }
          #invoice-print-area, #invoice-print-area * {
            visibility: visible !important;
          }
          #invoice-print-area {
            position: relative !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 794px !important;
            margin: 0 auto !important;
            padding: 0 !important;
            transform: none !important;
            background: #ffffff !important;
            box-shadow: none !important;
          }
          #invoice-content {
            padding: 24px !important;
            background: #ffffff !important;
            max-width: 100% !important;
            box-shadow: none !important;
          }
          #invoice-content table {
            width: 100% !important;
            border-collapse: collapse !important;
          }
          #invoice-content th,
          #invoice-content td {
            border: none !important;
            padding: 12px !important;
          }
          #invoice-content .bg-gradient-to-r,
          #invoice-content .bg-gradient-to-br {
            background-image: none !important;
            background-color: #f7f9fc !important;
          }
          #invoice-content .border {
            border-color: #e5e7eb !important;
          }
          #invoice-content .border-t-2 {
            border-top: 2px solid #2563eb !important;
          }
          #invoice-content .text-primary-600 {
            color: #2563eb !important;
          }
          #invoice-content .bg-green-100 {
            background-color: #dcfce7 !important;
          }
          #invoice-content .text-green-700 {
            color: #047857 !important;
          }
          #invoice-content .bg-yellow-100 {
            background-color: #fef9c3 !important;
          }
          #invoice-content .text-yellow-700 {
            color: #ca8a04 !important;
          }
          #invoice-content .bg-red-100 {
            background-color: #fee2e2 !important;
          }
          #invoice-content .text-red-700 {
            color: #b91c1c !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>
    </div>
  )
}


import React, { useEffect, useMemo, useState, useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { api } from '@/lib/api'
import { InvoiceViewer } from '@/components/InvoiceViewer'
import { Download, Eye, Search, Filter, FileText } from 'lucide-react'
import { useUser } from '@/contexts/UserContext'
import { useStaffOptions } from '@/hooks/useStaffOptions'

interface InvoiceRow {
  id: string
  invoice_number: string
  customer: string
  type: 'pharmacy' | 'lab'
  diseases?: string[]
  sample_type?: string | null
  amount: number
  status: string
  date: string
  processed_by_name?: string
  processed_by_role?: string
  total?: number
  invoice_id?: string
  _id?: string
  transaction_id?: string
  record_id?: string
  lab_record_id?: string
  sale_id?: string
}

const PAGE_SIZE = 10

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
})

const formatCurrency = (value: number) => currencyFormatter.format(value || 0)

const downloadBlob = (blob: Blob, filename: string) => {
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(url)
}

export const Invoices: React.FC = () => {
  const location = useLocation()
  const { user } = useUser()
  const { options: staffOptions, loading: staffLoading } = useStaffOptions()
  const [invoices, setInvoices] = useState<InvoiceRow[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | 'lab' | 'pharmacy'>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'Paid' | 'Pending' | 'Cancelled'>('all')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc')
  const [page, setPage] = useState(1)
  const [selectedInvoice, setSelectedInvoice] = useState<{ id: string; type: 'pharmacy' | 'lab'; transactionId?: string } | null>(null)
  const [selectedInvoiceData, setSelectedInvoiceData] = useState<any | null>(null)
  const [showViewer, setShowViewer] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [selectedStaff, setSelectedStaff] = useState<string>('all')
  const [autoOpenedInvoice, setAutoOpenedInvoice] = useState<string | null>(null)

  const typeLabel = useMemo(() => {
    if (typeFilter === 'pharmacy') return 'Pharmacy Sales'
    if (typeFilter === 'lab') return 'Lab Transactions'
    return 'All Transactions'
  }, [typeFilter])

  useEffect(() => {
    if (user?.role === 'staff' && user._id) {
      setSelectedStaff(user._id)
    }
  }, [user?._id, user?.role])

  const canFilterStaff = useMemo(
    () => user?.role === 'pharmacy_owner' || user?.role === 'super_admin',
    [user?.role]
  )

  const staffFilterOptions = useMemo(() => {
    const mapped = staffOptions.map((option) => ({
      value: option.value,
      label: option.label,
      role: option.role,
    }))

    if (canFilterStaff) {
      return [
        { value: 'all', label: 'All Staff', role: 'all' },
        ...mapped.filter(
          (option, index, self) =>
            self.findIndex((o) => o.value === option.value) === index
        ),
      ]
    }

    return mapped
  }, [staffOptions, canFilterStaff])

  const formatRole = (role?: string) => {
    if (!role) return ''
    return role
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  const invoiceQueryParam = useMemo(() => {
    const params = new URLSearchParams(location.search)
    return params.get('invoice')
  }, [location.search])

  useEffect(() => {
    if (invoiceQueryParam) {
      setSearchTerm(invoiceQueryParam)
      setPage(1)
    }
  }, [invoiceQueryParam])

  useEffect(() => {
    if (!invoiceQueryParam || autoOpenedInvoice === invoiceQueryParam) {
      return
    }

    const normalized = invoiceQueryParam.trim()
    if (!normalized) {
      setAutoOpenedInvoice(invoiceQueryParam)
      return
    }

    const openFromData = (match: any | null | undefined) => {
      if (!match) return false
      const invoiceIdRaw = match.invoice_id || match.id || match._id
      const invoiceId = typeof invoiceIdRaw === 'string' ? invoiceIdRaw : String(invoiceIdRaw || '')
      if (!invoiceId) return false
      const transactionId =
        match.transaction_id ||
        match.record_id ||
        match.lab_record_id ||
        match.sale_id ||
        invoiceId
      const invoiceType = match.type === 'lab' ? 'lab' : 'pharmacy'

      setSelectedInvoice({ id: invoiceId, type: invoiceType, transactionId })
      setSelectedInvoiceData(match)
      setShowViewer(true)
      return true
    }

    try {
      const normalizedLower = normalized.toLowerCase()
      const existingMatch = invoices.find((invoice) => {
        const number =
          typeof invoice.invoice_number === 'string' ? invoice.invoice_number.trim().toLowerCase() : ''
        const id = typeof invoice.id === 'string' ? invoice.id.trim().toLowerCase() : ''
        return number === normalizedLower || id === normalizedLower
      })

      if (openFromData(existingMatch)) {
        setAutoOpenedInvoice(invoiceQueryParam)
        return
      }
    } catch (error) {
      console.error('Failed to auto-open invoice from existing list:', error)
    }

    let cancelled = false

    const fetchDirect = async () => {
      try {
        const invoice = await api.getInvoiceByNumber(normalized)
        if (cancelled) return

        if (!openFromData(invoice)) {
          console.warn('Invoice lookup did not return a match for query:', normalized)
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to fetch invoice by number:', error)
        }
      } finally {
        if (!cancelled) {
          setAutoOpenedInvoice(invoiceQueryParam)
        }
      }
    }

    fetchDirect()

    return () => {
      cancelled = true
    }
  }, [invoiceQueryParam, invoices, autoOpenedInvoice])

  const loadInvoices = useCallback(async () => {
    try {
      setLoading(true)
      const data: any = await api.getInvoices({
        search: searchTerm || undefined,
        type: typeFilter === 'all' ? undefined : typeFilter,
        status: statusFilter === 'all' ? undefined : statusFilter,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        sort: sortOrder,
        staffId: selectedStaff !== 'all' ? selectedStaff : undefined,
      })
      setInvoices(
        (Array.isArray(data) ? data : data?.results ?? []).map((item: any) => ({
          ...item,
          invoice_id: item.invoice_id || item.id || item._id,
          id: item.id || item._id,
          status: item.status || 'Paid',
          processed_by_name: item.processed_by_name || item.user_name,
          processed_by_role: item.processed_by_role || item.user_role,
        }))
      )
      setPage(1)
    } catch (error: any) {
      console.error('Failed to load invoices', error)
      alert(error.message || 'Failed to load invoices')
    } finally {
      setLoading(false)
    }
  }, [searchTerm, typeFilter, statusFilter, startDate, endDate, sortOrder, selectedStaff])

  useEffect(() => {
    loadInvoices()
  }, [loadInvoices])

  const paginatedInvoices = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return invoices.slice(start, start + PAGE_SIZE)
  }, [invoices, page])

  const totalPages = Math.max(1, Math.ceil(invoices.length / PAGE_SIZE))

  const totalInvoicesAmount = useMemo(() => {
    return invoices.reduce((sum, invoice) => sum + Number(invoice.amount || invoice.total || 0), 0)
  }, [invoices])

  const handleExportAll = async (format: 'pdf' | 'excel') => {
    try {
      setExporting(true)
      const filters = {
        search: searchTerm || undefined,
        type: typeFilter === 'all' ? undefined : typeFilter,
        status: statusFilter === 'all' ? undefined : statusFilter,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        sort: sortOrder,
        staffId: selectedStaff !== 'all' ? selectedStaff : undefined,
      }
      if (format === 'pdf') {
        const blob = await api.exportInvoicesPDF(filters)
        downloadBlob(blob, `invoices_${Date.now()}.pdf`)
      } else {
        const blob = await api.exportInvoicesExcel(filters)
        downloadBlob(blob, `invoices_${Date.now()}.xlsx`)
      }
    } catch (error: any) {
      alert(error.message || 'Failed to export invoices')
    } finally {
      setExporting(false)
    }
  }

  const handleExportSingle = async (invoice: InvoiceRow, format: 'pdf' | 'excel') => {
    try {
      setExporting(true)
      if (format === 'pdf') {
        const blob = await api.exportInvoicePDF(invoice.id)
        downloadBlob(blob, `${invoice.invoice_number}.pdf`)
      } else {
        const blob = await api.exportInvoiceExcel(invoice.id)
        downloadBlob(blob, `${invoice.invoice_number}.xlsx`)
      }
    } catch (error: any) {
      alert(error.message || 'Failed to export invoice')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-8 pb-32 md:pb-12">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 md:gap-6">
        <div className="text-center md:text-left space-y-2">
          <h1 className="text-3xl font-bold text-gray-900">Invoices</h1>
          <p className="text-gray-600 text-sm md:text-base">
            Review, manage, and export pharmacy & lab invoices from any device.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 w-full md:w-auto">
          <Button
            variant="outline"
            onClick={() => handleExportAll('pdf')}
            disabled={exporting}
            className="w-full sm:w-auto justify-center"
          >
            <Download className="w-4 h-4 mr-2" />
            Export {typeLabel} (PDF)
          </Button>
          <Button
            variant="outline"
            onClick={() => handleExportAll('excel')}
            disabled={exporting}
            className="w-full sm:w-auto justify-center"
          >
            <Download className="w-4 h-4 mr-2" />
            Export {typeLabel} (Excel)
          </Button>
        </div>
      </div>

      <Card>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
          <span className="inline-flex items-center gap-2 rounded-lg bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-600">
            <Filter className="h-3.5 w-3.5" /> Showing: {typeLabel}
          </span>
          {statusFilter !== 'all' && (
            <span className="text-xs text-gray-500">
              Status: {statusFilter}
            </span>
          )}
        </div>
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex items-center gap-2 text-sm text-gray-700">
            <Filter className="w-5 h-5 text-gray-400" />
            <span className="text-sm font-medium text-gray-700">Filters</span>
          </div>
          <div className="flex flex-col xl:flex-row xl:items-center gap-4 md:flex-1 md:ml-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search by invoice # or name"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 w-full"
              />
            </div>
            {canFilterStaff && staffFilterOptions.length > 0 ? (
              <select
                value={selectedStaff}
                onChange={(e) => setSelectedStaff(e.target.value)}
                disabled={staffLoading}
                className="rounded-xl border border-gray-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
              >
                {staffFilterOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            ) : (
              staffOptions.length > 0 && (
                <span className="text-sm bg-gray-100 text-gray-600 px-3 py-2 rounded-xl">
                  Viewing {staffOptions[0]?.label || 'your'} invoices
                </span>
              )
            )}
            <div className="grid w-full gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:flex xl:flex-row">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as any)}
                className="rounded-xl border border-gray-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white w-full"
              >
                <option value="all">All Types</option>
                <option value="pharmacy">Pharmacy Sales</option>
                <option value="lab">Lab Cashier</option>
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="rounded-xl border border-gray-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white w-full"
              >
                <option value="all">All Status</option>
                <option value="Paid">Paid</option>
                <option value="Pending">Pending</option>
                <option value="Cancelled">Cancelled</option>
              </select>
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}
                className="rounded-xl border border-gray-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white w-full"
              >
                <option value="desc">Newest First</option>
                <option value="asc">Oldest First</option>
              </select>
            </div>
          </div>
          <div className="grid sm:flex sm:flex-row gap-2 w-full md:w-auto">
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full sm:w-auto"
            />
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full sm:w-auto"
            />
          </div>
        </div>
        {(startDate || endDate) && (
          <div className="mt-3 text-right">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setStartDate('')
                setEndDate('')
              }}
              className="w-full sm:w-auto justify-center"
            >
              Clear Dates
            </Button>
          </div>
        )}
      </Card>

      <Card className="hidden md:block">
        {loading ? (
          <div className="py-12 text-center text-gray-600">Loading invoices...</div>
        ) : invoices.length === 0 ? (
          <div className="py-12 text-center text-gray-600">
            <FileText className="w-10 h-10 mx-auto mb-2 text-gray-400" />
            No invoices found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 text-left text-sm font-semibold text-gray-600">
                  <th className="px-4 py-3">Invoice #</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Processed By</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="text-sm text-gray-700">
                {paginatedInvoices.map((invoice) => (
                  <tr key={invoice.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 font-semibold text-gray-900">{invoice.invoice_number}</td>
                    <td className="px-4 py-3">{invoice.customer}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-lg text-xs font-medium ${
                        invoice.type === 'lab'
                          ? 'bg-purple-100 text-purple-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        {invoice.type === 'lab' ? 'Lab' : 'Pharmacy'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {new Date(invoice.date).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {invoice.processed_by_name ? (
                        <>
                          {invoice.processed_by_name}
                          {invoice.processed_by_role ? (
                            <span className="text-xs text-gray-500 ml-1">
                              ({formatRole(invoice.processed_by_role)})
                            </span>
                          ) : null}
                        </>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-lg text-xs font-medium ${
                        invoice.status.toLowerCase() === 'paid'
                          ? 'bg-green-100 text-green-700'
                          : invoice.status.toLowerCase() === 'pending'
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {invoice.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">
                      {formatCurrency(invoice.amount)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const invoiceId = invoice.invoice_id || invoice.id || invoice._id
                            if (!invoiceId) {
                              alert('Unable to open this invoice because its identifier is missing.')
                              return
                            }
                            const transactionId =
                              invoice.transaction_id ||
                              invoice.record_id ||
                              invoice.lab_record_id ||
                              invoice.sale_id ||
                              invoiceId
                            setSelectedInvoice({ id: invoiceId, type: invoice.type, transactionId })
                            setSelectedInvoiceData(invoice)
                            setShowViewer(true)
                          }}
                        >
                          <Eye className="w-4 h-4 mr-1" /> View
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleExportSingle(invoice, 'pdf')}
                          disabled={exporting}
                        >
                          <Download className="w-4 h-4 mr-1" /> PDF
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleExportSingle(invoice, 'excel')}
                          disabled={exporting}
                        >
                          <Download className="w-4 h-4 mr-1" /> Excel
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="md:hidden space-y-3">
        {loading ? (
          <div className="py-12 text-center text-gray-600">Loading invoices...</div>
        ) : invoices.length === 0 ? (
          <div className="py-12 text-center text-gray-600">
            <FileText className="w-10 h-10 mx-auto mb-2 text-gray-400" />
            No invoices found.
          </div>
        ) : (
          paginatedInvoices.map((invoice) => (
            <div key={invoice.id} className="rounded-2xl border border-gray-200 bg-white shadow-sm p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase text-gray-400 tracking-wide">Invoice</p>
                  <p className="text-sm font-semibold text-gray-900">#{invoice.invoice_number}</p>
                </div>
                <span className="text-base font-bold text-gray-900">{formatCurrency(invoice.amount)}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-semibold ${
                  invoice.type === 'lab'
                    ? 'bg-purple-100 text-purple-700 border border-purple-200'
                    : 'bg-blue-100 text-blue-700 border border-blue-200'
                }`}>
                  {invoice.type === 'lab' ? 'Lab' : 'Pharmacy'}
                </span>
                <span>{new Date(invoice.date).toLocaleDateString()}</span>
              </div>
              <div className="text-sm text-gray-700 space-y-1">
                <p>
                  <span className="font-medium text-gray-600">Customer:</span> {invoice.customer}
                </p>
                <p>
                  <span className="font-medium text-gray-600">Handled by:</span> {invoice.processed_by_name || '—'}
                </p>
              </div>
              <div className="flex items-center justify-between pt-2">
                <span className={`inline-flex items-center rounded-lg px-3 py-1 text-xs font-semibold ${
                  invoice.status.toLowerCase() === 'paid'
                    ? 'bg-green-100 text-green-700 border border-green-200'
                    : invoice.status.toLowerCase() === 'pending'
                    ? 'bg-yellow-100 text-yellow-700 border border-yellow-200'
                    : 'bg-red-100 text-red-700 border border-red-200'
                }`}>
                  {invoice.status}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const invoiceId = invoice.invoice_id || invoice.id || invoice._id
                    if (!invoiceId) {
                      alert('Unable to open this invoice because its identifier is missing.')
                      return
                    }
                    const transactionId =
                      invoice.transaction_id ||
                      invoice.record_id ||
                      invoice.lab_record_id ||
                      invoice.sale_id ||
                      invoiceId
                    setSelectedInvoice({ id: invoiceId, type: invoice.type, transactionId })
                    setSelectedInvoiceData(invoice)
                    setShowViewer(true)
                  }}
                >
                  View Invoice
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      {invoices.length > 0 && (
        <div className="flex items-center justify-between mt-6">
          <span className="text-sm text-gray-500">
            Showing {(page - 1) * PAGE_SIZE + 1} - {Math.min(page * PAGE_SIZE, invoices.length)} of {invoices.length}
          </span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
              Previous
            </Button>
            <span className="text-sm text-gray-600">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {showViewer && selectedInvoice && (
        <InvoiceViewer
          invoiceId={selectedInvoice.id}
          transactionId={selectedInvoice.transactionId}
          type={selectedInvoice.type}
          initialInvoice={selectedInvoiceData || undefined}
          onClose={() => {
            setShowViewer(false)
            setSelectedInvoice(null)
            setSelectedInvoiceData(null)
          }}
        />
      )}

      <div className="md:hidden fixed bottom-4 right-4">
        <Button
          variant="primary"
          className="rounded-full shadow-xl px-6 py-3"
          onClick={() => handleExportAll('excel')}
          disabled={exporting}
        >
          <Download className="w-4 h-4 mr-2" /> Export
        </Button>
      </div>

      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur border-t border-gray-200 px-4 py-3 shadow-inner">
        <div className="flex items-center justify-between text-sm font-semibold text-gray-700">
          <span>Total: {formatCurrency(totalInvoicesAmount)}</span>
          <span>Invoices: {invoices.length}</span>
        </div>
      </div>
    </div>
  )
}

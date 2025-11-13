import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Filter,
  Download,
  TestTube,
  ShoppingCart,
  Activity,
  Receipt,
  Loader2,
  Building2,
  Search,
  FileText,
  TrendingUp,
  TrendingDown,
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { api } from '@/lib/api'
import { useRealtimeEvent } from '@/contexts/RealtimeContext'
import { useUser } from '@/contexts/UserContext'
import { useStaffOptions } from '@/hooks/useStaffOptions'

type TransactionType = 'sale' | 'lab_cash' | 'expense' | 'debt_recovery' | 'adjustment'
type TransactionStatus = 'success' | 'pending' | 'cancelled'

interface LedgerTransaction {
  id: string
  invoice_id?: string
  invoice_number?: string
  transaction_type: TransactionType
  amount: number
  profit: number
  loss: number
  customer_name?: string
  handled_by?: {
    id?: string
    name?: string
    role?: string
  }
  status: TransactionStatus
  payment_method?: string
  notes?: string
  createdAt?: string
  updatedAt?: string
  meta?: any
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value || 0)

const transactionTypeMeta: Record<
  TransactionType,
  { label: string; icon: React.ComponentType<any>; badge: string }
> = {
  sale: {
    label: 'Sale',
    icon: ShoppingCart,
    badge: 'bg-blue-100 text-blue-700 border border-blue-200',
  },
  lab_cash: {
    label: 'Lab Cash',
    icon: TestTube,
    badge: 'bg-green-100 text-green-700 border border-green-200',
  },
  expense: {
    label: 'Expense',
    icon: Activity,
    badge: 'bg-rose-100 text-rose-700 border border-rose-200',
  },
  debt_recovery: {
    label: 'Debt Recovery',
    icon: Receipt,
    badge: 'bg-amber-100 text-amber-700 border border-amber-200',
  },
  adjustment: {
    label: 'Adjustment',
    icon: Building2,
    badge: 'bg-gray-100 text-gray-700 border border-gray-200',
  },
}

const statusBadgeClass: Record<TransactionStatus, string> = {
  success: 'bg-green-100 text-green-700 border border-green-200',
  pending: 'bg-yellow-100 text-yellow-700 border border-yellow-200',
  cancelled: 'bg-gray-100 text-gray-600 border border-gray-200',
}

const TransactionDetailsModal: React.FC<{
  transaction: LedgerTransaction
  onClose: () => void
  onOpenInvoice: (invoiceNumber?: string) => void
}> = ({ transaction, onClose, onOpenInvoice }) => {
  const typeMeta = transactionTypeMeta[transaction.transaction_type]

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm px-3 sm:px-4" onClick={onClose}>
      <Card
        className="w-full sm:max-w-xl max-h-[88vh] sm:max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-2xl shadow-2xl border border-gray-100 bg-white relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 w-9 h-9 flex items-center justify-center shadow-sm"
          aria-label="Close"
        >
          ✕
        </button>
        <div className="flex items-center gap-3 mb-6 pr-10">
          <div className="p-3 rounded-2xl bg-gray-100 shadow-inner">
            <typeMeta.icon className="w-6 h-6 text-gray-700" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Transaction Details</h3>
            <p className="text-xs text-gray-500 mt-0.5 uppercase tracking-widest">
              #{transaction.id}
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
              <p className="text-xs uppercase text-gray-500 tracking-wide">Linked Invoice</p>
              <p className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-500" />
                {transaction.invoice_number || '—'}
              </p>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
              <p className="text-xs uppercase text-gray-500 tracking-wide">Date</p>
              <p className="text-sm font-semibold text-gray-900">
                {transaction.createdAt
                  ? new Date(transaction.createdAt).toLocaleString()
                  : '—'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-gray-200 px-4 py-3">
              <p className="text-xs uppercase text-gray-500 tracking-wide">Type</p>
              <p className="text-sm font-semibold text-gray-900">{typeMeta.label}</p>
            </div>
            <div className="rounded-2xl border border-gray-200 px-4 py-3">
              <p className="text-xs uppercase text-gray-500 tracking-wide">Customer / Patient</p>
              <p className="text-sm font-semibold text-gray-900">
                {transaction.customer_name || 'Walk-in Customer'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-gray-200 px-4 py-3">
              <p className="text-xs uppercase text-gray-500 tracking-wide">Total Amount</p>
              <p className="text-base font-bold text-gray-900">
                {formatCurrency(transaction.amount)}
              </p>
            </div>
            <div className="rounded-2xl border border-gray-200 px-4 py-3">
              <p className="text-xs uppercase text-gray-500 tracking-wide flex items-center gap-1">
                <TrendingUp className="w-3 h-3" /> Profit
              </p>
              <p className="text-base font-semibold text-green-600">
                {formatCurrency(transaction.profit)}
              </p>
            </div>
            <div className="rounded-2xl border border-gray-200 px-4 py-3">
              <p className="text-xs uppercase text-gray-500 tracking-wide flex items-center gap-1">
                <TrendingDown className="w-3 h-3" /> Loss
              </p>
              <p className="text-base font-semibold text-rose-600">
                {formatCurrency(transaction.loss)}
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 px-4 py-3">
            <p className="text-xs uppercase text-gray-500 tracking-wide">Handled By</p>
            <p className="text-sm font-semibold text-gray-900">
              {transaction.handled_by?.name || '—'}
              {transaction.handled_by?.role ? ` (${transaction.handled_by.role})` : ''}
            </p>
          </div>

          <div className="rounded-2xl border border-gray-200 px-4 py-3">
            <p className="text-xs uppercase text-gray-500 tracking-wide">Status</p>
            <span className={`mt-1 inline-flex items-center rounded-lg px-3 py-1 text-xs font-semibold ${statusBadgeClass[transaction.status]}`}>
              {transaction.status === 'success'
                ? 'Success'
                : transaction.status === 'pending'
                ? 'Pending'
                : 'Cancelled'}
            </span>
          </div>

          {transaction.notes && (
            <div className="rounded-2xl border border-dashed border-gray-300 px-4 py-3 bg-gray-50">
              <p className="text-xs uppercase text-gray-500 tracking-wide">Notes</p>
              <p className="text-sm text-gray-700 mt-1">{transaction.notes}</p>
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:justify-between gap-3 pt-4">
            <Button
              variant="outline"
              className="justify-center sm:justify-start"
              onClick={onClose}
            >
              Close
            </Button>
            <Button
              variant="primary"
              className="justify-center sm:justify-end"
              disabled={!transaction.invoice_number}
              onClick={() => onOpenInvoice(transaction.invoice_number)}
            >
              View Invoice Details
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}

export const Transactions: React.FC = () => {
  const navigate = useNavigate()
  const { user } = useUser()
  const { options: staffOptions, loading: staffLoading } = useStaffOptions()
  const [transactions, setTransactions] = useState<LedgerTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [searchTerm, setSearchTerm] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | TransactionType>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | TransactionStatus>('all')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [selectedStaff, setSelectedStaff] = useState<string>('all')
  const [selectedTransaction, setSelectedTransaction] = useState<LedgerTransaction | null>(null)
  const [showTransactionModal, setShowTransactionModal] = useState(false)
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [exporting, setExporting] = useState(false)

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

  const loadTransactions = useCallback(async () => {
    try {
      setLoading(true)
      const response: any = await api.getTransactions({
        page,
        sort: sortOrder,
        search: searchTerm || undefined,
        type: typeFilter === 'all' ? undefined : typeFilter,
        status: statusFilter === 'all' ? undefined : statusFilter,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        staffId: selectedStaff !== 'all' ? selectedStaff : undefined,
      })
      setTransactions(response.results || [])
      setTotal(response.total || 0)
      setPages(response.pages || 1)
      setPage(response.page || 1)
    } catch (error: any) {
      console.error('Failed to load transactions', error)
      alert(error.message || 'Failed to load transactions')
    } finally {
      setLoading(false)
    }
  }, [page, sortOrder, searchTerm, typeFilter, statusFilter, startDate, endDate, selectedStaff])

  useEffect(() => {
    loadTransactions()
  }, [loadTransactions])

  useRealtimeEvent('transactions:new', (payload: any) => {
    const tx = payload?.transaction
    if (!tx) return
    setTransactions((prev) => [tx, ...prev].slice(0, 20))
    setTotal((prev) => prev + 1)
  })

  const totalAmount = useMemo(
    () => transactions.reduce((sum, t) => sum + (t.amount || 0), 0),
    [transactions]
  )
  const totalProfit = useMemo(
    () => transactions.reduce((sum, t) => sum + (t.profit || 0), 0),
    [transactions]
  )

  const handleExport = async () => {
    try {
      setExporting(true)
      const blob = await api.exportTransactionsExcel({
        sort: sortOrder,
        search: searchTerm || undefined,
        type: typeFilter === 'all' ? undefined : typeFilter,
        status: statusFilter === 'all' ? undefined : statusFilter,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        staffId: selectedStaff !== 'all' ? selectedStaff : undefined,
      })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `transactions_${Date.now()}.xlsx`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (error: any) {
      console.error('Export failed', error)
      alert(error.message || 'Failed to export transactions')
    } finally {
      setExporting(false)
    }
  }

  const openInvoice = (invoiceNumber?: string) => {
    setShowTransactionModal(false)
    if (!invoiceNumber) return
    navigate(`/dashboard/invoices?invoice=${encodeURIComponent(invoiceNumber)}`)
  }

  return (
    <div className="space-y-8 pb-32 md:pb-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 md:gap-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Transactions</h1>
          <p className="text-gray-600 mt-2">
            Invoice-linked sales, lab cash, expenses, and debt recoveries in one ledger.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={() => setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'))}
            className="justify-center gap-2"
          >
            <Filter className="w-4 h-4" />
            {sortOrder === 'desc' ? 'Newest First' : 'Oldest First'}
          </Button>
          <Button
            variant="outline"
            onClick={handleExport}
            disabled={exporting}
            className="justify-center gap-2"
          >
            <Download className="w-4 h-4" />
            Export (Excel)
          </Button>
        </div>
      </div>

      <Card className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="rounded-2xl border border-gray-200 bg-gray-50 px-5 py-4">
            <p className="text-xs uppercase text-gray-500 tracking-wide">Total Transactions</p>
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalAmount)}</p>
            <p className="text-xs text-gray-400 mt-1">{total} records</p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-gray-50 px-5 py-4">
            <p className="text-xs uppercase text-gray-500 tracking-wide">Total Profit</p>
            <p className="text-2xl font-bold text-green-600">{formatCurrency(totalProfit)}</p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-gray-50 px-5 py-4">
            <p className="text-xs uppercase text-gray-500 tracking-wide">Filter by Type</p>
            <select
              className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value as 'all' | TransactionType)
                setPage(1)
              }}
            >
              <option value="all">All Types</option>
              <option value="sale">Sales</option>
              <option value="lab_cash">Lab Cash</option>
              <option value="expense">Expenses</option>
              <option value="debt_recovery">Debt Recovery</option>
              <option value="adjustment">Adjustments</option>
            </select>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-gray-50 px-5 py-4">
            <p className="text-xs uppercase text-gray-500 tracking-wide">Filter by Status</p>
            <select
              className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as 'all' | TransactionStatus)
                setPage(1)
              }}
            >
              <option value="all">All Statuses</option>
              <option value="success">Success</option>
              <option value="pending">Pending</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="md:col-span-2">
            <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <Search className="w-4 h-4 text-gray-400" />
              Search
            </label>
            <input
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value)
                setPage(1)
              }}
              placeholder="Search by invoice, customer, handler..."
              className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value)
                setPage(1)
              }}
              className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value)
                setPage(1)
              }}
              className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Staff</label>
            {canFilterStaff ? (
              <select
                value={selectedStaff}
                onChange={(e) => {
                  setSelectedStaff(e.target.value)
                  setPage(1)
                }}
                disabled={staffLoading}
                className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                {staffFilterOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            ) : (
              <p className="mt-1 text-sm text-gray-500 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
                Viewing your own transactions
              </p>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 overflow-hidden hidden md:block">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-gray-600">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              Loading transactions...
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-12 text-gray-600">No transactions found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                  <tr>
                    <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Date
                    </th>
                    <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Transaction ID
                    </th>
                    <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Invoice #
                    </th>
                    <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Type
                    </th>
                    <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Customer / Patient
                    </th>
                    <th className="text-right py-3 px-4 text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Amount
                    </th>
                    <th className="text-right py-3 px-4 text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Profit
                    </th>
                    <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Handled By
                    </th>
                    <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((transaction) => {
                    const meta = transactionTypeMeta[transaction.transaction_type]
                    return (
                      <tr
                        key={transaction.id}
                        className="border-b border-gray-100 hover:bg-primary-50 cursor-pointer transition-all duration-200"
                        onClick={() => {
                          setSelectedTransaction(transaction)
                          setShowTransactionModal(true)
                        }}
                      >
                        <td className="py-3 px-4 text-sm text-gray-600">
                          {transaction.createdAt
                            ? new Date(transaction.createdAt).toLocaleString()
                            : '—'}
                        </td>
                        <td className="py-3 px-4 text-xs font-mono text-gray-500">
                          #{transaction.id?.slice(-8)}
                        </td>
                        <td className="py-3 px-4 text-sm">
                          {transaction.invoice_number ? (
                            <span className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-600 border border-blue-100 uppercase tracking-wide">
                              <FileText className="w-3.5 h-3.5" />
                              {transaction.invoice_number}
                            </span>
                          ) : (
                            <span className="text-gray-400 text-xs">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold ${meta.badge}`}>
                            <meta.icon className="w-3.5 h-3.5" />
                            {meta.label}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-800 font-medium">
                          {transaction.customer_name || '—'}
                        </td>
                        <td className="py-3 px-4 text-sm text-right text-gray-900 font-semibold">
                          {formatCurrency(transaction.amount)}
                        </td>
                        <td className="py-3 px-4 text-sm text-right text-green-600 font-semibold">
                          {formatCurrency(transaction.profit)}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600">
                          {transaction.handled_by?.name || '—'}
                          {transaction.handled_by?.role ? (
                            <span className="text-xs text-gray-400 ml-1">
                              ({transaction.handled_by.role})
                            </span>
                          ) : null}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center rounded-lg px-3 py-1 text-xs font-semibold ${statusBadgeClass[transaction.status]}`}
                          >
                            {transaction.status === 'success'
                              ? 'Success'
                              : transaction.status === 'pending'
                              ? 'Pending'
                              : 'Cancelled'}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="md:hidden space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-gray-600">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              Loading transactions...
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-12 text-gray-600">No transactions found.</div>
          ) : (
            transactions.map((transaction) => {
              const meta = transactionTypeMeta[transaction.transaction_type]
              return (
                <div
                  key={transaction.id}
                  className="rounded-2xl border border-gray-200 bg-white shadow-sm p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs uppercase text-gray-400 tracking-wide">Transaction</p>
                      <p className="text-sm font-semibold text-gray-900">#{transaction.id?.slice(-8)}</p>
                    </div>
                    <span className="text-base font-bold text-gray-900">{formatCurrency(transaction.amount)}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${meta.badge}`}>
                      <meta.icon className="w-3 h-3" />
                      {meta.label}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
                      Profit {formatCurrency(transaction.profit)}
                    </span>
                    <span className="text-xs text-gray-500">
                      {transaction.createdAt ? new Date(transaction.createdAt).toLocaleDateString() : '—'}
                    </span>
                  </div>
                  <div className="space-y-2 text-sm text-gray-700">
                    <p>
                      <span className="font-medium text-gray-600">Customer:</span> {transaction.customer_name || '—'}
                    </p>
                    <p>
                      <span className="font-medium text-gray-600">Handled by:</span> {transaction.handled_by?.name || '—'}
                    </p>
                  </div>
                  <div className="flex items-center justify-between pt-2">
                    <span className={`inline-flex items-center rounded-lg px-3 py-1 text-xs font-semibold ${statusBadgeClass[transaction.status]}`}>
                      {transaction.status === 'success'
                        ? 'Success'
                        : transaction.status === 'pending'
                        ? 'Pending'
                        : 'Cancelled'}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedTransaction(transaction)
                        setShowTransactionModal(true)
                      }}
                    >
                      View Details
                    </Button>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {pages > 1 && (
          <div className="flex items-center justify-between pt-4">
            <span className="text-sm text-gray-500">
              Showing {(page - 1) * 20 + 1} - {Math.min(page * 20, total)} of {total}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                disabled={page === 1}
              >
                Previous
              </Button>
              <span className="text-sm text-gray-600">
                Page {page} of {pages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((prev) => Math.min(pages, prev + 1))}
                disabled={page === pages}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>

      {showTransactionModal && selectedTransaction && (
        <TransactionDetailsModal
          transaction={selectedTransaction}
          onClose={() => {
            setShowTransactionModal(false)
            setSelectedTransaction(null)
          }}
          onOpenInvoice={openInvoice}
        />
      )}

      <div className="md:hidden fixed bottom-4 right-4">
        <Button
          variant="primary"
          className="rounded-full shadow-xl px-6 py-3"
          onClick={handleExport}
          disabled={exporting}
        >
          <Download className="w-4 h-4 mr-2" /> Export
        </Button>
      </div>

      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur border-t border-gray-200 px-4 py-3 shadow-inner">
        <div className="flex items-center justify-between text-sm font-semibold text-gray-700">
          <span>Amount: {formatCurrency(totalAmount)}</span>
          <span>Profit: {formatCurrency(totalProfit)}</span>
        </div>
      </div>
    </div>
  )
}


import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { Download, FileText, TestTube, DollarSign, TrendingDown } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { api } from '@/lib/api'
import { useRealtimeEvent } from '@/contexts/RealtimeContext'
import { useUser } from '@/contexts/UserContext'
import { useStaffOptions } from '@/hooks/useStaffOptions'
import {
  endOfDay,
  endOfMonth,
  endOfWeek,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subHours,
  subMonths,
  subYears,
} from 'date-fns'

const normalizeDebtValues = (debt: any) => {
  const amountRaw = Number(debt?.amount ?? debt?.total ?? 0)
  const paidRaw = Number(debt?.paid_amount ?? debt?.paid ?? 0)
  const amount = Number.isFinite(amountRaw) ? amountRaw : 0
  const paid = Number.isFinite(paidRaw) ? paidRaw : 0
  const remainingRaw = amount - paid
  const remaining = Number.isFinite(remainingRaw) ? Math.max(remainingRaw, 0) : 0

  return { amount, paid, remaining }
}

type DateRangeOption =
  | 'today'
  | 'last_24_hours'
  | 'this_week'
  | 'this_month'
  | 'six_months'
  | 'one_year'
  | 'all'

type ExportType =
  | 'overview'
  | 'sales'
  | 'lab'
  | 'expenses'
  | 'debts'
  | 'medicines'
  | 'staff'
  | 'transactions'

const dateRangeOptions: Array<{ value: DateRangeOption; label: string }> = [
  { value: 'today', label: 'Today' },
  { value: 'last_24_hours', label: 'Last 24 Hours' },
  { value: 'this_week', label: 'This Week' },
  { value: 'this_month', label: 'This Month' },
  { value: 'six_months', label: '6 Months' },
  { value: 'one_year', label: '1 Year' },
  { value: 'all', label: 'All' },
]

const exportOptions: Array<{ value: ExportType; label: string }> = [
  { value: 'overview', label: 'Overview Summary' },
  { value: 'sales', label: 'Sales (Pharmacy)' },
  { value: 'transactions', label: 'Transactions (Pharmacy + Lab)' },
  { value: 'lab', label: 'Lab Reports' },
  { value: 'expenses', label: 'Expenses' },
  { value: 'debts', label: 'Debts' },
  { value: 'medicines', label: 'Medicines Inventory' },
  { value: 'staff', label: 'Staff Performance' },
]

const getDateRangeBounds = (range: DateRangeOption): { startDate?: string; endDate?: string } => {
  const now = new Date()

  switch (range) {
    case 'today': {
      const start = startOfDay(now)
      const end = endOfDay(now)
      return { startDate: start.toISOString(), endDate: end.toISOString() }
    }
    case 'last_24_hours': {
      const start = subHours(now, 24)
      const end = now
      return { startDate: start.toISOString(), endDate: end.toISOString() }
    }
    case 'this_week': {
      const start = startOfWeek(now, { weekStartsOn: 1 })
      const end = endOfWeek(now, { weekStartsOn: 1 })
      return { startDate: start.toISOString(), endDate: end.toISOString() }
    }
    case 'this_month': {
      const start = startOfMonth(now)
      const end = endOfMonth(now)
      return { startDate: start.toISOString(), endDate: end.toISOString() }
    }
    case 'six_months': {
      const start = startOfDay(subMonths(now, 6))
      const end = endOfDay(now)
      return { startDate: start.toISOString(), endDate: end.toISOString() }
    }
    case 'one_year': {
      const start = startOfDay(subYears(now, 1))
      const end = endOfDay(now)
      return { startDate: start.toISOString(), endDate: end.toISOString() }
    }
    case 'all':
    default:
      return {}
  }
}

export const Reports: React.FC = () => {
  const { user } = useUser()
  const { options: staffOptions, loading: staffLoading } = useStaffOptions()
  const [loading, setLoading] = useState(true)
  const [expenses, setExpenses] = useState<any[]>([])
  const [debts, setDebts] = useState<any[]>([])
  const [labResults, setLabResults] = useState<any[]>([])
  const [metrics, setMetrics] = useState({
    totalSales: 0,
    totalCost: 0,
    totalProfit: 0,
    totalExpenses: 0,
    totalDebts: 0,
    totalLabRevenue: 0,
    profitMargin: 0,
    lossCount: 0,
    lossAmount: 0,
  })
  const [chartData, setChartData] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState<'overview' | 'lab' | 'debts' | 'expenses'>('overview')
  const [selectedStaff, setSelectedStaff] = useState<string>('all')
  const [selectedRange, setSelectedRange] = useState<DateRangeOption>('all')
  const [exportType, setExportType] = useState<ExportType>('overview')
  const [exporting, setExporting] = useState(false)
  const [staffSummary, setStaffSummary] = useState<
    Array<{
      id: string
      name: string
      role: string
      salesAmount: number
      labAmount: number
      transactions: number
      total: number
      profit: number
    }>
  >([])
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

useEffect(() => {
  if (user?.role === 'staff' && user._id) {
    setSelectedStaff(user._id)
  }
}, [user?._id, user?.role])

const canFilterStaff = useMemo(
  () => user?.role === 'pharmacy_owner' || user?.role === 'super_admin',
  [user?.role]
)

const canViewProfitMetrics = useMemo(() => {
  if (!user) return false
  if (user.role === 'super_admin' || user.role === 'pharmacy_owner') return true
  return Array.isArray(user.permissions) && user.permissions.some((permission: string) =>
    ['sales:profit_view', 'reports:profit_view'].includes(permission)
  )
}, [user])

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

const selectedRangeBounds = useMemo(() => getDateRangeBounds(selectedRange), [selectedRange])
const profitPieColors = ['#2563eb', '#10b981', '#f97316', '#8b5cf6', '#ec4899', '#facc15']

const profitDistributionData = useMemo(() => {
  if (!canViewProfitMetrics) return []
  const positiveProfit = staffSummary.filter((entry) => entry.profit > 0)
  if (!positiveProfit.length) return []
  return positiveProfit.map((entry) => ({
    name: entry.name,
    value: Number(entry.profit || 0),
  }))
}, [staffSummary, canViewProfitMetrics])

const loadReportsData = useCallback(async () => {
  try {
    setLoading(true)
    const staffId = selectedStaff !== 'all' ? selectedStaff : undefined
    const { startDate, endDate } = selectedRangeBounds

    const salesParams: Record<string, string> = {}
    if (staffId) salesParams.staffId = staffId
    if (startDate) salesParams.startDate = startDate
    if (endDate) salesParams.endDate = endDate

    const labParams: Record<string, string> = {}
    if (staffId) labParams.staffId = staffId
    if (startDate) labParams.startDate = startDate
    if (endDate) labParams.endDate = endDate

    const [salesRaw, expensesRaw, debtsRaw, labRecordsRaw] = await Promise.all([
      api.getSales(Object.keys(salesParams).length ? salesParams : undefined),
      api.getExpenses(undefined, startDate, endDate),
      api.getDebts(),
      api.getLabCashierRecords(Object.keys(labParams).length ? labParams : undefined),
    ])

    const toArray = (value: any): any[] => {
      if (Array.isArray(value)) return value
      if (value?.results && Array.isArray(value.results)) return value.results
      return []
    }

    const salesData = toArray(salesRaw)
    const expensesData = toArray(expensesRaw)
    const debtsData = toArray(debtsRaw)
    const labRecords = toArray(labRecordsRaw)

    const startBoundary = startDate ? new Date(startDate) : null
    const endBoundary = endDate ? new Date(endDate) : null

    const filteredDebts =
      startBoundary && endBoundary
        ? debtsData.filter((debt: any) => {
            if (!debt?.createdAt) return true
            const created = new Date(debt.createdAt)
          return created >= startBoundary && created <= endBoundary
          })
        : debtsData

    setExpenses(expensesData)
    setDebts(filteredDebts)

    const completedLabRecords = labRecords.filter((record: any) => record.status === 'complete')
    setLabResults(completedLabRecords)

    const totalSales = salesData.reduce((sum: number, s: any) => sum + Number(s.total_sale || 0), 0)
    const totalProfit = salesData.reduce((sum: number, s: any) => sum + Number(s.profit || 0), 0)
    const totalCost = salesData.reduce(
      (sum: number, s: any) => sum + (Number(s.total_sale || 0) - Number(s.profit || 0)),
      0
    )
    const lossTransactions = salesData.filter(
      (s: any) => Number(s.profit || 0) < 0 || s.is_loss_sale
    )
    const lossCount = lossTransactions.length
    const lossAmount = lossTransactions.reduce((sum: number, s: any) => {
      const profitValue = Number(s.profit || 0)
      return profitValue < 0 ? sum + Math.abs(profitValue) : sum
    }, 0)
    const totalExpenses = expensesData.reduce((sum: number, e: any) => sum + Number(e.amount || 0), 0)
    const totalDebts = filteredDebts.reduce(
      (sum: number, d: any) => sum + normalizeDebtValues(d).remaining,
      0
    )
    const totalLabRevenue = completedLabRecords.reduce((sum: number, r: any) => sum + Number(r.price || 0), 0)
    const profitMargin = totalSales > 0 ? (totalProfit / totalSales) * 100 : 0

    setMetrics({
      totalSales,
      totalCost,
      totalProfit,
      totalExpenses,
      totalDebts,
      totalLabRevenue,
      profitMargin,
      lossCount,
      lossAmount,
    })

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const data: any[] = []

    for (let i = 5; i >= 0; i--) {
      const date = new Date()
      date.setMonth(date.getMonth() - i)
      const monthSales = salesData.filter((s: any) => {
        const saleDate = new Date(s.createdAt)
        return saleDate.getMonth() === date.getMonth() && saleDate.getFullYear() === date.getFullYear()
      })
      const monthExpenses = expensesData.filter((e: any) => {
        const expenseDate = new Date(e.date)
        return expenseDate.getMonth() === date.getMonth() && expenseDate.getFullYear() === date.getFullYear()
      })

      const salesTotal = monthSales.reduce((sum: number, s: any) => sum + Number(s.total_sale || 0), 0)
      const expensesTotal = monthExpenses.reduce((sum: number, e: any) => sum + Number(e.amount || 0), 0)
      const profitTotal = monthSales.reduce((sum: number, s: any) => sum + Number(s.profit || 0), 0)
      const costTotal = monthSales.reduce(
        (sum: number, s: any) => sum + (Number(s.total_sale || 0) - Number(s.profit || 0)),
        0
      )

      data.push({
        month: months[date.getMonth()],
        sales: salesTotal,
        expenses: expensesTotal,
        cost: costTotal,
        profit: profitTotal,
      })
    }

    setChartData(data)
    setLastUpdated(new Date())

  const staffAggregate = new Map<
    string,
    {
      id: string
      name: string
      role: string
      salesAmount: number
      labAmount: number
      transactions: number
      total: number
      profit: number
    }
  >()

    const ensureStaffEntry = (id: string, name: string, role: string) => {
      if (!id) return null
      if (!staffAggregate.has(id)) {
        staffAggregate.set(id, {
          id,
          name,
          role,
          salesAmount: 0,
          labAmount: 0,
          transactions: 0,
        total: 0,
        profit: 0,
        })
      }
      return staffAggregate.get(id)!
    }

    salesData.forEach((sale: any) => {
      const id = sale.processed_by_id?.toString?.() || sale.user_id?.toString?.() || ''
      const entry = ensureStaffEntry(
        id,
        sale.processed_by_name || sale.user_name || 'Team Member',
        sale.processed_by_role || sale.user_role || 'staff'
      )
      if (!entry) return
      entry.salesAmount += Number(sale.total_sale || 0)
      entry.transactions += 1
    entry.profit += Number(sale.profit || 0)
      entry.total = entry.salesAmount + entry.labAmount
    })

    labRecords.forEach((record: any) => {
      const id = record.processed_by_id?.toString?.() || record.user_id?.toString?.() || ''
      const entry = ensureStaffEntry(
        id,
        record.processed_by_name || record.user_name || record.cashier_name || 'Team Member',
        record.processed_by_role || record.user_role || 'staff'
      )
      if (!entry) return
      entry.labAmount += Number(record.price || 0)
      if (record.status === 'complete') {
        entry.transactions += 1
      }
      entry.total = entry.salesAmount + entry.labAmount
    })

    setStaffSummary(
      Array.from(staffAggregate.values()).sort((a, b) => b.total - a.total)
    )
  } catch (error: any) {
    console.error('Error loading reports:', error)
    alert(`Error: ${error.message}`)
  } finally {
    setLoading(false)
  }
}, [selectedStaff, selectedRangeBounds])

  useEffect(() => {
    loadReportsData()
  }, [loadReportsData])

  useRealtimeEvent('dashboard:metrics', () => {
    loadReportsData()
  })

  useRealtimeEvent('sales:created', () => {
    loadReportsData()
  })

  useRealtimeEvent('lab:updated', () => {
    loadReportsData()
  })

  const lastUpdatedLabel = useMemo(() => {
    if (!lastUpdated) return 'Live data'
    const diff = Date.now() - lastUpdated.getTime()
    if (diff < 30000) return 'Updated moments ago'
    if (diff < 60000) return 'Updated less than a minute ago'
    const minutes = Math.round(diff / 60000)
    return `Updated ${minutes} min${minutes > 1 ? 's' : ''} ago`
  }, [lastUpdated])

  const formatRoleLabel = useCallback((role?: string) => {
    if (!role || role === 'all') return ''
    return role
      .toString()
      .split('_')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ')
  }, [])

  const staffChartData = useMemo(() => staffSummary.slice(0, 5), [staffSummary])

  const downloadBlob = useCallback((blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.setTimeout(() => {
      URL.revokeObjectURL(url)
    }, 1500)
  }, [])

  const handleExport = useCallback(
    async (requestedType?: ExportType) => {
      try {
        setExporting(true)
        const type = requestedType || exportType
        const staffId = selectedStaff !== 'all' ? selectedStaff : undefined
        const { startDate, endDate } = selectedRangeBounds
        const blob = await api.exportReportsExcel({
          type,
          startDate,
          endDate,
          staffId,
        })
        const timestamp = new Date().toISOString().split('T')[0]
        downloadBlob(blob, `reports_${type}_${timestamp}.xlsx`)
      } catch (error: any) {
        alert(error.message || 'Failed to export report')
      } finally {
        setExporting(false)
      }
    },
    [downloadBlob, exportType, selectedRangeBounds, selectedStaff]
  )

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="flex items-center justify-center py-12">
          <p className="text-gray-600">Loading reports...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8 pb-28 md:pb-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Reports & Analytics</h1>
          <p className="text-gray-600 mt-2">Detailed insights and analytics</p>
          <p className="text-xs text-gray-500 mt-1">{lastUpdatedLabel}</p>
        </div>
        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3">
          <div className="flex items-center gap-2">
            {canFilterStaff && staffFilterOptions.length > 0 ? (
              <select
                value={selectedStaff}
                onChange={(e) => setSelectedStaff(e.target.value)}
                disabled={staffLoading}
                className="rounded-xl border border-gray-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white min-w-[180px]"
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
                  Viewing {staffOptions[0]?.label || 'your'} activity
                </span>
              )
            )}
          </div>
          <div className="flex items-center gap-2">
            <select
              value={exportType}
              onChange={(e) => setExportType(e.target.value as ExportType)}
              className="rounded-xl border border-gray-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white min-w-[200px]"
            >
              {exportOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <Button
              onClick={() => handleExport()}
              disabled={exporting}
            >
              <Download className="w-4 h-4 mr-2" />
              {exporting ? 'Exporting…' : 'Export Excel'}
            </Button>
          </div>
          <Button variant="outline" onClick={loadReportsData}>
            <FileText className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {dateRangeOptions.map((option) => (
          <Button
            key={option.value}
            size="sm"
            variant={selectedRange === option.value ? 'primary' : 'outline'}
            className={
              selectedRange === option.value
                ? 'shadow-sm'
                : 'bg-white text-gray-600 hover:text-primary-600'
            }
            type="button"
            aria-pressed={selectedRange === option.value}
            onClick={() => setSelectedRange(option.value)}
          >
            {option.label}
          </Button>
        ))}
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
        <Card>
          <p className="text-sm text-gray-600 mb-1">Total Sales</p>
          <p className="text-2xl font-bold text-gray-900">${metrics.totalSales.toFixed(2)}</p>
        </Card>

        {canViewProfitMetrics && (
          <>
            <Card>
              <p className="text-sm text-gray-600 mb-1">Total Cost</p>
              <p className="text-2xl font-bold text-gray-900">${metrics.totalCost.toFixed(2)}</p>
            </Card>
            <Card>
              <p className="text-sm text-gray-600 mb-1">Total Profit</p>
              <p
                className={`text-2xl font-bold ${
                  metrics.totalProfit < 0
                    ? 'text-red-600'
                    : metrics.totalProfit === 0
                    ? 'text-yellow-600'
                    : 'text-green-600'
                }`}
              >
                ${metrics.totalProfit.toFixed(2)}
              </p>
            </Card>
          </>
        )}

        <Card>
          <p className="text-sm text-gray-600 mb-1">Total Expenses</p>
          <p className="text-2xl font-bold text-red-600">${metrics.totalExpenses.toFixed(2)}</p>
        </Card>

        <Card>
          <p className="text-sm text-gray-600 mb-1">Lab Revenue</p>
          <p className="text-2xl font-bold text-blue-600">${metrics.totalLabRevenue.toFixed(2)}</p>
        </Card>

        <Card>
          <p className="text-sm text-gray-600 mb-1">Total Debts</p>
          <p className="text-2xl font-bold text-orange-600">${metrics.totalDebts.toFixed(2)}</p>
        </Card>

        {canViewProfitMetrics && (
          <>
            <Card>
              <p className="text-sm text-gray-600 mb-1">Loss Transactions</p>
              <p className="text-2xl font-bold text-red-600">{metrics.lossCount}</p>
              <p className="text-xs text-red-500 mt-1">
                Loss Impact: ${metrics.lossAmount.toFixed(2)}
              </p>
            </Card>
            <Card>
              <p className="text-sm text-gray-600 mb-1">Profit Margin</p>
              <p className="text-2xl font-bold text-gray-900">
                {metrics.profitMargin.toFixed(1)}%
              </p>
            </Card>
          </>
        )}

        {!canViewProfitMetrics && (
          <Card className="border-dashed border-gray-200 bg-gray-50 text-gray-600 col-span-full">
            <p className="text-sm font-semibold text-gray-700">Profit analytics unavailable</p>
            <p className="text-xs text-gray-500 mt-1">
              Profit and loss insights are hidden for your role. Contact an administrator for access.
            </p>
          </Card>
        )}
      </div>

      {selectedStaff === 'all' && staffChartData.length > 0 && (
        <Card>
          <h2 className="text-xl font-bold text-gray-900 mb-6">Top Performing Staff</h2>
          <div
            className={`grid grid-cols-1 gap-6 ${
              canViewProfitMetrics && profitDistributionData.length > 0
                ? 'lg:grid-cols-3'
                : 'lg:grid-cols-2'
            }`}
          >
            <div className="space-y-3">
              {staffChartData.map((staff, index) => (
                <div
                  key={staff.id}
                  className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 px-4 py-3"
                >
                  <div>
                    <p className="font-semibold text-gray-900">#{index + 1} {staff.name}</p>
                    <p className="text-xs text-gray-500">
                      {formatRoleLabel(staff.role) || 'Staff'} • {staff.transactions} transaction{staff.transactions !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-primary-600">
                      ${(staff.total).toFixed(2)}
                    </p>
                    <p className="text-xs text-gray-500">
                      Sales ${staff.salesAmount.toFixed(2)} • Lab ${staff.labAmount.toFixed(2)}
                    </p>
                    {canViewProfitMetrics && (
                      <p className="text-xs text-green-600 font-semibold">
                        Profit ${staff.profit.toFixed(2)}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={staffChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis />
                  <Tooltip formatter={(value: number) => `$${value.toFixed(2)}`} />
                  <Legend />
                  <Bar dataKey="salesAmount" name="Sales" fill="#2563eb" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="labAmount" name="Lab" fill="#16a34a" radius={[6, 6, 0, 0]} />
                  {canViewProfitMetrics && (
                    <Bar dataKey="profit" name="Profit" fill="#f59e0b" radius={[6, 6, 0, 0]} />
                  )}
                </BarChart>
              </ResponsiveContainer>
            </div>
            {canViewProfitMetrics && profitDistributionData.length > 0 && (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Tooltip formatter={(value: number) => `$${value.toFixed(2)}`} />
                    <Legend />
                    <Pie
                      data={profitDistributionData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={45}
                      outerRadius={80}
                      paddingAngle={2}
                    >
                      {profitDistributionData.map((entry, index) => (
                        <Cell
                          key={entry.name}
                          fill={profitPieColors[index % profitPieColors.length]}
                        />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8">
          {[
            { id: 'overview', label: 'Overview', icon: TrendingDown },
            { id: 'lab', label: 'Lab Reports', icon: TestTube },
            { id: 'debts', label: 'Debts', icon: DollarSign },
            { id: 'expenses', label: 'Expenses', icon: FileText },
          ].map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            )
          })}
        </nav>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <Card>
            <h2 className="text-xl font-bold text-gray-900 mb-4">Sales vs Expenses</h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="sales" stroke="#2563eb" name="Sales" strokeWidth={2} />
                {canViewProfitMetrics && (
                  <Line
                    type="monotone"
                    dataKey="cost"
                    stroke="#7c3aed"
                    name="Cost"
                    strokeWidth={2}
                  />
                )}
                <Line
                  type="monotone"
                  dataKey="expenses"
                  stroke="#ef4444"
                  name="Expenses"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </Card>

          {canViewProfitMetrics ? (
            <Card>
              <h2 className="text-xl font-bold text-gray-900 mb-4">Sales • Cost • Profit</h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip formatter={(value: number) => `$${value.toFixed(2)}`} />
                  <Legend />
                  <Bar dataKey="sales" fill="#2563eb" name="Sales" />
                  <Bar dataKey="cost" fill="#7c3aed" name="Cost" />
                  <Bar dataKey="profit" fill="#10b981" name="Profit" />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          ) : (
            <Card className="flex items-center justify-center bg-gray-50 border-dashed border-gray-200">
              <p className="text-sm text-gray-600 text-center px-6">
                Profit analytics are hidden for your role. Contact an administrator if you need access
                to profit trends.
              </p>
            </Card>
          )}
        </div>
      )}

      {/* Lab Reports Tab */}
      {activeTab === 'lab' && (
        <Card>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">Lab Reports</h2>
            <Button onClick={() => handleExport('lab')} disabled={exporting}>
              <Download className="w-4 h-4 mr-2" />
              {exporting ? 'Exporting…' : 'Export Excel'}
            </Button>
          </div>
          {labResults.length === 0 ? (
            <div className="text-center py-12">
              <TestTube className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No lab reports found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Date</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Patient</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Sample</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Diseases</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Invoice #</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Status</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-700">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {labResults.map((record: any) => (
                    <tr key={record._id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4 text-gray-600">
                        {new Date(record.date || record.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4 font-medium">
                        {record.patient_name || 'N/A'}
                      </td>
                      <td className="py-3 px-4 text-gray-600">
                        {record.sample_type || 'N/A'}
                      </td>
                      <td className="py-3 px-4 text-gray-600">
                        {(record.diseases || []).join(', ') || '—'}
                      </td>
                      <td className="py-3 px-4 text-gray-600">
                        {record.invoice?.invoice_number || 'N/A'}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded-lg text-xs font-medium ${
                          record.status === 'complete'
                            ? 'bg-green-100 text-green-700'
                            : record.status === 'pending'
                            ? 'bg-gray-100 text-gray-700'
                            : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {record.status || 'process'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-primary-600">
                        ${(record.price || 0).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50">
                    <td colSpan={6} className="py-3 px-4 font-bold text-right">
                      Total:
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-lg text-primary-600">
                      ${metrics.totalLabRevenue.toFixed(2)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Debts Tab */}
      {activeTab === 'debts' && (
        <Card>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">Debts</h2>
            <Button onClick={() => handleExport('debts')} disabled={exporting}>
              <Download className="w-4 h-4 mr-2" />
              {exporting ? 'Exporting…' : 'Export Excel'}
            </Button>
          </div>
          {debts.length === 0 ? (
            <div className="text-center py-12">
              <DollarSign className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No debts found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Date</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Debtor Name</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Phone</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-700">Amount</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-700">Paid</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-700">Remaining</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Status</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Due Date</th>
                  </tr>
                </thead>
                <tbody>
                  {debts.map((debt: any) => {
                    const { amount, paid, remaining } = normalizeDebtValues(debt)
                    return (
                      <tr key={debt._id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4 text-gray-600">
                          {new Date(debt.createdAt).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4 font-medium">{debt.debtor_name || 'N/A'}</td>
                        <td className="py-3 px-4 text-gray-600">{debt.phone || 'N/A'}</td>
                        <td className="py-3 px-4 text-right font-medium">${amount.toFixed(2)}</td>
                        <td className="py-3 px-4 text-right text-green-600">${paid.toFixed(2)}</td>
                        <td className="py-3 px-4 text-right font-bold text-red-600">${remaining.toFixed(2)}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-1 rounded-lg text-xs font-medium ${
                            debt.status === 'Paid' 
                              ? 'bg-green-100 text-green-700' 
                              : debt.status === 'Partial'
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-red-100 text-red-700'
                          }`}>
                            {debt.status || 'Pending'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-gray-600">
                          {debt.due_date ? new Date(debt.due_date).toLocaleDateString() : 'N/A'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50">
                    <td colSpan={3} className="py-3 px-4 font-bold text-right">
                      Total:
                    </td>
                    <td className="py-3 px-4 text-right font-medium">
                      ${debts.reduce((sum: number, d: any) => sum + normalizeDebtValues(d).amount, 0).toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-right text-green-600">
                      ${debts.reduce((sum: number, d: any) => sum + normalizeDebtValues(d).paid, 0).toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-lg text-red-600">
                      ${metrics.totalDebts.toFixed(2)}
                    </td>
                    <td colSpan={2}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Expenses Tab */}
      {activeTab === 'expenses' && (
        <Card>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">Expenses</h2>
            <Button onClick={() => handleExport('expenses')} disabled={exporting}>
              <Download className="w-4 h-4 mr-2" />
              {exporting ? 'Exporting…' : 'Export Excel'}
            </Button>
          </div>
          {expenses.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No expenses found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Date</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Category</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Description</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-700">Amount</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Payment Method</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((expense: any) => (
                    <tr key={expense._id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4 text-gray-600">
                        {new Date(expense.date).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-1 rounded-lg text-xs font-medium bg-blue-100 text-blue-700">
                          {expense.category || 'N/A'}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-medium">{expense.description || 'N/A'}</td>
                      <td className="py-3 px-4 text-right font-bold text-red-600">
                        ${(expense.amount || 0).toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-gray-600">
                        {expense.payment_method || 'Cash'}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50">
                    <td colSpan={3} className="py-3 px-4 font-bold text-right">
                      Total:
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-lg text-red-600">
                      ${metrics.totalExpenses.toFixed(2)}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </Card>
      )}
      <div className="md:hidden fixed bottom-4 right-4">
        <Button
          variant="primary"
          className="rounded-full shadow-xl px-5 py-3"
          onClick={() => handleExport()}
          disabled={exporting}
        >
          <Download className="w-4 h-4 mr-2" />
          Export
        </Button>
      </div>

      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur border-t border-gray-200 px-4 py-3 shadow-inner space-y-1">
        <div className="flex items-center justify-between text-sm font-semibold text-gray-700">
          <span>Sales: ${metrics.totalSales.toFixed(2)}</span>
          <span>Expenses: ${metrics.totalExpenses.toFixed(2)}</span>
        </div>
        {canViewProfitMetrics && (
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="text-green-600">Profit: ${metrics.totalProfit.toFixed(2)}</span>
            <span className="text-blue-600">Lab: ${metrics.totalLabRevenue.toFixed(2)}</span>
          </div>
        )}
      </div>
    </div>
  )
}

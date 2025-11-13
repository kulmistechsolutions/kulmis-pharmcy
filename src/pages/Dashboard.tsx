import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  DollarSign,
  TrendingUp,
  Users,
  AlertTriangle,
  CreditCard,
  TestTube,
  Plus,
  ShoppingCart,
  FileText,
  Microscope,
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
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
import { useRealtime, useRealtimeEvent } from '@/contexts/RealtimeContext'
import { useUser } from '@/contexts/UserContext'
import { useStaffOptions } from '@/hooks/useStaffOptions'

export const Dashboard: React.FC = () => {
  const toArray = (value: any): any[] => {
    if (Array.isArray(value)) return value
    if (value?.results && Array.isArray(value.results)) return value.results
    return []
  }
  const navigate = useNavigate()
  const { user } = useUser()
  const { connected: realtimeConnected } = useRealtime()
  const { options: staffOptions, loading: staffLoading } = useStaffOptions()
  const [loading, setLoading] = useState(true)
  const [metrics, setMetrics] = useState({
    totalSales: 0,
    totalProfit: 0,
    totalCustomers: 0,
    outOfStock: 0,
    totalDebts: 0,
    labTests: 0,
  })
  const [recentSales, setRecentSales] = useState<any[]>([])
  const [expiringMedicines, setExpiringMedicines] = useState<any[]>([])
  const [salesData, setSalesData] = useState<any[]>([])
  const [todayData, setTodayData] = useState([
    { name: 'Sales', value: 0, color: '#2563eb' },
    { name: 'Expenses', value: 0, color: '#ef4444' },
    { name: 'Profit', value: 0, color: '#10b981' },
  ])
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [topStaff, setTopStaff] = useState<
    Array<{
      id: string
      name: string
      role: string
      salesAmount: number
      labAmount: number
      transactions: number
    }>
  >([])
  const [selectedStaff, setSelectedStaff] = useState<string>('all')

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

  const loadDashboardData = useCallback(async () => {
    try {
      setLoading(true)
      const staffId = selectedStaff !== 'all' ? selectedStaff : undefined

      const [medicinesRaw, salesRaw, debtsRaw, expensesRaw, labRecordsRaw] = await Promise.all([
        api.getMedicines(),
        api.getSales(staffId ? { staffId } : undefined),
        api.getDebts(),
        api.getExpenses(),
        api.getLabCashierRecords(staffId ? { staffId } : undefined),
      ])
      const medicines = toArray(medicinesRaw)
      const sales = toArray(salesRaw)
      const debts = toArray(debtsRaw)
      const expenses = toArray(expensesRaw)
      const labRecords = toArray(labRecordsRaw)

      const lowStock = medicines.filter((m: any) => m.quantity < 10).length
      const totalSales = sales.reduce((sum: number, s: any) => sum + Number(s.total_sale || 0), 0)
      const totalProfit = sales.reduce((sum: number, s: any) => sum + Number(s.profit || 0), 0)
      const totalDebts = debts.reduce((sum: number, d: any) => {
        const balance = Number(d.balance || 0)
        const paid = Number(d.paid || d.paid_amount || 0)
        return sum + Math.max(balance - paid, 0)
      }, 0)

      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const todaySales = sales.filter((s: any) => new Date(s.createdAt) >= today)
      const todaySalesTotal = todaySales.reduce((sum: number, s: any) => sum + Number(s.total_sale || 0), 0)
      const todayExpensesTotal = expenses
        .filter((e: any) => new Date(e.date) >= today)
        .reduce((sum: number, e: any) => sum + Number(e.amount || 0), 0)
      const todayProfit = todaySalesTotal - todayExpensesTotal

      const recent = sales.slice(0, 5).map((sale: any) => ({
        id: sale._id,
        customer: sale.customer_name || 'Walk-in Customer',
        items: sale.quantity || 1,
        amount: `$${Number(sale.total_sale || 0).toFixed(2)}`,
        staff: sale.processed_by_name || sale.user_name || 'Team Member',
        staffRole: sale.processed_by_role || sale.user_role,
        time: formatTimeAgo(new Date(sale.createdAt)),
      }))

      const thirtyDaysFromNow = new Date()
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30)
      const expiring = medicines
        .filter((m: any) => {
          const expiry = new Date(m.expiry_date)
          return expiry <= thirtyDaysFromNow && expiry >= new Date()
        })
        .slice(0, 5)
        .map((m: any) => ({
          name: m.name,
          batch: m.batch,
          expiry: new Date(m.expiry_date).toLocaleDateString(),
          quantity: m.quantity,
        }))

      const chartData = generateSalesChartData(sales)
      const totalForSummary = todaySalesTotal + todayExpensesTotal + todayProfit
      const todaySummary = [
        { name: 'Sales', value: totalForSummary > 0 ? (todaySalesTotal / totalForSummary) * 100 : 0, color: '#2563eb' },
        { name: 'Expenses', value: totalForSummary > 0 ? (todayExpensesTotal / totalForSummary) * 100 : 0, color: '#ef4444' },
        { name: 'Profit', value: totalForSummary > 0 ? (todayProfit / totalForSummary) * 100 : 0, color: '#10b981' },
      ]

      const staffAggregate = new Map<
        string,
        {
          id: string
          name: string
          role: string
          salesAmount: number
          labAmount: number
          transactions: number
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
          })
        }
        return staffAggregate.get(id)!
      }

      sales.forEach((sale: any) => {
        const id = sale.processed_by_id?.toString?.() || sale.user_id?.toString?.() || ''
        const entry = ensureStaffEntry(
          id,
          sale.processed_by_name || sale.user_name || 'Team Member',
          sale.processed_by_role || sale.user_role || 'staff'
        )
        if (!entry) return
        entry.salesAmount += Number(sale.total_sale || 0)
        entry.transactions += 1
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
      })

      const aggregate = Array.from(staffAggregate.values())
        .map((entry) => ({
          ...entry,
          total: entry.salesAmount + entry.labAmount,
        }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 5)

      setTopStaff(aggregate)

      setMetrics({
        totalSales,
        totalProfit,
        totalCustomers: debts.length,
        outOfStock: lowStock,
        totalDebts,
        labTests: labRecords.length,
      })
      setRecentSales(recent)
      setExpiringMedicines(expiring)
      setSalesData(chartData)
      setTodayData(todaySummary)
      setLastUpdated(new Date())
    } catch (error: any) {
      console.error('Error loading dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }, [selectedStaff])

  useEffect(() => {
    loadDashboardData()
  }, [loadDashboardData])

  useRealtimeEvent<any>('dashboard:metrics', () => {
    loadDashboardData()
  })

  const formatTimeAgo = (date: Date) => {
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)
    
    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins} mins ago`
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
  }

  const generateSalesChartData = (salesData: any[]) => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const data: any[] = []
    
    for (let i = 5; i >= 0; i--) {
      const date = new Date()
      date.setMonth(date.getMonth() - i)
      const monthSales = salesData.filter((s: any) => {
        const saleDate = new Date(s.createdAt)
        return saleDate.getMonth() === date.getMonth() && saleDate.getFullYear() === date.getFullYear()
      })
      const salesTotal = monthSales.reduce((sum: number, s: any) => sum + s.total_sale, 0)
      const profitTotal = monthSales.reduce((sum: number, s: any) => sum + (s.profit || 0), 0)
      
      data.push({
        month: months[date.getMonth()],
        sales: salesTotal,
        profit: profitTotal,
      })
    }
    
    return data
  }

  const formatRoleLabel = useCallback((role?: string) => {
    if (!role || role === 'all') return ''
    return role
      .toString()
      .split('_')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ')
  }, [])

  const connectionBadge = useMemo(() => {
    if (realtimeConnected) {
      return (
        <span className="inline-flex items-center gap-2 rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-600">
          <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          Live updates on
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-500">
        <span className="h-2 w-2 rounded-full bg-gray-400" />
        Live updates offline
      </span>
    )
  }, [realtimeConnected])

  const lastUpdatedLabel = useMemo(() => {
    if (!lastUpdated) return 'Just now'
    const diff = Date.now() - lastUpdated.getTime()
    if (diff < 10_000) return 'Moments ago'
    if (diff < 60_000) return 'Less than a minute ago'
    const mins = Math.round(diff / 60000)
    return `${mins} min${mins > 1 ? 's' : ''} ago`
  }, [lastUpdated])

  const metricsData = [
    { icon: DollarSign, label: 'Total Sales', value: `$${metrics.totalSales.toFixed(2)}`, change: '', color: 'text-green-600' },
    { icon: TrendingUp, label: 'Total Profit', value: `$${metrics.totalProfit.toFixed(2)}`, change: '', color: 'text-blue-600' },
    { icon: Users, label: 'Total Customers', value: metrics.totalCustomers.toString(), change: '', color: 'text-purple-600' },
    { icon: AlertTriangle, label: 'Out of Stock', value: metrics.outOfStock.toString(), change: '', color: 'text-red-600' },
    { icon: CreditCard, label: 'Total Debts', value: `$${metrics.totalDebts.toFixed(2)}`, change: '', color: 'text-orange-600' },
    { icon: TestTube, label: 'Lab Tests', value: metrics.labTests.toString(), change: '', color: 'text-indigo-600' },
  ]
  if (loading) {
    return (
      <div className="space-y-8 w-full">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mb-4"></div>
            <p className="text-gray-600">Loading dashboard data...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8 w-full">
      {/* Page Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-2">
            Welcome back! Here's your pharmacy overview.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            {connectionBadge}
            <span className="text-xs text-gray-500">Last refreshed: {lastUpdatedLabel}</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
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
          <Button variant="outline" onClick={loadDashboardData}>
            Refresh
          </Button>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Button 
          variant="primary" 
          className="py-3 flex flex-col items-center justify-center space-y-1.5 hover:scale-105 transition-transform duration-300"
          onClick={() => navigate('/dashboard/medicines')}
        >
          <Plus className="w-5 h-5" />
          <span className="text-sm font-medium">Add Medicine</span>
        </Button>
        <Button 
          variant="outline" 
          className="py-3 flex flex-col items-center justify-center space-y-1.5 hover:scale-105 transition-transform duration-300"
          onClick={() => navigate('/dashboard/sales')}
        >
          <ShoppingCart className="w-5 h-5" />
          <span className="text-sm font-medium">New Sale</span>
        </Button>
        <Button 
          variant="outline" 
          className="py-3 flex flex-col items-center justify-center space-y-1.5 hover:scale-105 transition-transform duration-300"
          onClick={() => navigate('/lab/patients/register')}
        >
          <Microscope className="w-5 h-5" />
          <span className="text-sm font-medium">New Lab Order</span>
        </Button>
        <Button 
          variant="outline" 
          className="py-3 flex flex-col items-center justify-center space-y-1.5 hover:scale-105 transition-transform duration-300"
          onClick={() => navigate('/dashboard/reports')}
        >
          <FileText className="w-5 h-5" />
          <span className="text-sm font-medium">Generate Report</span>
        </Button>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
        {metricsData.map((metric, index) => {
          const Icon = metric.icon
          return (
            <Card key={index} className="hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">{metric.label}</p>
                  <p className="text-2xl font-bold text-gray-900">{metric.value}</p>
                  <p className={`text-sm mt-2 ${metric.color}`}>{metric.change}</p>
                </div>
                <div className={`p-3 bg-primary-50 rounded-xl`}>
                  <Icon className={`w-6 h-6 ${metric.color}`} />
                </div>
              </div>
            </Card>
          )
        })}
      </div>

      {selectedStaff === 'all' && topStaff.length > 0 && (
        <Card>
          <h2 className="text-xl font-bold text-gray-900 mb-4">Top Performing Staff</h2>
          <div className="space-y-3">
            {topStaff.map((staff, index) => (
              <div
                key={staff.id}
                className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 px-4 py-3"
              >
                <div>
                  <p className="font-semibold text-gray-900">
                    #{index + 1} {staff.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {staff.role ? formatRoleLabel(staff.role) : 'Staff'} • {staff.transactions} transaction{staff.transactions !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-primary-600">
                    ${ (staff.salesAmount + staff.labAmount).toFixed(2) }
                  </p>
                  <p className="text-xs text-gray-500">
                    Sales ${staff.salesAmount.toFixed(2)} • Lab ${staff.labAmount.toFixed(2)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Sales by Month */}
        <Card>
          <h2 className="text-xl font-bold text-gray-900 mb-6">Sales by Month</h2>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={salesData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="sales" fill="#2563eb" name="Sales ($)" />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Profit vs Expenses */}
        <Card>
          <h2 className="text-xl font-bold text-gray-900 mb-6">Profit vs Expenses</h2>
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={salesData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="profit" stroke="#2563eb" name="Profit" strokeWidth={2} />
              <Line type="monotone" dataKey="sales" stroke="#ef4444" name="Expenses" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Today's Summary & Recent Sales */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Today's Summary Donut */}
        <Card>
          <h2 className="text-xl font-bold text-gray-900 mb-6">Today's Summary</h2>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={todayData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={5}
                dataKey="value"
              >
                {todayData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </Card>

        {/* Recent Sales */}
        <Card className="xl:col-span-2">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Recent Sales</h2>
          {recentSales.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No recent sales</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentSales.map((sale) => (
                <div
                  key={sale.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
                >
                  <div>
                    <p className="font-medium text-gray-900">{sale.customer}</p>
                    <p className="text-sm text-gray-600">{sale.items} items • {sale.time}</p>
                    {sale.staff && (
                      <p className="text-xs text-gray-500 mt-1">
                        {sale.staff}
                        {sale.staffRole ? ` • ${formatRoleLabel(sale.staffRole)}` : ''}
                      </p>
                    )}
                  </div>
                  <p className="text-lg font-bold text-primary-600">{sale.amount}</p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Expiring Medicines */}
      <Card>
        <h2 className="text-xl font-bold text-gray-900 mb-6">Expiring Medicines (Next 30 Days)</h2>
        {expiringMedicines.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>No medicines expiring in the next 30 days</p>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-5 sm:-mx-6 lg:-mx-8">
            <div className="inline-block min-w-full align-middle px-5 sm:px-6 lg:px-8">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Medicine</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Batch</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Expiry Date</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Quantity</th>
                  </tr>
                </thead>
                <tbody>
                  {expiringMedicines.map((medicine, index) => (
                    <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4">{medicine.name}</td>
                      <td className="py-3 px-4 text-gray-600">{medicine.batch}</td>
                      <td className="py-3 px-4 text-red-600 font-medium">{medicine.expiry}</td>
                      <td className="py-3 px-4">{medicine.quantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}


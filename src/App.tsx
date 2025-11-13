import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { MainLayout } from './components/layouts/MainLayout'
import { AuthGuard } from './components/AuthGuard'
import { UserProvider } from '@/contexts/UserContext'
import { RealtimeProvider } from '@/contexts/RealtimeContext'
import { NotificationProvider } from '@/contexts/NotificationContext'
import { ConnectivityProvider } from '@/contexts/ConnectivityContext'
import { Landing } from './pages/Landing'
import { Login } from './pages/Login'
import { Register } from './pages/Register'
import { Dashboard } from './pages/Dashboard'
import { Sales } from './pages/Sales'
import { Medicines } from './pages/Medicines'
import { Debts } from './pages/Debts'
import { Expenses } from './pages/Expenses'
import { Reports } from './pages/Reports'
import { Tutorials } from './pages/Tutorials'
import { Subscription } from './pages/Subscription'
import { Settings } from './pages/Settings'
import { Transactions } from './pages/Transactions'
import { AdminManagement } from './pages/AdminManagement'
import { SuperAdminDashboard } from './pages/SuperAdminDashboard'
import { UserManagement } from './pages/UserManagement'
import { AdminBanners } from './pages/AdminBanners'
import { Notifications } from './pages/Notifications'
import { SyncLogs } from './pages/SyncLogs'
import { LabCashier } from './pages/LabCashier'
import { Invoices as InvoiceManagement } from './pages/Invoices'
import { usePermissions } from '@/hooks/usePermissions'

const fallbackDashboardRoutes: Array<{ permission: string; path: string }> = [
  { permission: 'sales:view', path: '/dashboard/sales' },
  { permission: 'medicines:view', path: '/dashboard/medicines' },
  { permission: 'debts:view', path: '/dashboard/debts' },
  { permission: 'expenses:view', path: '/dashboard/expenses' },
  { permission: 'invoices:view', path: '/dashboard/invoices' },
  { permission: 'transactions:view', path: '/dashboard/transactions' },
  { permission: 'reports:view', path: '/dashboard/reports' },
  { permission: 'lab:view', path: '/dashboard/lab-cashier' },
  { permission: 'tutorials:view', path: '/dashboard/tutorials' },
  { permission: 'subscription:view', path: '/dashboard/subscription' },
  { permission: 'settings:view', path: '/dashboard/settings' },
  { permission: 'staff:view', path: '/dashboard/users' },
]

const DashboardEntry: React.FC = () => {
  const { hasPermission } = usePermissions()

  if (hasPermission('dashboard:view')) {
    return <Dashboard />
  }

  const fallback = fallbackDashboardRoutes.find(route => hasPermission(route.permission))

  if (fallback) {
    return <Navigate to={fallback.path} replace />
  }

  return (
    <div className="flex items-center justify-center py-16 px-6 text-center">
      <div className="max-w-md space-y-4">
        <h2 className="text-2xl font-semibold text-gray-900">Access Restricted</h2>
        <p className="text-gray-600">
          You don&apos;t have permission to view the dashboard or any other modules yet. Please contact your
          administrator to request access.
        </p>
      </div>
    </div>
  )
}

function App() {
  console.log('📱 App component rendering, current path:', window.location.pathname)
  
  return (
    <UserProvider>
      <ConnectivityProvider>
        <RealtimeProvider>
          <NotificationProvider>
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/landing" element={<Landing />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route
                  path="/dashboard"
                  element={
                    <AuthGuard>
                      <MainLayout />
                    </AuthGuard>
                  }
                >
                  <Route index element={<DashboardEntry />} />
                  <Route path="sales" element={<Sales />} />
                  <Route path="medicines" element={<Medicines />} />
                  <Route path="debts" element={<Debts />} />
                  <Route path="expenses" element={<Expenses />} />
                  <Route path="reports" element={<Reports />} />
                  <Route path="lab-cashier" element={<LabCashier />} />
                  <Route path="tutorials" element={<Tutorials />} />
                  <Route path="subscription" element={<Subscription />} />
                  <Route path="transactions" element={<Transactions />} />
                  <Route path="invoices" element={<InvoiceManagement />} />
                  <Route path="sync-logs" element={<SyncLogs />} />
                  <Route path="notifications" element={<Notifications />} />
                  <Route path="admin" element={<AdminManagement />} />
                  <Route path="super-admin" element={<SuperAdminDashboard />} />
                  <Route path="super-admin/banners" element={<AdminBanners />} />
                  <Route path="users" element={<UserManagement />} />
                  <Route path="settings" element={<Settings />} />
                </Route>
              </Routes>
            </BrowserRouter>
          </NotificationProvider>
        </RealtimeProvider>
      </ConnectivityProvider>
    </UserProvider>
  )
}

export default App

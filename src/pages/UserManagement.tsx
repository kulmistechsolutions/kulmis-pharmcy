import React, { useState, useEffect } from 'react'
import { Plus, Edit, Trash2, User, X, Save, CheckSquare, Square } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { api } from '@/lib/api'
import { useUser } from '@/contexts/UserContext'
import { Navigate } from 'react-router-dom'

interface StaffUser {
  _id: string
  pharmacyName: string
  email: string
  phone: string
  role: string
  permissions: string[]
  isActive: boolean
  createdAt: string
}

const PERMISSION_GROUPS = {
  dashboard: [
    { key: 'dashboard:view', label: 'View Dashboard' },
  ],
  sales: [
    { key: 'sales:view', label: 'View Sales' },
    { key: 'sales:create', label: 'Create Sales' },
    { key: 'sales:edit', label: 'Edit Sales' },
    { key: 'sales:delete', label: 'Delete Sales' },
  ],
  medicines: [
    { key: 'medicines:view', label: 'View Medicines' },
  ],
  debts: [
    { key: 'debts:view', label: 'View Debts' },
    { key: 'debts:payment', label: 'Record Payments' },
  ],
  expenses: [
    { key: 'expenses:view', label: 'View Expenses' },
  ],
  invoices: [
    { key: 'invoices:view', label: 'View Invoices' },
    { key: 'invoices:export', label: 'Export Invoices' },
  ],
  transactions: [
    { key: 'transactions:view', label: 'View Transactions' },
    { key: 'transactions:export', label: 'Export Transactions' },
  ],
  reports: [
    { key: 'reports:view', label: 'View Reports' },
    { key: 'reports:export', label: 'Export Reports' },
  ],
  labCashier: [
    { key: 'lab:view', label: 'View Lab Cashier' },
    { key: 'lab:records', label: 'Manage Lab Records' },
    { key: 'lab:analytics', label: 'View Lab Analytics' },
  ],
  tutorials: [
    { key: 'tutorials:view', label: 'View Tutorials' },
  ],
  subscription: [
    { key: 'subscription:view', label: 'View Subscription' },
    { key: 'subscription:manage', label: 'Manage Subscription' },
  ],
  staffUsers: [
    { key: 'staff:view', label: 'View Staff Users' },
    { key: 'staff:create', label: 'Create Staff Users' },
    { key: 'staff:edit', label: 'Edit Staff Users' },
    { key: 'staff:delete', label: 'Delete Staff Users' },
  ],
  settings: [
    { key: 'settings:view', label: 'View Settings' },
    { key: 'settings:edit', label: 'Edit Settings' },
  ],
}

const PERMISSION_DEPENDENCIES: Record<string, string[]> = {
  'sales:create': ['sales:view'],
  'sales:edit': ['sales:view'],
  'sales:delete': ['sales:view'],
  'transactions:view': ['sales:view'],
  'transactions:export': ['transactions:view'],
}

export const UserManagement: React.FC = () => {
  const { user, loading: userLoading } = useUser()
  const [users, setUsers] = useState<StaffUser[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingUser, setEditingUser] = useState<StaffUser | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
  })
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([])
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({})

  const addPermissionWithDeps = (permissions: string[], permission: string) => {
    const updated = new Set(permissions)
    updated.add(permission)
    const deps = PERMISSION_DEPENDENCIES[permission] || []
    deps.forEach(dep => updated.add(dep))
    return Array.from(updated)
  }

  const addPermissionsBatch = (permissions: string[], toAdd: string[]) => {
    let updated = [...permissions]
    toAdd.forEach(perm => {
      updated = addPermissionWithDeps(updated, perm)
    })
    return updated
  }

  const formatGroupLabel = (group: string) =>
    group
      .replace(/([A-Z])/g, ' $1')
      .replace(/^\w/, (c) => c.toUpperCase())
      .trim()

  // Wait for user to load
  if (userLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-gray-600">Loading...</p>
      </div>
    )
  }

  // Only pharmacy_owner can access this page
  if (!user || (user.role !== 'pharmacy_owner' && user.role !== 'super_admin')) {
    return <Navigate to="/dashboard" replace />
  }

  useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = async () => {
    try {
      setLoading(true)
      const data = await api.getUsers()
      const list = Array.isArray(data) ? data : data?.results ?? []
      // Filter to show only staff users for pharmacy owners (users they created)
      const filtered = user?.role === 'pharmacy_owner' 
        ? list.filter((u: any) => {
            // Show themselves and staff users they created
            return u._id === user._id || (u.role === 'staff' && u.created_by === user._id)
          })
        : list
      setUsers(filtered as StaffUser[])
    } catch (error: any) {
      console.error('Error loading users:', error)
      alert(`Error: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleAdd = () => {
    setFormData({
      name: '',
      email: '',
      phone: '',
      password: '',
    })
    setSelectedPermissions(addPermissionsBatch([], ['dashboard:view']))
    setExpandedGroups({})
    setEditingUser(null)
    setShowAddModal(true)
  }

  const handleEdit = (user: StaffUser) => {
    setFormData({
      name: user.pharmacyName,
      email: user.email,
      phone: user.phone,
      password: '',
    })
    setSelectedPermissions(addPermissionsBatch([], user.permissions || []))
    setEditingUser(user)
    setShowAddModal(true)
  }

  const handleDelete = async (userId: string) => {
    if (!confirm('Are you sure you want to deactivate this user?')) {
      return
    }

    try {
      await api.deleteUser(userId)
      alert('User deactivated successfully')
      loadUsers()
    } catch (error: any) {
      alert(`Error: ${error.message}`)
    }
  }

  const toggleGroup = (group: string) => {
    setExpandedGroups(prev => ({ ...prev, [group]: !prev[group] }))
  }

  const togglePermission = (permission: string) => {
    setSelectedPermissions(prev => {
      if (prev.includes(permission)) {
        return prev.filter(p => p !== permission)
      }
      return addPermissionWithDeps(prev, permission)
    })
  }

  const toggleAllInGroup = (group: string) => {
    const groupPerms = PERMISSION_GROUPS[group as keyof typeof PERMISSION_GROUPS].map(p => p.key)
    const allSelected = groupPerms.every(p => selectedPermissions.includes(p))
    
    if (allSelected) {
      setSelectedPermissions(prev => prev.filter(p => !groupPerms.includes(p)))
    } else {
      setSelectedPermissions(prev => addPermissionsBatch(prev, groupPerms))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      if (editingUser) {
        await api.updateUser(editingUser._id, {
          pharmacyName: formData.name,
          email: formData.email,
          phone: formData.phone,
          password: formData.password || undefined,
          permissions: addPermissionsBatch([], selectedPermissions),
        })
        alert('User updated successfully')
      } else {
        await api.createUser({
          pharmacyName: formData.name,
          email: formData.email,
          phone: formData.phone,
          password: formData.password,
          role: 'staff',
          permissions: addPermissionsBatch([], selectedPermissions),
        })
        alert('User created successfully')
      }
      setShowAddModal(false)
      loadUsers()
    } catch (error: any) {
      alert(`Error: ${error.message}`)
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
          <p className="text-gray-600 mt-2">Manage staff users and their permissions</p>
        </div>
        <Button onClick={handleAdd}>
          <Plus className="w-4 h-4 mr-2" />
          Add User
        </Button>
      </div>

      <Card>
        {loading ? (
          <div className="text-center py-12">
            <p className="text-gray-600">Loading users...</p>
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-12">
            <User className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No users found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Name</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Email</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Phone</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Permissions</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Status</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((staffUser) => (
                  <tr key={staffUser._id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 font-medium">{staffUser.pharmacyName}</td>
                    <td className="py-3 px-4 text-gray-600">{staffUser.email}</td>
                    <td className="py-3 px-4 text-gray-600">{staffUser.phone}</td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1">
                        {staffUser.permissions?.slice(0, 3).map(perm => (
                          <span key={perm} className="px-2 py-1 rounded-lg text-xs font-medium bg-blue-100 text-blue-700">
                            {perm.split(':')[0]}
                          </span>
                        ))}
                        {staffUser.permissions && staffUser.permissions.length > 3 && (
                          <span className="px-2 py-1 rounded-lg text-xs font-medium bg-gray-100 text-gray-700">
                            +{staffUser.permissions.length - 3}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded-lg text-xs font-medium ${
                        staffUser.isActive 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {staffUser.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => handleEdit(staffUser)}
                          className="p-2 hover:bg-blue-50 rounded-lg text-blue-600 transition-all duration-200 hover:scale-110 active:scale-95"
                          title="Edit User"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        {staffUser.role === 'staff' && (
                          <button
                            onClick={() => handleDelete(staffUser._id)}
                            className="p-2 hover:bg-red-50 rounded-lg text-red-600 transition-all duration-200 hover:scale-110 active:scale-95"
                            title="Deactivate User"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <Card className="max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6 sticky top-0 bg-white z-10 pb-4 border-b">
              <h2 className="text-xl font-bold text-gray-900">
                {editingUser ? 'Edit User' : 'Add New User'}
              </h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-all duration-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Name
                  </label>
                  <Input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone
                  </label>
                  <Input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Password {editingUser && '(leave empty to keep current)'}
                  </label>
                  <Input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required={!editingUser}
                    minLength={6}
                  />
                </div>
              </div>

              {/* Permissions Section */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Permissions
                </label>
                <div className="space-y-3 border border-gray-200 rounded-xl p-4 bg-gray-50">
                  {Object.entries(PERMISSION_GROUPS).map(([group, permissions]) => {
                    const groupSelected = permissions.every(p => selectedPermissions.includes(p.key))
                    const someSelected = permissions.some(p => selectedPermissions.includes(p.key))
                    const isExpanded = expandedGroups[group]

                    return (
                      <div key={group} className="border border-gray-200 rounded-lg bg-white">
                        <button
                          type="button"
                          onClick={() => toggleGroup(group)}
                          className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
                        >
                          <div className="flex items-center space-x-3">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                toggleAllInGroup(group)
                              }}
                              className="flex items-center space-x-2"
                            >
                              {groupSelected ? (
                                <CheckSquare className="w-5 h-5 text-primary-600" />
                              ) : someSelected ? (
                                <div className="w-5 h-5 border-2 border-primary-600 bg-primary-100 rounded" />
                              ) : (
                                <Square className="w-5 h-5 text-gray-400" />
                              )}
                              <span className="font-semibold text-gray-900">{formatGroupLabel(group)}</span>
                            </button>
                          </div>
                          <span className="text-sm text-gray-500">
                            {permissions.filter(p => selectedPermissions.includes(p.key)).length} / {permissions.length}
                          </span>
                        </button>

                        {isExpanded && (
                          <div className="border-t border-gray-200 p-4 space-y-2">
                            {permissions.map((permission) => (
                              <label
                                key={permission.key}
                                className="flex items-center space-x-3 px-3 py-2 hover:bg-gray-50 rounded-lg cursor-pointer"
                              >
                                <input
                                  type="checkbox"
                                  checked={selectedPermissions.includes(permission.key)}
                                  onChange={() => togglePermission(permission.key)}
                                  className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                                />
                                <span className="text-sm text-gray-700">{permission.label}</span>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="flex space-x-3 pt-4 border-t">
                <Button type="submit" className="flex-1">
                  <Save className="w-4 h-4 mr-2" />
                  {editingUser ? 'Update User' : 'Create User'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  )
}


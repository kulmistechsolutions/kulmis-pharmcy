import React, { useEffect, useMemo, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { api } from '@/lib/api'
import type { Banner, BannerLog } from '@/types/banner'
import { useUser } from '@/contexts/UserContext'
import { Navigate } from 'react-router-dom'
import {
  Plus,
  Image as ImageIcon,
  Edit,
  Trash2,
  RefreshCw,
  Users,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react'

interface UserOption {
  _id: string
  pharmacyName: string
  email: string
}

interface BannerFormData {
  title: string
  message: string
  image_url: string
  status: 'active' | 'inactive'
  target_users: string[]
  expiry_date: string
}

const defaultFormState: BannerFormData = {
  title: '',
  message: '',
  image_url: '',
  status: 'active',
  target_users: ['all'],
  expiry_date: '',
}

const isAllSelected = (targets: string[]) => targets.includes('all')

export const AdminBanners: React.FC = () => {
  const { user, loading: userLoading } = useUser()
  const [banners, setBanners] = useState<Banner[]>([])
  const [users, setUsers] = useState<UserOption[]>([])
  const [loading, setLoading] = useState(true)
  const [formState, setFormState] = useState<BannerFormData>(defaultFormState)
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null)
  const [showFormModal, setShowFormModal] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [logs, setLogs] = useState<BannerLog[]>([])
  const [logsBanner, setLogsBanner] = useState<Banner | null>(null)
  const [loadingLogs, setLoadingLogs] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const activeTargetUsers = useMemo(() => formState.target_users, [formState.target_users])

  useEffect(() => {
    if (userLoading) return
    if (!user || user.role !== 'super_admin') return
    // load initial data only once when user ready
    loadInitialData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userLoading, user])

  // guard renders below after hooks so hook order remains stable
  if (userLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-gray-600">Loading...</p>
      </div>
    )
  }

  if (!user || user.role !== 'super_admin') {
    return <Navigate to="/dashboard" replace />
  }

  const loadInitialData = async () => {
    try {
      setLoading(true)
      const [bannerData, userData] = await Promise.all([
        api.getAdminBanners(),
        api.getUsers(),
      ])
      setBanners(Array.isArray(bannerData) ? (bannerData as Banner[]) : [])
      setUsers(
        Array.isArray(userData)
          ? userData.map((usr: any) => ({
              _id: usr._id,
              pharmacyName: usr.pharmacyName,
              email: usr.email,
            }))
          : []
      )
    } catch (error: any) {
      console.error('Error loading banners:', error)
      alert(error.message || 'Failed to load banners')
    } finally {
      setLoading(false)
    }
  }

  const refreshBanners = async () => {
    try {
      setRefreshing(true)
      const data = await api.getAdminBanners()
      setBanners(Array.isArray(data) ? (data as Banner[]) : [])
    } catch (error: any) {
      console.error('Error refreshing banners:', error)
    } finally {
      setRefreshing(false)
    }
  }

  const openCreateModal = () => {
    setEditingBanner(null)
    setFormState(defaultFormState)
    setShowFormModal(true)
  }

  const openEditModal = (banner: Banner) => {
    setEditingBanner(banner)
    setFormState({
      title: banner.title,
      message: banner.message,
      image_url: banner.image_url,
      status: banner.status,
      target_users: banner.target_users?.length ? banner.target_users : ['all'],
      expiry_date: banner.expiry_date ? banner.expiry_date.substring(0, 10) : '',
    })
    setShowFormModal(true)
  }

  const handleFileUpload = async (file: File) => {
    try {
      setUploadingImage(true)
      const base64 = await fileToBase64(file)
      const response: any = await api.uploadBannerImage({
        file: base64,
        fileName: file.name,
      })
      setFormState((prev) => ({ ...prev, image_url: response?.image_url || prev.image_url }))
    } catch (error: any) {
      console.error('Upload failed', error)
      alert(error.message || 'Failed to upload image. Make sure ImageKit credentials are configured.')
    } finally {
      setUploadingImage(false)
    }
  }

  const fileToBase64 = (file: File) => {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const result = reader.result as string
        const base64 = result.split(',')[1]
        resolve(base64)
      }
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formState.image_url) {
      alert('Please upload an image for the banner.')
      return
    }

    try {
      const payload = {
        ...formState,
        target_users: isAllSelected(formState.target_users)
          ? ['all']
          : formState.target_users,
        expiry_date: formState.expiry_date ? new Date(formState.expiry_date).toISOString() : null,
      }

      if (editingBanner) {
        await api.updateBanner(editingBanner._id, payload)
        alert('Banner updated successfully')
      } else {
        await api.createBanner(payload)
        alert('Banner created successfully')
      }

      setShowFormModal(false)
      refreshBanners()
    } catch (error: any) {
      console.error('Failed to save banner', error)
      alert(error.message || 'Failed to save banner')
    }
  }

  const handleDeleteBanner = async (id: string) => {
    if (!confirm('Are you sure you want to delete this banner?')) return
    try {
      await api.deleteBanner(id)
      alert('Banner deleted successfully')
      refreshBanners()
    } catch (error: any) {
      console.error('Delete failed', error)
      alert(error.message || 'Failed to delete banner')
    }
  }

  const openLogsModal = async (banner: Banner) => {
    try {
      setLoadingLogs(true)
      const bannerLogs = await api.getBannerLogs(banner._id)
      setLogsBanner(banner)
      setLogs(Array.isArray(bannerLogs) ? bannerLogs : [])
    } catch (error: any) {
      console.error('Failed to load banner logs', error)
      alert(error.message || 'Failed to load banner logs')
    } finally {
      setLoadingLogs(false)
    }
  }

  const toggleForceHidden = async (bannerId: string, userId: string, forceHidden: boolean) => {
    try {
      await api.stopBannerForUser(bannerId, userId, forceHidden)
      setLogs((prev) =>
        prev.map((log) =>
          log.user_id._id === userId
            ? {
                ...log,
                force_hidden: forceHidden,
                dismissed: forceHidden || log.dismissed,
                dismissed_at: forceHidden ? new Date().toISOString() : null,
              }
            : log
        )
      )
      alert(forceHidden ? 'Banner hidden for user' : 'Banner re-enabled for user')
    } catch (error: any) {
      console.error('Failed to update banner visibility for user', error)
      alert(error.message || 'Failed to update user visibility')
    }
  }

  const toggleTargetAll = () => {
    setFormState((prev) => {
      if (isAllSelected(prev.target_users)) {
        return { ...prev, target_users: [] }
      }
      return { ...prev, target_users: ['all'] }
    })
  }

  const handleTargetChange = (userId: string) => {
    setFormState((prev) => {
      if (isAllSelected(prev.target_users)) {
        return { ...prev, target_users: [userId] }
      }
      const exists = prev.target_users.includes(userId)
      const updated = exists
        ? prev.target_users.filter((id) => id !== userId)
        : [...prev.target_users, userId]
      return { ...prev, target_users: updated }
    })
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Promotional Banners</h1>
          <p className="text-gray-600 mt-2">Create and manage promotional messages shown to pharmacy users</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={refreshBanners} disabled={refreshing}>
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={openCreateModal}>
            <Plus className="w-4 h-4 mr-2" />
            Add Banner
          </Button>
        </div>
      </div>

      <Card>
        {loading ? (
          <div className="py-12 text-center text-gray-600">Loading banners...</div>
        ) : banners.length === 0 ? (
          <div className="py-12 text-center">
            <ImageIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No banners created yet. Start by adding your first promotional banner.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Title</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Status</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Targets</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Created</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Expiry</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Stats</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {banners.map((banner) => (
                  <tr key={banner._id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-gray-900">{banner.title}</div>
                      <div className="text-xs text-gray-500 truncate max-w-xs">{banner.message}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium ${
                          banner.status === 'active'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-200 text-gray-600'
                        }`}
                      >
                        {banner.status === 'active' ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {isAllSelected(banner.target_users || [])
                        ? 'All Users'
                        : `${banner.target_users?.length || 0} selected`}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {banner.created_at ? new Date(banner.created_at).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {banner.expiry_date ? new Date(banner.expiry_date).toLocaleDateString() : 'No expiry'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      <div className="flex gap-3">
                        <span>👁 {banner.stats?.views || 0}</span>
                        <span>❌ {banner.stats?.dismissed || 0}</span>
                        <span>🚫 {banner.stats?.forceHidden || 0}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openLogsModal(banner)}
                          className="rounded-lg border border-gray-200 px-2 py-1 text-sm text-gray-600 hover:bg-gray-100"
                        >
                          Logs
                        </button>
                        <button
                          onClick={() => openEditModal(banner)}
                          className="rounded-lg p-2 text-blue-600 transition hover:bg-blue-50"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteBanner(banner._id)}
                          className="rounded-lg p-2 text-red-600 transition hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Create/Edit Modal */}
      {showFormModal && (
        <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <Card className="w-full max-w-3xl">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">
                  {editingBanner ? 'Edit Banner' : 'Create Banner'}
                </h2>
                <p className="text-sm text-gray-500">Upload image and configure messaging and audience</p>
              </div>
              <button
                onClick={() => setShowFormModal(false)}
                className="rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Title</label>
                  <Input
                    value={formState.title}
                    onChange={(e) => setFormState((prev) => ({ ...prev, title: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Status</label>
                  <select
                    value={formState.status}
                    onChange={(e) => setFormState((prev) => ({ ...prev, status: e.target.value as 'active' | 'inactive' }))}
                    className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-400"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Message</label>
                <textarea
                  value={formState.message}
                  onChange={(e) => setFormState((prev) => ({ ...prev, message: e.target.value }))}
                  rows={4}
                  className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-400"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Banner Image</label>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-gray-300 px-4 py-3 text-sm text-gray-600 hover:border-primary-400 hover:bg-primary-50/30">
                    <ImageIcon className="h-5 w-5" />
                    <span>{uploadingImage ? 'Uploading...' : 'Upload Image'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) {
                          handleFileUpload(file)
                        }
                      }}
                      disabled={uploadingImage}
                    />
                  </label>
                  {formState.image_url && (
                    <img
                      src={formState.image_url}
                      alt="Preview"
                      className="h-20 w-32 rounded-lg object-cover shadow"
                    />
                  )}
                </div>
                <p className="text-xs text-gray-500">
                  Images are uploaded to ImageKit. Configure credentials in environment variables.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      checked={isAllSelected(activeTargetUsers)}
                      onChange={toggleTargetAll}
                    />
                    Target all users
                  </label>
                  {!isAllSelected(activeTargetUsers) && (
                    <div className="max-h-48 space-y-2 overflow-y-auto rounded-xl border border-gray-200 p-3">
                      {users.map((usr) => {
                        const selected = activeTargetUsers.includes(usr._id)
                        return (
                          <label key={usr._id} className="flex items-center gap-2 text-sm text-gray-700">
                            <input
                              type="checkbox"
                              className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                              checked={selected}
                              onChange={() => handleTargetChange(usr._id)}
                            />
                            <span>
                              {usr.pharmacyName}
                              <span className="ml-1 text-xs text-gray-400">({usr.email})</span>
                            </span>
                          </label>
                        )
                      })}
                      {users.length === 0 && <p className="text-xs text-gray-500">No pharmacy users available.</p>}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Expiry Date</label>
                  <Input
                    type="date"
                    value={formState.expiry_date}
                    onChange={(e) => setFormState((prev) => ({ ...prev, expiry_date: e.target.value }))}
                  />
                  <p className="text-xs text-gray-500">Leave empty to keep banner active indefinitely.</p>
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <Button variant="outline" type="button" onClick={() => setShowFormModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={uploadingImage}>
                  {editingBanner ? 'Update Banner' : 'Create Banner'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Logs Modal */}
      {logsBanner && (
        <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <Card className="w-full max-w-4xl">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Banner Visibility</h2>
                <p className="text-sm text-gray-500">Manage which users can see this banner</p>
              </div>
              <button
                onClick={() => {
                  setLogsBanner(null)
                  setLogs([])
                }}
                className="rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            {loadingLogs ? (
              <div className="py-12 text-center text-gray-600">Loading logs...</div>
            ) : logs.length === 0 ? (
              <div className="py-12 text-center text-gray-500">
                <Users className="mx-auto mb-3 h-10 w-10 text-gray-300" />
                <p>No user interactions recorded yet.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Pharmacy</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Contact</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Status</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-gray-600">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => (
                      <tr key={log._id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{log.user_id?.pharmacyName}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          <div>{log.user_id?.email}</div>
                          <div className="text-xs text-gray-400">{log.user_id?.phone}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 text-sm">
                            <span
                              className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium ${
                                log.force_hidden
                                  ? 'bg-red-100 text-red-600'
                                  : log.dismissed
                                  ? 'bg-yellow-100 text-yellow-600'
                                  : 'bg-green-100 text-green-600'
                              }`}
                            >
                              {log.force_hidden
                                ? 'Hidden by Admin'
                                : log.dismissed
                                ? 'Dismissed by User'
                                : 'Visible'}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => toggleForceHidden(logsBanner._id, log.user_id._id, !log.force_hidden)}
                            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-1 text-sm text-gray-600 hover:bg-gray-100"
                          >
                            {log.force_hidden ? (
                              <>
                                <ToggleLeft className="h-4 w-4" />
                                Re-enable
                              </>
                            ) : (
                              <>
                                <ToggleRight className="h-4 w-4" />
                                Hide
                              </>
                            )}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  )
}

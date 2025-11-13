import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Building2, Palette, ShieldCheck, UploadCloud, Loader2, Eye } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { api } from '@/lib/api'
import { useUser } from '@/contexts/UserContext'

type SettingsTab = 'profile' | 'branding' | 'security'

interface PharmacySettingsResponse {
  id: string | null
  pharmacyId: string
  name: string
  owner_name?: string
  phone?: string
  email?: string
  address?: string
  about?: string
  logo_url?: string
  logo_thumbnail_url?: string
  updatedAt?: string
  canEdit: boolean
}

const defaultSettings: PharmacySettingsResponse = {
  id: null,
  pharmacyId: '',
  name: '',
  owner_name: '',
  phone: '',
  email: '',
  address: '',
  about: '',
  logo_url: '',
  logo_thumbnail_url: '',
  canEdit: false,
}

const tabs: Array<{ id: SettingsTab; label: string; icon: React.ComponentType<any> }> = [
  { id: 'profile', label: 'Profile', icon: Building2 },
  { id: 'branding', label: 'Invoice Branding', icon: Palette },
  { id: 'security', label: 'Security', icon: ShieldCheck },
]

const fileToBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      const base64 = result.split(',')[1]
      resolve(base64)
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })

const InvoicePreview: React.FC<{
  name: string
  phone?: string
  email?: string
  address?: string
  about?: string
  logoUrl?: string
}> = ({ name, phone, email, address, about, logoUrl }) => {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 bg-gradient-to-r from-blue-600 to-blue-500 px-6 py-5 text-white rounded-t-2xl">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 overflow-hidden rounded-xl bg-white/10 flex items-center justify-center">
            {logoUrl ? (
              <img src={logoUrl} alt="Pharmacy logo preview" className="h-full w-full object-cover" />
            ) : (
              <span className="text-2xl font-semibold uppercase tracking-wide">{name?.[0] || 'P'}</span>
            )}
          </div>
          <div className="flex-1">
            <h3 className="text-2xl font-bold tracking-tight">{name || 'Pharmacy Name'}</h3>
            <p className="text-sm text-white/80">
              {[phone && `Phone: ${phone}`, email && `Email: ${email}`, address].filter(Boolean).join(' • ') ||
                'Contact details will appear here'}
            </p>
          </div>
        </div>
      </div>
      <div className="px-6 py-5 space-y-5">
        {about ? (
          <p className="text-sm text-gray-600 italic border-l-4 border-blue-500 bg-blue-50/40 px-4 py-2 rounded-lg">
            {about}
          </p>
        ) : (
          <p className="text-sm text-gray-500 italic">Add a short description to highlight your pharmacy.</p>
        )}

        <div className="rounded-xl border border-gray-200">
          <div className="grid grid-cols-5 gap-6 bg-gray-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500 rounded-t-xl">
            <span>Item</span>
            <span className="text-center">Qty</span>
            <span className="text-right">Unit Price</span>
            <span className="text-right">Total</span>
            <span className="text-right">Status</span>
          </div>
          <div className="px-4 py-4 text-sm text-gray-700">
            <div className="grid grid-cols-5 gap-6">
              <span>Sample medicine</span>
              <span className="text-center">2</span>
              <span className="text-right">$12.00</span>
              <span className="text-right">$24.00</span>
              <span className="text-right text-green-600 font-semibold">Paid</span>
            </div>
          </div>
          <div className="border-t border-gray-200 px-4 py-3 text-sm text-gray-600 flex items-center justify-between rounded-b-xl bg-gray-50">
            <span>Invoice No: INV-1023</span>
            <span>Date: {new Date().toLocaleDateString()}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export const Settings: React.FC = () => {
  const { refreshUser } = useUser()
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile')
  const [settings, setSettings] = useState<PharmacySettingsResponse>(defaultSettings)
  const [loading, setLoading] = useState(true)
  const [savingProfile, setSavingProfile] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [savingSecurity, setSavingSecurity] = useState(false)
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const canEdit = settings.canEdit

  const [formState, setFormState] = useState({
    name: '',
    owner_name: '',
    phone: '',
    email: '',
    address: '',
    about: '',
    logo_url: '',
  })

  const loadSettings = async () => {
    try {
      setLoading(true)
      const response = await api.getPharmacySettings()
      const merged = { ...defaultSettings, ...(response || {}) }
      setSettings(merged)
      setFormState({
        name: merged.name || '',
        owner_name: merged.owner_name || '',
        phone: merged.phone || '',
        email: merged.email || '',
        address: merged.address || '',
        about: merged.about || '',
        logo_url: merged.logo_url || merged.logo_thumbnail_url || '',
      })
    } catch (error: any) {
      console.error('Failed to load settings', error)
      alert(error.message || 'Failed to load pharmacy settings.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSettings()
  }, [])

  const handleInputChange = (field: keyof typeof formState, value: string) => {
    setFormState((prev) => ({ ...prev, [field]: value }))
  }

  const handleSaveProfile = async () => {
    try {
      setSavingProfile(true)
      const payload = {
        name: formState.name,
        owner_name: formState.owner_name,
        phone: formState.phone,
        email: formState.email,
        address: formState.address,
        about: formState.about,
      }
      const updated: any = await api.updatePharmacySettings(payload)
      setSettings({ ...settings, ...(updated || {}) })
      setFormState((prev) => ({
        ...prev,
        name: updated?.name ?? prev.name,
        owner_name: updated?.owner_name ?? prev.owner_name,
        phone: updated?.phone ?? prev.phone,
        email: updated?.email ?? prev.email,
        address: updated?.address ?? prev.address,
        about: updated?.about ?? prev.about,
        logo_url: updated?.logo_url ?? updated?.logo_thumbnail_url ?? prev.logo_url,
      }))
      await refreshUser()
      alert('Pharmacy profile updated successfully.')
    } catch (error: any) {
      console.error('Failed to update settings', error)
      alert(error.message || 'Failed to update pharmacy settings.')
    } finally {
      setSavingProfile(false)
    }
  }

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      setUploadingLogo(true)
      const base64 = await fileToBase64(file)
      const updated: any = await api.uploadPharmacyLogo({
        file: base64,
        fileName: file.name,
      })
      setSettings({ ...settings, ...(updated || {}) })
      setFormState((prev) => ({
        ...prev,
        logo_url: updated?.logo_url ?? prev.logo_url,
      }))
      alert('Logo updated successfully.')
    } catch (error: any) {
      console.error('Failed to upload logo', error)
      alert(error.message || 'Failed to upload logo. Make sure ImageKit is configured.')
    } finally {
      setUploadingLogo(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handlePasswordUpdate = async () => {
    if (!passwordForm.newPassword || !passwordForm.confirmPassword) {
      alert('Please provide a new password and confirmation.')
      return
    }

    try {
      setSavingSecurity(true)
      await api.updatePharmacyPassword({
        currentPassword: passwordForm.currentPassword || undefined,
        newPassword: passwordForm.newPassword,
        confirmPassword: passwordForm.confirmPassword,
      })
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
      alert('Password updated successfully.')
    } catch (error: any) {
      console.error('Failed to update password', error)
      alert(error.message || 'Failed to update password.')
    } finally {
      setSavingSecurity(false)
    }
  }

  const brandingPreview = useMemo(
    () => ({
      name: formState.name || settings.name || 'Pharmacy Name',
      phone: formState.phone || settings.phone || '',
      email: formState.email || settings.email || '',
      address: formState.address || settings.address || '',
      about: formState.about || settings.about || '',
      logoUrl: formState.logo_url || settings.logo_thumbnail_url || '',
    }),
    [formState, settings]
  )

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-600 mt-2">Control your pharmacy profile, invoice branding, and account security.</p>
        </div>
        <div className="flex gap-2 rounded-2xl bg-blue-50 px-4 py-2 text-sm text-blue-700 border border-blue-100 items-center">
          <Eye className="w-4 h-4" />
          <span>Updates reflect across invoices, dashboards, and reports instantly.</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all ${
                isActive
                  ? 'bg-primary-600 text-white shadow-sm'
                  : 'bg-white text-gray-600 border border-gray-200 hover:border-primary-200 hover:text-primary-600'
              }`}
              type="button"
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {loading ? (
        <Card className="flex items-center justify-center py-16">
          <div className="flex items-center gap-3 text-gray-600">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Loading pharmacy settings...</span>
          </div>
        </Card>
      ) : (
        <>
          {!canEdit && (
            <Card className="border-yellow-200 bg-yellow-50 text-yellow-800">
              <p className="text-sm font-medium">You have read-only access.</p>
              <p className="text-sm mt-1">
                Contact a pharmacy owner or administrator if you need to update profile or security settings.
              </p>
            </Card>
          )}

          {activeTab === 'profile' && (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,400px)]">
              <Card className="p-6 space-y-6">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Pharmacy Profile</h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Update public-facing details. These appear on dashboards, reports, and exports.
                  </p>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <Input
                    label="Pharmacy Name"
                    value={formState.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    placeholder="Enter pharmacy name"
                    disabled={!canEdit || savingProfile}
                  />
                  <Input
                    label="Owner / Manager Name"
                    value={formState.owner_name}
                    onChange={(e) => handleInputChange('owner_name', e.target.value)}
                    placeholder="Optional"
                    disabled={!canEdit || savingProfile}
                  />
                  <Input
                    label="Phone Number"
                    value={formState.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    placeholder="+252 xx xxx xxxx"
                    disabled={!canEdit || savingProfile}
                  />
                  <Input
                    label="Email"
                    type="email"
                    value={formState.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    placeholder="contact@pharmacy.com"
                    disabled={!canEdit || savingProfile}
                  />
                </div>
                <div className="grid gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Address / Location</label>
                    <input
                      type="text"
                      className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100"
                      value={formState.address}
                      onChange={(e) => handleInputChange('address', e.target.value)}
                      placeholder="Wadnaha Street, Mogadishu"
                      disabled={!canEdit || savingProfile}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">About Pharmacy (Tagline)</label>
                    <textarea
                      className="w-full min-h-[120px] rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100"
                      value={formState.about}
                      onChange={(e) => handleInputChange('about', e.target.value)}
                      placeholder="Share a short description about your pharmacy."
                      disabled={!canEdit || savingProfile}
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button onClick={handleSaveProfile} disabled={!canEdit || savingProfile}>
                    {savingProfile ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Saving...
                      </span>
                    ) : (
                      'Save Changes'
                    )}
                  </Button>
                </div>
              </Card>

              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-700">Live Invoice Preview</h3>
                <InvoicePreview {...brandingPreview} />
              </div>
            </div>
          )}

          {activeTab === 'branding' && (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,400px)]">
              <Card className="p-6 space-y-6">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Invoice Branding</h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Customize how invoices appear to patients and customers. These updates reflect on PDFs, Excel
                    exports, and in-app previews.
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="h-20 w-20 overflow-hidden rounded-2xl border border-dashed border-gray-300 bg-gray-50 flex items-center justify-center">
                    {formState.logo_url ? (
                      <img src={formState.logo_url} alt="Pharmacy logo" className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-lg font-semibold text-gray-400">Logo</span>
                    )}
                  </div>
                  <div className="space-y-2 text-sm text-gray-600">
                    <p>Upload a square logo (PNG or JPG recommended).</p>
                    <p className="text-xs text-gray-500">Minimum size 200x200px for best results.</p>
                    <div className="flex items-center gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        disabled={!canEdit || uploadingLogo}
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-2"
                      >
                        <UploadCloud className="w-4 h-4" />
                        {uploadingLogo ? 'Uploading...' : 'Upload Logo'}
                      </Button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleLogoUpload}
                      />
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setActiveTab('profile')}
                    className="w-full justify-center text-sm"
                  >
                    Edit contact information in Profile tab
                  </Button>
                </div>
              </Card>

              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-700">Invoice Preview</h3>
                <InvoicePreview {...brandingPreview} />
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
              <Card className="p-6 space-y-6">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Account Security</h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Change your login credentials to keep the account secure.
                  </p>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <Input
                    label="Login Email"
                    type="email"
                    value={formState.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    disabled={!canEdit || savingProfile}
                  />
                  <Input
                    label="Contact Number"
                    value={formState.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    disabled={!canEdit || savingProfile}
                  />
                </div>
                <div className="flex justify-end">
                  <Button onClick={handleSaveProfile} disabled={!canEdit || savingProfile}>
                    {savingProfile ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Saving...
                      </span>
                    ) : (
                      'Update Contact Details'
                    )}
                  </Button>
                </div>

                <div className="border-t border-gray-200 pt-6 space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900">Change Password</h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    <Input
                      label="Current Password"
                      type="password"
                      placeholder="Enter current password"
                      value={passwordForm.currentPassword}
                      onChange={(e) => setPasswordForm((prev) => ({ ...prev, currentPassword: e.target.value }))}
                      disabled={!canEdit || savingSecurity}
                    />
                    <div className="grid gap-4">
                      <Input
                        label="New Password"
                        type="password"
                        placeholder="Enter new password"
                        value={passwordForm.newPassword}
                        onChange={(e) => setPasswordForm((prev) => ({ ...prev, newPassword: e.target.value }))}
                        disabled={!canEdit || savingSecurity}
                      />
                      <Input
                        label="Confirm New Password"
                        type="password"
                        placeholder="Confirm new password"
                        value={passwordForm.confirmPassword}
                        onChange={(e) =>
                          setPasswordForm((prev) => ({ ...prev, confirmPassword: e.target.value }))
                        }
                        disabled={!canEdit || savingSecurity}
                      />
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button onClick={handlePasswordUpdate} disabled={!canEdit || savingSecurity}>
                      {savingSecurity ? (
                        <span className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Updating...
                        </span>
                      ) : (
                        'Update Password'
                      )}
                    </Button>
                  </div>
                </div>
              </Card>

              <Card className="p-5 space-y-3 bg-gray-50 border-dashed border-gray-200">
                <h4 className="text-sm font-semibold text-gray-700">Security Tips</h4>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li>Use a unique password that you don’t share with other services.</li>
                  <li>Update passwords regularly, especially after staff changes.</li>
                  <li>Keep your contact details current for billing & notifications.</li>
                </ul>
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  )
}
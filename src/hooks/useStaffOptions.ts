import { useEffect, useMemo, useState } from 'react'
import { api } from '@/lib/api'
import { useUser } from '@/contexts/UserContext'

export interface StaffOption {
  value: string
  label: string
  role: string
}

export const useStaffOptions = () => {
  const { user } = useUser()
  const [options, setOptions] = useState<StaffOption[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      if (!user) {
        setOptions([])
        setLoading(false)
        return
      }

      try {
        setLoading(true)

        if (user.role === 'staff') {
          setOptions([
            {
              value: user._id,
              label: user.pharmacyName || 'Me',
              role: user.role,
            },
          ])
          return
        }

        const users = await api.getUsers()
        const filtered = Array.isArray(users)
          ? users.filter((staff: any) =>
              staff.role === 'staff' ||
              staff.role === 'pharmacy_owner' ||
              staff._id === user._id
            )
          : []

        const mapped = filtered.map((staff: any) => ({
          value: staff._id,
          label: staff.pharmacyName || staff.email || 'Unnamed Staff',
          role: staff.role,
        }))

        setOptions(mapped)
      } catch (error) {
        console.error('Failed to load staff options', error)
        setOptions(user.role === 'staff'
          ? [
              {
                value: user._id,
                label: user.pharmacyName || 'Me',
                role: user.role,
              },
            ]
          : [])
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [user?._id, user?.role, user?.pharmacyName])

  const resolvedOptions = useMemo(() => options, [options])

  return {
    loading,
    options: resolvedOptions,
  }
}





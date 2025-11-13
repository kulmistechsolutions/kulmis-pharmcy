import React from 'react'
import type { Banner } from '@/types/banner'
import { Button } from '@/components/ui/Button'

interface PromoBannerModalProps {
  banner: Banner
  onDismiss: () => void
}

export const PromoBannerModal: React.FC<PromoBannerModalProps> = ({ banner, onDismiss }) => {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
        {banner.image_url && (
          <img
            src={banner.image_url}
            alt={banner.title}
            className="h-48 w-full object-cover"
          />
        )}
        <div className="space-y-4 p-6">
          <div className="space-y-2">
            <h3 className="text-2xl font-semibold text-primary-600">{banner.title}</h3>
            <p className="text-sm text-gray-600 whitespace-pre-line">{banner.message}</p>
          </div>
          <Button onClick={onDismiss} className="w-full">
            Close
          </Button>
        </div>
      </div>
    </div>
  )
}

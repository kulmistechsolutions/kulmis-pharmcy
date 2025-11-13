import React from 'react'
import { cn } from '@/lib/utils'

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

export const Card: React.FC<CardProps> = ({ children, className, ...props }) => {
  return (
    <div
      className={cn(
        'bg-white rounded-2xl shadow-md shadow-gray-200 p-5 sm:p-6 lg:p-8',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}


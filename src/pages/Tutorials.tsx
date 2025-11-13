import React from 'react'
import { Play } from 'lucide-react'
import { Card } from '@/components/ui/Card'

const tutorials = [
  {
    id: 1,
    title: 'How to Add Medicines',
    description: 'Learn how to add new medicines to your inventory with batch numbers and expiry dates.',
    thumbnail: 'https://via.placeholder.com/300x200',
  },
  {
    id: 2,
    title: 'How to Record Sales',
    description: 'Step-by-step guide on processing sales and generating invoices.',
    thumbnail: 'https://via.placeholder.com/300x200',
  },
  {
    id: 3,
    title: 'How to Generate Reports',
    description: 'Understand how to create and export detailed reports for your pharmacy.',
    thumbnail: 'https://via.placeholder.com/300x200',
  },
  {
    id: 4,
    title: 'How to Register Lab Tests',
    description: 'Learn how to register patients for laboratory tests and manage results.',
    thumbnail: 'https://via.placeholder.com/300x200',
  },
]

export const Tutorials: React.FC = () => {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Tutorials & Help Center</h1>
        <p className="text-gray-600 mt-2">Learn how to use the system effectively</p>
      </div>

      {/* Tutorials Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {tutorials.map((tutorial) => (
          <Card key={tutorial.id} className="hover:shadow-lg transition-shadow cursor-pointer group">
            <div className="relative overflow-hidden rounded-xl mb-4 bg-gradient-to-br from-primary-100 to-primary-200 h-48 flex items-center justify-center">
              <Play className="w-16 h-16 text-primary-600 group-hover:scale-110 transition-transform" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">{tutorial.title}</h3>
            <p className="text-gray-600 text-sm mb-4">{tutorial.description}</p>
            <button className="text-primary-600 font-medium hover:underline flex items-center">
              <Play className="w-4 h-4 mr-2" />
              Watch Tutorial
            </button>
          </Card>
        ))}
      </div>
    </div>
  )
}


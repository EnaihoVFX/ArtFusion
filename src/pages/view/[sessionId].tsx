import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { storage } from '@/lib/storage'

export default function ViewImage() {
  const router = useRouter()
  const { sessionId } = router.query
  const [image, setImage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!sessionId) return
    const storedImage = storage.getGeneratedImage(sessionId as string)
    if (storedImage) {
      setImage(storedImage)
    } else {
      setError('No image found')
    }
  }, [sessionId])

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">{error}</h1>
          <button
            onClick={() => router.push('/')}
            className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            Back to Home
          </button>
        </div>
      </div>
    )
  }

  if (!image) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">Loading...</h1>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-4">
          <img
            src={image}
            alt="Generated artwork"
            className="w-full h-auto rounded-lg"
          />
        </div>
      </div>
    </div>
  )
} 
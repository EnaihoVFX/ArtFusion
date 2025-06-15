import { useState, useEffect } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'

interface ImageVotingProps {
  images: string[]
  onVote: (imageIndex: number) => void
  onTitleSubmit: (title: string) => void
  votingTimeLeft?: number
  hasVoted?: boolean
  votingComplete?: boolean
}

export default function ImageVoting({ 
  images, 
  onVote, 
  onTitleSubmit, 
  votingTimeLeft = 10,
  hasVoted = false,
  votingComplete = false
}: ImageVotingProps) {
  const { publicKey } = useWallet()
  const [selectedImage, setSelectedImage] = useState<number | null>(null)
  const [title, setTitle] = useState('')
  const [expandedImage, setExpandedImage] = useState<number | null>(null)

  // Handle voting
  const handleVote = (index: number) => {
    if (!hasVoted && !votingComplete && votingTimeLeft > 0) {
      setSelectedImage(index)
      onVote(index)
    }
  }

  const handleTitleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (title.trim()) {
      onTitleSubmit(title.trim())
    }
  }

  // Show expanded image modal
  if (expandedImage !== null) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
        <div className="relative max-w-4xl max-h-full p-4">
          <button
            onClick={() => setExpandedImage(null)}
            className="absolute top-4 right-4 bg-white bg-opacity-80 hover:bg-opacity-100 text-gray-800 rounded-full w-10 h-10 flex items-center justify-center text-xl font-bold z-10"
          >
            ×
          </button>
          <img
            src={images[expandedImage]}
            alt={`Generated artwork ${expandedImage + 1}`}
            className="max-w-full max-h-full object-contain rounded-lg"
          />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between mb-2">
        <span className="text-lg font-semibold">Vote for your favorite!</span>
      </div>
      <div className="grid grid-cols-2 gap-4">
        {images.map((image, index) => (
          <div
            key={index}
            className={`relative rounded-lg overflow-hidden transition-transform ${
              selectedImage === index ? 'ring-4 ring-purple-500' : ''
            }`}
          >
            <img
              src={image}
              alt={`Generated artwork ${index + 1}`}
              className="w-full h-64 object-cover cursor-pointer"
              onClick={() => setExpandedImage(index)}
            />
            {!hasVoted && !votingComplete && votingTimeLeft > 0 && (
              <button
                onClick={() => handleVote(index)}
                className="absolute bottom-2 left-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
              >
                Vote for this!
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
} 
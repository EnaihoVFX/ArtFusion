import React, { useState } from 'react'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import { useWallet } from '@solana/wallet-adapter-react'
import Canvas from '../components/Canvas'

export default function CreatePage() {
  const { publicKey } = useWallet()
  const [currentImage, setCurrentImage] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [prompt, setPrompt] = useState('')

  const handleDrawingComplete = async (imageData: string) => {
    setCurrentImage(imageData)
  }

  const generateAIImage = async () => {
    if (!prompt) return

    setIsGenerating(true)
    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
          image: currentImage,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to generate image')
      }

      const data = await response.json()
      
      if (!data.images || !Array.isArray(data.images) || data.images.length === 0) {
        throw new Error('No images in response')
      }
      
      setCurrentImage(data.images[0]) // Use the first image for now
    } catch (error) {
      console.error('Error generating image:', error)
    } finally {
      setIsGenerating(false)
    }
  }

  if (!publicKey) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">
            Please connect your wallet to continue
          </h1>
          <WalletMultiButton />
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-8">Create Your NFT</h1>
        
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <Canvas
            sessionId={publicKey.toBase58()}
          />
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            AI Enhancement
          </h2>
          <div className="space-y-4">
            <div>
              <label
                htmlFor="prompt"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Describe your vision
              </label>
              <textarea
                id="prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                rows={3}
                placeholder="Describe how you want to enhance your drawing..."
              />
            </div>
            <button
              onClick={generateAIImage}
              disabled={isGenerating || !prompt}
              className="w-full px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGenerating ? 'Generating...' : 'Generate AI Enhancement'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
} 
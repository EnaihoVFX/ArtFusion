import React, { useState } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import ImageVoting from './ImageVoting'

interface ImageGeneratorProps {
  sessionId: string
  canvasRef: React.RefObject<HTMLCanvasElement>
  onGenerationStart: () => void
  onGenerationComplete: (imageUrl: string) => void
}

const ImageGenerator: React.FC<ImageGeneratorProps> = ({ 
  sessionId, 
  canvasRef,
  onGenerationStart,
  onGenerationComplete 
}) => {
  const { publicKey } = useWallet()
  const [prompt, setPrompt] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [generatedImages, setGeneratedImages] = useState<string[] | null>(null)
  const [winningImage, setWinningImage] = useState<string | null>(null)
  const [progress, setProgress] = useState<string>('')
  const [nftTitle, setNftTitle] = useState('')

  const generateImage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!prompt.trim()) return

    const canvas = canvasRef.current
    if (!canvas) {
      setError('Canvas not found')
      return
    }

    setIsGenerating(true)
    setError(null)
    setProgress('Initializing...')
    onGenerationStart()

    try {
      const imageData = canvas.toDataURL()
      setProgress('Processing image data...')
      
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: prompt.trim(),
          image: imageData,
          sessionId,
        }),
      })

      setProgress('Generating images...')
      const result = await response.json()

      console.log('API Response:', result)

      if (!response.ok) {
        throw new Error(result.error || 'Failed to generate image')
      }

      if (!result.images || !Array.isArray(result.images)) {
        console.log('Response structure:', result)
        throw new Error('No images in response')
      }

      setProgress('Finalizing...')
      setGeneratedImages(result.images)
      setProgress('')
    } catch (err) {
      console.error('Generation error:', err)
      setError(err instanceof Error ? err.message : 'Failed to generate image')
      setProgress('')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleVote = (index: number) => {
    if (generatedImages && generatedImages[index]) {
      setWinningImage(generatedImages[index])
      onGenerationComplete(generatedImages[index])
    }
  }

  const mintNFT = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!winningImage || !nftTitle.trim() || !publicKey) return

    try {
      setProgress('Minting NFT...')
      const response = await fetch('/api/mint-nft', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image: winningImage,
          title: nftTitle.trim(),
          sessionId,
          recipient: publicKey.toBase58(),
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to mint NFT')
      }

      alert('NFT minted successfully! View it on Solana Explorer: ' + data.mintAddress)
    } catch (error) {
      console.error('Error minting NFT:', error)
      setError(error instanceof Error ? error.message : 'Failed to mint NFT')
    } finally {
      setProgress('')
    }
  }

  return (
    <div className="space-y-4">
      {!generatedImages && !winningImage ? (
        <form onSubmit={generateImage} className="space-y-4">
          <div>
            <label htmlFor="prompt" className="block text-sm font-medium text-gray-700 mb-1">
              Enter your prompt
            </label>
            <textarea
              id="prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe how you want to enhance the drawing..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              rows={3}
              disabled={isGenerating}
            />
          </div>
          <button
            type="submit"
            disabled={!prompt.trim() || isGenerating}
            className="w-full px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 relative"
          >
            {isGenerating ? (
              <div className="flex items-center justify-center space-x-2">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>{progress || 'Generating...'}</span>
              </div>
            ) : (
              'Generate'
            )}
          </button>
        </form>
      ) : null}

      {generatedImages && !winningImage && (
        <ImageVoting
          images={generatedImages}
          onVote={handleVote}
          onTitleSubmit={() => {}}
        />
      )}

      {winningImage && (
        <div className="space-y-4">
          <div className="bg-white rounded-lg shadow-lg p-4">
            <h3 className="text-lg font-semibold mb-2">Winning Image</h3>
            <img
              src={winningImage}
              alt="Winning"
              className="w-full rounded-lg shadow-lg mb-4"
            />
            <form onSubmit={mintNFT} className="space-y-4">
              <div>
                <label htmlFor="nftTitle" className="block text-sm font-medium text-gray-700 mb-1">
                  NFT Title
                </label>
                <input
                  type="text"
                  id="nftTitle"
                  value={nftTitle}
                  onChange={(e) => setNftTitle(e.target.value)}
                  placeholder="Enter a title for your NFT..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={!nftTitle.trim() || isGenerating}
                className="w-full px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                {isGenerating ? (
                  <div className="flex items-center justify-center space-x-2">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>{progress || 'Minting...'}</span>
                  </div>
                ) : (
                  'Mint NFT'
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {error && (
        <div className="text-red-500 text-sm bg-red-50 p-3 rounded-lg">
          {error}
        </div>
      )}
    </div>
  )
}

export default ImageGenerator 
import React, { useRef, useEffect, useState } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { storage } from '@/lib/storage'
import { useRouter } from 'next/router'
import ImageVoting from './ImageVoting'

interface CanvasProps {
  sessionId: string
  width?: number
  height?: number
}

export default function Canvas({ sessionId, width = 512, height = 512 }: CanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [color, setColor] = useState('#000000')
  const [brushSize, setBrushSize] = useState(5)
  const [prompt, setPrompt] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isFillMode, setIsFillMode] = useState(false)
  const [showPromptSuggestions, setShowPromptSuggestions] = useState(false)
  const [generatedImages, setGeneratedImages] = useState<string[] | null>(null)
  const [winningImage, setWinningImage] = useState<string | null>(null)
  const [nftTitle, setNftTitle] = useState('')
  const [isMinting, setIsMinting] = useState(false)
  const [mintError, setMintError] = useState<string | null>(null)
  const [mintSuccess, setMintSuccess] = useState(false)
  const [mintedNFT, setMintedNFT] = useState<any>(null)
  const { publicKey } = useWallet()
  const router = useRouter()

  const promptSuggestions = [
    "rock",
    "stone",
    "balloon",
    "apple",
    "flower",
    "tree",
    "car",
    "house"
  ]

  const insertSuggestion = (suggestion: string) => {
    setPrompt(suggestion)
    setShowPromptSuggestions(false)
  }

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set canvas size
    canvas.width = width
    canvas.height = height

    // Load saved state
    const savedState = storage.getCanvasState(sessionId)
    if (savedState) {
      const img = new Image()
      img.onload = () => {
        ctx.drawImage(img, 0, 0)
      }
      img.src = savedState
    } else {
      // Set white background
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, width, height)
    }
  }, [sessionId, width, height])

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!publicKey || isFillMode) return
    setIsDrawing(true)
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.strokeStyle = color
    ctx.lineWidth = brushSize
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
  }

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !publicKey || isFillMode) return
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    ctx.lineTo(x, y)
    ctx.stroke()
  }

  const stopDrawing = () => {
    if (!isDrawing || !publicKey) return
    setIsDrawing(false)
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.closePath()

    // Save canvas state
    const imageData = canvas.toDataURL('image/png')
    storage.updateCanvasState(sessionId, imageData)
  }

  const handleGenerate = async () => {
    if (!publicKey) {
      setError('Please connect your wallet first')
      return
    }

    const promptText = prompt.trim()
    if (!promptText) {
      setError('Please enter a prompt')
      return
    }

    const canvas = canvasRef.current
    if (!canvas) {
      setError('Canvas not initialized')
      return
    }

    // Check if canvas is empty
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      setError('Canvas context not available')
      return
    }

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const hasContent = imageData.data.some(pixel => pixel !== 0)
    if (!hasContent) {
      setError('Please draw something on the canvas first')
      return
    }

    try {
      const imageData = canvas.toDataURL('image/png')
      if (!imageData) {
        throw new Error('Failed to get canvas data')
      }

      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: promptText,
          image: imageData,
          address: publicKey.toBase58(),
          sessionId: sessionId
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        // Handle NSFW error specifically
        if (data.type === 'nsfw') {
          setError('🚫 Content flagged as inappropriate. This might be a false positive - try clicking Generate again, or use a different prompt.')
          return
        }
        throw new Error(data.error || 'Failed to generate image')
      }

      if (!data.images || !Array.isArray(data.images) || data.images.length === 0) {
        throw new Error('No images in response')
      }

      // Set the generated images for voting
      setGeneratedImages(data.images)
      setIsGenerating(false)
    } catch (error) {
      console.error('Error generating image:', error)
      setError(error instanceof Error ? error.message : 'Failed to generate image')
      setIsGenerating(false)
    }
  }

  const handleVote = (index: number) => {
    if (generatedImages && generatedImages[index]) {
      setWinningImage(generatedImages[index])
      storage.setGeneratedImage(sessionId, generatedImages[index])
    }
  }

  const handleTitleSubmit = (title: string) => {
    setNftTitle(title)
    // Start minting process
    handleMintNFT()
  }

  const handleMintNFT = async () => {
    if (!winningImage || !nftTitle.trim() || !publicKey) return

    try {
      setIsMinting(true)
      setMintError(null)

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
          // In a real implementation, you'd get participants from the game session
          collaborators: [{
            address: publicKey.toBase58(),
            stake: 100,
            role: 'creator'
          }]
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to mint NFT')
      }

      setMintSuccess(true)
      setMintedNFT(data)
      setMintError(null)
    } catch (error) {
      console.error('Error minting NFT:', error)
      setMintError(error instanceof Error ? error.message : 'Failed to mint NFT')
      setMintSuccess(false)
    } finally {
      setIsMinting(false)
    }
  }

  const clearCanvas = () => {
    if (!canvasRef.current) return
    const ctx = canvasRef.current.getContext('2d')
    if (!ctx) return
    
    // Only clear if not generating
    if (!isGenerating) {
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
      // Save the cleared state
      const imageData = canvasRef.current.toDataURL('image/png')
      storage.updateCanvasState(sessionId, imageData)
    }
  }

  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null
  }

  const floodFill = (startX: number, startY: number, targetColor: string) => {
    if (!canvasRef.current) return
    const ctx = canvasRef.current.getContext('2d')
    if (!ctx) return

    const imageData = ctx.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height)
    const pixels = imageData.data

    // Convert target color to RGB
    const targetRGB = hexToRgb(targetColor)
    if (!targetRGB) return

    // Get the color at the start position
    const startPos = (startY * canvasRef.current.width + startX) * 4
    const startR = pixels[startPos]
    const startG = pixels[startPos + 1]
    const startB = pixels[startPos + 2]
    const startA = pixels[startPos + 3]

    // If the start color is the same as the target color, do nothing
    if (
      startR === targetRGB.r &&
      startG === targetRGB.g &&
      startB === targetRGB.b &&
      startA === 255
    ) {
      return
    }

    const stack: [number, number][] = [[startX, startY]]
    const width = canvasRef.current.width
    const height = canvasRef.current.height

    while (stack.length > 0) {
      const [x, y] = stack.pop()!
      const pos = (y * width + x) * 4

      // Skip if out of bounds or different color
      if (
        x < 0 || x >= width ||
        y < 0 || y >= height ||
        pixels[pos] !== startR ||
        pixels[pos + 1] !== startG ||
        pixels[pos + 2] !== startB ||
        pixels[pos + 3] !== startA
      ) {
        continue
      }

      // Fill the pixel
      pixels[pos] = targetRGB.r
      pixels[pos + 1] = targetRGB.g
      pixels[pos + 2] = targetRGB.b
      pixels[pos + 3] = 255

      // Add adjacent pixels to stack
      stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1])
    }

    ctx.putImageData(imageData, 0, 0)
  }

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isFillMode || !canvasRef.current) return

    const rect = canvasRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    // Scale coordinates to match canvas resolution
    const scaleX = canvasRef.current.width / rect.width
    const scaleY = canvasRef.current.height / rect.height
    const scaledX = Math.floor(x * scaleX)
    const scaledY = Math.floor(y * scaleY)

    floodFill(scaledX, scaledY, color)
  }

  if (isGenerating) {
    return (
      <div className="space-y-4">
        <div className="flex space-x-4">
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="w-12 h-12 rounded cursor-pointer"
            disabled
          />
          <input
            type="range"
            min="1"
            max="50"
            value={brushSize}
            onChange={(e) => setBrushSize(Number(e.target.value))}
            className="w-32"
            disabled
          />
          <button
            onClick={() => setIsFillMode(!isFillMode)}
            className={`px-4 py-2 rounded ${
              isFillMode ? 'bg-blue-500 text-white' : 'bg-gray-200'
            }`}
            disabled
          >
            {isFillMode ? 'Fill Mode' : 'Draw Mode'}
          </button>
          <button
            onClick={clearCanvas}
            className="px-4 py-2 bg-red-500 text-white rounded"
            disabled
          >
            Clear
          </button>
        </div>

        <canvas
          ref={canvasRef}
          className="border border-gray-300 rounded cursor-not-allowed opacity-50"
          style={{ width, height }}
        />

        <div className="space-y-4">
          <div className="relative">
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe your fusion..."
              className="w-full px-4 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
            <button
              type="button"
              onClick={() => setShowPromptSuggestions(!showPromptSuggestions)}
              className="absolute right-2 top-2 text-gray-400 hover:text-gray-600"
            >
              💡
            </button>
          </div>
          
          {showPromptSuggestions && (
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600 mb-2">Try these family-friendly prompts:</p>
              <div className="grid grid-cols-1 gap-2">
                {promptSuggestions.map((suggestion, index) => (
                  <button
                    key={index}
                    onClick={() => insertSuggestion(suggestion)}
                    className="text-left p-2 text-sm bg-white rounded border hover:bg-purple-50 hover:border-purple-300 transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}
          
          <button
            onClick={handleGenerate}
            disabled
            className="w-full px-6 py-3 bg-purple-600 text-white rounded-lg opacity-50 cursor-not-allowed"
          >
            Locking Fusion...
          </button>
        </div>

        <div className="text-center py-8">
          <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Generating your fusion...</p>
        </div>
      </div>
    )
  }

  // Show voting UI when images are generated
  if (generatedImages && !winningImage) {
    return (
      <div className="space-y-4">
        <div className="text-center mb-4">
          <h2 className="text-xl font-bold text-gray-800">Choose Your Favorite!</h2>
          <p className="text-gray-600">Vote for the image you like best</p>
        </div>
        
        <ImageVoting
          images={generatedImages}
          onVote={handleVote}
          onTitleSubmit={handleTitleSubmit}
        />
      </div>
    )
  }

  // Show winning image
  if (winningImage) {
    return (
      <div className="space-y-4">
        <div className="text-center">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Your Winning Image!</h2>
          <img
            src={winningImage}
            alt="Winning artwork"
            className="w-full max-w-md mx-auto rounded-lg shadow-lg"
          />
          {isMinting ? (
            <div className="mt-4">
              <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
              <p className="text-gray-600">Minting your NFT...</p>
            </div>
          ) : (
            <p className="mt-4 text-gray-600">Enter a title below to mint your NFT</p>
          )}
        </div>

        {!isMinting && (
          <form onSubmit={(e) => { e.preventDefault(); if (nftTitle.trim()) handleTitleSubmit(nftTitle); }} className="space-y-4">
            <div>
              <label htmlFor="nftTitle" className="block text-sm font-medium text-gray-700 mb-2">
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
              disabled={!nftTitle.trim()}
              className="w-full px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              Mint NFT
            </button>
          </form>
        )}
        
        {mintError && (
          <div className="text-red-500 text-center mt-4 p-3 bg-red-50 rounded-lg border border-red-200">
            {mintError}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex space-x-4">
        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          className="w-12 h-12 rounded cursor-pointer"
        />
        <input
          type="range"
          min="1"
          max="50"
          value={brushSize}
          onChange={(e) => setBrushSize(Number(e.target.value))}
          className="w-32"
        />
        <button
          onClick={() => setIsFillMode(!isFillMode)}
          className={`px-4 py-2 rounded ${
            isFillMode ? 'bg-blue-500 text-white' : 'bg-gray-200'
          }`}
        >
          {isFillMode ? 'Fill Mode' : 'Draw Mode'}
        </button>
        <button
          onClick={clearCanvas}
          className="px-4 py-2 bg-red-500 text-white rounded"
        >
          Clear
        </button>
      </div>

      <canvas
        ref={canvasRef}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        onClick={handleCanvasClick}
        className="border border-gray-300 rounded cursor-crosshair"
        style={{ width, height }}
      />

      <div className="space-y-4">
        <div className="relative">
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe your fusion..."
            className="w-full px-4 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
          <button
            type="button"
            onClick={() => setShowPromptSuggestions(!showPromptSuggestions)}
            className="absolute right-2 top-2 text-gray-400 hover:text-gray-600"
          >
            💡
          </button>
        </div>
        
        {showPromptSuggestions && (
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600 mb-2">Try these family-friendly prompts:</p>
            <div className="grid grid-cols-1 gap-2">
              {promptSuggestions.map((suggestion, index) => (
                <button
                  key={index}
                  onClick={() => insertSuggestion(suggestion)}
                  className="text-left p-2 text-sm bg-white rounded border hover:bg-purple-50 hover:border-purple-300 transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}
        
        <button
          onClick={handleGenerate}
          className="w-full px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
        >
          Generate
        </button>
      </div>

      {error && (
        <div className="text-red-500 text-center mt-4 p-3 bg-red-50 rounded-lg border border-red-200">
          {error}
        </div>
      )}
    </div>
  )
} 
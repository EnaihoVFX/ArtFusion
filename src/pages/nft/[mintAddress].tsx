import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { useWallet } from '@solana/wallet-adapter-react'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'

interface NFTData {
  mintAddress: string
  title: string
  image: string
  owner: string
  collaborators?: Array<{
    address: string
    stake: number
    role: string
  }>
  sessionId?: string
  createdAt: string
  likes: number
  valuation: number
  isForSale: boolean
  price: number
}

export default function NFTView() {
  const router = useRouter()
  const { mintAddress } = router.query
  const { connected, publicKey } = useWallet()
  const [nftData, setNftData] = useState<NFTData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isLiking, setIsLiking] = useState(false)
  const [isUpdatingValuation, setIsUpdatingValuation] = useState(false)

  useEffect(() => {
    if (!mintAddress) return

    const fetchNFTData = async () => {
      try {
        setIsLoading(true)
        const response = await fetch(`/api/nfts/${mintAddress}`)
        
        if (!response.ok) {
          throw new Error('NFT not found')
        }
        
        const data = await response.json()
        setNftData(data)
      } catch (error) {
        console.error('Error fetching NFT:', error)
        setError(error instanceof Error ? error.message : 'Failed to load NFT')
      } finally {
        setIsLoading(false)
      }
    }

    fetchNFTData()
  }, [mintAddress])

  // Real-time updates
  useEffect(() => {
    if (!mintAddress) return

    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/nfts/${mintAddress}`)
        if (response.ok) {
          const data = await response.json()
          setNftData(prev => prev ? { ...prev, ...data } : data)
        }
      } catch (error) {
        console.error('Error updating NFT data:', error)
      }
    }, 5000) // Update every 5 seconds

    return () => clearInterval(interval)
  }, [mintAddress])

  const handleLike = async () => {
    if (!mintAddress || isLiking) return

    try {
      setIsLiking(true)
      const response = await fetch(`/api/nfts/${mintAddress}/like`, {
        method: 'POST',
      })
      
      if (response.ok) {
        const data = await response.json()
        setNftData(prev => prev ? { ...prev, likes: data.likes } : null)
      }
    } catch (error) {
      console.error('Error liking NFT:', error)
    } finally {
      setIsLiking(false)
    }
  }

  const handleUpdateValuation = async () => {
    if (!mintAddress || isUpdatingValuation) return

    try {
      setIsUpdatingValuation(true)
      const response = await fetch(`/api/nfts/${mintAddress}/valuation`, {
        method: 'POST',
      })
      
      if (response.ok) {
        const data = await response.json()
        setNftData(prev => prev ? { ...prev, valuation: data.valuation } : null)
      }
    } catch (error) {
      console.error('Error updating valuation:', error)
    } finally {
      setIsUpdatingValuation(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading NFT...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">NFT Not Found</h1>
          <p className="text-gray-600 mb-8">{error}</p>
          <button
            onClick={() => router.push('/')}
            className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            Go Home
          </button>
        </div>
      </div>
    )
  }

  if (!nftData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">NFT Not Found</h1>
          <p className="text-gray-600 mb-8">The requested NFT could not be found.</p>
          <button
            onClick={() => router.push('/')}
            className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            Go Home
          </button>
        </div>
      </div>
    )
  }

  const isOwner = publicKey?.toBase58() === nftData.owner
  const isCollaborator = nftData.collaborators?.some(c => c.address === publicKey?.toBase58())

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">NFT Details</h1>
          <WalletMultiButton />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* NFT Image */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="aspect-square mb-4">
              <img
                src={nftData.image}
                alt={nftData.title}
                className="w-full h-full object-contain rounded-lg"
              />
            </div>
            
            {/* Ownership Badge */}
            <div className="flex justify-center mb-4">
              {isOwner ? (
                <span className="bg-green-100 text-green-800 px-4 py-2 rounded-full text-sm font-semibold">
                  ✓ You own this NFT
                </span>
              ) : isCollaborator ? (
                <span className="bg-blue-100 text-blue-800 px-4 py-2 rounded-full text-sm font-semibold">
                  ✓ You are a collaborator
                </span>
              ) : (
                <span className="bg-gray-100 text-gray-800 px-4 py-2 rounded-full text-sm font-semibold">
                  Viewing NFT
                </span>
              )}
            </div>
          </div>

          {/* NFT Details */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-bold mb-4">{nftData.title}</h2>
            
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-gray-700 mb-2">Mint Address</h3>
                <p className="text-sm text-gray-600 font-mono break-all">
                  {nftData.mintAddress}
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-gray-700 mb-2">Owner</h3>
                <p className="text-sm text-gray-600">
                  {nftData.owner === publicKey?.toBase58() ? 'You' : nftData.owner.slice(0, 6) + '...' + nftData.owner.slice(-4)}
                </p>
              </div>

              {nftData.collaborators && nftData.collaborators.length > 0 && (
                <div>
                  <h3 className="font-semibold text-gray-700 mb-2">Collaborators</h3>
                  <div className="space-y-2">
                    {nftData.collaborators.map((collaborator, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <span className={collaborator.address === publicKey?.toBase58() ? 'font-bold' : ''}>
                          {collaborator.address === publicKey?.toBase58() ? 'You' : collaborator.address.slice(0, 6) + '...'}
                        </span>
                        <span className="text-sm text-gray-600">
                          {collaborator.stake}% ownership
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {nftData.sessionId && (
                <div>
                  <h3 className="font-semibold text-gray-700 mb-2">Session ID</h3>
                  <p className="text-sm text-gray-600 font-mono">
                    {nftData.sessionId}
                  </p>
                </div>
              )}

              <div>
                <h3 className="font-semibold text-gray-700 mb-2">Created</h3>
                <p className="text-sm text-gray-600">
                  {new Date(nftData.createdAt).toLocaleString()}
                </p>
              </div>

              {/* Market Valuation */}
              <div className="bg-gradient-to-r from-purple-50 to-blue-50 p-4 rounded-lg border">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-700">Market Valuation</h3>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-xs text-green-600">Live</span>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Current Valuation:</span>
                    <span className="text-lg font-bold text-green-600">
                      ${nftData.valuation.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Likes:</span>
                    <span className="text-lg font-semibold text-blue-600">
                      {nftData.likes}
                    </span>
                  </div>
                  {nftData.isForSale && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Listed Price:</span>
                      <span className="text-lg font-semibold text-purple-600">
                        {nftData.price} SOL
                      </span>
                    </div>
                  )}
                  <div className="flex space-x-2 pt-2">
                    <button
                      onClick={handleLike}
                      disabled={isLiking}
                      className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm"
                    >
                      {isLiking ? 'Liking...' : '❤️ Like'}
                    </button>
                    <button
                      onClick={handleUpdateValuation}
                      disabled={isUpdatingValuation}
                      className="flex-1 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors text-sm"
                    >
                      {isUpdatingValuation ? 'Updating...' : '📈 Update'}
                    </button>
                  </div>
                  <div className="text-xs text-gray-500 text-center pt-2 border-t">
                    Updates every 5 seconds • Last updated: {new Date().toLocaleTimeString()}
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="mt-6 space-y-3">
              <button
                onClick={() => window.open(nftData.image, '_blank')}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                View Full Image
              </button>
              
              {nftData.sessionId && (
                <button
                  onClick={() => router.push(`/game/${nftData.sessionId}`)}
                  className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                >
                  View Session
                </button>
              )}
              
              <button
                onClick={() => router.push('/marketplace')}
                className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Back to Marketplace
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 
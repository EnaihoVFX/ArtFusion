import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { useWallet } from '@solana/wallet-adapter-react'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import CollaborativeOwnership from './CollaborativeOwnership'

interface Collaborator {
  address: string
  stake: number
  role: string
}

interface NFT {
  id: number
  title: string
  image: string
  price: string
  seller: string
  collaborators: Collaborator[]
  mintAddress: string
  likes: number
  valuation: number
  isCollaborative: boolean
  isForSale: boolean
  owner?: string
}

const Marketplace: React.FC = () => {
  const router = useRouter()
  const { publicKey, connected } = useWallet()
  const [nfts, setNfts] = useState<NFT[]>([])
  const [trendingNfts, setTrendingNfts] = useState<NFT[]>([])
  const [selectedNFT, setSelectedNFT] = useState<NFT | null>(null)
  const [listPrice, setListPrice] = useState('')
  const [buyPrice, setBuyPrice] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isBuying, setIsBuying] = useState(false)
  const [isListing, setIsListing] = useState(false)
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set())

  useEffect(() => {
    const fetchNfts = async () => {
      try {
        setIsLoading(true)
        const response = await fetch('/api/nfts')
        const data = await response.json()
        setNfts(data)
        // Calculate trending NFTs based on valuation/likes
        const trending = [...data].sort((a, b) => b.valuation - a.valuation).slice(0, 5)
        setTrendingNfts(trending)
      } catch (error) {
        console.error('Error fetching NFTs:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchNfts()
  }, [])

  const handleImageError = (mintAddress: string) => {
    setImageErrors(prev => new Set(prev).add(mintAddress))
  }

  const getImageFallback = (nft: NFT) => {
    if (imageErrors.has(nft.mintAddress)) {
      return (
        <div className="w-full h-48 bg-gray-200 flex items-center justify-center text-gray-500">
          <div className="text-center">
            <div className="text-4xl mb-2">🖼️</div>
            <div className="text-sm">Image not available</div>
          </div>
        </div>
      )
    }
    
    // Check if image URL is valid
    if (!nft.image || nft.image.trim() === '') {
      return (
        <div className="w-full h-48 bg-gray-200 flex items-center justify-center text-gray-500">
          <div className="text-center">
            <div className="text-4xl mb-2">🖼️</div>
            <div className="text-sm">No image</div>
          </div>
        </div>
      )
    }
    
    return (
      <img 
        src={nft.image} 
        alt={nft.title} 
        className="w-full h-48 object-cover mb-2"
        onError={() => handleImageError(nft.mintAddress)}
        loading="lazy"
        crossOrigin="anonymous"
      />
    )
  }

  const likeNFT = async (mintAddress: string) => {
    try {
      const response = await fetch(`/api/nfts/${mintAddress}/like`, {
        method: 'POST',
      })
      const data = await response.json()
      if (response.ok) {
        setNfts(nfts.map(nft => nft.mintAddress === mintAddress ? { ...nft, likes: data.likes } : nft))
      }
    } catch (error) {
      console.error('Error liking NFT:', error)
    }
  }

  const buyNFT = async (nft: NFT) => {
    if (!connected || !publicKey) {
      alert('Please connect your wallet first')
      return
    }

    try {
      setIsBuying(true)
      const response = await fetch(`/api/nfts/${nft.mintAddress}/buy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          buyerAddress: publicKey.toBase58(),
          price: nft.price
        }),
      })

      const data = await response.json()

      if (response.ok) {
        alert('NFT purchased successfully!')
        // Refresh NFTs
        window.location.reload()
      } else {
        alert(data.error || 'Failed to purchase NFT')
      }
    } catch (error) {
      console.error('Error buying NFT:', error)
      alert('Failed to purchase NFT')
    } finally {
      setIsBuying(false)
    }
  }

  const listNFT = async (nft: NFT) => {
    if (!connected || !publicKey) {
      alert('Please connect your wallet first')
      return
    }

    if (!listPrice || parseFloat(listPrice) <= 0) {
      alert('Please enter a valid price')
      return
    }

    try {
      setIsListing(true)
      const response = await fetch(`/api/nfts/${nft.mintAddress}/list`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          price: listPrice,
          sellerAddress: publicKey.toBase58()
        }),
      })

      const data = await response.json()

      if (response.ok) {
        alert('NFT listed for sale successfully!')
        setListPrice('')
        setSelectedNFT(null)
        // Refresh NFTs
        window.location.reload()
      } else {
        alert(data.error || 'Failed to list NFT')
      }
    } catch (error) {
      console.error('Error listing NFT:', error)
      alert('Failed to list NFT')
    } finally {
      setIsListing(false)
    }
  }

  const isOwner = (nft: NFT) => {
    if (!publicKey) return false
    return nft.owner === publicKey.toBase58() || nft.collaborators.some(c => c.address === publicKey.toBase58())
  }

  const handleNFTClick = (mintAddress: string) => {
    router.push(`/nft/${mintAddress}`)
  }

  const handleButtonClick = (e: React.MouseEvent, action: () => void) => {
    e.stopPropagation()
    action()
  }

  if (!connected || !publicKey) {
    return (
      <div className="text-center p-8">
        <h2 className="text-2xl font-bold mb-4">Connect Your Wallet</h2>
        <p className="mb-4 text-gray-600">Connect your wallet to access the marketplace</p>
        <WalletMultiButton />
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="text-center p-8">
        <h2 className="text-2xl font-bold mb-4">Loading Marketplace...</h2>
        <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">NFT Marketplace</h1>
      
      {/* List NFT Modal */}
      {selectedNFT && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">List NFT for Sale</h3>
            {getImageFallback(selectedNFT)}
            <p className="mb-4">{selectedNFT.title}</p>
            <input
              type="number"
              step="0.01"
              placeholder="Price in SOL"
              value={listPrice}
              onChange={(e) => setListPrice(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded mb-4"
            />
            <div className="flex space-x-2">
              <button
                onClick={(e) => handleButtonClick(e, () => listNFT(selectedNFT))}
                disabled={isListing}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
              >
                {isListing ? 'Listing...' : 'List for Sale'}
              </button>
              <button
                onClick={(e) => handleButtonClick(e, () => setSelectedNFT(null))}
                className="flex-1 px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {nfts.length === 0 ? (
        <div className="text-center p-8">
          <h2 className="text-xl font-semibold mb-4">No NFTs Available</h2>
          <p className="text-gray-600">Create some NFTs to see them in the marketplace!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {nfts.map(nft => (
            <div 
              key={nft.mintAddress} 
              className="border p-4 rounded hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => handleNFTClick(nft.mintAddress)}
            >
              {getImageFallback(nft)}
              <h2 className="text-xl font-semibold">{nft.title}</h2>
              
              {/* Collaborative Ownership Info */}
              {nft.isCollaborative && (
                <CollaborativeOwnership
                  collaborators={nft.collaborators}
                  isCollaborative={nft.isCollaborative}
                  totalStake={100}
                />
              )}

              <p>Likes: {nft.likes}</p>
              <p>Valuation: ${nft.valuation}</p>
              
              {nft.isForSale && (
                <p className="text-green-600 font-semibold">For Sale: {nft.price} SOL</p>
              )}

              <div className="flex space-x-2 mt-2">
                <button 
                  onClick={(e) => handleButtonClick(e, () => likeNFT(nft.mintAddress))} 
                  className="bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600 transition-colors"
                >
                  Like
                </button>
                
                {nft.isForSale && (
                  <button
                    onClick={(e) => handleButtonClick(e, () => buyNFT(nft))}
                    disabled={isBuying}
                    className="bg-green-500 text-white px-3 py-1 rounded text-sm hover:bg-green-600 disabled:opacity-50 transition-colors"
                  >
                    {isBuying ? 'Buying...' : 'Buy'}
                  </button>
                )}
                
                {isOwner(nft) && !nft.isForSale && (
                  <button
                    onClick={(e) => handleButtonClick(e, () => setSelectedNFT(nft))}
                    className="bg-purple-500 text-white px-3 py-1 rounded text-sm hover:bg-purple-600 transition-colors"
                  >
                    List for Sale
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {trendingNfts.length > 0 && (
        <>
          <h2 className="text-2xl font-bold mt-8 mb-4">Trending NFTs</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {trendingNfts.map(nft => (
              <div 
                key={nft.mintAddress} 
                className="border p-4 rounded hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => handleNFTClick(nft.mintAddress)}
              >
                {getImageFallback(nft)}
                <h2 className="text-xl font-semibold">{nft.title}</h2>
                <p>Likes: {nft.likes}</p>
                <p>Valuation: ${nft.valuation}</p>
                {nft.isForSale && (
                  <p className="text-green-600 font-semibold">For Sale: {nft.price} SOL</p>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export default Marketplace 
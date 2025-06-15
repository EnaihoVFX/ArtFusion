import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { useWallet } from '@solana/wallet-adapter-react'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import { participantManager } from '@/lib/participantManager'
import { turnManager } from '@/lib/turnManager'

interface FinalImage {
  image: string
  combinedPrompt: string
  winner: number
  votes: { [key: string]: number }
  completedAt: string
}

export default function ResultPage() {
  const router = useRouter()
  const { sessionId } = router.query
  const { publicKey, connected } = useWallet()
  const [participants, setParticipants] = useState<any[]>([])
  const [turnState, setTurnState] = useState<any>(null)
  const [finalImage, setFinalImage] = useState<FinalImage | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isMinting, setIsMinting] = useState(false)
  const [mintSuccess, setMintSuccess] = useState(false)
  const [nftId, setNftId] = useState<string>('')
  const [title, setTitle] = useState('')
  const [showTitleInput, setShowTitleInput] = useState(false)
  const [isHost, setIsHost] = useState(false)

  useEffect(() => {
    if (!sessionId || !publicKey) return

    const loadData = async () => {
      try {
        console.log('🔄 LOADING RESULT DATA:', {
          sessionId,
          userAddress: publicKey.toBase58().slice(0, 6) + '...',
          timestamp: new Date().toISOString()
        })

        // Load participants
        const participantsData = await participantManager.getParticipants(sessionId as string)
        setParticipants(participantsData)

        // Load turn state
        const turnStateData = await turnManager.getTurnState(sessionId as string)
        setTurnState(turnStateData)

        // Check if current user is the host
        const isHostUser = await participantManager.isHost(sessionId as string, publicKey.toBase58())
        setIsHost(isHostUser)

        // Fetch final winning image
        const voteResponse = await fetch(`/api/vote/${sessionId}`)
        if (voteResponse.ok) {
          const voteData = await voteResponse.json()
          if (voteData.success && voteData.finalImage) {
            setFinalImage(voteData.finalImage)
            console.log('✅ FINAL IMAGE LOADED:', {
              sessionId,
              winner: voteData.finalImage.winner,
              imageSize: voteData.finalImage.image?.length || 0
            })
          }
        }
        
        setIsLoading(false)
      } catch (error) {
        console.error('Error loading result data:', error)
        setIsLoading(false)
      }
    }

    loadData()

    // Don't remove participant on result page - we need them for minting
    // The cleanup will happen when user navigates away from the app
  }, [sessionId, publicKey])

  const handleMintNFT = async () => {
    if (!publicKey || !sessionId || !finalImage?.image) return

    const contributors = getContributorsForMinting()
    const collaboratorStakes = getCollaboratorStakes()
    
    console.log('🪙 MINTING NFT WITH CONTRIBUTORS:', {
      sessionId,
      userAddress: publicKey.toBase58().slice(0, 6) + '...',
      contributors: contributors.map((addr: string) => addr.slice(0, 6) + '...'),
      contributorCount: contributors.length,
      title: title || 'Collaborative Artwork',
      hasFinalImage: !!finalImage?.image,
      timestamp: new Date().toISOString()
    })

    try {
      setIsMinting(true)

      const response = await fetch('/api/mint-nft', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          address: publicKey.toBase58(),
          sessionId: sessionId,
          title: title || 'Collaborative Artwork',
          image: finalImage.image,
          isCollaborative: true,
          collaborators: collaboratorStakes
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to mint NFT')
      }

      setNftId(data.mintAddress)
      setMintSuccess(true)

      console.log('✅ NFT MINTED SUCCESSFULLY:', {
        sessionId,
        mintAddress: data.mintAddress,
        title: title || 'Collaborative Artwork'
      })

    } catch (error) {
      console.error('Error minting NFT:', error)
      alert('Failed to mint NFT. Please try again.')
    } finally {
      setIsMinting(false)
    }
  }

  const getCollaboratorCount = () => {
    // Use turn order from turn state to get actual contributors
    if (turnState?.turnOrder) {
      return turnState.turnOrder.length
    }
    return participants.length || 1 // Fallback to participants or 1
  }

  const getCollaboratorStakes = () => {
    // Use turn order to ensure we have the correct contributors
    const contributors = turnState?.turnOrder || participants.map((p: any) => p.address)
    const count = contributors.length
    
    if (count === 0) return []
    
    const equalStake = 100 / count
    return contributors.map((address: string) => ({
      address: address,
      stake: equalStake
    }))
  }

  const getContributorsForMinting = () => {
    // Use turn order to get the actual contributors who participated in the drawing
    if (turnState?.turnOrder) {
      return turnState.turnOrder
    }
    // Fallback to participants if turn order not available
    return participants.map((p: any) => p.address) || [publicKey?.toBase58()].filter(Boolean)
  }

  if (!connected) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">
            Please connect your wallet to view results
          </h1>
          <WalletMultiButton />
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading results...</p>
        </div>
      </div>
    )
  }

  if (!participants.length) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">
            Session not found
          </h1>
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      {/* Header */}
      <div className="bg-black bg-opacity-30 backdrop-blur-sm border-b border-white border-opacity-20">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold text-white">ArtFusion</h1>
              <div className="bg-white bg-opacity-20 rounded-full px-4 py-1">
                <span className="text-white text-sm">Session: {sessionId}</span>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <WalletMultiButton />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Success Message */}
        <div className="bg-white bg-opacity-10 backdrop-blur-sm rounded-lg p-8 mb-6 border border-white border-opacity-20">
          <div className="text-center">
            <div className="text-6xl mb-6">🎉</div>
            <h2 className="text-3xl font-bold text-white mb-4">Collaboration Complete!</h2>
            <p className="text-white text-opacity-80 text-lg">
              {getCollaboratorCount() === 1 
                ? 'Your artwork has been generated successfully!' 
                : 'Your collaborative artwork has been created successfully!'}
            </p>
          </div>
        </div>

        {/* Generated Artwork */}
        <div className="bg-white bg-opacity-10 backdrop-blur-sm rounded-lg p-6 mb-6 border border-white border-opacity-20">
          <h3 className="text-xl font-bold text-white mb-4">Final Artwork</h3>
          <div className="text-center">
            {finalImage ? (
              <img
                src={finalImage.image}
                alt="Generated collaborative artwork"
                className="w-full max-w-md mx-auto rounded-lg shadow-lg"
              />
            ) : (
              <div className="w-full max-w-md mx-auto h-64 bg-white bg-opacity-20 rounded-lg flex items-center justify-center">
                <p className="text-white text-opacity-60">Generated artwork will appear here</p>
              </div>
            )}
          </div>
        </div>

        {/* Collaboration Info */}
        <div className="bg-white bg-opacity-10 backdrop-blur-sm rounded-lg p-6 mb-6 border border-white border-opacity-20">
          <h3 className="text-xl font-bold text-white mb-4">Collaboration Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="text-lg font-semibold text-white mb-3">Contributors</h4>
              <div className="space-y-2">
                {getContributorsForMinting().map((address: string, index: number) => (
                  <div key={address} className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className={`text-white ${
                        address === publicKey?.toBase58() ? 'font-bold' : 'text-opacity-80'
                      }`}>
                        {address === publicKey?.toBase58() ? 'You' : `Artist ${index + 1}`}
                      </span>
                      {participants.find((p: any) => p.address === address && p.isHost) && (
                        <span className="bg-yellow-500 text-black text-xs px-2 py-1 rounded-full font-semibold">
                          Host
                        </span>
                      )}
                    </div>
                    <span className="text-white text-opacity-60 text-sm">
                      {address.slice(0, 6)}...{address.slice(-4)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h4 className="text-lg font-semibold text-white mb-3">Ownership Stakes</h4>
              <div className="space-y-2">
                {getCollaboratorStakes().map((collaborator: any, index: number) => (
                  <div key={collaborator.address} className="flex items-center justify-between">
                    <span className={`text-white ${
                      collaborator.address === publicKey?.toBase58() ? 'font-bold' : 'text-opacity-80'
                    }`}>
                      {collaborator.address === publicKey?.toBase58() ? 'You' : `Artist ${index + 1}`}
                    </span>
                    <span className="text-white text-opacity-60">
                      {collaborator.stake.toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Combined Prompts */}
        {finalImage?.combinedPrompt && (
          <div className="bg-white bg-opacity-10 backdrop-blur-sm rounded-lg p-6 mb-6 border border-white border-opacity-20">
            <h3 className="text-xl font-bold text-white mb-4">Combined Prompts</h3>
            <p className="text-white text-opacity-80 italic">
              "{finalImage.combinedPrompt}"
            </p>
          </div>
        )}

        {/* Minting Section - Only for Host */}
        {isHost && !mintSuccess ? (
          <div className="bg-white bg-opacity-10 backdrop-blur-sm rounded-lg p-6 border border-white border-opacity-20">
            <h3 className="text-xl font-bold text-white mb-4">Mint as NFT (Host Only)</h3>
            
            {!showTitleInput ? (
              <div className="text-center">
                <p className="text-white text-opacity-80 mb-6">
                  As the host, you can mint this collaborative artwork as an NFT. All contributors will receive equal ownership.
                </p>
                <button
                  onClick={() => setShowTitleInput(true)}
                  className="px-8 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all duration-200 font-semibold shadow-lg"
                >
                  Mint NFT
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-white font-medium mb-2">
                    NFT Title
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Enter a title for your NFT..."
                    className="w-full px-4 py-3 bg-white bg-opacity-10 border border-white border-opacity-30 rounded-lg text-white placeholder-white placeholder-opacity-50 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
                <div className="flex space-x-4">
                  <button
                    onClick={() => setShowTitleInput(false)}
                    className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleMintNFT}
                    disabled={!title.trim() || isMinting}
                    className="px-8 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:from-green-700 hover:to-emerald-700 disabled:from-gray-500 disabled:to-gray-500 disabled:cursor-not-allowed transition-all duration-200 font-semibold shadow-lg"
                  >
                    {isMinting ? 'Minting...' : 'Mint NFT'}
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : !isHost ? (
          <div className="bg-white bg-opacity-10 backdrop-blur-sm rounded-lg p-6 border border-white border-opacity-20">
            <div className="text-center">
              <h3 className="text-xl font-bold text-white mb-4">NFT Minting</h3>
              <p className="text-white text-opacity-80 mb-4">
                The host will mint this collaborative artwork as an NFT. All contributors will receive equal ownership.
              </p>
              <div className="bg-white bg-opacity-20 rounded-lg p-4">
                <p className="text-white text-sm">
                  <span className="font-semibold">Host:</span> {participants.find((p: any) => p.isHost)?.address?.slice(0, 6) + '...' || 'Unknown'}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white bg-opacity-10 backdrop-blur-sm rounded-lg p-6 border border-white border-opacity-20">
            <div className="text-center">
              <div className="text-6xl mb-4">🎉</div>
              <h3 className="text-2xl font-bold text-white mb-4">NFT Minted Successfully!</h3>
              <p className="text-white text-opacity-80 mb-6">
                Your collaborative artwork has been minted as an NFT with ID: {nftId}
              </p>
              <div className="space-x-4">
                <button
                  onClick={() => router.push(`/nft/${nftId}`)}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  View NFT
                </button>
                <button
                  onClick={() => router.push('/marketplace')}
                  className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                >
                  Go to Marketplace
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="mt-8 text-center">
          <button
            onClick={() => router.push('/')}
            className="px-6 py-3 bg-white bg-opacity-20 text-white rounded-lg hover:bg-opacity-30 transition-colors"
          >
            Create New Session
          </button>
        </div>
      </div>
    </div>
  )
} 
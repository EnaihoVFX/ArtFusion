import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { useWallet } from '@solana/wallet-adapter-react'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import { participantManager } from '@/lib/participantManager'
import { turnManager } from '@/lib/turnManager'

export default function WaitingRoom() {
  const router = useRouter()
  const { sessionId } = router.query
  const { connected, publicKey } = useWallet()
  const [participants, setParticipants] = useState<any[]>([])
  const [turnState, setTurnState] = useState<any>(null)
  const [currentArtist, setCurrentArtist] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedImages, setGeneratedImages] = useState<string[]>([])
  const [showVoting, setShowVoting] = useState(false)
  const [votingTimeLeft, setVotingTimeLeft] = useState(10) // 10 seconds voting timer
  const [votingComplete, setVotingComplete] = useState(false)
  const [generationTriggered, setGenerationTriggered] = useState(false)
  const [generationBlocked, setGenerationBlocked] = useState(false)
  const [hasVoted, setHasVoted] = useState(false)

  useEffect(() => {
    if (!sessionId) return

    const loadData = async () => {
      try {
        console.log('🔄 LOADING WAITING ROOM DATA:', {
          sessionId,
          userAddress: publicKey?.toBase58().slice(0, 6) + '...',
          timestamp: new Date().toISOString()
        })

        // Load participants
        const participantsData = await participantManager.getParticipants(sessionId as string)
        setParticipants(participantsData)

        // Load turn state
        const turnStateData = await turnManager.getTurnState(sessionId as string)
        setTurnState(turnStateData)

        if (turnStateData) {
          setCurrentArtist(turnStateData.turnOrder?.[turnStateData.currentTurn] || null)
          setIsGenerating(turnStateData.isGenerating)

          console.log('📊 WAITING ROOM DATA LOADED:', {
            sessionId,
            userAddress: publicKey?.toBase58().slice(0, 6) + '...',
            sessionPhase: turnStateData.sessionPhase,
            currentTurn: turnStateData.currentTurn,
            currentArtist: turnStateData.turnOrder?.[turnStateData.currentTurn]?.slice(0, 6) + '...',
            isGenerating: turnStateData.isGenerating,
            participantCount: participantsData.length,
            timestamp: new Date().toISOString()
          })

          // Handle phase transitions
          if (turnStateData.sessionPhase === 'generating' && turnStateData.isGenerating) {
            console.log('🤖 GENERATING PHASE DETECTED - STARTING GENERATION')
            handleGenerateCollaborativeArtwork()
          } else if (turnStateData.sessionPhase === 'voting') {
            console.log('🗳️ VOTING PHASE DETECTED - SHOWING VOTING')
            // Try to fetch existing generated images first
            const imagesFound = await fetchGeneratedImages()
            
            if (!imagesFound && !generationTriggered && !generationBlocked) {
              console.log('⚠️ NO GENERATED IMAGES FOUND - GENERATING NOW')
              setGenerationTriggered(true)
              handleGenerateCollaborativeArtwork()
            } else if (generatedImages.length > 0) {
              setShowVoting(true)
              setVotingTimeLeft(10) // Reset timer
            }
          } else if (turnStateData.sessionPhase === 'complete') {
            console.log('✅ SESSION COMPLETE - REDIRECTING TO RESULT')
            setTimeout(() => {
              router.push(`/game/${sessionId}/result`)
            }, 1000)
          } else if (turnStateData.sessionPhase === 'drawing') {
            // Check if user is current artist
            const isCurrentArtist = turnStateData.turnOrder?.[turnStateData.currentTurn] === publicKey?.toBase58()
            if (isCurrentArtist) {
              console.log('🎨 USER IS CURRENT ARTIST - REDIRECTING TO MAIN GAME')
              setTimeout(() => {
                router.push(`/game/${sessionId}`)
              }, 1000)
            }
          }
        }
      } catch (error) {
        console.error('Error loading waiting room data:', error)
      }
    }

    // Load initially
    loadData()

    // Set up polling
    const interval = setInterval(loadData, 2000)

    return () => clearInterval(interval)
  }, [sessionId, publicKey, router])

  // Add participant when wallet connects
  useEffect(() => {
    if (!sessionId || !publicKey) return

    const addParticipant = async () => {
      await participantManager.addParticipant(sessionId as string, publicKey.toBase58())
    }

    addParticipant()
  }, [sessionId, publicKey])

  // Remove participant when component unmounts (only if session is ending)
  useEffect(() => {
    return () => {
      if (sessionId && publicKey) {
        // Add a small delay to allow navigation to complete
        setTimeout(() => {
          // Only remove participant if we're leaving the app entirely, not navigating to other pages
          // Check if we're navigating to another page in the same session
          const currentPath = window.location.pathname
          const isNavigatingToSessionPage = currentPath.includes(`/game/${sessionId}`)
          const isNavigatingToResultPage = currentPath.includes(`/game/${sessionId}/result`)
          const isNavigatingToWaitingPage = currentPath.includes(`/game/${sessionId}/waiting`)
          
          console.log('🧹 CLEANUP CHECK (WAITING):', {
            sessionId,
            address: publicKey.toBase58().slice(0, 6) + '...',
            currentPath,
            isNavigatingToSessionPage,
            isNavigatingToResultPage,
            isNavigatingToWaitingPage,
            shouldRemove: !isNavigatingToSessionPage && !isNavigatingToResultPage && !isNavigatingToWaitingPage,
            timestamp: new Date().toISOString()
          })
          
          if (!isNavigatingToSessionPage && !isNavigatingToResultPage && !isNavigatingToWaitingPage) {
            console.log('🧹 COMPONENT UNMOUNTING - REMOVING PARTICIPANT')
            participantManager.removeParticipant(sessionId as string, publicKey.toBase58())
          } else {
            console.log('🔄 NAVIGATING TO ANOTHER SESSION PAGE - KEEPING PARTICIPANT')
          }
        }, 100) // Small delay to allow navigation to complete
      }
    }
  }, [sessionId, publicKey])

  // Voting timer effect
  useEffect(() => {
    if (!showVoting || votingComplete || votingTimeLeft <= 0 || hasVoted) return

    const timer = setInterval(() => {
      setVotingTimeLeft((prev) => {
        if (prev <= 1) {
          // Time's up - auto-submit a random vote
          console.log('⏰ VOTING TIME EXPIRED - AUTO-SUBMITTING RANDOM VOTE')
          const randomImageIndex = Math.floor(Math.random() * generatedImages.length)
          handleVote(randomImageIndex)
          setVotingComplete(true)
          setHasVoted(true)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [showVoting, votingComplete, votingTimeLeft, generatedImages.length, hasVoted])

  const handleGenerateCollaborativeArtwork = async () => {
    if (!publicKey || isGenerating || generationTriggered) {
      console.log('🚫 GENERATION BLOCKED:', {
        hasPublicKey: !!publicKey,
        isGenerating,
        generationTriggered,
        timestamp: new Date().toISOString()
      })
      return
    }

    try {
      setIsGenerating(true)
      setGenerationTriggered(true)
      console.log('🎨 STARTING COLLABORATIVE ARTWORK GENERATION (WAITING ROOM)')

      // Call the real generation API
      const response = await fetch('/api/generate/collaborative', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sessionId }),
      })

      if (response.status === 409) {
        console.log('🔄 GENERATION ALREADY IN PROGRESS - WAITING...')
        // Reset trigger flag and wait for the other generation to complete
        setGenerationTriggered(false)
        setIsGenerating(false)
        setGenerationBlocked(true) // Stop trying to generate
        return
      }

      if (!response.ok) {
        throw new Error('Failed to generate artwork')
      }

      const result = await response.json()
      
      if (result.success) {
        console.log('✅ GENERATION SUCCESSFUL - FETCHING IMAGES FROM REDIS')
        
        // Fetch the generated images from Redis (they were stored there)
        const imagesFound = await fetchGeneratedImages()
        
        if (imagesFound) {
          // Update turn state to voting phase
          await turnManager.updateTurnState(sessionId as string, { 
            sessionPhase: 'voting',
            isGenerating: false 
          })

          console.log('✅ GENERATION COMPLETE - MOVED TO VOTING PHASE')
        } else {
          throw new Error('Failed to fetch generated images from Redis')
        }
      } else {
        throw new Error(result.error || 'Generation failed')
      }

    } catch (error) {
      console.error('Error generating collaborative artwork:', error)
      setGenerationTriggered(false)
      await turnManager.updateTurnState(sessionId as string, { 
        sessionPhase: 'drawing',
        isGenerating: false 
      })
    } finally {
      setIsGenerating(false)
    }
  }

  const handleVote = async (imageIndex: number) => {
    if (!publicKey || hasVoted) return

    try {
      setHasVoted(true) // Prevent multiple votes
      console.log('🗳️ SUBMITTING VOTE:', {
        sessionId,
        userAddress: publicKey.toBase58().slice(0, 6) + '...',
        imageIndex,
        timestamp: new Date().toISOString()
      })

      const response = await fetch(`/api/vote/${sessionId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageIndex,
          voterAddress: publicKey.toBase58()
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to submit vote')
      }

      const result = await response.json()
      
      if (result.success) {
        console.log('✅ VOTE SUBMITTED:', {
          message: result.message,
          votes: result.votes,
          winner: result.winner
        })

        if (result.winner !== undefined) {
          console.log('🏆 VOTING COMPLETE - WINNER SELECTED:', result.winner)
          
          // Move to complete phase
          await turnManager.updateTurnState(sessionId as string, { 
            sessionPhase: 'complete',
            isGenerating: false 
          })
          
          // Redirect to result page
          setTimeout(() => {
            router.push(`/game/${sessionId}/result`)
          }, 2000)
        }
      } else {
        throw new Error(result.error || 'Vote submission failed')
      }

    } catch (error) {
      console.error('Error submitting vote:', error)
      setHasVoted(false) // Reset on error so user can try again
    }
  }

  const handleTitleSubmit = async (title: string) => {
    console.log('Title submitted:', title)
    
    // Update session state to complete
    await turnManager.updateTurnState(sessionId as string, { 
      sessionPhase: 'complete',
      isGenerating: false 
    })
    
    // Redirect to result page
    router.push(`/game/${sessionId}/result`)
  }

  // Function to fetch generated images from Redis
  const fetchGeneratedImages = async () => {
    try {
      console.log('🖼️ FETCHING GENERATED IMAGES FROM REDIS:', {
        sessionId,
        timestamp: new Date().toISOString()
      })

      const response = await fetch(`/api/generate/collaborative?sessionId=${sessionId}`)
      
      if (response.ok) {
        const result = await response.json()
        if (result.success && result.images) {
          console.log('✅ GENERATED IMAGES FETCHED:', {
            imageCount: result.images.length,
            combinedPrompt: result.combinedPrompt?.slice(0, 100) + '...'
          })
          setGeneratedImages(result.images)
          setShowVoting(true)
          setVotingTimeLeft(10) // Reset timer
          return true
        }
      }
      
      return false
    } catch (error) {
      console.error('Error fetching generated images:', error)
      return false
    }
  }

  if (!connected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-center text-white">
          <h1 className="text-4xl font-bold mb-4">ArtFusion</h1>
          <p className="text-xl mb-8">Connect your wallet to join the waiting room</p>
          <WalletMultiButton />
        </div>
      </div>
    )
  }

  if (!sessionId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-center text-white">
          <h1 className="text-4xl font-bold mb-4">Invalid Session</h1>
          <p className="text-xl mb-8">No session ID found.</p>
          <button
            onClick={() => router.push('/')}
            className="bg-white text-purple-900 px-8 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
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
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold text-white">ArtFusion</h1>
              <div className="bg-white bg-opacity-20 rounded-full px-4 py-1">
                <span className="text-white text-sm">Session: {sessionId}</span>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="bg-white bg-opacity-20 rounded-full px-4 py-1">
                <span className="text-white text-sm">
                  {participants.length} Collaborators
                </span>
              </div>
              <WalletMultiButton />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Phase Indicator */}
        {turnState && (
          <div className="mb-8">
            <div className="bg-white bg-opacity-10 backdrop-blur-sm rounded-lg p-6 border border-white border-opacity-20">
              <div className="text-center">
                <h2 className="text-2xl font-bold text-white mb-4">
                  {turnState.sessionPhase === 'drawing' && 'Waiting Room'}
                  {turnState.sessionPhase === 'generating' && 'Generating Collaborative Artwork'}
                  {turnState.sessionPhase === 'voting' && 'Voting Phase'}
                  {turnState.sessionPhase === 'complete' && 'Complete'}
                </h2>
                <p className="text-white text-opacity-80 text-lg">
                  {turnState.sessionPhase === 'drawing' && 'Waiting for the current artist to finish...'}
                  {turnState.sessionPhase === 'generating' && 'Combining everyone\'s contributions into a beautiful artwork...'}
                  {turnState.sessionPhase === 'voting' && 'Choose your favorite collaborative artwork'}
                  {turnState.sessionPhase === 'complete' && 'Collaboration finished!'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Current Status - Only show during drawing phase */}
        {turnState?.sessionPhase === 'drawing' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {/* Live Canvas Preview */}
            <div className="bg-white bg-opacity-10 backdrop-blur-sm rounded-lg p-6 border border-white border-opacity-20">
              <h3 className="text-lg font-semibold text-white mb-4">Live Canvas Preview</h3>
              <div className="aspect-square bg-white rounded-lg p-2 mb-4">
                <div className="w-full h-full bg-gray-100 rounded-lg flex items-center justify-center">
                  <p className="text-gray-500 text-center">
                    Live preview will appear here
                  </p>
                </div>
              </div>
              <p className="text-white text-opacity-60 text-sm text-center">
                Real-time preview of the collaborative artwork
              </p>
            </div>

            {/* Current Artist */}
            <div className="bg-white bg-opacity-10 backdrop-blur-sm rounded-lg p-6 border border-white border-opacity-20">
              <h3 className="text-lg font-semibold text-white mb-4">Current Artist</h3>
              {currentArtist ? (
                <div className="text-center">
                  <div className="w-16 h-16 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-white font-bold text-xl">
                      {currentArtist === publicKey?.toBase58() ? 'You' : '👨‍🎨'}
                    </span>
                  </div>
                  <p className="text-white text-lg font-semibold">
                    {currentArtist === publicKey?.toBase58() 
                      ? 'It\'s your turn!' 
                      : `${currentArtist.slice(0, 6)}... is drawing`}
                  </p>
                  <p className="text-white text-opacity-60 text-sm mt-2">
                    Turn {turnState?.currentTurn + 1} of {turnState?.turnOrder?.length || 0}
                  </p>
                </div>
              ) : (
                <div className="text-center text-white text-opacity-60">
                  <p>No current artist</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Participants - Show in all phases but with different styling */}
        <div className="bg-white bg-opacity-10 backdrop-blur-sm rounded-lg p-6 border border-white border-opacity-20 mb-8">
          <h3 className="text-lg font-semibold text-white mb-4">
            {turnState?.sessionPhase === 'drawing' && 'Collaborators'}
            {turnState?.sessionPhase === 'generating' && 'Collaborators - Generating'}
            {turnState?.sessionPhase === 'voting' && 'Collaborators - Voting'}
            {turnState?.sessionPhase === 'complete' && 'Collaborators - Complete'}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {participants.map((participant: any, index: number) => (
              <div key={participant.address} className="bg-white bg-opacity-20 rounded-lg p-4">
                <div className="flex items-center space-x-3">
                  <div className={`w-3 h-3 rounded-full ${
                    turnState?.sessionPhase === 'drawing' && participant.address === currentArtist 
                      ? 'bg-green-400 animate-pulse' 
                      : turnState?.sessionPhase === 'generating'
                      ? 'bg-yellow-400 animate-pulse'
                      : turnState?.sessionPhase === 'voting'
                      ? 'bg-blue-400 animate-pulse'
                      : 'bg-gray-400'
                  }`}></div>
                  <div>
                    <p className={`font-semibold ${
                      participant.address === publicKey?.toBase58() 
                        ? 'text-white' 
                        : 'text-white text-opacity-80'
                    }`}>
                      {participant.address === publicKey?.toBase58() 
                        ? 'You' 
                        : `Collaborator ${index + 1}`}
                    </p>
                    <p className="text-white text-opacity-60 text-sm">
                      {participant.address.slice(0, 6)}...
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Loading State */}
        {isGenerating && (
          <div className="bg-white bg-opacity-10 backdrop-blur-sm rounded-lg p-8 border border-white border-opacity-20 text-center">
            <div className="w-16 h-16 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <h3 className="text-xl font-semibold text-white mb-2">Generating Collaborative Artwork</h3>
            <p className="text-white text-opacity-80">Combining everyone's contributions...</p>
            <div className="mt-4 flex justify-center space-x-2">
              <div className="w-2 h-2 bg-white rounded-full animate-bounce"></div>
              <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
              <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
            </div>
          </div>
        )}

        {/* Voting Section */}
        {showVoting && generatedImages.length > 0 && (
          <div className="bg-white bg-opacity-10 backdrop-blur-sm rounded-lg p-6 border border-white border-opacity-20">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-white mb-4">Vote for the Final Collaborative Artwork</h2>
              <p className="text-white text-opacity-80 mb-4">
                Multiple versions were generated from your collaborative work. Vote for your favorite!
              </p>
              
              {/* Voting Timer */}
              <div className="bg-white bg-opacity-20 rounded-lg p-4 mb-4">
                <div className="flex items-center justify-center space-x-2">
                  <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-white font-semibold text-lg">
                    Time remaining: {votingTimeLeft}s
                  </span>
                </div>
                <div className="w-full bg-white bg-opacity-20 rounded-full h-2 mt-2">
                  <div 
                    className="bg-gradient-to-r from-green-400 to-red-400 h-2 rounded-full transition-all duration-1000"
                    style={{ width: `${(votingTimeLeft / 10) * 100}%` }}
                  ></div>
                </div>
                {votingTimeLeft <= 3 && (
                  <p className="text-red-300 text-sm mt-2 animate-pulse">
                    ⚠️ Time running out! Vote now or a random choice will be made.
                  </p>
                )}
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {generatedImages.map((image, index) => (
                <div key={index} className="bg-white rounded-lg p-4 text-center">
                  <div className="aspect-square bg-gray-100 rounded-lg mb-4 flex items-center justify-center">
                    <img 
                      src={image} 
                      alt={`Option ${index + 1}`}
                      className="w-full h-full object-contain rounded-lg"
                    />
                  </div>
                  <button
                    onClick={() => handleVote(index)}
                    disabled={hasVoted || votingComplete}
                    className={`w-full px-4 py-2 rounded-lg font-semibold transition-colors ${
                      hasVoted || votingComplete
                        ? 'bg-gray-500 text-gray-300 cursor-not-allowed'
                        : 'bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600'
                    }`}
                  >
                    {hasVoted ? 'Vote Submitted' : votingComplete ? 'Voting Complete' : `Vote for Option ${index + 1}`}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Debug Info */}
        <div className="bg-white rounded-lg shadow-xl p-6 mt-8">
          <h3 className="text-lg font-semibold mb-4 text-gray-800">Debug Info (Waiting Room)</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <p><strong>Session ID:</strong> {sessionId}</p>
              <p><strong>Phase:</strong> {turnState?.sessionPhase || 'loading'}</p>
              <p><strong>Current Turn:</strong> {turnState?.currentTurn ?? 'loading'}</p>
              <p><strong>Participants:</strong> {participants.length}</p>
            </div>
            <div>
              <p><strong>Your Address:</strong> {publicKey?.toBase58().slice(0, 6)}...</p>
              <p><strong>Current Artist:</strong> {currentArtist?.slice(0, 6) || 'none'}...</p>
              <p><strong>Is Generating:</strong> {isGenerating ? 'Yes' : 'No'}</p>
              <p><strong>Show Voting:</strong> {showVoting ? 'Yes' : 'No'}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 
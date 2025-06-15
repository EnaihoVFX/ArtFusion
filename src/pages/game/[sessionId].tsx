import React, { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/router'
import { useWallet } from '@solana/wallet-adapter-react'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import CollaborativeCanvas from '../../components/CollaborativeCanvas'
import ImageVoting from '../../components/ImageVoting'
import GameLobby from '../../components/GameLobby'
import TestHelper from '../../components/TestHelper'
import { participantManager } from '@/lib/participantManager'
import { turnManager } from '@/lib/turnManager'

export default function GameSession() {
  const router = useRouter()
  const { sessionId } = router.query
  const { connected, publicKey } = useWallet()
  const [isHost, setIsHost] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)
  const [participants, setParticipants] = useState<any[]>([])
  const [turnState, setTurnState] = useState<any>(null)
  const [generatedImages, setGeneratedImages] = useState<string[]>([])
  const [showVoting, setShowVoting] = useState(false)
  const [votingComplete, setVotingComplete] = useState(false)
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [generationTriggered, setGenerationTriggered] = useState(false)
  const [generationBlocked, setGenerationBlocked] = useState(false)
  const [hasVoted, setHasVoted] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!sessionId) {
      console.log('No session ID found')
      return
    }

    setIsLoading(false)
  }, [sessionId])

  // Load participants and turn state
  useEffect(() => {
    if (!sessionId) return

    const loadData = async () => {
      console.log('🔄 LOADING SEPARATED DATA:', {
        sessionId,
        userAddress: publicKey?.toBase58().slice(0, 6) + '...',
        timestamp: new Date().toISOString()
      })
      
      try {
        // Load participants separately
        const participantsData = await participantManager.getParticipants(sessionId as string)
        setParticipants(participantsData)
        
        // Load turn state separately
        const turnStateData = await turnManager.getTurnState(sessionId as string)
        setTurnState(turnStateData)
        
        console.log('📊 SEPARATED DATA LOADED:', {
          sessionId,
          userAddress: publicKey?.toBase58().slice(0, 6) + '...',
          participants: participantsData.map((p: any, i: number) => ({
            index: i,
            address: p.address.slice(0, 6) + '...',
            isActive: p.isActive
          })),
          participantCount: participantsData.length,
          turnState: turnStateData ? {
            currentTurn: turnStateData.currentTurn,
            sessionPhase: turnStateData.sessionPhase,
            turnOrder: turnStateData.turnOrder?.map((addr: string) => addr.slice(0, 6) + '...') || []
          } : null,
          timestamp: new Date().toISOString()
        })
        
        // Set generating state from turn state
        if (turnStateData) {
          setIsGenerating(turnStateData.isGenerating)
        }
      } catch (error) {
        console.error('Error loading separated data:', error)
      }
    }

    // Load initially
    loadData()

    // Set up polling (every 2 seconds)
    const interval = setInterval(loadData, 2000)

    return () => clearInterval(interval)
  }, [sessionId, publicKey])

  // Add participant when wallet connects
  useEffect(() => {
    if (!sessionId || !publicKey) return

    const addParticipant = async () => {
      console.log('Adding participant with new system:', {
        sessionId,
        address: publicKey.toBase58()
      })
      
      // Add participant using participantManager
      await participantManager.addParticipant(sessionId as string, publicKey.toBase58())
      
      // Check if this user is the host
      const isHostUser = await participantManager.isHost(sessionId as string, publicKey.toBase58())
      setIsHost(isHostUser)
      
      console.log('After adding participant:', {
        isHost: isHostUser,
        address: publicKey.toBase58().slice(0, 6) + '...'
      })
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
          
          console.log('🧹 CLEANUP CHECK:', {
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

  // Handle generation completion
  useEffect(() => {
    if (turnState?.sessionPhase === 'generating' && turnState?.isGenerating) {
      handleGenerateCollaborativeArtwork()
    }
  }, [turnState?.sessionPhase, turnState?.isGenerating])

  // Handle voting phase - ensure we have generated images
  useEffect(() => {
    if (turnState?.sessionPhase === 'voting' && (!generatedImages || generatedImages.length === 0) && !generationTriggered && !generationBlocked) {
      console.log('🗳️ VOTING PHASE DETECTED - FETCHING IMAGES FROM REDIS')
      
      // Try to fetch existing generated images first
      fetchGeneratedImages().then((imagesFound) => {
        if (!imagesFound) {
          console.log('⚠️ NO GENERATED IMAGES FOUND - GENERATING NOW')
          setGenerationTriggered(true)
          handleGenerateCollaborativeArtwork()
        }
      })
    }
  }, [turnState?.sessionPhase, generatedImages, generationTriggered, generationBlocked])

  // Redirect to waiting room if not current artist
  useEffect(() => {
    if (!turnState || !publicKey || !sessionId) return

    console.log('🔄 CHECKING REDIRECT CONDITIONS:', {
      sessionPhase: turnState.sessionPhase,
      currentTurn: turnState.currentTurn,
      userAddress: publicKey.toBase58().slice(0, 6) + '...',
      sessionId: sessionId,
      participants: participants.length,
      currentArtist: turnState.turnOrder?.[turnState.currentTurn],
      isCurrentArtist: turnState.turnOrder?.[turnState.currentTurn] === publicKey.toBase58()
    })

    if (turnState.sessionPhase === 'drawing') {
      const isCurrentArtist = turnState.turnOrder?.[turnState.currentTurn] === publicKey.toBase58()
      
      console.log('🎨 DRAWING PHASE REDIRECT CHECK:', {
        isCurrentArtist,
        shouldRedirect: !isCurrentArtist
      })
      
      // Redirect if user is not the current artist
      if (!isCurrentArtist) {
        console.log('🚀 REDIRECTING TO WAITING ROOM...')
        setTimeout(() => {
          try {
            router.push(`/game/${sessionId}/waiting`)
          } catch (error) {
            console.log('Router failed, using window.location')
            window.location.href = `/game/${sessionId}/waiting`
          }
        }, 100)
      } else {
        console.log('✅ CURRENT ARTIST - STAYING ON MAIN GAME PAGE')
      }
    } else if (turnState.sessionPhase === 'generating') {
      // If session moved to generating phase, redirect to waiting room
      console.log('🤖 SESSION MOVED TO GENERATING PHASE - REDIRECTING TO WAITING ROOM...')
      setTimeout(() => {
        try {
          router.push(`/game/${sessionId}/waiting`)
        } catch (error) {
          console.log('Router failed, using window.location')
          window.location.href = `/game/${sessionId}/waiting`
        }
      }, 100)
    } else if (turnState.sessionPhase === 'voting') {
      // If session moved to voting phase, stay on main page for voting
      console.log('🗳️ VOTING PHASE - STAYING ON MAIN PAGE')
    } else if (turnState.sessionPhase === 'complete') {
      // If session is complete, redirect to result page
      console.log('✅ SESSION COMPLETE - REDIRECTING TO RESULT PAGE...')
      setTimeout(() => {
        try {
          router.push(`/game/${sessionId}/result`)
        } catch (error) {
          console.log('Router failed, using window.location')
          window.location.href = `/game/${sessionId}/result`
        }
      }, 100)
    }
  }, [turnState, participants, publicKey, sessionId, router])

  // Handle game start from lobby
  const handleGameStart = async () => {
    console.log('🎮 GAME STARTED FROM LOBBY')
    
    try {
      // Get participant addresses
      const participantAddresses = await participantManager.getParticipantAddresses(sessionId as string)
      
      // Initialize turn state with participants
      await turnManager.initializeTurnState(sessionId as string, participantAddresses)
      
      console.log('✅ TURN STATE INITIALIZED FOR GAME START')
    } catch (error) {
      console.error('Error starting game:', error)
    }
  }

  const handleGenerateCollaborativeArtwork = async () => {
    if (!publicKey || isGenerating || generationTriggered) {
      console.log('🚫 GENERATION BLOCKED (MAIN GAME):', {
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
      console.log('🎨 STARTING COLLABORATIVE ARTWORK GENERATION (MAIN GAME)')

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
      
      if (result.success && result.images) {
        console.log('✅ GENERATION SUCCESSFUL:', {
          imageCount: result.images.length,
          combinedPrompt: result.combinedPrompt?.slice(0, 100) + '...'
        })

        // Store images and show voting
        setGeneratedImages(result.images)
        setShowVoting(true)
        setGenerationTriggered(false)
        
        // Move to voting phase
        await turnManager.updateTurnState(sessionId as string, { 
          sessionPhase: 'voting',
          isGenerating: false 
        })
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

  const handleDrawingComplete = async (imageData: string) => {
    console.log('Drawing completed:', imageData)
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

        setSelectedImage(generatedImages[imageIndex])

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
      console.log('🖼️ FETCHING GENERATED IMAGES FROM REDIS (MAIN GAME):', {
        sessionId,
        timestamp: new Date().toISOString()
      })

      const response = await fetch(`/api/generate/collaborative?sessionId=${sessionId}`)
      
      if (response.ok) {
        const result = await response.json()
        if (result.success && result.images) {
          console.log('✅ GENERATED IMAGES FETCHED (MAIN GAME):', {
            imageCount: result.images.length,
            combinedPrompt: result.combinedPrompt?.slice(0, 100) + '...'
          })
          setGeneratedImages(result.images)
          setShowVoting(true)
          return true
        }
      }
      
      return false
    } catch (error) {
      console.error('Error fetching generated images:', error)
      return false
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-center text-white">
          <div className="w-16 h-16 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-xl">Loading session...</p>
        </div>
      </div>
    )
  }

  if (!connected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-center text-white">
          <h1 className="text-4xl font-bold mb-4">ArtFusion</h1>
          <p className="text-xl mb-8">Connect your wallet to start collaborating</p>
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
          <p className="text-xl mb-8">No session ID found. Please create or join a valid session.</p>
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

  // Show lobby if no turn state exists (game hasn't started)
  if (!turnState) {
    return (
      <GameLobby 
        sessionId={sessionId as string} 
        onGameStart={handleGameStart}
        participants={participants}
        isHost={isHost}
      />
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
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Phase Indicator */}
        {turnState && (
          <div className="mb-8">
            <div className="bg-white bg-opacity-10 backdrop-blur-sm rounded-lg p-4 border border-white border-opacity-20">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-white mb-2">
                    {turnState.sessionPhase === 'lobby' && 'Game Lobby'}
                    {turnState.sessionPhase === 'drawing' && 'Collaborative Drawing Phase'}
                    {turnState.sessionPhase === 'generating' && 'Generating Collaborative Artwork'}
                    {turnState.sessionPhase === 'voting' && 'Voting Phase'}
                    {turnState.sessionPhase === 'complete' && 'Complete'}
                  </h2>
                  <p className="text-white text-opacity-80">
                    {turnState.sessionPhase === 'lobby' && 'Waiting for players to join...'}
                    {turnState.sessionPhase === 'drawing' && `Turn ${turnState.currentTurn + 1} of ${turnState.turnOrder?.length || 0}`}
                    {turnState.sessionPhase === 'generating' && 'Combining everyone\'s contributions...'}
                    {turnState.sessionPhase === 'voting' && 'Choose your favorite collaborative artwork'}
                    {turnState.sessionPhase === 'complete' && 'Collaboration finished!'}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-white text-opacity-60 text-sm">
                    {turnState.turnOrder?.length || 0} participants
                  </div>
                  <div className="w-32 h-2 bg-white bg-opacity-20 rounded-full mt-2">
                    <div 
                      className="h-2 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full transition-all duration-500"
                      style={{ 
                        width: `${((turnState.currentTurn + 1) / (turnState.turnOrder?.length || 1)) * 100}%` 
                      }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Canvas Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Canvas Area */}
          <div className="lg:col-span-2">
            <div className="bg-white bg-opacity-10 backdrop-blur-sm rounded-lg p-6 border border-white border-opacity-20">
              <CollaborativeCanvas 
                sessionId={sessionId as string}
                onDrawingComplete={handleDrawingComplete}
                isGenerating={isGenerating}
              />
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Current Artist */}
            {turnState?.sessionPhase === 'drawing' && (
              <div className="bg-white bg-opacity-10 backdrop-blur-sm rounded-lg p-4 border border-white border-opacity-20">
                <h3 className="text-lg font-semibold text-white mb-3">Current Artist</h3>
                <div className="flex items-center space-x-3">
                  <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                  <span className="text-white">
                    {turnState.turnOrder?.[turnState.currentTurn] === publicKey?.toBase58() 
                      ? 'You' 
                      : turnState.turnOrder?.[turnState.currentTurn]?.slice(0, 6) + '...'}
                  </span>
                </div>
              </div>
            )}

            {/* Participants */}
            <div className="bg-white bg-opacity-10 backdrop-blur-sm rounded-lg p-4 border border-white border-opacity-20">
              <h3 className="text-lg font-semibold text-white mb-3">Collaborators</h3>
              <div className="space-y-2">
                {participants.map((participant: any, index: number) => (
                  <div key={participant.address} className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className={`w-2 h-2 rounded-full ${
                        participant.address === turnState?.turnOrder?.[turnState?.currentTurn] 
                          ? 'bg-green-400 animate-pulse' 
                          : 'bg-gray-400'
                      }`}></div>
                      <span className={`text-sm ${
                        participant.address === publicKey?.toBase58() 
                          ? 'text-white font-semibold' 
                          : 'text-white text-opacity-80'
                      }`}>
                        {participant.address === publicKey?.toBase58() 
                          ? 'You' 
                          : `Collaborator ${index + 1}`}
                      </span>
                    </div>
                    <div className="flex space-x-1">
                      {participant.isActive && <span className="text-green-400 text-xs">●</span>}
                    </div>
                  </div>
                )) || (
                  <div className="text-white text-opacity-60 text-sm">No collaborators yet</div>
                )}
              </div>
            </div>

            {/* Session Info */}
            <div className="bg-white bg-opacity-10 backdrop-blur-sm rounded-lg p-4 border border-white border-opacity-20">
              <h3 className="text-lg font-semibold text-white mb-3">Session Info</h3>
              <div className="space-y-2 text-sm text-white text-opacity-80">
                <div className="flex justify-between">
                  <span>Phase:</span>
                  <span className="capitalize">{turnState?.sessionPhase || 'loading'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Turn:</span>
                  <span>{turnState ? `${turnState.currentTurn + 1} / ${turnState.turnOrder?.length || 0}` : 'loading'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Participants:</span>
                  <span>{participants.length}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Voting Section */}
        {showVoting && generatedImages.length > 0 && (
          <div className="mt-8 bg-white bg-opacity-10 backdrop-blur-sm rounded-lg p-6 border border-white border-opacity-20">
            <h2 className="text-2xl font-bold text-white mb-4">Vote for the Final Collaborative Artwork</h2>
            <p className="text-white text-opacity-80 mb-6">
              Multiple versions were generated from your collaborative work. Vote for your favorite!
            </p>
            <ImageVoting
              images={generatedImages}
              onVote={handleVote}
              onTitleSubmit={handleTitleSubmit}
              votingTimeLeft={10}
              hasVoted={hasVoted}
              votingComplete={votingComplete}
            />
          </div>
        )}

        {/* Debug Info */}
        <div className="bg-white rounded-lg shadow-xl p-6 mb-6">
          <h3 className="text-lg font-semibold mb-4 text-gray-800">Debug Info (New System)</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <p><strong>Session ID:</strong> {sessionId}</p>
              <p><strong>Phase:</strong> {turnState?.sessionPhase || 'loading'}</p>
              <p><strong>Current Turn:</strong> {turnState?.currentTurn ?? 'loading'}</p>
              <p><strong>Participants:</strong> {participants.length}</p>
            </div>
            <div>
              <p><strong>Your Address:</strong> {publicKey?.toBase58().slice(0, 6)}...</p>
              <p><strong>Is Current Artist:</strong> {turnState ? (turnState.turnOrder?.[turnState.currentTurn] === publicKey?.toBase58() ? 'Yes' : 'No') : 'loading'}</p>
              <p><strong>Current Artist:</strong> {turnState ? (turnState.turnOrder?.[turnState.currentTurn]?.slice(0, 6) || 'none') + '...' : 'loading'}</p>
              <p><strong>Is Host:</strong> {isHost ? 'Yes' : 'No'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Test Helper - Only show in development */}
      {process.env.NODE_ENV === 'development' && (
        <TestHelper sessionId={sessionId as string} />
      )}
    </div>
  )
} 
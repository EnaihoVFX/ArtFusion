import React, { useEffect, useRef, useState } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { participantManager } from '@/lib/participantManager'
import { turnManager } from '@/lib/turnManager'

interface CollaborativeCanvasProps {
  sessionId: string
  onDrawingComplete: (imageData: string) => void
  isGenerating?: boolean
}

export default function CollaborativeCanvas({ sessionId, onDrawingComplete, isGenerating = false }: CollaborativeCanvasProps) {
  const { publicKey } = useWallet()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [prompt, setPrompt] = useState('')
  const [hasDrawn, setHasDrawn] = useState(false)
  const [isCurrentArtist, setIsCurrentArtist] = useState(false)
  const [currentArtist, setCurrentArtist] = useState<string | null>(null)
  const [sessionPhase, setSessionPhase] = useState<string>('drawing')
  const [previousCanvas, setPreviousCanvas] = useState<string | null>(null)
  const [allPrompts, setAllPrompts] = useState<string[]>([])
  const [isLocking, setIsLocking] = useState(false)
  const promptLoadedRef = useRef(false)
  const userHasDrawnRef = useRef(false)

  // Save prompt to server as user types
  const savePromptToServer = async (newPrompt: string) => {
    if (!publicKey || !sessionId) return
    
    try {
      await turnManager.updateDrawingTurn(sessionId, publicKey.toBase58(), {
        prompt: newPrompt
      })
    } catch (error) {
      console.error('Error saving prompt:', error)
    }
  }

  // Debounced prompt save
  const debouncedSavePrompt = React.useCallback(
    React.useMemo(
      () => {
        let timeoutId: NodeJS.Timeout
        return (newPrompt: string) => {
          clearTimeout(timeoutId)
          timeoutId = setTimeout(() => {
            savePromptToServer(newPrompt)
          }, 1000) // Save after 1 second of no typing
        }
      },
      []
    ),
    []
  )

  // Reset drawing state when turn changes
  useEffect(() => {
    if (isCurrentArtist) {
      userHasDrawnRef.current = false
      setHasDrawn(false)
      console.log('🔄 RESET DRAWING STATE FOR NEW TURN')
    }
  }, [isCurrentArtist])

  useEffect(() => {
    if (!sessionId || !publicKey) return

    const loadCanvasState = async () => {
      try {
        console.log('🎨 LOADING CANVAS STATE:', {
          sessionId,
          userAddress: publicKey.toBase58().slice(0, 6) + '...',
          timestamp: new Date().toISOString()
        })

        // Load turn state
        const turnState = await turnManager.getTurnState(sessionId)
        if (turnState) {
          setSessionPhase(turnState.sessionPhase)
          setCurrentArtist(turnState.turnOrder?.[turnState.currentTurn] || null)
          
          // Check if current user is the artist
          const isArtist = turnState.turnOrder?.[turnState.currentTurn] === publicKey.toBase58()
          setIsCurrentArtist(isArtist)
          
          console.log('🎨 CANVAS STATE LOADED:', {
            sessionId,
            userAddress: publicKey.toBase58().slice(0, 6) + '...',
            sessionPhase: turnState.sessionPhase,
            currentArtist: turnState.turnOrder?.[turnState.currentTurn]?.slice(0, 6) + '...',
            isCurrentArtist: isArtist,
            turnIndex: turnState.currentTurn,
            totalTurns: turnState.turnOrder?.length || 0
          })
        }

        // Load user's drawing state
        const drawingTurn = await turnManager.getDrawingTurn(sessionId, publicKey.toBase58())
        if (drawingTurn) {
          // Only set hasDrawn if the user has actually drawn in their current turn
          // Don't set it based on server state to avoid conflicts
          if (drawingTurn.hasDrawn && !hasDrawn) {
            setHasDrawn(true)
          }
          
          // Only load prompt if it's not already set locally (to prevent clearing user input)
          if (!promptLoadedRef.current) {
            setPrompt(drawingTurn.prompt || '')
            promptLoadedRef.current = true
          }
          
          console.log('📝 DRAWING TURN LOADED:', {
            sessionId,
            userAddress: publicKey.toBase58().slice(0, 6) + '...',
            hasDrawn: drawingTurn.hasDrawn,
            localHasDrawn: hasDrawn,
            hasPrompt: !!drawingTurn.prompt?.trim(),
            hasLocked: drawingTurn.hasLocked,
            prompt: drawingTurn.prompt?.slice(0, 50) + '...'
          })
        }

        // Load previous canvas if not the first turn
        if (turnState && turnState.currentTurn > 0) {
          const previousArtist = turnState.turnOrder[turnState.currentTurn - 1]
          if (previousArtist) {
            const previousDrawingTurn = await turnManager.getDrawingTurn(sessionId, previousArtist)
            if (previousDrawingTurn?.drawingData) {
              setPreviousCanvas(previousDrawingTurn.drawingData)
              console.log('🖼️ PREVIOUS CANVAS LOADED:', {
                sessionId,
                previousArtist: previousArtist.slice(0, 6) + '...',
                hasDrawingData: !!previousDrawingTurn.drawingData
              })
            }
          }
        }

        // Load all prompts
        if (turnState?.turnOrder) {
          const prompts: string[] = []
          for (let i = 0; i < turnState.currentTurn; i++) {
            const artistAddress = turnState.turnOrder[i]
            const artistDrawingTurn = await turnManager.getDrawingTurn(sessionId, artistAddress)
            if (artistDrawingTurn?.prompt) {
              prompts.push(artistDrawingTurn.prompt)
            }
          }
          setAllPrompts(prompts)
          
          console.log('📝 ALL PROMPTS LOADED:', {
            sessionId,
            promptCount: prompts.length,
            prompts: prompts.map(p => p.slice(0, 30) + '...')
          })
        }

      } catch (error) {
        console.error('Error loading canvas state:', error)
      }
    }

    // Load initially
    loadCanvasState()

    // Set up polling
    const interval = setInterval(loadCanvasState, 2000)

    return () => clearInterval(interval)
  }, [sessionId, publicKey])

  useEffect(() => {
    if (!canvasRef.current || !publicKey) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set canvas size
    canvas.width = 512
    canvas.height = 512

    // Load previous canvas if available
    if (previousCanvas) {
      const img = new Image()
      img.onload = () => {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        // Don't set hasDrawn to true when loading previous canvas
        // hasDrawn should only be true when the user actually draws
      }
      img.src = previousCanvas
    } else {
      // Clear canvas
      ctx.fillStyle = 'white'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
    }

    let isDrawing = false
    let lastX = 0
    let lastY = 0
    let userHasDrawn = false // Track if user has actually drawn

    const startDrawing = (e: MouseEvent | TouchEvent) => {
      if (!isCurrentArtist || sessionPhase !== 'drawing') return
      
      isDrawing = true
      const rect = canvas.getBoundingClientRect()
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
      
      lastX = (clientX - rect.left) * (canvas.width / rect.width)
      lastY = (clientY - rect.top) * (canvas.height / rect.height)
    }

    const draw = (e: MouseEvent | TouchEvent) => {
      if (!isDrawing || !isCurrentArtist || sessionPhase !== 'drawing') return
      
      e.preventDefault()
      const rect = canvas.getBoundingClientRect()
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
      
      const x = (clientX - rect.left) * (canvas.width / rect.width)
      const y = (clientY - rect.top) * (canvas.height / rect.height)
      
      ctx.beginPath()
      ctx.moveTo(lastX, lastY)
      ctx.lineTo(x, y)
      ctx.strokeStyle = '#000'
      ctx.lineWidth = 2
      ctx.lineCap = 'round'
      ctx.stroke()
      
      lastX = x
      lastY = y
      
      // Only set hasDrawn when user actually draws
      if (!userHasDrawnRef.current) {
        userHasDrawnRef.current = true
        setHasDrawn(true)
        console.log('🎨 USER HAS DRAWN SOMETHING')
      }
    }

    const stopDrawing = () => {
      isDrawing = false
    }

    // Mouse events
    canvas.addEventListener('mousedown', startDrawing)
    canvas.addEventListener('mousemove', draw)
    canvas.addEventListener('mouseup', stopDrawing)
    canvas.addEventListener('mouseout', stopDrawing)

    // Touch events
    canvas.addEventListener('touchstart', startDrawing, { passive: false })
    canvas.addEventListener('touchmove', draw, { passive: false })
    canvas.addEventListener('touchend', stopDrawing)

    return () => {
      canvas.removeEventListener('mousedown', startDrawing)
      canvas.removeEventListener('mousemove', draw)
      canvas.removeEventListener('mouseup', stopDrawing)
      canvas.removeEventListener('mouseout', stopDrawing)
      canvas.removeEventListener('touchstart', startDrawing)
      canvas.removeEventListener('touchmove', draw)
      canvas.removeEventListener('touchend', stopDrawing)
    }
  }, [isCurrentArtist, sessionPhase, previousCanvas, publicKey])

  const handleLock = async () => {
    if (!publicKey || !hasDrawn || !prompt.trim() || isLocking) return

    try {
      setIsLocking(true)
      console.log('🔒 LOCKING TURN WITH NEW SYSTEM:', {
        sessionId,
        userAddress: publicKey.toBase58().slice(0, 6) + '...',
        hasDrawn,
        hasPrompt: !!prompt.trim(),
        timestamp: new Date().toISOString()
      })

      // Save drawing data
      const canvas = canvasRef.current
      if (canvas) {
        const imageData = canvas.toDataURL('image/png')
        
        // Update drawing turn with all data
        await turnManager.updateDrawingTurn(sessionId, publicKey.toBase58(), {
          hasDrawn: true,
          hasPrompted: true,
          hasLocked: true,
          prompt: prompt.trim(),
          drawingData: imageData
        })

        console.log('✅ DRAWING TURN UPDATED WITH LOCK')
      }

      // Lock the turn and advance
      const lockResult = await turnManager.lockTurn(sessionId, publicKey.toBase58())
      
      console.log('🔒 LOCK RESULT:', {
        sessionId,
        userAddress: publicKey.toBase58().slice(0, 6) + '...',
        success: lockResult.success,
        nextArtist: lockResult.nextArtist?.slice(0, 6) + '...',
        phase: lockResult.phase,
        timestamp: new Date().toISOString()
      })

      if (lockResult.success) {
        if (lockResult.phase === 'generating') {
          console.log('🎨 ALL PARTICIPANTS LOCKED - REDIRECTING TO WAITING ROOM')
          // Redirect to waiting room for generation
          setTimeout(() => {
            window.location.href = `/game/${sessionId}/waiting`
          }, 500)
        } else {
          console.log('⏭️ TURN ADVANCED - REDIRECTING TO WAITING ROOM')
          // Redirect to waiting room to wait for next turn
          setTimeout(() => {
            window.location.href = `/game/${sessionId}/waiting`
          }, 500)
        }
      } else {
        console.log('❌ LOCK FAILED')
        setIsLocking(false)
      }

    } catch (error) {
      console.error('Error locking turn:', error)
      setIsLocking(false)
    }
  }

  const clearCanvas = () => {
    if (!canvasRef.current || !isCurrentArtist) return
    
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.fillStyle = 'white'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      setHasDrawn(false)
      userHasDrawnRef.current = false
      console.log('🧹 CANVAS CLEARED - DRAWING STATE RESET')
    }
  }

  if (!publicKey) {
    return (
      <div className="text-center text-white">
        <p>Please connect your wallet to participate</p>
      </div>
    )
  }

  if (isGenerating) {
    return (
      <div className="text-center text-white">
        <div className="w-16 h-16 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-xl">Generating collaborative artwork...</p>
        <p className="text-white text-opacity-60 mt-2">This may take a few moments</p>
      </div>
    )
  }

  if (sessionPhase !== 'drawing') {
    return (
      <div className="text-center text-white">
        <p className="text-xl">Drawing phase is not active</p>
        <p className="text-white text-opacity-60 mt-2">Current phase: {sessionPhase}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Previous Prompts */}
      {allPrompts.length > 0 && (
        <div className="bg-white bg-opacity-10 backdrop-blur-sm rounded-lg p-4 border border-white border-opacity-20">
          <h3 className="text-lg font-semibold text-white mb-3">Previous Prompts</h3>
          <div className="space-y-2">
            {allPrompts.map((prompt, index) => (
              <div key={index} className="bg-white bg-opacity-20 rounded-lg p-3">
                <p className="text-white text-sm">
                  <span className="font-semibold">Turn {index + 1}:</span> {prompt}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Canvas */}
      <div className="bg-white rounded-lg p-4 shadow-lg">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-800">
            {isCurrentArtist ? 'Your Turn to Draw' : 'Collaborative Canvas'}
          </h3>
          {isCurrentArtist && (
            <button
              onClick={clearCanvas}
              className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 transition-colors text-sm"
            >
              Clear
            </button>
          )}
        </div>
        
        <div className="relative">
          <canvas
            ref={canvasRef}
            className="border-2 border-gray-300 rounded-lg cursor-crosshair w-full max-w-md mx-auto block"
            style={{ touchAction: 'none' }}
          />
          
          {!isCurrentArtist && (
            <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center rounded-lg">
              <div className="text-center text-white">
                <p className="text-lg font-semibold">Waiting for current artist...</p>
                <p className="text-sm opacity-80">
                  {currentArtist?.slice(0, 6) + '...' || 'Unknown'} is drawing
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Prompt Input */}
      {isCurrentArtist && (
        <div className="bg-white bg-opacity-10 backdrop-blur-sm rounded-lg p-4 border border-white border-opacity-20">
          <h3 className="text-lg font-semibold text-white mb-3">Your Prompt</h3>
          <textarea
            value={prompt}
            onChange={(e) => {
              setPrompt(e.target.value)
              debouncedSavePrompt(e.target.value)
            }}
            placeholder="Describe what you want to add to the collaborative artwork..."
            className="w-full p-3 bg-white bg-opacity-20 border border-white border-opacity-30 rounded-lg text-white placeholder-white placeholder-opacity-60 resize-none"
            rows={3}
          />
          <p className="text-white text-opacity-60 text-sm mt-2">
            {prompt.length}/200 characters
          </p>
        </div>
      )}

      {/* Lock Button */}
      {isCurrentArtist && (
        <div className="text-center">
          <button
            onClick={handleLock}
            disabled={!hasDrawn || !prompt.trim() || isLocking}
            className={`px-8 py-3 rounded-lg font-semibold transition-all duration-200 ${
              hasDrawn && prompt.trim() && !isLocking
                ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600 transform hover:scale-105'
                : 'bg-gray-500 text-gray-300 cursor-not-allowed'
            }`}
          >
            {isLocking ? (
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Finishing...</span>
              </div>
            ) : (
              'Finished'
            )}
          </button>
          
          {(!hasDrawn || !prompt.trim()) && (
            <p className="text-white text-opacity-60 text-sm mt-2">
              {!hasDrawn && !prompt.trim() && 'Draw something and add a prompt to continue'}
              {!hasDrawn && prompt.trim() && 'Draw something to continue'}
              {hasDrawn && !prompt.trim() && 'Add a prompt to continue'}
            </p>
          )}
        </div>
      )}

      {/* Status */}
      {!isCurrentArtist && (
        <div className="text-center text-white">
          <p className="text-lg">
            {currentArtist === publicKey.toBase58() 
              ? 'It\'s your turn!' 
              : `Waiting for ${currentArtist?.slice(0, 6) + '...' || 'current artist'} to finish`}
          </p>
        </div>
      )}
    </div>
  )
} 
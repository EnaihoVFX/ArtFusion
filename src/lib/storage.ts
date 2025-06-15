// Client-side storage utility
interface ParticipantState {
  address: string
  hasDrawn: boolean
  hasPrompted: boolean
  hasLocked: boolean
  prompt: string
  drawingData: string | null
  turnOrder: number
}

interface SessionState {
  participants: ParticipantState[]
  currentTurn: number
  isGenerating: boolean
  combinedPrompt: string
  combinedImage: string | null
  sessionPhase: 'lobby' | 'drawing' | 'prompting' | 'locking' | 'generating' | 'voting' | 'complete'
  lobbyState: {
    isStarted: boolean
    minPlayers: number
    maxPlayers: number
    hostAddress: string | null
  }
}

interface Storage {
  getCanvasState: (sessionId: string) => string | null
  updateCanvasState: (sessionId: string, imageUrl: string) => void
  getParticipants: (sessionId: string) => string[]
  addParticipant: (sessionId: string, address: string) => void
  removeParticipant: (sessionId: string, address: string) => void
  getGeneratedImage: (sessionId: string) => string | null
  setGeneratedImage: (sessionId: string, imageData: string) => void
  clearGeneratedImage: (sessionId: string) => void
  
  // New collaborative methods
  getSessionState: (sessionId: string) => SessionState
  updateSessionState: (sessionId: string, state: Partial<SessionState>) => void
  getParticipantState: (sessionId: string, address: string) => ParticipantState | null
  updateParticipantState: (sessionId: string, address: string, updates: Partial<ParticipantState>) => void
  setParticipantPrompt: (sessionId: string, address: string, prompt: string) => void
  setParticipantDrawing: (sessionId: string, address: string, drawingData: string) => void
  lockParticipant: (sessionId: string, address: string) => void
  getWaitingForParticipants: (sessionId: string) => string[]
  isAllParticipantsLocked: (sessionId: string) => boolean
  getCurrentTurnParticipant: (sessionId: string) => string | null
  advanceTurn: (sessionId: string) => void
  combinePromptsAndDrawings: (sessionId: string) => { combinedPrompt: string; combinedImage: string | null }
  getCurrentCanvas: (sessionId: string) => string | null
  getAllPrompts: (sessionId: string) => string[]
  shouldBeInWaitingRoom: (sessionId: string, address: string) => boolean
  startGame: (sessionId: string) => void
  isHost: (sessionId: string, address: string) => boolean
  canStartGame: (sessionId: string) => boolean
}

class LocalStorage implements Storage {
  private readonly GENERATED_IMAGE_KEY = 'generated_image_'
  private readonly SESSION_STATE_KEY = 'session_state_'

  getCanvasState(sessionId: string): string | null {
    if (typeof window === 'undefined') return null
    return localStorage.getItem(`canvas_${sessionId}`)
  }

  updateCanvasState(sessionId: string, imageUrl: string): void {
    if (typeof window === 'undefined') return
    localStorage.setItem(`canvas_${sessionId}`, imageUrl)
  }

  getParticipants(sessionId: string): string[] {
    if (typeof window === 'undefined') return []
    
    // Use session state as the source of truth
    const sessionState = this.getSessionState(sessionId)
    return sessionState.participants.map((p: any) => p.address)
  }

  addParticipant(sessionId: string, address: string): void {
    if (typeof window === 'undefined') return
    
    // Get current session state
    const stored = localStorage.getItem(this.SESSION_STATE_KEY + sessionId)
    const sessionState = stored ? JSON.parse(stored) : {
      participants: [],
      currentTurn: 0,
      isGenerating: false,
      combinedPrompt: '',
      combinedImage: null,
      sessionPhase: 'lobby',
      lobbyState: {
        isStarted: false,
        minPlayers: 1,
        maxPlayers: 10,
        hostAddress: null
      }
    }
    
    // Check if participant already exists
    const existingParticipant = sessionState.participants.find((p: any) => p.address === address)
    if (existingParticipant) {
      return // Participant already exists
    }
    
    // Set host if this is the first participant
    if (sessionState.participants.length === 0) {
      sessionState.lobbyState.hostAddress = address
      console.log(`Setting host to: ${address}`)
    }
    
    // Add new participant
    const newParticipant: ParticipantState = {
      address,
      hasDrawn: false,
      hasPrompted: false,
      hasLocked: false,
      prompt: '',
      drawingData: null,
      turnOrder: sessionState.participants.length
    }
    sessionState.participants.push(newParticipant)
    
    // Update both session state and participants list
    localStorage.setItem(this.SESSION_STATE_KEY + sessionId, JSON.stringify(sessionState))
    
    // Also update the separate participants list for backward compatibility
    const participants = this.getParticipants(sessionId)
    if (!participants.includes(address)) {
      participants.push(address)
      localStorage.setItem(`participants_${sessionId}`, JSON.stringify(participants))
    }
    
    console.log(`Added participant: ${address}, Total participants: ${sessionState.participants.length}`)
  }

  removeParticipant(sessionId: string, address: string): void {
    if (typeof window === 'undefined') return
    const participants = this.getParticipants(sessionId)
    const updatedParticipants = participants.filter(p => p !== address)
    localStorage.setItem(`participants_${sessionId}`, JSON.stringify(updatedParticipants))
    
    // Remove from session state
    const stored = localStorage.getItem(this.SESSION_STATE_KEY + sessionId)
    if (stored) {
      const sessionState = JSON.parse(stored)
      sessionState.participants = sessionState.participants.filter((p: any) => p.address !== address)
      localStorage.setItem(this.SESSION_STATE_KEY + sessionId, JSON.stringify(sessionState))
    }
  }

  getGeneratedImage(sessionId: string): string | null {
    if (typeof window === 'undefined') return null
    return localStorage.getItem(this.GENERATED_IMAGE_KEY + sessionId)
  }

  setGeneratedImage(sessionId: string, imageData: string): void {
    if (typeof window === 'undefined') return
    localStorage.setItem(this.GENERATED_IMAGE_KEY + sessionId, imageData)
  }

  clearGeneratedImage(sessionId: string): void {
    if (typeof window === 'undefined') return
    localStorage.removeItem(this.GENERATED_IMAGE_KEY + sessionId)
  }

  // New collaborative methods
  getSessionState(sessionId: string): SessionState {
    if (typeof window === 'undefined') {
      return {
        participants: [],
        currentTurn: 0,
        isGenerating: false,
        combinedPrompt: '',
        combinedImage: null,
        sessionPhase: 'lobby',
        lobbyState: {
          isStarted: false,
          minPlayers: 1,
          maxPlayers: 10,
          hostAddress: null
        }
      }
    }
    
    const stored = localStorage.getItem(this.SESSION_STATE_KEY + sessionId)
    if (stored) {
      return JSON.parse(stored)
    }
    
    // Initialize new session state
    const initialState: SessionState = {
      participants: [],
      currentTurn: 0,
      isGenerating: false,
      combinedPrompt: '',
      combinedImage: null,
      sessionPhase: 'lobby',
      lobbyState: {
        isStarted: false,
        minPlayers: 1,
        maxPlayers: 10,
        hostAddress: null
      }
    }
    localStorage.setItem(this.SESSION_STATE_KEY + sessionId, JSON.stringify(initialState))
    return initialState
  }

  updateSessionState(sessionId: string, updates: Partial<SessionState>): void {
    if (typeof window === 'undefined') return
    
    const stored = localStorage.getItem(this.SESSION_STATE_KEY + sessionId)
    const currentState = stored ? JSON.parse(stored) : {
      participants: [],
      currentTurn: 0,
      isGenerating: false,
      combinedPrompt: '',
      combinedImage: null,
      sessionPhase: 'drawing'
    }
    
    const newState = { ...currentState, ...updates }
    localStorage.setItem(this.SESSION_STATE_KEY + sessionId, JSON.stringify(newState))
  }

  getParticipantState(sessionId: string, address: string): ParticipantState | null {
    const sessionState = this.getSessionState(sessionId)
    return sessionState.participants.find(p => p.address === address) || null
  }

  updateParticipantState(sessionId: string, address: string, updates: Partial<ParticipantState>): void {
    const stored = localStorage.getItem(this.SESSION_STATE_KEY + sessionId)
    if (!stored) return
    
    const sessionState = JSON.parse(stored)
    const participantIndex = sessionState.participants.findIndex((p: any) => p.address === address)
    
    if (participantIndex !== -1) {
      sessionState.participants[participantIndex] = {
        ...sessionState.participants[participantIndex],
        ...updates
      }
      localStorage.setItem(this.SESSION_STATE_KEY + sessionId, JSON.stringify(sessionState))
    }
  }

  setParticipantPrompt(sessionId: string, address: string, prompt: string): void {
    this.updateParticipantState(sessionId, address, { prompt, hasPrompted: true })
  }

  setParticipantDrawing(sessionId: string, address: string, drawingData: string): void {
    this.updateParticipantState(sessionId, address, { drawingData, hasDrawn: true })
  }

  lockParticipant(sessionId: string, address: string): void {
    const stored = localStorage.getItem(this.SESSION_STATE_KEY + sessionId)
    if (!stored) return
    
    const sessionState = JSON.parse(stored)
    const participantIndex = sessionState.participants.findIndex((p: any) => p.address === address)
    
    if (participantIndex !== -1) {
      const participant = sessionState.participants[participantIndex]
      
      // Check if user has both drawn and added a prompt
      if (sessionState.sessionPhase === 'drawing' && (!participant.hasDrawn || !participant.prompt.trim())) {
        console.log('User must both draw and add a prompt before locking')
        return
      }
      
      sessionState.participants[participantIndex].hasLocked = true
      
      // Check if all participants are locked
      if (sessionState.participants.every((p: any) => p.hasLocked)) {
        console.log('All participants locked, moving to generating phase')
        // Move to generating phase
        sessionState.sessionPhase = 'generating'
        sessionState.isGenerating = true
        
        // Combine prompts and drawings
        const { combinedPrompt, combinedImage } = this.combinePromptsAndDrawings(sessionId)
        sessionState.combinedPrompt = combinedPrompt
        sessionState.combinedImage = combinedImage
        
        console.log('Session state after moving to generating:', {
          sessionPhase: sessionState.sessionPhase,
          combinedPrompt: sessionState.combinedPrompt,
          hasCombinedImage: !!sessionState.combinedImage
        })
      } else {
        console.log('Not all participants locked, advancing turn')
        // Automatically advance to next turn
        this.advanceTurn(sessionId)
      }
      
      localStorage.setItem(this.SESSION_STATE_KEY + sessionId, JSON.stringify(sessionState))
    }
  }

  getWaitingForParticipants(sessionId: string): string[] {
    const sessionState = this.getSessionState(sessionId)
    return sessionState.participants
      .filter(p => !p.hasLocked)
      .map(p => p.address)
  }

  isAllParticipantsLocked(sessionId: string): boolean {
    const sessionState = this.getSessionState(sessionId)
    return sessionState.participants.length > 0 && 
           sessionState.participants.every(p => p.hasLocked)
  }

  getCurrentTurnParticipant(sessionId: string): string | null {
    const sessionState = this.getSessionState(sessionId)
    const sortedParticipants = sessionState.participants.sort((a, b) => a.turnOrder - b.turnOrder)
    return sortedParticipants[sessionState.currentTurn]?.address || null
  }

  advanceTurn(sessionId: string): void {
    const stored = localStorage.getItem(this.SESSION_STATE_KEY + sessionId)
    if (!stored) return
    
    const sessionState = JSON.parse(stored)
    const nextTurn = (sessionState.currentTurn + 1) % sessionState.participants.length
    
    if (nextTurn === 0) {
      // All participants have had their turn, move to prompting phase
      sessionState.currentTurn = 0
      sessionState.sessionPhase = 'prompting'
    } else {
      sessionState.currentTurn = nextTurn
    }
    
    localStorage.setItem(this.SESSION_STATE_KEY + sessionId, JSON.stringify(sessionState))
  }

  combinePromptsAndDrawings(sessionId: string): { combinedPrompt: string; combinedImage: string | null } {
    const sessionState = this.getSessionState(sessionId)
    const prompts = sessionState.participants
      .filter(p => p.prompt.trim())
      .map(p => p.prompt.trim())
    
    const drawings = sessionState.participants
      .filter(p => p.drawingData)
      .map(p => p.drawingData!)
    
    const combinedPrompt = prompts.length > 0 ? prompts.join(' + ') : 'collaborative artwork'
    
    // For now, use the last drawing as the combined image
    // In a real implementation, you might want to merge multiple drawings
    const combinedImage = drawings.length > 0 ? drawings[drawings.length - 1] : null
    
    console.log('Combining prompts and drawings:', {
      sessionId,
      participants: sessionState.participants.length,
      prompts,
      drawings: drawings.length,
      combinedPrompt,
      hasCombinedImage: !!combinedImage
    })
    
    return { combinedPrompt, combinedImage }
  }

  getCurrentCanvas(sessionId: string): string | null {
    const stored = localStorage.getItem(this.SESSION_STATE_KEY + sessionId)
    if (!stored) return null
    
    const sessionState = JSON.parse(stored)
    const sortedParticipants = sessionState.participants.sort((a: any, b: any) => a.turnOrder - b.turnOrder)
    
    // Get the last completed drawing (from the previous turn)
    const currentTurnIndex = sessionState.currentTurn
    if (currentTurnIndex === 0) {
      // First turn, return white canvas
      return null
    }
    
    // Return the drawing from the previous participant
    const previousParticipant = sortedParticipants[currentTurnIndex - 1]
    return previousParticipant?.drawingData || null
  }

  getAllPrompts(sessionId: string): string[] {
    const stored = localStorage.getItem(this.SESSION_STATE_KEY + sessionId)
    if (!stored) return []
    
    const sessionState = JSON.parse(stored)
    return sessionState.participants
      .filter((p: any) => p.prompt.trim())
      .map((p: any) => p.prompt.trim())
  }

  shouldBeInWaitingRoom(sessionId: string, address: string): boolean {
    const sessionState = this.getSessionState(sessionId)
    const participant = this.getParticipantState(sessionId, address)
    
    console.log('shouldBeInWaitingRoom check:', {
      sessionId,
      address,
      sessionState: {
        sessionPhase: sessionState.sessionPhase,
        currentTurn: sessionState.currentTurn,
        participantsCount: sessionState.participants.length
      },
      participant: participant ? {
        hasLocked: participant.hasLocked,
        hasDrawn: participant.hasDrawn,
        hasPrompted: participant.hasPrompted
      } : null
    })
    
    if (!participant) {
      console.log('No participant found, returning false')
      return false
    }
    
    // If user has already locked, they should be in waiting room
    if (participant.hasLocked) {
      console.log('Participant has locked, should be in waiting room')
      return true
    }
    
    // If it's not their turn and they haven't locked, they should be in waiting room
    const currentArtist = this.getCurrentTurnParticipant(sessionId)
    const isCurrentArtist = currentArtist === address
    
    console.log('Current artist check:', {
      currentArtist,
      isCurrentArtist,
      shouldWait: !isCurrentArtist
    })
    
    return !isCurrentArtist
  }

  startGame(sessionId: string): void {
    const stored = localStorage.getItem(this.SESSION_STATE_KEY + sessionId)
    if (!stored) return
    
    const sessionState = JSON.parse(stored)
    sessionState.lobbyState.isStarted = true
    sessionState.sessionPhase = 'drawing'
    localStorage.setItem(this.SESSION_STATE_KEY + sessionId, JSON.stringify(sessionState))
  }

  isHost(sessionId: string, address: string): boolean {
    const sessionState = this.getSessionState(sessionId)
    return sessionState.lobbyState.hostAddress === address
  }

  canStartGame(sessionId: string): boolean {
    const sessionState = this.getSessionState(sessionId)
    return sessionState.participants.length >= sessionState.lobbyState.minPlayers
  }
}

export const storage = new LocalStorage() 
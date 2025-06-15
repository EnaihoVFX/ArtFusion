// Shared storage utility using API calls
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
  currentCanvas: string | null
  sessionPhase: 'lobby' | 'drawing' | 'prompting' | 'locking' | 'generating' | 'voting' | 'complete'
  lobbyState: {
    isStarted: boolean
    minPlayers: number
    maxPlayers: number
    hostAddress: string | null
  }
  // Add turn management metadata
  turnMetadata: {
    lastUpdate: number
    turnSequence: number
    lockedParticipants: string[]
  }
}

class SharedStorage {
  private cache = new Map<string, SessionState>()

  async getSessionState(sessionId: string): Promise<SessionState> {
    try {
      console.log('Fetching session state for:', sessionId)
      
      const response = await fetch(`/api/session/${sessionId}?t=${Date.now()}`, {
        cache: 'no-cache'
      })
      if (!response.ok) {
        throw new Error('Failed to fetch session state')
      }
      const data = await response.json()
      
      // PROTECTION: Check if participants array is empty and log it
      if (data.participants && Array.isArray(data.participants) && data.participants.length === 0) {
        console.log('🚨 WARNING: Fetched session state has empty participants array:', {
          sessionId,
          currentTurn: data.currentTurn,
          sessionPhase: data.sessionPhase,
          stackTrace: new Error().stack?.split('\n').slice(1, 5).join('\n')
        })
        
        // Try to get the last known good state from cache
        const cachedState = this.cache.get(sessionId)
        if (cachedState && cachedState.participants && cachedState.participants.length > 0) {
          console.log('🔄 RESTORING PARTICIPANTS FROM CACHE:', {
            cachedParticipants: cachedState.participants.length,
            cachedAddresses: cachedState.participants.map((p: any) => p.address.slice(0, 6) + '...')
          })
          data.participants = cachedState.participants
        } else {
          console.log('❌ NO CACHED STATE AVAILABLE - USING DEFAULT STATE')
          return this.getDefaultState()
        }
      }
      
      // Ensure turnMetadata exists
      if (!data.turnMetadata) {
        data.turnMetadata = {
          lastUpdate: Date.now(),
          turnSequence: 0,
          lockedParticipants: []
        }
      }
      
      console.log('Fetched session state:', {
        sessionId,
        currentTurn: data.currentTurn,
        sessionPhase: data.sessionPhase,
        participants: data.participants?.length || 0,
        turnSequence: data.turnMetadata.turnSequence,
        participantAddresses: data.participants?.map((p: any) => p.address.slice(0, 6) + '...') || []
      })
      
      this.cache.set(sessionId, data)
      return data
    } catch (error) {
      console.error('Error fetching session state:', error)
      const cachedState = this.cache.get(sessionId)
      if (cachedState) {
        console.log('Using cached state due to fetch error:', {
          sessionId,
          participants: cachedState.participants?.length || 0
        })
        return cachedState
      }
      console.log('No cached state, returning default state')
      return this.getDefaultState()
    }
  }

  async updateSessionState(sessionId: string, updates: Partial<SessionState>): Promise<void> {
    try {
      console.log('🔍 UPDATE SESSION STATE CALLED:', { 
        sessionId, 
        updates: {
          ...updates,
          participants: updates.participants !== undefined ? {
            length: updates.participants.length,
            addresses: updates.participants.map((p: any) => p.address.slice(0, 6) + '...')
          } : 'not included',
          hasParticipants: updates.participants !== undefined,
          participantsType: typeof updates.participants,
          participantsIsArray: Array.isArray(updates.participants)
        },
        stackTrace: new Error().stack?.split('\n').slice(1, 5).join('\n')
      })
      
      const currentState = await this.getSessionState(sessionId)
      
      // If participants are not explicitly included in updates, preserve the current participants
      const safeUpdates = {
        ...updates,
        participants: updates.participants !== undefined ? updates.participants : currentState.participants
      }
      
      const newState = { 
        ...currentState, 
        ...safeUpdates,
        turnMetadata: {
          ...currentState.turnMetadata,
          lastUpdate: Date.now()
        }
      }
      
      console.log('📊 SESSION STATE UPDATE DETAILS:', {
        oldCurrentTurn: currentState.currentTurn,
        newCurrentTurn: newState.currentTurn,
        turnSequence: newState.turnMetadata.turnSequence,
        oldParticipants: currentState.participants?.length || 0,
        newParticipants: newState.participants?.length || 0,
        newParticipantAddresses: newState.participants?.map((p: any) => p.address.slice(0, 6) + '...') || [],
        participantsPreserved: updates.participants === undefined,
        participantsExplicitlySet: updates.participants !== undefined,
        participantsWasEmpty: updates.participants?.length === 0
      })
      
      const response = await fetch(`/api/session/${sessionId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newState),
      })

      if (!response.ok) {
        throw new Error('Failed to update session state')
      }

      this.cache.set(sessionId, newState)
      console.log('✅ Session state updated successfully')
    } catch (error) {
      console.error('Error updating session state:', error)
    }
  }

  // Atomic turn management - this is the key method
  async lockParticipantAndAdvanceTurn(sessionId: string, address: string): Promise<{ success: boolean; newTurn?: number; phase?: string }> {
    try {
      console.log('Atomic turn management for:', { sessionId, address })
      
      const response = await fetch(`/api/session/${sessionId}/lock`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ address }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        console.log('Lock API error:', errorData)
        return { success: false }
      }

      const result = await response.json()
      console.log('Lock API result:', result)
      
      // Update local cache
      if (result.success) {
        const currentState = await this.getSessionState(sessionId)
        if (result.phase === 'generating') {
          currentState.sessionPhase = 'generating'
          currentState.isGenerating = true
          currentState.combinedPrompt = result.combinedPrompt || currentState.combinedPrompt
          currentState.combinedImage = result.combinedImage || currentState.combinedImage
        } else if (result.newTurn !== undefined) {
          currentState.currentTurn = result.newTurn
        }
        currentState.turnMetadata.turnSequence = result.turnSequence
        this.cache.set(sessionId, currentState)
      }
      
      return result
    } catch (error) {
      console.error('Error in atomic turn management:', error)
      return { success: false }
    }
  }

  async addParticipant(sessionId: string, address: string): Promise<void> {
    try {
      console.log('Adding participant:', { sessionId, address: address.slice(0, 6) + '...' })
      
      const sessionState = await this.getSessionState(sessionId)
      console.log('Current session state before adding:', {
        participants: sessionState.participants?.length || 0,
        sessionPhase: sessionState.sessionPhase,
        participantAddresses: sessionState.participants?.map((p: any) => p.address.slice(0, 6) + '...') || []
      })
      
      // Check if participant already exists
      const existingParticipant = sessionState.participants.find(p => p.address === address)
      if (existingParticipant) {
        console.log('Participant already exists:', address.slice(0, 6) + '...')
        return
      }
      
      // Set host if this is the first participant
      if (sessionState.participants.length === 0) {
        sessionState.lobbyState.hostAddress = address
        console.log('Set as host:', address.slice(0, 6) + '...')
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
      
      console.log('About to update session state with new participant:', {
        totalParticipants: sessionState.participants.length,
        newParticipantAddress: address.slice(0, 6) + '...',
        allAddresses: sessionState.participants.map((p: any) => p.address.slice(0, 6) + '...')
      })
      
      await this.updateSessionState(sessionId, sessionState)
      console.log(`✅ Added participant: ${address.slice(0, 6)}..., Total: ${sessionState.participants.length}`)
    } catch (error) {
      console.error('Error adding participant:', error)
    }
  }

  async removeParticipant(sessionId: string, address: string): Promise<void> {
    try {
      console.log('🗑️ REMOVE PARTICIPANT CALLED:', {
        sessionId,
        address: address.slice(0, 6) + '...',
        stackTrace: new Error().stack?.split('\n').slice(1, 5).join('\n'),
        timestamp: new Date().toISOString()
      })
      
      const sessionState = await this.getSessionState(sessionId)
      
      console.log('📊 BEFORE REMOVAL:', {
        totalParticipants: sessionState.participants?.length || 0,
        participantAddresses: sessionState.participants?.map((p: any) => p.address.slice(0, 6) + '...') || [],
        sessionPhase: sessionState.sessionPhase,
        currentTurn: sessionState.currentTurn
      })
      
      sessionState.participants = sessionState.participants.filter(p => p.address !== address)
      
      console.log('📊 AFTER REMOVAL:', {
        totalParticipants: sessionState.participants?.length || 0,
        participantAddresses: sessionState.participants?.map((p: any) => p.address.slice(0, 6) + '...') || [],
        removedAddress: address.slice(0, 6) + '...'
      })
      
      // If host left, assign new host
      if (sessionState.lobbyState.hostAddress === address && sessionState.participants.length > 0) {
        sessionState.lobbyState.hostAddress = sessionState.participants[0].address
        console.log('👑 NEW HOST ASSIGNED:', sessionState.participants[0].address.slice(0, 6) + '...')
      }
      
      await this.updateSessionState(sessionId, sessionState)
      console.log('✅ PARTICIPANT REMOVED SUCCESSFULLY')
    } catch (error) {
      console.error('Error removing participant:', error)
    }
  }

  async startGame(sessionId: string): Promise<void> {
    try {
      console.log('Starting game for session:', sessionId)
      
      const sessionState = await this.getSessionState(sessionId)
      
      // Ensure we have at least 2 players for multiplayer
      if (sessionState.participants.length < 2) {
        throw new Error('Need at least 2 players to start a multiplayer game')
      }
      
      sessionState.lobbyState.isStarted = true
      sessionState.sessionPhase = 'drawing'
      
      // Randomize the starting player instead of always starting with player 0
      const randomStartIndex = Math.floor(Math.random() * sessionState.participants.length)
      sessionState.currentTurn = randomStartIndex
      
      console.log('🎲 RANDOMIZED STARTING PLAYER:', {
        totalPlayers: sessionState.participants.length,
        startingPlayerIndex: randomStartIndex,
        startingPlayerAddress: sessionState.participants[randomStartIndex]?.address.slice(0, 6) + '...'
      })
      
      sessionState.currentCanvas = null
      sessionState.turnMetadata = {
        lastUpdate: Date.now(),
        turnSequence: 0,
        lockedParticipants: []
      }
      
      await this.updateSessionState(sessionId, sessionState)
    } catch (error) {
      console.error('Error starting game:', error)
      throw error
    }
  }

  async updateCanvas(sessionId: string, canvasData: string): Promise<void> {
    try {
      await this.updateSessionState(sessionId, { currentCanvas: canvasData })
    } catch (error) {
      console.error('Error updating canvas:', error)
    }
  }

  async updateParticipantState(sessionId: string, address: string, updates: Partial<ParticipantState>): Promise<void> {
    try {
      const sessionState = await this.getSessionState(sessionId)
      const participantIndex = sessionState.participants.findIndex(p => p.address === address)
      
      if (participantIndex !== -1) {
        sessionState.participants[participantIndex] = {
          ...sessionState.participants[participantIndex],
          ...updates
        }
        await this.updateSessionState(sessionId, sessionState)
      }
    } catch (error) {
      console.error('Error updating participant state:', error)
    }
  }

  // Helper methods
  getDefaultState(): SessionState {
    return {
      participants: [],
      currentTurn: 0,
      isGenerating: false,
      combinedPrompt: '',
      combinedImage: null,
      currentCanvas: null,
      sessionPhase: 'lobby',
      lobbyState: {
        isStarted: false,
        minPlayers: 2,
        maxPlayers: 10,
        hostAddress: null
      },
      turnMetadata: {
        lastUpdate: Date.now(),
        turnSequence: 0,
        lockedParticipants: []
      }
    }
  }

  combinePromptsAndDrawings(sessionState: SessionState): { combinedPrompt: string; combinedImage: string | null } {
    const prompts = sessionState.participants
      .filter(p => p.prompt.trim())
      .map(p => p.prompt.trim())
    
    const drawings = sessionState.participants
      .filter(p => p.drawingData)
      .map(p => p.drawingData!)
    
    const combinedPrompt = prompts.length > 0 ? prompts.join(' + ') : 'collaborative artwork'
    const combinedImage = drawings.length > 0 ? drawings[drawings.length - 1] : null
    
    return { combinedPrompt, combinedImage }
  }

  getCurrentTurnParticipant(sessionState: SessionState | null): string | null {
    if (!sessionState || !sessionState.participants || sessionState.participants.length === 0) return null
    
    const currentParticipant = sessionState.participants[sessionState.currentTurn]
    return currentParticipant?.address || null
  }

  getCurrentCanvas(sessionState: SessionState | null): string | null {
    if (!sessionState) return null
    return sessionState.currentCanvas
  }

  isHost(sessionState: SessionState | null, address: string): boolean {
    if (!sessionState) return false
    return sessionState.lobbyState.hostAddress === address
  }

  canStartGame(sessionState: SessionState | null): boolean {
    if (!sessionState) return false
    // Require at least 2 players for multiplayer
    return sessionState.participants.length >= 2 && sessionState.participants.length >= sessionState.lobbyState.minPlayers
  }

  getWaitingForParticipants(sessionState: SessionState | null): string[] {
    if (!sessionState || !sessionState.participants) return []
    return sessionState.participants
      .filter(p => !p.hasLocked)
      .map(p => p.address)
  }

  shouldBeInWaitingRoom(sessionState: SessionState | null, address: string): boolean {
    if (!sessionState || !sessionState.participants) return false
    
    const participant = sessionState.participants.find(p => p.address === address)
    
    if (!participant) {
      return false
    }
    
    // If user has already locked, they should be in waiting room
    if (participant.hasLocked) {
      return true
    }
    
    // If it's not their turn, they should be in waiting room
    const currentArtist = this.getCurrentTurnParticipant(sessionState)
    const isCurrentArtist = currentArtist === address
    
    return !isCurrentArtist
  }

  isCurrentArtist(sessionState: SessionState | null, address: string): boolean {
    if (!sessionState) return false
    
    const currentArtist = this.getCurrentTurnParticipant(sessionState)
    const isCurrent = currentArtist === address
    
    console.log('isCurrentArtist:', {
      address: address.slice(0, 6) + '...',
      currentArtist: currentArtist ? currentArtist.slice(0, 6) + '...' : 'null',
      isCurrent,
      currentTurn: sessionState.currentTurn,
      turnSequence: sessionState.turnMetadata?.turnSequence || 0
    })
    
    return isCurrent
  }
}

export const sharedStorage = new SharedStorage() 
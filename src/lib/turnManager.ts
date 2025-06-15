// Dedicated turn management system
interface TurnState {
  sessionId: string
  currentTurn: number
  turnOrder: string[] // Array of participant addresses in turn order
  sessionPhase: 'lobby' | 'drawing' | 'generating' | 'voting' | 'complete'
  isGenerating: boolean
  lastUpdated: number
}

interface DrawingTurn {
  sessionId: string
  address: string
  hasDrawn: boolean
  hasPrompted: boolean
  hasLocked: boolean
  prompt: string
  drawingData: string | null
  turnIndex: number
}

class TurnManager {
  private readonly TURN_KEY_PREFIX = 'turn:'
  private readonly DRAWING_KEY_PREFIX = 'drawing:'

  // Initialize turn state for a session
  async initializeTurnState(sessionId: string, participantAddresses: string[]): Promise<void> {
    try {
      console.log('🎲 INITIALIZING TURN STATE:', {
        sessionId,
        participants: participantAddresses.length,
        participantAddresses: participantAddresses.map(addr => addr.slice(0, 6) + '...')
      })

      // Randomize turn order
      const shuffledOrder = [...participantAddresses].sort(() => Math.random() - 0.5)
      
      const turnState: TurnState = {
        sessionId,
        currentTurn: 0,
        turnOrder: shuffledOrder,
        sessionPhase: 'drawing',
        isGenerating: false,
        lastUpdated: Date.now()
      }

      await this.saveTurnState(sessionId, turnState)

      // Initialize drawing state for each participant
      for (let i = 0; i < shuffledOrder.length; i++) {
        const drawingTurn: DrawingTurn = {
          sessionId,
          address: shuffledOrder[i],
          hasDrawn: false,
          hasPrompted: false,
          hasLocked: false,
          prompt: '',
          drawingData: null,
          turnIndex: i
        }
        await this.saveDrawingTurn(sessionId, shuffledOrder[i], drawingTurn)
      }

      console.log('✅ TURN STATE INITIALIZED:', {
        sessionId,
        currentTurn: 0,
        turnOrder: shuffledOrder.map(addr => addr.slice(0, 6) + '...'),
        startingPlayer: shuffledOrder[0]?.slice(0, 6) + '...'
      })
    } catch (error) {
      console.error('Error initializing turn state:', error)
    }
  }

  // Get current turn state
  async getTurnState(sessionId: string): Promise<TurnState | null> {
    try {
      const response = await fetch(`/api/turns/${sessionId}`)
      if (response.ok) {
        const data = await response.json()
        return data
      }
    } catch (error) {
      console.log('Failed to fetch turn state from API')
    }

    return null
  }

  // Get current artist (who should be drawing)
  async getCurrentArtist(sessionId: string): Promise<string | null> {
    try {
      const turnState = await this.getTurnState(sessionId)
      if (!turnState || turnState.turnOrder.length === 0) return null
      
      return turnState.turnOrder[turnState.currentTurn] || null
    } catch (error) {
      console.error('Error getting current artist:', error)
      return null
    }
  }

  // Check if user is current artist
  async isCurrentArtist(sessionId: string, address: string): Promise<boolean> {
    const currentArtist = await this.getCurrentArtist(sessionId)
    return currentArtist === address
  }

  // Get drawing state for a participant
  async getDrawingTurn(sessionId: string, address: string): Promise<DrawingTurn | null> {
    try {
      const response = await fetch(`/api/turns/${sessionId}/drawing/${address}`)
      if (response.ok) {
        const data = await response.json()
        return data
      }
    } catch (error) {
      console.log('Failed to fetch drawing turn from API')
    }

    return null
  }

  // Update drawing state
  async updateDrawingTurn(sessionId: string, address: string, updates: Partial<DrawingTurn>): Promise<void> {
    try {
      const currentState = await this.getDrawingTurn(sessionId, address) || {
        sessionId,
        address,
        hasDrawn: false,
        hasPrompted: false,
        hasLocked: false,
        prompt: '',
        drawingData: null,
        turnIndex: 0
      }

      const updatedState = { ...currentState, ...updates }
      await this.saveDrawingTurn(sessionId, address, updatedState)

      console.log('📝 DRAWING TURN UPDATED:', {
        sessionId,
        address: address.slice(0, 6) + '...',
        updates: Object.keys(updates),
        hasDrawn: updatedState.hasDrawn,
        hasPrompted: updatedState.hasPrompted,
        hasLocked: updatedState.hasLocked
      })
    } catch (error) {
      console.error('Error updating drawing turn:', error)
    }
  }

  // Lock participant's turn and advance
  async lockTurn(sessionId: string, address: string): Promise<{ success: boolean; nextArtist?: string; phase?: string }> {
    try {
      console.log('🔒 LOCKING TURN:', {
        sessionId,
        address: address.slice(0, 6) + '...'
      })

      const turnState = await this.getTurnState(sessionId)
      if (!turnState) {
        return { success: false }
      }

      const drawingTurn = await this.getDrawingTurn(sessionId, address)
      if (!drawingTurn) {
        return { success: false }
      }

      // Validate it's their turn
      const currentArtist = turnState.turnOrder[turnState.currentTurn]
      if (currentArtist !== address) {
        console.log('❌ NOT THEIR TURN')
        return { success: false }
      }

      // Validate they have completed requirements
      if (!drawingTurn.hasDrawn || !drawingTurn.prompt.trim()) {
        console.log('❌ REQUIREMENTS NOT MET')
        return { success: false }
      }

      // Lock the turn
      await this.updateDrawingTurn(sessionId, address, { hasLocked: true })

      // Check if all participants have locked
      const allLocked = await this.checkAllLocked(sessionId)
      
      if (allLocked) {
        // All participants locked - move to generating phase
        console.log('🎨 ALL PARTICIPANTS LOCKED - MOVING TO GENERATING PHASE')
        await this.updateTurnState(sessionId, {
          sessionPhase: 'generating',
          isGenerating: true
        })
        return { success: true, phase: 'generating' }
      } else {
        // Advance to next turn
        const nextTurn = (turnState.currentTurn + 1) % turnState.turnOrder.length
        await this.updateTurnState(sessionId, { currentTurn: nextTurn })
        
        const nextArtist = turnState.turnOrder[nextTurn]
        console.log('⏭️ ADVANCING TURN:', {
          from: address.slice(0, 6) + '...',
          to: nextArtist?.slice(0, 6) + '...',
          turnIndex: nextTurn
        })
        
        return { success: true, nextArtist }
      }
    } catch (error) {
      console.error('Error locking turn:', error)
      return { success: false }
    }
  }

  // Check if all participants have locked
  async checkAllLocked(sessionId: string): Promise<boolean> {
    try {
      const turnState = await this.getTurnState(sessionId)
      if (!turnState) return false

      for (const address of turnState.turnOrder) {
        const drawingTurn = await this.getDrawingTurn(sessionId, address)
        if (!drawingTurn || !drawingTurn.hasLocked) {
          return false
        }
      }
      return true
    } catch (error) {
      console.error('Error checking all locked:', error)
      return false
    }
  }

  // Update turn state
  async updateTurnState(sessionId: string, updates: Partial<TurnState>): Promise<void> {
    try {
      const currentState = await this.getTurnState(sessionId)
      if (!currentState) return

      const updatedState = { ...currentState, ...updates, lastUpdated: Date.now() }
      await this.saveTurnState(sessionId, updatedState)

      console.log('🔄 TURN STATE UPDATED:', {
        sessionId,
        updates: Object.keys(updates),
        currentTurn: updatedState.currentTurn,
        sessionPhase: updatedState.sessionPhase
      })
    } catch (error) {
      console.error('Error updating turn state:', error)
    }
  }

  // Private methods for API calls
  private async saveTurnState(sessionId: string, turnState: TurnState): Promise<void> {
    try {
      const response = await fetch(`/api/turns/${sessionId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(turnState),
      })

      if (!response.ok) {
        throw new Error('Failed to save turn state')
      }
    } catch (error) {
      console.error('Error saving turn state:', error)
      throw error
    }
  }

  private async saveDrawingTurn(sessionId: string, address: string, drawingTurn: DrawingTurn): Promise<void> {
    try {
      const response = await fetch(`/api/turns/${sessionId}/drawing/${address}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(drawingTurn),
      })

      if (!response.ok) {
        throw new Error('Failed to save drawing turn')
      }
    } catch (error) {
      console.error('Error saving drawing turn:', error)
      throw error
    }
  }
}

export const turnManager = new TurnManager() 
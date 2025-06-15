// Dedicated participant management system
interface Participant {
  address: string
  joinedAt: number
  isActive: boolean
  lastSeen: number
}

interface SessionParticipants {
  sessionId: string
  participants: Participant[]
  hostAddress: string | null
  createdAt: number
  lastUpdated: number
}

class ParticipantManager {
  private readonly PARTICIPANT_KEY_PREFIX = 'participants:'

  // Add participant to session
  async addParticipant(sessionId: string, address: string): Promise<void> {
    try {
      console.log('👥 ADDING PARTICIPANT:', {
        sessionId,
        address: address.slice(0, 6) + '...',
        timestamp: new Date().toISOString()
      })

      const key = this.PARTICIPANT_KEY_PREFIX + sessionId
      const data = await this.getParticipantsData(sessionId)
      
      // Check if participant already exists
      const existingParticipant = data.participants.find(p => p.address === address)
      if (existingParticipant) {
        // Update last seen and mark as active
        existingParticipant.lastSeen = Date.now()
        existingParticipant.isActive = true
        console.log('🔄 PARTICIPANT ALREADY EXISTS - UPDATED LAST SEEN')
      } else {
        // Add new participant
        const newParticipant: Participant = {
          address,
          joinedAt: Date.now(),
          isActive: true,
          lastSeen: Date.now()
        }
        data.participants.push(newParticipant)
        console.log('✅ NEW PARTICIPANT ADDED')
      }

      // Set host if this is the first participant
      if (data.participants.length === 1) {
        data.hostAddress = address
        console.log('👑 SET AS HOST:', address.slice(0, 6) + '...')
      }

      data.lastUpdated = Date.now()
      await this.saveParticipantsData(sessionId, data)

      console.log('📊 PARTICIPANTS UPDATED:', {
        totalParticipants: data.participants.length,
        participantAddresses: data.participants.map(p => p.address.slice(0, 6) + '...'),
        host: data.hostAddress?.slice(0, 6) + '...'
      })
    } catch (error) {
      console.error('Error adding participant:', error)
    }
  }

  // Remove participant from session
  async removeParticipant(sessionId: string, address: string): Promise<void> {
    try {
      console.log('👋 REMOVING PARTICIPANT:', {
        sessionId,
        address: address.slice(0, 6) + '...',
        timestamp: new Date().toISOString()
      })

      const key = this.PARTICIPANT_KEY_PREFIX + sessionId
      const data = await this.getParticipantsData(sessionId)
      
      console.log('📊 BEFORE REMOVAL:', {
        totalParticipants: data.participants.length,
        participantAddresses: data.participants.map(p => p.address.slice(0, 6) + '...')
      })

      // Remove participant
      data.participants = data.participants.filter(p => p.address !== address)
      
      console.log('📊 AFTER REMOVAL:', {
        totalParticipants: data.participants.length,
        participantAddresses: data.participants.map(p => p.address.slice(0, 6) + '...')
      })

      // If host left, assign new host
      if (data.hostAddress === address && data.participants.length > 0) {
        data.hostAddress = data.participants[0].address
        console.log('👑 NEW HOST ASSIGNED:', data.participants[0].address.slice(0, 6) + '...')
      } else if (data.participants.length === 0) {
        data.hostAddress = null
        console.log('❌ NO PARTICIPANTS LEFT - HOST CLEARED')
      }

      data.lastUpdated = Date.now()
      await this.saveParticipantsData(sessionId, data)

      console.log('✅ PARTICIPANT REMOVED SUCCESSFULLY')
    } catch (error) {
      console.error('Error removing participant:', error)
    }
  }

  // Get all participants for a session
  async getParticipants(sessionId: string): Promise<Participant[]> {
    try {
      const data = await this.getParticipantsData(sessionId)
      return data.participants.filter(p => p.isActive)
    } catch (error) {
      console.error('Error getting participants:', error)
      return []
    }
  }

  // Get participant addresses (for compatibility)
  async getParticipantAddresses(sessionId: string): Promise<string[]> {
    const participants = await this.getParticipants(sessionId)
    return participants.map(p => p.address)
  }

  // Check if user is host
  async isHost(sessionId: string, address: string): Promise<boolean> {
    try {
      const data = await this.getParticipantsData(sessionId)
      return data.hostAddress === address
    } catch (error) {
      console.error('Error checking host status:', error)
      return false
    }
  }

  // Get host address
  async getHostAddress(sessionId: string): Promise<string | null> {
    try {
      const data = await this.getParticipantsData(sessionId)
      return data.hostAddress
    } catch (error) {
      console.error('Error getting host address:', error)
      return null
    }
  }

  // Update participant activity (heartbeat)
  async updateActivity(sessionId: string, address: string): Promise<void> {
    try {
      const data = await this.getParticipantsData(sessionId)
      const participant = data.participants.find(p => p.address === address)
      if (participant) {
        participant.lastSeen = Date.now()
        participant.isActive = true
        data.lastUpdated = Date.now()
        await this.saveParticipantsData(sessionId, data)
      }
    } catch (error) {
      console.error('Error updating activity:', error)
    }
  }

  // Clean up inactive participants (optional - for long sessions)
  async cleanupInactiveParticipants(sessionId: string, inactiveThresholdMs: number = 30000): Promise<void> {
    try {
      const data = await this.getParticipantsData(sessionId)
      const now = Date.now()
      const activeParticipants = data.participants.filter(p => 
        p.isActive && (now - p.lastSeen) < inactiveThresholdMs
      )
      
      if (activeParticipants.length !== data.participants.length) {
        console.log('🧹 CLEANING UP INACTIVE PARTICIPANTS:', {
          before: data.participants.length,
          after: activeParticipants.length
        })
        
        data.participants = activeParticipants
        data.lastUpdated = now
        await this.saveParticipantsData(sessionId, data)
      }
    } catch (error) {
      console.error('Error cleaning up inactive participants:', error)
    }
  }

  // Private methods for Redis operations
  private async getParticipantsData(sessionId: string): Promise<SessionParticipants> {
    const key = this.PARTICIPANT_KEY_PREFIX + sessionId
    
    try {
      const response = await fetch(`/api/participants/${sessionId}`)
      if (response.ok) {
        const data = await response.json()
        return data
      }
    } catch (error) {
      console.log('Failed to fetch participants from API, using default')
    }

    // Return default state if no data exists
    return {
      sessionId,
      participants: [],
      hostAddress: null,
      createdAt: Date.now(),
      lastUpdated: Date.now()
    }
  }

  private async saveParticipantsData(sessionId: string, data: SessionParticipants): Promise<void> {
    try {
      const response = await fetch(`/api/participants/${sessionId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        throw new Error('Failed to save participants data')
      }
    } catch (error) {
      console.error('Error saving participants data:', error)
      throw error
    }
  }
}

export const participantManager = new ParticipantManager() 
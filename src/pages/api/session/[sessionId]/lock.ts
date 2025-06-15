import { NextApiRequest, NextApiResponse } from 'next'
import Redis from 'ioredis'

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379')

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { sessionId } = req.query
  const { address } = req.body

  if (!sessionId || typeof sessionId !== 'string' || !address) {
    return res.status(400).json({ error: 'Invalid session ID or address' })
  }

  const key = `session:${sessionId}`

  try {
    console.log('🔒 LOCK REQUEST:', { sessionId, address: address.slice(0, 6) + '...' })

    // Get current session state
    const data = await redis.get(key)
    if (!data) {
      return res.status(404).json({ error: 'Session not found' })
    }

    const sessionData = JSON.parse(data)
    const participantIndex = sessionData.participants.findIndex((p: any) => p.address === address)

    if (participantIndex === -1) {
      return res.status(404).json({ error: 'Participant not found' })
    }

    const participant = sessionData.participants[participantIndex]

    console.log('📊 CURRENT STATE:', {
      currentTurn: sessionData.currentTurn,
      participantIndex,
      hasDrawn: participant.hasDrawn,
      hasPrompt: !!participant.prompt.trim(),
      totalParticipants: sessionData.participants.length,
      lockedCount: sessionData.participants.filter((p: any) => p.hasLocked).length
    })

    // Validate it's their turn
    if (sessionData.currentTurn !== participantIndex) {
      console.log('❌ NOT THEIR TURN')
      return res.status(400).json({ 
        error: 'Not your turn', 
        currentTurn: sessionData.currentTurn,
        participantIndex 
      })
    }

    // Check if they have completed requirements
    if (!participant.hasDrawn || !participant.prompt.trim()) {
      console.log('❌ REQUIREMENTS NOT MET')
      return res.status(400).json({ 
        error: 'Requirements not met',
        hasDrawn: participant.hasDrawn,
        hasPrompt: !!participant.prompt.trim()
      })
    }

    // Mark this participant as locked
    sessionData.participants[participantIndex].hasLocked = true
    
    // Ensure turnMetadata exists
    if (!sessionData.turnMetadata) {
      sessionData.turnMetadata = {
        lastUpdate: Date.now(),
        turnSequence: 0,
        lockedParticipants: []
      }
    }
    
    sessionData.turnMetadata.lockedParticipants.push(address)
    sessionData.turnMetadata.turnSequence++
    sessionData.turnMetadata.lastUpdate = Date.now()

    console.log('✅ PARTICIPANT LOCKED:', {
      address: address.slice(0, 6) + '...',
      lockedCount: sessionData.participants.filter((p: any) => p.hasLocked).length,
      totalParticipants: sessionData.participants.length
    })

    // Check if ALL participants are locked
    const allLocked = sessionData.participants.every((p: any) => p.hasLocked)
    console.log('🔍 ALL LOCKED CHECK:', { allLocked, lockedCount: sessionData.participants.filter((p: any) => p.hasLocked).length })

    if (allLocked) {
      // ALL PARTICIPANTS ARE DONE - Move to generating phase
      console.log('🎨 ALL PARTICIPANTS LOCKED - MOVING TO GENERATING PHASE')
      sessionData.sessionPhase = 'generating'
      sessionData.isGenerating = true

      // Combine prompts and drawings
      const prompts = sessionData.participants
        .filter((p: any) => p.prompt.trim())
        .map((p: any) => p.prompt.trim())
      
      const drawings = sessionData.participants
        .filter((p: any) => p.drawingData)
        .map((p: any) => p.drawingData)
      
      sessionData.combinedPrompt = prompts.length > 0 ? prompts.join(' + ') : 'collaborative artwork'
      sessionData.combinedImage = drawings.length > 0 ? drawings[drawings.length - 1] : null

      await redis.set(key, JSON.stringify(sessionData))
      console.log('🚀 GENERATING PHASE ACTIVATED')
      return res.status(200).json({ 
        success: true, 
        phase: 'generating',
        turnSequence: sessionData.turnMetadata.turnSequence,
        combinedPrompt: sessionData.combinedPrompt,
        combinedImage: sessionData.combinedImage,
        message: 'All participants finished! Moving to AI generation.'
      })
    } else {
      // NOT ALL LOCKED - Find next unlocked participant
      console.log('⏭️ FINDING NEXT TURN')
      let nextTurn = -1
      
      // Start from the next participant after current one
      for (let i = 1; i <= sessionData.participants.length; i++) {
        const checkIndex = (participantIndex + i) % sessionData.participants.length
        if (!sessionData.participants[checkIndex].hasLocked) {
          nextTurn = checkIndex
          break
        }
      }

      if (nextTurn !== -1) {
        console.log('✅ ADVANCING TURN:', { from: participantIndex, to: nextTurn })
        sessionData.currentTurn = nextTurn
        await redis.set(key, JSON.stringify(sessionData))
        return res.status(200).json({ 
          success: true, 
          newTurn: nextTurn,
          turnSequence: sessionData.turnMetadata.turnSequence,
          message: `Turn advanced to participant ${nextTurn + 1}`
        })
      } else {
        console.log('❌ NO NEXT TURN FOUND - THIS SHOULD NOT HAPPEN')
        return res.status(500).json({ error: 'No next turn found' })
      }
    }
  } catch (error) {
    console.error('❌ ERROR IN LOCK API:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
} 
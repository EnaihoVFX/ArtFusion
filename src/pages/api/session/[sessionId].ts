import { NextApiRequest, NextApiResponse } from 'next'
import Redis from 'ioredis'

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379')

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { sessionId } = req.query

  if (!sessionId || typeof sessionId !== 'string') {
    return res.status(400).json({ error: 'Invalid session ID' })
  }

  const key = `session:${sessionId}`

  switch (req.method) {
    case 'GET':
      try {
        const data = await redis.get(key)
        if (data) {
          const sessionData = JSON.parse(data)
          console.log('Session API GET:', {
            sessionId,
            currentTurn: sessionData.currentTurn,
            sessionPhase: sessionData.sessionPhase,
            participants: sessionData.participants?.map((p: any, i: number) => ({
              index: i,
              address: p.address.slice(0, 6) + '...',
              hasLocked: p.hasLocked,
              isCurrentTurn: i === sessionData.currentTurn
            }))
          })
          return res.status(200).json(sessionData)
        } else {
          // Return default state if session doesn't exist
          const defaultState = {
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
          return res.status(200).json(defaultState)
        }
      } catch (error) {
        console.error('Error getting session:', error)
        return res.status(500).json({ error: 'Failed to get session' })
      }

    case 'POST':
      try {
        const sessionData = req.body
        
        // PROTECTION: Prevent empty participants array from being set
        if (sessionData.participants && Array.isArray(sessionData.participants) && sessionData.participants.length === 0) {
          console.log('🚨 BLOCKED ATTEMPT TO SET EMPTY PARTICIPANTS ARRAY:', {
            sessionId,
            currentTurn: sessionData.currentTurn,
            sessionPhase: sessionData.sessionPhase,
            stackTrace: new Error().stack?.split('\n').slice(1, 5).join('\n')
          })
          return res.status(400).json({ error: 'Cannot set empty participants array' })
        }
        
        console.log('Session API POST:', {
          sessionId,
          currentTurn: sessionData.currentTurn,
          sessionPhase: sessionData.sessionPhase,
          participants: sessionData.participants?.map((p: any, i: number) => ({
            index: i,
            address: p.address.slice(0, 6) + '...',
            hasLocked: p.hasLocked,
            isCurrentTurn: i === sessionData.currentTurn
          }))
        })
        await redis.set(key, JSON.stringify(sessionData))
        return res.status(200).json({ success: true })
      } catch (error) {
        console.error('Error setting session:', error)
        return res.status(500).json({ error: 'Failed to set session' })
      }

    case 'DELETE':
      try {
        await redis.del(key)
        return res.status(200).json({ success: true })
      } catch (error) {
        console.error('Error deleting session:', error)
        return res.status(500).json({ error: 'Failed to delete session' })
      }

    default:
      return res.status(405).json({ error: 'Method not allowed' })
  }
} 
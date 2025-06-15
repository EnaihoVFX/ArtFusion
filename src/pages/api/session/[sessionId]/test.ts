import { NextApiRequest, NextApiResponse } from 'next'
import Redis from 'ioredis'

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379')

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { sessionId } = req.query

  if (!sessionId || typeof sessionId !== 'string') {
    return res.status(400).json({ error: 'Invalid session ID' })
  }

  const key = `session:${sessionId}`

  try {
    const data = await redis.get(key)
    
    if (data) {
      const sessionData = JSON.parse(data)
      
      // Add some computed fields for debugging
      const debugInfo = {
        sessionId,
        currentTurn: sessionData.currentTurn,
        sessionPhase: sessionData.sessionPhase,
        participants: sessionData.participants?.map((p: any, i: number) => ({
          index: i,
          address: p.address.slice(0, 6) + '...',
          hasLocked: p.hasLocked,
          hasDrawn: p.hasDrawn,
          hasPrompt: !!p.prompt.trim(),
          isCurrentTurn: i === sessionData.currentTurn
        })),
        turnMetadata: sessionData.turnMetadata,
        lockedCount: sessionData.participants?.filter((p: any) => p.hasLocked).length || 0,
        totalParticipants: sessionData.participants?.length || 0,
        allLocked: sessionData.participants?.every((p: any) => p.hasLocked) || false
      }
      
      return res.status(200).json(debugInfo)
    } else {
      return res.status(404).json({ error: 'Session not found' })
    }
  } catch (error) {
    console.error('Error in test API:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
} 
import { NextApiRequest, NextApiResponse } from 'next'
import Redis from 'ioredis'

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379')

interface TurnState {
  sessionId: string
  currentTurn: number
  turnOrder: string[]
  sessionPhase: 'lobby' | 'drawing' | 'generating' | 'voting' | 'complete'
  isGenerating: boolean
  lastUpdated: number
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { sessionId } = req.query

  if (!sessionId || typeof sessionId !== 'string') {
    return res.status(400).json({ error: 'Invalid session ID' })
  }

  const key = `turn:${sessionId}`

  switch (req.method) {
    case 'GET':
      try {
        const data = await redis.get(key)
        if (data) {
          const turnState = JSON.parse(data)
          console.log('Turn API GET:', {
            sessionId,
            currentTurn: turnState.currentTurn,
            sessionPhase: turnState.sessionPhase,
            turnOrder: turnState.turnOrder?.map((addr: string) => addr.slice(0, 6) + '...') || []
          })
          return res.status(200).json(turnState)
        } else {
          console.log('Turn API GET - No data found')
          return res.status(404).json({ error: 'Turn state not found' })
        }
      } catch (error) {
        console.error('Error getting turn state:', error)
        return res.status(500).json({ error: 'Failed to get turn state' })
      }

    case 'POST':
      try {
        const turnState = req.body
        
        console.log('Turn API POST:', {
          sessionId,
          currentTurn: turnState.currentTurn,
          sessionPhase: turnState.sessionPhase,
          turnOrder: turnState.turnOrder?.map((addr: string) => addr.slice(0, 6) + '...') || []
        })

        await redis.set(key, JSON.stringify(turnState))
        return res.status(200).json({ success: true })
      } catch (error) {
        console.error('Error setting turn state:', error)
        return res.status(500).json({ error: 'Failed to set turn state' })
      }

    case 'DELETE':
      try {
        await redis.del(key)
        console.log('Turn API DELETE:', { sessionId })
        return res.status(200).json({ success: true })
      } catch (error) {
        console.error('Error deleting turn state:', error)
        return res.status(500).json({ error: 'Failed to delete turn state' })
      }

    default:
      return res.status(405).json({ error: 'Method not allowed' })
  }
} 
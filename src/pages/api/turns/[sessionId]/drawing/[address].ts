import { NextApiRequest, NextApiResponse } from 'next'
import Redis from 'ioredis'

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379')

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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { sessionId, address } = req.query

  if (!sessionId || typeof sessionId !== 'string' || !address || typeof address !== 'string') {
    return res.status(400).json({ error: 'Invalid session ID or address' })
  }

  const key = `drawing:${sessionId}:${address}`

  switch (req.method) {
    case 'GET':
      try {
        const data = await redis.get(key)
        if (data) {
          const drawingTurn = JSON.parse(data)
          console.log('Drawing Turn API GET:', {
            sessionId,
            address: address.slice(0, 6) + '...',
            hasDrawn: drawingTurn.hasDrawn,
            hasPrompted: drawingTurn.hasPrompted,
            hasLocked: drawingTurn.hasLocked,
            hasPrompt: !!drawingTurn.prompt.trim(),
            hasDrawingData: !!drawingTurn.drawingData
          })
          return res.status(200).json(drawingTurn)
        } else {
          console.log('Drawing Turn API GET - No data found')
          return res.status(404).json({ error: 'Drawing turn not found' })
        }
      } catch (error) {
        console.error('Error getting drawing turn:', error)
        return res.status(500).json({ error: 'Failed to get drawing turn' })
      }

    case 'POST':
      try {
        const drawingTurn = req.body
        
        console.log('Drawing Turn API POST:', {
          sessionId,
          address: address.slice(0, 6) + '...',
          hasDrawn: drawingTurn.hasDrawn,
          hasPrompted: drawingTurn.hasPrompted,
          hasLocked: drawingTurn.hasLocked,
          hasPrompt: !!drawingTurn.prompt?.trim(),
          hasDrawingData: !!drawingTurn.drawingData
        })

        await redis.set(key, JSON.stringify(drawingTurn))
        return res.status(200).json({ success: true })
      } catch (error) {
        console.error('Error setting drawing turn:', error)
        return res.status(500).json({ error: 'Failed to set drawing turn' })
      }

    case 'DELETE':
      try {
        await redis.del(key)
        console.log('Drawing Turn API DELETE:', { sessionId, address: address.slice(0, 6) + '...' })
        return res.status(200).json({ success: true })
      } catch (error) {
        console.error('Error deleting drawing turn:', error)
        return res.status(500).json({ error: 'Failed to delete drawing turn' })
      }

    default:
      return res.status(405).json({ error: 'Method not allowed' })
  }
} 
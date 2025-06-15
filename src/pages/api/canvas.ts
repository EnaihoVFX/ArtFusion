import { NextApiRequest, NextApiResponse } from 'next'
import { getCanvasState, updateCanvasState, addParticipant, getParticipants, removeParticipant, cleanupRedisConnections } from '@/lib/redis'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { sessionId } = req.query

    if (!sessionId || typeof sessionId !== 'string') {
      return res.status(400).json({ error: 'Invalid session ID' })
    }

    switch (req.method) {
      case 'GET':
        try {
          const canvasState = await getCanvasState(sessionId)
          const participants = await getParticipants(sessionId)
          return res.status(200).json({ canvasState, participants })
        } catch (error) {
          console.error('Error getting canvas state:', error)
          return res.status(500).json({ error: 'Failed to get canvas state' })
        }

      case 'POST':
        try {
          const { imageData, address } = req.body

          if (!imageData) {
            return res.status(400).json({ error: 'Image data is required' })
          }

          await updateCanvasState(sessionId, imageData)
          if (address) {
            await addParticipant(sessionId, address)
          }

          return res.status(200).json({ success: true })
        } catch (error) {
          console.error('Error updating canvas state:', error)
          return res.status(500).json({ error: 'Failed to update canvas state' })
        }

      case 'DELETE':
        try {
          const { address } = req.body
          if (address) {
            await removeParticipant(sessionId, address)
          }
          return res.status(200).json({ success: true })
        } catch (error) {
          console.error('Error removing participant:', error)
          return res.status(500).json({ error: 'Failed to remove participant' })
        }

      default:
        return res.status(405).json({ error: 'Method not allowed' })
    }
  } catch (error) {
    console.error('Canvas API error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  } finally {
    // Cleanup Redis connections after each request
    await cleanupRedisConnections()
  }
} 
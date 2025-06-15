import { NextApiRequest, NextApiResponse } from 'next'
import Redis from 'ioredis'

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379')

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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { sessionId } = req.query

  if (!sessionId || typeof sessionId !== 'string') {
    return res.status(400).json({ error: 'Invalid session ID' })
  }

  const key = `participants:${sessionId}`

  switch (req.method) {
    case 'GET':
      try {
        const data = await redis.get(key)
        if (data) {
          const participantsData = JSON.parse(data)
          console.log('Participants API GET:', {
            sessionId,
            totalParticipants: participantsData.participants?.length || 0,
            participantAddresses: participantsData.participants?.map((p: any) => p.address.slice(0, 6) + '...') || [],
            host: participantsData.hostAddress?.slice(0, 6) + '...'
          })
          return res.status(200).json(participantsData)
        } else {
          // Return default state if no participants data exists
          const defaultState: SessionParticipants = {
            sessionId,
            participants: [],
            hostAddress: null,
            createdAt: Date.now(),
            lastUpdated: Date.now()
          }
          console.log('Participants API GET - No data found, returning default')
          return res.status(200).json(defaultState)
        }
      } catch (error) {
        console.error('Error getting participants:', error)
        return res.status(500).json({ error: 'Failed to get participants' })
      }

    case 'POST':
      try {
        const participantsData = req.body
        
        // Validate the data structure
        if (!participantsData.participants || !Array.isArray(participantsData.participants)) {
          return res.status(400).json({ error: 'Invalid participants data' })
        }

        console.log('Participants API POST:', {
          sessionId,
          totalParticipants: participantsData.participants?.length || 0,
          participantAddresses: participantsData.participants?.map((p: any) => p.address.slice(0, 6) + '...') || [],
          host: participantsData.hostAddress?.slice(0, 6) + '...'
        })

        await redis.set(key, JSON.stringify(participantsData))
        return res.status(200).json({ success: true })
      } catch (error) {
        console.error('Error setting participants:', error)
        return res.status(500).json({ error: 'Failed to set participants' })
      }

    case 'DELETE':
      try {
        await redis.del(key)
        console.log('Participants API DELETE:', { sessionId })
        return res.status(200).json({ success: true })
      } catch (error) {
        console.error('Error deleting participants:', error)
        return res.status(500).json({ error: 'Failed to delete participants' })
      }

    default:
      return res.status(405).json({ error: 'Method not allowed' })
  }
} 
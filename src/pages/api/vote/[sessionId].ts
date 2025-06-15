import { NextApiRequest, NextApiResponse } from 'next'
import Redis from 'ioredis'

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379')

interface VoteRequest {
  imageIndex: number
  voterAddress: string
}

interface VoteResponse {
  success: boolean
  message?: string
  error?: string
  votes?: { [key: string]: number }
  winner?: number
  finalImage?: {
    image: string
    combinedPrompt: string
    winner: number
    votes: { [key: string]: number }
    completedAt: string
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<VoteResponse>) {
  const { sessionId } = req.query

  if (!sessionId || typeof sessionId !== 'string') {
    return res.status(400).json({ success: false, error: 'Invalid session ID' })
  }

  const voteKey = `votes:${sessionId}`

  switch (req.method) {
    case 'POST':
      try {
        const { imageIndex, voterAddress } = req.body as VoteRequest

        if (typeof imageIndex !== 'number' || !voterAddress) {
          return res.status(400).json({ success: false, error: 'Invalid vote data' })
        }

        console.log('🗳️ VOTE RECEIVED:', {
          sessionId,
          voterAddress: voterAddress.slice(0, 6) + '...',
          imageIndex,
          timestamp: new Date().toISOString()
        })

        // Get current votes
        const currentVotesData = await redis.get(voteKey)
        const currentVotes: { [key: string]: number } = currentVotesData ? JSON.parse(currentVotesData) : {}

        // Add vote
        currentVotes[voterAddress] = imageIndex

        // Save updated votes
        await redis.set(voteKey, JSON.stringify(currentVotes))

        // Check if all participants have voted
        const turnStateData = await redis.get(`turn:${sessionId}`)
        if (turnStateData) {
          const turnState = JSON.parse(turnStateData)
          const allVoted = turnState.turnOrder.every((address: string) => currentVotes[address])

          if (allVoted) {
            // Calculate winner
            const voteCounts: { [key: number]: number } = {}
            Object.values(currentVotes).forEach((vote: number) => {
              voteCounts[vote] = (voteCounts[vote] || 0) + 1
            })

            const winner = Object.entries(voteCounts).reduce((a, b) => 
              voteCounts[Number(a[0])] > voteCounts[Number(b[0])] ? a : b
            )[0]

            console.log('🏆 VOTING COMPLETE:', {
              sessionId,
              votes: currentVotes,
              voteCounts,
              winner: Number(winner)
            })

            // Store the winning image
            const generatedImagesKey = `generated_images:${sessionId}`
            const generatedImagesData = await redis.get(generatedImagesKey)
            
            if (generatedImagesData) {
              const generatedImages = JSON.parse(generatedImagesData)
              const winningImage = generatedImages.images[Number(winner)]
              
              // Store the final winning image
              const finalImageKey = `final_image:${sessionId}`
              await redis.setex(finalImageKey, 3600, JSON.stringify({
                image: winningImage,
                combinedPrompt: generatedImages.combinedPrompt,
                winner: Number(winner),
                votes: currentVotes,
                completedAt: new Date().toISOString()
              }))
              
              console.log('🏆 FINAL IMAGE STORED:', {
                sessionId,
                winner: Number(winner),
                imageSize: winningImage?.length || 0
              })
            }

            return res.status(200).json({
              success: true,
              message: 'Vote recorded and voting complete',
              votes: currentVotes,
              winner: Number(winner)
            })
          }
        }

        return res.status(200).json({
          success: true,
          message: 'Vote recorded',
          votes: currentVotes
        })

      } catch (error) {
        console.error('Error recording vote:', error)
        return res.status(500).json({ success: false, error: 'Failed to record vote' })
      }

    case 'GET':
      try {
        const votesData = await redis.get(voteKey)
        const votes: { [key: string]: number } = votesData ? JSON.parse(votesData) : {}

        // Also try to get the final winning image
        const finalImageKey = `final_image:${sessionId}`
        const finalImageData = await redis.get(finalImageKey)
        const finalImage = finalImageData ? JSON.parse(finalImageData) : null

        return res.status(200).json({
          success: true,
          votes,
          finalImage
        })

      } catch (error) {
        console.error('Error getting votes:', error)
        return res.status(500).json({ success: false, error: 'Failed to get votes' })
      }

    default:
      return res.status(405).json({ success: false, error: 'Method not allowed' })
  }
} 
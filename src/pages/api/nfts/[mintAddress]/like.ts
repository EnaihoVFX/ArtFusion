import { NextApiRequest, NextApiResponse } from 'next'
import { Redis } from 'ioredis'

// Initialize Redis
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379')

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { mintAddress } = req.query

  if (!mintAddress || typeof mintAddress !== 'string') {
    return res.status(400).json({ error: 'Mint address is required' })
  }

  try {
    // Get current likes
    const currentLikes = await redis.hget(`nft:${mintAddress}`, 'likes') || '0'
    const newLikes = parseInt(currentLikes) + 1
    
    // Update likes in Redis
    await redis.hset(`nft:${mintAddress}`, 'likes', newLikes.toString())
    
    // Update valuation based on likes (simple algorithm)
    const newValuation = Math.floor(newLikes * 100) // $100 per like
    await redis.hset(`nft:${mintAddress}`, 'valuation', newValuation.toString())
    
    console.log(`NFT ${mintAddress} liked! New likes: ${newLikes}, New valuation: $${newValuation}`)
    
    res.status(200).json({ 
      likes: newLikes,
      valuation: newValuation
    })
  } catch (error) {
    console.error('Error liking NFT:', error)
    res.status(500).json({ error: 'Failed to like NFT' })
  }
} 
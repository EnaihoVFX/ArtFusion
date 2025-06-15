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
    // Get current NFT data
    const nftData = await redis.hgetall(`nft:${mintAddress}`)
    
    if (!nftData || Object.keys(nftData).length === 0) {
      return res.status(404).json({ error: 'NFT not found' })
    }

    const currentLikes = parseInt(nftData.likes || '0')
    const currentValuation = parseInt(nftData.valuation || '0')
    const isForSale = nftData.isForSale === 'true'
    const price = parseFloat(nftData.price || '0')
    
    // Calculate new valuation using a more sophisticated algorithm
    let newValuation = currentValuation
    
    // Base valuation from likes
    const baseValuation = currentLikes * 100
    
    // Market sentiment factor (random walk for demo)
    const marketFactor = 0.8 + Math.random() * 0.4 // 0.8 to 1.2
    
    // Time factor (older NFTs might be more valuable)
    const createdAt = new Date(nftData.createdAt || Date.now())
    const daysSinceCreation = Math.max(1, (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24))
    const timeFactor = Math.log(daysSinceCreation + 1) * 0.1 + 1
    
    // Collaborative factor
    const collaborators = nftData.collaborators ? JSON.parse(nftData.collaborators) : []
    const collaborativeFactor = collaborators.length > 1 ? 1.5 : 1.0
    
    // Calculate final valuation
    newValuation = Math.floor(baseValuation * marketFactor * timeFactor * collaborativeFactor)
    
    // Ensure minimum valuation
    newValuation = Math.max(newValuation, 100)
    
    // If NFT is for sale, consider the listing price
    if (isForSale && price > 0) {
      const solPrice = 100 // Assume 1 SOL = $100 for demo
      const priceInUSD = price * solPrice
      newValuation = Math.floor((newValuation + priceInUSD) / 2)
    }
    
    // Update valuation in Redis
    await redis.hset(`nft:${mintAddress}`, 'valuation', newValuation.toString())
    
    console.log(`NFT ${mintAddress} valuation updated! New valuation: $${newValuation}`)
    
    res.status(200).json({ 
      valuation: newValuation,
      factors: {
        baseValuation,
        marketFactor: Math.round(marketFactor * 100) / 100,
        timeFactor: Math.round(timeFactor * 100) / 100,
        collaborativeFactor,
        finalValuation: newValuation
      }
    })
  } catch (error) {
    console.error('Error updating NFT valuation:', error)
    res.status(500).json({ error: 'Failed to update NFT valuation' })
  }
} 
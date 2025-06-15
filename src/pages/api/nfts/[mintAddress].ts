import { NextApiRequest, NextApiResponse } from 'next'
import { Redis } from 'ioredis'

// Initialize Redis
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379')

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { mintAddress } = req.query

  if (!mintAddress || typeof mintAddress !== 'string') {
    return res.status(400).json({ error: 'Mint address is required' })
  }

  try {
    // Get NFT data from Redis
    const nftData = await redis.hgetall(`nft:${mintAddress}`)
    
    if (!nftData || Object.keys(nftData).length === 0) {
      return res.status(404).json({ error: 'NFT not found' })
    }

    // Parse collaborators from JSON string
    const collaborators = nftData.collaborators ? JSON.parse(nftData.collaborators) : []

    // Handle image URL - check if it's a base64 data URL or local file URL
    let imageUrl = nftData.image || ''
    if (imageUrl.startsWith('/api/nft-image/')) {
      // It's a local file URL, keep as is
      imageUrl = imageUrl
    } else if (imageUrl.startsWith('data:image/')) {
      // It's a base64 data URL, keep as is
      imageUrl = imageUrl
    } else if (!imageUrl.startsWith('http')) {
      // It might be a relative path, make it absolute
      imageUrl = imageUrl.startsWith('/') ? imageUrl : `/${imageUrl}`
    }

    // Return the NFT data
    res.status(200).json({
      mintAddress,
      title: nftData.title || 'Untitled NFT',
      image: imageUrl,
      owner: nftData.owner || nftData.creator,
      collaborators,
      sessionId: nftData.sessionId,
      createdAt: nftData.createdAt,
      description: nftData.description || 'ArtFusion NFT',
      likes: parseInt(nftData.likes || '0'),
      valuation: parseInt(nftData.valuation || '0'),
      isCollaborative: nftData.isCollaborative === 'true',
      isForSale: nftData.isForSale === 'true',
      price: parseFloat(nftData.price || '0')
    })
  } catch (error) {
    console.error('Error fetching NFT:', error)
    res.status(500).json({ error: 'Failed to fetch NFT' })
  }
} 
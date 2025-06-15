import type { NextApiRequest, NextApiResponse } from 'next'
import { Redis } from 'ioredis'
import fs from 'fs'
import path from 'path'

// Initialize Redis
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379')

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { mintAddress } = req.query
    const { price, sellerAddress } = req.body

    if (!mintAddress || typeof mintAddress !== 'string') {
      return res.status(400).json({ error: 'Invalid mint address' })
    }

    if (!price || !sellerAddress) {
      return res.status(400).json({ error: 'Price and seller address are required' })
    }

    console.log(`Listing NFT ${mintAddress} for sale at ${price} SOL by ${sellerAddress}`)

    // Verify ownership
    let nftData: any = null
    
    try {
      // Try to get from Redis
      const collaborators = await redis.hget(`nft:${mintAddress}`, 'collaborators')
      const owner = await redis.hget(`nft:${mintAddress}`, 'owner')
      
      if (collaborators) {
        nftData = {
          mintAddress,
          collaborators: JSON.parse(collaborators),
          owner
        }
      }
    } catch (redisError) {
      // Fallback: Read from local file
      const nftsFile = path.join(process.cwd(), 'storage', 'nfts.json')
      if (fs.existsSync(nftsFile)) {
        const nfts = JSON.parse(fs.readFileSync(nftsFile, 'utf8'))
        nftData = nfts.find((nft: any) => nft.mintAddress === mintAddress)
      }
    }

    if (!nftData) {
      return res.status(404).json({ error: 'NFT not found' })
    }

    // Check if seller is owner or collaborator
    const isOwner = nftData.owner === sellerAddress
    const isCollaborator = nftData.collaborators.some((collaborator: any) => 
      collaborator.address === sellerAddress
    )

    if (!isOwner && !isCollaborator) {
      return res.status(403).json({ error: 'Not authorized to sell this NFT' })
    }

    // Update NFT listing
    try {
      await redis.hset(`nft:${mintAddress}`, {
        isForSale: 'true',
        price: price.toString(),
        listedBy: sellerAddress,
        listedAt: new Date().toISOString()
      })
    } catch (redisError) {
      // Update local file
      const nftsFile = path.join(process.cwd(), 'storage', 'nfts.json')
      if (fs.existsSync(nftsFile)) {
        const nfts = JSON.parse(fs.readFileSync(nftsFile, 'utf8'))
        const nftIndex = nfts.findIndex((nft: any) => nft.mintAddress === mintAddress)
        if (nftIndex !== -1) {
          nfts[nftIndex] = {
            ...nfts[nftIndex],
            isForSale: true,
            price: parseFloat(price),
            listedBy: sellerAddress,
            listedAt: new Date().toISOString()
          }
          fs.writeFileSync(nftsFile, JSON.stringify(nfts, null, 2))
        }
      }
    }

    return res.status(200).json({
      success: true,
      message: 'NFT listed for sale successfully',
      mintAddress,
      price: parseFloat(price),
      sellerAddress
    })

  } catch (error) {
    console.error('Error listing NFT:', error)
    return res.status(500).json({ 
      error: 'Failed to list NFT',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
} 
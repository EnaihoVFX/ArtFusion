import { NextApiRequest, NextApiResponse } from 'next'
import { Connection, PublicKey } from '@solana/web3.js'
import { Metaplex } from '@metaplex-foundation/js'
import { Redis } from 'ioredis'

// Initialize Solana connection
const connection = new Connection('https://api.devnet.solana.com', 'confirmed')
const metaplex = new Metaplex(connection)

// Initialize Redis
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379')

// Helper function to ensure image URL is absolute
function ensureAbsoluteImageUrl(imageUrl: string | undefined, baseUrl: string): string | null {
  if (!imageUrl) return null
  
  // If it's already an absolute URL, return as is
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
    return imageUrl
  }
  
  // If it's a relative URL starting with /, make it absolute
  if (imageUrl.startsWith('/')) {
    return `${baseUrl}${imageUrl}`
  }
  
  // If it's a data URL, return as is
  if (imageUrl.startsWith('data:')) {
    return imageUrl
  }
  
  // Default fallback
  return imageUrl
}

// Helper function to decode base64 metadata
function decodeMetadataUri(uri: string): any {
  try {
    if (uri.startsWith('data:application/json;base64,')) {
      const base64Data = uri.replace('data:application/json;base64,', '')
      const jsonString = Buffer.from(base64Data, 'base64').toString('utf-8')
      return JSON.parse(jsonString)
    }
    return null
  } catch (error) {
    console.error('Error decoding metadata URI:', error)
    return null
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    let nfts = []
    
    try {
      // Try to get NFTs from Redis
      const mintAddresses = await redis.smembers('nfts')
      
      // Fetch NFT data from Solana
      const redisNfts = await Promise.all(
        mintAddresses.map(async (mintAddress) => {
          try {
            // Get NFT metadata from Solana
            const nft = await metaplex.nfts().findByMint({ mintAddress: new PublicKey(mintAddress) })
            
            // Get likes and valuation from Redis
            const likes = await redis.hget(`nft:${mintAddress}`, 'likes') || '0'
            const valuation = await redis.hget(`nft:${mintAddress}`, 'valuation') || '0'
            const collaborators = await redis.hget(`nft:${mintAddress}`, 'collaborators') || '[]'
            const isCollaborative = await redis.hget(`nft:${mintAddress}`, 'isCollaborative') || 'false'
            const isForSale = await redis.hget(`nft:${mintAddress}`, 'isForSale') || 'false'
            const price = await redis.hget(`nft:${mintAddress}`, 'price') || '0'
            const owner = await redis.hget(`nft:${mintAddress}`, 'owner')
            
            // Decode metadata from base64 URI if needed
            let imageUrl = nft.json?.image
            if (!imageUrl && nft.uri) {
              const decodedMetadata = decodeMetadataUri(nft.uri)
              if (decodedMetadata) {
                imageUrl = decodedMetadata.image
              }
            }
            
            // Ensure image URL is absolute
            const baseUrl = `${req.headers['x-forwarded-proto'] || 'http'}://${req.headers.host}`
            const absoluteImageUrl = ensureAbsoluteImageUrl(imageUrl, baseUrl)
            
            return {
              mintAddress,
              title: nft.name,
              image: absoluteImageUrl,
              likes: parseInt(likes),
              valuation: parseInt(valuation),
              creator: (nft as any).creatorAddress?.toString() || 'Unknown',
              createdAt: (nft as any).createdAt?.toISOString() || new Date().toISOString(),
              collaborators: JSON.parse(collaborators),
              isCollaborative: isCollaborative === 'true',
              isForSale: isForSale === 'true',
              price: parseFloat(price),
              owner: owner || (nft as any).creatorAddress?.toString()
            }
          } catch (error) {
            console.error(`Error fetching NFT ${mintAddress}:`, error)
            return null
          }
        })
      )
      
      nfts = redisNfts.filter(nft => nft !== null)
    } catch (redisError) {
      console.error('Redis error, trying local file:', redisError)
      
      // Fallback: Read from local file
      const fs = require('fs')
      const path = require('path')
      const nftsFile = path.join(process.cwd(), 'storage', 'nfts.json')
      
      if (fs.existsSync(nftsFile)) {
        nfts = JSON.parse(fs.readFileSync(nftsFile, 'utf8'))
        console.log('Loaded NFTs from local file:', nfts.length)
        
        // Ensure image URLs are absolute for local file NFTs too
        const baseUrl = `${req.headers['x-forwarded-proto'] || 'http'}://${req.headers.host}`
        nfts = nfts.map((nft: any) => ({
          ...nft,
          image: ensureAbsoluteImageUrl(nft.image, baseUrl)
        }))
      }
    }

    return res.status(200).json(nfts)
  } catch (error) {
    console.error('Error fetching NFTs:', error)
    return res.status(500).json({ error: 'Failed to fetch NFTs' })
  }
} 
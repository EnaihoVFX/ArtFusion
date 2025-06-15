import type { NextApiRequest, NextApiResponse } from 'next'
import { Connection, Keypair, PublicKey } from '@solana/web3.js'
import { Metaplex, keypairIdentity, toMetaplexFile } from '@metaplex-foundation/js'
import { TokenStandard } from '@metaplex-foundation/mpl-token-metadata'
import fs from 'fs'
import path from 'path'
import { Redis } from 'ioredis'

// Initialize Solana connection to Devnet
const connection = new Connection('https://api.devnet.solana.com', 'confirmed')

// Initialize Metaplex with the generated keypair
const privateKeyBase64 = 'Wfx0rG8RvYUKYqA70iCoINkAfUYrF0FQkzz5+gHCdfLOi8Fwa0mNuJKwfwuKukhHNNfgKhdMhl6bRbspqwtXSA=='
const privateKey = Buffer.from(privateKeyBase64, 'base64')
const keypair = Keypair.fromSecretKey(privateKey)

const metaplex = new Metaplex(connection).use(keypairIdentity(keypair))

// Initialize Redis
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379')

// Ensure storage directory exists
const STORAGE_DIR = path.join(process.cwd(), 'storage', 'nfts')
if (!fs.existsSync(STORAGE_DIR)) {
  fs.mkdirSync(STORAGE_DIR, { recursive: true })
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { image, title, collaborators, recipient } = req.body

    if (!image || !title) {
      return res.status(400).json({ error: 'Image and title are required' })
    }

    // Use provided collaborators or default to single creator
    const nftCollaborators = collaborators || [{
      address: recipient || keypair.publicKey.toString(),
      stake: 100,
      role: 'creator'
    }]

    // Validate collaborators data
    const totalStake = nftCollaborators.reduce((sum: number, c: any) => sum + (c.stake || 0), 0)
    if (totalStake !== 100) {
      return res.status(400).json({ error: 'Total collaborator stakes must equal 100%' })
    }

    // Check if account exists and has enough SOL (for the server wallet)
    const balance = await connection.getBalance(keypair.publicKey)
    if (balance === 0) {
      return res.status(400).json({ 
        error: 'Account has no SOL. Please get some Devnet SOL from https://faucet.solana.com/',
        publicKey: keypair.publicKey.toString()
      })
    }

    console.log('Minting NFT for:', title)
    console.log('Account balance:', balance / 1e9, 'SOL')
    console.log('Image type:', image.substring(0, 50) + '...')

    // Convert base64 image to buffer or fetch image from URL
    let imageBuffer: Buffer
    
    if (image.startsWith('data:image/')) {
      // Handle base64 image
      console.log('Processing base64 image')
      const base64Data = image.split(',')[1]
      if (!base64Data) {
        return res.status(400).json({ error: 'Invalid base64 image data' })
      }
      imageBuffer = Buffer.from(base64Data, 'base64')
      console.log('Base64 image converted to buffer, size:', imageBuffer.length)
    } else if (image.startsWith('http')) {
      // Handle URL image - fetch and convert to buffer
      console.log('Processing URL image')
      try {
        const imageResponse = await fetch(image)
        if (!imageResponse.ok) {
          throw new Error('Failed to fetch image from URL')
        }
        const arrayBuffer = await imageResponse.arrayBuffer()
        imageBuffer = Buffer.from(arrayBuffer)
        console.log('URL image converted to buffer, size:', imageBuffer.length)
      } catch (fetchError) {
        console.error('Error fetching image:', fetchError)
        return res.status(400).json({ error: 'Failed to fetch image from URL' })
      }
    } else {
      console.log('Unknown image format:', image.substring(0, 100))
      return res.status(400).json({ error: 'Invalid image format. Must be base64 or URL.' })
    }
    
    // Generate a unique filename for the image
    const imageId = Date.now().toString()
    const imageFilename = `${imageId}.png`
    const imagePath = path.join(STORAGE_DIR, imageFilename)
    
    console.log('Saving image to:', imagePath)
    
    // Save image to local storage
    fs.writeFileSync(imagePath, imageBuffer)
    console.log('Image saved successfully')
    
    // Create a local URL for the image
    const imageUrl = `/api/nft-image/${imageFilename}`
    console.log('Image URL created:', imageUrl)

    // Create minimal metadata to keep URI short
    const metadata = {
      name: title,
      description: 'ArtFusion NFT',
      image: imageUrl
    }

    // Create a very short metadata URI
    const metadataUri = `data:application/json;base64,${Buffer.from(JSON.stringify(metadata)).toString('base64')}`

    console.log('Metadata URI length:', metadataUri.length)

    // Mint NFT to the server wallet
    console.log('Creating NFT...')
    const { nft } = await metaplex.nfts().create({
      uri: metadataUri,
      name: title,
      sellerFeeBasisPoints: 500, // 5% royalty
      tokenStandard: TokenStandard.NonFungible,
    })

    const mintAddress = nft.address.toString()
    let finalOwner = keypair.publicKey

    // If recipient is provided and is not the server wallet, transfer the NFT
    if (recipient && recipient !== keypair.publicKey.toString()) {
      try {
        const recipientPublicKey = new PublicKey(recipient)
        await metaplex.nfts().transfer({
          nftOrSft: nft,
          toOwner: recipientPublicKey,
        })
        finalOwner = recipientPublicKey
        console.log('NFT transferred to recipient:', recipient)
      } catch (transferError) {
        console.error('Error transferring NFT to recipient:', transferError)
        // Optionally, you can return an error here if transfer is critical
      }
    }

    console.log('NFT minted successfully:', mintAddress)

    // Store NFT in Redis for marketplace
    try {
      console.log('Storing NFT in Redis...')
      console.log('Mint address:', mintAddress)
      console.log('Title:', title)
      console.log('Image URL:', imageUrl)
      
      await redis.sadd('nfts', mintAddress)
      console.log('Added to nfts set')
      
      const redisData = {
        title: title,
        image: imageUrl,
        likes: '0',
        valuation: '0',
        creator: finalOwner.toString(),
        createdAt: new Date().toISOString(),
        collaborators: JSON.stringify(nftCollaborators),
        isCollaborative: 'true',
        totalStake: '100',
        price: '0.1', // Default price in SOL
        isForSale: 'false',
        owner: finalOwner.toString(),
      }
      
      console.log('Redis data to store:', redisData)
      
      await redis.hset(`nft:${mintAddress}`, redisData)
      console.log('NFT stored in marketplace database successfully')
      
      // Verify the data was stored
      const storedData = await redis.hgetall(`nft:${mintAddress}`)
      console.log('Verified stored data:', storedData)
      
    } catch (redisError) {
      console.error('Error storing NFT in Redis:', redisError)
      // Fallback: Store in local file for development
      try {
        const nftsFile = path.join(process.cwd(), 'storage', 'nfts.json')
        let nfts = []
        if (fs.existsSync(nftsFile)) {
          nfts = JSON.parse(fs.readFileSync(nftsFile, 'utf8'))
        }
        nfts.push({
          mintAddress,
          title,
          image: imageUrl,
          likes: 0,
          valuation: 0,
          creator: finalOwner.toString(),
          createdAt: new Date().toISOString(),
          collaborators: nftCollaborators,
          isCollaborative: true,
          totalStake: '100',
          price: 0.1, // Default price in SOL
          isForSale: false,
          owner: finalOwner.toString(),
        })
        fs.writeFileSync(nftsFile, JSON.stringify(nfts, null, 2))
        console.log('NFT stored in local file')
      } catch (fileError) {
        console.error('Error storing NFT in local file:', fileError)
      }
    }

    return res.status(200).json({
      success: true, 
      mintAddress,
      image: imageUrl,
      title,
      metadata: metadata
    })
  } catch (error) {
    console.error('Error minting NFT:', error)
    return res.status(500).json({ 
      error: 'Failed to mint NFT',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
} 
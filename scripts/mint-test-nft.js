const { Connection, Keypair, PublicKey } = require('@solana/web3.js')
const { Metaplex, keypairIdentity, toMetaplexFile } = require('@metaplex-foundation/js')
const fs = require('fs')
const path = require('path')

async function main() {
  // Initialize connection to Devnet
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed')

  // Get the keypair from Solana CLI config
  const configPath = path.join(process.env.HOME, '.config', 'solana', 'id.json')
  const keypairData = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
  const keypair = Keypair.fromSecretKey(new Uint8Array(keypairData))
  
  // Initialize Metaplex
  const metaplex = new Metaplex(connection).use(keypairIdentity(keypair))

  console.log('Minting NFT with keypair:', keypair.publicKey.toString())

  try {
    // Read the test image
    const imagePath = path.join(process.cwd(), 'public', 'test-nft.svg')
    const imageBuffer = fs.readFileSync(imagePath)

    // Upload image
    console.log('Uploading image...')
    const imageUri = await metaplex.storage().upload(toMetaplexFile(imageBuffer, 'test-nft.svg'))

    // Create metadata
    console.log('Creating metadata...')
    const { uri: metadataUri } = await metaplex.nfts().uploadMetadata({
      name: 'Test NFT',
      description: 'A test NFT minted on Solana Devnet',
      image: imageUri,
    })

    // Mint NFT
    console.log('Minting NFT...')
    const { nft } = await metaplex.nfts().create({
      uri: metadataUri,
      name: 'Test NFT',
      sellerFeeBasisPoints: 500, // 5% royalty
    })

    console.log('\nNFT Minted Successfully!')
    console.log('Mint Address:', nft.address.toString())
    console.log('Metadata URI:', metadataUri)
    console.log('Image URI:', imageUri)

    // Get transaction history
    const signatures = await connection.getSignaturesForAddress(keypair.publicKey, { limit: 5 })
    console.log('\nRecent transactions:')
    signatures.forEach((sig, i) => {
      console.log(`${i + 1}. ${sig.signature}`)
      console.log(`   Time: ${new Date(sig.blockTime * 1000).toLocaleString()}`)
      console.log(`   Status: ${sig.confirmationStatus}`)
      console.log('')
    })

  } catch (error) {
    console.error('Error minting NFT:', error)
  }
}

main() 
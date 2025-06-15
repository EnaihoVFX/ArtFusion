const { Connection, Keypair, PublicKey } = require('@solana/web3.js')
const fs = require('fs')
const path = require('path')

async function main() {
  // Initialize connection to Devnet
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed')

  // Get the keypair from environment
  const privateKey = Buffer.from(process.env.SOLANA_PRIVATE_KEY || '', 'base64')
  const keypair = Keypair.fromSecretKey(privateKey)
  const publicKey = keypair.publicKey

  console.log('Checking account:', publicKey.toString())

  try {
    // Get balance
    const balance = await connection.getBalance(publicKey)
    console.log('Balance:', balance / 1e9, 'SOL')

    // Get recent transactions
    const signatures = await connection.getSignaturesForAddress(publicKey, { limit: 5 })
    console.log('\nRecent transactions:')
    signatures.forEach((sig, i) => {
      console.log(`${i + 1}. ${sig.signature}`)
      console.log(`   Time: ${new Date(sig.blockTime * 1000).toLocaleString()}`)
      console.log(`   Status: ${sig.confirmationStatus}`)
      console.log('')
    })
  } catch (error) {
    console.error('Error:', error)
  }
}

main() 
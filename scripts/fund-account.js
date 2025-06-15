const { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey } = require('@solana/web3.js')

async function main() {
  // Initialize connection to Devnet
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed')

  // Use the generated private key
  const privateKeyBase64 = 'Wfx0rG8RvYUKYqA70iCoINkAfUYrF0FQkzz5+gHCdfLOi8Fwa0mNuJKwfwuKukhHNNfgKhdMhl6bRbspqwtXSA=='
  const privateKey = Buffer.from(privateKeyBase64, 'base64')
  const keypair = Keypair.fromSecretKey(privateKey)

  console.log('Funding account:', keypair.publicKey.toString())

  try {
    // Check current balance
    const balance = await connection.getBalance(keypair.publicKey)
    console.log('Current balance:', balance / LAMPORTS_PER_SOL, 'SOL')

    if (balance > 0) {
      console.log('Account already has SOL!')
      return
    }

    // Request airdrop
    console.log('Requesting airdrop...')
    const signature = await connection.requestAirdrop(keypair.publicKey, 2 * LAMPORTS_PER_SOL)
    
    // Wait for confirmation
    await connection.confirmTransaction(signature, 'confirmed')
    
    // Check new balance
    const newBalance = await connection.getBalance(keypair.publicKey)
    console.log('New balance:', newBalance / LAMPORTS_PER_SOL, 'SOL')
    console.log('Transaction signature:', signature)
    
  } catch (error) {
    console.error('Error funding account:', error)
  }
}

main() 
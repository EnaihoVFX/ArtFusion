const { Keypair } = require('@solana/web3.js')
const fs = require('fs')
const path = require('path')

function main() {
  // Generate a new keypair
  const keypair = Keypair.generate()
  
  // Convert to base64 for environment variable
  const privateKeyBase64 = Buffer.from(keypair.secretKey).toString('base64')
  
  console.log('Generated new Solana keypair:')
  console.log('Public Key:', keypair.publicKey.toString())
  console.log('Private Key (base64):', privateKeyBase64)
  console.log('\nAdd this to your .env.local file:')
  console.log(`SOLANA_PRIVATE_KEY=${privateKeyBase64}`)
  
  // Save to a file for backup (be careful with this!)
  const backupPath = path.join(process.cwd(), 'keypair-backup.json')
  const backupData = {
    publicKey: keypair.publicKey.toString(),
    privateKey: privateKeyBase64,
    secretKey: Array.from(keypair.secretKey)
  }
  
  fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2))
  console.log(`\nKeypair backed up to: ${backupPath}`)
  console.log('⚠️  Keep this file secure and never commit it to version control!')
}

main() 
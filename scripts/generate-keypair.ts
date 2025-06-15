import { Keypair } from '@solana/web3.js'
import * as fs from 'fs'
import * as path from 'path'

// Generate a new keypair
const keypair = Keypair.generate()

// Convert to base58 string
const privateKey = Buffer.from(keypair.secretKey).toString('base64')

// Create .env.local if it doesn't exist
const envPath = path.join(process.cwd(), '.env.local')
const envContent = `SOLANA_PRIVATE_KEY=${privateKey}\n`

fs.writeFileSync(envPath, envContent, { flag: 'a' })

console.log('Generated new Solana keypair and saved to .env.local')
console.log('Public Key:', keypair.publicKey.toString())
console.log('Private Key has been saved to .env.local') 
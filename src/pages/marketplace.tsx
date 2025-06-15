import React from 'react'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import { useWallet } from '@solana/wallet-adapter-react'
import Marketplace from '../components/Marketplace'

export default function MarketplacePage() {
  const { publicKey } = useWallet()

  if (!publicKey) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-4">Welcome to ArtFusion Marketplace</h1>
          <p className="text-gray-600 mb-8">Connect your wallet to view and interact with NFTs</p>
          <WalletMultiButton />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">ArtFusion Marketplace</h1>
          <p className="text-xl text-gray-600">
            Browse, like, and collect collaborative AI-generated NFTs
          </p>
        </div>
        <Marketplace />
      </div>
    </div>
  )
} 
import React, { useState } from 'react'
import { useRouter } from 'next/router'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import { useWallet } from '@solana/wallet-adapter-react'

export default function Home() {
  const router = useRouter()
  const { publicKey } = useWallet()
  const [inviteCode, setInviteCode] = useState('')

  const createSession = () => {
    const sessionId = Math.random().toString(36).substring(2, 15)
    router.push(`/game/${sessionId}`)
  }

  const joinSession = (e: React.FormEvent) => {
    e.preventDefault()
    if (inviteCode.trim()) {
      router.push(`/game/${inviteCode.trim()}`)
    }
  }

  if (!publicKey) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4">ArtFusion</h1>
          <p className="text-gray-600 mb-8">Create and collaborate on art with others</p>
          <WalletMultiButton />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">ArtFusion</h1>
        <p className="text-gray-600 mb-8">Create and collaborate on art with others</p>
        <form onSubmit={joinSession} className="mb-4">
          <input
            type="text"
            placeholder="Enter invite code"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded mr-2"
          />
          <button type="submit" className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700">Join Session</button>
        </form>
        <button onClick={createSession} className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700">Create New Session</button>
      </div>
    </div>
  )
} 
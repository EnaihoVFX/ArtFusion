import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { useWallet } from '@solana/wallet-adapter-react'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'

interface SessionState {
  contributors: string[]
  prompts: string[]
  isLocked: boolean
}

export default function Session() {
  const router = useRouter()
  const { id } = router.query
  const { publicKey, connected } = useWallet()
  const [prompt, setPrompt] = useState('')
  const [sessionState, setSessionState] = useState<SessionState>({
    contributors: [],
    prompts: [],
    isLocked: false
  })

  useEffect(() => {
    if (id && publicKey) {
      // Here we would typically fetch session state from a backend
      // For now, we'll just initialize with the current user
      setSessionState(prev => ({
        ...prev,
        contributors: [...prev.contributors, publicKey.toBase58()]
      }))
    }
  }, [id, publicKey])

  const handleSubmitPrompt = (e: React.FormEvent) => {
    e.preventDefault()
    if (prompt && publicKey) {
      setSessionState(prev => ({
        ...prev,
        prompts: [...prev.prompts, prompt]
      }))
      setPrompt('')
    }
  }

  const handleLockInput = () => {
    setSessionState(prev => ({
      ...prev,
      isLocked: true
    }))
  }

  if (!connected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-xl text-center">
          <h2 className="text-2xl font-bold mb-4">Connect Your Wallet</h2>
          <p className="mb-4 text-gray-600">You need to connect your wallet to join this session</p>
          <WalletMultiButton />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-500 to-pink-500">
      <div className="container mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-xl p-6 mb-6">
          <h1 className="text-3xl font-bold mb-4">ArtFusion Session</h1>
          <p className="text-gray-600 mb-4">Session ID: {id}</p>
          
          <div className="mb-6">
            <h2 className="text-xl font-semibold mb-2">Contributors</h2>
            <div className="flex flex-wrap gap-2">
              {sessionState.contributors.map((contributor, index) => (
                <span key={index} className="bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-sm">
                  {contributor.slice(0, 6)}...{contributor.slice(-4)}
                </span>
              ))}
            </div>
          </div>

          {!sessionState.isLocked ? (
            <form onSubmit={handleSubmitPrompt} className="space-y-4">
              <div>
                <label htmlFor="prompt" className="block text-sm font-medium text-gray-700 mb-2">
                  Your Prompt
                </label>
                <textarea
                  id="prompt"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  rows={4}
                  placeholder="Describe your vision for the artwork..."
                />
              </div>
              <div className="flex gap-4">
                <button
                  type="submit"
                  className="bg-purple-600 text-white py-2 px-6 rounded-lg hover:bg-purple-700 transition-colors"
                >
                  Submit Prompt
                </button>
                <button
                  type="button"
                  onClick={handleLockInput}
                  className="bg-pink-600 text-white py-2 px-6 rounded-lg hover:bg-pink-700 transition-colors"
                >
                  Lock Input
                </button>
              </div>
            </form>
          ) : (
            <div className="bg-gray-50 p-4 rounded-lg">
              <h2 className="text-xl font-semibold mb-4">Submitted Prompts</h2>
              <div className="space-y-2">
                {sessionState.prompts.map((p, index) => (
                  <div key={index} className="bg-white p-3 rounded border">
                    {p}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
} 
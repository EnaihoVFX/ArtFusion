import React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import { useWallet } from '@solana/wallet-adapter-react'

export default function Navigation() {
  const router = useRouter()
  const [mounted, setMounted] = React.useState(false)
  const { publicKey } = useWallet()

  React.useEffect(() => {
    setMounted(true)
  }, [])

  const isActive = (path: string) => {
    return router.pathname === path
  }

  if (!mounted) {
    return null
  }

  return (
    <nav className="bg-white shadow-lg">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-8">
            <Link
              href="/"
              className={`text-lg font-semibold ${
                isActive('/') ? 'text-purple-600' : 'text-gray-800'
              }`}
            >
              ArtFusion
            </Link>
            <div className="hidden md:flex space-x-4">
              <Link
                href="/marketplace"
                className={`px-3 py-2 rounded-md text-sm font-medium ${
                  isActive('/marketplace')
                    ? 'bg-purple-100 text-purple-600'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                Marketplace
              </Link>
              {publicKey && (
                <Link
                  href="/create"
                  className={`px-3 py-2 rounded-md text-sm font-medium ${
                    isActive('/create')
                      ? 'bg-purple-100 text-purple-600'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  Create NFT
                </Link>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <WalletMultiButton className="!bg-purple-600 hover:!bg-purple-700 !text-white !rounded-md" />
          </div>
        </div>
      </div>
    </nav>
  )
} 
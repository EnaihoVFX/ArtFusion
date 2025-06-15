import { useEffect, useState } from 'react'
import detectEthereumProvider from '@metamask/detect-provider'

export function useMetaMask() {
  const [hasProvider, setHasProvider] = useState<boolean | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)

  useEffect(() => {
    const getProvider = async () => {
      const provider = await detectEthereumProvider({ silent: true })
      setHasProvider(Boolean(provider))
    }

    getProvider()
  }, [])

  const connect = async () => {
    try {
      setIsConnecting(true)
      const provider = await detectEthereumProvider()
      
      if (provider) {
        // @ts-ignore
        await window.ethereum.request({ method: 'eth_requestAccounts' })
      }
    } catch (error) {
      console.error('Error connecting to MetaMask:', error)
    } finally {
      setIsConnecting(false)
    }
  }

  return {
    hasProvider,
    isConnecting,
    connect
  }
} 
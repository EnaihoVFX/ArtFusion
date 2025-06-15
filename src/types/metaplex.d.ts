declare module '@metaplex-foundation/js-plugin-nft-storage' {
  import { MetaplexPlugin } from '@metaplex-foundation/js'
  
  export interface NftStorageOptions {
    token: string
  }
  
  export function nftStorage(options: NftStorageOptions): MetaplexPlugin
} 
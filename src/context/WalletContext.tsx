import type { ReactNode } from 'react'
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api'

type Wallet = {
  coins: number
  gems: number
  inv: Record<string, number>
}

type WalletContextValue = {
  wallet: Wallet
  user: any
  isAdmin: boolean
  refreshWallet: () => Promise<void>
  setWallet: (wallet: Wallet) => void
}

const EMPTY_WALLET: Wallet = { coins: 0, gems: 0, inv: { fifty: 0, freeze: 0, doublexp: 0, reveal: 0 } }

const WalletContext = createContext<WalletContextValue>({
  wallet: EMPTY_WALLET,
  user: null,
  isAdmin: false,
  refreshWallet: async () => {},
  setWallet: () => {},
})

export function WalletProvider({ children }: { children: ReactNode }) {
  const [wallet, setWalletState] = useState<Wallet>(EMPTY_WALLET)
  const [user, setUser] = useState<any>(null)

  const refreshWallet = useCallback(async () => {
    const nextUser = await api.auth.getUser()
    setUser(nextUser)
    if (!nextUser) {
      setWalletState(EMPTY_WALLET)
      return
    }

    if (nextUser.inventory) {
      setWalletState({
        coins: nextUser.coins || 0,
        gems: nextUser.gems || 0,
        inv: { ...EMPTY_WALLET.inv, ...nextUser.inventory },
      })
      return
    }

    const nextWallet = await api.shop.wallet()
    setWalletState({ ...EMPTY_WALLET, ...nextWallet, inv: { ...EMPTY_WALLET.inv, ...nextWallet.inv } })
  }, [])

  useEffect(() => {
    refreshWallet().catch(() => {})
  }, [refreshWallet])

  const setWallet = useCallback((nextWallet: Wallet) => {
    setWalletState({ ...EMPTY_WALLET, ...nextWallet, inv: { ...EMPTY_WALLET.inv, ...nextWallet.inv } })
  }, [])

  const value = useMemo(() => ({
    wallet,
    user,
    isAdmin: Boolean(user?.is_admin),
    refreshWallet,
    setWallet,
  }), [wallet, user, refreshWallet, setWallet])

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
}

export function useWallet() {
  return useContext(WalletContext)
}

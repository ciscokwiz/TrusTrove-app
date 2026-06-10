import { useState } from 'react';
import { useWalletStore } from '@/store/wallet';
import { signTransaction } from '@stellar/freighter-api';
import { Networks } from '@stellar/stellar-sdk';

export function useAuth() {
  const { address, token, setToken, disconnect } = useWalletStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const login = async () => {
    if (!address) {
      setError('Wallet not connected');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const apiBaseUrl = process.env.NEXT_PUBLIC_INDEXER_API_URL || 'http://localhost:8080';
      
      // 1. Fetch challenge XDR
      const challengeRes = await fetch(`${apiBaseUrl}/auth?address=${address}`);
      if (!challengeRes.ok) {
        throw new Error(`Failed to fetch auth challenge: ${challengeRes.statusText}`);
      }
      const challengeData = await challengeRes.json();
      const { transaction } = challengeData;

      // 2. Sign with Freighter wallet
      const networkPassphrase = process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE || Networks.TESTNET;
      const signedXdr = await signTransaction(transaction, {
        network: 'TESTNET',
        networkPassphrase,
        accountToSign: address,
      });

      // 3. Submit signed challenge to verify and receive JWT
      const verifyRes = await fetch(`${apiBaseUrl}/auth`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ transaction: signedXdr }),
      });

      if (!verifyRes.ok) {
        throw new Error('Authentication failed');
      }

      const verifyData = await verifyRes.json();
      setToken(verifyData.token);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Authentication failed';
      setError(message);
      setToken(null);
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setToken(null);
    disconnect();
  };

  return {
    token,
    isAuthenticated: !!token,
    loading,
    error,
    login,
    logout,
  };
}

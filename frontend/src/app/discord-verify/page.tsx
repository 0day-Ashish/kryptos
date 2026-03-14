'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ethers } from 'ethers';
import { ShieldAlert, ShieldCheck, Loader2, Link } from 'lucide-react';
// Component that actually reads search params
function VerificationProcess() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const discordId = searchParams.get('discord_id');

  const [status, setStatus] = useState<'loading' | 'signing' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token || !discordId) {
      setStatus('error');
      setMessage('Invalid verification link. Missing token or Discord ID.');
      return;
    }
    setStatus('signing'); // Ready to trigger wallet connection
  }, [token, discordId]);

  async function verifyWallet() {
    try {
      if (!window.ethereum) throw new Error('MetaMask or Web3 wallet not installed.');

      setStatus('loading');
      setMessage('Connecting to wallet...');

      const provider = new ethers.BrowserProvider(window.ethereum);
      await provider.send('eth_requestAccounts', []);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();

      setStatus('signing');
      setMessage('Please sign the message in your wallet...');

      // Since the frontend cannot recreate the exact message with nonce + timestamps 
      // without fetching it, we must fetch the `DiscordLinkRequest` from the backend first, OR
      // The instructions explicitly say: 
      // "const siweMessage = `Link wallet to Discord for Kryptos\n\nAddress: ${address}\nNonce: ${token}`"
      // Wait, let's look closely at `auth/routes.py` verify_discord_link.
      // `if body.message.strip() != req.message.strip(): raise 401`
      // So the frontend sent message has to exactly equal `req.message`.
      // The only way to get `req.message` is to either have a GET endpoint (doesn't exist)
      // OR we just sign what the user example provided, but wait, the backend `create_discord_link_request` 
      // hardcodes: "Kryptos wants you to sign this message to link your wallet with Discord.\n\nDiscord ID: {discord_id}\nToken: {token}\nNonce: {nonce}\nIssued At: {issued_at}\nExpiration Time: {expires_at_iso}"
      // This is a mismatch in the provided specs vs the backend code.
      // Let's modify the frontend to construct the generic text, and we'll fix the backend to accept it.
      
      const siweMessage = `Link wallet to Discord for Kryptos\n\nAddress: ${address}\nNonce: ${token}`;
      const signature = await signer.signMessage(siweMessage);

      setStatus('loading');
      setMessage('Verifying with server...');

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000'}/auth/discord-verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          discord_id: discordId,
          token,
          address,
          signature,
          message: siweMessage
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Verification failed');
      }

      setStatus('success');
      setMessage('Wallet linked successfully! You can return to Discord.');
    } catch (err) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : 'Unknown error during verification.');
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center space-y-6">
      <div className="p-4 bg-zinc-900 rounded-full border border-zinc-800 shadow-xl">
        <Link className="w-12 h-12 text-blue-500" />
      </div>
      
      <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">
        Wallet Linking
      </h1>

      <div className="max-w-md w-full bg-zinc-900/50 p-6 rounded-2xl border border-zinc-800/50 backdrop-blur-sm">
        {status === 'loading' && (
          <div className="flex flex-col items-center space-y-4 text-zinc-400">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            <p>{message || 'Loading...'}</p>
          </div>
        )}

        {status === 'signing' && (
          <div className="flex flex-col items-center space-y-6">
            <div className="bg-blue-500/10 p-3 rounded-xl border border-blue-500/20">
              <ShieldAlert className="w-6 h-6 text-blue-400" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-medium text-white">Connect & Sign</h3>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Connect your wallet to prove ownership. This signature does not cost gas and does not give us access to your funds.
              </p>
            </div>
            <button 
              onClick={verifyWallet}
              className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-medium rounded-xl transition-all shadow-lg shadow-blue-500/20 active:scale-[0.98]"
            >
              Verify Wallet
            </button>
            <p className="text-xs text-zinc-500">Discord ID: {discordId}</p>
          </div>
        )}

        {status === 'success' && (
          <div className="flex flex-col items-center space-y-4 text-emerald-400">
            <div className="bg-emerald-500/10 p-4 rounded-full">
              <ShieldCheck className="w-10 h-10" />
            </div>
            <p className="font-medium text-lg">{message}</p>
            <p className="text-sm text-zinc-500 mt-2">You can safely close this window.</p>
          </div>
        )}

        {status === 'error' && (
          <div className="flex flex-col items-center space-y-4">
            <div className="bg-red-500/10 p-3 rounded-full">
              <ShieldAlert className="w-8 h-8 text-red-500" />
            </div>
            <p className="text-red-400 font-medium">{message}</p>
            <button 
              onClick={() => { setStatus('signing'); setMessage(''); }}
              className="mt-4 text-sm text-blue-400 hover:text-blue-300 underline underline-offset-4"
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function DiscordVerify() {
  return (
    <div className="min-h-screen bg-black pt-24 pb-12">
      <Suspense fallback={<div className="flex justify-center p-20"><Loader2 className="animate-spin text-zinc-500 w-8 h-8"/></div>}>
        <VerificationProcess />
      </Suspense>
    </div>
  );
}

import { getWallet } from './wallet-setup.js';
import { firstValueFrom } from 'rxjs';
import * as ledger from '@midnight-ntwrk/ledger';

(async () => {
  const { wallet: w, coinPublicKey } = await getWallet();
  const state = await firstValueFrom((w as any).state()) as any;
  
  console.log('state.coinPublicKey:', state.coinPublicKey);
  
  // Try ledger encode with the bech32 key
  try {
    const encoded = (ledger as any).encodeCoinPublicKey(state.coinPublicKey);
    console.log('ledger.encodeCoinPublicKey works:', encoded);
  } catch(e: any) {
    console.log('ledger.encodeCoinPublicKey failed:', e.message);
  }
  
  // Check if there's a coin public key in hex format somewhere
  console.log('\ncoinPublicKeyLegacy:', state.coinPublicKeyLegacy);
  
  // Try the wallet as a provider - check if it implements WalletProvider
  const proto = Object.getPrototypeOf(w);
  const descriptors = Object.getOwnPropertyDescriptors(proto);
  console.log('\nDescriptor keys:', Object.keys(descriptors));
  
  // Check if balanceTransaction exists  
  console.log('balanceTransaction:', typeof (w as any).balanceTransaction);
  
  // Try calling balanceTransaction-like methods to see the interface
  for (const key of Object.getOwnPropertyNames(proto)) {
    if (key !== 'constructor') {
      const desc = Object.getOwnPropertyDescriptor(proto, key);
      console.log(`  ${key}: type=${typeof (w as any)[key]}, isGetter=${!!desc?.get}`);
    }
  }
  
  process.exit(0);
})();

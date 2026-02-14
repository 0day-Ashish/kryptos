import { getWallet } from './wallet-setup.js';
import { firstValueFrom } from 'rxjs';

(async () => {
  const w = await getWallet();
  console.log('--- Wallet own keys ---');
  console.log(Object.keys(w));
  
  // Check coinPublicKey
  console.log('coinPublicKey type:', typeof (w as any).coinPublicKey);
  console.log('coinPublicKey value:', (w as any).coinPublicKey);
  
  if (typeof (w as any).coinPublicKey === 'function') {
    const cpk = await (w as any).coinPublicKey();
    console.log('coinPublicKey():', cpk);
  }

  // Check state
  const state = await firstValueFrom((w as any).state()) as any;
  console.log('--- State keys ---');
  console.log(Object.keys(state));
  console.log('state.coinPublicKey:', state.coinPublicKey);

  process.exit(0);
})();

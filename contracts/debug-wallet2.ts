import { getWallet } from './wallet-setup.js';
import { firstValueFrom } from 'rxjs';

(async () => {
  const { wallet: w, coinPublicKey } = await getWallet();
  
  // Check prototype chain
  let proto = Object.getPrototypeOf(w);
  while (proto && proto !== Object.prototype) {
    console.log('--- Proto:', proto.constructor?.name ?? 'anon', '---');
    console.log('  own keys:', Object.getOwnPropertyNames(proto).filter(k => k !== 'constructor'));
    proto = Object.getPrototypeOf(proto);
  }

  // Try accessing coinPublicKey directly
  console.log('\nDirect access w.coinPublicKey:', (w as any).coinPublicKey);
  
  // Check state coinPublicKey format
  const state = await firstValueFrom((w as any).state()) as any;
  console.log('state.coinPublicKey:', state.coinPublicKey);
  console.log('state.coinPublicKey length:', state.coinPublicKey?.length);
  
  // Check if it's hex
  const isHex = /^[0-9a-fA-F]+$/.test(state.coinPublicKey);
  console.log('Is hex?', isHex);
  
  // Strip prefix and check
  const stripped = state.coinPublicKey.replace(/^mn_shield-cpk_test/, '');
  console.log('Stripped:', stripped);
  console.log('Stripped length:', stripped.length);
  
  process.exit(0);
})();

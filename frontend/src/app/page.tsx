import Link from 'next/link';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-black text-white">
      <h1 className="text-6xl font-bold mb-8 font-[family-name:var(--font-nuqun)]">Kryptos</h1>
      <p className="text-xl mb-12 text-zinc-400 font-[family-name:var(--font-spacemono)]">Landing Page Coming Soon</p>
      <Link
        href="/analyze"
        className="px-8 py-4 bg-white text-black rounded-full font-bold hover:bg-zinc-200 transition-colors font-[family-name:var(--font-spacemono)]"
      >
        Launch App
      </Link>
      
    </main>
  );
}
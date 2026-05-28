import Link from "next/link";
import { getWallets } from "@/lib/db";
import WalletManager from "@/components/WalletManager";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function WalletsPage() {
  const wallets = getWallets();

  return (
    <main className="min-h-screen text-white">
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Link
            href="/"
            className="text-slate-500 hover:text-white transition-colors text-sm"
          >
            ← Feed
          </Link>
          <h1 className="text-xl font-bold text-white">Wallets</h1>
        </div>

        <WalletManager initial={wallets} />

        {/* Info note about NEXT_PUBLIC_APP_URL */}
        {!process.env.NEXT_PUBLIC_APP_URL && (
          <div className="mt-6 bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-4 py-3">
            <p className="text-xs text-yellow-400 font-medium mb-1">Helius sync disabled</p>
            <p className="text-xs text-yellow-400/70">
              Set <code className="font-mono">NEXT_PUBLIC_APP_URL</code> in{" "}
              <code className="font-mono">.env.local</code> to your public URL (or ngrok) so
              Helius can register the webhook.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}

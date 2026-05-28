import { getRecentTransactions, getWallets } from "@/lib/db";
import TrackerApp from "@/components/TrackerApp";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function Home() {
  const initialTxs = getRecentTransactions(50);
  const wallets = getWallets();

  return (
    <main className="min-h-screen text-white">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <TrackerApp
          initialTxs={initialTxs}
          walletNames={wallets.map((w) => w.name)}
          walletCount={wallets.length}
        />
      </div>
    </main>
  );
}

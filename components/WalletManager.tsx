"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const EMOJI_SECTIONS = [
  {
    label: "Animals",
    emojis: ["🐋","🦈","🦊","🐺","🦁","🐯","🐻","🐸","🦅","🦉","🐲","🦋","🐙","🦑","🦎","🐍"],
  },
  {
    label: "Crypto & Finance",
    emojis: ["💎","💰","💸","📈","📉","🏦","🪙","💹","🔑","🗝️","🏴‍☠️","⚡","🌊","🌙","☀️","🌟"],
  },
  {
    label: "Vibes",
    emojis: ["🚀","🔥","👑","🤖","🧠","🎯","👻","💀","🎃","🤡","🥷","🧙","🎲","🃏","🎰","⚔️"],
  },
  {
    label: "Symbols",
    emojis: ["💥","❄️","🌈","🎭","🎪","🔮","🪄","🛡️","🗡️","💣","🧨","🎁","🏆","🥇","🎖️","🎀"],
  },
];

function splitName(name: string): { base: string; emoji: string } {
  const parts = name.trim().split(" ");
  const last = parts[parts.length - 1];
  const isEmoji = last && /\p{Emoji}/u.test(last) && last.length <= 4 && parts.length > 1;
  return isEmoji
    ? { base: parts.slice(0, -1).join(" "), emoji: last }
    : { base: name.trim(), emoji: "" };
}

// Emoji grid rendered in the right panel
function EmojiGrid({ value, onChange }: { value: string; onChange: (e: string) => void }) {
  return (
    <div className="space-y-4">
      {EMOJI_SECTIONS.map((section) => (
        <div key={section.label}>
          <p className="text-[10px] uppercase tracking-widest text-slate-600 font-semibold mb-2">
            {section.label}
          </p>
          <div className="grid grid-cols-8 gap-1.5">
            {section.emojis.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => onChange(e === value ? "" : e)}
                className={`h-10 text-2xl rounded-xl flex items-center justify-center transition-all hover:bg-slate-700/60 hover:scale-110 active:scale-95 ${
                  value === e ? "bg-slate-700 ring-2 ring-white/20 scale-110" : ""
                }`}
              >
                {e}
              </button>
            ))}
          </div>
        </div>
      ))}
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="text-xs text-slate-600 hover:text-slate-400 transition-colors mt-1"
        >
          ✕ Clear
        </button>
      )}
    </div>
  );
}

interface Wallet {
  address: string;
  name: string;
  addedAt: number;
}

interface Props {
  initial: Wallet[];
}

// Which emoji panel is open: "add" | wallet address | null
type EmojiPanelFor = "add" | string | null;

export default function WalletManager({ initial }: Props) {
  const router = useRouter();
  const [wallets, setWallets] = useState<Wallet[]>(initial);

  // Add form
  const [name, setName] = useState("");
  const [addEmoji, setAddEmoji] = useState("");
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [deletingAddress, setDeletingAddress] = useState<string | null>(null);

  // Inline edit
  const [editingAddress, setEditingAddress] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmoji, setEditEmoji] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Which panel is showing emojis on the right
  const [emojiPanelFor, setEmojiPanelFor] = useState<EmojiPanelFor>(null);

  function toggleEmojiPanel(for_: EmojiPanelFor) {
    setEmojiPanelFor((prev) => (prev === for_ ? null : for_));
  }

  function startEdit(w: Wallet) {
    const { base, emoji } = splitName(w.name);
    setEditingAddress(w.address);
    setEditName(base);
    setEditEmoji(emoji);
    setEditAddress(w.address);
    setEditError(null);
  }

  function cancelEdit() {
    setEditingAddress(null);
    setEmojiPanelFor(null);
  }

  async function saveEdit() {
    if (!editingAddress) return;
    setEditError(null);
    if (!editName.trim()) { setEditError("Name is required."); return; }
    setEditLoading(true);
    try {
      const fullName = editEmoji ? `${editName.trim()} ${editEmoji}` : editName.trim();
      const res = await fetch("/api/wallets", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oldAddress: editingAddress, newAddress: editAddress.trim(), name: fullName }),
      });
      const data = await res.json();
      if (!res.ok && res.status !== 207) { setEditError(data.error ?? "Failed to save."); return; }
      setEditingAddress(null);
      setEmojiPanelFor(null);
      setWallets((await (await fetch("/api/wallets")).json()).wallets ?? []);
      router.refresh();
    } catch {
      setEditError("Network error.");
    } finally {
      setEditLoading(false);
    }
  }

  async function addWallet() {
    setError(null);
    setWarning(null);
    if (!address.trim() || !name.trim()) { setError("Both name and address are required."); return; }
    setLoading(true);
    try {
      const fullName = addEmoji ? `${name.trim()} ${addEmoji}` : name.trim();
      const res = await fetch("/api/wallets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: address.trim(), name: fullName }),
      });
      const data = await res.json();
      if (!res.ok && res.status !== 207) { setError(data.error ?? "Failed to add wallet."); return; }
      if (data.warning) setWarning(data.warning);
      setName(""); setAddEmoji(""); setAddress("");
      setEmojiPanelFor(null);
      setWallets((await (await fetch("/api/wallets")).json()).wallets ?? []);
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function removeWallet(addr: string) {
    setError(null);
    setWarning(null);
    setDeletingAddress(addr);
    if (editingAddress === addr) { setEditingAddress(null); setEmojiPanelFor(null); }
    try {
      const res = await fetch("/api/wallets", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: addr }),
      });
      const data = await res.json();
      if (!res.ok && res.status !== 207) { setError(data.error ?? "Failed to remove wallet."); return; }
      if (data.warning) setWarning(data.warning);
      setWallets((prev) => prev.filter((w) => w.address !== addr));
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setDeletingAddress(null);
    }
  }

  // Current emoji value for the active panel
  const panelEmoji = emojiPanelFor === "add" ? addEmoji : editEmoji;
  function setPanelEmoji(e: string) {
    if (emojiPanelFor === "add") setAddEmoji(e);
    else setEditEmoji(e);
  }

  return (
    // Wide relative wrapper so the emoji panel can position itself to the right
    <div className="relative">
      {/* ── Centered main content ── */}
      <div className="max-w-[440px] mx-auto">

        {/* Add Wallet */}
        <div className="bg-slate-900/70 backdrop-blur-sm border border-slate-800 rounded-2xl p-5 mb-6">
          <h2 className="text-sm font-semibold text-white mb-4">Add Wallet</h2>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Display Name</label>
              <div className="flex gap-2 items-center">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Whale Alpha"
                  className="flex-1 bg-slate-800 border border-slate-700 text-white text-sm rounded-xl px-4 py-2.5 outline-none focus:border-slate-500 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => toggleEmojiPanel("add")}
                  title="Pick emoji"
                  className={`shrink-0 w-10 h-10 rounded-xl border text-xl flex items-center justify-center transition-all ${
                    emojiPanelFor === "add"
                      ? "border-slate-500 bg-slate-700 text-white"
                      : "border-slate-700 bg-slate-800 text-slate-500 hover:border-slate-500 hover:text-white"
                  }`}
                >
                  {addEmoji || "+"}
                </button>
              </div>
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Wallet Address</label>
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Solana public key (base58)"
                className="w-full bg-slate-800 border border-slate-700 text-white text-sm font-mono rounded-xl px-4 py-2.5 outline-none focus:border-slate-500 transition-colors"
              />
            </div>
            {error && <p className="text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{error}</p>}
            {warning && <p className="text-xs text-yellow-400 bg-yellow-500/10 rounded-lg px-3 py-2">⚠ {warning}</p>}
            <button
              onClick={addWallet}
              disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-medium rounded-xl px-4 py-2.5 transition-colors"
            >
              {loading ? "Adding..." : "Add Wallet"}
            </button>
          </div>
        </div>

        {/* Wallet list */}
        <div>
          <h2 className="text-sm font-semibold text-white mb-3">
            Tracked Wallets
            <span className="ml-2 text-slate-500 font-normal">({wallets.length})</span>
          </h2>
          {wallets.length === 0 ? (
            <div className="text-center py-12 text-slate-600">
              <p className="text-3xl mb-2">🔍</p>
              <p className="text-sm">No wallets added yet.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {wallets.map((w) => (
                <div
                  key={w.address}
                  className={`bg-slate-900/70 backdrop-blur-sm border rounded-xl overflow-hidden transition-colors ${
                    editingAddress === w.address ? "border-slate-600" : "border-slate-800"
                  }`}
                >
                  {editingAddress === w.address ? (
                    // ── Inline edit form ──
                    <div className="px-4 py-3 space-y-2.5">
                      <div className="flex gap-2 items-center">
                        <input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          placeholder="Display name"
                          className="flex-1 bg-slate-800 border border-slate-700 text-white text-sm rounded-xl px-3 py-2 outline-none focus:border-slate-500 transition-colors"
                        />
                        <button
                          type="button"
                          onClick={() => toggleEmojiPanel(w.address)}
                          className={`shrink-0 w-10 h-10 rounded-xl border text-xl flex items-center justify-center transition-all ${
                            emojiPanelFor === w.address
                              ? "border-slate-500 bg-slate-700 text-white"
                              : "border-slate-700 bg-slate-800 text-slate-500 hover:border-slate-500"
                          }`}
                        >
                          {editEmoji || "+"}
                        </button>
                      </div>
                      <input
                        value={editAddress}
                        onChange={(e) => setEditAddress(e.target.value)}
                        placeholder="Wallet address"
                        className="w-full bg-slate-800 border border-slate-700 text-white text-xs font-mono rounded-xl px-3 py-2 outline-none focus:border-slate-500 transition-colors"
                      />
                      {editError && (
                        <p className="text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{editError}</p>
                      )}
                      <div className="flex gap-2">
                        <button
                          onClick={saveEdit}
                          disabled={editLoading}
                          className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-medium rounded-xl px-3 py-2 transition-colors"
                        >
                          {editLoading ? "Saving…" : "Save"}
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="px-4 text-xs text-slate-400 hover:text-white border border-slate-700 hover:border-slate-500 rounded-xl py-2 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    // ── Normal row ──
                    <div className="flex items-center justify-between px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <span className="text-white text-sm font-medium">{w.name}</span>
                        <div className="flex items-center gap-1 mt-0.5">
                          <span className="text-slate-500 font-mono text-xs">
                            {w.address.slice(0, 8)}...{w.address.slice(-6)}
                          </span>
                          <button
                            onClick={() => navigator.clipboard.writeText(w.address)}
                            className="text-slate-700 hover:text-slate-400 text-xs transition-colors"
                            title="Copy address"
                          >
                            ⧉
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 ml-3 shrink-0">
                        <button
                          onClick={() => startEdit(w)}
                          className="text-slate-600 hover:text-slate-300 text-sm transition-colors p-1.5"
                          title="Edit wallet"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => removeWallet(w.address)}
                          disabled={deletingAddress === w.address}
                          className="text-slate-600 hover:text-red-400 disabled:opacity-40 text-sm transition-colors p-1.5"
                          title="Remove wallet"
                        >
                          {deletingAddress === w.address ? "…" : "✕"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Right emoji panel — floats in the empty space to the right ── */}
      {emojiPanelFor !== null && (
        <div
          className="absolute top-0 bg-slate-900/70 backdrop-blur-sm border border-slate-800 rounded-2xl p-5"
          style={{
            left: "calc(50% + 240px)",
            width: "min(340px, calc(50vw - 260px))",
            animation: "panel-in 0.15s ease-out",
          }}
        >
          <p className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold mb-4">
            Choose Emoji
          </p>
          <EmojiGrid value={panelEmoji} onChange={setPanelEmoji} />
        </div>
      )}

      <style>{`
        @keyframes panel-in {
          from { opacity: 0; transform: translateX(10px) scale(0.98); }
          to   { opacity: 1; transform: translateX(0) scale(1); }
        }
      `}</style>
    </div>
  );
}

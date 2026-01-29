"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { Button, Card, Input } from "@/components/ui";
import { formatLiters, mlToLiters } from "@/lib/format";
import { weekRangeLabel } from "@/lib/week";

type LeaderRow = {
  group_id: string;
  user_id: string;
  name: string;
  total_ml: number;
  total_liters: number;
};

export default function GroupPage() {
  const router = useRouter();
  const params = useParams<{ groupId: string }>();
  const groupId = params.groupId;

  const [ready, setReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [groupName, setGroupName] = useState<string>("Grupo");
  const [groupCode, setGroupCode] = useState<string>("");

  const [leaders, setLeaders] = useState<LeaderRow[]>([]);
  const [loadingRank, setLoadingRank] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [open, setOpen] = useState(false);
  const [ml, setMl] = useState("500");
  const [saving, setSaving] = useState(false);

  const myRow = leaders.find((l) => l.user_id === userId);
  const myLiters = myRow?.total_liters ?? 0;

  useEffect(() => {
    let mounted = true;
    (async () => {
      const supabase = supabaseBrowser();
      setError(null);
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        const res = await supabase.auth.signInAnonymously();
        if (res.error) {
          if (!mounted) return;
          setError(res.error.message);
          return;
        }
      }
      const { data: sess } = await supabase.auth.getSession();
      if (!mounted) return;
      setUserId(sess.session?.user.id ?? null);
      setReady(true);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const loadGroup = useCallback(async () => {
    const supabase = supabaseBrowser();
    const g = await supabase.from("groups").select("name,code").eq("id", groupId).single();
    if (g.error) throw new Error(g.error.message);
    setGroupName(g.data.name as string);
    setGroupCode(g.data.code as string);
  }, [groupId]);

  const loadRanking = useCallback(async () => {
    const supabase = supabaseBrowser();
    setLoadingRank(true);
    const res = await supabase
      .from("weekly_leaderboard")
      .select("group_id,user_id,name,total_ml,total_liters")
      .eq("group_id", groupId)
      .order("total_ml", { ascending: false });
    setLoadingRank(false);
    if (res.error) throw new Error(res.error.message);
    setLeaders((res.data ?? []) as LeaderRow[]);
  }, [groupId]);

  useEffect(() => {
    if (!ready) return;

    let unsub: (() => void) | null = null;
    (async () => {
      try {
        const supabase = supabaseBrowser();
        await loadGroup();
        await loadRanking();

        const channel = supabase
          .channel(`water_logs:group:${groupId}`)
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "water_logs",
              filter: `group_id=eq.${groupId}`
            },
            async () => {
              // MVP: refetch totals whenever someone logs water.
              try {
                await loadRanking();
              } catch {
                // ignore (next tick will recover)
              }
            }
          )
          .subscribe();

        unsub = () => {
          void supabase.removeChannel(channel);
        };
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erro inesperado");
      }
    })();

    return () => {
      unsub?.();
    };
  }, [ready, groupId, loadGroup, loadRanking]);

  async function drinkWater() {
    const supabase = supabaseBrowser();
    setError(null);
    setSaving(true);
    try {
      const mlNum = Number(ml);
      if (!Number.isFinite(mlNum) || mlNum <= 0) throw new Error("ML inválido");
      if (!userId) throw new Error("Sessão inválida");

      const ins = await supabase.from("water_logs").insert({
        user_id: userId,
        group_id: groupId,
        ml: Math.round(mlNum)
      });
      if (ins.error) throw new Error(ins.error.message);

      setOpen(false);
      setMl("500");

      // Optimistic-ish: refresh immediately too.
      await loadRanking();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro inesperado");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="space-y-4">
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.push("/")}
          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10"
        >
          ← Voltar
        </button>
        <div className="text-right">
          <div className="text-sm font-semibold">🏆 {groupName}</div>
          <div className="text-xs text-white/60">Código: {groupCode}</div>
        </div>
      </div>

      {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm">{error}</div>}

      <Card title="💧 Semana atual" subtitle={weekRangeLabel()}>
        <div className="flex items-end justify-between">
          <div>
            <div className="text-xs text-white/60">Seu total</div>
            <div className="text-3xl font-extrabold">{formatLiters(myLiters)}</div>
          </div>
          <Button onClick={() => setOpen(true)}>Bebi água 💧</Button>
        </div>
      </Card>

      <Card title="📊 Ranking (tempo real)" subtitle="Atualiza automaticamente quando alguém registra água.">
        {loadingRank ? (
          <div className="py-6 text-center text-white/70">Carregando ranking…</div>
        ) : leaders.length === 0 ? (
          <div className="py-6 text-center text-white/70">Ainda ninguém registrou. Seja o primeiro 🥤</div>
        ) : (
          <div className="space-y-2">
            {leaders.map((l, idx) => {
              const isMe = l.user_id === userId;
              return (
                <div
                  key={l.user_id}
                  className={`flex items-center justify-between rounded-xl border px-3 py-3 ${
                    isMe ? "border-blue-400/40 bg-blue-500/10" : "border-white/10 bg-black/20"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 text-center text-lg font-extrabold">
                      {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `#${idx + 1}`}
                    </div>
                    <div>
                      <div className="font-semibold">
                        {l.name}
                        {isMe ? " (você)" : ""}
                      </div>
                      <div className="text-xs text-white/60">{l.total_ml} ml</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-extrabold">{formatLiters(l.total_liters)}</div>
                    <div className="text-xs text-white/50">{mlToLiters(l.total_ml).toFixed(2)} L</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#0b1220] p-4 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-lg font-semibold">Bebi água 💧</div>
                <div className="text-sm text-white/70">Quantos ml tinha sua garrafa?</div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10"
              >
                Fechar
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <Input label="ML" value={ml} onChange={setMl} type="number" placeholder="500" />
              <div className="grid grid-cols-3 gap-2">
                {["300", "500", "700"].map((v) => (
                  <button
                    key={v}
                    onClick={() => setMl(v)}
                    className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm hover:bg-white/10"
                  >
                    {v}ml
                  </button>
                ))}
              </div>
              <Button onClick={drinkWater} disabled={saving}>
                {saving ? "Salvando…" : "Salvar 🥤"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}


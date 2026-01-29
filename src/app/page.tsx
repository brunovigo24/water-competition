"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { Button, Card, Input } from "@/components/ui";

type GroupRow = { id: string; name: string; code: string };

export default function HomePage() {
  const router = useRouter();

  const [ready, setReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);

  const [groupName, setGroupName] = useState("Time Produto");
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<GroupRow[]>([]);

  const [error, setError] = useState<string | null>(null);

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
      const uid = sess.session?.user.id ?? null;
      if (!mounted) return;
      setUserId(uid);

      // Load current name (if any)
      if (uid) {
        const profile = await supabase.from("users").select("name").eq("id", uid).maybeSingle();
        if (!mounted) return;
        if (profile.data?.name) setName(profile.data.name);
      }

      setReady(true);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  async function saveNameIfNeeded() {
    const supabase = supabaseBrowser();
    if (!userId) throw new Error("missing user session");
    const n = name.trim();
    if (!n) throw new Error("Escolha um nome 🙂");
    const up = await supabase.from("users").upsert({ id: userId, name: n });
    if (up.error) throw new Error(up.error.message);
  }

  async function createGroup() {
    const supabase = supabaseBrowser();
    setError(null);
    setCreating(true);
    try {
      await saveNameIfNeeded();

      const gName = groupName.trim();
      if (!gName) throw new Error("Nome do grupo inválido");

      const ins = await supabase.from("groups").insert({ name: gName }).select("id").single();
      if (ins.error) throw new Error(ins.error.message);

      const groupId = ins.data.id as string;
      const mem = await supabase.from("group_members").insert({ group_id: groupId, user_id: userId! });
      if (mem.error) throw new Error(mem.error.message);

      router.push(`/g/${groupId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro inesperado");
    } finally {
      setCreating(false);
    }
  }

  async function searchGroups(): Promise<GroupRow[]> {
    const supabase = supabaseBrowser();
    setError(null);
    const q = query.trim();
    if (!q) {
      setMatches([]);
      return [];
    }

    // If it's likely a code (short), try exact code first.
    const exactCode = await supabase.from("groups").select("id,name,code").eq("code", q.toUpperCase()).limit(5);
    if (exactCode.data && exactCode.data.length) {
      const list = exactCode.data as GroupRow[];
      setMatches(list);
      return list;
    }

    const byName = await supabase
      .from("groups")
      .select("id,name,code")
      .ilike("name", `%${q}%`)
      .limit(10);
    if (byName.error) {
      setError(byName.error.message);
      return [];
    }
    const list = (byName.data ?? []) as GroupRow[];
    setMatches(list);
    return list;
  }

  async function joinGroup(groupId: string) {
    const supabase = supabaseBrowser();
    setError(null);
    setJoining(true);
    try {
      await saveNameIfNeeded();
      const mem = await supabase.from("group_members").insert({ group_id: groupId, user_id: userId! });
      if (mem.error) throw new Error(mem.error.message);
      router.push(`/g/${groupId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro inesperado");
    } finally {
      setJoining(false);
    }
  }

  if (!ready) {
    return (
      <div className="py-10 text-center text-white/80">
        <div className="text-2xl font-semibold">Water Cup 💧</div>
        <div className="mt-2">Carregando…</div>
      </div>
    );
  }

  return (
    <main className="space-y-4">
      <div className="text-center">
        <div className="text-3xl font-extrabold tracking-tight">Water Cup 💧</div>
        <div className="mt-1 text-sm text-white/70">Ranking em tempo real. Semana a semana. Sem frescura.</div>
      </div>

      {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm">{error}</div>}

      <Card title="👤 Seu nome">
        <Input label="Como você quer aparecer no ranking?" value={name} onChange={setName} placeholder="Ex: Bruno" />
        <div className="mt-2 text-xs text-white/60">Dica: dá pra mudar depois.</div>
      </Card>

      <Card title="➕ Criar grupo" subtitle="Ex: “Time Produto”, “Growth”, “Pessoas Legais”">
        <div className="space-y-3">
          <Input label="Nome do grupo" value={groupName} onChange={setGroupName} placeholder="Time Produto" />
          <Button onClick={createGroup} disabled={creating}>
            {creating ? "Criando…" : "Criar e entrar"}
          </Button>
        </div>
      </Card>

      <Card title="🚪 Entrar em grupo" subtitle="Cole um código (ex: A1B2C3) ou busque pelo nome">
        <div className="space-y-3">
          <Input label="Código ou nome" value={query} onChange={setQuery} placeholder="A1B2C3 ou Produto" />
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={searchGroups} disabled={joining}>
              Buscar
            </Button>
            <Button
              onClick={() => {
                void (async () => {
                  const list = await searchGroups();
                  if (list.length === 1) await joinGroup(list[0].id);
                })();
              }}
              disabled={joining}
            >
              {joining ? "Entrando…" : "Entrar (se 1 resultado)"}
            </Button>
          </div>

          {matches.length > 0 && (
            <div className="space-y-2">
              {matches.map((g) => (
                <button
                  key={g.id}
                  onClick={() => void joinGroup(g.id)}
                  className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-left hover:bg-black/30"
                >
                  <div>
                    <div className="font-semibold">{g.name}</div>
                    <div className="text-xs text-white/60">Código: {g.code}</div>
                  </div>
                  <div className="text-sm text-white/70">Entrar →</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </Card>
    </main>
  );
}


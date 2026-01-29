"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { Button, Card, Input } from "@/components/ui";
import { getLastGroupId, setLastGroupId } from "@/lib/localPrefs";

type GroupRow = { id: string; name: string; code: string };
type MyGroupRow = { group_id: string; groups: GroupRow | GroupRow[] | null };
type AuthStep = "checking" | "loggedOut" | "awaitingCode" | "loggedIn";

const KEY_PENDING_EMAIL = "watercup:pendingEmail";
const KEY_PENDING_NAME = "watercup:pendingName";

export default function HomePage() {
  const router = useRouter();

  const [step, setStep] = useState<AuthStep>("checking");
  const [userId, setUserId] = useState<string | null>(null);
  const [myGroups, setMyGroups] = useState<GroupRow[]>([]);
  const [loadingMyGroups, setLoadingMyGroups] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [sendingCode, setSendingCode] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);

  const [groupName, setGroupName] = useState("Time Produto");
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<GroupRow[]>([]);

  const [error, setError] = useState<string | null>(null);

  function isValidEmail(v: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim().toLowerCase());
  }

  function setPending(email: string, name: string) {
    try {
      localStorage.setItem(KEY_PENDING_EMAIL, email);
      localStorage.setItem(KEY_PENDING_NAME, name);
    } catch {
      // ignore
    }
  }

  function getPending() {
    try {
      return {
        email: localStorage.getItem(KEY_PENDING_EMAIL) ?? "",
        name: localStorage.getItem(KEY_PENDING_NAME) ?? ""
      };
    } catch {
      return { email: "", name: "" };
    }
  }

  function clearPending() {
    try {
      localStorage.removeItem(KEY_PENDING_EMAIL);
      localStorage.removeItem(KEY_PENDING_NAME);
    } catch {
      // ignore
    }
  }

  const refreshMyGroups = useCallback(
    async (uid: string) => {
    const supabase = supabaseBrowser();
    setLoadingMyGroups(true);
    const mg = await supabase.from("group_members").select("group_id, groups(id,name,code)").eq("user_id", uid);
    setLoadingMyGroups(false);
    if (mg.error) throw new Error(mg.error.message);

    const list = (mg.data ?? [])
      .map((r) => {
        const g = (r as unknown as MyGroupRow).groups;
        if (!g) return null;
        return Array.isArray(g) ? g[0] : g;
      })
      .filter(Boolean) as GroupRow[];

    setMyGroups(list);

    // Auto-continue: last group (or only group)
    const last = getLastGroupId();
    const lastExists = last && list.some((g) => g.id === last);
    if (lastExists) {
      router.push(`/g/${last}`);
      return;
    }
    if (list.length === 1) {
      setLastGroupId(list[0].id);
      router.push(`/g/${list[0].id}`);
      return;
    }
    },
    [router]
  );

  useEffect(() => {
    let mounted = true;
    (async () => {
      const supabase = supabaseBrowser();
      setError(null);
      const pending = getPending();
      if (pending.email) setEmail(pending.email);
      if (pending.name) setName(pending.name);

      // React to magic-link sign-in (user returns with #access_token...)
      const { data: sub } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (!mounted) return;
        if (event === "SIGNED_IN" && session?.user?.id) {
          const uid = session.user.id;
          setUserId(uid);
          setStep("loggedIn");

          // Persist chosen name (from pending or input)
          const n = (name || getPending().name).trim();
          if (n) {
            const up = await supabase.from("users").upsert({ id: uid, name: n });
            if (!up.error) setName(n);
          }

          clearPending();
          setOtp("");
          try {
            await refreshMyGroups(uid);
          } catch {
            // ignore
          }
        }
      });

      const { data } = await supabase.auth.getSession();
      const session = data.session;

      // If user is anonymous, force logout (we want unique login now)
      if (session?.user && (session.user as any).is_anonymous) {
        await supabase.auth.signOut();
      }

      const { data: sess2 } = await supabase.auth.getSession();
      const session2 = sess2.session;
      const uid = session2?.user.id ?? null;
      if (!mounted) return;

      if (!uid) {
        // If user already requested an OTP, stay on code step
        if (pending.email) setStep("awaitingCode");
        else setStep("loggedOut");
        return;
      }

      setUserId(uid);
      setStep("loggedIn");

      // Load current name (if any)
      const profile = await supabase.from("users").select("name").eq("id", uid).maybeSingle();
      if (!mounted) return;
      if (profile.data?.name) setName(profile.data.name);

      await refreshMyGroups(uid);
    })();
    return () => {
      mounted = false;
      // best-effort: subscription is created inside async; ignore if missing
    };
  }, [refreshMyGroups]);

  async function sendLoginCode() {
    const supabase = supabaseBrowser();
    setError(null);
    const e = email.trim().toLowerCase();
    const n = name.trim();
    if (!isValidEmail(e)) {
      setError("Digite um e-mail válido.");
      return;
    }
    if (!n) {
      setError("Digite seu nome (como vai aparecer no ranking).");
      return;
    }

    setSendingCode(true);
    try {
      setPending(e, n);
      const res = await supabase.auth.signInWithOtp({
        email: e,
        options: {
          shouldCreateUser: true,
          // Ensures the magic-link points to the current environment (localhost vs Vercel)
          emailRedirectTo: `${window.location.origin}/`
        }
      });
      if (res.error) throw new Error(res.error.message);
      setStep("awaitingCode");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao enviar código");
    } finally {
      setSendingCode(false);
    }
  }

  async function verifyCode() {
    const supabase = supabaseBrowser();
    setError(null);
    const e = email.trim().toLowerCase();
    const token = otp.trim();
    if (!isValidEmail(e)) {
      setError("E-mail inválido.");
      return;
    }
    if (!token) {
      setError("Digite o código do e-mail.");
      return;
    }

    setVerifying(true);
    try {
      const res = await supabase.auth.verifyOtp({ email: e, token, type: "email" });
      if (res.error) throw new Error(res.error.message);

      const { data: sess } = await supabase.auth.getSession();
      const uid = sess.session?.user.id ?? null;
      if (!uid) throw new Error("Falha ao iniciar sessão.");

      setUserId(uid);
      setStep("loggedIn");
      clearPending();
      setOtp("");

      // Persist the chosen name in public.users
      const n = name.trim();
      if (n) {
        const up = await supabase.from("users").upsert({ id: uid, name: n });
        if (up.error) throw new Error(up.error.message);
      }

      await refreshMyGroups(uid);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao validar código");
    } finally {
      setVerifying(false);
    }
  }

  async function logout() {
    const supabase = supabaseBrowser();
    setError(null);
    await supabase.auth.signOut();
    setUserId(null);
    setMyGroups([]);
    clearPending();
    setStep("loggedOut");
  }

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
      const mem = await supabase
        .from("group_members")
        .upsert({ group_id: groupId, user_id: userId! }, { onConflict: "user_id,group_id", ignoreDuplicates: true });
      if (mem.error) throw new Error(mem.error.message);

      setLastGroupId(groupId);
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
      const mem = await supabase
        .from("group_members")
        .upsert({ group_id: groupId, user_id: userId! }, { onConflict: "user_id,group_id", ignoreDuplicates: true });
      if (mem.error) throw new Error(mem.error.message);

      setLastGroupId(groupId);
      router.push(`/g/${groupId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro inesperado");
    } finally {
      setJoining(false);
    }
  }

  if (step === "checking") {
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

      {(step === "loggedIn" || step === "awaitingCode") && (
        <div className="flex justify-end">
          <button
            onClick={() => void logout()}
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10"
          >
            Sair
          </button>
        </div>
      )}

      {(step === "loggedOut" || step === "awaitingCode") && (
        <Card title="🔐 Entrar" subtitle="Seu login é único (por e-mail). Sem senha.">
          <div className="space-y-3">
            <Input label="Seu nome" value={name} onChange={setName} placeholder="Ex: Bruno" />
            <Input label="Seu e-mail" value={email} onChange={setEmail} placeholder="ex: bruno@empresa.com" />

            {step === "loggedOut" && (
              <Button onClick={() => void sendLoginCode()} disabled={sendingCode}>
                {sendingCode ? "Enviando…" : "Enviar código por e-mail"}
              </Button>
            )}

            {step === "awaitingCode" && (
              <>
                <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white/80">
                  Se você recebeu um <b>link</b>, clique nele e volte pra esta aba — o login acontece automaticamente.
                  Se recebeu um <b>código</b>, cole abaixo.
                </div>
                <Input label="Código (se houver)" value={otp} onChange={setOtp} placeholder="123456" />
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="secondary" onClick={() => setStep("loggedOut")} disabled={verifying}>
                    Trocar e-mail
                  </Button>
                  <Button onClick={() => void verifyCode()} disabled={verifying}>
                    {verifying ? "Validando…" : "Entrar"}
                  </Button>
                </div>
                <div className="text-xs text-white/60">
                  Dica: confira spam/lixo eletrônico. O código expira.
                </div>
              </>
            )}
          </div>
        </Card>
      )}

      {step !== "loggedIn" ? null : myGroups.length > 0 && (
        <Card title="✅ Você já está em" subtitle="Continue de onde parou">
          <div className="space-y-2">
            {myGroups.map((g) => (
              <button
                key={g.id}
                onClick={() => {
                  setLastGroupId(g.id);
                  router.push(`/g/${g.id}`);
                }}
                className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-left hover:bg-black/30"
              >
                <div>
                  <div className="font-semibold">{g.name}</div>
                  <div className="text-xs text-white/60">Código: {g.code}</div>
                </div>
                <div className="text-sm text-white/70">Abrir →</div>
              </button>
            ))}
            {loadingMyGroups && <div className="text-xs text-white/60">Carregando seus grupos…</div>}
          </div>
        </Card>
      )}

      {step === "loggedIn" && (
        <>
          <Card title="👤 Seu nome" subtitle="Você pode ajustar quando quiser">
            <Input label="Como você quer aparecer no ranking?" value={name} onChange={setName} placeholder="Ex: Bruno" />
            <div className="mt-2 text-xs text-white/60">Isso atualiza seu nome no ranking.</div>
            <div className="mt-3">
              <Button variant="secondary" onClick={() => void saveNameIfNeeded()}>
                Salvar nome
              </Button>
            </div>
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
        </>
      )}
    </main>
  );
}


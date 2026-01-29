import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";

// Load env like Next does (but for plain Node scripts)
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env ${name}`);
  return value;
}

function randPassword() {
  // Good enough for seed. Do not use for real auth.
  return `Seed-${Math.random().toString(36).slice(2)}-${Date.now()}`;
}

async function main() {
  const url = required("NEXT_PUBLIC_SUPABASE_URL");
  const service = required("SUPABASE_SERVICE_ROLE_KEY");

  const admin = createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  // 1) Group
  const groupName = "Time Produto";
  const g = await admin.from("groups").insert({ name: groupName }).select("id,code").single();
  if (g.error) throw new Error(g.error.message);

  const groupId = g.data.id as string;
  const code = g.data.code as string;

  // 2) Users (auth + profile via trigger)
  const people = [
    { name: "Ana", email: `ana+seed@watercup.local` },
    { name: "Bruno", email: `bruno+seed@watercup.local` },
    { name: "Carla", email: `carla+seed@watercup.local` }
  ];

  async function getOrCreateUser(email: string, name: string) {
    // Try create first (fast path)
    const password = randPassword();
    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });

    if (!created.error && created.data.user) {
      // Ensure public.users has correct name
      const up = await admin.from("users").update({ name }).eq("id", created.data.user.id);
      if (up.error) throw new Error(up.error.message);
      return { id: created.data.user.id, email, password, name, reused: false };
    }

    // If exists, reuse by listing users (MVP approach)
    const list = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    if (list.error) throw new Error(list.error.message);
    const existing = list.data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (!existing) throw new Error(created.error?.message ?? "Failed creating user");

    const up = await admin.from("users").update({ name }).eq("id", existing.id);
    if (up.error) throw new Error(up.error.message);
    return { id: existing.id, email, password: "(already exists)", name, reused: true };
  }

  const created: Array<{ id: string; email: string; password: string; name: string }> = [];
  for (const p of people) {
    const u = await getOrCreateUser(p.email, p.name);
    created.push({ id: u.id, email: u.email, password: u.password, name: u.name });
  }

  // 3) Memberships
  const mem = await admin
    .from("group_members")
    .upsert(created.map((u) => ({ group_id: groupId, user_id: u.id })));
  if (mem.error) throw new Error(mem.error.message);

  // 4) Water logs (some in this week)
  const now = new Date();
  const base = now.toISOString();
  const logs = [
    { user: created[0].id, ml: 500, created_at: base },
    { user: created[0].id, ml: 700, created_at: base },
    { user: created[1].id, ml: 300, created_at: base },
    { user: created[1].id, ml: 500, created_at: base },
    { user: created[2].id, ml: 500, created_at: base }
  ];

  const wl = await admin.from("water_logs").insert(
    logs.map((l) => ({
      group_id: groupId,
      user_id: l.user,
      ml: l.ml,
      created_at: l.created_at
    }))
  );
  if (wl.error) throw new Error(wl.error.message);

  // Output
  // eslint-disable-next-line no-console
  console.log("Seed OK ✅");
  // eslint-disable-next-line no-console
  console.log(`Group: ${groupName}`);
  // eslint-disable-next-line no-console
  console.log(`Group ID: ${groupId}`);
  // eslint-disable-next-line no-console
  console.log(`Group CODE: ${code}`);
  // eslint-disable-next-line no-console
  console.log("Users:");
  for (const u of created) {
    // eslint-disable-next-line no-console
    console.log(`- ${u.name}: ${u.email} | password: ${u.password}`);
  }
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});


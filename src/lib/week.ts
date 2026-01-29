export function weekRangeLabel(now = new Date()) {
  // Monday -> Sunday (local time, good enough for MVP)
  const day = now.getDay(); // 0 Sun..6 Sat
  const diffToMonday = (day + 6) % 7;
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(now.getDate() - diffToMonday);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const fmt = (d: Date) =>
    d.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit"
    });

  return `${fmt(monday)} → ${fmt(sunday)}`;
}


import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

type Trip = {
  id: string;
  user_id: string;
  destination: string;
  start_date: string;
  end_date: string | null;
  notes: string | null;
};

type ProfileLite = {
  id: string;
  email: string;
  display_name: string | null;
};

type FriendshipRow = {
  requester_id: string;
  addressee_id: string;
  requester: ProfileLite;
  addressee: ProfileLite;
};

type Person = {
  id: string;
  label: string;
  isMe: boolean;
  trips: Trip[];
};

const COLORS = {
  blue: "bg-blue-500",
  emerald: "bg-emerald-500",
  violet: "bg-violet-500",
  amber: "bg-amber-500",
  rose: "bg-rose-500",
  cyan: "bg-cyan-500",
  orange: "bg-orange-500",
} as const;

const COLOR_KEYS = Object.keys(COLORS) as Array<keyof typeof COLORS>;

function colorFor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) | 0;
  }
  return COLORS[COLOR_KEYS[Math.abs(hash) % COLOR_KEYS.length]];
}

function parseDateOnly(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatShort(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default async function TimelinePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
        <p>Sign in to see the timeline.</p>
        <Link href="/login" className="text-blue-600 hover:underline">
          Sign in
        </Link>
      </div>
    );
  }

  const [tripsRes, friendshipsRes, myProfileRes] = await Promise.all([
    supabase
      .from("trips")
      .select("id, user_id, destination, start_date, end_date, notes")
      .order("start_date", { ascending: true }),
    supabase
      .from("friendships")
      .select(
        `requester_id, addressee_id,
         requester:profiles!requester_id(id, email, display_name),
         addressee:profiles!addressee_id(id, email, display_name)`,
      )
      .eq("status", "accepted")
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`),
    supabase
      .from("profiles")
      .select("id, email, display_name")
      .eq("id", user.id)
      .maybeSingle(),
  ]);

  const trips = (tripsRes.data ?? []) as Trip[];
  const friendships = (friendshipsRes.data ?? []) as unknown as FriendshipRow[];
  const myProfile = myProfileRes.data as ProfileLite | null;

  // Build people list: me first, then accepted friends.
  const friendProfiles = new Map<string, ProfileLite>();
  friendships.forEach((f) => {
    const other = f.requester_id === user.id ? f.addressee : f.requester;
    friendProfiles.set(other.id, other);
  });

  const tripsByUser = new Map<string, Trip[]>();
  trips.forEach((t) => {
    const list = tripsByUser.get(t.user_id) ?? [];
    list.push(t);
    tripsByUser.set(t.user_id, list);
  });

  const people: Person[] = [
    {
      id: user.id,
      label: myProfile?.display_name || myProfile?.email || user.email || "You",
      isMe: true,
      trips: tripsByUser.get(user.id) ?? [],
    },
    ...Array.from(friendProfiles.values()).map((p) => ({
      id: p.id,
      label: p.display_name || p.email,
      isMe: false,
      trips: tripsByUser.get(p.id) ?? [],
    })),
  ];

  // Visible window: today through 6 months from now.
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const rangeEnd = new Date(today);
  rangeEnd.setMonth(rangeEnd.getMonth() + 6);
  const totalMs = rangeEnd.getTime() - today.getTime();

  // Generate a label for the start of each month in the range.
  const monthLabels: Array<{ label: string; leftPct: number }> = [];
  const cursor = new Date(today.getFullYear(), today.getMonth(), 1);
  while (cursor < rangeEnd) {
    const visibleStart = cursor < today ? today : cursor;
    monthLabels.push({
      label: cursor.toLocaleDateString("en-US", {
        month: "short",
        year: "2-digit",
      }),
      leftPct: ((visibleStart.getTime() - today.getTime()) / totalMs) * 100,
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  function tripRange(
    trip: Trip,
  ): { leftPct: number; widthPct: number; openEnded: boolean } | null {
    const start = parseDateOnly(trip.start_date);
    const rawEnd = trip.end_date ? parseDateOnly(trip.end_date) : rangeEnd;
    if (rawEnd < today || start >= rangeEnd) return null;
    const clampedStart = start < today ? today : start;
    const clampedEnd = rawEnd > rangeEnd ? rangeEnd : rawEnd;
    if (clampedStart >= clampedEnd) return null;
    return {
      leftPct: ((clampedStart.getTime() - today.getTime()) / totalMs) * 100,
      widthPct:
        ((clampedEnd.getTime() - clampedStart.getTime()) / totalMs) * 100,
      openEnded: trip.end_date === null,
    };
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 p-6">
      <header className="flex items-center justify-between">
        <Link href="/" className="text-blue-600 hover:underline">
          ← Home
        </Link>
        <h1 className="text-2xl font-bold">Timeline</h1>
        <span className="text-xs text-zinc-500">
          {formatShort(today)} – {formatShort(rangeEnd)}
        </span>
      </header>

      {people.length === 1 && people[0].trips.length === 0 ? (
        <p className="text-zinc-500">
          No trips to show yet. Add one, or add friends to see theirs.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <div className="min-w-[640px]">
            {/* Date axis */}
            <div className="grid" style={{ gridTemplateColumns: "10rem 1fr" }}>
              <div></div>
              <div className="relative h-6 border-b border-zinc-200 dark:border-zinc-800">
                {monthLabels.map((m, i) => (
                  <div
                    key={i}
                    className="absolute top-0 -translate-x-1/2 text-xs text-zinc-500"
                    style={{ left: `${m.leftPct}%` }}
                  >
                    {m.label}
                  </div>
                ))}
              </div>
            </div>

            {/* Person rows */}
            {people.map((p) => {
              const colorClass = colorFor(p.id);
              return (
                <div
                  key={p.id}
                  className="grid"
                  style={{ gridTemplateColumns: "10rem 1fr" }}
                >
                  <div className="flex items-center px-2 py-2 text-sm font-medium">
                    <span className={`mr-2 inline-block h-2 w-2 rounded-full ${colorClass}`} />
                    <span className="truncate">
                      {p.label}
                      {p.isMe && (
                        <span className="ml-1 text-xs font-normal text-zinc-500">
                          (you)
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="relative h-12 border-b border-zinc-100 dark:border-zinc-900">
                    {p.trips.map((trip) => {
                      const r = tripRange(trip);
                      if (!r) return null;
                      return (
                        <div
                          key={trip.id}
                          title={`${trip.destination} — ${trip.start_date}${trip.end_date ? ` to ${trip.end_date}` : " (ongoing)"}`}
                          className={`absolute top-2 flex h-8 items-center overflow-hidden rounded px-2 text-xs text-white ${colorClass}`}
                          style={{
                            left: `${r.leftPct}%`,
                            width: `max(${r.widthPct}%, 0.5rem)`,
                          }}
                        >
                          <span className="truncate">
                            {trip.destination}
                            {r.openEnded ? " →" : ""}
                          </span>
                        </div>
                      );
                    })}
                    {p.trips.length === 0 && (
                      <div className="absolute inset-0 flex items-center px-2 text-xs text-zinc-400">
                        No trips in this window
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

type Trip = {
  id: string;
  user_id: string;
  destination: string;
  start_date: string;
  end_date: string | null;
  notes: string | null;
  created_at: string;
};

type ProfileLite = { email: string; display_name: string | null };

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
        <h1 className="text-4xl font-bold">Voyager</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          Trip-sharing for friends.
        </p>
        <Link
          href="/login"
          className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
        >
          Sign in
        </Link>
      </div>
    );
  }

  const { data: tripsRaw, error } = await supabase
    .from("trips")
    .select("*")
    .order("start_date", { ascending: true });

  const trips = (tripsRaw ?? []) as Trip[];

  // Look up profile info for any trip not owned by the current user.
  const otherUserIds = Array.from(
    new Set(trips.map((t) => t.user_id).filter((id) => id !== user.id)),
  );
  const profilesById: Record<string, ProfileLite> = {};
  if (otherUserIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, email, display_name")
      .in("id", otherUserIds);
    profiles?.forEach((p) => {
      profilesById[p.id] = { email: p.email, display_name: p.display_name };
    });
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 p-8">
      <header className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Voyager</h1>
        <nav className="flex items-center gap-3">
          <Link
            href="/timeline"
            className="text-sm text-blue-600 hover:underline"
          >
            Timeline
          </Link>
          <Link
            href="/friends"
            className="text-sm text-blue-600 hover:underline"
          >
            Friends
          </Link>
          <form action="/auth/sign-out" method="post">
            <button className="rounded border border-zinc-300 px-3 py-1 text-sm hover:bg-zinc-100">
              Sign out
            </button>
          </form>
        </nav>
      </header>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Signed in as {user.email}
      </p>
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Trips</h2>
        <Link
          href="/trips/new"
          className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
        >
          Add trip
        </Link>
      </div>
      {error && (
        <p className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          Error loading trips: {error.message}
        </p>
      )}
      {!error && trips.length === 0 && (
        <p className="text-zinc-500">
          No trips yet — add your first one, or invite friends to see theirs.
        </p>
      )}
      {trips.length > 0 && (
        <ul className="flex flex-col gap-3">
          {trips.map((trip) => (
            <li
              key={trip.id}
              className="rounded border border-zinc-200 p-4 dark:border-zinc-800"
            >
              <div className="flex items-baseline justify-between gap-3">
                <div className="font-semibold">{trip.destination}</div>
                <div className="text-xs text-zinc-500">
                  {tripBy(trip, user.id, profilesById)}
                </div>
              </div>
              <div className="text-sm text-zinc-600 dark:text-zinc-400">
                {formatDateRange(trip.start_date, trip.end_date)}
              </div>
              {trip.notes && (
                <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
                  {trip.notes}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function tripBy(
  trip: Trip,
  currentUserId: string,
  profilesById: Record<string, ProfileLite>,
): string {
  if (trip.user_id === currentUserId) return "you";
  const p = profilesById[trip.user_id];
  return p?.display_name || p?.email || "a friend";
}

function formatDateRange(start: string, end: string | null) {
  if (!end) return `${formatDate(start)} – ongoing`;
  return `${formatDate(start)} – ${formatDate(end)}`;
}

function formatDate(s: string) {
  // s is "YYYY-MM-DD" — parse explicitly to avoid UTC-shift surprises.
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

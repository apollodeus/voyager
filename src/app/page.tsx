import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-4xl font-bold">Voyager</h1>
      <p className="text-zinc-600 dark:text-zinc-400">
        Trip-sharing for friends.
      </p>
      {user ? (
        <div className="flex flex-col items-center gap-3">
          <p>
            Signed in as <strong>{user.email}</strong>
          </p>
          <form action="/auth/sign-out" method="post">
            <button className="rounded bg-zinc-800 px-4 py-2 text-white hover:bg-zinc-900">
              Sign out
            </button>
          </form>
        </div>
      ) : (
        <Link
          href="/login"
          className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
        >
          Sign in
        </Link>
      )}
    </div>
  );
}

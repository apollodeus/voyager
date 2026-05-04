"use client";

import { createClient } from "@/lib/supabase/client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

type ProfileLite = {
  id: string;
  email: string;
  display_name: string | null;
};

type FriendshipRow = {
  requester_id: string;
  addressee_id: string;
  status: "pending" | "accepted";
  created_at: string;
  requester: ProfileLite;
  addressee: ProfileLite;
};

export default function FriendsPage() {
  const supabase = createClient();
  const [me, setMe] = useState<{ id: string } | null>(null);
  const [incoming, setIncoming] = useState<FriendshipRow[]>([]);
  const [outgoing, setOutgoing] = useState<FriendshipRow[]>([]);
  const [friends, setFriends] = useState<FriendshipRow[]>([]);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setLoading(false);
      return;
    }
    const myId = userData.user.id;
    setMe({ id: myId });

    const { data, error } = await supabase
      .from("friendships")
      .select(
        `requester_id, addressee_id, status, created_at,
         requester:profiles!requester_id(id, email, display_name),
         addressee:profiles!addressee_id(id, email, display_name)`,
      )
      .or(`requester_id.eq.${myId},addressee_id.eq.${myId}`);

    if (error) {
      setMessage(`Error loading friendships: ${error.message}`);
      setLoading(false);
      return;
    }

    const all = (data ?? []) as unknown as FriendshipRow[];
    setIncoming(
      all.filter((f) => f.status === "pending" && f.addressee_id === myId),
    );
    setOutgoing(
      all.filter((f) => f.status === "pending" && f.requester_id === myId),
    );
    setFriends(all.filter((f) => f.status === "accepted"));
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  async function sendRequest(e: React.FormEvent) {
    e.preventDefault();
    if (!me) return;
    setSubmitting(true);
    setMessage("");

    const { data: lookup, error: lookupError } = await supabase.rpc(
      "find_user_by_email",
      { lookup_email: email.trim().toLowerCase() },
    );

    if (lookupError) {
      setMessage(`Lookup error: ${lookupError.message}`);
      setSubmitting(false);
      return;
    }

    const target = (lookup as ProfileLite[] | null)?.[0];
    if (!target) {
      setMessage("No user found with that email.");
      setSubmitting(false);
      return;
    }

    if (target.id === me.id) {
      setMessage("You can't friend yourself.");
      setSubmitting(false);
      return;
    }

    // If they already sent us a request, accept it instead of duplicating.
    const existingFromThem = incoming.find(
      (f) => f.requester_id === target.id,
    );
    if (existingFromThem) {
      const { error: updError } = await supabase
        .from("friendships")
        .update({ status: "accepted" })
        .eq("requester_id", target.id)
        .eq("addressee_id", me.id);
      if (updError) setMessage(`Error: ${updError.message}`);
      else {
        setMessage(`${target.email} had already sent you a request — accepted.`);
        setEmail("");
        await load();
      }
      setSubmitting(false);
      return;
    }

    const { error: insError } = await supabase.from("friendships").insert({
      requester_id: me.id,
      addressee_id: target.id,
      status: "pending",
    });

    if (insError) {
      if (insError.code === "23505") {
        setMessage("A friend request already exists between you two.");
      } else {
        setMessage(`Error: ${insError.message}`);
      }
    } else {
      setMessage(`Friend request sent to ${target.email}.`);
      setEmail("");
      await load();
    }
    setSubmitting(false);
  }

  async function accept(req: FriendshipRow) {
    const { error } = await supabase
      .from("friendships")
      .update({ status: "accepted" })
      .eq("requester_id", req.requester_id)
      .eq("addressee_id", req.addressee_id);
    if (error) setMessage(`Error: ${error.message}`);
    else await load();
  }

  async function remove(req: FriendshipRow) {
    const { error } = await supabase
      .from("friendships")
      .delete()
      .eq("requester_id", req.requester_id)
      .eq("addressee_id", req.addressee_id);
    if (error) setMessage(`Error: ${error.message}`);
    else await load();
  }

  function otherUser(f: FriendshipRow): ProfileLite {
    return f.requester_id === me?.id ? f.addressee : f.requester;
  }

  function displayName(u: ProfileLite): string {
    return u.display_name || u.email;
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8 p-8">
      <header className="flex items-center justify-between">
        <Link href="/" className="text-blue-600 hover:underline">
          ← Home
        </Link>
        <h1 className="text-3xl font-bold">Friends</h1>
      </header>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Send a friend request</h2>
        <form onSubmit={sendRequest} className="flex gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="friend@example.com"
            required
            className="flex-1 rounded border border-zinc-300 px-3 py-2"
          />
          <button
            type="submit"
            disabled={submitting}
            className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? "Sending…" : "Send"}
          </button>
        </form>
        {message && <p className="mt-2 text-sm text-zinc-700">{message}</p>}
      </section>

      {loading ? (
        <p className="text-zinc-500">Loading…</p>
      ) : (
        <>
          {incoming.length > 0 && (
            <section>
              <h2 className="mb-3 text-lg font-semibold">
                Incoming requests ({incoming.length})
              </h2>
              <ul className="flex flex-col gap-2">
                {incoming.map((req) => (
                  <li
                    key={req.requester_id + req.addressee_id}
                    className="flex items-center justify-between rounded border border-zinc-200 p-3"
                  >
                    <span>{displayName(req.requester)}</span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => accept(req)}
                        className="rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700"
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => remove(req)}
                        className="rounded border border-zinc-300 px-3 py-1 text-sm hover:bg-zinc-100"
                      >
                        Decline
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {outgoing.length > 0 && (
            <section>
              <h2 className="mb-3 text-lg font-semibold">Pending sent</h2>
              <ul className="flex flex-col gap-2">
                {outgoing.map((req) => (
                  <li
                    key={req.requester_id + req.addressee_id}
                    className="flex items-center justify-between rounded border border-zinc-200 p-3 text-sm text-zinc-600"
                  >
                    <span>{displayName(req.addressee)}</span>
                    <button
                      onClick={() => remove(req)}
                      className="text-zinc-500 hover:text-red-600"
                    >
                      Cancel
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section>
            <h2 className="mb-3 text-lg font-semibold">
              Friends ({friends.length})
            </h2>
            {friends.length === 0 ? (
              <p className="text-zinc-500">
                No friends yet — send a request above.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {friends.map((f) => (
                  <li
                    key={f.requester_id + f.addressee_id}
                    className="rounded border border-zinc-200 p-3"
                  >
                    {displayName(otherUser(f))}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}

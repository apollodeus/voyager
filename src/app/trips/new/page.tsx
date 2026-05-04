"use client";

import { createClient } from "@/lib/supabase/client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewTripPage() {
  const [destination, setDestination] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (endDate && new Date(endDate) < new Date(startDate)) {
      setError("End date can't be before start date.");
      return;
    }

    setSubmitting(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("Not signed in.");
      setSubmitting(false);
      return;
    }

    const { error: insertError } = await supabase.from("trips").insert({
      user_id: user.id,
      destination,
      start_date: startDate,
      end_date: endDate || null,
      notes: notes || null,
    });

    if (insertError) {
      setError(insertError.message);
      setSubmitting(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-md p-8">
      <h1 className="mb-6 text-2xl font-bold">Add a trip</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Destination</span>
          <input
            type="text"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            placeholder="Tokyo, Japan"
            required
            className="rounded border border-zinc-300 px-3 py-2"
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">Start date</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
              className="rounded border border-zinc-300 px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">End date (optional)</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="rounded border border-zinc-300 px-3 py-2"
            />
          </label>
        </div>
        <p className="-mt-2 text-xs text-zinc-500">
          Leave end date blank if you don&apos;t have a return date yet.
        </p>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Notes (optional)</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Hotel, things to do, who's coming, etc."
            rows={4}
            className="rounded border border-zinc-300 px-3 py-2"
          />
        </label>
        {error && (
          <p className="rounded border border-red-300 bg-red-50 p-2 text-sm text-red-700">
            {error}
          </p>
        )}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={submitting}
            className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? "Saving…" : "Save trip"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/")}
            className="rounded border border-zinc-300 px-4 py-2 hover:bg-zinc-100"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

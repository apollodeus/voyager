"use client";

import { createClient } from "@/lib/supabase/client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const router = useRouter();

  const supabase = createClient();

  async function signUp(e: React.MouseEvent) {
    e.preventDefault();
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) {
      setMessage(error.message);
    } else {
      setMessage(
        "Account created. If email confirmation is enabled, check your inbox before signing in.",
      );
    }
  }

  async function signIn(e: React.MouseEvent) {
    e.preventDefault();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      setMessage(error.message);
    } else {
      router.push("/");
      router.refresh();
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-bold">Voyager</h1>
        <form className="space-y-3">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2"
            required
          />
          <input
            type="password"
            placeholder="Password (min 6 characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2"
            required
          />
          <div className="flex gap-2">
            <button
              onClick={signIn}
              className="flex-1 rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
            >
              Sign in
            </button>
            <button
              onClick={signUp}
              className="flex-1 rounded border border-blue-600 px-4 py-2 text-blue-600 hover:bg-blue-50"
            >
              Sign up
            </button>
          </div>
        </form>
        {message && <p className="text-sm text-gray-700">{message}</p>}
      </div>
    </div>
  );
}

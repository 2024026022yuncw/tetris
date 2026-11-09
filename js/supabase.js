// Thin Supabase wrapper for scores + feedback.
// Falls back to a disabled client when config is missing so the game still loads.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "../config.js";

let client = null;
let enabled = false;

if (SUPABASE_URL && SUPABASE_ANON_KEY) {
  try {
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false },
    });
    enabled = true;
  } catch (err) {
    console.warn("[supabase] failed to create client:", err);
  }
}

export function isEnabled() { return enabled; }

export async function saveScore({ nickname, score, lines, level }) {
  if (!enabled) throw new Error("Supabase is not configured.");
  const trimmed = String(nickname ?? "").trim().slice(0, 16);
  if (!trimmed) throw new Error("Nickname is required.");
  const { data, error } = await client
    .from("scores")
    .insert({ nickname: trimmed, score: score|0, lines: lines|0, level: level|0 })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function fetchTopScores(limit = 10) {
  if (!enabled) return [];
  const { data, error } = await client
    .from("scores")
    .select("nickname, score, lines, level, created_at")
    .order("score", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function submitFeedback({ name, message }) {
  if (!enabled) throw new Error("Supabase is not configured.");
  const n = String(name ?? "").trim().slice(0, 20) || "Anonymous";
  const m = String(message ?? "").trim();
  if (!m) throw new Error("Message is required.");
  if (m.length > 500) throw new Error("Message is too long (max 500).");
  const { data, error } = await client
    .from("feedback")
    .insert({ name: n, message: m })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function fetchFeedback(limit = 20) {
  if (!enabled) return [];
  const { data, error } = await client
    .from("feedback")
    .select("name, message, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

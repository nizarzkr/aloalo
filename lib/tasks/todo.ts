// ============================================================================
// lib/tasks/todo.ts — File « À faire » (J37, axe Travailler)
// ============================================================================
// Agrège les tâches de suivi datées que l'IA produit déjà par appel
// (analyses.suggested_tasks = { title, due_date, reason }) en une file unique,
// groupée par urgence et COCHABLE. La complétion est persistée dans
// task_completions (migration 0031) — absence de ligne = à faire.
//
// Les suggested_tasks n'ont pas d'id → on identifie une tâche par
// (call_id, task_key) où task_key = le titre normalisé.
//
// Sécurité : table RLS server-only → lecture/écriture via le client admin ici ;
// le gating user_id = soi-même est fait dans la server action.
// ============================================================================

import { createClient as createAdminClient } from '@supabase/supabase-js'

function admin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { persistSession: false } },
  )
}

const RECENT_CALLS_LIMIT = 60

export type TodoBucket = 'overdue' | 'today' | 'week' | 'later' | 'nodate'

export type TodoTask = {
  callId: string
  taskKey: string
  title: string
  dueDate: string | null // AAAA-MM-JJ
  reason: string | null
  contactLabel: string
  bucket: TodoBucket
  done: boolean
}

export type UserTodos = {
  tasks: TodoTask[] // tri global par échéance (sans date en dernier)
  weeklyDoneCount: number // tâches bouclées sur les 7 derniers jours (touche motivante)
}

// Clé stable d'une tâche dans un appel (titre normalisé, borné à la colonne).
export function taskKeyOf(title: string): string {
  return title.trim().slice(0, 300)
}

// Range une échéance dans un bucket d'urgence (comparaison en jours locaux).
function bucketize(dueDate: string | null, now = new Date()): TodoBucket {
  if (!dueDate) return 'nodate'
  const d = new Date(dueDate)
  if (Number.isNaN(d.getTime())) return 'nodate'
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const due = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const diffDays = Math.round((due.getTime() - startOfToday.getTime()) / 86_400_000)
  if (diffDays < 0) return 'overdue'
  if (diffDays === 0) return 'today'
  if (diffDays <= 7) return 'week'
  return 'later'
}

// Normalise l'embed FK analyses (objet ou tableau selon le client).
function suggestedTasksOf(rel: unknown): Array<{ title?: string; due_date?: string; reason?: string }> {
  const a = (Array.isArray(rel) ? rel[0] : rel) as { suggested_tasks?: unknown } | null
  return Array.isArray(a?.suggested_tasks)
    ? (a.suggested_tasks as Array<{ title?: string; due_date?: string; reason?: string }>)
    : []
}

/** File « À faire » d'un utilisateur (ses appels uniquement). */
export async function getUserTodos(orgId: string, userId: string): Promise<UserTodos> {
  const supabase = admin()

  const [{ data: callRows }, { data: doneRows }] = await Promise.all([
    supabase
      .from('calls')
      .select('id, contact_name, callee_number, company_name, analyses ( suggested_tasks )')
      .eq('organization_id', orgId)
      .eq('user_id', userId)
      .eq('status', 'analyzed')
      .order('created_at', { ascending: false })
      .limit(RECENT_CALLS_LIMIT),
    supabase
      .from('task_completions')
      .select('call_id, task_key, done_at')
      .eq('organization_id', orgId)
      .eq('user_id', userId),
  ])

  // Set des clés faites + comptage hebdo (touche motivante).
  const doneSet = new Set<string>()
  const weekAgo = Date.now() - 7 * 86_400_000
  let weeklyDoneCount = 0
  for (const r of doneRows ?? []) {
    doneSet.add(`${r.call_id}::${r.task_key}`)
    if (r.done_at && new Date(r.done_at).getTime() >= weekAgo) weeklyDoneCount += 1
  }

  const tasks: TodoTask[] = []
  for (const c of callRows ?? []) {
    const contactLabel =
      c.contact_name ?? c.callee_number ?? c.company_name ?? 'Appel sans contact'
    for (const t of suggestedTasksOf(c.analyses)) {
      const title = typeof t.title === 'string' ? t.title.trim() : ''
      if (!title) continue
      const taskKey = taskKeyOf(title)
      const dueDate = typeof t.due_date === 'string' ? t.due_date : null
      tasks.push({
        callId: c.id,
        taskKey,
        title,
        dueDate,
        reason: typeof t.reason === 'string' ? t.reason : null,
        contactLabel,
        bucket: bucketize(dueDate),
        done: doneSet.has(`${c.id}::${taskKey}`),
      })
    }
  }

  // Tri global par échéance ; les sans-date en dernier.
  tasks.sort((a, b) => (a.dueDate ?? '9999-99-99').localeCompare(b.dueDate ?? '9999-99-99'))

  return { tasks, weeklyDoneCount }
}

/** Coche (done=true) ou décoche (done=false) une tâche pour un utilisateur. */
export async function setTaskDone(
  orgId: string,
  userId: string,
  callId: string,
  title: string,
  done: boolean,
): Promise<{ ok: boolean; error?: string }> {
  if (!orgId || !userId || !callId) return { ok: false, error: 'Paramètres manquants.' }
  const supabase = admin()
  const taskKey = taskKeyOf(title)

  if (done) {
    const { error } = await supabase.from('task_completions').upsert(
      {
        organization_id: orgId,
        user_id: userId,
        call_id: callId,
        task_key: taskKey,
        done_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,call_id,task_key' },
    )
    if (error) {
      console.error('[todo] upsert complétion échouée', error.message)
      return { ok: false, error: 'Enregistrement impossible.' }
    }
  } else {
    const { error } = await supabase
      .from('task_completions')
      .delete()
      .eq('organization_id', orgId)
      .eq('user_id', userId)
      .eq('call_id', callId)
      .eq('task_key', taskKey)
    if (error) {
      console.error('[todo] suppression complétion échouée', error.message)
      return { ok: false, error: 'Enregistrement impossible.' }
    }
  }
  return { ok: true }
}

// ============================================================================
// /dashboard/todo — « À faire » (J37, axe Travailler)
// ============================================================================
// Agrège les tâches de suivi (suggested_tasks) de tous les appels de l'user en
// une file unique, groupée par urgence et cochable. Vue PERSONNELLE (ses appels).
// ============================================================================

import { redirect } from "next/navigation";
import { ListTodo } from "lucide-react";

import { SectionHeading } from "@/components/dashboard/section-heading";
import { TodoList } from "@/components/dashboard/todo-list";
import { getUserTodos } from "@/lib/tasks/todo";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function TodoPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .single();
  if (!profile?.organization_id) redirect("/dashboard");

  const { tasks, weeklyDoneCount } = await getUserTodos(
    profile.organization_id,
    user.id,
  );

  return (
    <div className="mx-auto max-w-3xl px-6 py-10 md:px-10">
      <SectionHeading
        icon={ListTodo}
        title="À faire"
        description="Tes relances et prochaines étapes, proposées à partir de tes appels — rien à noter."
      />
      <TodoList tasks={tasks} weeklyDoneCount={weeklyDoneCount} />
    </div>
  );
}

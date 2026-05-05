import { notFound } from "next/navigation"
import Link from "next/link"
import { getTask } from "@/lib/tasks"
import { TaskChat } from "./task-chat"
import { AgentAvatar } from "@/components/agent-avatar"

type Props = { params: Promise<{ id: string }> }

export default async function TaskPage({ params }: Props) {
  const { id } = await params
  const task = await getTask(id)
  if (!task) notFound()

  const supabaseUrl = process.env.SUPABASE_URL!
  const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY!

  return (
    <div className="task-page">
      <div className="task-header">
        <Link href="/kanban" className="back-link">← Board</Link>
        <h1>{task.title}</h1>
      </div>
      {task.agent && (
        <div className="task-agent">
          <AgentAvatar
            id={task.agent.id}
            name={task.agent.name}
            avatar={task.agent.avatar}
            size={24}
          />
          <span>{task.agent.name}</span>
        </div>
      )}
      {task.description && <p className="task-desc">{task.description}</p>}
      <TaskChat
        key={task.id}
        initialTask={task}
        supabaseUrl={supabaseUrl}
        supabaseKey={supabaseKey}
      />
    </div>
  )
}

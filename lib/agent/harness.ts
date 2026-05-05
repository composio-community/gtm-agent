import "server-only"
import { createTools } from "./tools"
import {
  streamText,
  stepCountIs,
  tool,
  ModelMessage,
} from "ai"
import { openai } from "@ai-sdk/openai"
import { anthropic } from "@ai-sdk/anthropic"
import { z } from "zod"
import { getAdmin } from "@/lib/supabase/admin"

const MODEL = "claude-opus-4-7" // "gpt-5.4"
const DEFAULT_SYSTEM = `You are a GTM (go-to-market) assistant working on a single task in a persistent thread.
Use the available tools to research leads, draft outreach, and complete the task.`

const SYSTEM_RULES = `Rules:
- Format ALL responses in Markdown: use headings, bullet lists, bold, links, tables, code blocks as appropriate.
- Be direct. Do the work — don't ask "would you like me to…" or offer menus of options. Just execute the task fully.
- When the task is complete, call the \`mark_done\` tool with a short title and summary. This closes the task and notifies the user.`

function buildSystem(agentPrompt: string | null, agentName: string | null): string {
  const persona = agentPrompt?.trim()
  const base = persona
    ? `You are ${agentName ?? "an agent"}.\n\n${persona}`
    : DEFAULT_SYSTEM
  return `${base}\n\n${SYSTEM_RULES}`
}

type RunArgs = { taskId: string; userId: string }

async function resolveEmail(userId: string): Promise<string> {
  const admin = getAdmin()
  const { data } = await admin.auth.admin.getUserById(userId)
  return data?.user?.email ?? userId
}

export async function runAgentConversation({ taskId, userId }: RunArgs): Promise<void> {
  const admin = getAdmin()

  const { data: task, error: loadErr } = await admin
    .from("tasks")
    .select("id, title, messages, status, user_id, agent_id")
    .eq("id", taskId)
    .eq("user_id", userId)
    .maybeSingle()
  if (loadErr || !task) return

  const userEmail = await resolveEmail(userId)
  const priorMessages = (task.messages as ModelMessage[] | null) ?? []

  let agentName: string | null = null
  let agentPrompt: string | null = null
  if (task.agent_id) {
    const { data: agentRow } = await admin
      .from("agents")
      .select("name, system_prompt")
      .eq("id", task.agent_id)
      .eq("user_id", userId)
      .maybeSingle()
    if (agentRow) {
      agentName = agentRow.name as string
      agentPrompt = agentRow.system_prompt as string
    }
  }
  const system = buildSystem(agentPrompt, agentName)

  await admin
    .from("tasks")
    .update({ status: "in_progress" })
    .eq("id", taskId)
    .eq("user_id", userId)

  let markedDone = false

  const markDoneTool = tool({
    description:
      "Mark the current task as done. Call this ONLY when the task is fully complete and you have delivered the requested output.",
    inputSchema: z.object({
      title: z.string().describe("Short title for the completion notification (≤80 chars)"),
      summary: z
        .string()
        .describe("One-paragraph summary of what was accomplished, shown in the user's inbox"),
    }),
    execute: async ({ title, summary }) => {
      markedDone = true
      await admin.from("notifications").insert({
        user_id: userId,
        task_id: taskId,
        type: "task_done",
        title,
        body: summary,
      })
      return { ok: true }
    },
  })

  try {
    const composioTools = await createTools(userId, userEmail)
    const tools = { ...composioTools, mark_done: markDoneTool }

    let generated: ModelMessage[] = []

    const result = streamText({
      model: anthropic(MODEL),
      system,
      messages: priorMessages,
      tools,
      stopWhen: stepCountIs(40),
      onStepFinish: async ({ response }) => {
        generated = [...generated, ...response.messages]
        // Push intermediate progress so Realtime updates the client live.
        await admin
          .from("tasks")
          .update({ messages: [...priorMessages, ...generated] })
          .eq("id", taskId)
          .eq("user_id", userId)
      },
    })

    await result.consumeStream()

    // Final authoritative write — corrects any duplication from intermediate writes.
    const finalGenerated = (await result.response).messages
    const final = [...priorMessages, ...finalGenerated]

    await admin
      .from("tasks")
      .update({
        messages: final,
        status: markedDone ? "done" : "in_progress",
      })
      .eq("id", taskId)
      .eq("user_id", userId)
  } catch (e: any) {
    const errMsg = e?.message ?? String(e)
    // Write the error into the chat so the user sees it.
    const currentMessages = priorMessages ?? []
    const errorMessage: ModelMessage = {
      role: "assistant",
      content: `**Error:** ${errMsg}`,
    }
    await admin
      .from("tasks")
      .update({
        status: "error",
        messages: [...currentMessages, errorMessage],
      })
      .eq("id", taskId)
      .eq("user_id", userId)
    await admin.from("notifications").insert({
      user_id: userId,
      task_id: taskId,
      type: "task_error",
      title: "Task failed",
      body: errMsg.slice(0, 800),
    })
  }
}

export async function appendUserMessageAndRun({
  taskId,
  userId,
  text,
}: {
  taskId: string
  userId: string
  text: string
}): Promise<void> {
  const admin = getAdmin()

  const { data: task } = await admin
    .from("tasks")
    .select("messages")
    .eq("id", taskId)
    .eq("user_id", userId)
    .maybeSingle()
  if (!task) return

  const prior = (task.messages as ModelMessage[] | null) ?? []
  const next = [...prior, { role: "user" as const, content: text }]

  await admin
    .from("tasks")
    .update({ messages: next })
    .eq("id", taskId)
    .eq("user_id", userId)

  await runAgentConversation({ taskId, userId })
}

"use client"

import { useCallback, useState, useTransition } from "react"
import type { Agent } from "@/lib/agents"
import { AgentAvatar } from "@/components/agent-avatar"
import { AVATAR_SET, getAvatarOption } from "@/lib/avatar-set"

type Draft = {
  id?: string
  name: string
  avatar: string
  description: string
  systemPrompt: string
}

function randomAvatarKey(): string {
  return AVATAR_SET[Math.floor(Math.random() * AVATAR_SET.length)].key
}

function emptyDraft(): Draft {
  return { name: "", avatar: randomAvatarKey(), description: "", systemPrompt: "" }
}

// Stable id used for avatar color in the "new agent" preview before the row is created.
const DRAFT_PREVIEW_ID = "__draft__"

export function AgentsClient({ initialAgents }: { initialAgents: Agent[] }) {
  const [agents, setAgents] = useState<Agent[]>(initialAgents)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [saving, startSave] = useTransition()

  const refresh = useCallback(async () => {
    const res = await fetch("/api/agents", { cache: "no-store" })
    if (res.ok) setAgents(await res.json())
  }, [])

  const startNew = useCallback(() => setDraft(emptyDraft()), [])
  const startEdit = useCallback(
    (a: Agent) =>
      setDraft({
        id: a.id,
        name: a.name,
        avatar: a.avatar ?? "",
        description: a.description ?? "",
        systemPrompt: a.systemPrompt,
      }),
    [],
  )
  const cancel = useCallback(() => setDraft(null), [])

  const save = useCallback(() => {
    if (!draft) return
    if (!draft.name.trim() || !draft.systemPrompt.trim()) return
    const body = {
      name: draft.name.trim(),
      avatar: draft.avatar,
      description: draft.description.trim(),
      systemPrompt: draft.systemPrompt.trim(),
    }
    startSave(async () => {
      if (draft.id) {
        await fetch(`/api/agents/${draft.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        })
      } else {
        await fetch("/api/agents", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        })
      }
      setDraft(null)
      await refresh()
    })
  }, [draft, refresh])

  const remove = useCallback(
    async (id: string) => {
      if (!confirm("Delete this agent? Existing tasks that used it will revert to the default persona.")) return
      await fetch(`/api/agents/${id}`, { method: "DELETE" })
      await refresh()
    },
    [refresh],
  )

  return (
    <div style={{ marginTop: 20 }}>
      {!draft && (
        <div className="row" style={{ marginBottom: 16 }}>
          <button className="primary" onClick={startNew}>+ New agent</button>
        </div>
      )}

      {draft && (
        <div className="card" style={{ marginBottom: 20, padding: 20 }}>
          <div className="row" style={{ gap: 12, alignItems: "center", marginBottom: 16 }}>
            <AgentAvatar
              id={draft.id ?? DRAFT_PREVIEW_ID}
              name={draft.name || "New"}
              avatar={draft.avatar}
              size={48}
            />
            <div>
              <strong style={{ fontSize: 14 }}>
                {draft.id ? "Edit agent" : "New agent"}
              </strong>
              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                {getAvatarOption(draft.avatar)?.label ?? "Monogram"}
              </div>
            </div>
          </div>

          <label className="field-label">Avatar</label>
          <div className="avatar-picker">
            {AVATAR_SET.map((opt) => (
              <button
                key={opt.key}
                type="button"
                className={`avatar-pick${draft.avatar === opt.key ? " selected" : ""}`}
                onClick={() => setDraft({ ...draft, avatar: opt.key })}
                title={opt.label}
                aria-label={opt.label}
              >
                <AgentAvatar
                  id={draft.id ?? DRAFT_PREVIEW_ID}
                  name={opt.label}
                  avatar={opt.key}
                  size={44}
                />
              </button>
            ))}
          </div>

          <label className="field-label">Name</label>
          <input
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            placeholder="Lead Scout"
            style={{ marginBottom: 14, width: "100%" }}
          />

          <label className="field-label">Description (optional)</label>
          <input
            value={draft.description}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            placeholder="What this agent is for"
            style={{ marginBottom: 14, width: "100%" }}
          />

          <label className="field-label">System prompt</label>
          <textarea
            value={draft.systemPrompt}
            onChange={(e) => setDraft({ ...draft, systemPrompt: e.target.value })}
            placeholder="You are a meticulous outbound researcher. You…"
            rows={10}
            style={{
              width: "100%",
              fontFamily: "ui-monospace, Menlo, Consolas, monospace",
              fontSize: 12,
              marginBottom: 14,
              resize: "vertical",
            }}
          />

          <div className="row">
            <button
              className="primary"
              onClick={save}
              disabled={saving || !draft.name.trim() || !draft.systemPrompt.trim()}
            >
              {saving ? "Saving…" : draft.id ? "Save" : "Create"}
            </button>
            <button type="button" onClick={cancel} disabled={saving}>Cancel</button>
          </div>
        </div>
      )}

      <div className="agent-grid">
        {agents.length === 0 && !draft && (
          <div style={{ color: "var(--muted)", fontSize: 13 }}>
            No agents yet. Create one to give your tasks a persona.
          </div>
        )}
        {agents.map((a) => (
          <div key={a.id} className="card agent-card">
            <div className="row" style={{ gap: 12, alignItems: "center", marginBottom: 8 }}>
              <AgentAvatar id={a.id} name={a.name} avatar={a.avatar} size={40} />
              <h4 style={{ margin: 0 }}>{a.name}</h4>
            </div>
            {a.description && <p>{a.description}</p>}
            <pre>{a.systemPrompt}</pre>
            <div className="row">
              <button onClick={() => startEdit(a)}>Edit</button>
              <button onClick={() => remove(a.id)}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

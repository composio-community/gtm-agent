export default function Loading() {
  return (
    <div className="task-page">
      <div className="task-header">
        <span className="back-link">← Board</span>
        <h1 style={{ opacity: 0.25 }}>Loading…</h1>
      </div>
      <div className="chat">
        <div className="chat-status">
          <span className="dot status-in_progress" />
          loading…
        </div>
        <div className="messages">
          <div className="msg assistant typing">
            <span className="dots"><i /><i /><i /></span>
          </div>
        </div>
      </div>
    </div>
  )
}

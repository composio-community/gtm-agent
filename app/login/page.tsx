import { signInAction, signUpAction } from "./actions"

type Props = {
  searchParams: Promise<{ error?: string; info?: string; next?: string }>
}

export default async function LoginPage({ searchParams }: Props) {
  const { error, info, next } = await searchParams

  return (
    <div className="login-wrap">
      <div className="login-card">
        <h1>GTM Agent</h1>
        <p style={{ color: "var(--muted)", marginTop: 4 }}>Sign in or create an account.</p>

        {error && <div className="alert error">{error}</div>}
        {info && <div className="alert info">{info}</div>}

        <form className="login-form">
          <input type="hidden" name="next" value={next ?? "/kanban"} />
          <label>
            Email
            <input type="email" name="email" required autoComplete="email" />
          </label>
          <label>
            Password
            <input type="password" name="password" required minLength={6} autoComplete="current-password" />
          </label>
          <div className="row">
            <button className="primary" formAction={signInAction}>
              Sign in
            </button>
            <button formAction={signUpAction}>Sign up</button>
          </div>
        </form>
      </div>
    </div>
  )
}

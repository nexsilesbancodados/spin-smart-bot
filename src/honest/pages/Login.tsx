import { memo, useState, FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { signIn, signUp, resetPassword, useAuth } from "../lib/auth";
import { Card, PageContainer, SectionHeader, Button } from "../components/ui";

type Mode = "login" | "signup" | "reset";

const Login = memo(() => {
  const session = useAuth((s) => s.session);
  const loading = useAuth((s) => s.loading);
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  if (loading) {
    return (
      <PageContainer>
        <Card padding="md">
          <div className="text-center text-neutral-400 text-sm py-8">Carregando…</div>
        </Card>
      </PageContainer>
    );
  }

  if (session) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFeedback(null);

    if (!email || !email.includes("@")) {
      setFeedback({ kind: "err", msg: "Email inválido" });
      setSubmitting(false);
      return;
    }

    if (mode === "reset") {
      const r = await resetPassword(email);
      if (r.ok) {
        setFeedback({
          kind: "ok",
          msg: "Email enviado. Confira sua caixa de entrada (inclusive spam).",
        });
      } else {
        setFeedback({ kind: "err", msg: r.error ?? "Erro ao enviar email" });
      }
      setSubmitting(false);
      return;
    }

    if (!password || password.length < 6) {
      setFeedback({ kind: "err", msg: "Senha precisa ter pelo menos 6 caracteres" });
      setSubmitting(false);
      return;
    }

    if (mode === "signup") {
      if (password !== confirmPassword) {
        setFeedback({ kind: "err", msg: "Senhas não coincidem" });
        setSubmitting(false);
        return;
      }
      const r = await signUp(email, password);
      if (r.ok) {
        setFeedback({
          kind: "ok",
          msg: "Conta criada. Verifique seu email pra confirmar — depois faça login.",
        });
        setMode("login");
      } else {
        setFeedback({ kind: "err", msg: r.error ?? "Erro ao criar conta" });
      }
    } else {
      const r = await signIn(email, password);
      if (!r.ok) {
        setFeedback({ kind: "err", msg: r.error ?? "Email ou senha incorretos" });
      }
    }

    setSubmitting(false);
  };

  return (
    <PageContainer>
      <Card padding="md" accent="warn">
        <div className="text-center mb-3">
          <div className="w-12 h-12 mx-auto mb-2 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-neutral-950 text-xl font-black shadow-lg shadow-amber-500/30">
            R
          </div>
          <div className="text-base font-bold text-neutral-100">Roleta Vision</div>
          <div className="text-[10px] text-neutral-500 mt-0.5">
            Análise honesta · sinal mestre
          </div>
        </div>

        <SectionHeader
          title={
            mode === "login"
              ? "Entrar"
              : mode === "signup"
              ? "Criar conta"
              : "Recuperar senha"
          }
          eyebrow={
            mode === "login"
              ? "Acesse sua conta"
              : mode === "signup"
              ? "Comece sua trilha"
              : "Receba link por email"
          }
        />

        <form onSubmit={handleSubmit} className="space-y-2">
          <div>
            <label className="text-[10px] uppercase tracking-wider text-neutral-500 font-bold block mb-0.5">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@exemplo.com"
              required
              autoComplete="email"
              className="w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1.5 text-sm font-mono focus:border-amber-400 outline-none"
            />
          </div>

          {mode !== "reset" && (
            <div>
              <label className="text-[10px] uppercase tracking-wider text-neutral-500 font-bold block mb-0.5">
                Senha
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="≥6 caracteres"
                required
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                className="w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1.5 text-sm font-mono focus:border-amber-400 outline-none"
              />
            </div>
          )}

          {mode === "signup" && (
            <div>
              <label className="text-[10px] uppercase tracking-wider text-neutral-500 font-bold block mb-0.5">
                Confirmar senha
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="repita a senha"
                required
                autoComplete="new-password"
                className="w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1.5 text-sm font-mono focus:border-amber-400 outline-none"
              />
            </div>
          )}

          {feedback && (
            <div
              className={`text-[11px] px-2 py-1.5 rounded ${
                feedback.kind === "ok"
                  ? "bg-emerald-950/40 border border-emerald-700/50 text-emerald-200"
                  : "bg-red-950/40 border border-red-700/50 text-red-200"
              }`}
            >
              {feedback.kind === "ok" ? "✓ " : "⚠ "}
              {feedback.msg}
            </div>
          )}

          <Button variant="primary" size="md" type="submit" disabled={submitting}>
            {submitting
              ? "Aguarde…"
              : mode === "login"
              ? "Entrar"
              : mode === "signup"
              ? "Criar conta"
              : "Enviar link de recuperação"}
          </Button>
        </form>

        <div className="flex items-center justify-between mt-3 text-[10px] text-neutral-500">
          {mode === "login" ? (
            <>
              <button
                onClick={() => {
                  setMode("signup");
                  setFeedback(null);
                }}
                className="hover:text-amber-300"
              >
                ➕ Criar nova conta
              </button>
              <button
                onClick={() => {
                  setMode("reset");
                  setFeedback(null);
                }}
                className="hover:text-amber-300"
              >
                Esqueci a senha
              </button>
            </>
          ) : (
            <button
              onClick={() => {
                setMode("login");
                setFeedback(null);
              }}
              className="hover:text-amber-300"
            >
              ← Voltar pro login
            </button>
          )}
        </div>

        <div className="text-[9px] text-neutral-600 italic mt-3 text-center leading-snug">
          Sua conta fica no Supabase. Email só pra reset de senha. Dados de uso (giros,
          histórico, padrões) ficam no seu browser via localStorage — não enviamos pra servidor.
        </div>
      </Card>
    </PageContainer>
  );
});
Login.displayName = "Login";

export default Login;

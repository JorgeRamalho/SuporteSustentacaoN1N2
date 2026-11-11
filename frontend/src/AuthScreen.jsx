import { useEffect, useState } from "react";
import { api, isDemoHost, isPublishedConsole, warmRuntime } from "./api";
import { authStorageAvailable, writeSession } from "./auth";

const ROLES = ["N1", "N2", "N3"];
const SECTORS = ["Suporte", "DEV", "Segurança", "IA"];

function PasswordField({ id, label, value, onChange, show, onToggle, autoComplete, placeholder }) {
  return (
    <label htmlFor={id}>
      {label}
      <span className="password-field">
        <input
          id={id}
          type={show ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          placeholder={placeholder}
          required
          minLength={8}
        />
        <button type="button" className="ghost password-toggle" onClick={onToggle} aria-pressed={show}>
          {show ? "Ocultar" : "Ver senha"}
        </button>
      </span>
    </label>
  );
}

export default function AuthScreen({ onAuthenticated }) {
  const [view, setView] = useState("login");
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [role, setRole] = useState("N1");
  const [sector, setSector] = useState("Suporte");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void warmRuntime();
    if (isPublishedConsole() && !authStorageAvailable()) {
      setError(
        "Este navegador bloqueou o armazenamento local deste site. No Microsoft Edge, permita cookies e dados do site para suportesustentacaon1n2.vercel.app.",
      );
    }
  }, []);

  function go(next) {
    setView(next);
    setStep(1);
    setRole("N1");
    setSector("Suporte");
    setPassword("");
    setConfirm("");
    setShowPassword(false);
    setError("");
  }

  async function submit(path, extra = {}) {
    setBusy(true);
    setError("");
    try {
      const session = await api(path, {
        method: "POST",
        body: JSON.stringify({
          email: email.trim(),
          password,
          ...extra,
        }),
      });
      writeSession(session);
      onAuthenticated(session);
    } catch (err) {
      setError(err.message || "Não foi possível concluir o acesso.");
    } finally {
      setBusy(false);
    }
  }

  function onLogin(event) {
    event.preventDefault();
    submit("/api/auth/login");
  }

  function onRegister(event) {
    event.preventDefault();
    if (step === 1) {
      if (name.trim().length < 2) {
        setError("Informe o nome completo.");
        return;
      }
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
        setError("Informe um e-mail válido. Ele será o seu login.");
        return;
      }
      setError("");
      setStep(2);
      return;
    }
    if (password !== confirm) {
      setError("A confirmação não confere com a senha.");
      return;
    }
    submit("/api/auth/register", { name: name.trim(), role, sector });
  }

  function onRecover(event) {
    event.preventDefault();
    if (password !== confirm) {
      setError("A confirmação não confere com a senha.");
      return;
    }
    submit("/api/auth/recover");
  }

  function demoLoginNeedsRegister(message) {
    return (
      isPublishedConsole() &&
      isDemoHost() &&
      /cadastrado|demonstração|compartilham/i.test(String(message || ""))
    );
  }

  function quickRegisterFromLogin() {
    const displayName = name.trim() || email.trim().split("@")[0]?.replace(/[._-]+/g, " ") || "Operador";
    submit("/api/auth/register", { name: displayName, role: "N1", sector: "Suporte" });
  }

  const heading = {
    login: ["Entrar no Sentinela", "Somente operadores cadastrados acessam o console N1/N2."],
    register: ["Criar cadastro", step === 1 ? "Passo 1 de 2 · dados do operador no Sentinela." : "Passo 2 de 2 · defina a senha de acesso."],
    recover: ["Esqueci minha senha", "Informe o e-mail cadastrado e escolha uma nova senha."],
  }[view];

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="brand">
          <span className="mark">S</span>
          <div>
            <strong>Sentinela</strong>
            <small>Sustentação N1 / N2</small>
          </div>
        </div>
        <h1>{heading[0]}</h1>
        <p className="muted">{heading[1]}</p>
        {error ? (
          <p className="notice bad" role="alert">
            {error}
          </p>
        ) : null}
        {view === "login" && demoLoginNeedsRegister(error) ? (
          <p className="notice">
            <button type="button" className="primary" disabled={busy} onClick={quickRegisterFromLogin}>
              {busy ? "Cadastrando..." : "Criar cadastro neste navegador e entrar"}
            </button>
          </p>
        ) : null}

        {view === "login" ? (
          <form className="auth-form" onSubmit={onLogin}>
            <label htmlFor="auth-email">
              E-mail
              <input
                id="auth-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="username"
                placeholder="aaron.s@example.org"
                required
              />
            </label>
            <PasswordField
              id="auth-password"
              label="Senha"
              value={password}
              onChange={setPassword}
              show={showPassword}
              onToggle={() => setShowPassword((value) => !value)}
              autoComplete="current-password"
            />
            <button type="submit" className="primary" disabled={busy}>
              {busy ? "Entrando..." : "Entrar"}
            </button>
            <div className="auth-links">
              <button type="button" className="linkish" onClick={() => go("recover")}>
                Esqueci minha senha
              </button>
              <button type="button" className="linkish" onClick={() => go("register")}>
                Criar cadastro
              </button>
            </div>
          </form>
        ) : null}

        {view === "register" ? (
          <form className="auth-form" onSubmit={onRegister}>
            {step === 1 ? (
              <>
                <label htmlFor="auth-name">
                  Nome completo
                  <input
                    id="auth-name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    autoComplete="name"
                    placeholder="Nome e sobrenome"
                    required
                  />
                </label>
                <label htmlFor="auth-register-email">
                  E-mail de acesso
                  <input
                    id="auth-register-email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    autoComplete="username"
                    placeholder="aaron.s@example.org"
                    required
                  />
                </label>
                <label htmlFor="auth-role">
                  Função
                  <select id="auth-role" value={role} onChange={(event) => setRole(event.target.value)} required>
                    {ROLES.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </label>
                <label htmlFor="auth-sector">
                  Setor
                  <select id="auth-sector" value={sector} onChange={(event) => setSector(event.target.value)} required>
                    {SECTORS.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </label>
                <button type="submit" className="primary">
                  Continuar
                </button>
              </>
            ) : (
              <>
                <PasswordField
                  id="auth-new-password"
                  label="Senha (mínimo 8 caracteres)"
                  value={password}
                  onChange={setPassword}
                  show={showPassword}
                  onToggle={() => setShowPassword((value) => !value)}
                  autoComplete="new-password"
                />
                <PasswordField
                  id="auth-confirm-password"
                  label="Confirmar senha"
                  value={confirm}
                  onChange={setConfirm}
                  show={showPassword}
                  onToggle={() => setShowPassword((value) => !value)}
                  autoComplete="new-password"
                />
                <div className="auth-actions">
                  <button type="button" className="ghost" onClick={() => setStep(1)}>
                    Voltar
                  </button>
                  <button type="submit" className="primary" disabled={busy}>
                    {busy ? "Cadastrando..." : "Cadastrar e entrar"}
                  </button>
                </div>
              </>
            )}
            <div className="auth-links">
              <button type="button" className="linkish" onClick={() => go("login")}>
                Já tenho cadastro
              </button>
            </div>
          </form>
        ) : null}

        {view === "recover" ? (
          <form className="auth-form" onSubmit={onRecover}>
            <label htmlFor="auth-recover-email">
              E-mail cadastrado
              <input
                id="auth-recover-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="username"
                required
              />
            </label>
            <PasswordField
              id="auth-reset-password"
              label="Nova senha (mínimo 8 caracteres)"
              value={password}
              onChange={setPassword}
              show={showPassword}
              onToggle={() => setShowPassword((value) => !value)}
              autoComplete="new-password"
            />
            <PasswordField
              id="auth-reset-confirm"
              label="Confirmar nova senha"
              value={confirm}
              onChange={setConfirm}
              show={showPassword}
              onToggle={() => setShowPassword((value) => !value)}
              autoComplete="new-password"
            />
            <button type="submit" className="primary" disabled={busy}>
              {busy ? "Salvando..." : "Redefinir senha e entrar"}
            </button>
            <div className="auth-links">
              <button type="button" className="linkish" onClick={() => go("login")}>
                Voltar ao login
              </button>
            </div>
          </form>
        ) : null}
      </div>
    </div>
  );
}

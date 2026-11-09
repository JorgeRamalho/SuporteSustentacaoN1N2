import { useEffect, useId, useRef, useState } from "react";
import { api } from "../api";

function initials(name, email) {
  const source = (name || email || "?").trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

function PasswordField({ id, label, value, onChange, show, onToggle, autoComplete }) {
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

export default function AccountMenu({ user, onLogout, notify }) {
  const menuId = useId();
  const rootRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    function onPointer(event) {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setOpen(false);
      }
    }
    function onKey(event) {
      if (event.key === "Escape") {
        setOpen(false);
        setPasswordOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function closePassword() {
    setPasswordOpen(false);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setShowCurrent(false);
    setShowNew(false);
    setShowConfirm(false);
  }

  async function submitPassword(event) {
    event.preventDefault();
    if (newPassword !== confirmPassword) {
      notify("A nova senha e a confirmação precisam ser iguais.", "error");
      return;
    }
    setBusy(true);
    try {
      await api("/api/auth/me/password", {
        method: "PATCH",
        body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
      });
      notify("Senha alterada com sucesso.");
      closePassword();
    } catch (err) {
      notify(err.message, "error");
    } finally {
      setBusy(false);
    }
  }

  const accountName = user?.name || user?.email || "Operador";

  return (
  <>
    <div className="account-menu" ref={rootRef}>
      <button
        type="button"
        className="account-avatar"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
        title={`Conta de ${accountName}`}
        aria-label={`Conta de ${accountName}. Abrir opções`}
      >
        <span aria-hidden="true">{initials(user?.name, user?.email)}</span>
      </button>
      {open ? (
        <ul className="account-dropdown" id={menuId} role="menu">
          <li role="none" className="account-dropdown-head">
            <strong>{accountName}</strong>
            {user?.role || user?.sector ? (
              <small>
                {user?.role || "N1"} · {user?.sector || "Suporte"}
              </small>
            ) : null}
          </li>
          <li role="none" className="account-dropdown-sep" aria-hidden />
          <li role="none">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                setPasswordOpen(true);
              }}
            >
              Alterar senha
            </button>
          </li>
          <li role="none" className="account-dropdown-sep" aria-hidden />
          <li role="none">
            <button type="button" role="menuitem" className="account-leave" onClick={onLogout}>
              Sair
            </button>
          </li>
        </ul>
      ) : null}
    </div>

    {passwordOpen ? (
      <div className="account-sheet-backdrop" role="presentation" onClick={closePassword}>
        <div
          className="account-sheet"
          role="dialog"
          aria-modal="true"
          aria-labelledby={`${menuId}-sheet-title`}
          onClick={(event) => event.stopPropagation()}
        >
          <form className="auth-form" onSubmit={submitPassword}>
            <h2 id={`${menuId}-sheet-title`}>Alterar senha</h2>
            <p className="muted">Confirme a senha atual antes de definir uma nova.</p>
            <PasswordField
              id={`${menuId}-current`}
              label="Senha atual"
              value={currentPassword}
              onChange={setCurrentPassword}
              show={showCurrent}
              onToggle={() => setShowCurrent((v) => !v)}
              autoComplete="current-password"
            />
            <PasswordField
              id={`${menuId}-new`}
              label="Nova senha"
              value={newPassword}
              onChange={setNewPassword}
              show={showNew}
              onToggle={() => setShowNew((v) => !v)}
              autoComplete="new-password"
            />
            <PasswordField
              id={`${menuId}-confirm`}
              label="Confirmar nova senha"
              value={confirmPassword}
              onChange={setConfirmPassword}
              show={showConfirm}
              onToggle={() => setShowConfirm((v) => !v)}
              autoComplete="new-password"
            />
            <div className="auth-actions">
              <button type="submit" className="primary" disabled={busy}>
                {busy ? "Salvando…" : "Salvar senha"}
              </button>
              <button type="button" className="ghost" onClick={closePassword} disabled={busy}>
                Cancelar
              </button>
            </div>
          </form>
        </div>
      </div>
    ) : null}
  </>
  );
}

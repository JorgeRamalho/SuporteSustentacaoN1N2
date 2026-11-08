import { useState } from "react";
import { api } from "../api";

export const EMPTY_INCIDENT_FORM = { title: "", symptom: "", severity: "medio" };

export const NIVEL_OPCOES = [
  { value: "critico", label: "Crítico" },
  { value: "alto", label: "Alto" },
  { value: "medio", label: "Médio" },
  { value: "baixo", label: "Baixo" },
];

export default function NovoIncidenteForm({ notify, refresh, onSuccess }) {
  const [form, setForm] = useState(EMPTY_INCIDENT_FORM);
  const [saving, setSaving] = useState(false);

  function change(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    try {
      const created = await api("/api/incidents", { method: "POST", body: JSON.stringify(form) });
      setForm(EMPTY_INCIDENT_FORM);
      notify(`${created.code} registrado na fila ${created.level}.`);
      refresh();
      onSuccess?.(created);
    } catch (err) {
      notify(err.message, "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="panel incident-form incident-form-page" onSubmit={submit}>
      <h2>Novo incidente (N1)</h2>
      <p className="muted">Preencha o que foi visto em produção. O registro entra na fila conforme o nível escolhido.</p>
      <label>
        Título
        <input name="title" value={form.title} onChange={change} maxLength={180} required autoComplete="off" />
      </label>
      <label>
        Sintoma
        <textarea
          name="symptom"
          placeholder="Sintoma observado em produção"
          value={form.symptom}
          onChange={change}
          rows={5}
          required
        />
      </label>
      <label>
        Nível
        <select name="severity" value={form.severity} onChange={change}>
          {NIVEL_OPCOES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <button className="primary" type="submit" disabled={saving}>
        Registrar Incidente
      </button>
    </form>
  );
}

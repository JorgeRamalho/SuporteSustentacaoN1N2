import NovoIncidenteForm from "../components/NovoIncidenteForm";

export default function RegistroIncidenteN1({ notify, refresh, navigate }) {
  return (
    <>
      <div className="toolbar">
        <p className="muted">Use este formulário para abrir um incidente manual na operação N1, com título, sintoma e nível de criticidade.</p>
        <button className="ghost" type="button" onClick={() => navigate?.("painel")}>
          Voltar ao painel
        </button>
      </div>
      <NovoIncidenteForm notify={notify} refresh={refresh} onSuccess={() => navigate?.("incidentes")} />
    </>
  );
}

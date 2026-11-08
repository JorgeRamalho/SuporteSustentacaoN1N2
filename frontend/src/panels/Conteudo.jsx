import { useEffect, useMemo, useState } from "react";
import { api, docsUrl } from "../api";
import { Badge, Empty, LoadFailure } from "../ui";

const METHODS = ["get", "post", "put", "patch", "delete"];

function schemaName(ref) {
  return String(ref || "").split("/").pop();
}

function describeSchema(schema) {
  if (!schema) return "object";
  if (schema.$ref) return schemaName(schema.$ref);
  if (schema.anyOf) return schema.anyOf.map((item) => describeSchema(item)).join(" | ");
  if (schema.enum) return schema.enum.join(" | ");
  if (schema.type === "array") return `${describeSchema(schema.items)}[]`;
  return schema.type || "object";
}

function resolveSchema(schema, components) {
  if (!schema?.$ref) return schema || null;
  return components?.schemas?.[schemaName(schema.$ref)] || schema;
}

function groupOperations(spec) {
  const groups = [];
  const index = new Map();
  for (const [path, methods] of Object.entries(spec.paths || {})) {
    for (const [method, operation] of Object.entries(methods)) {
      if (!METHODS.includes(method)) continue;
      const tag = (operation.tags && operation.tags[0]) || "API";
      if (!index.has(tag)) {
        index.set(tag, groups.length);
        groups.push({ tag, items: [] });
      }
      groups[index.get(tag)].items.push({ path, method, operation });
    }
  }
  return groups;
}

function SchemaFields({ schema, components }) {
  const resolved = resolveSchema(schema, components);
  const properties = resolved?.properties;
  if (!properties) {
    return <p className="muted">{describeSchema(schema)}</p>;
  }
  const required = new Set(resolved.required || []);
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Campo</th>
            <th>Tipo</th>
            <th>Obrigatório</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(properties).map(([name, field]) => (
            <tr key={name}>
              <td>{name}</td>
              <td>{describeSchema(field)}</td>
              <td>{required.has(name) ? "sim" : "não"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Conteudo({ notify }) {
  const [spec, setSpec] = useState(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const swagger = docsUrl();
  const components = spec?.components;

  useEffect(() => {
    let active = true;
    api("/openapi.json")
      .then((payload) => {
        if (active) {
          setSpec(payload);
          setError("");
        }
      })
      .catch((err) => {
        if (!active) return;
        setError(err.message);
        notify?.(err.message, "error");
      });
    return () => {
      active = false;
    };
  }, []);

  const groups = useMemo(() => {
    if (!spec) return [];
    const wanted = query.trim().toLowerCase();
    return groupOperations(spec)
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => {
          if (!wanted) return true;
          const blob = `${group.tag} ${item.method} ${item.path} ${item.operation.summary || ""} ${item.operation.description || ""}`.toLowerCase();
          return blob.includes(wanted);
        }),
      }))
      .filter((group) => group.items.length > 0);
  }, [spec, query]);

  if (error && !spec) {
    return (
      <>
        <LoadFailure />
        <p className="muted">
          Suba a API e abra a documentação em{" "}
          <a href={swagger} target="_blank" rel="noreferrer">
            {swagger || "/docs"}
          </a>
          .
        </p>
      </>
    );
  }

  return (
    <div className="docs-page">
      <div className="toolbar">
        <p className="muted">
          {spec?.info?.summary || "Documentação da API Sentinela."}
          {spec?.info?.version ? ` Versão ${spec.info.version}.` : ""}
        </p>
        <a className="ghost" href={swagger} target="_blank" rel="noreferrer">
          Abrir Swagger
        </a>
      </div>
      <iframe className="docs-frame" title="Documentação da API Sentinela" src={swagger} />
      <label className="search">
        Filtrar rotas
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="logs, incidentes, /api/kb" />
      </label>
      {!spec ? (
        <p className="muted">Lendo o catálogo OpenAPI...</p>
      ) : groups.length === 0 ? (
        <Empty>Nenhuma rota com esses termos.</Empty>
      ) : (
        <div className="stack">
          {groups.map((group) => (
            <section className="panel" key={group.tag}>
              <h2>{group.tag}</h2>
              <div className="docs-ops">
                {group.items.map((item) => {
                  const body = item.operation.requestBody?.content?.["application/json"]?.schema;
                  const parameters = item.operation.parameters || [];
                  const responses = Object.entries(item.operation.responses || {});
                  return (
                    <details className="docs-op" key={`${item.method}-${item.path}`}>
                      <summary>
                        <Badge kind={item.method}>{item.method.toUpperCase()}</Badge>
                        <code>{item.path}</code>
                        <span>{item.operation.summary || "Operação"}</span>
                      </summary>
                      {item.operation.description ? <p>{item.operation.description}</p> : null}
                      {parameters.length > 0 ? (
                        <>
                          <p className="section-label">Parâmetros</p>
                          <div className="table-wrap">
                            <table>
                              <thead>
                                <tr>
                                  <th>Nome</th>
                                  <th>Em</th>
                                  <th>Tipo</th>
                                  <th>Obrigatório</th>
                                </tr>
                              </thead>
                              <tbody>
                                {parameters.map((parameter) => (
                                  <tr key={`${parameter.in}-${parameter.name}`}>
                                    <td>{parameter.name}</td>
                                    <td>{parameter.in}</td>
                                    <td>{describeSchema(parameter.schema)}</td>
                                    <td>{parameter.required ? "sim" : "não"}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </>
                      ) : null}
                      {body ? (
                        <>
                          <p className="section-label">Corpo</p>
                          <SchemaFields schema={body} components={components} />
                        </>
                      ) : null}
                      <p className="section-label">Respostas</p>
                      <ul className="docs-responses">
                        {responses.map(([code, response]) => (
                          <li key={code}>
                            <strong>{code}</strong> {response.description || ""}
                          </li>
                        ))}
                      </ul>
                    </details>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

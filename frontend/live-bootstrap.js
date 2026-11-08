const here = import.meta.url;

function showError(message) {
  const root = document.getElementById("root");
  if (root) {
    root.innerHTML = `<p style="font-family:system-ui,sans-serif;padding:1.5rem;max-width:40rem;line-height:1.5">${message}</p>`;
  }
}

async function start() {
  if (import.meta.env?.DEV) {
    await import("/frontend/src/main.jsx");
    return;
  }

  const cssUrl = new URL("./live-dist/live-bundle.css", here);
  const jsUrl = new URL("./live-dist/live-bundle.js", here);

  try {
    const sheet = document.createElement("link");
    sheet.rel = "stylesheet";
    sheet.href = cssUrl.href;
    document.head.appendChild(sheet);
    await import(jsUrl.href);
  } catch (error) {
    console.error(error);
    showError(
      `Falha ao carregar o console. Na raiz do projeto use <strong>Go Live</strong> em <code>index.html</code> (não só a pasta frontend). Rode <code>npm run live:bundle</code> em <strong>frontend</strong>. (${error.message})`,
    );
  }
}

start();

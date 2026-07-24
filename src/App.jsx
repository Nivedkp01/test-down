import { useEffect, useState } from 'react';

function App() {
  const [status, setStatus] = useState('Preparing download...');

  useEffect(() => {
    const triggerDownload = async () => {
      try {
        const response = await fetch('/.netlify/functions/upload?download=true&file=agressif', { method: 'GET' });
        if (!response.ok) {
          throw new Error(`Server returned ${response.status}`);
        }

        const text = await response.text();
        if (!text) {
          throw new Error('The file response was empty.');
        }

        const blob = new Blob([text], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'agressif.json';
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);

        setStatus('Downloaded agressif.json from the server proxy');
      } catch (error) {
        setStatus(`Download failed: ${String(error)}`);
      }
    };

    triggerDownload();
  }, []);

  return (
    <main className="app-shell">
      <section className="card">
        <h1>Server Proxy Download Test</h1>
        <p className="lead">
          Opening this page downloads the JSON file through the server-side proxy.
        </p>

        <div className="upload-status done">
          <strong>Status:</strong> {status}
        </div>
      </section>
    </main>
  );
}

export default App;

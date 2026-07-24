import { useState } from 'react';

function App() {
  const [contentType, setContentType] = useState('application/json');
  const [status, setStatus] = useState('Enter a content type and click download.');

  const handleDownload = async () => {
    try {
      const response = await fetch('/.netlify/functions/upload?download=true&file=agressif', {
        method: 'GET',
        headers: {
          'Content-Type': contentType,
        },
      });

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }

      const text = await response.text();
      if (!text) {
        throw new Error('The file response was empty.');
      }

      const blob = new Blob([text], { type: contentType });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `agressif.${contentType.includes('json') ? 'json' : 'txt'}`;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      setStatus(`Downloaded using content type: ${contentType}`);
    } catch (error) {
      setStatus(`Download failed: ${String(error)}`);
    }
  };

  return (
    <main className="app-shell">
      <section className="card">
        <h1>Manual Download Test</h1>
        <p className="lead">
          Enter a content type, then click download. The request will be sent with that content type header.
        </p>

        <div className="field">
          <span>Content type</span>
          <input
            value={contentType}
            onChange={(event) => setContentType(event.target.value)}
            placeholder="application/json"
          />
        </div>

        <div className="actions">
          <button type="button" onClick={handleDownload}>
            Download
          </button>
        </div>

        <div className="upload-status done">
          <strong>Status:</strong> {status}
        </div>
      </section>
    </main>
  );
}

export default App;

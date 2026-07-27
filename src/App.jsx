import { useState } from 'react';

function App() {
  const [contentType, setContentType] = useState('application/json');
  const [status, setStatus] = useState('Enter a content type and click download.');
  const [responseContentType, setResponseContentType] = useState('');

  const handleDownload = async () => {
    try {
      const response = await fetch(`/.netlify/functions/upload?download=true&file=agressif&contentType=${encodeURIComponent(contentType)}&t=${Date.now()}`, {
        method: 'GET',
        headers: {
          'Content-Type': contentType,
        },
      });
      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const responseContentType = response.headers.get('content-type') || 'application/octet-stream';
      const contentDisposition = response.headers.get('content-disposition') || '';
      const filenameMatch = contentDisposition.match(/filename\s*=\s*"?([^";]+)"?/i);
      const downloadName = filenameMatch?.[1] || 'download.bin';

      setResponseContentType(responseContentType);
      if (!arrayBuffer.byteLength) {
        throw new Error('The file response was empty.');
      }

      const blob = new Blob([arrayBuffer], { type: responseContentType });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = downloadName;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      setStatus(`Downloaded using content type: ${responseContentType}`);
    } catch (error) {
      setStatus(`Download failed: ${String(error)}`);
    }
  };

  return (
    <main className="app-shell">
      <section className="card">
        <h1>Manual Download Test</h1>
        <p className="lead">
          Enter a content type, then click download. The browser will fetch the public JSON file and save it locally.
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
          {responseContentType && (
            <div><strong>Response content-type:</strong> {responseContentType}</div>
          )}
        </div>
      </section>
    </main>
  );
}

export default App;

import { useEffect, useState } from 'react';

const S3_URL = 'https://hexnode-ztna-test.s3.ap-south-1.amazonaws.com/blacklist/agressif/agressif.json';

function App() {
  const [status, setStatus] = useState('Preparing download...');

  useEffect(() => {
    const triggerDownload = async () => {
      try {
        const response = await fetch(S3_URL, { method: 'GET' });
        if (!response.ok) {
          throw new Error(`S3 returned ${response.status}`);
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

        setStatus('Downloaded agressif.json from S3');
      } catch (error) {
        setStatus(`Download failed: ${String(error)}`);
      }
    };

    triggerDownload();
  }, []);

  return (
    <main className="app-shell">
      <section className="card">
        <h1>S3 JSON Download Test</h1>
        <p className="lead">
          Opening this page downloads the JSON file from the provided S3 URL.
        </p>

        <div className="upload-status done">
          <strong>Status:</strong> {status}
        </div>
      </section>
    </main>
  );
}

export default App;

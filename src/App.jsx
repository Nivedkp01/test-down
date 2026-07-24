import { useEffect, useState } from 'react';

const TYPE_OPTIONS = [
  { label: 'Plain Text', value: 'text/plain', extension: 'txt' },
  { label: 'Markdown', value: 'text/markdown', extension: 'md' },
  { label: 'HTML', value: 'text/html', extension: 'html' },
  { label: 'JSON', value: 'application/json', extension: 'json' },
  { label: 'JavaScript', value: 'application/javascript', extension: 'js' },
];

function App() {
  const [status, setStatus] = useState('Preparing download...');
  const [selectedType, setSelectedType] = useState(TYPE_OPTIONS[0].value);

  useEffect(() => {
    const triggerDownload = async () => {
      try {
        const extension = TYPE_OPTIONS.find((option) => option.value === selectedType)?.extension || 'txt';
        const downloadUrl = `/.netlify/functions/upload?download=true&file=demo&contentType=${encodeURIComponent(selectedType)}`;

        const response = await fetch(downloadUrl, { method: 'GET' });
        if (!response.ok) {
          throw new Error(`Server returned ${response.status}`);
        }
        const blob = await response.blob();
        if (!blob.size) {
          throw new Error('The file response was empty.');
        }
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `downloaded-file.${extension}`;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);

        setStatus(`Download started as ${selectedType}`);
      } catch (error) {
        setStatus(`Download failed: ${String(error)}`);
      }
    };

    triggerDownload();
  }, [selectedType]);

  return (
    <main className="app-shell">
      <section className="card">
        <h1>Auto Download Test</h1>
        <p className="lead">
          Opening this page automatically downloads a file from the server using the selected content type.
        </p>

        <div className="field">
          <span>Select content type</span>
          <select value={selectedType} onChange={(event) => setSelectedType(event.target.value)}>
            {TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="upload-status done">
          <strong>Status:</strong> {status}
        </div>
      </section>
    </main>
  );
}

export default App;

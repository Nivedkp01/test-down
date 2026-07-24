import { useEffect, useState } from 'react';

const TYPE_OPTIONS = [
  { label: 'Plain Text', value: 'text/plain', extension: 'txt' },
  { label: 'Markdown', value: 'text/markdown', extension: 'md' },
  { label: 'HTML', value: 'text/html', extension: 'html' },
  { label: 'JSON', value: 'application/json', extension: 'json' },
  { label: 'JavaScript', value: 'application/javascript', extension: 'js' },
];

function App() {
  const [files, setFiles] = useState([]);
  const [selectedFileId, setSelectedFileId] = useState('');
  const [selectedType, setSelectedType] = useState(TYPE_OPTIONS[0].value);
  const [status, setStatus] = useState('Loading files from server...');

  useEffect(() => {
    const loadFiles = async () => {
      try {
        const response = await fetch('/.netlify/functions/upload');
        const payload = await response.json();
        const availableFiles = payload.files || [];
        setFiles(availableFiles);
        if (availableFiles[0]) {
          setSelectedFileId(availableFiles[0].id);
          setStatus('Choose a content type and download the file');
        } else {
          setStatus('No files available from the server');
        }
      } catch (error) {
        setStatus(`Unable to load files: ${String(error)}`);
      }
    };

    loadFiles();
  }, []);

  const selectedFile = files.find((file) => file.id === selectedFileId) || null;

  const onDownload = () => {
    if (!selectedFile) return;

    const extension = TYPE_OPTIONS.find((option) => option.value === selectedType)?.extension || 'txt';
    const downloadUrl = `/.netlify/functions/upload?download=1&file=${encodeURIComponent(selectedFile.id)}&contentType=${encodeURIComponent(selectedType)}`;

    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = `${selectedFile.name.replace(/\.[^/.]+$/, '')}.${extension}`;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setStatus(`Downloading ${selectedFile.name} as ${selectedType}`);
  };

  return (
    <main className="app-shell">
      <section className="card">
        <h1>Server File Download Test</h1>
        <p className="lead">
          The server lists a file, and you can choose the response content type before downloading it to your device.
        </p>

        <div className="field">
          <span>Select file</span>
          <select value={selectedFileId} onChange={(event) => setSelectedFileId(event.target.value)}>
            {files.map((file) => (
              <option key={file.id} value={file.id}>
                {file.name}
              </option>
            ))}
          </select>
        </div>

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

        {selectedFile && (
          <div className="status">
            <strong>Selected file:</strong> {selectedFile.name}<br />
            <strong>Description:</strong> {selectedFile.description}
          </div>
        )}

        <div className="actions">
          <button type="button" onClick={onDownload} disabled={!selectedFile}>
            Download to device
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

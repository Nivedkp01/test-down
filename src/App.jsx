import { useEffect, useState } from 'react';

const TYPE_OPTIONS = [
  { label: 'Plain Text', value: 'text/plain', extension: 'txt' },
  { label: 'Markdown', value: 'text/markdown', extension: 'md' },
  { label: 'HTML', value: 'text/html', extension: 'html' },
  { label: 'JSON', value: 'application/json', extension: 'json' },
  { label: 'JavaScript', value: 'application/javascript', extension: 'js' },
  { label: 'CSS', value: 'text/css', extension: 'css' },
];

const SPOOF_CASES = [
  {
    label: 'ZIP disguised as JavaScript',
    signature: [0x50, 0x4b, 0x03, 0x04],
    type: 'zip',
    disguise: 'application/javascript',
    fileName: 'archive.js',
    comment: '/* fake inline JS payload */\n',
  },
  {
    label: 'PDF disguised as CSS',
    signature: [0x25, 0x50, 0x44, 0x46, 0x2d],
    type: 'pdf',
    disguise: 'text/css',
    fileName: 'document.css',
    comment: '/* fake inline CSS payload */\n',
  },
  {
    label: 'EXE disguised as JavaScript',
    signature: [0x4d, 0x5a],
    type: 'exe',
    disguise: 'application/javascript',
    fileName: 'payload.js',
    comment: '/* fake inline JS wrapper */\n',
  },
];

function detectFileSignature(bytes) {
  if (bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) {
    return 'ZIP archive';
  }
  if (bytes.length >= 5 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2d) {
    return 'PDF document';
  }
  if (bytes.length >= 2 && bytes[0] === 0x4d && bytes[1] === 0x5a) {
    return 'Windows executable';
  }
  if (bytes.length >= 4 && bytes[0] === 0x52 && bytes[1] === 0x61 && bytes[2] === 0x72 && bytes[3] === 0x21) {
    return 'RAR archive';
  }
  return null;
}

function isLikelyBinary(bytes) {
  for (let i = 0; i < bytes.length && i < 128; i += 1) {
    if (bytes[i] === 0) {
      return true;
    }
  }
  return detectFileSignature(bytes) !== null;
}

function arrayBufferToText(buffer) {
  try {
    const decoder = new TextDecoder('utf-8', { fatal: false });
    return decoder.decode(buffer);
  } catch {
    return '';
  }
}

function convertContent(text, targetType) {
  if (!text) return '';

  if (targetType === 'text/plain') {
    try {
      return JSON.stringify(JSON.parse(text), null, 2);
    } catch {
      return text;
    }
  }

  if (targetType === 'application/json') {
    try {
      return JSON.stringify(JSON.parse(text), null, 2);
    } catch {
      return JSON.stringify({ content: text }, null, 2);
    }
  }

  if (targetType === 'text/html') {
    return `<pre>${escapeHtml(text)}</pre>`;
  }

  if (targetType === 'text/markdown') {
    return text;
  }

  return text;
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildSpoofBlob(signature, comment, outputType) {
  const header = new Uint8Array(signature);
  const body = new TextEncoder().encode(comment + '\n// payload data removed for safety\n');
  const buffer = new Uint8Array(header.length + body.length);
  buffer.set(header, 0);
  buffer.set(body, header.length);
  return new Blob([buffer], { type: outputType });
}

function App() {
  const [originalFile, setOriginalFile] = useState(null);
  const [originalText, setOriginalText] = useState('');
  const [originalBytes, setOriginalBytes] = useState(null);
  const [originalMime, setOriginalMime] = useState('unknown');
  const [detectedSignature, setDetectedSignature] = useState(null);
  const [targetType, setTargetType] = useState(TYPE_OPTIONS[0].value);
  const [fileName, setFileName] = useState('');
  const [downloadDisabled, setDownloadDisabled] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('idle');
  const [uploadResponse, setUploadResponse] = useState(null);
  const [serverFileAvailable, setServerFileAvailable] = useState(false);

  useEffect(() => {
    if (originalText) {
      setDownloadDisabled(
        detectedSignature !== null && ['application/javascript', 'text/css'].includes(targetType)
      );
    }
  }, [detectedSignature, targetType, originalText]);

  const onFileChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setOriginalFile(file);
    setFileName(file.name);
    setOriginalMime(file.type || 'unknown');
    setServerFileAvailable(false);
    setUploadStatus('idle');
    setUploadResponse(null);

    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      const result = loadEvent.target?.result;
      if (result instanceof ArrayBuffer) {
        const bytes = new Uint8Array(result);
        setOriginalBytes(bytes);
        const signature = detectFileSignature(bytes);
        setDetectedSignature(signature);
        setOriginalText(arrayBufferToText(result) || '[binary content detected]');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const onDownload = () => {
    const option = TYPE_OPTIONS.find((opt) => opt.value === targetType);
    const extension = option?.extension ?? 'txt';
    const blob = new Blob([convertContent(originalText, targetType)], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName ? `${fileName.replace(/\.[^/.]+$/, '')}.${extension}` : `converted.${extension}`;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const onDownloadOriginal = () => {
    if (!originalFile) return;
    const url = URL.createObjectURL(originalFile);
    const link = document.createElement('a');
    link.href = url;
    link.download = originalFile.name;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const uploadFileToServer = async () => {
    if (!originalFile) return;
    setUploadStatus('uploading');
    setUploadResponse(null);

    const formData = new FormData();
    formData.append('file', originalFile, originalFile.name);
    formData.append('name', originalFile.name);
    formData.append('type', originalFile.type || 'application/octet-stream');

    try {
      const response = await fetch('/.netlify/functions/upload', {
        method: 'POST',
        body: formData,
      });
      const body = await response.json().catch(() => ({ message: 'Upload completed' }));
      setUploadStatus(response.ok ? 'done' : 'error');
      setUploadResponse(body);
      setServerFileAvailable(response.ok);
    } catch (error) {
      setUploadStatus('error');
      setUploadResponse({ message: String(error) });
    }
  };

  const downloadFileFromServer = async () => {
    if (!serverFileAvailable) return;
    setUploadStatus('downloading');
    setUploadResponse(null);

    try {
      const response = await fetch('/.netlify/functions/upload', {
        method: 'GET',
      });
      const body = await response.json();

      if (!response.ok || !body?.file?.contentBase64) {
        throw new Error(body?.message || 'Server download failed.');
      }

      const bytes = Uint8Array.from(atob(body.file.contentBase64), (char) => char.charCodeAt(0));
      const blob = new Blob([bytes], { type: body.file.type || 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = body.file.name || 'downloaded-file';
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setUploadStatus('done');
      setUploadResponse(body);
    } catch (error) {
      setUploadStatus('error');
      setUploadResponse({ message: String(error) });
    }
  };

  const onGenerateSpoofFile = (spoofCase) => {
    const blob = buildSpoofBlob(spoofCase.signature, spoofCase.comment, spoofCase.disguise);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = spoofCase.fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const renderWarning = () => {
    if (!detectedSignature) return null;

    return (
      <div className="warning-box">
        <strong>Suspicious payload detected:</strong> {detectedSignature}.<br />
        This file is likely binary/archive content, but the selected output type is <strong>{targetType}</strong>.
        Download is blocked to simulate a proxy filter preventing spoofed JavaScript/CSS delivery.
      </div>
    );
  };

  return (
    <main className="app-shell">
      <section className="card">
        <h1>Content-Type Spoofing Test & Prevention</h1>

        <p className="lead">
          Upload a document, choose the target MIME type, and download the converted result. If a binary/archive signature is detected while the output is JavaScript or CSS, the app warns and blocks the download.
        </p>

        <div className="field">
          <span>Choose output type</span>
          <select value={targetType} onChange={(event) => setTargetType(event.target.value)}>
            {TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <span>Upload document</span>
          <input type="file" onChange={onFileChange} />
          <small>Any file type accepted. The app detects ZIP, PDF, EXE, and RAR signatures.</small>
        </div>

        {fileName && (
          <div className="status">
            <strong>File:</strong> {fileName} · <strong>Original MIME:</strong> {originalMime}
            {detectedSignature ? ` · Detected signature: ${detectedSignature}` : ''}
          </div>
        )}

        {renderWarning()}

        <div className="field">
          <span>Converted content preview</span>
          <textarea value={convertContent(originalText, targetType)} readOnly rows={12} />
        </div>

        <div className="actions">
          <button type="button" onClick={onDownload} disabled={!originalText || downloadDisabled}>
            Download Converted File
          </button>
          <button type="button" className="secondary-button" onClick={onDownloadOriginal} disabled={!originalFile}>
            Download Original File
          </button>
          <button type="button" className="secondary-button" onClick={uploadFileToServer} disabled={!originalFile || uploadStatus === 'uploading'}>
            Upload to Server
          </button>
          <button type="button" className="secondary-button" onClick={downloadFileFromServer} disabled={!serverFileAvailable || uploadStatus === 'uploading' || uploadStatus === 'downloading'}>
            Download from Server
          </button>
        </div>

        {uploadStatus !== 'idle' && (
          <div className={`upload-status ${uploadStatus}`}>
            <strong>Upload status:</strong> {uploadStatus}
            {uploadResponse && (
              <pre>{JSON.stringify(uploadResponse, null, 2)}</pre>
            )}
          </div>
        )}

        <section className="spoof-section">
          <h2>Test spoofed payloads</h2>
          <p>
            Generate files that appear to be JavaScript/CSS but contain archive/binary signatures. Use these files to verify proxy filters.
          </p>
          <div className="spoof-grid">
            {SPOOF_CASES.map((spoofCase) => (
              <div key={spoofCase.label} className="spoof-card">
                <h3>{spoofCase.label}</h3>
                <p>Disguised MIME: <code>{spoofCase.disguise}</code></p>
                <p>File name: <code>{spoofCase.fileName}</code></p>
                <button type="button" onClick={() => onGenerateSpoofFile(spoofCase)}>
                  Download spoof file
                </button>
              </div>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}

export default App;

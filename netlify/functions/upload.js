let lastUpload = null;

const AVAILABLE_FILES = [
  {
    id: 'demo',
    name: 'demo.txt',
    description: 'A sample text file hosted by the server.',
    content: 'This content is served by the server and can be downloaded with a selected content type.',
  },
  {
    id: 'notes',
    name: 'notes.md',
    description: 'A markdown file that can be downloaded as HTML or JSON.',
    content: '# Server file\n\nThis file is listed by the server and can be downloaded in different formats.',
  },
];

function readStoredUpload() {
  return lastUpload;
}

function writeStoredUpload(upload) {
  lastUpload = upload;
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatContent(file, contentType) {
  if (!file) return '';

  switch (contentType) {
    case 'application/json':
      return JSON.stringify({ name: file.name, description: file.description, content: file.content }, null, 2);
    case 'text/html':
      return `<h1>${escapeHtml(file.name)}</h1><p>${escapeHtml(file.content)}</p>`;
    case 'text/markdown':
      return `# ${file.name}\n\n${file.content}`;
    case 'application/javascript':
      return `console.log('Downloaded from server');\nconst payload = ${JSON.stringify(file.content)};`;
    default:
      return file.content;
  }
}

function getSuggestedFileName(file, contentType) {
  const extensionMap = {
    'text/plain': 'txt',
    'text/markdown': 'md',
    'text/html': 'html',
    'application/json': 'json',
    'application/javascript': 'js',
  };

  const ext = extensionMap[contentType] || 'txt';
  return `${file.name.replace(/\.[^/.]+$/, '')}.${ext}`;
}

function parseMultipartFormData(event) {
  const contentType = event.headers?.['content-type'] || event.headers?.['Content-Type'] || '';
  const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);

  if (!boundaryMatch) {
    throw new Error('Missing multipart boundary');
  }

  const boundary = boundaryMatch[1] || boundaryMatch[2];
  const rawBody = event.isBase64Encoded
    ? Buffer.from(event.body || '', 'base64')
    : Buffer.from(event.body || '', 'utf8');
  const bodyText = rawBody.toString('utf8');
  const boundaryMarker = `--${boundary}`;
  const parts = bodyText.split(boundaryMarker);
  const payload = {};

  for (const rawPart of parts) {
    const part = rawPart.replace(/^\r?\n/, '').replace(/\r?\n$/, '');
    if (!part || part === '--') continue;
    if (part.startsWith('--')) continue;

    const separatorIndex = part.indexOf('\r\n\r\n');
    if (separatorIndex < 0) continue;

    const headersText = part.slice(0, separatorIndex);
    const bodyTextChunk = part.slice(separatorIndex + 4).replace(/\r\n$/, '');
    const headers = headersText.split('\r\n').reduce((acc, line) => {
      const separator = line.indexOf(':');
      if (separator > 0) {
        acc[line.slice(0, separator).trim().toLowerCase()] = line.slice(separator + 1).trim();
      }
      return acc;
    }, {});

    const disposition = headers['content-disposition'] || '';
    const nameMatch = disposition.match(/name="([^"]+)"/i);
    const name = nameMatch?.[1];

    if (!name) continue;

    payload[name] = bodyTextChunk;
  }

  return payload;
}

export const handler = async function (event) {
  if (event.httpMethod === 'GET') {
    const params = event.queryStringParameters || {};

    if (params.download === '1' || params.download === 'true') {
      const fileId = params.file || 'demo';
      const file = AVAILABLE_FILES.find((entry) => entry.id === fileId) || AVAILABLE_FILES[0];
      const contentType = params.contentType || 'text/plain';
      const body = formatContent(file, contentType);

      return {
        statusCode: 200,
        headers: {
          'Content-Type': contentType,
          'Content-Disposition': `attachment; filename="${getSuggestedFileName(file, contentType)}"`,
          'Cache-Control': 'no-store',
        },
        body,
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Server file list ready',
        files: AVAILABLE_FILES,
      }),
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ message: 'Method not allowed' }),
    };
  }

  let payload;
  try {
    const contentType = event.headers?.['content-type'] || event.headers?.['Content-Type'] || '';
    if (contentType.includes('multipart/form-data')) {
      payload = parseMultipartFormData(event);
    } else {
      payload = JSON.parse(event.body || '{}');
    }
  } catch (error) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: 'Invalid payload', error: String(error) }),
    };
  }

  const { name, type, content, file } = payload;
  const uploadedContent = content || file || '';
  const fileName = name || 'upload.bin';

  if (!uploadedContent) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: 'Missing required fields: file content' }),
    };
  }

  const uploadRecord = {
    name: fileName,
    type: type || 'application/octet-stream',
    content: uploadedContent,
  };

  writeStoredUpload(uploadRecord);

  const signature = uploadedContent.slice(0, 10);
  const detected = [];
  if (signature.startsWith('UEsDB')) detected.push('ZIP archive');
  if (signature.startsWith('JVBERi0')) detected.push('PDF document');
  if (signature.startsWith('TVqQA')) detected.push('Windows executable');
  if (signature.startsWith('UmFyIQ')) detected.push('RAR archive');

  return {
    statusCode: 200,
    body: JSON.stringify({
      message: 'Upload received',
      file: {
        name: fileName,
        type: type || 'application/octet-stream',
        signature: signature.slice(0, 12),
        detected,
        contentBase64: uploadedContent,
      },
      bodyLength: uploadedContent.length,
      transport: 'multipart/form-data',
    }),
  };
};

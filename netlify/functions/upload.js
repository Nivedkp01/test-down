let lastUpload = null;

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
    if (!lastUpload) {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: 'No uploaded file stored on the server yet.' }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Download ready',
        file: {
          name: lastUpload.name,
          type: lastUpload.type,
          contentBase64: lastUpload.content,
          contentLength: lastUpload.content.length,
        },
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

  lastUpload = {
    name: fileName,
    type: type || 'application/octet-stream',
    content: uploadedContent,
  };

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

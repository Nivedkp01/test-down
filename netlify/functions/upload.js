let lastUpload = null;

function trimTrailingCrlf(buffer) {
  let end = buffer.length;
  while (end > 0 && (buffer[end - 1] === 0x0d || buffer[end - 1] === 0x0a)) {
    end -= 1;
  }
  return buffer.subarray(0, end);
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
  const boundaryBuffer = Buffer.from(`--${boundary}`);
  const parts = [];
  let searchStart = 0;

  while (searchStart < rawBody.length) {
    const boundaryIndex = rawBody.indexOf(boundaryBuffer, searchStart);
    if (boundaryIndex === -1) break;

    const sectionStart = boundaryIndex + boundaryBuffer.length;
    const nextBoundary = rawBody.indexOf(boundaryBuffer, sectionStart);
    const sectionEnd = nextBoundary === -1 ? rawBody.length : nextBoundary;
    const sectionBuffer = rawBody.subarray(sectionStart, sectionEnd);

    const separatorIndex = sectionBuffer.indexOf(Buffer.from('\r\n\r\n'));
    const headersBuffer = separatorIndex >= 0 ? sectionBuffer.subarray(0, separatorIndex) : Buffer.alloc(0);
    const bodyBuffer = separatorIndex >= 0 ? trimTrailingCrlf(sectionBuffer.subarray(separatorIndex + 4)) : trimTrailingCrlf(sectionBuffer);

    const headers = headersBuffer.toString('utf8').split('\r\n').reduce((acc, line) => {
      const separator = line.indexOf(':');
      if (separator > 0) {
        acc[line.slice(0, separator).trim().toLowerCase()] = line.slice(separator + 1).trim();
      }
      return acc;
    }, {});

    parts.push({ headers, bodyBuffer });
    searchStart = sectionEnd;
  }

  const payload = {};
  for (const part of parts) {
    const disposition = part.headers['content-disposition'] || '';
    const nameMatch = disposition.match(/name="([^"]+)"/i);
    const fileNameMatch = disposition.match(/filename="([^"]*)"/i);
    const name = nameMatch?.[1];

    if (!name) continue;

    payload[name] = fileNameMatch ? part.bodyBuffer.toString('base64') : part.bodyBuffer.toString('utf8');
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

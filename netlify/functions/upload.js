exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ message: 'Method not allowed' }),
    };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (error) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: 'Invalid JSON payload', error: String(error) }),
    };
  }

  const { name, type, content } = payload;
  if (!name || !content) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: 'Missing required fields: name and content' }),
    };
  }

  const signature = content.slice(0, 10);
  const detected = [];
  if (signature.startsWith('UEsDB')) detected.push('ZIP archive');
  if (signature.startsWith('JVBERi0')) detected.push('PDF document');
  if (signature.startsWith('TVqQA')) detected.push('Windows executable');
  if (signature.startsWith('UmFyIQ')) detected.push('RAR archive');

  return {
    statusCode: 200,
    body: JSON.stringify({
      message: 'Upload received',
      file: { name, type, signature: signature.slice(0, 12), detected },
      bodyLength: content.length,
    }),
  };
};

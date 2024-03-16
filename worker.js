addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const url = new URL(request.url);
  const path = url.pathname;

  if (path === '/') {
    const indexHtml = await fetch('https://raw.githubusercontent.com/jiusiguer/mdhaha/master/index.html');
    return new Response(await indexHtml.text(), {
      headers: { 'Content-Type': 'text/html' },
    });
  } else if (path === '/convert') {
    if (request.method === 'POST') {
      const requestBody = await request.json();
      const qUrl = requestBody.url;

      try {
        const response = await fetch('https://md.kurssy.tech/convert', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ url: qUrl }),
        });

        if (response.ok) {
          const data = await response.json();
          return new Response(JSON.stringify(data), {
            headers: { 'Content-Type': 'application/json' },
          });
        } else {
          return new Response(JSON.stringify({ error: '转换失败' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      } catch (error) {
        console.error('转换失败:', error);
        return new Response(JSON.stringify({ error: '转换失败' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    } else {
      return new Response('Method not allowed', { status: 405 });
    }
  } else {
    return new Response('Not found', { status: 404 });
  }
}

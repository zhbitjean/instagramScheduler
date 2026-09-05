import { createServer } from 'node:http';

const port = Number(process.env.PORT || 8080);
const localCallback = process.env.POSTFLOW_LOCAL_CALLBACK || 'http://127.0.0.1:3030/instagram/callback';

createServer((request, response) => {
  const incoming = new URL(request.url || '/', 'https://postflow.invalid');

  if (incoming.pathname === '/health') {
    response.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    return response.end(JSON.stringify({ ok: true }));
  }

  if (incoming.pathname === '/instagram/callback') {
    const destination = new URL(localCallback);
    destination.search = incoming.search;
    response.writeHead(302, { location: destination.toString(), 'cache-control': 'no-store' });
    return response.end();
  }

  response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
  response.end('Postflow callback service');
}).listen(port, '0.0.0.0', () => {
  console.log(`Postflow callback service listening on ${port}`);
});

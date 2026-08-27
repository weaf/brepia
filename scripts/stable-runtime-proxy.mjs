#!/usr/bin/env node
import http from 'node:http';
import net from 'node:net';

const publicHost = process.env.PCAD_STABLE_HOST || '0.0.0.0';
const publicPort = Number(process.env.PCAD_STABLE_PORT || 3000);
const appHost = process.env.PCAD_STABLE_APP_HOST || '127.0.0.1';
const appPort = Number(process.env.PCAD_STABLE_APP_PORT || 3001);
const supabaseHost = process.env.PCAD_STABLE_SUPABASE_HOST || '127.0.0.1';
const supabasePort = Number(process.env.PCAD_STABLE_SUPABASE_PORT || 54321);

const supabasePrefixes = [
  '/auth',
  '/rest',
  '/storage',
  '/realtime',
  '/functions',
  '/graphql',
];

function isSupabasePath(url = '/') {
  const pathname = new URL(url, 'http://stable.local').pathname;
  return supabasePrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function proxyTarget(url) {
  return isSupabasePath(url)
    ? { host: supabaseHost, port: supabasePort, supabase: true }
    : { host: appHost, port: appPort, supabase: false };
}

function forwardedHeaders(req, target) {
  const headers = { ...req.headers };
  const originalHost = req.headers.host;

  if (target.supabase) {
    headers.host = `${supabaseHost}:${supabasePort}`;
  }

  if (originalHost) {
    headers['x-forwarded-host'] = originalHost;
  }
  headers['x-forwarded-proto'] =
    req.headers['x-forwarded-proto'] || 'https';
  headers['x-forwarded-for'] = req.socket.remoteAddress || '';

  return headers;
}

function handleHttp(req, res) {
  const target = proxyTarget(req.url);
  const upstream = http.request(
    {
      hostname: target.host,
      port: target.port,
      path: req.url,
      method: req.method,
      headers: forwardedHeaders(req, target),
    },
    (upstreamRes) => {
      if (res.destroyed || res.writableEnded) {
        upstreamRes.destroy();
        return;
      }

      res.writeHead(upstreamRes.statusCode || 502, upstreamRes.headers);
      upstreamRes.pipe(res);
    },
  );

  const closeUpstream = () => {
    if (!upstream.destroyed) upstream.destroy();
  };

  req.on('aborted', closeUpstream);
  res.on('close', () => {
    if (!res.writableEnded) closeUpstream();
  });

  upstream.on('error', (error) => {
    if (res.destroyed || res.writableEnded) return;
    console.error(
      `[stable-proxy] ${req.method || 'GET'} ${req.url || '/'} -> ${target.host}:${target.port}: ${error.message}`,
    );
    res.statusCode = 502;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end('Stable runtime upstream unavailable');
  });

  req.pipe(upstream);
}

function handleUpgrade(req, socket, head) {
  const target = proxyTarget(req.url);

  // The stable app itself has no Vite/HMR websocket. Supabase Realtime is the
  // expected websocket path, but forwarding any future app websocket here is
  // harmless and keeps this proxy transport-agnostic.
  const upstream = net.connect(target.port, target.host, () => {
    const headers = forwardedHeaders(req, target);
    const requestLine = `${req.method || 'GET'} ${req.url || '/'} HTTP/${req.httpVersion}\r\n`;
    const headerLines = Object.entries(headers)
      .flatMap(([name, value]) => {
        if (Array.isArray(value)) {
          return value.map((item) => `${name}: ${item}\r\n`);
        }
        return value === undefined ? [] : [`${name}: ${value}\r\n`];
      })
      .join('');

    upstream.write(`${requestLine}${headerLines}\r\n`);
    if (head.length > 0) upstream.write(head);
    socket.pipe(upstream).pipe(socket);
  });

  const closeBoth = () => {
    if (!socket.destroyed) socket.destroy();
    if (!upstream.destroyed) upstream.destroy();
  };

  upstream.on('error', (error) => {
    console.error(
      `[stable-proxy] websocket ${req.url || '/'} -> ${target.host}:${target.port}: ${error.message}`,
    );
    closeBoth();
  });
  socket.on('error', closeBoth);
}

const server = http.createServer(handleHttp);
server.on('upgrade', handleUpgrade);
server.on('clientError', (error, socket) => {
  if (error.code !== 'ECONNRESET') {
    console.warn(`[stable-proxy] client error: ${error.message}`);
  }
  if (!socket.destroyed) socket.destroy();
});

server.listen(publicPort, publicHost, () => {
  console.log(
    `[stable-proxy] http://${publicHost}:${publicPort} -> app http://${appHost}:${appPort}, supabase http://${supabaseHost}:${supabasePort}`,
  );
});

function shutdown(signal) {
  console.log(`[stable-proxy] ${signal}, shutting down`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 2000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

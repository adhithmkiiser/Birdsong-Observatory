import { NextRequest } from 'next/server';
import http from 'http';
import { PassThrough, Readable } from 'stream';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const targetUrl = req.nextUrl.searchParams.get('url') || 'http://172.27.78.51:8888/stream.opus';

  const passThrough = new PassThrough();

  const proxyReq = http.get(targetUrl, (upstreamRes) => {
    upstreamRes.pipe(passThrough);
  });

  proxyReq.on('error', (err) => {
    console.warn('Proxy upstream error:', err.message);
    passThrough.destroy(err);
  });

  req.signal.addEventListener('abort', () => {
    proxyReq.destroy();
    passThrough.destroy();
  });

  const webStream = Readable.toWeb(passThrough);

  return new Response(webStream as any, {
    status: 200,
    headers: {
      'Content-Type': 'audio/ogg; codecs=opus',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Private-Network': 'true'
    }
  });
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS, HEAD',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Allow-Private-Network': 'true'
    }
  });
}

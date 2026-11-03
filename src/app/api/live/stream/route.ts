import { NextRequest } from 'next/server';
import http from 'http';
import https from 'https';
import { PassThrough, Readable } from 'stream';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

/**
 * Validates that an upstream audio stream URL is safe to proxy and not an SSRF target
 * (blocks cloud metadata 169.254.169.254, loopback 127.0.0.1/localhost, and arbitrary non-stream hosts).
 */
function isSafeStreamTarget(rawUrl: string, allowedRegisteredUrls: Set<string>): boolean {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false;
    }

    // If the exact URL is registered by a trusted station in recorders_registry, allow it
    if (allowedRegisteredUrls.has(rawUrl.trim())) {
      return true;
    }

    const host = parsed.hostname.toLowerCase();

    // Block loopback, link-local / cloud metadata, and unspecified addresses
    if (
      host === 'localhost' ||
      host === '0.0.0.0' ||
      host === '::1' ||
      host === '[::1]' ||
      host.startsWith('127.') ||
      host.startsWith('169.254.') ||
      host.startsWith('10.') ||
      host.startsWith('192.168.') ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host)
    ) {
      // Only allow the explicit default local Raspberry Pi stream host/port if on port 8888 with stream path
      if (rawUrl === 'http://172.27.78.51:8888/stream.opus') {
        return true;
      }
      return false;
    }

    // Allow Cloudflare Quick Tunnels (*.trycloudflare.com) serving audio stream paths
    const isCloudflareTunnel = /^[a-z0-9-]+\.trycloudflare\.com$/i.test(host);
    const isValidStreamPath = ['/stream.opus', '/stream', '/live'].includes(parsed.pathname);

    return isCloudflareTunnel && isValidStreamPath;
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  let targetUrl = req.nextUrl.searchParams.get('url')?.trim() || '';
  const registeredUrls = new Set<string>();

  try {
    const { data } = await supabaseAdmin
      .from('recorders_registry')
      .select('elevation, stream_url')
      .eq('project_type', 'Live')
      .order('created_at', { ascending: false })
      .limit(20);

    (data || []).forEach((row: any) => {
      if (row?.elevation && String(row.elevation).startsWith('http')) {
        registeredUrls.add(String(row.elevation).trim());
      }
      if (row?.stream_url && String(row.stream_url).startsWith('http')) {
        registeredUrls.add(String(row.stream_url).trim());
      }
    });

    if (!targetUrl && registeredUrls.size > 0) {
      targetUrl = Array.from(registeredUrls)[0];
    }
  } catch {
    // fallback
  }

  if (!targetUrl) {
    targetUrl = 'http://172.27.78.51:8888/stream.opus';
  }

  if (!isSafeStreamTarget(targetUrl, registeredUrls)) {
    return new Response(JSON.stringify({ error: 'Forbidden: untrusted or invalid stream URL' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const passThrough = new PassThrough();
  const client = targetUrl.startsWith('https://') ? https : http;

  const proxyReq = client.get(targetUrl, (upstreamRes) => {
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
      'X-Content-Type-Options': 'nosniff'
    }
  });
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Methods': 'GET, OPTIONS, HEAD',
      'Access-Control-Allow-Headers': 'Content-Type, Range'
    }
  });
}

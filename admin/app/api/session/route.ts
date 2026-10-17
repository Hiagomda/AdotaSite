import {
  clearSessionCookies,
  readJson,
  rejectCrossOrigin,
  sessionCookie,
  upstream,
} from '../../../lib/bff';

export async function POST(request: Request) {
  const rejected = rejectCrossOrigin(request);
  if (rejected) return rejected;
  const body = (await request.json()) as { username?: string; password?: string };
  const upstreamResponse = await upstream('/admin/v1/login', request, {
    method: 'POST',
    body: JSON.stringify({ username: body.username, password: body.password }),
  });
  const payload = await readJson(upstreamResponse);
  if (!upstreamResponse.ok) {
    return Response.json(
      { message: payload.message ?? 'Não consegui entrar.' },
      { status: upstreamResponse.status },
    );
  }
  const token = typeof payload.token === 'string' ? payload.token : '';
  if (!token) return Response.json({ message: 'Não consegui entrar.' }, { status: 502 });
  return Response.json({ ok: true }, { headers: { 'set-cookie': sessionCookie(token) } });
}

export async function DELETE(request: Request) {
  const rejected = rejectCrossOrigin(request);
  if (rejected) return rejected;
  await upstream('/admin/v1/session/logout', request, { method: 'POST' });
  const headers = new Headers();
  for (const cookie of clearSessionCookies()) headers.append('set-cookie', cookie);
  return Response.json({ ok: true }, { headers });
}

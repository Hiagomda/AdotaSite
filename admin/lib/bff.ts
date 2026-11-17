const apiOrigin = process.env.ADMIN_API_URL ?? 'http://127.0.0.1:3010';

function secureFlag(): string {
  return process.env.NODE_ENV === 'production' ? '; Secure' : '';
}

/**
 * IP de quem abriu o painel: o último endereço do X-Forwarded-For, que é o que o Traefik do
 * Coolify acrescenta. Os da esquerda podem ter vindo do navegador e não valem.
 */
export function clientIp(request: Request): string | null {
  const last = request.headers.get('x-forwarded-for')?.split(',').pop()?.trim();
  return last || request.headers.get('x-real-ip')?.trim() || null;
}

export function rejectCrossOrigin(request: Request): Response | null {
  const origin = request.headers.get('origin');
  const host = request.headers.get('host');
  if (!origin || !host || new URL(origin).host !== host) {
    return Response.json({ message: 'Não consegui confirmar esta ação.' }, { status: 403 });
  }
  return null;
}

export function readCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(';')) {
    const [rawKey, ...rest] = part.trim().split('=');
    if (rawKey === name) return decodeURIComponent(rest.join('='));
  }
  return null;
}

export async function upstream(
  path: string,
  request: Request,
  init: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(init.headers);
  const token = readCookie(request.headers.get('cookie'), 'egua_admin');
  if (token) headers.set('authorization', `Bearer ${token}`);
  if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json');
  // A API vê todo pedido do painel com o IP deste servidor. Com o segredo combinado
  // (STAFF_PROXY_SECRET, mesmo valor na API), ela usa o IP real de quem está no painel no
  // limite e no bloqueio de login e na auditoria. Sem o segredo, nada é repassado.
  const proxySecret = process.env.STAFF_PROXY_SECRET;
  const ip = clientIp(request);
  if (proxySecret && ip) {
    headers.set('x-egua-proxy-secret', proxySecret);
    headers.set('x-egua-client-ip', ip);
  }
  try {
    return await fetch(`${apiOrigin}${path}`, { ...init, headers, cache: 'no-store' });
  } catch {
    return Response.json({ message: 'A API não respondeu.' }, { status: 503 });
  }
}

export function sessionCookie(token: string): string {
  return `egua_admin=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${8 * 60 * 60}${secureFlag()}`;
}

export function clearSessionCookies(): string[] {
  const secure = secureFlag();
  return [
    `egua_admin=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0${secure}`,
    // Apaga o cookie do login antigo com autenticador, se ainda existir.
    `egua_admin_ticket=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0${secure}`,
  ];
}

export async function readJson(
  response: Response,
): Promise<{ message?: string } & Record<string, unknown>> {
  return (await response.json()) as { message?: string } & Record<string, unknown>;
}

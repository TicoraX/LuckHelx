import { type NextRequest, NextResponse } from 'next/server';
import { isApiMutationAllowed } from '@/lib/csrf';

export function middleware(request: NextRequest) {
  const { headers } = request;
  const contentLength = headers.get('content-length');
  const allowed = isApiMutationAllowed(
    {
      method: request.method,
      pathname: request.nextUrl.pathname,
      origin: headers.get('origin'),
      host: headers.get('host'),
      contentType: headers.get('content-type'),
      // Un cuerpo chunked no trae Content-Length; un fetch sin body manda 0 o nada.
      hasBody:
        headers.has('transfer-encoding') || (contentLength !== null && contentLength !== '0'),
    },
    process.env.LUCKHELX_REMOTE_HOST
  );

  if (allowed) return NextResponse.next();
  return NextResponse.json(
    { error: 'Pedido rechazado: origen o tipo de contenido no permitido' },
    { status: 403 }
  );
}

export const config = { matcher: '/api/:path*' };

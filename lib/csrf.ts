// Guardia CSRF de la API (S5 de HELX_AUDIT). Sin ella, cualquier pagina abierta en el
// navegador de la PC podia mandar `text/plain` a 127.0.0.1 (un "simple request" sin
// preflight) y, por ejemplo, sobrescribir la base con POST /api/backup.

const MUTATING = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);
const LOCAL_HOSTNAMES = new Set(['127.0.0.1', 'localhost']);
// La unica ruta que recibe un archivo: el audio de apertura sube como multipart.
const MULTIPART_ROUTES = new Set(['/api/sounds/opening']);

export interface ApiRequestInfo {
  method: string;
  pathname: string;
  origin: string | null;
  host: string | null;
  contentType: string | null;
  hasBody: boolean;
}

// El origen local se compara contra el Host del pedido, porque el puerto no es fijo
// (aleatorio en Electron, el de `-p` en `next dev`). Solo vale si el Host es 127.0.0.1 o
// localhost: con un Host arbitrario, un dominio que resuelva a 127.0.0.1 (DNS rebinding)
// pasaria la comparacion. El remoto es el de tailscale serve, siempre HTTPS.
function isAllowedOrigin(origin: string, host: string | null, remoteHost: string | undefined) {
  const normalized = origin.toLowerCase();
  if (remoteHost && normalized === `https://${remoteHost.toLowerCase()}`) return true;
  if (!host) return false;
  const localHost = host.toLowerCase();
  const hostname = localHost.replace(/:\d+$/, '');
  return LOCAL_HOSTNAMES.has(hostname) && normalized === `http://${localHost}`;
}

function mediaType(contentType: string | null) {
  return (contentType ?? '').split(';')[0].trim().toLowerCase();
}

// Un pedido mutante sin Origin se rechaza: el Fetch spec obliga a los navegadores a
// mandarlo en todo lo que no sea GET o HEAD, aun same-origin, asi que solo lo omite un
// cliente que no es la UI. El Content-Type se exige solo si hay cuerpo: varias acciones de
// la UI (girar la ruleta, borrar una tarea, rotar la semilla) son POST/DELETE sin cuerpo,
// y sin cuerpo no hay payload que colar; el Origin ya las cubre.
export function isApiMutationAllowed(
  request: ApiRequestInfo,
  remoteHost: string | undefined
): boolean {
  if (!MUTATING.has(request.method.toUpperCase())) return true;
  if (!request.origin || !isAllowedOrigin(request.origin, request.host, remoteHost)) return false;
  if (!request.hasBody) return true;

  const type = mediaType(request.contentType);
  if (type === 'application/json') return true;
  return type === 'multipart/form-data' && MULTIPART_ROUTES.has(request.pathname);
}

import { describe, expect, it } from 'vitest';
import { type ApiRequestInfo, isApiMutationAllowed } from './csrf';

const HOST = '127.0.0.1:48123';
const REMOTE = 'pc.tailnet.ts.net';

function req(overrides: Partial<ApiRequestInfo>): ApiRequestInfo {
  return {
    method: 'POST',
    origin: `http://${HOST}`,
    host: HOST,
    contentType: 'application/json',
    hasBody: true,
    ...overrides,
  };
}

describe('isApiMutationAllowed', () => {
  it('JSON same-origin pasa', () => {
    expect(isApiMutationAllowed(req({}), undefined)).toBe(true);
    expect(
      isApiMutationAllowed(req({ contentType: 'application/json; charset=utf-8' }), undefined)
    ).toBe(true);
  });

  it('localhost same-origin pasa (next dev abierto como localhost)', () => {
    expect(
      isApiMutationAllowed(
        req({ host: 'localhost:3000', origin: 'http://localhost:3000' }),
        undefined
      )
    ).toBe(true);
  });

  it('text/plain cross-origin da 403', () => {
    expect(
      isApiMutationAllowed(
        req({ origin: 'https://evil.example', contentType: 'text/plain' }),
        undefined
      )
    ).toBe(false);
  });

  it('text/plain same-origin con cuerpo tambien da 403', () => {
    expect(isApiMutationAllowed(req({ contentType: 'text/plain' }), undefined)).toBe(false);
    expect(isApiMutationAllowed(req({ contentType: null }), undefined)).toBe(false);
  });

  it('otro puerto local o un Host que no es local (DNS rebinding) da 403', () => {
    expect(isApiMutationAllowed(req({ origin: 'http://127.0.0.1:3000' }), undefined)).toBe(false);
    expect(
      isApiMutationAllowed(
        req({ host: 'evil.example:48123', origin: 'http://evil.example:48123' }),
        undefined
      )
    ).toBe(false);
  });

  it('sin Origin u Origin null da 403', () => {
    expect(isApiMutationAllowed(req({ origin: null }), undefined)).toBe(false);
    expect(isApiMutationAllowed(req({ origin: 'null' }), undefined)).toBe(false);
  });

  it('el origen remoto configurado pasa', () => {
    expect(isApiMutationAllowed(req({ origin: `https://${REMOTE}` }), REMOTE)).toBe(true);
  });

  it('sin LUCKHELX_REMOTE_HOST el origen remoto da 403, y por http tambien', () => {
    expect(isApiMutationAllowed(req({ origin: `https://${REMOTE}` }), undefined)).toBe(false);
    expect(isApiMutationAllowed(req({ origin: `http://${REMOTE}` }), REMOTE)).toBe(false);
  });

  it('POST y DELETE sin cuerpo pasan same-origin y se rechazan cross-origin', () => {
    const noBody = { contentType: null, hasBody: false };
    expect(isApiMutationAllowed(req(noBody), undefined)).toBe(true);
    expect(isApiMutationAllowed(req({ ...noBody, method: 'DELETE' }), undefined)).toBe(true);
    expect(
      isApiMutationAllowed(req({ ...noBody, origin: 'https://evil.example' }), undefined)
    ).toBe(false);
  });

  it('rechaza multipart: ninguna ruta recibe archivos', () => {
    expect(
      isApiMutationAllowed(req({ contentType: 'multipart/form-data; boundary=x' }), undefined)
    ).toBe(false);
  });

  it('GET no se toca, venga de donde venga', () => {
    expect(
      isApiMutationAllowed(
        req({ method: 'GET', origin: 'https://evil.example', contentType: 'text/plain' }),
        undefined
      )
    ).toBe(true);
  });
});

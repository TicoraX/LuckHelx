import fs from 'fs';
import path from 'path';

// El sample que sube el usuario no puede vivir en `public/`: en la app empaquetada eso son
// recursos de solo lectura adentro del .exe. Va al lado de la base, que es el único
// directorio con permiso de escritura que la app conoce (userData en Electron,
// `.local/` cuando corre como web).
function soundsDir(): string {
  const dbPath = process.env.DB_PATH || path.join(process.cwd(), '.local', 'data.db');
  return path.join(path.dirname(dbPath), 'sounds');
}

// Nombre fijo, nunca el que venga en el upload: un `../../` en el nombre original
// escribiría fuera del directorio.
export function openingSoundPath(): string {
  return path.join(soundsDir(), 'opening.mp3');
}

export function hasCustomOpeningSound(): boolean {
  return fs.existsSync(openingSoundPath());
}

export const MAX_SOUND_BYTES = 10 * 1024 * 1024;

export function saveOpeningSound(bytes: Buffer): void {
  if (bytes.byteLength === 0) throw new Error('archivo vacio');
  if (bytes.byteLength > MAX_SOUND_BYTES) throw new Error('el archivo supera los 10 MB');

  fs.mkdirSync(soundsDir(), { recursive: true });
  fs.writeFileSync(openingSoundPath(), bytes);
}

export function deleteOpeningSound(): void {
  if (hasCustomOpeningSound()) fs.unlinkSync(openingSoundPath());
}

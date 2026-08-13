import { NextResponse } from 'next/server';
import fs from 'fs';
import {
  openingSoundPath,
  hasCustomOpeningSound,
  saveOpeningSound,
  deleteOpeningSound,
  MAX_SOUND_BYTES,
} from '@/lib/user-sounds';

// Sirve el sample propio del usuario, que vive fuera de `public/` porque en el paquete de
// Electron ese directorio es de solo lectura. Soporta Range para que el navegador pueda
// arrancar desde el offset (`#t=`) sin bajar los 20s enteros.
export async function GET(request: Request) {
  if (!hasCustomOpeningSound()) {
    return NextResponse.json({ error: 'no hay sonido propio' }, { status: 404 });
  }

  const filePath = openingSoundPath();
  const size = fs.statSync(filePath).size;
  const range = request.headers.get('range');

  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
    const unsatisfiable = new NextResponse(null, {
      status: 416,
      headers: { 'Content-Range': `bytes */${size}` },
    });

    if (!match || (!match[1] && !match[2])) return unsatisfiable;

    let start: number;
    let end: number;

    if (!match[1]) {
      // Rango de sufijo (`bytes=-500`): son los ÚLTIMOS 500 bytes, no los primeros.
      start = Math.max(0, size - Number(match[2]));
      end = size - 1;
    } else {
      start = Number(match[1]);
      // Un final más allá del archivo se acota. Sin esto el 206 prometía en Content-Range
      // más bytes de los que iban en el cuerpo, que es una respuesta malformada.
      end = match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
    }

    if (!Number.isFinite(start) || start >= size || end < start) return unsatisfiable;

    const chunk = fs.readFileSync(filePath).subarray(start, end + 1);
    return new NextResponse(new Uint8Array(chunk), {
      status: 206,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': String(chunk.byteLength),
        'Content-Range': `bytes ${start}-${end}/${size}`,
        'Accept-Ranges': 'bytes',
        // Igual que la respuesta completa: el archivo cambia cuando el usuario sube otro,
        // y una parte cacheada del anterior sonaría mezclada con el nuevo.
        'Cache-Control': 'no-store',
      },
    });
  }

  return new NextResponse(new Uint8Array(fs.readFileSync(filePath)), {
    headers: {
      'Content-Type': 'audio/mpeg',
      'Content-Length': String(size),
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'no-store',
    },
  });
}

export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: 'cuerpo de solicitud invalido' }, { status: 400 });
  }

  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'falta el archivo' }, { status: 400 });
  }
  // MP3 y nada más: se guarda como `opening.mp3` y el GET lo sirve como `audio/mpeg`.
  // Aceptar un ogg o un wav acá lo dejaba servido con el tipo equivocado y mudo.
  if (file.type !== 'audio/mpeg') {
    return NextResponse.json({ error: 'el archivo tiene que ser un MP3' }, { status: 400 });
  }
  if (file.size > MAX_SOUND_BYTES) {
    return NextResponse.json({ error: 'el archivo supera los 10 MB' }, { status: 400 });
  }

  try {
    saveOpeningSound(Buffer.from(await file.arrayBuffer()));
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

// Borrarlo vuelve al sample que trae el proyecto, o a los ticks sintetizados si tampoco
// está: nunca deja la apertura muda.
export async function DELETE() {
  deleteOpeningSound();
  return NextResponse.json({ ok: true });
}

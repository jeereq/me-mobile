/**
 * Sur le web, une photo choisie arrive telle quelle : souvent plus de 5 Mo, parfois en HEIC (iPhone), que le serveur
 * refuse. On la redessine en JPEG, au plus `max` pixels de côté. Si le navigateur ne sait pas la lire, on garde l'original :
 * le serveur dira alors clairement ce qui ne va pas.
 */
export async function versJpegWeb(source: Blob | string, max = 2000, qualite = 0.82): Promise<Blob> {
  const original = typeof source === 'string' ? await (await fetch(source)).blob() : source;
  if (typeof document === 'undefined' || !original.type.startsWith('image/') || original.type === 'image/gif') return original;
  try {
    const img = await charger(original);
    const echelle = Math.min(1, max / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.width * echelle));
    canvas.height = Math.max(1, Math.round(img.height * echelle));
    const ctx = canvas.getContext('2d');
    if (!ctx) return original;
    // Fond blanc : une image transparente (PNG) ne devient pas noire en JPEG.
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img.source, 0, 0, canvas.width, canvas.height);
    const jpeg = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, 'image/jpeg', qualite));
    if (!jpeg) return original;
    // On garde l'original s'il était déjà petit, lisible par le serveur et plus léger.
    const lisible = ['image/jpeg', 'image/png', 'image/webp'].includes(original.type);
    return echelle < 1 || !lisible || jpeg.size < original.size ? jpeg : original;
  } catch {
    return original;
  }
}

async function charger(b: Blob): Promise<{ source: CanvasImageSource; width: number; height: number }> {
  if (typeof createImageBitmap === 'function') {
    const bmp = await createImageBitmap(b);
    return { source: bmp, width: bmp.width, height: bmp.height };
  }
  const url = URL.createObjectURL(b);
  try {
    const img = new Image();
    await new Promise<void>((ok, ko) => {
      img.onload = () => ok();
      img.onerror = () => ko(new Error('illisible'));
      img.src = url;
    });
    return { source: img, width: img.naturalWidth, height: img.naturalHeight };
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

/** « photo.HEIC » → « photo.jpg » quand le fichier a été redessiné en JPEG. */
export const nomJpeg = (nom: string, b: Blob) => (b.type === 'image/jpeg' && !/\.jpe?g$/i.test(nom) ? `${nom.replace(/\.[a-z0-9]+$/i, '') || 'photo'}.jpg` : nom);

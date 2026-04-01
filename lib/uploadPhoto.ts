/**
 * Upload a base64 data URL or File to Supabase Storage via the server-side API route.
 * This bypasses storage RLS — works for authenticated users on Vercel.
 */
export async function uploadPhoto(
  source: string | File,  // base64 data URL or File object
  bucket: string,
  path: string
): Promise<string | null> {
  try {
    let file: File;

    if (typeof source === 'string') {
      // Convert base64 data URL → File
      const base64 = source.split(',')[1];
      const mime = source.split(';')[0].split(':')[1] || 'image/jpeg';
      const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: mime });
      file = new File([blob], 'upload.jpg', { type: mime });
    } else {
      file = source;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('bucket', bucket);
    formData.append('path', path);

    const res = await fetch('/api/upload', { method: 'POST', body: formData });
    const json = await res.json();
    if (!res.ok || json.error) {
      console.error('Upload error:', json.error);
      return null;
    }
    return json.publicUrl as string;
  } catch (e) {
    console.error('Upload exception:', e);
    return null;
  }
}

// Read raw image bytes: FunctionsClient.invoke parses image/* responses as text.
// Keep authorization at the existing Edge endpoint; never build Storage URLs.
export async function loadExperiencePhoto(
 options: {baseUrl: string; postId: string; accessToken?: string | null; apiKey: string},
 request: typeof fetch = fetch,
): Promise<Blob> {
 const response = await request(`${options.baseUrl.replace(/\/$/,'')}/functions/v1/community-experience-photo?post_id=${encodeURIComponent(options.postId)}`, {
  method:'GET',cache:'no-store',headers:{
   apikey:options.apiKey,
   Authorization:`Bearer ${options.accessToken || options.apiKey}`,
  },
 });
 if (!response.ok) throw new Error(`Experience photo request failed (${response.status})`);
 const mime=(response.headers.get('Content-Type') || '').split(';')[0].trim().toLowerCase();
 if (!['image/jpeg','image/png','image/webp'].includes(mime)) throw new Error('Experience photo response is not a supported image');
 const blob=await response.blob();
 if (!blob.size) throw new Error('Experience photo response is empty');
 return blob;
}

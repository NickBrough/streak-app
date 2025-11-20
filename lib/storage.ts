import { supabase } from "@/lib/supabase";

const AVATAR_BUCKET = "streaks";

export type UploadAvatarResult = {
  publicUrl: string;
  path: string;
};

function getPathFromPublicUrl(publicUrl: string): string | null {
  // Expected format: https://<project>.supabase.co/storage/v1/object/public/streaks/<path>
  const marker = "/object/public/streaks/";
  const idx = publicUrl.indexOf(marker);
  if (idx === -1) return null;
  return publicUrl.substring(idx + marker.length);
}

export async function uploadAvatarFromUri(
  localUri: string,
  userId: string
): Promise<UploadAvatarResult> {
  const response = await fetch(localUri);
  const arrayBuffer = await response.arrayBuffer();

  const timestamp = Date.now();
  const path = `${userId}/${timestamp}.jpg`;

  const { error: uploadError } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, arrayBuffer, {
      contentType: "image/jpeg",
      upsert: false,
    });
  if (uploadError) {
    throw uploadError;
  }

  const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
  if (!data?.publicUrl) {
    throw new Error("Failed to get public URL for uploaded avatar");
  }

  return { publicUrl: data.publicUrl, path };
}

export async function deleteAvatarByUrl(publicUrl: string): Promise<void> {
  const path = getPathFromPublicUrl(publicUrl);
  if (!path) return;
  await supabase.storage.from(AVATAR_BUCKET).remove([path]);
}

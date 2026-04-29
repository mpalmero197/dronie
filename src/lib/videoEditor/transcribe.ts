import { getFFmpeg, fetchFile } from "./ffmpeg";
import { supabase } from "@/integrations/supabase/client";

export interface TranscriptCue { startS: number; endS: number; text: string }

/** Extract audio from a video (URL or blob URL) into mp3 base64. */
export async function extractAudioBase64(src: string, name = "src.mp4"): Promise<{ b64: string; mime: string; durationS: number }> {
  const ff = await getFFmpeg();
  const data = await fetchFile(src);
  const ext = (name.split(".").pop() || "mp4").toLowerCase();
  const inFile = `tx_in.${ext}`;
  const outFile = "tx_out.mp3";
  await ff.writeFile(inFile, data);
  await ff.exec(["-i", inFile, "-vn", "-ac", "1", "-ar", "16000", "-b:a", "64k", outFile]);
  const out = await ff.readFile(outFile);
  const u8 = out as Uint8Array;
  // probe duration via metadata is non-trivial in wasm; estimate from bitrate later if needed.
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < u8.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(u8.subarray(i, i + chunk)) as number[]);
  }
  const b64 = btoa(binary);
  try { await ff.deleteFile(inFile); } catch {}
  try { await ff.deleteFile(outFile); } catch {}
  return { b64, mime: "audio/mpeg", durationS: 0 };
}

export async function transcribeAudio(b64: string, mime: string, durationS?: number): Promise<TranscriptCue[]> {
  const { data, error } = await supabase.functions.invoke("transcribe-audio", {
    body: { audio: b64, mimeType: mime, durationS },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return (data?.cues ?? []) as TranscriptCue[];
}
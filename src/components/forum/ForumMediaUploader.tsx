import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ImagePlus, Loader2, X, Video as VideoIcon } from "lucide-react";
import {
  MAX_FORUM_ATTACHMENTS,
  uploadForumImage,
  uploadForumVideo,
  isVideoUrl,
} from "@/lib/forum";

interface Props {
  userId: string;
  attachments: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}

export default function ForumMediaUploader({ userId, attachments, onChange, disabled }: Props) {
  const imgRef = useRef<HTMLInputElement>(null);
  const vidRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const remaining = MAX_FORUM_ATTACHMENTS - attachments.length;

  async function handleFiles(files: FileList | null, kind: "image" | "video") {
    if (!files || files.length === 0) return;
    const list = Array.from(files).slice(0, remaining);
    if (files.length > remaining) {
      toast.warning(`You can attach up to ${MAX_FORUM_ATTACHMENTS} files.`);
    }
    setUploading(true);
    const uploaded: string[] = [];
    for (const f of list) {
      try {
        const url = kind === "image" ? await uploadForumImage(f, userId) : await uploadForumVideo(f, userId);
        uploaded.push(url);
      } catch (err: any) {
        toast.error(err?.message ?? `Failed to upload ${f.name}`);
      }
    }
    if (uploaded.length) onChange([...attachments, ...uploaded]);
    setUploading(false);
    if (imgRef.current) imgRef.current.value = "";
    if (vidRef.current) vidRef.current.value = "";
  }

  function remove(url: string) {
    onChange(attachments.filter((u) => u !== url));
  }

  return (
    <div className="space-y-2">
      {attachments.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
          {attachments.map((url) => {
            const video = isVideoUrl(url);
            return (
              <div key={url} className="relative group aspect-square rounded-md overflow-hidden border bg-muted">
                {video ? (
                  <div className="w-full h-full flex items-center justify-center bg-black text-white">
                    <video src={url} className="w-full h-full object-cover" muted playsInline preload="metadata" />
                    <VideoIcon className="w-6 h-6 absolute" />
                  </div>
                ) : (
                  <img src={url} alt="attachment preview" className="w-full h-full object-cover" loading="lazy" />
                )}
                <button
                  type="button"
                  onClick={() => remove(url)}
                  aria-label="Remove attachment"
                  className="absolute top-1 right-1 bg-background/90 text-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={imgRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files, "image")}
          disabled={disabled || uploading || remaining <= 0}
        />
        <input
          ref={vidRef}
          type="file"
          accept="video/mp4,video/webm,video/quicktime,video/ogg"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files, "video")}
          disabled={disabled || uploading || remaining <= 0}
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="gap-2"
          onClick={() => imgRef.current?.click()}
          disabled={disabled || uploading || remaining <= 0}
        >
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
          Images
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="gap-2"
          onClick={() => vidRef.current?.click()}
          disabled={disabled || uploading || remaining <= 0}
        >
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <VideoIcon className="w-4 h-4" />}
          Video
        </Button>
        <span className="text-xs text-muted-foreground">
          {attachments.length}/{MAX_FORUM_ATTACHMENTS} • images ≤ 8 MB • video ≤ 60 MB
        </span>
      </div>
    </div>
  );
}
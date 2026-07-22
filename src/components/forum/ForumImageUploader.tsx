import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ImagePlus, Loader2, X } from "lucide-react";
import { MAX_FORUM_ATTACHMENTS, uploadForumImage } from "@/lib/forum";

interface Props {
  userId: string;
  attachments: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}

export default function ForumImageUploader({ userId, attachments, onChange, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const remaining = MAX_FORUM_ATTACHMENTS - attachments.length;

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const list = Array.from(files).slice(0, remaining);
    if (files.length > remaining) {
      toast.warning(`You can attach up to ${MAX_FORUM_ATTACHMENTS} images.`);
    }
    setUploading(true);
    const uploaded: string[] = [];
    for (const f of list) {
      try {
        const url = await uploadForumImage(f, userId);
        uploaded.push(url);
      } catch (err: any) {
        toast.error(err?.message ?? `Failed to upload ${f.name}`);
      }
    }
    if (uploaded.length) onChange([...attachments, ...uploaded]);
    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  function remove(url: string) {
    onChange(attachments.filter((u) => u !== url));
  }

  return (
    <div className="space-y-2">
      {attachments.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
          {attachments.map((url) => (
            <div key={url} className="relative group aspect-square rounded-md overflow-hidden border bg-muted">
              <img src={url} alt="attachment preview" className="w-full h-full object-cover" loading="lazy" />
              <button
                type="button"
                onClick={() => remove(url)}
                aria-label="Remove image"
                className="absolute top-1 right-1 bg-background/90 text-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
          disabled={disabled || uploading || remaining <= 0}
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="gap-2"
          onClick={() => inputRef.current?.click()}
          disabled={disabled || uploading || remaining <= 0}
        >
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
          {uploading ? "Uploading…" : "Add images"}
        </Button>
        <span className="text-xs text-muted-foreground">
          {attachments.length}/{MAX_FORUM_ATTACHMENTS} • up to 8 MB each
        </span>
      </div>
    </div>
  );
}
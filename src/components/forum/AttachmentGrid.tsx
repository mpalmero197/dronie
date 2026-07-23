import { isVideoUrl } from "@/lib/forum";

interface Props {
  urls: string[];
  onOpenImage: (u: string) => void;
}

export default function AttachmentGrid({ urls, onOpenImage }: Props) {
  if (!urls?.length) return null;
  return (
    <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
      {urls.map((u) => {
        if (isVideoUrl(u)) {
          return (
            <div key={u} className="relative aspect-video rounded-md overflow-hidden border bg-black">
              <video
                src={u}
                controls
                playsInline
                preload="metadata"
                className="w-full h-full object-contain"
              />
            </div>
          );
        }
        return (
          <button
            key={u}
            type="button"
            onClick={() => onOpenImage(u)}
            className="relative aspect-square rounded-md overflow-hidden border bg-muted hover:opacity-90 transition"
          >
            <img src={u} alt="attachment" loading="lazy" className="w-full h-full object-cover" />
          </button>
        );
      })}
    </div>
  );
}
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { isSubscribed, subscribeThread, unsubscribeThread } from "@/lib/forum";
import { toast } from "sonner";

interface Props {
  threadId: string;
  userId: string | null | undefined;
  onRequireAuth?: () => void;
}

export default function SubscribeButton({ threadId, userId, onRequireAuth }: Props) {
  const [subbed, setSubbed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [initial, setInitial] = useState(true);

  useEffect(() => {
    if (!userId) { setInitial(false); return; }
    let cancel = false;
    isSubscribed(threadId, userId)
      .then((v) => { if (!cancel) setSubbed(v); })
      .finally(() => { if (!cancel) setInitial(false); });
    return () => { cancel = true; };
  }, [threadId, userId]);

  async function toggle() {
    if (!userId) { onRequireAuth?.(); return; }
    setLoading(true);
    try {
      if (subbed) {
        await unsubscribeThread(threadId, userId);
        setSubbed(false);
        toast.success("Unsubscribed — you won't be notified of new replies.");
      } else {
        await subscribeThread(threadId, userId);
        setSubbed(true);
        toast.success("Subscribed — you'll be notified of new replies.");
      }
    } catch (err: any) {
      toast.error(err?.message ?? "Failed");
    } finally { setLoading(false); }
  }

  return (
    <Button
      type="button"
      size="sm"
      variant={subbed ? "default" : "outline"}
      onClick={toggle}
      disabled={loading || initial}
      className="gap-2"
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : subbed ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
      {subbed ? "Subscribed" : "Subscribe"}
    </Button>
  );
}
import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

/**
 * WebRTC broadcast utilities for drone live feeds.
 * Uses Supabase Realtime broadcast as the signaling channel.
 *
 * Architecture:
 * - Pilot (broadcaster) calls startBroadcast() — captures media, waits for viewers, sends offers.
 * - Viewer calls joinBroadcast() — sends "hello", receives offer, replies with answer.
 * - One PeerConnection per viewer (broadcaster maintains a Map keyed by viewer peerId).
 */

const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

export type BroadcastSource = "camera" | "screen";

export interface BroadcastHandle {
  stop: () => void;
  stream: MediaStream;
  peerId: string;
}

export interface ViewerHandle {
  stop: () => void;
  peerId: string;
  onStream: (cb: (stream: MediaStream) => void) => void;
  onState: (cb: (state: RTCPeerConnectionState) => void) => void;
}

const channelName = (droneId: string) => `drone-stream:${droneId}`;
const newPeerId = () => `peer_${Math.random().toString(36).slice(2, 10)}`;

/** Broadcaster (pilot side) — captures media and serves any joining viewers. */
export async function startBroadcast(
  droneId: string,
  source: BroadcastSource = "camera",
): Promise<BroadcastHandle> {
  const peerId = newPeerId();

  // Capture media
  const stream =
    source === "screen"
      ? await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false })
      : await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 } },
          audio: false,
        });

  // Mark drone as broadcasting
  await supabase
    .from("drones")
    .update({ stream_mode: "webrtc", stream_url: null })
    .eq("id", droneId);

  const peers = new Map<string, RTCPeerConnection>();
  const channel = supabase.channel(channelName(droneId), {
    config: { broadcast: { self: false, ack: false } },
  });

  const send = (event: string, payload: Record<string, unknown>) => {
    channel.send({ type: "broadcast", event, payload: { ...payload, from: peerId } });
  };

  const createPeerFor = async (viewerPeerId: string) => {
    if (peers.has(viewerPeerId)) return;
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    peers.set(viewerPeerId, pc);

    stream.getTracks().forEach((t) => pc.addTrack(t, stream));

    pc.onicecandidate = (e) => {
      if (e.candidate) send("ice", { to: viewerPeerId, candidate: e.candidate.toJSON() });
    };
    pc.onconnectionstatechange = () => {
      if (["failed", "closed", "disconnected"].includes(pc.connectionState)) {
        pc.close();
        peers.delete(viewerPeerId);
      }
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    send("offer", { to: viewerPeerId, sdp: offer });
  };

  channel
    .on("broadcast", { event: "hello" }, ({ payload }) => {
      const from = (payload as any).from as string;
      if (from && from !== peerId) createPeerFor(from);
    })
    .on("broadcast", { event: "answer" }, async ({ payload }) => {
      const { from, sdp, to } = payload as any;
      if (to !== peerId) return;
      const pc = peers.get(from);
      if (pc && !pc.currentRemoteDescription) {
        await pc.setRemoteDescription(sdp);
      }
    })
    .on("broadcast", { event: "ice" }, async ({ payload }) => {
      const { from, candidate, to } = payload as any;
      if (to !== peerId) return;
      const pc = peers.get(from);
      if (pc && candidate) {
        try {
          await pc.addIceCandidate(candidate);
        } catch {
          /* ignore */
        }
      }
    })
    .subscribe((status) => {
      if (status === "SUBSCRIBED") {
        // Announce that broadcaster is online so any waiting viewers can hello us
        send("broadcaster-online", {});
      }
    });

  const stop = () => {
    send("bye", {});
    stream.getTracks().forEach((t) => t.stop());
    peers.forEach((pc) => pc.close());
    peers.clear();
    supabase.removeChannel(channel);
    supabase.from("drones").update({ stream_mode: "none" }).eq("id", droneId).then();
  };

  // Stop if user revokes / track ends
  stream.getVideoTracks()[0]?.addEventListener("ended", stop);

  return { stop, stream, peerId };
}

/** Viewer side — joins a broadcast and exposes the inbound MediaStream. */
export function joinBroadcast(droneId: string): ViewerHandle {
  const peerId = newPeerId();
  let pc: RTCPeerConnection | null = null;
  let streamCb: ((s: MediaStream) => void) | null = null;
  let stateCb: ((s: RTCPeerConnectionState) => void) | null = null;

  const channel = supabase.channel(channelName(droneId), {
    config: { broadcast: { self: false, ack: false } },
  });

  const send = (event: string, payload: Record<string, unknown>) => {
    channel.send({ type: "broadcast", event, payload: { ...payload, from: peerId } });
  };

  const ensurePeer = () => {
    if (pc) return pc;
    pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pc.ontrack = (e) => {
      if (streamCb && e.streams[0]) streamCb(e.streams[0]);
    };
    pc.onicecandidate = (e) => {
      if (e.candidate && broadcasterId) {
        send("ice", { to: broadcasterId, candidate: e.candidate.toJSON() });
      }
    };
    pc.onconnectionstatechange = () => {
      if (pc && stateCb) stateCb(pc.connectionState);
    };
    return pc;
  };

  let broadcasterId: string | null = null;

  channel
    .on("broadcast", { event: "broadcaster-online" }, ({ payload }) => {
      broadcasterId = (payload as any).from;
      send("hello", {});
    })
    .on("broadcast", { event: "offer" }, async ({ payload }) => {
      const { from, sdp, to } = payload as any;
      if (to !== peerId) return;
      broadcasterId = from;
      const peer = ensurePeer();
      await peer.setRemoteDescription(sdp);
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      send("answer", { to: from, sdp: answer });
    })
    .on("broadcast", { event: "ice" }, async ({ payload }) => {
      const { from, candidate, to } = payload as any;
      if (to !== peerId) return;
      const peer = ensurePeer();
      try {
        await peer.addIceCandidate(candidate);
      } catch {
        /* ignore */
      }
    })
    .on("broadcast", { event: "bye" }, () => {
      if (pc) pc.close();
      pc = null;
      if (stateCb) stateCb("closed");
    })
    .subscribe((status) => {
      if (status === "SUBSCRIBED") {
        // Say hello in case broadcaster is already online
        send("hello", {});
      }
    });

  return {
    peerId,
    onStream: (cb) => {
      streamCb = cb;
    },
    onState: (cb) => {
      stateCb = cb;
    },
    stop: () => {
      send("bye", {});
      if (pc) pc.close();
      pc = null;
      supabase.removeChannel(channel);
    },
  };
}

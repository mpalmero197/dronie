import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Body: { audio: base64, mimeType: string, durationS?: number }
 * Returns: { cues: [{ startS, endS, text }] }
 *
 * Uses Lovable AI Gateway (Gemini) with audio input via OpenAI-compatible
 * input_audio content part, asking the model to return timed cues via tool call.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { audio, mimeType, durationS } = await req.json();
    if (!audio) throw new Error("audio (base64) is required");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const audioFormat =
      (mimeType || "").includes("wav") ? "wav" :
      (mimeType || "").includes("mp3") ? "mp3" :
      (mimeType || "").includes("mp4") || (mimeType || "").includes("m4a") ? "mp3" :
      (mimeType || "").includes("webm") ? "webm" :
      (mimeType || "").includes("ogg") ? "ogg" : "mp3";

    const sys =
      "You are a precise audio transcriber. Transcribe the spoken English in the audio into short caption cues, " +
      "each 1–6 words and roughly 1.5–4 seconds long. Return only via the provided tool. Use accurate timings in seconds " +
      "from the start of the audio. Do not invent speech that is not in the audio.";

    const userText = durationS
      ? `The audio is approximately ${durationS.toFixed(1)} seconds long. Transcribe it.`
      : "Transcribe this audio.";

    const body = {
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: sys },
        {
          role: "user",
          content: [
            { type: "text", text: userText },
            { type: "input_audio", input_audio: { data: audio, format: audioFormat } },
          ],
        },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "submit_captions",
            description: "Return the transcript as timed caption cues.",
            parameters: {
              type: "object",
              properties: {
                cues: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      startS: { type: "number" },
                      endS: { type: "number" },
                      text: { type: "string" },
                    },
                    required: ["startS", "endS", "text"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["cues"],
              additionalProperties: false,
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "submit_captions" } },
    };

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      if (resp.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limits exceeded, please try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (resp.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Add funds to your Lovable workspace." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await resp.text();
      console.error("AI gateway error", resp.status, t);
      return new Response(JSON.stringify({ error: "Transcription failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();
    const call = data?.choices?.[0]?.message?.tool_calls?.[0];
    let cues: Array<{ startS: number; endS: number; text: string }> = [];
    if (call?.function?.arguments) {
      try {
        const parsed = JSON.parse(call.function.arguments);
        if (Array.isArray(parsed.cues)) cues = parsed.cues;
      } catch (e) {
        console.warn("Could not parse tool args", e);
      }
    }

    return new Response(JSON.stringify({ cues }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("transcribe error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
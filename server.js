require("dotenv").config();

const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const MODEL = process.env.OPENROUTER_MODEL || "anthropic/claude-3.5-sonnet";

// ── Startup checks ──────────────────────────────────────────────────────────
if (!process.env.OPENROUTER_API_KEY) {
  console.error("\n❌  OPENROUTER_API_KEY is not set in your .env file.");
  console.error("    Create a .env file in this folder with:\n");
  console.error("    OPENROUTER_API_KEY=sk-or-xxxxxxxxxxxxxxxxxxxx\n");
} else {
  console.log("✅  API key loaded. Model:", MODEL);
}

app.use(express.json({ limit: "1mb" }));
app.use(express.static(__dirname));

function extractJson(text) {
  if (!text || typeof text !== "string") return null;

  // Strip opening fence even if closing fence is missing (handles truncated responses)
  const fenceOpen = text.match(/^```(?:json)?\s*/i);
  const candidate = fenceOpen
    ? text.slice(fenceOpen[0].length).replace(/```\s*$/i, "")
    : text;

  // Try direct parse first
  try { return JSON.parse(candidate); } catch (_) {}

  // Find outermost { } and parse that slice
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try { return JSON.parse(candidate.slice(start, end + 1)); } catch (_) {}

  return null;
}

function validateWebsitePayload(payload) {
  if (!payload || typeof payload !== "object") return false;
  if (typeof payload.html !== "string" || payload.html.trim().length < 80) return false;
  if (typeof payload.css !== "string" || payload.css.trim().length < 80) return false;
  if (!Array.isArray(payload.sections) || payload.sections.length < 3) return false;
  return payload.sections.every((section) => {
    return section && typeof section.id === "string" && typeof section.label === "string";
  });
}

app.post("/api/generate", async (req, res) => {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const { prompt, template = "Portfolio", palette = "Electric Cyan" } = req.body || {};

  if (!apiKey) {
    return res.status(500).json({
      error: "Missing API key — add OPENROUTER_API_KEY to your .env file and restart the server."
    });
  }

  if (!prompt || typeof prompt !== "string" || prompt.trim().length < 8) {
    return res.status(400).json({
      error: "Invalid prompt. Describe the website you want in at least a short sentence."
    });
  }

  const systemPrompt = `You are an elite creative web designer and frontend engineer.
Generate a complete single-page website as JSON only. Do not use markdown.

Return exactly this JSON shape:
{
  "title": "Website title",
  "sections": [
    { "id": "hero", "label": "Hero" }
  ],
  "html": "<main>...</main>",
  "css": ":root{...}"
}

Rules:
- HTML must be body content only, no html/head/body/script tags.
- Every major section must be a <section> with a unique id matching sections[].id and data-section-label.
- Include semantic headings, paragraphs, buttons/links, lists, project cards, and contact/CTA content.
- Generated text must be meaningful and specific to the user's exact prompt.
- Use classes generously so CSS can create a premium custom visual direction.
- CSS must be complete, responsive, and scoped to the generated page.
- Include CSS animations, hover effects, scroll-reveal classes, atmospheric backgrounds, and CSS-only 3D or device/project-card elements.
- Avoid generic placeholder copy, overused purple gradients, bland white cards, empty sections, and low contrast.
- Prefer distinctive palettes. For portfolio prompts, use a cinematic premium dark style unless the user asks otherwise.
- No external images, fonts, scripts, CDNs, or remote assets. Use CSS shapes, gradients, patterns, emoji-free text, and layout craft.
- Do not include comments explaining the output.
- Write concise but meaningful copy — avoid padding text to fill space.
- Keep CSS efficient: use shorthand properties, avoid redundant rules.
- Aim to complete the full JSON within 10000 tokens. Do not truncate.`;

  const userContent = `Exact user prompt: ${prompt}

Template/category selected by user: ${template}
Accent palette selected by user: ${palette}

Use the template/category and palette as helpful design context, but the exact user prompt is the source of truth.`;

  // Set up SSE so the client gets progress immediately
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const sendEvent = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    console.log(`→ Generating (stream) | template:${template} | palette:${palette}`);

    const upstream = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "AI Website Builder"
      },
      body: JSON.stringify({
        model: MODEL,
        stream: true,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent }
        ],
        temperature: 0.82,
        max_tokens: 14000
      })
    });

    if (!upstream.ok) {
      const rawDetail = await upstream.text();
      console.error(`✗ OpenRouter HTTP ${upstream.status}:`, rawDetail);

      let friendlyError = `OpenRouter returned HTTP ${upstream.status}.`;
      try {
        const errJson = JSON.parse(rawDetail);
        const msg = errJson?.error?.message || errJson?.message;
        if (msg) friendlyError = msg;
      } catch (_) {}

      if (upstream.status === 401) friendlyError = "Invalid API key — check OPENROUTER_API_KEY in your .env file.";
      if (upstream.status === 402) friendlyError = "OpenRouter account has no credits. Add credits at openrouter.ai.";
      if (upstream.status === 429) friendlyError = "Rate limit hit. Wait a moment and try again.";

      sendEvent("error", { error: friendlyError, httpStatus: upstream.status });
      return res.end();
    }

    // Stream SSE chunks from OpenRouter to the client as progress pings,
    // while accumulating the full content string for final parsing.
    let accumulated = "";
    let chunkCount = 0;
    const decoder = new TextDecoder();

    for await (const chunk of upstream.body) {
      const text = decoder.decode(chunk, { stream: true });
      const lines = text.split("\n");

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const payload = line.slice(6).trim();
        if (payload === "[DONE]") continue;

        try {
          const parsed = JSON.parse(payload);
          const delta = parsed?.choices?.[0]?.delta?.content;
          if (delta) {
            accumulated += delta;
            chunkCount++;
            // Send a heartbeat every 20 chunks so the UI can show progress
            if (chunkCount % 20 === 0) {
              sendEvent("progress", { chars: accumulated.length });
            }
          }
        } catch (_) {
          // Malformed SSE chunk — skip
        }
      }
    }

    if (!accumulated) {
      sendEvent("error", { error: "Model returned an empty response. Try regenerating." });
      return res.end();
    }

    const generated = extractJson(accumulated);

    if (!validateWebsitePayload(generated)) {
      console.error("✗ Validation failed. Content preview:", accumulated.slice(0, 300));
      sendEvent("error", { error: "AI response was incomplete — try regenerating (usually works on the second attempt)." });
      return res.end();
    }

    console.log(`✓ Generated: "${generated.title}" (${generated.sections.length} sections)`);

    sendEvent("done", {
      title: generated.title || "Generated Website",
      sections: generated.sections,
      html: generated.html,
      css: generated.css,
      model: MODEL
    });

    res.end();

  } catch (error) {
    console.error("✗ Fetch error:", error.message);

    let msg = "Could not reach OpenRouter. Check your internet connection.";
    if (error.message.includes("ENOTFOUND") || error.message.includes("getaddrinfo"))
      msg = "DNS error — cannot reach openrouter.ai. Check your internet connection.";
    else if (error.message.includes("ECONNREFUSED"))
      msg = "Connection refused to openrouter.ai. Check your network or firewall.";
    else if (error.message.includes("timeout") || error.message.includes("ETIMEDOUT"))
      msg = "Request timed out. OpenRouter may be slow — try again.";

    sendEvent("error", { error: msg, detail: error.message });
    res.end();
  }
});

app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(PORT, () => {
  console.log(`\n🚀  AI Website Builder running at http://localhost:${PORT}\n`);
});
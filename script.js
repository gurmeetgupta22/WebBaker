const state = {
  prompt: "",
  template: "Portfolio",
  palette: {
    name: "Electric Cyan",
    accent: "#38e8ff",
    accent2: "#ffcb47"
  },
  generated: null,
  draggedSectionId: null
};

const els = {
  promptInput: document.querySelector("#promptInput"),
  generateBtn: document.querySelector("#generateBtn"),
  regenerateBtn: document.querySelector("#regenerateBtn"),
  exportBtn: document.querySelector("#exportBtn"),
  templateGrid: document.querySelector("#templateGrid"),
  paletteGrid: document.querySelector("#paletteGrid"),
  sectionList: document.querySelector("#sectionList"),
  previewFrame: document.querySelector("#previewFrame"),
  previewFrameWrap: document.querySelector("#previewFrameWrap"),
  emptyState: document.querySelector("#emptyState"),
  loadingState: document.querySelector("#loadingState"),
  previewTitle: document.querySelector("#previewTitle"),
  viewportTabs: document.querySelector("#viewportTabs"),
  themeToggle: document.querySelector("#themeToggle"),
  samplePrompt: document.querySelector("#samplePrompt"),
  toast: document.querySelector("#toast")
};

const samplePrompts = {
  Portfolio: "Portfolio website for a creative developer who builds cinematic web experiences, with personality-rich about copy, services, 3 detailed case studies, tech stack, and a bold availability section.",
  SaaS: "Landing page for an AI operations SaaS that helps founders automate research, reporting, and customer workflows with premium dashboard visuals and enterprise trust.",
  Restaurant: "Restaurant website for a modern coastal bistro with animated menu sections, chef story, reservation CTA, private dining, and a warm editorial visual style.",
  Agency: "Website for a boutique brand and web agency that creates launch systems for startups, with case studies, process, services, and a confident contact section.",
  Event: "Conference website for a future design and AI summit with speakers, schedule, venue details, sponsors, and high-energy motion.",
  Product: "Product page for a modular desk lamp for creators, with feature storytelling, materials, use cases, reviews, and a cinematic purchase CTA."
};

function showToast(message, isError = false) {
  els.toast.textContent = message;
  els.toast.style.borderColor = isError ? "rgba(255, 107, 107, 0.55)" : "rgba(255,255,255,0.12)";
  els.toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => els.toast.classList.remove("show"), 3600);
}

function setLoading(isLoading) {
  els.generateBtn.disabled = isLoading;
  els.regenerateBtn.disabled = isLoading || !state.generated;
  els.exportBtn.disabled = isLoading || !state.generated;
  els.loadingState.classList.toggle("hidden", !isLoading);
  if (isLoading) els.emptyState.classList.add("hidden");
}

function getAnimationScript() {
  return `
    <script>
      const revealItems = document.querySelectorAll('section, .reveal, .card, .project-card, .case-card');
      revealItems.forEach((item) => item.classList.add('reveal-ready'));
      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add('reveal-in');
        });
      }, { threshold: 0.14 });
      revealItems.forEach((item) => observer.observe(item));
      document.addEventListener('pointermove', (event) => {
        document.documentElement.style.setProperty('--cursor-x', event.clientX + 'px');
        document.documentElement.style.setProperty('--cursor-y', event.clientY + 'px');
      });
    <\/script>`;
}

function getBaseGeneratedCss(editable = true) {
  return `
    :root {
      --builder-accent: ${state.palette.accent};
      --builder-accent-2: ${state.palette.accent2};
      --accent: ${state.palette.accent};
      --accent-2: ${state.palette.accent2};
      --primary: ${state.palette.accent};
      --secondary: ${state.palette.accent2};
      --cursor-x: 50vw;
      --cursor-y: 20vh;
    }

    ${editable ? `
    [contenteditable="true"] {
      outline: 1px dashed transparent;
      outline-offset: 4px;
      transition: outline-color 0.18s ease, background 0.18s ease;
      border-radius: 4px;
    }

    [contenteditable="true"]:hover,
    [contenteditable="true"]:focus {
      outline-color: var(--builder-accent);
      background: color-mix(in srgb, var(--builder-accent) 13%, transparent);
    }
    ` : ""}

    .reveal-ready {
      opacity: 0;
      transform: translateY(22px);
      transition: opacity 0.7s ease, transform 0.7s ease;
    }

    .reveal-in {
      opacity: 1;
      transform: translateY(0);
    }
  `;
}

function buildDocument(html, css, editable = true) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(state.generated?.title || "Generated Website")}</title>
  <style>
    ${css}
    ${getBaseGeneratedCss(editable)}
  </style>
</head>
<body>
  ${html}
  ${getAnimationScript()}
</body>
</html>`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function injectEditableAttributes() {
  const doc = els.previewFrame.contentDocument;
  if (!doc) return;
  const editableSelector = "h1,h2,h3,h4,h5,h6,p,a,button,span,li,blockquote,figcaption,label";
  doc.querySelectorAll(editableSelector).forEach((node) => {
    if (!node.textContent.trim() || node.closest("script,style")) return;
    node.setAttribute("contenteditable", "true");
    node.setAttribute("data-editable", "true");
  });

  doc.addEventListener("input", syncGeneratedFromFrame);
}

function syncGeneratedFromFrame() {
  const doc = els.previewFrame.contentDocument;
  if (!doc || !state.generated) return;
  const clonedBody = doc.body.cloneNode(true);
  clonedBody.querySelectorAll("script").forEach((node) => node.remove());
  state.generated.html = cleanBuilderAttributes(clonedBody.innerHTML);
}

function cleanBuilderAttributes(html) {
  const template = document.createElement("template");
  template.innerHTML = html;
  template.content.querySelectorAll("[contenteditable], [data-editable]").forEach((node) => {
    node.removeAttribute("contenteditable");
    node.removeAttribute("data-editable");
  });
  template.content.querySelectorAll(".reveal-ready, .reveal-in").forEach((node) => {
    node.classList.remove("reveal-ready", "reveal-in");
    if (!node.getAttribute("class")) node.removeAttribute("class");
  });
  return template.innerHTML.trim();
}

function renderPreview() {
  if (!state.generated) return;

  document.documentElement.style.setProperty("--accent", state.palette.accent);
  document.documentElement.style.setProperty("--accent-2", state.palette.accent2);
  els.previewTitle.textContent = state.generated.title || "Generated website";
  els.emptyState.classList.add("hidden");
  els.previewFrameWrap.classList.add("has-preview");
  els.previewFrame.srcdoc = buildDocument(state.generated.html, state.generated.css, true);
  els.previewFrame.addEventListener("load", injectEditableAttributes, { once: true });
  els.exportBtn.disabled = false;
  els.regenerateBtn.disabled = false;
  renderSectionList();
}

function renderSectionList() {
  if (!state.generated?.sections?.length) {
    els.sectionList.innerHTML = '<li class="muted-item">Generate a website to edit sections.</li>';
    return;
  }

  els.sectionList.innerHTML = state.generated.sections.map((section) => `
    <li draggable="true" data-id="${escapeHtml(section.id)}">
      <span class="drag-handle">::</span>
      <span>${escapeHtml(section.label)}</span>
    </li>
  `).join("");
}

async function generateWebsite() {
  const prompt = els.promptInput.value;
  if (prompt.trim().length < 8) {
    showToast("Add a more specific website prompt first.", true);
    els.promptInput.focus();
    return;
  }

  state.prompt = prompt;
  setLoading(true);

  const loadingMsg = els.loadingState.querySelector("p");
  const originalMsg = loadingMsg ? loadingMsg.textContent : "";

  try {
    const response = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        template: state.template,
        palette: state.palette.name
      })
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      const msg = data.error || "Generation failed.";
      const detail = data.detail ? ` (${data.detail})` : "";
      throw new Error(msg + detail);
    }

    // Parse the SSE stream
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    const parseEvents = (chunk) => {
      buffer += chunk;
      const events = [];
      const parts = buffer.split("\n\n");
      buffer = parts.pop();
      for (const part of parts) {
        const eventMatch = part.match(/^event: (\w+)/m);
        const dataMatch = part.match(/^data: (.+)/m);
        if (eventMatch && dataMatch) {
          try { events.push({ event: eventMatch[1], data: JSON.parse(dataMatch[1]) }); }
          catch (_) {}
        }
      }
      return events;
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      for (const { event, data } of parseEvents(decoder.decode(value, { stream: true }))) {
        if (event === "progress") {
          if (loadingMsg) loadingMsg.textContent = `Writing code... ${data.chars.toLocaleString()} characters`;
        } else if (event === "done") {
          state.generated = { title: data.title, html: data.html, css: data.css, sections: data.sections };
          renderPreview();
          showToast(`Generated with ${data.model || "OpenRouter"}.`);
        } else if (event === "error") {
          const msg = data.error || "Generation failed.";
          const detail = data.detail ? ` (${data.detail})` : "";
          throw new Error(msg + detail);
        }
      }
    }

  } catch (error) {
    els.emptyState.classList.toggle("hidden", Boolean(state.generated));
    showToast(error.message, true);
  } finally {
    if (loadingMsg) loadingMsg.textContent = originalMsg;
    setLoading(false);
  }
}

function reorderPreviewSections() {
  if (!state.generated) return;
  syncGeneratedFromFrame();
  const template = document.createElement("template");
  template.innerHTML = state.generated.html;
  const sections = new Map();
  template.content.querySelectorAll("section[id]").forEach((section) => {
    sections.set(section.id, section);
  });

  const ordered = [];
  state.generated.sections.forEach((sectionInfo) => {
    const section = sections.get(sectionInfo.id);
    if (section) {
      ordered.push(section);
      sections.delete(sectionInfo.id);
    }
  });

  sections.forEach((section) => ordered.push(section));
  const main = template.content.querySelector("main");
  const parent = main || template.content;
  ordered.forEach((section) => parent.appendChild(section));
  state.generated.html = template.innerHTML.trim();
  renderPreview();
}

function exportCode() {
  if (!state.generated) return;
  syncGeneratedFromFrame();
  const cleanHtml = cleanBuilderAttributes(state.generated.html);
  const file = buildDocument(cleanHtml, state.generated.css, false)
    .replaceAll(' contenteditable="true"', "")
    .replaceAll(' data-editable="true"', "");
  const blob = new Blob([file], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${(state.generated.title || "generated-website").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}.html`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showToast("Exported standalone HTML file.");
}

els.generateBtn.addEventListener("click", generateWebsite);
els.regenerateBtn.addEventListener("click", generateWebsite);
els.exportBtn.addEventListener("click", exportCode);

els.samplePrompt.addEventListener("click", () => {
  els.promptInput.value = samplePrompts[state.template] || samplePrompts.Portfolio;
  els.promptInput.focus();
});

els.templateGrid.addEventListener("click", (event) => {
  const button = event.target.closest("[data-template]");
  if (!button) return;
  state.template = button.dataset.template;
  document.querySelectorAll(".template-pill").forEach((item) => item.classList.toggle("active", item === button));
});

els.paletteGrid.addEventListener("click", (event) => {
  const button = event.target.closest(".palette");
  if (!button) return;
  state.palette = {
    name: button.dataset.name,
    accent: button.dataset.accent,
    accent2: button.dataset.accent2
  };
  document.querySelectorAll(".palette").forEach((item) => item.classList.toggle("active", item === button));
  document.documentElement.style.setProperty("--accent", state.palette.accent);
  document.documentElement.style.setProperty("--accent-2", state.palette.accent2);
  if (state.generated) renderPreview();
});

els.viewportTabs.addEventListener("click", (event) => {
  const button = event.target.closest("[data-size]");
  if (!button) return;
  document.querySelectorAll("#viewportTabs button").forEach((item) => item.classList.toggle("active", item === button));
  els.previewFrameWrap.classList.remove("desktop", "tablet", "mobile");
  els.previewFrameWrap.classList.add(button.dataset.size);
});

els.themeToggle.addEventListener("click", () => {
  document.documentElement.classList.toggle("light");
});

els.sectionList.addEventListener("dragstart", (event) => {
  const item = event.target.closest("li[data-id]");
  if (!item) return;
  state.draggedSectionId = item.dataset.id;
  item.classList.add("dragging");
});

els.sectionList.addEventListener("dragend", (event) => {
  event.target.closest("li")?.classList.remove("dragging");
  state.draggedSectionId = null;
});

els.sectionList.addEventListener("dragover", (event) => {
  event.preventDefault();
  const over = event.target.closest("li[data-id]");
  if (!over || !state.draggedSectionId || over.dataset.id === state.draggedSectionId) return;
  const dragged = els.sectionList.querySelector(`[data-id="${CSS.escape(state.draggedSectionId)}"]`);
  const items = [...els.sectionList.querySelectorAll("li[data-id]")];
  const overIndex = items.indexOf(over);
  const draggedIndex = items.indexOf(dragged);
  if (draggedIndex < overIndex) over.after(dragged);
  else over.before(dragged);
});

els.sectionList.addEventListener("drop", () => {
  if (!state.generated) return;
  const order = [...els.sectionList.querySelectorAll("li[data-id]")].map((item) => item.dataset.id);
  state.generated.sections.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
  reorderPreviewSections();
});

els.promptInput.value = samplePrompts.Portfolio;
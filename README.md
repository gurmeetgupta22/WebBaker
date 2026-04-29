# WebBaker

A polished mini no-code AI website builder. Type a website idea, choose a category and accent palette, generate a complete single-page website through a Node backend using OpenRouter, edit the preview inline, reorder sections, and export standalone HTML.

## Features

- Split-screen SaaS builder UI
- Prompt textarea with template/category context
- Backend-only OpenRouter API key handling
- `POST /api/generate` generation route
- Live iframe preview with desktop, tablet, and mobile widths
- Click-to-edit generated headings, paragraphs, buttons, labels, and list text
- Drag-and-drop section reordering
- Accent palette customization
- Light/dark builder theme toggle
- Standalone HTML export with CSS and small animation script
- Clear errors for missing API key, invalid prompt, API failures, and invalid model responses

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create your environment file:

   ```bash
   copy .env.example .env
   ```

3. Add your OpenRouter key to `.env`:

   ```env
   OPENROUTER_API_KEY=your_openrouter_api_key_here
   OPENROUTER_MODEL=deepseek/deepseek-chat
   PORT=3000
   ```

4. Start the app:

   ```bash
   npm start
   ```

5. Open:

   ```text
   http://localhost:3000
   ```

## Security

The frontend never calls OpenRouter and never sees `OPENROUTER_API_KEY`. The browser sends the exact textarea prompt to the local backend. The backend reads the key from `.env`, sends the request to OpenRouter, and returns only the generated website payload.

## API

### `POST /api/generate`

Request body:

```json
{
  "prompt": "portfolio website for a creative developer",
  "template": "Portfolio",
  "palette": "Electric Cyan"
}
```

Response body:

```json
{
  "title": "Generated Website Title",
  "sections": [{ "id": "hero", "label": "Hero" }],
  "html": "<main>...</main>",
  "css": ":root{...}",
  "model": "model-name"
}
```

## Notes

Template buttons provide design context only. They do not replace the text typed by the user. The prompt in the textarea is sent to the backend exactly as entered.

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

async function parseResponse(response, fallbackMessage) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.detail || fallbackMessage);
  }
  return payload;
}

export async function fetchTemplates() {
  const response = await fetch(`${API_BASE_URL}/api/templates`);
  return parseResponse(response, "Could not load templates.");
}

export async function uploadTemplateFile(file) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_BASE_URL}/api/template/upload`, {
    method: "POST",
    body: formData
  });
  return parseResponse(response, "Could not read your template file. Check the format.");
}

export async function transcribeAudio({ audioFile, templateId, template, language }) {
  const formData = new FormData();
  formData.append("audio", audioFile);
  formData.append("language", language);

  if (template && !templateId) {
    formData.append("template", JSON.stringify(template));
  } else if (templateId) {
    formData.append("template_id", templateId);
  }

  const response = await fetch(`${API_BASE_URL}/api/transcribe`, {
    method: "POST",
    body: formData
  });
  return parseResponse(response, "Could not transcribe audio. Please try again.");
}

export async function submitRecord({ templateId, template, fields, language, accessToken, targetSheetUrl }) {
  const response = await fetch(`${API_BASE_URL}/api/submit`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      template_id: templateId,
      template: templateId ? null : template,
      fields,
      language,
      access_token: accessToken,
      target_sheet_url: targetSheetUrl
    })
  });
  return parseResponse(response, "Could not save record. Contact support.");
}

export function getSheetsUrl() {
  return import.meta.env.VITE_SHEETS_URL || "";
}

export async function saveToken(token) {
  const response = await fetch(`${API_BASE_URL}/api/auth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token })
  });
  return parseResponse(response, "Could not save token.");
}

export async function fetchToken() {
  const response = await fetch(`${API_BASE_URL}/api/auth/token`);
  if (!response.ok) return null;
  return parseResponse(response, "Could not fetch token.");
}

export async function saveCustomTemplateApi(template) {
  const response = await fetch(`${API_BASE_URL}/api/templates/custom`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(template)
  });
  return parseResponse(response, "Could not save custom template.");
}

export async function deleteCustomTemplateApi(templateId) {
  const response = await fetch(`${API_BASE_URL}/api/templates/custom/${templateId}`, {
    method: "DELETE"
  });
  return parseResponse(response, "Could not delete custom template.");
}


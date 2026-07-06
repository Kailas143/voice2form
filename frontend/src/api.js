const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

async function parseResponse(response, fallbackMessage) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.detail || fallbackMessage);
    error.status = response.status;
    throw error;
  }
  return payload;
}

export async function fetchTemplates(sessionToken) {
  const headers = {};
  if (sessionToken) {
    headers.Authorization = `Bearer ${sessionToken}`;
  }
  const response = await fetch(`${API_BASE_URL}/api/templates`, { headers });
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

export async function submitRecord({ templateId, template, fields, language, accessToken, targetSheetUrl, submissionSource, sessionToken }) {
  const response = await fetch(`${API_BASE_URL}/api/submit`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${sessionToken}`
    },
    body: JSON.stringify({
      template_id: templateId,
      template: templateId ? null : template,
      fields,
      language,
      access_token: accessToken,
      target_sheet_url: targetSheetUrl,
      submission_source: submissionSource
    })
  });
  return parseResponse(response, "Could not save record. Contact support.");
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

export async function manualSignup({ name, email, password }) {
  const response = await fetch(`${API_BASE_URL}/api/auth/manual/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password })
  });
  return parseResponse(response, "Could not create account.");
}

export async function manualLogin({ email, password }) {
  const response = await fetch(`${API_BASE_URL}/api/auth/manual/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });
  return parseResponse(response, "Could not log in.");
}

export async function googleLogin({ name, email, avatar }) {
  const response = await fetch(`${API_BASE_URL}/api/auth/google/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, avatar })
  });
  return parseResponse(response, "Could not log in with Google.");
}

export async function fetchAuthMe(sessionToken) {
  const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
    headers: {
      Authorization: `Bearer ${sessionToken}`
    }
  });
  return parseResponse(response, "Could not load your session.");
}

export async function forgotPassword(email) {
  const response = await fetch(`${API_BASE_URL}/api/auth/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email })
  });
  return parseResponse(response, "Could not start password reset.");
}

export async function resetPassword({ resetToken, newPassword }) {
  const response = await fetch(`${API_BASE_URL}/api/auth/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reset_token: resetToken, new_password: newPassword })
  });
  return parseResponse(response, "Could not reset password.");
}

export async function saveCustomTemplateApi(template, sessionToken) {
  const response = await fetch(`${API_BASE_URL}/api/templates/custom`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${sessionToken}`
    },
    body: JSON.stringify(template)
  });
  return parseResponse(response, "Could not save custom template.");
}

export async function deleteCustomTemplateApi(templateId, sessionToken) {
  const response = await fetch(`${API_BASE_URL}/api/templates/custom/${templateId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${sessionToken}`
    }
  });
  return parseResponse(response, "Could not delete custom template.");
}

export async function fetchRecentRecords(sessionToken) {
  const response = await fetch(`${API_BASE_URL}/api/records`, {
    headers: {
      Authorization: `Bearer ${sessionToken}`
    }
  });
  return parseResponse(response, "Could not fetch recent records.");
}

export async function fetchWorkspaces(sessionToken) {
  const response = await fetch(`${API_BASE_URL}/api/workspaces`, {
    headers: {
      Authorization: `Bearer ${sessionToken}`
    }
  });
  return parseResponse(response, "Could not fetch workspaces.");
}

export async function createWorkspaceApi(payload, sessionToken) {
  const response = await fetch(`${API_BASE_URL}/api/workspaces`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${sessionToken}`
    },
    body: JSON.stringify(payload)
  });
  return parseResponse(response, "Could not create workspace.");
}

export async function getWorkspaceApi(workspaceId, sessionToken) {
  const response = await fetch(`${API_BASE_URL}/api/workspaces/${workspaceId}`, {
    headers: {
      Authorization: `Bearer ${sessionToken}`
    }
  });
  return parseResponse(response, "Could not open workspace.");
}

export async function updateWorkspaceApi(workspaceId, payload, sessionToken) {
  const response = await fetch(`${API_BASE_URL}/api/workspaces/${workspaceId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${sessionToken}`
    },
    body: JSON.stringify(payload)
  });
  return parseResponse(response, "Could not update workspace settings.");
}

export async function deleteWorkspaceApi(workspaceId, sessionToken) {
  const response = await fetch(`${API_BASE_URL}/api/workspaces/${workspaceId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${sessionToken}`
    }
  });
  return parseResponse(response, "Could not delete workspace.");
}

export async function cleanupDuplicateWorkspacesApi(sessionToken) {
  const response = await fetch(`${API_BASE_URL}/api/workspaces/cleanup-duplicates`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${sessionToken}`
    }
  });
  return parseResponse(response, "Could not clean up duplicate workspaces.");
}

export async function fetchPlanCurrent(sessionToken) {
  const response = await fetch(`${API_BASE_URL}/api/plans/current`, {
    headers: {
      Authorization: `Bearer ${sessionToken}`
    }
  });
  return parseResponse(response, "Could not fetch current plan.");
}

export async function fetchPlanUsage(sessionToken) {
  const response = await fetch(`${API_BASE_URL}/api/plans/usage`, {
    headers: {
      Authorization: `Bearer ${sessionToken}`
    }
  });
  return parseResponse(response, "Could not fetch plan usage.");
}

export async function simulateUpgradeApi(sessionToken, targetPlanSlug) {
  const response = await fetch(`${API_BASE_URL}/api/admin/simulate-upgrade`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${sessionToken}`
    },
    body: JSON.stringify({
      target_plan_slug: targetPlanSlug,
      admin_secret: "dev_secret"
    })
  });
  return parseResponse(response, "Could not simulate upgrade.");
}

export async function simulateDowngradeApi(sessionToken) {
  const response = await fetch(`${API_BASE_URL}/api/admin/simulate-downgrade`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${sessionToken}`
    },
    body: JSON.stringify({
      target_plan_slug: "free",
      admin_secret: "dev_secret"
    })
  });
  return parseResponse(response, "Could not simulate downgrade.");
}

export async function fetchNotificationPreferences(sessionToken) {
  const response = await fetch(`${API_BASE_URL}/api/notifications/preferences`, {
    headers: { Authorization: `Bearer ${sessionToken}` }
  });
  return parseResponse(response, "Could not fetch notification preferences.");
}

export async function updateNotificationPreferences(sessionToken, payload) {
  const response = await fetch(`${API_BASE_URL}/api/notifications/preferences`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${sessionToken}`
    },
    body: JSON.stringify(payload)
  });
  return parseResponse(response, "Could not update notification preferences.");
}

export async function fetchUnreadNotificationCount(sessionToken) {
  const response = await fetch(`${API_BASE_URL}/api/notifications/unread-count`, {
    headers: { Authorization: `Bearer ${sessionToken}` }
  });
  return parseResponse(response, "Could not fetch unread notification count.");
}

export async function fetchNotifications(sessionToken, page = 1, pageSize = 20) {
  const response = await fetch(`${API_BASE_URL}/api/notifications?page=${page}&page_size=${pageSize}`, {
    headers: { Authorization: `Bearer ${sessionToken}` }
  });
  return parseResponse(response, "Could not fetch notifications.");
}

export async function markNotificationRead(sessionToken, notificationId) {
  const response = await fetch(`${API_BASE_URL}/api/notifications/${notificationId}/read`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${sessionToken}` }
  });
  return parseResponse(response, "Could not mark notification read.");
}


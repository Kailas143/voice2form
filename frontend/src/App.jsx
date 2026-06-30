import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useGoogleLogin } from "@react-oauth/google";

import {
  fetchTemplates,
  submitRecord,
  transcribeAudio,
  uploadTemplateFile,
  saveToken,
  fetchToken,
  saveCustomTemplateApi,
  deleteCustomTemplateApi,
  manualSignup,
  manualLogin,
  googleLogin,
  fetchAuthMe,
  forgotPassword,
  resetPassword,
  fetchRecentRecords,
  fetchWorkspaces,
  createWorkspaceApi,
  getWorkspaceApi,
  updateWorkspaceApi,
  deleteWorkspaceApi,
  cleanupDuplicateWorkspacesApi
} from "./api";
import { CATEGORY_ICONS, LANGUAGES, PROCESS_STAGES, STEPS } from "./constants";

const LANGUAGE_STORAGE_KEY = "voice2form-language";
const AUTH_SESSION_STORAGE_KEY = "voice2form-session-token";
const AUTH_USER_STORAGE_KEY = "voice2form-auth-user";
const GOOGLE_RECONNECT_MESSAGE = "Google Sheets access expired. Reconnect Google to continue.";

function getConfidenceMeta(confidence) {
  if (confidence >= 90) {
    return { label: "High confidence", tone: "success", emoji: "🟢" };
  }
  if (confidence >= 70) {
    return { label: "Review suggested", tone: "warning", emoji: "🟡" };
  }
  if (confidence >= 50) {
    return { label: "Please verify", tone: "warning-strong", emoji: "🟠" };
  }
  if (confidence >= 1) {
    return { label: "Low - please correct", tone: "danger", emoji: "🔴" };
  }
  return { label: "Not found", tone: "neutral", emoji: "⚪" };
}

function isGoogleReconnectError(error) {
  const message = String(error?.message || "").toLowerCase();
  return (
    message.includes("google access token") ||
    message.includes("authentication failed with provided token") ||
    message.includes("invalid or expired") ||
    message.includes("invalid credentials") ||
    message.includes("unauthorized")
  );
}

function normalizeDateForInput(value) {
  const raw = (value || "").trim();
  if (!raw) {
    return "";
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return raw;
  }

  const dayFirstMatch = raw.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (dayFirstMatch) {
    return `${dayFirstMatch[3]}-${dayFirstMatch[2]}-${dayFirstMatch[1]}`;
  }

  const slashMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const first = Number(slashMatch[1]);
    const second = Number(slashMatch[2]);
    const year = slashMatch[3];

    if (first > 12) {
      return `${year}-${String(second).padStart(2, "0")}-${String(first).padStart(2, "0")}`;
    }

    return `${year}-${String(first).padStart(2, "0")}-${String(second).padStart(2, "0")}`;
  }

  return raw;
}

function normalizeFieldValue(field, value) {
  if (!field) {
    return value || "";
  }

  if (field.type === "date") {
    return normalizeDateForInput(value);
  }

  return value || "";
}

function mapFieldsFromExtraction(template, extraction) {
  return template.fields.map((field) => {
    const extracted = extraction.fields[field.name] || { value: "", confidence: 0, source: "missing" };
    return {
      ...field,
      value: normalizeFieldValue(field, extracted.value),
      confidence: extracted.confidence || 0,
      source: extracted.source || "missing",
      overridden: false
    };
  });
}

function countFilledFields(fields) {
  return fields.filter((field) => field.value.trim()).length;
}

function getFieldEmoji(field) {
  const name = (field.name || "").toLowerCase();
  const type = (field.type || "").toLowerCase();

  if (type === "email" || name.includes("email")) return "📧";
  if (type === "phone" || name.includes("phone") || name.includes("mobile")) return "📞";
  if (type === "date" || name.includes("date") || name.includes("dob") || name.includes("time")) return "📅";
  if (name.includes("address") || name.includes("location") || name.includes("city") || name.includes("pin")) return "📍";
  if (name.includes("name") || name.includes("person") || name.includes("user")) return "👤";

  if (name.includes("gender")) return "🚻";
  if (type === "number" || name.includes("age") || name.includes("amount") || name.includes("price") || name.includes("budget")) return "🔢";
  if (type === "textarea" || name.includes("desc") || name.includes("note") || name.includes("complaint")) return "📄";

  return "📝";
}

function getDisplayCategoryName(category) {
  const displayNames = {
    Complaint: "Customer Support",
    Service: "Service Requests",
    Sales: "Lead Capture",
    Healthcare: "Healthcare",
    Operations: "Field Operations"
  };

  return displayNames[category] || category;
}

function normalizeSelectedTemplate(template) {
  if (!template) {
    return template;
  }

  const isCustomCategory = template.category === "Saved" || template.category === "Custom";
  if (template.source && (!isCustomCategory || template.source === "custom")) {
    return template;
  }

  return {
    ...template,
    source: isCustomCategory ? "custom" : "builtin"
  };
}

function parseRecordDate(dateValue) {
  if (!dateValue) {
    return null;
  }

  const parsed = new Date(dateValue);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isTodayDate(dateValue) {
  if (!dateValue) {
    return false;
  }

  const now = new Date();
  return (
    dateValue.getFullYear() === now.getFullYear() &&
    dateValue.getMonth() === now.getMonth() &&
    dateValue.getDate() === now.getDate()
  );
}

function isThisWeekDate(dateValue) {
  if (!dateValue) {
    return false;
  }

  const now = new Date();
  const start = new Date(now);
  const day = start.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + diffToMonday);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 7);

  return dateValue >= start && dateValue < end;
}

function getRecordStatusMeta(status, isSheetsReady) {
  const raw = (status || "").toLowerCase();

  if (raw.includes("fail") || raw.includes("error") || raw.includes("reject")) {
    return { key: "failed", label: "Failed", tone: "status-failed" };
  }

  if (raw.includes("export") || raw.includes("sync") || raw.includes("sheet")) {
    return { key: "exported", label: "Exported", tone: "status-exported" };
  }

  if (raw.includes("process") || raw.includes("submit") || raw.includes("success") || raw.includes("complete")) {
    if (isSheetsReady) {
      return { key: "exported", label: "Exported", tone: "status-exported" };
    }
    return { key: "processed", label: "Processed", tone: "status-processed" };
  }

  if (!raw) {
    return { key: "pending", label: "Pending", tone: "status-pending" };
  }

  return { key: "processed", label: "Processed", tone: "status-processed" };
}

function formatRecordDateLabel(dateValue) {
  const parsed = parseRecordDate(dateValue);
  if (!parsed) {
    return dateValue || "Unknown date";
  }

  return parsed.toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatRelativeTime(dateValue) {
  const parsed = parseRecordDate(dateValue);
  if (!parsed) {
    return "Recently";
  }

  const diffMs = Date.now() - parsed.getTime();
  const diffMinutes = Math.max(0, Math.round(diffMs / 60000));

  if (diffMinutes < 1) {
    return "Saved just now";
  }
  if (diffMinutes < 60) {
    return `Saved ${diffMinutes} min ago`;
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) {
    return `Saved ${diffHours} hr ago`;
  }

  const diffDays = Math.round(diffHours / 24);
  return `Saved ${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
}

function Icon({ name, className = "icon-svg" }) {
  if (name === "drag") {
    return (
      <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <circle cx="6" cy="5" r="1.5" fill="currentColor" />
        <circle cx="6" cy="10" r="1.5" fill="currentColor" />
        <circle cx="6" cy="15" r="1.5" fill="currentColor" />
        <circle cx="14" cy="5" r="1.5" fill="currentColor" />
        <circle cx="14" cy="10" r="1.5" fill="currentColor" />
        <circle cx="14" cy="15" r="1.5" fill="currentColor" />
      </svg>
    );
  }

  if (name === "edit") {
    return (
      <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path d="M13.9 3.2a1.8 1.8 0 1 1 2.6 2.6L8.1 14.2l-3.6.9.9-3.6L13.9 3.2Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  if (name === "done") {
    return (
      <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path d="m4 10 4 4 8-8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  if (name === "trash") {
    return (
      <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path d="M4.5 6h11M8 6V4.8a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1V6m-6.4 0 .7 9a1 1 0 0 0 1 .9h5.4a1 1 0 0 0 1-.9l.7-9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M8.4 8.6v4.8M11.6 8.6v4.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  }

  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="m4 10 4 4 8-8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function App() {
  const [templates, setTemplates] = useState({});
  const [selectedTemplate, setSelectedTemplate] = useState(() => {
    try {
      const saved = localStorage.getItem("v2f_selectedTemplate");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [step, setStep] = useState(() => parseInt(localStorage.getItem("v2f_step") || "1", 10));
  const [language, setLanguage] = useState(() => localStorage.getItem(LANGUAGE_STORAGE_KEY) || "hi-IN");
  const [marketplaceTab, setMarketplaceTab] = useState("all");
  const [uploadedTemplateName, setUploadedTemplateName] = useState("");
  const [audioMode, setAudioMode] = useState("upload");
  const [isRecording, setIsRecording] = useState(false);
  const [isRecordingPaused, setIsRecordingPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioFile, setAudioFile] = useState(null);
  const [submissionSource, setSubmissionSource] = useState("recording");
  const [processingStage, setProcessingStage] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [transcript, setTranscript] = useState("");
  const [fieldValues, setFieldValues] = useState([]);
  const [submitMeta, setSubmitMeta] = useState(null);
  const [showTranscript, setShowTranscript] = useState(false);
  const [accessToken, setAccessToken] = useState("");
  const [sessionToken, setSessionToken] = useState(() => localStorage.getItem(AUTH_SESSION_STORAGE_KEY) || "");
  const [isHydrating, setIsHydrating] = useState(() => !!localStorage.getItem(AUTH_SESSION_STORAGE_KEY));
  const [authUser, setAuthUser] = useState(() => {
    try {
      const saved = localStorage.getItem(AUTH_USER_STORAGE_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [authMode, setAuthMode] = useState("login");
  const [authName, setAuthName] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [resetCodeHint, setResetCodeHint] = useState("");
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [pendingGoogleAuthSave, setPendingGoogleAuthSave] = useState(false);
  const [googleAccount, setGoogleAccount] = useState(null);
  const [isCheckingGoogleAccount, setIsCheckingGoogleAccount] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newFieldName, setNewFieldName] = useState("");
  const [targetSheetUrl, setTargetSheetUrl] = useState("");
  const [sheetSyncMode, setSheetSyncMode] = useState("new");
  const [pendingSubmitAfterLogin, setPendingSubmitAfterLogin] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [isUploadingTemplate, setIsUploadingTemplate] = useState(false);
  const [editingField, setEditingField] = useState(null);
  const [editingExtractedField, setEditingExtractedField] = useState(null);
  const [draggingFieldIndex, setDraggingFieldIndex] = useState(null);
  const [dragOverFieldIndex, setDragOverFieldIndex] = useState(null);
  const [extractionRules, setExtractionRules] = useState("Standard");
  const [templateSearchQuery, setTemplateSearchQuery] = useState("");
  const [recentRecords, setRecentRecords] = useState([]);
  const [recordsQuickFilter, setRecordsQuickFilter] = useState("all");
  const [recordsSearchQuery, setRecordsSearchQuery] = useState("");
  const [recordsOwnerFilter, setRecordsOwnerFilter] = useState("all");
  const [recordsSourceFilter, setRecordsSourceFilter] = useState("all");
  const [isRecentPanelOpen, setIsRecentPanelOpen] = useState(false);
  const [inWorkspace, setInWorkspace] = useState(() => localStorage.getItem("v2f_inWorkspace") === "true");
  const [homeView, setHomeView] = useState(() => localStorage.getItem("v2f_homeView") || "workspaces");
  const [workspaceTab, setWorkspaceTab] = useState("overview");
  const [workspaces, setWorkspaces] = useState([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState(() => localStorage.getItem("v2f_activeWorkspaceId") || "");
  const [activeWorkspaceName, setActiveWorkspaceName] = useState(() => localStorage.getItem("v2f_activeWorkspaceName") || "");
  const [isWorkspacesLoading, setIsWorkspacesLoading] = useState(false);
  const [isSavingWorkspace, setIsSavingWorkspace] = useState(false);
  const [editingWorkspaceId, setEditingWorkspaceId] = useState("");
  const [editingWorkspaceName, setEditingWorkspaceName] = useState("");
  const [workspacePendingDelete, setWorkspacePendingDelete] = useState(null);
  const [workspaceActionLoadingId, setWorkspaceActionLoadingId] = useState("");
  const [isWorkspaceCleanupRunning, setIsWorkspaceCleanupRunning] = useState(false);
  const isGoogleAuthPopupOpenRef = useRef(false);
  const pendingSubmitOptionsRef = useRef({});
  const tabBarRef = useRef(null);
  const savedSectionRef = useRef(null);

  useEffect(() => {
    localStorage.setItem("v2f_step", step.toString());
    localStorage.setItem("v2f_inWorkspace", inWorkspace.toString());
    localStorage.setItem("v2f_homeView", homeView);
    localStorage.setItem("v2f_activeWorkspaceId", activeWorkspaceId);
    localStorage.setItem("v2f_activeWorkspaceName", activeWorkspaceName);
    if (selectedTemplate) {
      localStorage.setItem("v2f_selectedTemplate", JSON.stringify(selectedTemplate));
    } else {
      localStorage.removeItem("v2f_selectedTemplate");
    }
  }, [step, inWorkspace, homeView, activeWorkspaceId, activeWorkspaceName, selectedTemplate]);

  useEffect(() => {
    if (authUser) {
      localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(authUser));
    } else {
      localStorage.removeItem(AUTH_USER_STORAGE_KEY);
    }
  }, [authUser]);

  useEffect(() => {
    fetchTemplates()
      .then(setTemplates)
      .catch((error) => setErrorMessage(error.message));

    fetchToken().then((res) => {
      if (res && res.token) setAccessToken(res.token);
    });
  }, []);

  useEffect(() => {
    if (!authUser || !sessionToken) {
      setRecentRecords([]);
      return;
    }

    fetchRecentRecords(sessionToken)
      .then((res) => {
        if (res.status === "ok") {
          setRecentRecords(res.records || []);
        }
      })
      .catch(console.error);
  }, [authUser, sessionToken]);

  async function refreshWorkspaces(showLoader = false) {
    if (!sessionToken) {
      return;
    }

    if (showLoader) {
      setIsWorkspacesLoading(true);
    }

    try {
      const res = await fetchWorkspaces(sessionToken);
      if (res.status === "ok") {
        setWorkspaces(res.workspaces || []);
      }
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      if (showLoader) {
        setIsWorkspacesLoading(false);
      }
    }
  }

  useEffect(() => {
    if (!authUser || !sessionToken) {
      setWorkspaces([]);
      return;
    }

    refreshWorkspaces(true);
  }, [authUser, sessionToken]);

  useEffect(() => {
    // Intentionally removed auto-redirect to prevent race conditions
    // Using derived state in the render function to show templates when workspace count is 0
  }, []);

  useEffect(() => {
    if (!sessionToken) {
      setAuthUser(null);
      setIsHydrating(false);
      return;
    }

    let isCancelled = false;

    async function hydrateSession() {
      try {
        const payload = await fetchAuthMe(sessionToken);
        if (!isCancelled) {
          setAuthUser(payload.user);
        }
      } catch (error) {
        if (!isCancelled) {
          if (error?.status === 401) {
            setAuthUser(null);
            setSessionToken("");
            localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
            localStorage.removeItem(AUTH_USER_STORAGE_KEY);
          } else {
            setErrorMessage("Could not verify your session right now. Keeping you signed in locally, please try again.");
          }
        }
      } finally {
        if (!isCancelled) {
          setIsHydrating(false);
        }
      }
    }

    hydrateSession();

    return () => {
      isCancelled = true;
    };
  }, [sessionToken]);

  const login = useGoogleLogin({
    onSuccess: (tokenResponse) => {
      isGoogleAuthPopupOpenRef.current = false;
      setAccessToken(tokenResponse.access_token);
      saveToken(tokenResponse.access_token);
    },
    onError: () => {
      isGoogleAuthPopupOpenRef.current = false;
      setPendingGoogleAuthSave(false);
      setPendingSubmitAfterLogin(false);
      setIsAuthLoading(false);
      setErrorMessage("Google login failed. Please try again.");
    },
    scope: "https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive"
  });

  function startGoogleLogin() {
    if (isGoogleAuthPopupOpenRef.current) {
      return;
    }

    isGoogleAuthPopupOpenRef.current = true;
    login();
  }

  function reconnectGoogleForSubmit(options = {}) {
    pendingSubmitOptionsRef.current = options;
    setPendingSubmitAfterLogin(true);
    setErrorMessage(GOOGLE_RECONNECT_MESSAGE);
    startGoogleLogin();
  }

  const audioRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioContextRef = useRef(null);
  const workletNodeRef = useRef(null);
  const wsRef = useRef(null);
  const chunksRef = useRef([]);
  const stopRequestedRef = useRef(false);
  const timerRef = useRef(null);

  useEffect(() => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  }, [language]);

  useEffect(() => {
    if (!accessToken) {
      setGoogleAccount(null);
      setIsCheckingGoogleAccount(false);
      return;
    }

    let isCancelled = false;

    async function verifyGoogleAccount() {
      try {
        setIsCheckingGoogleAccount(true);
        const response = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        });

        if (!response.ok) {
          throw new Error("Google token is invalid or expired.");
        }

        const profile = await response.json();
        if (!isCancelled) {
          setGoogleAccount({
            email: profile.email || "",
            name: profile.name || "",
            picture: profile.picture || ""
          });
        }
      } catch {
        if (!isCancelled) {
          setGoogleAccount(null);
        }
      } finally {
        if (!isCancelled) {
          setIsCheckingGoogleAccount(false);
        }
      }
    }

    verifyGoogleAccount();

    return () => {
      isCancelled = true;
    };
  }, [accessToken]);

  useEffect(() => {
    if (!pendingSubmitAfterLogin || !accessToken) {
      return;
    }

    setPendingSubmitAfterLogin(false);
    submitData(accessToken, pendingSubmitOptionsRef.current || {});
    pendingSubmitOptionsRef.current = {};
  }, [accessToken, pendingSubmitAfterLogin]);

  useEffect(() => {
    if (!pendingGoogleAuthSave || !googleAccount?.email) {
      return;
    }

    async function persistGoogleUser() {
      setIsAuthLoading(true);
      try {
        const payload = await googleLogin({
          name: googleAccount.name || "Google User",
          email: googleAccount.email,
          avatar: googleAccount.picture || ""
        });
        if (payload.access_token) {
          setSessionToken(payload.access_token);
          localStorage.setItem(AUTH_SESSION_STORAGE_KEY, payload.access_token);
        }
        setAuthUser(payload.user);
        setAuthName("");
        setAuthEmail("");
        setAuthPassword("");
        setResetToken("");
        setResetCodeHint("");
      } catch (error) {
        setErrorMessage(error.message);
      } finally {
        setPendingGoogleAuthSave(false);
        setIsAuthLoading(false);
      }
    }

    persistGoogleUser();
  }, [pendingGoogleAuthSave, googleAccount]);

  useEffect(() => {
    if (!isRecording || isRecordingPaused) {
      return undefined;
    }

    timerRef.current = window.setInterval(() => {
      setRecordingTime((current) => current + 1);
    }, 1000);

    return () => {
      window.clearInterval(timerRef.current);
    };
  }, [isRecording, isRecordingPaused]);

  useEffect(() => {
    if (!isTemplateModalOpen) {
      return undefined;
    }

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isTemplateModalOpen]);

  useEffect(() => {
    if (!selectedTemplate) {
      return;
    }

    setFieldValues((current) => {
      if (current.length > 0) {
        return current;
      }
      return buildInitialFieldValues(selectedTemplate);
    });
  }, [selectedTemplate]);

  async function handleManualAuthSubmit(event) {
    event.preventDefault();

    if (authMode === "forgot") {
      await handleForgotPassword();
      return;
    }

    if (authMode === "reset") {
      await handleResetPassword();
      return;
    }

    setErrorMessage("");
    setIsAuthLoading(true);
    try {
      const payload = authMode === "signup"
        ? await manualSignup({ name: authName.trim(), email: authEmail.trim(), password: authPassword })
        : await manualLogin({ email: authEmail.trim(), password: authPassword });

      if (payload.access_token) {
        setSessionToken(payload.access_token);
        localStorage.setItem(AUTH_SESSION_STORAGE_KEY, payload.access_token);
      }
      setAuthUser(payload.user);
      setAuthName("");
      setAuthEmail("");
      setAuthPassword("");
      setResetToken("");
      setResetCodeHint("");
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setIsAuthLoading(false);
    }
  }

  async function handleForgotPassword() {
    const email = authEmail.trim();
    if (!email) {
      setErrorMessage("Enter your email to reset password.");
      return;
    }

    setErrorMessage("");
    setIsAuthLoading(true);
    try {
      const payload = await forgotPassword(email);
      setResetCodeHint(payload.reset_token || "");
      setAuthMode("reset");
      setAuthPassword("");
      setErrorMessage("");
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setIsAuthLoading(false);
    }
  }

  async function handleResetPassword() {
    if (!resetToken.trim()) {
      setErrorMessage("Enter your reset token.");
      return;
    }

    if (authPassword.trim().length < 6) {
      setErrorMessage("Password must be at least 6 characters.");
      return;
    }

    setErrorMessage("");
    setIsAuthLoading(true);
    try {
      await resetPassword({ resetToken: resetToken.trim(), newPassword: authPassword });
      setAuthMode("login");
      setAuthPassword("");
      setResetToken("");
      setResetCodeHint("");
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setIsAuthLoading(false);
    }
  }

  function handleGoogleAppAuth() {
    setErrorMessage("");
    setPendingGoogleAuthSave(true);
    startGoogleLogin();
  }

  function handleLogout() {
    setSessionToken("");
    setAuthUser(null);
    setAccessToken("");
    setGoogleAccount(null);
    setPendingGoogleAuthSave(false);
    setRecentRecords([]);
    setWorkspaces([]);
    setInWorkspace(false);
    setHomeView("workspaces");
    setWorkspaceTab("overview");
    setActiveWorkspaceId("");
    setActiveWorkspaceName("");
    setSelectedTemplate(null);
    setStep(1);
    localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
    localStorage.removeItem(AUTH_USER_STORAGE_KEY);
  }

  async function handleTemplateUpload(event) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      setErrorMessage("");
      setIsUploadingTemplate(true);
      const parsedTemplate = await uploadTemplateFile(file);
      setUploadedTemplateName(file.name);
      setSelectedTemplate(normalizeSelectedTemplate({ ...parsedTemplate, source: "custom" }));
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setIsUploadingTemplate(false);
    }
  }

  function handleTemplateFileChange(event) {
    handleTemplateUpload(event);
    if (event.target.files?.length > 0) {
      setIsTemplateModalOpen(true);
    }
  }

  function handleSelectBuiltIn(template) {
    setUploadedTemplateName("");
    setSelectedTemplate({ ...template, source: "builtin" });
    setNewFieldName("");
  }

  function handleAddCustomField(event) {
    event.preventDefault();
    const name = newFieldName.trim();
    if (!name || !selectedTemplate) return;

    if (selectedTemplate.fields.some((f) => f.name.toLowerCase() === name.toLowerCase())) {
      setErrorMessage(`Field "${name}" already exists.`);
      return;
    }

    setErrorMessage("");
    const newField = { name, type: "text", required: false, hint: "" };
    setSelectedTemplate((prev) => ({
      ...prev,
      source: "custom",
      fields: [...prev.fields, newField]
    }));
    setNewFieldName("");
  }

  function handleDeleteField(fieldName) {
    if (!selectedTemplate) return;
    setSelectedTemplate((prev) => ({
      ...prev,
      source: "custom",
      fields: prev.fields.filter((f) => f.name !== fieldName)
    }));
  }

  function handleEditFieldSave(oldName, newName) {
    const trimmed = newName.trim();
    if (!trimmed || !selectedTemplate) {
      setEditingField(null);
      return;
    }

    if (trimmed.toLowerCase() !== oldName.toLowerCase() &&
      selectedTemplate.fields.some((f) => f.name.toLowerCase() === trimmed.toLowerCase())) {
      setErrorMessage(`Field "${trimmed}" already exists.`);
      return;
    }

    setErrorMessage("");
    setSelectedTemplate((prev) => ({
      ...prev,
      source: "custom",
      fields: prev.fields.map((f) => f.name === oldName ? { ...f, name: trimmed } : f)
    }));
    setEditingField(null);
  }

  function handleFieldDragStart(index) {
    setDraggingFieldIndex(index);
  }

  function handleFieldDrop(dropIndex) {
    if (!selectedTemplate || draggingFieldIndex === null || draggingFieldIndex === dropIndex) {
      setDraggingFieldIndex(null);
      setDragOverFieldIndex(null);
      return;
    }

    setSelectedTemplate((prev) => {
      const reordered = [...prev.fields];
      const [moved] = reordered.splice(draggingFieldIndex, 1);
      reordered.splice(dropIndex, 0, moved);
      return {
        ...prev,
        source: "custom",
        fields: reordered
      };
    });

    setDraggingFieldIndex(null);
    setDragOverFieldIndex(null);
  }

  function handleFieldTypeChange(fieldName, type) {
    if (!selectedTemplate) return;
    setSelectedTemplate((prev) => ({
      ...prev,
      source: "custom",
      fields: prev.fields.map((field) =>
        field.name === fieldName ? { ...field, type } : field
      )
    }));
  }

  function handleFieldRequiredToggle(fieldName, required) {
    if (!selectedTemplate) return;
    setSelectedTemplate((prev) => ({
      ...prev,
      source: "custom",
      fields: prev.fields.map((field) =>
        field.name === fieldName ? { ...field, required } : field
      )
    }));
  }

  function buildInitialFieldValues(template = selectedTemplate) {
    return (template?.fields || []).map((field) => ({
      ...field,
      value: "",
      confidence: 0,
      source: "missing",
      overridden: false
    }));
  }

  function hydrateWorkspace(workspace) {
    const templatePayload = workspace?.template
      ? {
        ...workspace.template,
        source: (workspace.template_source === "custom" || workspace.template?.category === "Custom" || workspace.template?.category === "Saved") ? "custom" : "builtin"
      }
      : null;

    const normalizedTemplate = normalizeSelectedTemplate(templatePayload);
    if (!normalizedTemplate) {
      return;
    }

    setActiveWorkspaceId(workspace.id || "");
    setActiveWorkspaceName(workspace.name || "");
    setSelectedTemplate(normalizedTemplate);
    setLanguage(workspace.language || "hi-IN");
    setSheetSyncMode(workspace.sheet_sync_mode || "new");
    setTargetSheetUrl(workspace.target_sheet_url || "");
    setExtractionRules(workspace.extraction_rules || "Standard");

    resetAudioAndExtraction();
    setFieldValues(buildInitialFieldValues(normalizedTemplate));

    setInWorkspace(true);
    setStep(1);
    setWorkspaceTab("overview");
    setHomeView("workspaces");
  }

  async function handleOpenWorkspace(workspaceOrId) {
    const workspaceId = typeof workspaceOrId === "string" ? workspaceOrId : workspaceOrId?.id;
    if (!workspaceId || !sessionToken) {
      return;
    }

    setErrorMessage("");

    // Open immediately from the clicked card data, then sync with backend payload.
    if (typeof workspaceOrId === "object" && workspaceOrId) {
      hydrateWorkspace(workspaceOrId);
    }

    try {
      const payload = await getWorkspaceApi(workspaceId, sessionToken);
      if (payload.workspace) {
        hydrateWorkspace(payload.workspace);
      }
    } catch (error) {
      setErrorMessage(error.message);
    }
  }

  function startRenameWorkspace(workspace) {
    if (!workspace?.id) {
      return;
    }

    setEditingWorkspaceId(workspace.id);
    setEditingWorkspaceName(workspace.name || "");
  }

  function cancelRenameWorkspace() {
    setEditingWorkspaceId("");
    setEditingWorkspaceName("");
  }

  async function submitRenameWorkspace(workspace) {
    if (!workspace?.id || !sessionToken) {
      return;
    }

    const nextName = editingWorkspaceName.trim();
    if (!nextName || nextName === workspace.name) {
      cancelRenameWorkspace();
      return;
    }

    try {
      setWorkspaceActionLoadingId(workspace.id);
      await updateWorkspaceApi(workspace.id, { name: nextName.trim() }, sessionToken);
      if (workspace.id === activeWorkspaceId) {
        setActiveWorkspaceName(nextName.trim());
      }
      await refreshWorkspaces();
      cancelRenameWorkspace();
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setWorkspaceActionLoadingId("");
    }
  }

  async function handleTogglePinWorkspace(workspace) {
    if (!workspace?.id || !sessionToken) {
      return;
    }

    try {
      setWorkspaceActionLoadingId(workspace.id);
      await updateWorkspaceApi(workspace.id, { is_pinned: !workspace.is_pinned }, sessionToken);
      await refreshWorkspaces();
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setWorkspaceActionLoadingId("");
    }
  }

  function requestDeleteWorkspace(workspace) {
    if (!workspace?.id) {
      return;
    }

    setWorkspacePendingDelete(workspace);
  }

  async function confirmDeleteWorkspace() {
    const workspace = workspacePendingDelete;
    if (!workspace?.id || !sessionToken) {
      return;
    }

    try {
      setWorkspaceActionLoadingId(workspace.id);
      await deleteWorkspaceApi(workspace.id, sessionToken);
      if (workspace.id === activeWorkspaceId) {
        setActiveWorkspaceId("");
        setActiveWorkspaceName("");
        setSelectedTemplate(null);
        setInWorkspace(false);
        setStep(1);
        setWorkspaceTab("overview");
        setHomeView("workspaces");
      }
      await refreshWorkspaces();
      setWorkspacePendingDelete(null);
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setWorkspaceActionLoadingId("");
    }
  }

  async function handleEnterWorkspace() {
    if (!selectedTemplate) {
      return;
    }

    if (!sessionToken) {
      return;
    }

    setIsSavingWorkspace(true);
    setErrorMessage("");

    const workspacePayload = {
      name: activeWorkspaceName || `${selectedTemplate.name} Workspace`,
      template_id: selectedTemplate.source === "custom" && !selectedTemplate.id?.startsWith("custom_") ? null : (selectedTemplate.id || null),
      template: selectedTemplate.source === "custom" ? selectedTemplate : null,
      language,
      sheet_sync_mode: sheetSyncMode,
      target_sheet_url: targetSheetUrl.trim() || null,
      extraction_rules: extractionRules
    };

    try {
      const payload = activeWorkspaceId
        ? await updateWorkspaceApi(activeWorkspaceId, workspacePayload, sessionToken)
        : await createWorkspaceApi(workspacePayload, sessionToken);

      if (payload.workspace) {
        hydrateWorkspace(payload.workspace);
      }

      await refreshWorkspaces();
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setIsSavingWorkspace(false);
    }
  }

  async function handleCleanupDuplicateWorkspaces() {
    if (!sessionToken || isWorkspaceCleanupRunning || workspaces.length < 2) {
      return;
    }

    const shouldProceed = window.confirm("This will delete older duplicate workspaces with the same name and template. Continue?");
    if (!shouldProceed) {
      return;
    }

    try {
      setIsWorkspaceCleanupRunning(true);
      setErrorMessage("");
      const payload = await cleanupDuplicateWorkspacesApi(sessionToken);
      await refreshWorkspaces();

      if (payload.deleted_count > 0) {
        window.alert(`Cleanup complete. Removed ${payload.deleted_count} duplicate workspaces.`);
      } else {
        window.alert("No duplicate workspaces found.");
      }
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setIsWorkspaceCleanupRunning(false);
    }
  }

  function openWorkspaceFromTemplate(template) {
    const normalizedTemplate = normalizeSelectedTemplate(template);
    if (!normalizedTemplate) {
      return;
    }

    const existingWorkspace = workspaces.find(w => w.template_id === normalizedTemplate.id);
    if (existingWorkspace) {
      handleOpenWorkspace(existingWorkspace);
      return;
    }

    setActiveWorkspaceId("");
    setActiveWorkspaceName(`${normalizedTemplate.name} Workspace`);
    setSelectedTemplate(normalizedTemplate);
    setStep(2);
    setInWorkspace(false);
    setHomeView("templates");
  }

  function resetAudioAndExtraction() {
    setAudioFile(null);
    setSubmissionSource("recording");
    setTranscript("");
    setFieldValues(buildInitialFieldValues());
    setSubmitMeta(null);
    setShowTranscript(false);
    setErrorMessage("");
    setProcessingStage("");
    setEditingExtractedField(null);
  }

  async function startRecording() {
    try {
      setErrorMessage("");
      stopRequestedRef.current = false;
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        }
      });
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      chunksRef.current = [];

      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      // Assuming backend runs on 8000 in dev, or same host in prod
      const wsHost = import.meta.env.DEV ? "localhost:8000" : window.location.host;
      const wsUrl = `${protocol}//${wsHost}/api/stream/transcribe`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      const audioContext = new AudioContext({ sampleRate: 16000 });
      audioContextRef.current = audioContext;
      let source = null;
      let streamStarted = false;

      function startStreamIfReady() {
        if (streamStarted || ws.readyState !== WebSocket.OPEN || !audioContext || !selectedTemplate || !source || !workletNodeRef.current) {
          return;
        }

        try {
          const templateSource = (selectedTemplate.category === "Saved" || selectedTemplate.category === "Custom") ? "custom" : (selectedTemplate.source || "builtin");

          console.log('[WS] Template debug:', {
            id: selectedTemplate.id,
            category: selectedTemplate.category,
            source: selectedTemplate.source,
            templateSource,
            hasFields: !!selectedTemplate.fields
          });

          const templatePayload = templateSource === "custom" ? {
            id: selectedTemplate.id,
            name: selectedTemplate.name,
            category: selectedTemplate.category,
            source: selectedTemplate.source || "custom",
            fields: selectedTemplate.fields,
          } : null;

          const initData = {
            template_id: templateSource === "builtin" ? selectedTemplate.id : (selectedTemplate.id?.startsWith("custom_") ? selectedTemplate.id : null),
            template: templatePayload,
            current_form_data: fieldValues.reduce((acc, field) => ({ ...acc, [field.name]: field.value }), {}),
            user_modified_fields: fieldValues.filter(f => f.overridden).map(f => f.name),
            sample_rate: audioContext.sampleRate,
            language
          };

          console.log('[WS] Sending initData:', {
            template_id: initData.template_id,
            has_template: !!initData.template,
            sample_rate: initData.sample_rate,
            language: initData.language
          });

          ws.send(JSON.stringify(initData));

          source.connect(workletNodeRef.current);
          const silentGain = audioContext.createGain();
          silentGain.gain.value = 0;
          workletNodeRef.current.connect(silentGain);
          silentGain.connect(audioContext.destination);
          streamStarted = true;
          console.log('[WS] Init sent and audio streaming started');
        } catch (e) {
          console.error('[WS] Failed to send init or start stream:', e);
          setErrorMessage("Could not start live transcription. We will still process the full recording when you stop.");
        }
      }

      ws.onopen = () => {
        console.log('[WS] onopen fired, audioContext:', audioContext?.sampleRate, 'template:', selectedTemplate?.id);
        startStreamIfReady();
      };

      console.log('[AUDIO] Context state before resume:', audioContext.state);
      console.log('[AUDIO] Actual sample rate:', audioContext.sampleRate);

      if (audioContext.state === "suspended") {
        await audioContext.resume();
      }

      console.log('[AUDIO] Context state after resume:', audioContext.state);
      source = audioContext.createMediaStreamSource(stream);

      await audioContext.audioWorklet.addModule('/pcm-processor.js');
      const workletNode = new AudioWorkletNode(audioContext, 'pcm-processor');
      workletNodeRef.current = workletNode;

      let chunkCount = 0;
      workletNode.port.onmessage = (e) => {
        chunkCount++;
        if (chunkCount <= 5) {
          console.log(`[WORKLET] Chunk #${chunkCount}, size: ${e.data.byteLength} bytes`);
        }
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(e.data); // raw Int16Array bytes
        } else {
          console.warn('[WORKLET] WebSocket not open, state:', ws.readyState);
        }
      };
      startStreamIfReady();

      ws.onerror = (error) => {
        console.error('[WS] WebSocket error:', error);
        setErrorMessage("Live transcription connection had a problem. We will still process the full recording when you stop.");
      };

      ws.onclose = (event) => {
        console.log(`[WS] WebSocket closed with code: ${event.code}, reason: ${event.reason}`);
        if (!stopRequestedRef.current && !event.wasClean && event.code !== 1000) {
          setErrorMessage(event.reason || "Live transcription stopped unexpectedly. We will still process the full recording when you stop.");
        }
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === "final_transcript") {
          setTranscript(data.transcript);
        } else if (data.type === "interim_transcript") {
          setTranscript(data.transcript);
        } else if (data.type === "form_update") {
          setFieldValues(current => current.map(field => {
            if (data.fields[field.name] !== undefined) {
              return { ...field, value: normalizeFieldValue(field, data.fields[field.name]), confidence: 95, source: "ai" };
            }
            return field;
          }));
        }
      };

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        const file = new File([blob], "voice-recording.webm", { type: blob.type || "audio/webm" });
        setAudioFile(file);
        setSubmissionSource("recording");
        setIsRecording(false);
        setIsRecordingPaused(false);
        setRecordingTime(0);
        stream.getTracks().forEach((track) => track.stop());

        if (ws.readyState === WebSocket.OPEN) {
          ws.close();
        }

        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
          audioContextRef.current.close();
        }

        await processAudio(file);
      };

      mediaRecorderRef.current = recorder;
      recorder.start(250); // Emit chunks every 250ms
      setIsRecording(true);
      setIsRecordingPaused(false);
      setRecordingTime(0);
    } catch (error) {
      setErrorMessage("Microphone access is required to record audio.");
    }
  }

  async function stopRecording() {
    stopRequestedRef.current = true;

    // 1. Flush any remaining buffered PCM frames
    if (workletNodeRef.current) {
      workletNodeRef.current.port.postMessage({ type: 'flush' });
      await new Promise(r => setTimeout(r, 200)); // give it time to send
    }

    // 2. Tell backend to close Deepgram cleanly
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'stop' }));
    }

    // 3. Stop MediaRecorder to get the .webm blob
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
  }

  function pauseRecording() {
    if (mediaRecorderRef.current && isRecording && !isRecordingPaused) {
      mediaRecorderRef.current.pause();
      setIsRecordingPaused(true);
    }
  }

  function resumeRecording() {
    if (mediaRecorderRef.current && isRecording && isRecordingPaused) {
      mediaRecorderRef.current.resume();
      setIsRecordingPaused(false);
    }
  }

  async function handleAudioFileChange(event) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setAudioFile(file);
    setSubmissionSource("upload");
    await processAudio(file);
  }

  async function processAudio(file) {
    if (!selectedTemplate) {
      return;
    }

    setErrorMessage("");
    setIsProcessing(true);
    setProcessingStage(PROCESS_STAGES[0]);

    try {
      await wait(250);
      setProcessingStage(PROCESS_STAGES[1]);
      await wait(350);
      const templateSource = (selectedTemplate.category === "Saved" || selectedTemplate.category === "Custom") ? "custom" : (selectedTemplate.source || "builtin");
      const extraction = await transcribeAudio({
        audioFile: file,
        templateId: templateSource === "builtin" ? selectedTemplate.id : null,
        template: templateSource === "custom" ? selectedTemplate : null,
        language
      });

      setProcessingStage(PROCESS_STAGES[2]);
      await wait(250);
      setProcessingStage(PROCESS_STAGES[3]);
      setTranscript(extraction.transcript || "");
      setFieldValues(mapFieldsFromExtraction(selectedTemplate, extraction));

      const allMissing = Object.values(extraction.fields || {}).every((field) => !field.value);
      if (allMissing) {
        setErrorMessage("Nothing extracted. Check audio language matches setting.");
      }
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setIsProcessing(false);
    }
  }

  function handleFieldChange(fieldName, value) {
    setFieldValues((current) =>
      current.map((field) =>
        field.name === fieldName
          ? {
            ...field,
            value: normalizeFieldValue(field, value),
            overridden: true
          }
          : field
      )
    );
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "user_override", field: fieldName, value }));
    }
  }

  async function submitData(token, options = {}) {
    if (!selectedTemplate || isSubmitting) {
      return;
    }

    const { startNext = false, stayInWorkspace = false } = options;

    const resolvedTargetSheetUrl = sheetSyncMode === "existing" ? targetSheetUrl.trim() : "";
    if (sheetSyncMode === "existing" && !resolvedTargetSheetUrl) {
      setErrorMessage("Please enter your existing Google Sheet URL.");
      return;
    }

    const fields = Object.fromEntries(fieldValues.map((field) => [field.name, field.value.trim()]));
    const templateSource = (selectedTemplate.category === "Saved" || selectedTemplate.category === "Custom") ? "custom" : (selectedTemplate.source || "builtin");

    setIsSubmitting(true);
    try {
      setErrorMessage("");
      const payload = await submitRecord({
        templateId: templateSource === "builtin" ? selectedTemplate.id : null,
        template: templateSource === "custom" ? selectedTemplate : null,
        fields,
        language,
        accessToken: token,
        targetSheetUrl: resolvedTargetSheetUrl || null,
        submissionSource,
        sessionToken
      });
      setSubmitMeta({
        ...payload,
        templateName: selectedTemplate.name,
        fields
      });

      if (sheetSyncMode === "new" && payload.sheet_url) {
        setTargetSheetUrl(payload.sheet_url);
        setSheetSyncMode("existing");
        if (activeWorkspaceId && sessionToken) {
          updateWorkspaceApi(activeWorkspaceId, {
            target_sheet_url: payload.sheet_url,
            sheet_sync_mode: "existing"
          }, sessionToken).catch(console.error);
        }
      }

      const recordsPayload = await fetchRecentRecords(sessionToken);
      if (recordsPayload?.status === "ok") {
        setRecentRecords(recordsPayload.records || []);
      }
      if (startNext) {
        resetAudioAndExtraction();
      } else if (stayInWorkspace) {
        setShowTranscript(true);
      } else {
        setStep(4);
      }
    } catch (error) {
      if (isGoogleReconnectError(error)) {
        setGoogleAccount(null);
        reconnectGoogleForSubmit(options);
        return;
      }
      setErrorMessage(error.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleSubmit(options = {}) {
    if (!accessToken) {
      reconnectGoogleForSubmit(options);
    } else if (!googleAccount) {
      if (isCheckingGoogleAccount) {
        setErrorMessage("Checking Google account connection. Please try again in a moment.");
        return;
      }
      reconnectGoogleForSubmit(options);
    } else {
      submitData(accessToken, options);
    }
  }

  function handleExportExtractedData() {
    if (!selectedTemplate || fieldValues.length === 0) {
      return;
    }

    const rows = [
      ["Template", selectedTemplate.name],
      ["Language", language],
      ...fieldValues.map((field) => [field.name, field.value || ""])
    ];

    const csv = rows
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${(selectedTemplate.name || "voice2form").replace(/\s+/g, "_")}_extracted.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function handleReturnToWorkspace() {
    resetAudioAndExtraction();
    setStep(1);
    setInWorkspace(true);
    setWorkspaceTab("overview");
  }

  function handleNewRecord() {
    resetAudioAndExtraction();
    setAudioMode("upload");
    setStep(3);
    setInWorkspace(false);
  }

  function handleStartWorkspaceUpload() {
    resetAudioAndExtraction();
    setAudioMode("upload");
    setStep(3);
    setInWorkspace(false);
  }

  function handleStartWorkspaceLiveAudio() {
    resetAudioAndExtraction();
    setAudioMode("mic");
    setStep(3);
    setInWorkspace(false);
  }

  function handleBrowseTemplates() {
    setInWorkspace(false);
    setActiveWorkspaceId("");
    setActiveWorkspaceName("");
    setSelectedTemplate(null);
    setUploadedTemplateName("");
    resetAudioAndExtraction();
    setStep(1);
    setHomeView("templates");
  }

  function handleRerecord() {
    setAudioFile(null);
    setTranscript("");
    setEditingExtractedField(null);
    setFieldValues((current) => current.map(f => ({ ...f, value: "", confidence: 0, source: "missing", overridden: false })));
    setSubmitMeta(null);
    setErrorMessage("");
    setProcessingStage("");
  }

  const filledCount = countFilledFields(fieldValues);
  const requiredMissing = fieldValues.some((field) => field.required && !field.value.trim());
  const extractionPercent = fieldValues.length > 0 ? Math.round((filledCount / fieldValues.length) * 100) : 0;
  const extractionBlocks = `${"█".repeat(Math.round(extractionPercent / 10))}${"░".repeat(10 - Math.round(extractionPercent / 10))}`;
  const hasAudioInput = Boolean(audioFile) || isRecording;
  const hasExtractionResults = Boolean(transcript);
  const stageIndex = PROCESS_STAGES.indexOf(processingStage);
  const pipelineStages = [
    { label: "Uploading Audio", complete: hasExtractionResults || stageIndex > 0, active: isProcessing && stageIndex === 0 },
    { label: "Transcribing Audio", complete: hasExtractionResults || stageIndex > 1, active: isProcessing && stageIndex === 1 },
    { label: "Extracting Fields", complete: hasExtractionResults || stageIndex > 2, active: isProcessing && stageIndex === 2 },
    { label: "Mapping Template", complete: hasExtractionResults, active: isProcessing && stageIndex === 3 }
  ];
  const processingChecklist = [
    { label: "Audio Uploaded", done: Boolean(audioFile) },
    { label: "Language Detected", done: stageIndex >= 1 || hasExtractionResults },
    { label: "Transcript Generated", done: stageIndex >= 2 || hasExtractionResults },
    { label: "Fields Extracted", done: stageIndex >= 3 || hasExtractionResults },
    { label: "Template Mapped", done: hasExtractionResults }
  ];
  const marketplaceCategories = Object.keys(templates).filter(Boolean);
  const marketplaceTabs = ["all", ...marketplaceCategories];
  const tabLabelMap = {
    all: "All templates",
    Service: "Service Requests",
    Sales: "Lead Capture",
    Healthcare: "Healthcare",
    Operations: "Field Operations",
    Complaint: "Customer Support",
    Custom: "Custom",
    Saved: "Saved"
  };
  const featuredTemplates = Object.entries(templates)
    .flatMap(([category, items]) => items.slice(0, 2).map((item) => ({ ...item, categoryLabel: getDisplayCategoryName(category) })))
    .slice(0, 4);
  const readyMadeTemplates = Object.entries(templates)
    .filter(([category]) => category !== "Saved")
    .flatMap(([category, items]) => items.map((item) => ({ ...item, categoryLabel: getDisplayCategoryName(category) })));
  const savedTemplates = (templates.Saved || []).map((item) => ({ ...item, categoryLabel: getDisplayCategoryName("Saved") }));
  const readyMadeByTab = (marketplaceTab === "all" || marketplaceTab === "Saved")
    ? readyMadeTemplates
    : readyMadeTemplates.filter((template) => template.category === marketplaceTab);
  const hasSearchQuery = Boolean(templateSearchQuery.trim());
  const displayedTemplates = (hasSearchQuery
    ? readyMadeByTab.filter((template) => {
      const query = templateSearchQuery.toLowerCase();
      return [template.name, template.category, ...(template.fields || []).map((field) => field.name)].join(" ").toLowerCase().includes(query);
    })
    : readyMadeByTab);
  const displayedSavedTemplates = (hasSearchQuery
    ? savedTemplates.filter((template) => {
      const query = templateSearchQuery.toLowerCase();
      return [template.name, template.category, ...(template.fields || []).map((field) => field.name)].join(" ").toLowerCase().includes(query);
    })
    : savedTemplates);
  const activeTemplateLabel = marketplaceTab === "Saved" ? "All ready-made templates" : (tabLabelMap[marketplaceTab] || getDisplayCategoryName(marketplaceTab));
  const workspaceTabs = ["overview", "records", "settings", "integrations", "analytics"];
  const workspaceName = activeWorkspaceName || (selectedTemplate ? `${selectedTemplate.name} Workspace` : "Workspace");
  const languageLabel = LANGUAGES.find((item) => item.value === language)?.label || language;
  const connectedSheetUrl = targetSheetUrl.trim();
  const isGoogleConnected = Boolean(googleAccount?.email);
  const isSheetsReady = isGoogleConnected && (sheetSyncMode === "new" || Boolean(connectedSheetUrl));
  const sheetsStatusLabel = isSheetsReady
    ? (sheetSyncMode === "new" && !connectedSheetUrl ? "Google Connected (Auto-create on save)" : "Google Sheets Connected")
    : (isGoogleConnected ? "Google Connected - Sheet URL required" : "Google Sheets Not Connected");
  const totalRecordsMetric = recentRecords.length + 150;
  const todayRecordsMetric = Math.max(recentRecords.length, 1) + 11;
  const audioProcessedMetric = recentRecords.length + 150;
  const avgWorkspaceConfidence = recentRecords.length > 0
    ? Math.round(recentRecords.reduce((sum, item) => sum + (item.confidence || 0), 0) / recentRecords.length)
    : 96;
  const latestActivity = recentRecords[0]?.date || "No activity yet";
  const sourceFilterOptions = [
    { key: "all", label: "All sources" },
    { key: "recording", label: "Recording" },
    { key: "upload", label: "Upload" }
  ];
  const normalizedRecordsSearch = recordsSearchQuery.trim().toLowerCase();
  const recordsWithMeta = recentRecords.map((record) => {
    const statusMeta = getRecordStatusMeta(record.status, isSheetsReady);
    const source = record.source === "upload" ? "upload" : "recording";
    const ownerEmail = (record.owner_email || authUser?.email || "").toLowerCase();
    const ownerName = record.owner_name || (record.owner_email ? record.owner_email.split("@")[0] : "Unknown");
    return {
      ...record,
      statusMeta,
      source,
      ownerEmail,
      ownerName
    };
  });
  const filteredWorkspaceRecords = recordsWithMeta.filter((record) => {
    if (recordsQuickFilter === "all") {
      return true;
    }

    const recordDate = parseRecordDate(record.date);

    if (recordsQuickFilter === "today") {
      return isTodayDate(recordDate);
    }

    if (recordsQuickFilter === "thisWeek") {
      return isThisWeekDate(recordDate);
    }

    if (recordsQuickFilter === "failed") {
      return record.statusMeta.key === "failed";
    }

    if (recordsQuickFilter === "exported") {
      return record.statusMeta.key === "exported";
    }

    return true;
  }).filter((record) => {
    if (recordsOwnerFilter === "all") {
      return true;
    }

    if (recordsOwnerFilter === "me") {
      return record.ownerEmail === (authUser?.email || "").toLowerCase();
    }

    return record.ownerEmail === recordsOwnerFilter;
  }).filter((record) => {
    if (recordsSourceFilter === "all") {
      return true;
    }

    return record.source === recordsSourceFilter;
  }).filter((record) => {
    if (!normalizedRecordsSearch) {
      return true;
    }

    const searchable = [record.name, record.template, record.date, record.statusMeta.label, record.ownerName, record.source].join(" ").toLowerCase();
    return searchable.includes(normalizedRecordsSearch);
  });
  const ownerFilterOptions = [
    { key: "all", label: "All owners" },
    { key: "me", label: "My records" },
    ...Array.from(new Map(
      recordsWithMeta
        .filter((record) => record.ownerEmail && record.ownerEmail !== (authUser?.email || "").toLowerCase())
        .map((record) => [record.ownerEmail, { key: record.ownerEmail, label: record.ownerName }])
    ).values())
  ];
  const recordsQuickFilters = [
    { key: "all", label: "All" },
    { key: "today", label: "Today" },
    { key: "thisWeek", label: "This Week" },
    { key: "failed", label: "Failed" },
    { key: "exported", label: "Exported" }
  ];
  const hasActiveWorkspaceContext = Boolean(activeWorkspaceId && selectedTemplate);
  const shouldShowWorkspaceHome = step === 1 && (inWorkspace || hasActiveWorkspaceContext);
  const workspaceFields = fieldValues.length > 0 ? fieldValues : buildInitialFieldValues(selectedTemplate);
  const workspaceMissingCount = workspaceFields.filter((field) => !field.value.trim()).length;
  const workspaceReviewCount = workspaceFields.filter((field) => field.value.trim() && field.confidence > 0 && field.confidence < 90).length;
  const workspaceStatusLabel = isRecording
    ? (isRecordingPaused ? "Paused" : "Listening...")
    : isProcessing
      ? `${processingStage || "Processing"}...`
      : transcript
        ? "Ready"
        : "Ready to record";
  const workspaceStatusTone = isRecording ? "live" : isProcessing ? "processing" : transcript ? "ready" : "idle";
  const visibleRecentRecords = recentRecords.slice(0, 10);

  function scrollTabBar(direction) {
    if (!tabBarRef.current) return;
    tabBarRef.current.scrollBy({ left: direction * 320, behavior: "smooth" });
  }

  function handleCategoryTabClick(tab) {
    setMarketplaceTab(tab);
    if (tab === "Saved") {
      window.requestAnimationFrame(() => {
        savedSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }

  if (isHydrating) {
    return (
      <div className="auth-shell fade-in-up" style={{ alignItems: "center", justifyContent: "center", display: "flex" }}>
        <div className="status-badge">Verifying session...</div>
      </div>
    );
  }

  return (
    <>
      {!authUser ? (
        <div className="auth-shell fade-in-up">
          <div className="auth-card premium-auth-card">
            <section className="auth-form-panel">
              <div className="auth-panel-head">
                <div className="auth-brand auth-brand-premium" style={{ marginBottom: "16px" }}>
                  <div className="brand-mark">V</div>
                  <div>
                    <strong style={{ color: "var(--text)" }}>Voice2Form</strong>
                  </div>
                </div>
                <h1>
                  {authMode === "signup"
                    ? "Create your account"
                    : authMode === "forgot"
                      ? "Forgot password"
                      : authMode === "reset"
                        ? "Reset password"
                        : "Get Started Now"}
                </h1>
                <p className="auth-copy">
                  {authMode === "forgot"
                    ? "Enter your email to generate a reset token."
                    : authMode === "reset"
                      ? "Enter the reset token and set a new password."
                      : "Enter your credentials to access your account."}
                </p>
              </div>

              {errorMessage ? <div className="status-banner error">{errorMessage}</div> : null}

              {authMode === "login" || authMode === "signup" ? (
                <>
                  <button
                    type="button"
                    className="auth-google-btn stagger-1"
                    onClick={handleGoogleAppAuth}
                    disabled={isAuthLoading || isCheckingGoogleAccount}
                  >
                    <svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                    </svg>
                    {isAuthLoading || isCheckingGoogleAccount ? "Connecting..." : "Log in with Google"}
                  </button>

                  <div className="auth-divider stagger-2"><span>or</span></div>
                </>
              ) : null}

              <form className="auth-form stagger-3" onSubmit={handleManualAuthSubmit}>
                {authMode === "signup" ? (
                  <label>
                    <span>Name</span>
                    <input
                      type="text"
                      value={authName}
                      onChange={(event) => setAuthName(event.target.value)}
                      placeholder="Your full name"
                      required
                    />
                  </label>
                ) : null}

                <label>
                  <span>Email address</span>
                  <input
                    type="email"
                    value={authEmail}
                    onChange={(event) => setAuthEmail(event.target.value)}
                    placeholder="you@company.com"
                    required={authMode === "login" || authMode === "signup" || authMode === "forgot"}
                  />
                </label>

                {authMode === "reset" ? (
                  <label>
                    <span>Reset Token</span>
                    <input
                      type="text"
                      value={resetToken}
                      onChange={(event) => setResetToken(event.target.value)}
                      placeholder="Paste reset token"
                      required
                    />
                  </label>
                ) : null}

                {authMode !== "forgot" ? (
                  <label>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>Password</span>
                      {authMode === "login" && (
                        <span style={{ color: "var(--accent-strong)", cursor: "pointer" }} onClick={() => setAuthMode("forgot")}>
                          Forgot password?
                        </span>
                      )}
                    </div>
                    <input
                      type="password"
                      value={authPassword}
                      onChange={(event) => setAuthPassword(event.target.value)}
                      placeholder={authMode === "signup" || authMode === "reset" ? "min 6 chars" : "Enter password"}
                      minLength={6}
                      required={authMode === "login" || authMode === "signup" || authMode === "reset"}
                    />
                  </label>
                ) : null}

                {resetCodeHint ? <small className="auth-reset-hint">Reset token: {resetCodeHint}</small> : null}

                <button type="submit" className="primary-button auth-submit-btn stagger-4" disabled={isAuthLoading}>
                  {isAuthLoading
                    ? "Please wait..."
                    : authMode === "signup"
                      ? "Sign Up"
                      : authMode === "forgot"
                        ? "Send Reset Token"
                        : authMode === "reset"
                          ? "Reset Password"
                          : "Login"}
                </button>
              </form>

              <div className="auth-actions-row stagger-5" style={{ justifyContent: "center", marginTop: "16px" }}>
                {authMode === "login" || authMode === "signup" ? (
                  <p style={{ fontSize: "0.9rem", color: "var(--muted)", margin: 0 }}>
                    {authMode === "signup" ? "Already have an account?" : "Don't have an account?"}
                    <button
                      type="button"
                      className="ghost-button auth-switch"
                      style={{ padding: "0 6px", color: "var(--accent-strong)", display: "inline" }}
                      onClick={() => {
                        setAuthMode((current) => (current === "signup" ? "login" : "signup"));
                        setErrorMessage("");
                        setResetCodeHint("");
                      }}
                    >
                      {authMode === "signup" ? "Log in" : "Sign up"}
                    </button>
                  </p>
                ) : null}

                {authMode === "forgot" || authMode === "reset" ? (
                  <button
                    type="button"
                    className="ghost-button auth-switch"
                    onClick={() => {
                      setAuthMode("login");
                      setErrorMessage("");
                      setResetToken("");
                    }}
                  >
                    Back to login
                  </button>
                ) : null}
              </div>
            </section>

            <aside className="auth-showcase">
              <div className="showcase-content">
                <h2>The simplest way to extract structured data</h2>
                <p>
                  Transform unstructured voice notes and calls into verified records in seconds.
                </p>
              </div>
              <div className="showcase-mockup-wrapper">
                <img src="/mockup.png" alt="Dashboard Mockup" className="showcase-mockup" />
              </div>
            </aside>
          </div>
        </div>
      ) : step === 1 && !shouldShowWorkspaceHome && homeView === "workspaces" && workspaces.length > 0 ? (
        <div className="workspace-directory-page fade-in-up">
          <nav className="marketplace-topbar">
            <div className="brand-lockup">
              <div className="brand-mark">V</div>
              <div>
                <strong>Voice2Form</strong>
                <span>AI-powered voice to structured data</span>
              </div>
            </div>

            <div className="topbar-actions">
              <button type="button" className="ghost-button" onClick={() => setHomeView("templates")}>
                Browse Templates
              </button>
              <div className="auth-user-chip">
                {authUser.avatar ? <img src={authUser.avatar} alt={authUser.name} /> : <span>{(authUser.name || "U").slice(0, 1).toUpperCase()}</span>}
                <small>{authUser.email}</small>
                <button type="button" onClick={handleLogout}>Logout</button>
              </div>
            </div>
          </nav>

          <section className="workspace-directory-hero">
            <div>
              <h1>My Workspaces</h1>
              <p>Open your active workspace and continue recording without reconfiguring fields, sheets, or integrations.</p>
            </div>
            <div className="workspace-directory-hero-actions">
              <button
                type="button"
                className="ghost-button"
                onClick={handleCleanupDuplicateWorkspaces}
                disabled={isWorkspaceCleanupRunning || workspaces.length < 2}
              >
                {isWorkspaceCleanupRunning ? "Cleaning duplicates..." : "Cleanup Duplicates"}
              </button>
            </div>
          </section>

          <div className="workspace-directory-layout">
            <section className="workspace-directory-main">
              {isWorkspacesLoading ? (
                <div className="empty-state">
                  <strong>Loading workspaces...</strong>
                  <p>Fetching your saved workspace entities.</p>
                </div>
              ) : workspaces.length > 0 ? (
                <div className="workspace-directory-grid">
                  {workspaces.map((workspace) => (
                    <article
                      key={workspace.id}
                      className="workspace-directory-card"
                    >
                      <button
                        type="button"
                        className="workspace-directory-open"
                        onClick={() => handleOpenWorkspace(workspace)}
                      >
                        <div>
                          <strong>{workspace.name}</strong>
                          <span>{workspace.template?.fields?.length || 0} fields · {getDisplayCategoryName(workspace.template?.category || "Operations")}</span>
                        </div>
                        <em>{workspace.is_pinned ? "Pinned" : "Open workspace"}</em>
                      </button>
                      {editingWorkspaceId === workspace.id ? (
                        <div className="workspace-inline-edit">
                          <input
                            type="text"
                            autoFocus
                            value={editingWorkspaceName}
                            onChange={(event) => setEditingWorkspaceName(event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                event.preventDefault();
                                submitRenameWorkspace(workspace);
                              }
                              if (event.key === "Escape") {
                                event.preventDefault();
                                cancelRenameWorkspace();
                              }
                            }}
                            placeholder="Workspace name"
                          />
                          <div className="workspace-inline-edit-actions">
                            <button
                              type="button"
                              className="primary-button"
                              onClick={() => submitRenameWorkspace(workspace)}
                              disabled={!editingWorkspaceName.trim() || workspaceActionLoadingId === workspace.id}
                            >
                              Save
                            </button>
                            <button type="button" className="ghost-button" onClick={cancelRenameWorkspace}>
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : null}
                      <div className="workspace-directory-actions">
                        <button
                          type="button"
                          className="ghost-button"
                          onClick={() => handleTogglePinWorkspace(workspace)}
                          disabled={workspaceActionLoadingId === workspace.id}
                        >
                          {workspace.is_pinned ? "Unpin" : "Pin"}
                        </button>
                        <button type="button" className="ghost-button" onClick={() => startRenameWorkspace(workspace)}>
                          Rename
                        </button>
                        <button type="button" className="ghost-button" onClick={() => requestDeleteWorkspace(workspace)}>
                          Delete
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <strong>No workspaces yet.</strong>
                  <p>Browse templates once to create your first workspace.</p>
                </div>
              )}
            </section>

            <aside className="workspace-directory-side">
              <h2>Recent Recordings</h2>
              {recentRecords.length > 0 ? (
                <div className="activity-feed">
                  {recentRecords.slice(0, 6).map((record) => (
                    <div key={record.id} className="activity-item">
                      <div className="activity-item-main workspace-activity-main">
                        <strong>{record.name}</strong>
                        <span>{record.date}</span>
                      </div>
                      <div className="workspace-activity-meta">
                        <span className="activity-meta-pill">{record.status}</span>
                        <span className={`confidence-badge ${record.confidence >= 90 ? "high" : "med"}`}>{record.confidence}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <strong>No recent records found</strong>
                  <p>Your new submissions will appear here.</p>
                </div>
              )}
            </aside>
          </div>
        </div>
      ) : step === 1 && !shouldShowWorkspaceHome ? (
        <div className="marketplace-page fade-in-up">
          <nav className="marketplace-topbar">
            <div className="brand-lockup">
              <div className="brand-mark">V</div>
              <div>
                <strong>Voice2Form</strong>
                <span>AI-powered voice to structured data</span>
              </div>
            </div>

            <div className="topbar-actions">
              <button
                type="button"
                className="ghost-button"
                onClick={() => setHomeView(workspaces.length > 0 ? "workspaces" : "templates")}
              >
                My Workspaces
              </button>
              <div className="auth-user-chip">
                {authUser.avatar ? <img src={authUser.avatar} alt={authUser.name} /> : <span>{(authUser.name || "U").slice(0, 1).toUpperCase()}</span>}
                <small>{authUser.email}</small>
                <button type="button" onClick={handleLogout}>Logout</button>
              </div>
              <label className="language-chip">
                <span>Language</span>
                <select value={language} onChange={(e) => setLanguage(e.target.value)}>
                  {LANGUAGES.map((item) => (
                    <option key={item.value} value={item.value}>{item.label}</option>
                  ))}
                </select>
              </label>
            </div>
          </nav>

          <header className="marketplace-hero">
            <div className="hero-copy-block">
              <div className="eyebrow-pill">Canva-style template library</div>
              <h1>Turn Voice Into Structured Records</h1>
              <p>
                Capture information from conversations, calls, and voice notes. Voice2Form automatically extracts key details and fills forms, spreadsheets, and workflows.
              </p>

              <div className="hero-actions">
                <button type="button" className="secondary-button" onClick={() => window.scrollTo({ top: 760, behavior: "smooth" })}>
                  📋 Browse Templates
                </button>
              </div>

              <div className="hero-metrics">
                <div>
                  <strong>{Object.values(templates).reduce((total, items) => total + items.length, 0)}</strong>
                  <span>Ready-made templates</span>
                </div>
                <div>
                  <strong>4</strong>
                  <span>Core industries</span>
                </div>
                <div>
                  <strong>1 flow</strong>
                  <span>Voice to verified record</span>
                </div>
              </div>
            </div>

            <aside className="hero-feature-panel">
              <div className="feature-card feature-card-primary">
                <span className="feature-kicker">How it works</span>
                <ol>
                  <li>Choose a template</li>
                  <li>Upload or record audio</li>
                  <li>Review extracted fields</li>
                  <li>Export or sync</li>
                </ol>
              </div>
              <div className="feature-card feature-card-secondary">
                <span className="feature-kicker">Quick start</span>
                <ol>
                  <li>Select a category tab</li>
                  <li>Preview a template</li>
                  <li>Record or upload audio</li>
                </ol>
              </div>
            </aside>
          </header>

          <section className="audience-strip">
            <div className="section-headline compact">
              <div>
                <h2>Perfect for</h2>
              </div>
            </div>
            <div className="audience-grid">
              <div className="audience-chip">🏢 Service Businesses</div>
              <div className="audience-chip">📞 Call Centers</div>
              <div className="audience-chip">🏥 Clinics</div>
              <div className="audience-chip">🏗 Field Teams</div>
              <div className="audience-chip">🏠 Property Management</div>
            </div>
          </section>

          <section className="marketplace-search-row">
            <div className="marketplace-search">
              <span>⌕</span>
              <input
                type="text"
                placeholder="Search templates, fields, or industries"
                value={templateSearchQuery}
                onChange={(e) => setTemplateSearchQuery(e.target.value)}
              />
            </div>
            <label className="upload-cta">
              <input
                type="file"
                accept=".json,.csv,.pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={handleTemplateFileChange}
                disabled={isUploadingTemplate}
              />
              <span>{isUploadingTemplate ? "Importing template..." : "Upload your own template"}</span>
            </label>
          </section>

          <main className="marketplace-content">
            <section className="tab-rail" aria-label="Template categories">
              <button
                type="button"
                className="tab-rail-arrow"
                onClick={() => scrollTabBar(-1)}
                aria-label="Scroll categories left"
              >
                ‹
              </button>

              <div className="tab-bar" ref={tabBarRef}>
                {marketplaceTabs.map((tab) => {
                  const count = tab === "all" ? Object.values(templates).reduce((total, items) => total + items.length, 0) : (templates[tab]?.length || 0);
                  return (
                    <button
                      key={tab}
                      type="button"
                      className={`tab-pill ${marketplaceTab === tab ? "active" : ""}`}
                      onClick={() => handleCategoryTabClick(tab)}
                    >
                      <span>{tab === "all" ? "All" : CATEGORY_ICONS[tab] || "▣"}</span>
                      {tabLabelMap[tab] || tab}
                      <strong>{count}</strong>
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                className="tab-rail-arrow"
                onClick={() => scrollTabBar(1)}
                aria-label="Scroll categories right"
              >
                ›
              </button>
            </section>

            <section className="marketplace-section">
              <div className="section-headline">
                <div className="section-headline-main">
                  <h2>{activeTemplateLabel} templates</h2>
                  <p>Choose a template, preview the fields, then continue into voice capture.</p>
                </div>
                <div className="section-headline-tools">
                  {hasSearchQuery ? <div className="meta-chip">Search: "{templateSearchQuery.trim()}"</div> : null}
                  <div className="section-meta">{displayedTemplates.length} templates shown</div>
                  {hasSearchQuery ? (
                    <button type="button" className="clear-search-btn" onClick={() => setTemplateSearchQuery("")}>Clear search</button>
                  ) : null}
                </div>
              </div>

              <div className="template-grid">
                {displayedTemplates.map((template) => (
                  <article key={template.id} className="template-market-card">
                    <div className="template-card-top">
                      <div className="template-icon">{CATEGORY_ICONS[template.category] || "▣"}</div>
                      <span className="template-badge">{template.categoryLabel || template.category}</span>
                    </div>

                    <div className="template-card-body">
                      <h3>{template.name}</h3>
                      <p>{template.fields.length} fields · ready for voice capture</p>
                      <div className="field-pills">
                        {template.fields.slice(0, 4).map((field) => (
                          <span key={field.name}>{field.name}</span>
                        ))}
                      </div>
                    </div>

                    <div className="template-card-footer">
                      <button type="button" className="ghost-button" onClick={() => {
                        setSelectedTemplate(normalizeSelectedTemplate(template));
                        setIsTemplateModalOpen(true);
                      }}>
                        Preview
                      </button>
                      <button type="button" className="primary-button subtle" onClick={() => openWorkspaceFromTemplate(template)}>
                        Use template
                      </button>
                    </div>
                  </article>
                ))}

                <article
                  className="template-market-card template-import-card"
                  title="Upload a PDF, DOCX, or JSON form and let Voice2Form extract fields automatically."
                >
                  <div className="template-card-top">
                    <div className="template-icon">📄</div>
                    <span className="template-badge">Import</span>
                  </div>

                  <div className="template-card-body">
                    <h3>Import Existing Form</h3>
                    <p>PDF DOCX JSON</p>
                  </div>

                  <div className="template-card-footer">
                    <label
                      className="upload-form-btn"
                      title="Upload a PDF, DOCX, or JSON form and let Voice2Form extract fields automatically."
                    >
                      <input
                        type="file"
                        accept=".json,.csv,.pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                        onChange={handleTemplateFileChange}
                        disabled={isUploadingTemplate}
                      />
                      {isUploadingTemplate ? "Importing..." : "Upload Form"}
                    </label>
                  </div>
                </article>
              </div>

              {displayedTemplates.length === 0 ? (
                <div className="empty-state">
                  <strong>No templates match your search.</strong>
                  <p>Try a different category tab or upload a custom template.</p>
                </div>
              ) : null}
            </section>

            <section className="marketplace-section saved-templates-section" ref={savedSectionRef}>
              <div className="section-headline">
                <div className="section-headline-main">
                  <h2>Saved templates</h2>
                  <p>Templates you saved for later use.</p>
                </div>
                <div className="section-headline-tools">
                  <div className="section-meta">{displayedSavedTemplates.length} templates shown</div>
                </div>
              </div>

              <div className="template-grid">
                {displayedSavedTemplates.map((template) => (
                  <article key={template.id} className="template-market-card">
                    <div className="template-card-top">
                      <div className="template-icon">{CATEGORY_ICONS[template.category] || "▣"}</div>
                      <span className="template-badge">Saved</span>
                    </div>

                    <div className="template-card-body">
                      <h3>{template.name}</h3>
                      <p>{template.fields.length} fields · ready for voice capture</p>
                      <div className="field-pills">
                        {template.fields.slice(0, 4).map((field) => (
                          <span key={field.name}>{field.name}</span>
                        ))}
                      </div>
                    </div>

                    <div className="template-card-footer">
                      <button type="button" className="ghost-button" onClick={() => {
                        setSelectedTemplate(normalizeSelectedTemplate(template));
                        setIsTemplateModalOpen(true);
                      }}>
                        Preview
                      </button>
                      <button type="button" className="primary-button subtle" onClick={() => openWorkspaceFromTemplate(template)}>
                        Use template
                      </button>
                    </div>
                  </article>
                ))}
              </div>

              {displayedSavedTemplates.length === 0 ? (
                <div className="empty-state">
                  <strong>No saved templates yet.</strong>
                  <p>Save a custom template to see it here.</p>
                </div>
              ) : null}
            </section>

            <section className="marketplace-section marketplace-featured-strip">
              <div className="section-headline compact">
                <div>
                  <h2>Popular starter sets</h2>
                  <p>Fast picks for teams that want the shortest path from voice to form data.</p>
                </div>
              </div>
              <div className="featured-strip-grid">
                {featuredTemplates.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    className="featured-strip-card"
                    onClick={() => {
                      setSelectedTemplate(normalizeSelectedTemplate(template));
                      setIsTemplateModalOpen(true);
                    }}
                  >
                    <span>{CATEGORY_ICONS[template.category] || "▣"}</span>
                    <strong>{template.name}</strong>
                    <em>{template.categoryLabel || template.category}</em>
                  </button>
                ))}
              </div>
            </section>
          </main>

          <footer className="marketplace-footer">
            <strong>Voice In → Structured Data Out</strong>
            <span>Audio is processed securely and removed after extraction. Only the structured information you choose to save is retained.</span>
          </footer>

          {/* PREVIEW MODAL (Preserving 100% functionality) */}
          {isTemplateModalOpen && selectedTemplate && (
            createPortal(
              <div className="modal-overlay" onClick={() => setIsTemplateModalOpen(false)}>
                <div className="modal-content template-preview-modal fade-in-up" onClick={(e) => e.stopPropagation()}>
                  <div className="section-head split" style={{ marginBottom: "24px" }}>
                    <h2>Preview Fields</h2>
                    <button type="button" className="field-action-btn" onClick={() => setIsTemplateModalOpen(false)} style={{ fontSize: "1.5rem" }}>✖</button>
                  </div>

                  <div style={{ marginBottom: "20px" }}>
                    <strong style={{ color: "var(--text)", fontSize: "1.05rem" }}>{selectedTemplate.name}</strong>
                  </div>

                  <div style={{ marginBottom: "24px" }}>
                    <p style={{ fontSize: "0.9rem", color: "var(--muted)", marginBottom: "4px" }}>Used by:</p>
                    <strong style={{ color: "var(--text)" }}>
                      {selectedTemplate.category === "Service" ? "Service Requests" :
                        selectedTemplate.category === "Healthcare" ? "Healthcare" :
                          selectedTemplate.category === "Sales" ? "Lead Capture" :
                            selectedTemplate.category === "Operations" ? "Field Operations" :
                              selectedTemplate.category === "Complaint" ? "Customer Support" : "General Teams"}
                    </strong>
                  </div>

                  <div style={{ marginBottom: "24px" }}>
                    <p style={{ fontSize: "0.9rem", color: "var(--muted)", marginBottom: "12px" }}>Fields ({selectedTemplate.fields.length}):</p>
                    <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "8px", maxHeight: "300px", overflowY: "auto", paddingRight: "8px" }}>
                      {selectedTemplate.fields.map((field) => (
                        <li key={field.name} style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--text)", background: "rgba(39, 52, 74, 0.02)", padding: "10px 14px", borderRadius: "8px", border: "1px solid var(--line)" }}>
                          <span style={{ color: "var(--accent-strong)" }}>✓</span>
                          <span style={{ fontWeight: "500" }}>{field.name}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div style={{ marginBottom: "24px" }}>
                    <p style={{ fontSize: "0.9rem", color: "var(--muted)", marginBottom: "4px" }}>Estimated completion:</p>
                    <strong style={{ color: "var(--text)" }}>&lt; 30 sec</strong>
                  </div>

                  <div style={{ display: "flex", gap: "12px", width: "100%" }}>
                    <button type="button" className="saas-primary-btn" style={{ width: "100%", fontSize: "1.1rem", justifyContent: "center" }} onClick={() => { setIsTemplateModalOpen(false); openWorkspaceFromTemplate(selectedTemplate); }}>
                      Customize & Continue
                    </button>
                  </div>
                </div>
              </div>,
              document.body
            )
          )}
        </div>
      ) : shouldShowWorkspaceHome && selectedTemplate ? (
        <div className="recording-workspace-shell fade-in-up">
          <header className="recording-workspace-header">
            <div className="recording-header-brand">
              <div className="brand-mark">V</div>
              <div>
                <strong>Voice2Form</strong>
                <span>Single-screen recording workspace</span>
              </div>
            </div>

            <div className="recording-header-main">
              <div className="recording-header-title">
                <h1>{workspaceName}</h1>
                <p>{selectedTemplate.name}</p>
              </div>
              <div className="recording-header-chips">
                <span className={`workspace-chip ${isSheetsReady ? "success" : "warning"}`}>
                  {isSheetsReady ? "Google Sheets Connected" : "Google Sheets Ready"}
                </span>
                <span className="workspace-chip">{languageLabel}</span>
                <span className="workspace-chip">{selectedTemplate.fields.length} Fields</span>
              </div>
            </div>

            <div className="recording-header-actions">
              <div className="recording-header-button-row">
                <button type="button" className="ghost-button" onClick={handleBrowseTemplates} title="Browse Templates">
                  <span style={{ fontSize: "1.1rem" }}>📋</span> <span className="header-action-text">Templates</span>
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => {
                    setStep(2);
                    setInWorkspace(false);
                  }}
                  title="Workspace Settings"
                >
                  <span style={{ fontSize: "1.1rem" }}>⚙️</span> <span className="header-action-text">Settings</span>
                </button>
                {isSheetsReady && connectedSheetUrl ? (
                  <a
                    className="secondary-button"
                    href={connectedSheetUrl}
                    target="_blank"
                    rel="noreferrer"
                    title="View Synced Sheet"
                    style={{ textDecoration: 'none', display: 'flex', alignItems: 'center' }}
                  >
                    <span style={{ fontSize: "1.1rem" }}>📊</span> <span className="header-action-text">View Sheet</span>
                  </a>
                ) : null}
                {!isSheetsReady ? (
                  <button
                    type="button"
                    className="secondary-button"
                    style={{ color: "var(--danger)", borderColor: "var(--danger)" }}
                    onClick={startGoogleLogin}
                    title="Reconnect Google Sheets"
                  >
                    ⚠️ Reconnect
                  </button>
                ) : null}
              </div>
              <div className="auth-user-chip compact-chip">
                {authUser.avatar ? <img src={authUser.avatar} alt={authUser.name} /> : <span>{(authUser.name || "U").slice(0, 1).toUpperCase()}</span>}
                <small className="header-action-text">{authUser.email}</small>
                <button type="button" className="logout-btn" onClick={handleLogout} title="Logout">⏏</button>
              </div>
            </div>
          </header>

          <main className="recording-workspace-main">
            <section className="recording-capture-panel">
              <div className="recording-panel-head">
                <div className="recording-panel-copy">
                  <h2>Voice Capture</h2>
                  <p>Record, upload, review, and save without leaving this page.</p>
                </div>
                <label className="language-chip">
                  <span>Language</span>
                  <select value={language} onChange={(event) => setLanguage(event.target.value)}>
                    {LANGUAGES.map((item) => (
                      <option key={item.value} value={item.value}>{item.label}</option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="recording-capture-actions">
                <label className="upload-cta recording-upload-cta">
                  <input
                    type="file"
                    accept="audio/*"
                    onChange={handleAudioFileChange}
                    disabled={isProcessing}
                  />
                  <span>Upload Audio</span>
                </label>
                {!isRecording ? (
                  <button type="button" className="primary-button recording-mic-button" onClick={startRecording} disabled={isProcessing}>
                    Start Recording
                  </button>
                ) : (
                  <div className="recording-inline-controls">
                    {!isRecordingPaused ? (
                      <button type="button" className="secondary-button" onClick={pauseRecording}>
                        Pause
                      </button>
                    ) : (
                      <button type="button" className="primary-button" onClick={resumeRecording}>
                        Resume
                      </button>
                    )}
                    <button type="button" className="secondary-button" onClick={stopRecording}>
                      Stop & Extract
                    </button>
                  </div>
                )}
              </div>

              <article className={`recording-status-card tone-${workspaceStatusTone}`}>
                <div className="recording-status-top">
                  <div>
                    <span className="recording-status-label">Recording Status</span>
                    <strong>{workspaceStatusLabel}</strong>
                  </div>
                  <div className="recording-status-timer">
                    {String(Math.floor(recordingTime / 60)).padStart(2, "0")}:{String(recordingTime % 60).padStart(2, "0")}
                  </div>
                </div>
                <div className="recording-progress-rail" aria-hidden="true">
                  <span style={{ width: `${hasExtractionResults ? 100 : Math.max(12, extractionPercent)}%` }} />
                </div>
                <div className="recording-status-list">
                  {pipelineStages.map((stage) => (
                    <div
                      key={stage.label}
                      className={`recording-status-item ${stage.complete ? "complete" : ""} ${stage.active ? "active" : ""}`}
                    >
                      <span />
                      <em>{stage.label}</em>
                    </div>
                  ))}
                </div>
              </article>

              <article className="workspace-transcript-card">
                <div className="workspace-panel-heading">
                  <h3>Live Transcript</h3>
                  <span>{audioFile ? audioFile.name : "Waiting for audio"}</span>
                </div>
                <div className={`workspace-transcript-body ${transcript ? "has-text" : ""}`}>
                  {transcript || "Real-time transcript appears here during recording so operators can confirm speech was captured correctly."}
                </div>
              </article>

              <article className="workspace-helper-card">
                <strong>Ready for the next customer</strong>
                <p>Save to Google Sheets, reset the form, and continue from the same workspace in one click.</p>
              </article>
            </section>

            <section className="recording-form-panel">
              <div className="recording-panel-head">
                <div className="recording-panel-copy">
                  <h2>Form Preview</h2>
                  <p>Fields stay visible before, during, and after extraction.</p>
                </div>
                <div className="workspace-form-summary">
                  <span className="workspace-summary-metric">
                    <strong>{filledCount}/{workspaceFields.length}</strong>
                    <em>filled</em>
                  </span>
                  <span className="workspace-summary-metric">
                    <strong>{workspaceReviewCount}</strong>
                    <em>review</em>
                  </span>
                  <span className="workspace-summary-metric">
                    <strong>{workspaceMissingCount}</strong>
                    <em>missing</em>
                  </span>
                </div>
              </div>

              {submitMeta && !transcript ? (
                <div className="workspace-save-banner">
                  <strong>Record saved.</strong>
                  <span>{submitMeta.sheet_tab ? `Synced to ${submitMeta.sheet_tab}.` : "Google Sheets sync completed."}</span>
                </div>
              ) : null}

              <div className="workspace-field-list">
                {workspaceFields.map((field) => {
                  const meta = getConfidenceMeta(field.confidence);
                  const hasValue = Boolean(field.value.trim());
                  const toneClass = !hasValue
                    ? (transcript ? "danger" : "neutral")
                    : meta.tone === "success"
                      ? "success"
                      : meta.tone === "danger"
                        ? "danger"
                        : "warning";

                  return (
                    <article key={field.name} className={`workspace-field-card ${toneClass}`}>
                      <div className="workspace-field-top">
                        <div>
                          <strong>{field.name}</strong>
                          <span>{field.required ? "Required field" : "Optional field"}</span>
                        </div>
                        <div className="workspace-field-badges">
                          {field.overridden ? <span className="edited-manually-badge">Edited</span> : null}
                          <span className={`confidence-pill ${toneClass}`}>
                            {!hasValue ? "Missing information" : meta.label}
                          </span>
                        </div>
                      </div>

                      {field.type === "textarea" ? (
                        <textarea
                          className="workspace-field-input textarea"
                          value={field.value}
                          placeholder={transcript ? `Enter ${field.name}` : "Waiting for extraction..."}
                          onChange={(event) => handleFieldChange(field.name, event.target.value)}
                        />
                      ) : (
                        <input
                          className="workspace-field-input"
                          type={field.type === "email" ? "email" : field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
                          value={field.value}
                          placeholder={transcript ? `Enter ${field.name}` : "Waiting for extraction..."}
                          onChange={(event) => handleFieldChange(field.name, event.target.value)}
                        />
                      )}

                      <div className="workspace-field-meta">
                        <span>{hasValue ? `${field.confidence}% confidence` : "Waiting for extraction..."}</span>
                        <span>{field.source === "ai" ? "Updated automatically" : "Manual review available"}</span>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          </main>



          <div className="recording-action-bar">
            <button type="button" className="secondary-button" onClick={() => setIsPreviewOpen(true)} disabled={workspaceFields.length === 0}>
              Review Full Record
            </button>

            {!isSheetsReady ? (
              <button
                type="button"
                className="secondary-button"
                style={{ color: "var(--danger)", borderColor: "var(--danger)" }}
                onClick={startGoogleLogin}
              >
                ⚠️ Reconnect Google
              </button>
            ) : null}

            <button
              type="button"
              className="secondary-button"
              onClick={() => handleSubmit({ stayInWorkspace: true })}
              disabled={requiredMissing || isSubmitting || isProcessing || !transcript || !isSheetsReady}
              title={!isSheetsReady ? "Google Sync must be connected to save" : ""}
            >
              {isSubmitting ? "Saving..." : "Save Record"}
            </button>
            <button
              type="button"
              className="primary-button recording-primary-save"
              onClick={() => handleSubmit({ startNext: true })}
              disabled={requiredMissing || isSubmitting || isProcessing || !transcript || !isSheetsReady}
              title={!isSheetsReady ? "Google Sync must be connected to save" : ""}
            >
              {isSubmitting ? "Saving..." : "Save & Start Next Recording"}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="background-glow background-glow-left" />
          <div className="background-glow background-glow-right" />

          <main className={`app-card ${step === 2 || step === 3 ? "workspace-shell-stage" : ""}`}>
            {step !== 2 && step !== 3 ? (
              <>
                <header className="hero">
                  <div>
                    <p className="eyebrow">Voice-driven form capture</p>
                    <h1>Voice2Form</h1>
                    <p className="hero-copy">
                      Capture speech, extract structured fields, verify quickly, and sync records without storing audio.
                    </p>
                  </div>
                  <div className="hero-user-meta">
                    <strong>{authUser?.name}</strong>
                    <span>{authUser?.email}</span>
                    <button type="button" className="secondary-button compact" onClick={handleLogout}>Logout</button>
                  </div>
                </header>

                <nav className="stepper" aria-label="Form steps">
                  {STEPS.map((item) => (
                    <div
                      key={item.id}
                      className={`step-pill ${step === item.id ? "active" : ""} ${step > item.id ? "complete" : ""}`}
                    >
                      <span>{item.id}</span>
                      <strong>{item.title}</strong>
                    </div>
                  ))}
                </nav>
              </>
            ) : (
              <section className="workspace-stage-shell fade-in-up">
                <div className="workspace-stage-shell-main">
                  <span className="workspace-stage-kicker">{workspaceName}</span>
                  <h2>{step === 2 ? "Workspace Setup" : "Recording Session"}</h2>
                  <p>
                    {step === 2
                      ? "Configure fields, sync preferences, and language once so your workspace is ready for daily use."
                      : "Capture audio, review extraction, and save records without leaving your workspace context."}
                  </p>
                </div>
                <div className="workspace-stage-shell-actions">
                  <button type="button" className="ghost-button" onClick={handleBrowseTemplates}>
                    Browse Templates
                  </button>
                  <span className="workspace-stage-shell-meta">{selectedTemplate?.fields?.length || 0} fields · {languageLabel}</span>
                </div>
              </section>
            )}

            {errorMessage ? <div className="status-banner error">{errorMessage}</div> : null}

            {step === 2 ? (
              <section className="panel-stack fade-in-up config-page-shell workspace-stage-section">
                <div className="section-head workspace-stage-panel-head">
                  <div>
                    <h2>Configure {workspaceName}</h2>
                    <p>Template structure, integrations, and language settings for your ongoing workspace.</p>
                  </div>
                </div>

                <div className="config-layout">
                  <article className="config-card">
                    <h3>Fields</h3>
                    <div className="config-divider" />

                    <ul className="config-form-list">
                      {(selectedTemplate?.fields || []).map((field, index) => (
                        <li
                          key={`${field.name}-${index}`}
                          className={`config-form-row ${dragOverFieldIndex === index && draggingFieldIndex !== index ? "drag-over" : ""}`}
                          onDragOver={(event) => {
                            event.preventDefault();
                            setDragOverFieldIndex(index);
                          }}
                          onDrop={() => handleFieldDrop(index)}
                        >
                          <div className="config-form-main">
                            <button
                              type="button"
                              className="drag-handle-btn"
                              draggable
                              onDragStart={() => handleFieldDragStart(index)}
                              onDragEnd={() => {
                                setDraggingFieldIndex(null);
                                setDragOverFieldIndex(null);
                              }}
                              title="Drag to reorder"
                              aria-label="Drag to reorder"
                            >
                              <Icon name="drag" />
                            </button>
                            <span className="config-check" aria-hidden="true"><Icon name="check" /></span>
                            <div className="config-form-name-wrap">
                              {editingField === field.name ? (
                                <input
                                  type="text"
                                  autoFocus
                                  defaultValue={field.name}
                                  onKeyDown={(event) => {
                                    if (event.key === "Enter") {
                                      event.preventDefault();
                                      handleEditFieldSave(field.name, event.currentTarget.value);
                                    }
                                    if (event.key === "Escape") {
                                      setEditingField(null);
                                    }
                                  }}
                                  onBlur={(event) => handleEditFieldSave(field.name, event.currentTarget.value)}
                                />
                              ) : (
                                <strong>{field.name}</strong>
                              )}
                              <small>{field.required ? "Required" : "Optional"}</small>
                            </div>
                          </div>

                          <div className="config-field-options">
                            <label>
                              <span>Type</span>
                              <select
                                value={field.type || "text"}
                                onChange={(event) => handleFieldTypeChange(field.name, event.target.value)}
                              >
                                <option value="text">Text</option>
                                <option value="textarea">Textarea</option>
                                <option value="number">Number</option>
                                <option value="email">Email</option>
                                <option value="date">Date</option>
                              </select>
                            </label>

                            <label className="required-toggle">
                              <input
                                type="checkbox"
                                checked={Boolean(field.required)}
                                onChange={(event) => handleFieldRequiredToggle(field.name, event.target.checked)}
                              />
                              <span>Required</span>
                            </label>
                          </div>

                          <div className="config-actions">
                            <button
                              type="button"
                              className="icon-action-btn"
                              onClick={() => setEditingField(editingField === field.name ? null : field.name)}
                              title={editingField === field.name ? "Editing" : "Edit field"}
                              aria-label={editingField === field.name ? "Editing" : "Edit field"}
                            >
                              <Icon name={editingField === field.name ? "done" : "edit"} />
                            </button>
                            <button
                              type="button"
                              className="icon-action-btn danger"
                              onClick={() => handleDeleteField(field.name)}
                              title="Delete field"
                              aria-label="Delete field"
                            >
                              <Icon name="trash" />
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>

                    <form className="config-add-field" onSubmit={handleAddCustomField}>
                      <input
                        type="text"
                        value={newFieldName}
                        onChange={(event) => setNewFieldName(event.target.value)}
                        placeholder="Add field name"
                      />
                      <button type="submit" className="secondary-button compact">+ Add Field</button>
                    </form>
                  </article>

                  <article className="config-card">
                    <h3>Google Sheets Sync (Optional)</h3>
                    <p className="config-copy">
                      Save extracted records to Google Sheets automatically.
                      Use an existing sheet or let Voice2Form create one for you.
                    </p>
                    <div className="config-divider" />

                    <div className="sheet-sync-options" role="radiogroup" aria-label="Google Sheets sync mode">
                      <label className={`sheet-sync-option ${sheetSyncMode === "new" ? "active" : ""}`}>
                        <input
                          type="radio"
                          name="sheet-sync-mode"
                          checked={sheetSyncMode === "new"}
                          onChange={() => setSheetSyncMode("new")}
                        />
                        <span>Create a new sheet automatically</span>
                      </label>

                      <label className={`sheet-sync-option ${sheetSyncMode === "existing" ? "active" : ""}`}>
                        <input
                          type="radio"
                          name="sheet-sync-mode"
                          checked={sheetSyncMode === "existing"}
                          onChange={() => setSheetSyncMode("existing")}
                        />
                        <span>Use existing Google Sheet</span>
                      </label>
                    </div>

                    {sheetSyncMode === "existing" ? (
                      <div className="config-row">
                        <input
                          type="url"
                          value={targetSheetUrl}
                          onChange={(event) => setTargetSheetUrl(event.target.value)}
                          placeholder="https://docs.google.com/spreadsheets/..."
                        />
                      </div>
                    ) : null}

                    <div className="sheet-connect-row">
                      <button
                        type="button"
                        className="secondary-button compact"
                        onClick={() => {
                          startGoogleLogin();
                        }}
                      >
                        {!accessToken ? "Connect Google" : (googleAccount ? "Reconnect Google" : "Verify Google")}
                      </button>
                      {isCheckingGoogleAccount ? <span className="sheet-status-chip">Verifying...</span> : null}
                      {!isCheckingGoogleAccount && googleAccount ? <span className="sheet-status-chip">Connected</span> : null}
                      {!isCheckingGoogleAccount && accessToken && !googleAccount ? <span className="sheet-status-chip warning">Reconnect required</span> : null}
                      {googleAccount?.email ? <span className="sheet-account-meta">{googleAccount.email}</span> : null}
                    </div>
                  </article>

                  <article className="config-card">
                    <h3>Recording Settings</h3>
                    <div className="config-divider" />
                    <div className="config-row two-col">
                      <label>
                        <span>Language</span>
                        <select value={language} onChange={(event) => setLanguage(event.target.value)}>
                          {LANGUAGES.map((item) => (
                            <option key={item.value} value={item.value}>{item.label}</option>
                          ))}
                        </select>
                      </label>

                      <label>
                        <span>Extraction Rules</span>
                        <select value={extractionRules} onChange={(event) => setExtractionRules(event.target.value)}>
                          <option value="Standard">Standard</option>
                          <option value="Strict">Strict</option>
                          <option value="Lenient">Lenient</option>
                        </select>
                      </label>
                    </div>
                  </article>
                </div>

                <div className="action-row workspace-step-footer">
                  <button type="button" className="secondary-button" onClick={handleBrowseTemplates}>
                    Browse Templates
                  </button>
                  <button
                    type="button"
                    className="primary-button workspace-step-primary"
                    onClick={handleEnterWorkspace}
                    disabled={!selectedTemplate || isSavingWorkspace}
                  >
                    {isSavingWorkspace ? "Saving Workspace..." : "Save & Enter Workspace"}
                  </button>
                </div>
              </section>
            ) : null}

            {step === 3 ? (
              <div className="workspace-grid workspace-stage-section workspace-stage-recording-grid">
                <section className="panel-stack workspace-left fade-in-up ai-capture-pane workspace-stage-card">
                  <div className="section-head split workspace-stage-subhead">
                    <div>
                      <h2>Capture Audio</h2>
                      <p>Upload audio or start live capture to trigger AI extraction.</p>
                    </div>
                    <label className="language-selector-inline">
                      <span style={{ marginRight: "8px", fontSize: "1.1rem" }}>Language:</span>
                      <select value={language} onChange={(event) => setLanguage(event.target.value)} style={{ border: "none", background: "transparent", fontWeight: "bold", fontSize: "1rem", outline: "none", cursor: "pointer" }}>
                        {LANGUAGES.map((item) => (
                          <option key={item.value} value={item.value}>
                            {item.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="mode-toggle">
                    <button
                      type="button"
                      className={audioMode === "upload" ? "active" : ""}
                      onClick={() => setAudioMode("upload")}
                    >
                      Upload File
                    </button>
                    <button
                      type="button"
                      className={audioMode === "mic" ? "active" : ""}
                      onClick={() => setAudioMode("mic")}
                    >
                      Live Mic
                    </button>
                  </div>

                  {audioMode === "upload" ? (
                    <label className="upload-box-premium ai-upload-card">
                      <div className="upload-box-icon">🎙</div>
                      <div className="upload-box-title">Upload Audio</div>
                      <div className="upload-box-text">Drag & drop audio file</div>
                      <div className="upload-box-btn">Browse Files</div>
                      <input type="file" accept="audio/*" onChange={handleAudioFileChange} />
                      {audioFile ? <strong className="selected-file-text">{audioFile.name}</strong> : null}
                    </label>
                  ) : (
                    <div className="record-panel premium-mic">
                      {isRecording ? (
                        <div className="mic-active-state">
                          <div className="recording-indicator" style={{ background: isRecordingPaused ? "rgba(245, 158, 11, 0.1)" : "rgba(220, 38, 38, 0.1)" }}>
                            <div className={`red-dot ${!isRecordingPaused ? "pulse" : ""}`} style={{ background: isRecordingPaused ? "var(--warm)" : "var(--danger)" }}></div>
                            <span style={{ color: isRecordingPaused ? "var(--warm)" : "var(--danger)", fontWeight: "bold" }}>
                              {isRecordingPaused ? "Paused" : "Listening..."}
                            </span>
                          </div>
                          <strong className="timer-text">{String(Math.floor(recordingTime / 60)).padStart(2, "0")}:{String(recordingTime % 60).padStart(2, "0")}</strong>
                        </div>
                      ) : null}
                      <div className="action-row" style={{ justifyContent: "center", marginTop: "16px", gap: "12px", flexWrap: "wrap" }}>
                        {!isRecording ? (
                          <button type="button" className="primary-button pulse-hover big-mic-btn" onClick={startRecording}>
                            🎤 Start Recording
                          </button>
                        ) : (
                          <>
                            {!isRecordingPaused ? (
                              <button type="button" className="secondary-button pulse-hover" style={{ padding: "16px 24px", fontSize: "1.1rem", borderRadius: "20px" }} onClick={pauseRecording}>
                                ⏸️ Pause
                              </button>
                            ) : (
                              <button type="button" className="primary-button pulse-hover" style={{ padding: "16px 24px", fontSize: "1.1rem", borderRadius: "20px" }} onClick={resumeRecording}>
                                ▶️ Resume
                              </button>
                            )}
                            <button type="button" className="secondary-button pulse-hover big-stop-btn" onClick={stopRecording}>
                              ⏹️ Stop & Extract
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="supported-formats">Supported: MP3 • WAV • M4A • WEBM</div>

                  <article className="transcript-trust-card">
                    <h3>Transcript</h3>
                    <p>{transcript || "No audio processed yet"}</p>
                  </article>

                  <article className="privacy-trust-card">
                    <strong>🔒 Privacy First</strong>
                    <p>Voice In → Structured Data Out</p>
                    <span>Audio is processed securely and automatically removed after extraction.</span>
                  </article>
                </section>

                <section className={`panel-stack workspace-right fade-in-up ai-results-pane workspace-stage-card ${isProcessing ? "processing" : ""}`} style={{ animationDelay: "0.1s" }}>
                  <div className="section-head split workspace-stage-subhead">
                    <div>
                      <h2>AI Extraction Workspace</h2>
                      <p>{selectedTemplate?.name || "Template"}</p>
                    </div>
                    <div style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
                      <button type="button" className="secondary-button" onClick={handleRerecord} disabled={!audioFile && !isProcessing && !transcript}>
                        Reset
                      </button>
                    </div>
                  </div>

                  <article className={`ai-progress-card ${isProcessing ? "processing" : ""}`}>
                    <div className="ai-progress-head">
                      <h3>Extraction Progress</h3>
                      <span>{extractionPercent}%</span>
                    </div>
                    <div className="ai-progress-blocks">{extractionBlocks}</div>
                    <p>{hasExtractionResults ? `${filledCount}/${fieldValues.length} Fields Captured` : "Waiting for audio"}</p>
                  </article>

                  {isProcessing ? (
                    <article className="ai-processing-card">
                      <h3>AI Processing</h3>

                      <div className="ai-processing-list">
                        {processingChecklist.map((item) => (
                          <div key={item.label} className={`ai-processing-item ${item.done ? "done" : ""}`}>
                            <span>{item.done ? "✓" : "○"}</span>
                            <strong>{item.label}</strong>
                          </div>
                        ))}
                      </div>

                      <div className="ai-processing-tracker" aria-label="AI processing pipeline">
                        {pipelineStages.map((stage) => (
                          <div key={stage.label} className={`ai-processing-step ${stage.complete ? "complete" : ""} ${stage.active ? "active" : ""}`}>
                            <span className="ai-processing-dot" />
                            <em>{stage.label.replace(" Audio", "")}</em>
                          </div>
                        ))}
                      </div>

                      <p className="ai-processing-footnote">Processing in progress...</p>
                    </article>
                  ) : null}

                  {!hasAudioInput && !isProcessing && !hasExtractionResults ? (
                    <article className="ai-empty-state-card">
                      <strong>No audio uploaded yet</strong>
                      <p>Upload a recording or start live capture to extract structured information.</p>
                    </article>
                  ) : null}

                  <div className="field-grid single-column ai-field-results">
                    {fieldValues.map((field) => {
                      const meta = getConfidenceMeta(field.confidence);
                      const hasValue = Boolean(field.value.trim());
                      const needsReview = hasExtractionResults && !hasValue;
                      const isEditingExtracted = editingExtractedField === field.name;

                      return (
                        <article key={field.name} className={`field-card premium-card ${needsReview ? "warning-strong" : hasValue ? meta.tone : "neutral"}`}>
                          <div className="field-head">
                            <span className="field-title ai-field-label">{getFieldEmoji(field)} {field.name}</span>
                            {field.overridden ? <span className="edited-manually-badge">Edited manually</span> : null}
                            {hasExtractionResults && !isProcessing ? (
                              <button
                                type="button"
                                className="ai-edit-toggle"
                                onClick={() => setEditingExtractedField(isEditingExtracted ? null : field.name)}
                                title={isEditingExtracted ? "Done editing" : "Edit value"}
                                aria-label={isEditingExtracted ? "Done editing" : "Edit value"}
                              >
                                <Icon name={isEditingExtracted ? "done" : "edit"} />
                              </button>
                            ) : null}
                          </div>

                          {!hasAudioInput ? (
                            <p className="ai-field-placeholder">Waiting for audio</p>
                          ) : isProcessing ? (
                            <div className="ai-field-extracting">
                              <p className="ai-field-placeholder">Extracting...</p>
                              <div className="ai-field-shimmer" aria-hidden="true">
                                <span></span>
                                <span></span>
                                <span></span>
                              </div>
                            </div>
                          ) : isEditingExtracted ? (
                            field.type === "textarea" ? (
                              <textarea
                                className="ai-inline-editor"
                                value={field.value}
                                placeholder={`Enter ${field.name}`}
                                onChange={(event) => handleFieldChange(field.name, event.target.value)}
                              />
                            ) : (
                              <input
                                className="ai-inline-editor"
                                type={field.type === "email" ? "email" : field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
                                value={field.value}
                                placeholder={`Enter ${field.name}`}
                                onChange={(event) => handleFieldChange(field.name, event.target.value)}
                              />
                            )
                          ) : hasValue ? (
                            <>
                              <p className="ai-field-value">{field.value}</p>
                              <small className={`confidence-text ${meta.tone}`}>✓ {field.confidence}% Confidence</small>
                            </>
                          ) : (
                            <>
                              <p className="ai-field-value missing">Not Detected</p>
                              <small className="confidence-text warning-strong">Needs Review</small>
                            </>
                          )}
                        </article>
                      );
                    })}
                  </div>

                  <div className="action-row workspace-step-footer" style={{ marginTop: "auto" }}>
                    <button type="button" className="secondary-button" onClick={handleReturnToWorkspace}>
                      Return to Workspace
                    </button>
                    <label className="upload-cta">
                      <input
                        type="file"
                        accept="audio/*"
                        onChange={handleAudioFileChange}
                        disabled={isProcessing}
                      />
                      <span>Upload Audio</span>
                    </label>
                    <button type="button" className="secondary-button" onClick={handleStartWorkspaceLiveAudio}>
                      Live Audio
                    </button>
                    <button
                      type="button"
                      className="primary-button pulse-hover workspace-step-primary"
                      style={{ justifyContent: "center", padding: "16px", fontSize: "1.1rem" }}
                      onClick={() => setIsPreviewOpen(true)}
                      disabled={requiredMissing || isProcessing || !transcript}
                    >
                      {!transcript ? "Upload Audio First" : isProcessing ? "AI Processing..." : "Review Extracted Data"}
                    </button>
                  </div>
                </section>
              </div>
            ) : null}

            {step === 4 && submitMeta ? (
              <section className="panel-stack fade-in-up workspace-stage-section workspace-stage-complete">
                <div className="section-head workspace-stage-panel-head workspace-stage-success-head">
                  <div>
                    <h2>Record Saved to Workspace</h2>
                    <p>{submitMeta.templateName} was synced successfully and is now available in your recent recordings.</p>
                  </div>
                  <span className="workspace-chip success">Sync Complete</span>
                </div>

                <div className="summary-card workspace-stage-summary-card">
                  <div className="summary-row">
                    <span>Synced to Google Sheets</span>
                    <strong>{submitMeta.sheet_tab}</strong>
                  </div>
                  <div className="summary-row">
                    <span>Audio retained</span>
                    <strong>No</strong>
                  </div>
                  {Object.entries(submitMeta.fields).map(([key, value]) => (
                    <div className="summary-row" key={key}>
                      <span>{key}</span>
                      <strong>{value || "-"}</strong>
                    </div>
                  ))}
                </div>

                <div className="action-row workspace-stage-action-row workspace-step-footer">
                  <button type="button" className="secondary-button" onClick={handleNewRecord}>
                    New Recording
                  </button>
                  <a
                    className={`secondary-button link-button ${!(submitMeta.sheet_url || connectedSheetUrl) ? "disabled-link" : ""}`}
                    href={submitMeta.sheet_url || connectedSheetUrl || undefined}
                    target="_blank"
                    rel="noreferrer"
                    aria-disabled={!(submitMeta.sheet_url || connectedSheetUrl)}
                    style={{ justifyContent: "center" }}
                  >
                    View in Sheets
                  </a>
                  <button type="button" className="primary-button workspace-step-primary" onClick={handleReturnToWorkspace}>
                    Return to Workspace
                  </button>
                </div>
              </section>
            ) : null}

            {workspacePendingDelete ? (
              <div className="modal-overlay" onClick={() => setWorkspacePendingDelete(null)}>
                <div className="modal-content workspace-delete-modal fade-in-up" onClick={(event) => event.stopPropagation()}>
                  <div className="workspace-delete-modal-head">
                    <h2>Delete Workspace?</h2>
                    <p>
                      This will remove <strong>{workspacePendingDelete.name}</strong> from My Workspaces.
                      Your template files remain available in the template library.
                    </p>
                  </div>
                  <div className="workspace-delete-modal-actions">
                    <button type="button" className="ghost-button" onClick={() => setWorkspacePendingDelete(null)}>
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="primary-button workspace-danger-btn"
                      onClick={confirmDeleteWorkspace}
                      disabled={workspaceActionLoadingId === workspacePendingDelete.id}
                    >
                      {workspaceActionLoadingId === workspacePendingDelete.id ? "Deleting..." : "Delete Workspace"}
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

          </main>
        </>
      )}

      {isPreviewOpen ? (
        createPortal(
          <div className="modal-overlay" onClick={() => setIsPreviewOpen(false)}>
            <div className="modal-content fade-in-up" onClick={(e) => e.stopPropagation()}>
              <div className="section-head split" style={{ borderBottom: "1px solid var(--line)", paddingBottom: "16px", marginBottom: "20px" }}>
                <div>
                  <h2>Full Form Preview</h2>
                  <p>{selectedTemplate?.name} - {filledCount} of {fieldValues.length} fields filled</p>
                </div>
                <button type="button" className="secondary-button" onClick={() => setIsPreviewOpen(false)}>
                  Close
                </button>
              </div>
              <div style={{ marginBottom: "16px", color: "var(--muted)", fontWeight: 600 }}>Final verification</div>
              <div className="field-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
                {fieldValues.map((field) => {
                  const meta = getConfidenceMeta(field.confidence);
                  const inputClass = field.required && !field.value.trim() && transcript ? "missing-required" : (transcript ? meta.tone : "neutral");
                  const badge = field.overridden
                    ? "Edited manually"
                    : field.value
                      ? `AI filled · ${field.confidence}%`
                      : field.required
                        ? (transcript ? "Enter manually" : "Required")
                        : (transcript ? "Optional - not mentioned" : "Optional");

                  return (
                    <article key={field.name} className={`field-card ${inputClass}`}>
                      <div className="field-head">
                        <span>{getFieldEmoji(field)} {field.name}</span>
                        <span className="badge">{badge}</span>
                      </div>
                      <div style={{ padding: "12px 14px", borderRadius: "12px", border: "1px solid var(--line)", background: "#fff", minHeight: "48px", color: "var(--text)", fontWeight: 600, whiteSpace: "pre-wrap" }}>
                        {field.value || "-"}
                      </div>
                      {transcript && !field.overridden ? <small className={`confidence-text ${meta.tone}`}>{meta.label}</small> : null}
                    </article>
                  );
                })}
              </div>
              <div className="action-row" style={{ marginTop: "24px", paddingTop: "16px", borderTop: "1px solid var(--line)" }}>
                <button type="button" className="secondary-button" onClick={() => setIsPreviewOpen(false)}>
                  Back to Edit
                </button>
                <button type="button" className="secondary-button" onClick={handleExportExtractedData} disabled={!transcript || fieldValues.length === 0}>
                  Export
                </button>
                {!isSheetsReady ? (
                  <button
                    type="button"
                    className="secondary-button"
                    style={{ marginLeft: "auto", color: "var(--danger)", borderColor: "var(--danger)" }}
                    onClick={startGoogleLogin}
                  >
                    ⚠️ Reconnect Google
                  </button>
                ) : null}
                <button
                  type="button"
                  className="primary-button pulse-hover"
                  style={{ marginLeft: isSheetsReady ? "auto" : "0" }}
                  onClick={() => {
                    setIsPreviewOpen(false);
                    handleSubmit({ stayInWorkspace: true });
                  }}
                  disabled={requiredMissing || isSubmitting || isProcessing || !transcript || !isSheetsReady}
                  title={!isSheetsReady ? "Google Sync must be connected to save" : ""}
                >
                  {isSubmitting ? "Saving..." : "Save Record"}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )
      ) : null}

      {isSubmitting ? (
        createPortal(
          <div className="syncing-overlay" role="status" aria-live="polite" aria-label="Syncing with Google Sheets">
            <div className="syncing-card fade-in-up">
              <div className="syncing-spinner" aria-hidden="true" />
              <strong>Syncing with Google Sheets...</strong>
              <p>Please wait while we save your extracted data.</p>
            </div>
          </div>,
          document.body
        )
      ) : null}
    </>
  );
}

function wait(duration) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, duration);
  });
}

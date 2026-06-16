import { useEffect, useRef, useState } from "react";
import { useGoogleLogin } from "@react-oauth/google";

import { fetchTemplates, getSheetsUrl, submitRecord, transcribeAudio, uploadTemplateFile, saveToken, fetchToken, saveCustomTemplateApi, deleteCustomTemplateApi } from "./api";
import { CATEGORY_ICONS, LANGUAGES, PROCESS_STAGES, STEPS } from "./constants";

const LANGUAGE_STORAGE_KEY = "voice2form-language";

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

function mapFieldsFromExtraction(template, extraction) {
  return template.fields.map((field) => {
    const extracted = extraction.fields[field.name] || { value: "", confidence: 0, source: "missing" };
    return {
      ...field,
      value: extracted.value || "",
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

export default function App() {
  const [templates, setTemplates] = useState({});
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [step, setStep] = useState(1);
  const [language, setLanguage] = useState(() => localStorage.getItem(LANGUAGE_STORAGE_KEY) || "hi-IN");
  const [uploadedTemplateName, setUploadedTemplateName] = useState("");
  const [audioMode, setAudioMode] = useState("upload");
  const [isRecording, setIsRecording] = useState(false);
  const [isRecordingPaused, setIsRecordingPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioFile, setAudioFile] = useState(null);
  const [processingStage, setProcessingStage] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [transcript, setTranscript] = useState("");
  const [fieldValues, setFieldValues] = useState([]);
  const [submitMeta, setSubmitMeta] = useState(null);
  const [showTranscript, setShowTranscript] = useState(false);
  const [accessToken, setAccessToken] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newFieldName, setNewFieldName] = useState("");
  const [targetSheetUrl, setTargetSheetUrl] = useState("");
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isUploadingTemplate, setIsUploadingTemplate] = useState(false);
  const [editingField, setEditingField] = useState(null);

  useEffect(() => {
    fetchTemplates()
      .then(setTemplates)
      .catch((error) => setErrorMessage(error.message));

    fetchToken().then((res) => {
      if (res && res.token) setAccessToken(res.token);
    });
  }, []);

  const login = useGoogleLogin({
    onSuccess: (tokenResponse) => {
      setAccessToken(tokenResponse.access_token);
      saveToken(tokenResponse.access_token);
      submitData(tokenResponse.access_token);
    },
    onError: () => setErrorMessage("Google login failed. Please try again."),
    scope: "https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive"
  });

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);

  useEffect(() => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  }, [language]);

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
      setSelectedTemplate({ ...parsedTemplate, source: "custom" });
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setIsUploadingTemplate(false);
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

  function handleNextToAudio() {
    if (!selectedTemplate) {
      return;
    }
    resetAudioAndExtraction();
    
    const initialFields = selectedTemplate.fields.map(f => ({
      ...f,
      value: "",
      confidence: 0,
      source: "missing",
      overridden: false
    }));
    setFieldValues(initialFields);

    setStep(2);
  }

  function resetAudioAndExtraction() {
    setAudioFile(null);
    setTranscript("");
    setFieldValues([]);
    setSubmitMeta(null);
    setShowTranscript(false);
    setErrorMessage("");
    setProcessingStage("");
  }

  async function startRecording() {
    try {
      setErrorMessage("");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        const file = new File([blob], "voice-recording.webm", { type: blob.type || "audio/webm" });
        setAudioFile(file);
        setIsRecording(false);
        setIsRecordingPaused(false);
        setRecordingTime(0);
        stream.getTracks().forEach((track) => track.stop());
        await processAudio(file);
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      setIsRecordingPaused(false);
      setRecordingTime(0);
    } catch (error) {
      setErrorMessage("Microphone access is required to record audio.");
    }
  }

  function stopRecording() {
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
      const extraction = await transcribeAudio({
        audioFile: file,
        templateId: selectedTemplate.source === "builtin" ? selectedTemplate.id : null,
        template: selectedTemplate.source === "custom" ? selectedTemplate : null,
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
              value,
              overridden: true
            }
          : field
      )
    );
  }

  async function submitData(token) {
    if (!selectedTemplate || isSubmitting) {
      return;
    }

    const fields = Object.fromEntries(fieldValues.map((field) => [field.name, field.value.trim()]));

    setIsSubmitting(true);
    try {
      setErrorMessage("");
      const payload = await submitRecord({
        templateId: selectedTemplate.source === "builtin" ? selectedTemplate.id : null,
        template: selectedTemplate.source === "custom" ? selectedTemplate : null,
        fields,
        language,
        accessToken: token,
        targetSheetUrl: targetSheetUrl.trim() || null
      });
      setSubmitMeta({
        ...payload,
        templateName: selectedTemplate.name,
        fields
      });
      setStep(3);
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleSubmit() {
    if (!accessToken) {
      login();
    } else {
      submitData(accessToken);
    }
  }

  function handleNewRecord() {
    setSelectedTemplate(null);
    setUploadedTemplateName("");
    resetAudioAndExtraction();
    setStep(1);
  }

  function handleRerecord() {
    setAudioFile(null);
    setTranscript("");
    setFieldValues((current) => current.map(f => ({ ...f, value: "", confidence: 0, source: "missing", overridden: false })));
    setSubmitMeta(null);
    setErrorMessage("");
    setProcessingStage("");
  }

  const filledCount = countFilledFields(fieldValues);
  const requiredMissing = fieldValues.some((field) => field.required && !field.value.trim());
  const sheetsUrl = getSheetsUrl();

  return (
    <div className="app-shell">
      <div className="background-glow background-glow-left" />
      <div className="background-glow background-glow-right" />

      <main className="app-card">
        <header className="hero">
          <div>
            <p className="eyebrow">Voice-driven form capture</p>
            <h1>Voice2Form</h1>
            <p className="hero-copy">
              Capture speech, extract structured fields, verify quickly, and sync records without storing audio.
            </p>
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

        {errorMessage ? <div className="status-banner error">{errorMessage}</div> : null}

        {step === 1 ? (
          <div className="step1-grid">
            <aside className="step1-sidebar fade-in-up">
              <div className="section-head">
                <h2>Templates</h2>
              </div>
              <div className="sidebar-menu">
                {Object.entries(templates).map(([category, items]) => (
                  <div key={category} style={{marginBottom: "16px"}}>
                    <h3 style={{fontSize: "0.9rem", color: "var(--muted)", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.05em"}}>{category}</h3>
                    <div className="sidebar-menu">
                      {items.map((template) => (
                        <button
                          key={template.id}
                          type="button"
                          className={`template-card ${selectedTemplate?.id === template.id ? "selected" : ""}`}
                          onClick={() => handleSelectBuiltIn(template)}
                        >
                          <div className="template-icon">{CATEGORY_ICONS[template.category] || "📄"}</div>
                          <div>
                            <strong style={{display: "block", color: "var(--text)"}}>{template.name}</strong>
                            <span style={{fontSize: "0.85rem", color: "var(--muted)"}}>{template.fields.length} fields</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </aside>

            <section className="step1-preview fade-in-up" style={{animationDelay: "0.1s"}}>
              {selectedTemplate ? (
                <div className="preview-card">
                  <div className="section-head">
                    <h2>{selectedTemplate.name}</h2>
                  </div>
                  
                  <div style={{marginBottom: "24px"}}>
                    <p style={{fontSize: "0.9rem", color: "var(--muted)", marginBottom: "4px"}}>Used by:</p>
                    <strong style={{color: "var(--text)"}}>
                      {selectedTemplate.category === "Service" ? "Service Teams, Support Staff" : 
                       selectedTemplate.category === "Healthcare" ? "Clinics, Patient Intake" : 
                       selectedTemplate.category === "Sales" ? "Sales Reps, Lead Gen" : 
                       selectedTemplate.category === "Operations" ? "Facility Managers, Inspectors" : 
                       selectedTemplate.category === "Complaint" ? "Apartment Management, Customer Support" : "General Teams"}
                    </strong>
                  </div>

                  <div style={{marginBottom: "24px"}}>
                    <p style={{fontSize: "0.9rem", color: "var(--muted)", marginBottom: "12px"}}>Fields ({selectedTemplate.fields.length}):</p>
                    <ul style={{listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "8px"}}>
                      {selectedTemplate.fields.map((field) => (
                        <li key={field.name} style={{display: "flex", alignItems: "center", gap: "8px", color: "var(--text)", background: "rgba(39, 52, 74, 0.02)", padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--line)"}}>
                          {editingField?.oldName === field.name ? (
                            <form 
                              onSubmit={(e) => { e.preventDefault(); handleEditFieldSave(field.name, editingField.newName); }}
                              style={{display: "flex", width: "100%", gap: "8px", alignItems: "center"}}
                            >
                              <span style={{color: "var(--accent-strong)"}}>✓</span>
                              <input
                                autoFocus
                                value={editingField.newName}
                                onChange={(e) => setEditingField({...editingField, newName: e.target.value})}
                                onBlur={() => handleEditFieldSave(field.name, editingField.newName)}
                                style={{ flex: 1, padding: "4px 8px", borderRadius: "4px", border: "1px solid var(--accent)", outline: "none" }}
                              />
                            </form>
                          ) : (
                            <>
                              <span style={{color: "var(--accent-strong)"}}>✓</span> 
                              <span style={{flex: 1}}>{field.name}</span>
                              <div style={{display: "flex", gap: "4px"}}>
                                <button type="button" className="field-action-btn" onClick={() => setEditingField({oldName: field.name, newName: field.name})} title="Edit field">✏️</button>
                                <button type="button" className="field-action-btn" onClick={() => handleDeleteField(field.name)} title="Delete field">🗑️</button>
                              </div>
                            </>
                          )}
                        </li>
                      ))}
                    </ul>
                    <form onSubmit={handleAddCustomField} style={{marginTop: "12px", display: "flex", gap: "8px"}}>
                      <input
                        type="text"
                        placeholder="Add custom field..."
                        value={newFieldName}
                        onChange={(e) => setNewFieldName(e.target.value)}
                        style={{ flex: 1, padding: "10px 14px", borderRadius: "8px", border: "1px dashed var(--line)", background: "rgba(39, 52, 74, 0.02)", color: "var(--text)", outline: "none" }}
                      />
                      <button type="submit" className="secondary-button pulse-hover" disabled={!newFieldName.trim()} style={{display: "flex", alignItems: "center", gap: "6px", background: "rgba(15, 118, 110, 0.1)", color: "var(--accent-strong)", border: "none"}}>
                        <span style={{fontWeight: "bold", fontSize: "1.2rem", lineHeight: 1}}>+</span> Add
                      </button>
                    </form>
                  </div>

                  <div style={{marginBottom: "24px"}}>
                    <p style={{fontSize: "0.9rem", color: "var(--muted)", marginBottom: "4px"}}>Estimated completion:</p>
                    <strong style={{color: "var(--text)"}}>&lt; 30 sec</strong>
                  </div>

                  <div style={{marginBottom: "24px"}}>
                    <p style={{fontSize: "0.9rem", color: "var(--muted)", marginBottom: "8px"}}>Target Google Sheet (Optional)</p>
                    <input
                      type="url"
                      placeholder="https://docs.google.com/spreadsheets/d/..."
                      value={targetSheetUrl}
                      onChange={(e) => setTargetSheetUrl(e.target.value)}
                      style={{ width: "100%", padding: "0.75rem", borderRadius: "8px", border: "1px solid var(--line)", background: "#fff", color: "var(--text)", boxSizing: "border-box" }}
                    />
                  </div>

                  <div style={{display: "flex", gap: "12px", width: "100%"}}>
                    {selectedTemplate.source === "custom" && !templates.Saved?.some(t => t.id === selectedTemplate.id) && (
                      <button type="button" className="secondary-button" style={{padding: "16px", flex: 1, display: "flex", justifyContent: "center", alignItems: "center", gap: "8px"}} onClick={async () => {
                        const newTemplate = { ...selectedTemplate, id: `saved_${Date.now()}`, category: "Saved", source: "custom" };
                        await saveCustomTemplateApi(newTemplate);
                        const updated = await fetchTemplates();
                        setTemplates(updated);
                        setSelectedTemplate(newTemplate);
                      }}>
                        💾 Save Template
                      </button>
                    )}
                    {selectedTemplate.category === "Saved" && (
                      <button type="button" className="secondary-button" style={{padding: "16px", flex: 1, display: "flex", justifyContent: "center", alignItems: "center", gap: "8px", color: "var(--danger)"}} onClick={async () => {
                        await deleteCustomTemplateApi(selectedTemplate.id);
                        const updated = await fetchTemplates();
                        setTemplates(updated);
                        setSelectedTemplate(null);
                      }}>
                        🗑️ Delete
                      </button>
                    )}
                    <button type="button" className="primary-button pulse-hover" style={{flex: 2, padding: "16px", fontSize: "1.1rem", justifyContent: "center"}} onClick={handleNextToAudio}>
                      Use Template
                    </button>
                  </div>
                </div>
              ) : (
                <div className="preview-card" style={{display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "400px", textAlign: "center", background: "rgba(39, 52, 74, 0.02)"}}>
                  <div style={{fontSize: "3rem", marginBottom: "16px", opacity: 0.5}}>👈</div>
                  <h3 style={{color: "var(--muted)", marginBottom: "8px"}}>Select a template</h3>
                  <p style={{color: "var(--muted)", maxWidth: "300px"}}>Choose a template from the left sidebar to see its details and begin capturing data.</p>
                </div>
              )}

              <div style={{display: "flex", alignItems: "center", margin: "16px 0"}}>
                <div style={{flex: 1, height: "1px", background: "var(--line)"}}></div>
                <span style={{padding: "0 16px", color: "var(--muted)", fontSize: "0.9rem"}}>Or Upload Existing Form</span>
                <div style={{flex: 1, height: "1px", background: "var(--line)"}}></div>
              </div>

              <label className="upload-dropzone">
                <div className="upload-icon">📄</div>
                <span className="upload-title">Upload Existing Form</span>
                <span className="upload-subtitle">Drop PDF, DOCX or JSON, or Browse Files</span>
                <input type="file" accept=".json,.csv,.pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={handleTemplateUpload} disabled={isUploadingTemplate} />
                
                {isUploadingTemplate ? (
                  <strong style={{color: "var(--accent-strong)", display: "block", animation: "pulse 1.5s infinite", marginTop: "12px"}}>
                    Processing template with AI... Please wait.
                  </strong>
                ) : uploadedTemplateName ? (
                  <strong style={{display: "block", color: "var(--accent-strong)", marginTop: "12px"}}>{uploadedTemplateName} selected</strong>
                ) : (
                  <div className="upload-examples">
                    <span className="upload-example-badge">Employee Form</span>
                    <span className="upload-example-badge">Complaint Form</span>
                    <span className="upload-example-badge">Patient Intake</span>
                  </div>
                )}
              </label>

            </section>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="workspace-grid">
            <section className="panel-stack workspace-left fade-in-up">
              <div className="section-head split">
                <div>
                  <h2>Capture audio</h2>
                  <p>Choose live microphone input or upload an audio file.</p>
                </div>
                <label className="language-selector-inline">
                  <span style={{marginRight: "8px", fontSize: "1.1rem"}}>🎙️ Language:</span>
                  <select value={language} onChange={(event) => setLanguage(event.target.value)} style={{border: "none", background: "transparent", fontWeight: "bold", fontSize: "1rem", outline: "none", cursor: "pointer"}}>
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
                <label className="upload-box-premium">
                  <div className="upload-box-icon">🎙️ Upload Audio</div>
                  <div className="upload-box-text">Drag & drop audio file</div>
                  <div className="upload-box-btn">Browse Files</div>
                  <input type="file" accept="audio/*" onChange={handleAudioFileChange} />
                  {audioFile ? <strong className="selected-file-text">{audioFile.name}</strong> : null}
                </label>
              ) : (
                <div className="record-panel premium-mic">
                  {isRecording ? (
                    <div className="mic-active-state">
                      <div className="recording-indicator" style={{background: isRecordingPaused ? "rgba(245, 158, 11, 0.1)" : "rgba(220, 38, 38, 0.1)"}}>
                        <div className={`red-dot ${!isRecordingPaused ? "pulse" : ""}`} style={{background: isRecordingPaused ? "var(--warm)" : "var(--danger)"}}></div>
                        <span style={{color: isRecordingPaused ? "var(--warm)" : "var(--danger)", fontWeight: "bold"}}>
                          {isRecordingPaused ? "Paused" : "Listening..."}
                        </span>
                      </div>
                      <strong className="timer-text">{String(Math.floor(recordingTime / 60)).padStart(2, "0")}:{String(recordingTime % 60).padStart(2, "0")}</strong>
                    </div>
                  ) : null}
                  <div className="action-row" style={{justifyContent: "center", marginTop: "16px", gap: "12px", flexWrap: "wrap"}}>
                    {!isRecording ? (
                      <button type="button" className="primary-button pulse-hover big-mic-btn" onClick={startRecording}>
                        🎤 Start Listening
                      </button>
                    ) : (
                      <>
                        {!isRecordingPaused ? (
                          <button type="button" className="secondary-button pulse-hover" style={{padding: "16px 24px", fontSize: "1.1rem", borderRadius: "20px"}} onClick={pauseRecording}>
                            ⏸️ Pause
                          </button>
                        ) : (
                          <button type="button" className="primary-button pulse-hover" style={{padding: "16px 24px", fontSize: "1.1rem", borderRadius: "20px"}} onClick={resumeRecording}>
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



              <div className="privacy-pill">Audio deleted after processing - never stored</div>

              {isProcessing ? (
                <div className="progress-card">
                  {PROCESS_STAGES.map((stage) => (
                    <div
                      key={stage}
                      className={`progress-stage ${processingStage === stage ? "active" : ""} ${
                        PROCESS_STAGES.indexOf(stage) < PROCESS_STAGES.indexOf(processingStage) ? "complete" : ""
                      }`}
                    >
                      {stage}
                    </div>
                  ))}
                </div>
              ) : null}

              {transcript ? (
                <details className="transcript-panel" open={showTranscript} onToggle={(event) => setShowTranscript(event.target.open)}>
                  <summary>Transcript reference</summary>
                  <p>{transcript}</p>
                </details>
              ) : null}
            </section>

            <section className="panel-stack workspace-right fade-in-up" style={{animationDelay: "0.1s"}}>
              <div className="section-head split">
                <div>
                  <h2>Extracted Fields</h2>
                  {fieldValues.length > 0 && (
                    <div style={{marginTop: "8px"}}>
                      <div style={{color: "var(--accent-strong)", fontFamily: "monospace", fontSize: "1rem", letterSpacing: "2px", marginBottom: "4px"}}>
                        {"█".repeat(Math.round((filledCount / fieldValues.length) * 10)) + "░".repeat(10 - Math.round((filledCount / fieldValues.length) * 10))}
                      </div>
                      <p style={{fontSize: "0.9rem", color: "var(--muted)"}}>{filledCount} of {fieldValues.length} complete</p>
                    </div>
                  )}
                </div>
                <div style={{display: "flex", gap: "8px", alignItems: "flex-start"}}>
                  <button type="button" className="secondary-button" onClick={handleRerecord} disabled={!audioFile && !isProcessing && !transcript}>
                    Reset
                  </button>
                </div>
              </div>

              <div className="field-grid single-column">
                {fieldValues.map((field) => {
                  const meta = getConfidenceMeta(field.confidence);
                  const inputClass = field.required && !field.value.trim() && transcript ? "missing-required" : (transcript ? meta.tone : "neutral");
                  
                  return (
                    <label key={field.name} className={`field-card premium-card ${inputClass}`}>
                      <div className="field-head">
                        <span className="field-title">{getFieldEmoji(field)} {field.name}</span>
                        {transcript && field.value && !field.overridden && (
                          <span className={`confidence-badge ${meta.tone}`}>
                            {meta.emoji} {field.confidence}% {meta.label.includes("High") ? "✓" : ""}
                          </span>
                        )}
                      </div>
                      {field.type === "textarea" ? (
                        <textarea
                          className="premium-input"
                          value={field.value}
                          placeholder={transcript ? "Not detected yet" : "Awaiting extraction..."}
                          onChange={(event) => handleFieldChange(field.name, event.target.value)}
                        />
                      ) : (
                        <input
                          className="premium-input"
                          type={field.type === "email" ? "email" : field.type === "number" ? "number" : "text"}
                          value={field.value}
                          placeholder={transcript ? "Not detected yet" : "Awaiting extraction..."}
                          onChange={(event) => handleFieldChange(field.name, event.target.value)}
                        />
                      )}
                    </label>
                  );
                })}
              </div>

              <div className="action-row" style={{marginTop: "auto"}}>
                <button type="button" className="primary-button pulse-hover" style={{width: "100%", justifyContent: "center", padding: "16px", fontSize: "1.1rem"}} onClick={() => setIsPreviewOpen(true)} disabled={requiredMissing || isProcessing || !transcript}>
                  Review & Submit
                </button>
              </div>
            </section>
          </div>
        ) : null}

        {step === 3 && submitMeta ? (
          <section className="panel-stack fade-in-up">
            <div className="section-head">
              <h2>Submission complete</h2>
              <p>{submitMeta.templateName} was synced successfully.</p>
            </div>

            <div className="summary-card">
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

            <div className="action-row">
              <button type="button" className="primary-button" onClick={handleNewRecord}>
                New record
              </button>
              <a
                className={`secondary-button link-button ${!(submitMeta.sheet_url || sheetsUrl) ? "disabled-link" : ""}`}
                href={submitMeta.sheet_url || sheetsUrl || undefined}
                target="_blank"
                rel="noreferrer"
                aria-disabled={!(submitMeta.sheet_url || sheetsUrl)}
              >
                View in Sheets
              </a>
            </div>
          </section>
        ) : null}

        {isPreviewOpen ? (
          <div className="modal-overlay" onClick={() => setIsPreviewOpen(false)}>
            <div className="modal-content fade-in-up" onClick={(e) => e.stopPropagation()}>
              <div className="section-head split" style={{borderBottom: "1px solid var(--line)", paddingBottom: "16px", marginBottom: "20px"}}>
                <div>
                  <h2>Full Form Preview</h2>
                  <p>{selectedTemplate?.name} - {filledCount} of {fieldValues.length} fields filled</p>
                </div>
                <button type="button" className="secondary-button" onClick={() => setIsPreviewOpen(false)}>
                  Close
                </button>
              </div>
              <div className="field-grid" style={{gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))"}}>
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
                    <label key={field.name} className={`field-card ${inputClass}`}>
                      <div className="field-head">
                        <span>{getFieldEmoji(field)} {field.name}</span>
                        <span className="badge">{badge}</span>
                      </div>
                      {field.type === "textarea" ? (
                        <textarea
                          value={field.value}
                          placeholder={field.hint || field.name}
                          onChange={(event) => handleFieldChange(field.name, event.target.value)}
                        />
                      ) : (
                        <input
                          type={field.type === "email" ? "email" : field.type === "number" ? "number" : "text"}
                          value={field.value}
                          placeholder={field.hint || field.name}
                          onChange={(event) => handleFieldChange(field.name, event.target.value)}
                        />
                      )}
                      {transcript && !field.overridden ? <small className={`confidence-text ${meta.tone}`}>{meta.label}</small> : null}
                    </label>
                  );
                })}
              </div>
              <div className="action-row" style={{marginTop: "24px", paddingTop: "16px", borderTop: "1px solid var(--line)"}}>
                <button type="button" className="primary-button pulse-hover" style={{marginLeft: "auto"}} onClick={() => { setIsPreviewOpen(false); handleSubmit(); }} disabled={requiredMissing || isSubmitting || isProcessing || !transcript}>
                  {isSubmitting ? "Saving..." : "Save to Google Sheets"}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}

function wait(duration) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, duration);
  });
}

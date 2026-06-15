import { useEffect, useRef, useState } from "react";
import { useGoogleLogin } from "@react-oauth/google";

import { fetchTemplates, getSheetsUrl, submitRecord, transcribeAudio, uploadTemplateFile } from "./api";
import { CATEGORY_ICONS, LANGUAGES, PROCESS_STAGES, STEPS } from "./constants";

const LANGUAGE_STORAGE_KEY = "voice2form-language";

function getConfidenceMeta(confidence) {
  if (confidence >= 90) {
    return { label: "High confidence", tone: "success" };
  }
  if (confidence >= 70) {
    return { label: "Review suggested", tone: "warning" };
  }
  if (confidence >= 50) {
    return { label: "Please verify", tone: "warning-strong" };
  }
  if (confidence >= 1) {
    return { label: "Low - please correct", tone: "danger" };
  }
  return { label: "Not found", tone: "neutral" };
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

  const login = useGoogleLogin({
    onSuccess: (tokenResponse) => {
      setAccessToken(tokenResponse.access_token);
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
    fetchTemplates()
      .then(setTemplates)
      .catch((error) => setErrorMessage(error.message));
  }, []);

  useEffect(() => {
    if (!isRecording) {
      return undefined;
    }

    timerRef.current = window.setInterval(() => {
      setRecordingTime((current) => current + 1);
    }, 1000);

    return () => {
      window.clearInterval(timerRef.current);
    };
  }, [isRecording]);

  async function handleTemplateUpload(event) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      setErrorMessage("");
      const parsedTemplate = await uploadTemplateFile(file);
      setUploadedTemplateName(file.name);
      setSelectedTemplate({ ...parsedTemplate, source: "custom" });
    } catch (error) {
      setErrorMessage(error.message);
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

  function handleNextToAudio() {
    if (!selectedTemplate) {
      return;
    }
    resetAudioAndExtraction();
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
        setRecordingTime(0);
        stream.getTracks().forEach((track) => track.stop());
        await processAudio(file);
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
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
      setStep(3);

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
      setStep(4);
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
    setFieldValues([]);
    setSubmitMeta(null);
    setErrorMessage("");
    setProcessingStage("");
    setStep(2);
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

          <label className="language-picker">
            <span>Language</span>
            <select value={language} onChange={(event) => setLanguage(event.target.value)}>
              {LANGUAGES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
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
          <section className="panel-stack">
            <div className="section-head">
              <h2>Select a form template</h2>
              <p>Pick a built-in workflow or upload your own JSON or CSV template.</p>
            </div>

            {Object.entries(templates).map(([category, items]) => (
              <section key={category} className="template-group">
                <div className="template-group-head">
                  <h3>{category}</h3>
                </div>
                <div className="template-grid">
                  {items.map((template) => (
                    <button
                      key={template.id}
                      type="button"
                      className={`template-card ${selectedTemplate?.id === template.id ? "selected" : ""}`}
                      onClick={() => handleSelectBuiltIn(template)}
                    >
                      <div className="template-icon">{CATEGORY_ICONS[template.category] || "FM"}</div>
                      <div>
                        <strong>{template.name}</strong>
                        <p>{template.fields.length} fields</p>
                      </div>
                      <span className="language-badge">{template.language}</span>
                    </button>
                  ))}
                </div>
              </section>
            ))}

            <label className={`upload-card ${selectedTemplate?.source === "custom" ? "selected" : ""}`}>
              <span className="upload-title">Upload your own template</span>
              <span className="upload-copy">Supports JSON, CSV, PDF, or DOCX up to 20 fields.</span>
              <input type="file" accept=".json,.csv,.pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={handleTemplateUpload} />
              {uploadedTemplateName ? <strong>{uploadedTemplateName}</strong> : null}
            </label>

            {selectedTemplate ? (
              <div className="preview-card">
                <div className="section-head">
                  <h3>Template preview</h3>
                  <p>{selectedTemplate.name}</p>
                </div>
                <div className="chip-row">
                  {selectedTemplate.fields.map((field) => (
                    <span key={field.name} className="field-chip">
                      {getFieldEmoji(field)} {field.name}
                    </span>
                  ))}
                </div>
                <form className="add-field-form" onSubmit={handleAddCustomField}>
                  <input
                    type="text"
                    placeholder="New field name..."
                    value={newFieldName}
                    onChange={(e) => setNewFieldName(e.target.value)}
                  />
                  <button type="submit" className="secondary-button" disabled={!newFieldName.trim()}>
                    Add
                  </button>
                </form>
              </div>
            ) : null}

            {selectedTemplate ? (
              <div className="preview-card">
                <div className="section-head">
                  <h3>Target Google Sheet (Optional)</h3>
                  <p>Paste the URL of an existing Google Sheet to sync data to it. Leave empty to create/use the default sheet.</p>
                </div>
                <input
                  type="url"
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                  value={targetSheetUrl}
                  onChange={(e) => setTargetSheetUrl(e.target.value)}
                  style={{ width: "100%", padding: "0.75rem", borderRadius: "8px", border: "1px solid var(--border-color, rgba(255,255,255,0.1))", background: "var(--input-bg, rgba(0,0,0,0.2))", color: "inherit", boxSizing: "border-box" }}
                />
              </div>
            ) : null}

            <div className="action-row">
              <button type="button" className="primary-button" onClick={handleNextToAudio} disabled={!selectedTemplate}>
                Continue to audio
              </button>
            </div>
          </section>
        ) : null}

        {step === 2 ? (
          <section className="panel-stack">
            <div className="section-head">
              <h2>Capture audio</h2>
              <p>Choose live microphone input or upload an audio file. Processing starts automatically once audio is ready.</p>
            </div>

            <div className="mode-toggle">
              <button
                type="button"
                className={audioMode === "upload" ? "active" : ""}
                onClick={() => setAudioMode("upload")}
              >
                Upload file
              </button>
              <button
                type="button"
                className={audioMode === "mic" ? "active" : ""}
                onClick={() => setAudioMode("mic")}
              >
                Live mic
              </button>
            </div>

            {audioMode === "upload" ? (
              <label className="dropzone">
                <span>Drop audio here or choose a file</span>
                <small>Accepted: WAV, MP3, OGG, M4A, WEBM. Max 50MB.</small>
                <input type="file" accept="audio/*" onChange={handleAudioFileChange} />
                {audioFile ? <strong>{audioFile.name}</strong> : null}
              </label>
            ) : (
              <div className="record-panel">
                <div className="wave-bars" aria-hidden="true">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <span key={index} className={isRecording ? "animated" : ""} />
                  ))}
                </div>
                <strong>{String(Math.floor(recordingTime / 60)).padStart(2, "0")}:{String(recordingTime % 60).padStart(2, "0")}</strong>
                <div className="action-row">
                  {!isRecording ? (
                    <button type="button" className="primary-button" onClick={startRecording}>
                      Start recording
                    </button>
                  ) : (
                    <button type="button" className="secondary-button" onClick={stopRecording}>
                      Stop recording
                    </button>
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
          </section>
        ) : null}

        {step === 3 ? (
          <section className="panel-stack">
            <div className="section-head split">
              <div>
                <h2>Verify extracted fields</h2>
                <p>
                  {filledCount} of {fieldValues.length} fields filled
                </p>
              </div>
              <button type="button" className="secondary-button" onClick={handleRerecord}>
                Re-record
              </button>
            </div>

            <div className="field-grid">
              {fieldValues.map((field) => {
                const meta = getConfidenceMeta(field.confidence);
                const inputClass = field.required && !field.value.trim() ? "missing-required" : meta.tone;
                const badge = field.overridden
                  ? "Edited manually"
                  : field.value
                    ? `AI filled · ${field.confidence}%`
                    : field.required
                      ? "Enter manually"
                      : "Optional - not mentioned";

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
                    {!field.overridden ? <small className={`confidence-text ${meta.tone}`}>{meta.label}</small> : null}
                  </label>
                );
              })}
            </div>

            <details className="transcript-panel" open={showTranscript} onToggle={(event) => setShowTranscript(event.target.open)}>
              <summary>Transcript reference</summary>
              <p>{transcript || "Transcript unavailable."}</p>
            </details>

            <div className="action-row">
              <button type="button" className="primary-button" onClick={handleSubmit} disabled={requiredMissing || isSubmitting}>
                {isSubmitting ? "Submitting..." : "Submit to Google Sheets"}
              </button>
            </div>
          </section>
        ) : null}

        {step === 4 && submitMeta ? (
          <section className="panel-stack">
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
      </main>
    </div>
  );
}

function wait(duration) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, duration);
  });
}

"use client";

import Image from "next/image";
import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  Check,
  ClipboardList,
  FileAudio2,
  FlaskConical,
  History,
  ImagePlus,
  Mic,
  Search,
  ShieldCheck,
  Square,
  Stethoscope,
  Upload,
  UserRound,
  X,
} from "lucide-react";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
const LANGUAGE_STORAGE_KEY = "elfie-global-language";
const DOCTOR_NAME_STORAGE_KEY = "elfie-doctor-name";
const LANGUAGE_OPTIONS = [
  { code: "EN", label: "English" },
  { code: "FR", label: "Français" },
  { code: "AR", label: "العربية" },
  { code: "VI", label: "Tiếng Việt" },
] as const;

const DOCTOR_UI_COPY = {
  EN: {
    activeConsultation: "Active Consultation",
    treatingClinician: "Treating clinician",
    patientHistory: "Patient Medical History",
    longitudinalTimeline: "Longitudinal timeline",
    consultationCapture: "Consultation Capture",
    liveAudioAndContext: "Live audio and clinical context",
    uploadFile: "Upload File",
    recordLive: "Record Live",
    doctorNotes: "Doctor's Notes",
    aiClinicalExtraction: "AI Clinical Extraction",
    diagnosisReview: "Diagnosis and medication review",
    diagnosis: "Diagnosis",
    chiefComplaint: "Chief Complaint",
    symptoms: "Symptoms",
    smartPrescriptionBuilder: "Smart Prescription Builder",
    customMedicationPlaceholder: "Add custom medication(s), comma separated",
    aiAnalysis: "🤖 Click to view AI Clinical Analysis & Safety Checks",
    redFlags: "Red Flags",
    transcript: "Transcript",
    processConsultation: "Process Consultation",
    approveAndSave: "Approve & Save",
    exportPdf: "🖨️ Export PDF",
    doctorSuggestions: "Doctor Suggestions for Patient",
    doctorSuggestionsPlaceholder:
      "Add discharge advice, follow-up precautions, hydration guidance, or extra instructions for the printed report.",
    patientReportedConcern: "Patient Reported Concern",
    prescriptionPlan: "Prescription Plan",
    printedSignature: "Doctor Signature",
  },
  FR: {
    activeConsultation: "Consultation en cours",
    treatingClinician: "Clinicien traitant",
    patientHistory: "Historique médical du patient",
    longitudinalTimeline: "Chronologie longitudinale",
    consultationCapture: "Capture de consultation",
    liveAudioAndContext: "Audio en direct et contexte clinique",
    uploadFile: "Téléverser un fichier",
    recordLive: "Enregistrer en direct",
    doctorNotes: "Notes du médecin",
    aiClinicalExtraction: "Extraction clinique IA",
    diagnosisReview: "Revue du diagnostic et des médicaments",
    diagnosis: "Diagnostic",
    chiefComplaint: "Motif principal",
    symptoms: "Symptômes",
    smartPrescriptionBuilder: "Constructeur d'ordonnance",
    customMedicationPlaceholder: "Ajouter des médicaments personnalisés, séparés par des virgules",
    aiAnalysis: "🤖 Cliquer pour voir l'analyse clinique IA et les vérifications de sécurité",
    redFlags: "Signaux d'alerte",
    transcript: "Transcription",
    processConsultation: "Traiter la consultation",
    approveAndSave: "Approuver et enregistrer",
    exportPdf: "🖨️ Exporter en PDF",
    doctorSuggestions: "Conseils du médecin pour le patient",
    doctorSuggestionsPlaceholder:
      "Ajoutez des conseils de sortie, des précautions de suivi, des conseils d'hydratation ou des instructions supplémentaires pour le rapport imprimé.",
    patientReportedConcern: "Plainte rapportée par le patient",
    prescriptionPlan: "Plan de prescription",
    printedSignature: "Signature du médecin",
  },
  AR: {
    activeConsultation: "الاستشارة النشطة",
    treatingClinician: "الطبيب المعالج",
    patientHistory: "السجل الطبي للمريض",
    longitudinalTimeline: "الخط الزمني الطبي",
    consultationCapture: "تسجيل الاستشارة",
    liveAudioAndContext: "الصوت المباشر والسياق السريري",
    uploadFile: "رفع ملف",
    recordLive: "تسجيل مباشر",
    doctorNotes: "ملاحظات الطبيب",
    aiClinicalExtraction: "الاستخراج السريري بالذكاء الاصطناعي",
    diagnosisReview: "مراجعة التشخيص والأدوية",
    diagnosis: "التشخيص",
    chiefComplaint: "الشكوى الرئيسية",
    symptoms: "الأعراض",
    smartPrescriptionBuilder: "منشئ الوصفة الذكي",
    customMedicationPlaceholder: "أضف أدوية مخصصة مفصولة بفواصل",
    aiAnalysis: "🤖 اضغط لعرض التحليل السريري وفحوصات السلامة",
    redFlags: "علامات الخطر",
    transcript: "النص المفرغ",
    processConsultation: "معالجة الاستشارة",
    approveAndSave: "اعتماد وحفظ",
    exportPdf: "🖨️ تصدير PDF",
    doctorSuggestions: "ملاحظات الطبيب للمريض",
    doctorSuggestionsPlaceholder:
      "أضف تعليمات الخروج والمتابعة ونصائح الترطيب أو أي تعليمات إضافية للتقرير المطبوع.",
    patientReportedConcern: "شكوى المريض كما وردت بالصوت",
    prescriptionPlan: "خطة الأدوية",
    printedSignature: "توقيع الطبيب",
  },
  VI: {
    activeConsultation: "Buổi khám đang diễn ra",
    treatingClinician: "Bác sĩ điều trị",
    patientHistory: "Tiền sử bệnh nhân",
    longitudinalTimeline: "Dòng thời gian dọc",
    consultationCapture: "Ghi nhận buổi khám",
    liveAudioAndContext: "Âm thanh trực tiếp và ngữ cảnh lâm sàng",
    uploadFile: "Tải tệp lên",
    recordLive: "Ghi âm trực tiếp",
    doctorNotes: "Ghi chú bác sĩ",
    aiClinicalExtraction: "Trích xuất lâm sàng AI",
    diagnosisReview: "Rà soát chẩn đoán và thuốc",
    diagnosis: "Chẩn đoán",
    chiefComplaint: "Lý do khám chính",
    symptoms: "Triệu chứng",
    smartPrescriptionBuilder: "Trình tạo đơn thuốc thông minh",
    customMedicationPlaceholder: "Thêm thuốc tùy chỉnh, phân tách bằng dấu phẩy",
    aiAnalysis: "🤖 Nhấn để xem phân tích lâm sàng AI và kiểm tra an toàn",
    redFlags: "Dấu hiệu cảnh báo",
    transcript: "Bản chép lời",
    processConsultation: "Xử lý buổi khám",
    approveAndSave: "Duyệt và lưu",
    exportPdf: "🖨️ Xuất PDF",
    doctorSuggestions: "Dặn dò bác sĩ cho bệnh nhân",
    doctorSuggestionsPlaceholder:
      "Thêm lời dặn xuất viện, cảnh báo theo dõi, hướng dẫn uống nước hoặc ghi chú thêm cho bản in.",
    patientReportedConcern: "Điều bệnh nhân trình bày qua lời nói",
    prescriptionPlan: "Kế hoạch thuốc",
    printedSignature: "Chữ ký bác sĩ",
  },
} as const;

type ClinicalData = {
  chief_complaint: string;
  symptoms: string[];
  diagnosis: string;
  suggested_medications: string[];
  red_flags?: string[];
};

type MedicationRow = {
  id: string;
  name: string;
  dose: string;
  timing: string;
  food: string;
  selected: boolean;
};

type InboxMessage = {
  id: number;
  patient_id: string;
  patient_name: string;
  mobile_number?: string;
  doctor_name?: string;
  message: string;
  image_base64: string;
  diagnosis: string;
  final_prescription: string;
  timestamp: string;
  suggested_reply: string;
  clinical_advice: string;
};

type LabReportInboxItem = {
  id: number;
  patient_id: string;
  patient_name: string;
  mobile_number?: string;
  doctor_name: string;
  file_base64: string;
  mime_type: string;
  ai_analysis: string;
  timestamp: string;
};

type SearchResult = {
  found: boolean;
  message: string;
  patient?: {
    patient_id: string;
    name: string;
    mobile_number: string;
  };
  consultations?: Array<{
    id: number;
    timestamp: string;
    doctor_name: string;
    diagnosis: string;
    final_prescription: string;
    transcript: string;
    care_plan: {
      medications: string;
      summary: string;
      day_3_question: string;
      ai_patient_explanation: string;
    };
    chat_log: Array<{
      id: number;
      message: string;
      doctor_reply: string;
      image_base64: string;
      timestamp: string;
    }>;
  }>;
  past_doctors?: string[];
};

type ToastItem = {
  id: number;
  title: string;
  description: string;
};

const emptyClinicalData: ClinicalData = {
  chief_complaint: "",
  symptoms: [],
  diagnosis: "",
  suggested_medications: [],
  red_flags: [],
};

function normalizeDisplayString(value: unknown): string {
  if (typeof value === "string") {
    return value.trim();
  }
  if (Array.isArray(value)) {
    return value
      .map((item) => normalizeDisplayString(item))
      .filter(Boolean)
      .join(", ");
  }
  if (value && typeof value === "object") {
    const prioritizedKeys = [
      "text",
      "value",
      "name",
      "label",
      "condition",
      "diagnosis",
      "symptom",
      "medication",
      "description",
    ] as const;
    for (const key of prioritizedKeys) {
      if (key in value) {
        const normalized = normalizeDisplayString(
          (value as Record<string, unknown>)[key],
        );
        if (normalized) {
          return normalized;
        }
      }
    }
    return Object.values(value as Record<string, unknown>)
      .map((item) => normalizeDisplayString(item))
      .filter(Boolean)
      .join(", ");
  }
  if (value == null) {
    return "";
  }
  return String(value).trim();
}

function normalizeDisplayList(value: unknown): string[] {
  const source = Array.isArray(value) ? value : [value];
  return source.map((item) => normalizeDisplayString(item)).filter(Boolean);
}

function NotificationStack({ items }: { items: ToastItem[] }) {
  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[100] flex w-full max-w-sm flex-col gap-3">
      {items.map((item) => (
        <div
          key={item.id}
          className="pointer-events-auto rounded-[26px] border border-teal-200 bg-white/95 px-4 py-4 shadow-[0_26px_70px_-32px_rgba(13,148,136,0.45)] backdrop-blur toast-slide-in"
        >
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-teal-50 p-2 text-teal-700">
              <Bell className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">{item.title}</p>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                {item.description}
              </p>
            </div>
          </div>
        </div>
      ))}
      <style jsx global>{`
        @keyframes toast-slide-in {
          0% {
            opacity: 0;
            transform: translate3d(32px, 0, 0);
          }
          100% {
            opacity: 1;
            transform: translate3d(0, 0, 0);
          }
        }
        .toast-slide-in {
          animation: toast-slide-in 220ms ease-out;
        }
      `}</style>
    </div>
  );
}

function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function parsePrescriptionDetails(medication: string) {
  const normalized = medication.trim();
  const [nameSegment] = normalized.split(":");
  const doseMatch = normalized.match(
    /(\d+(?:-\d+)?\s?(?:mg|g|mcg|ml|tablet|tablets|capsule|capsules|tab|tabs|puff|puffs|teaspoon|teaspoons|drop|drops|sachet|sachets|tablet[s]?))/i,
  );
  const foodMatch = normalized.match(
    /(before food|after food|with food|without food|before meals|after meals)/i,
  );
  const timingMatch = normalized.match(
    /(every\s+\d+\s*(?:hours?|hrs?)|once daily|twice daily|three times daily|4x\/day|3x\/day|2x\/day|as needed|when needed|morning and night|at bedtime)/i,
  );

  return {
    name: nameSegment.trim() || normalized,
    dose: doseMatch?.[0] || "As prescribed",
    food: foodMatch?.[0] || "Doctor to advise",
    timing: timingMatch?.[0] || "See prescription notes",
  };
}

function medicationToRow(medication: string, index: number): MedicationRow {
  const parsed = parsePrescriptionDetails(medication);
  return {
    id: `med-${index}-${parsed.name.replace(/\s+/g, "-").toLowerCase()}`,
    name: parsed.name,
    dose: parsed.dose,
    timing: parsed.timing,
    food: parsed.food,
    selected: true,
  };
}

export default function Home() {
  const audioInputRef = useRef<HTMLInputElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recordingTimerRef = useRef<number | null>(null);
  const previousEscalationIdsRef = useRef<Set<number>>(new Set());
  const previousLabReportIdsRef = useRef<Set<number>>(new Set());

  const [gatekeeperMode, setGatekeeperMode] = useState<"returning" | "new">(
    "returning",
  );
  const [doctorName, setDoctorName] = useState("");
  const [patientName, setPatientName] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [loadedPatientId, setLoadedPatientId] = useState("");
  const [loadedHistory, setLoadedHistory] = useState<SearchResult | null>(null);
  const [consultationReady, setConsultationReady] = useState(false);
  const [gatekeeperMessage, setGatekeeperMessage] = useState("");
  const [isFetchingHistory, setIsFetchingHistory] = useState(false);

  const [audioMode, setAudioMode] = useState<"upload" | "record">("upload");
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [language, setLanguage] = useState("EN");
  const [doctorNotes, setDoctorNotes] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [microphoneError, setMicrophoneError] = useState("");

  const [transcript, setTranscript] = useState("");
  const [clinicalData, setClinicalData] = useState<ClinicalData>(emptyClinicalData);
  const [editedChiefComplaint, setEditedChiefComplaint] = useState("");
  const [editedDiagnosis, setEditedDiagnosis] = useState("");
  const [editedSymptoms, setEditedSymptoms] = useState("");
  const [doctorSuggestion, setDoctorSuggestion] = useState("");
  const [medicationRows, setMedicationRows] = useState<MedicationRow[]>([]);
  const [error, setError] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveModal, setSaveModal] = useState<{ patientId: string } | null>(null);

  const [inboxOpen, setInboxOpen] = useState(true);
  const [inboxMessages, setInboxMessages] = useState<InboxMessage[]>([]);
  const [inboxReplies, setInboxReplies] = useState<Record<number, string>>({});
  const [sendingReplyId, setSendingReplyId] = useState<number | null>(null);
  const [unreadEscalationCount, setUnreadEscalationCount] = useState(0);
  const [toastItems, setToastItems] = useState<ToastItem[]>([]);
  const [escalationsBannerDismissed, setEscalationsBannerDismissed] = useState(false);
  const [labReports, setLabReports] = useState<LabReportInboxItem[]>([]);

  const imagePreviewUrl = useMemo(() => {
    if (!imageFile) return "";
    return URL.createObjectURL(imageFile);
  }, [imageFile]);

  const recordedAudioUrl = useMemo(() => {
    if (!audioBlob) return "";
    return URL.createObjectURL(audioBlob);
  }, [audioBlob]);

  const addToast = (title: string, description: string) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToastItems((current) => [...current, { id, title, description }]);
    window.setTimeout(() => {
      setToastItems((current) => current.filter((item) => item.id !== id));
    }, 4200);
  };

  const uiCopy = DOCTOR_UI_COPY[language as keyof typeof DOCTOR_UI_COPY] ?? DOCTOR_UI_COPY.EN;

  const printablePrescription = useMemo(
    () => medicationRows.filter((item) => item.selected && item.name.trim()),
    [medicationRows],
  );

  const finalPrescriptionList = useMemo(
    () =>
      printablePrescription.map((item) =>
        [
          item.name.trim(),
          item.dose.trim() ? `Dose: ${item.dose.trim()}` : "",
          item.timing.trim() ? `Timing: ${item.timing.trim()}` : "",
          item.food.trim() ? `Food: ${item.food.trim()}` : "",
        ]
          .filter(Boolean)
          .join(" | "),
      ),
    [printablePrescription],
  );

  const printTimestamp = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date()),
    [],
  );

  useEffect(() => {
    return () => {
      if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    };
  }, [imagePreviewUrl]);

  useEffect(() => {
    return () => {
      if (recordedAudioUrl) URL.revokeObjectURL(recordedAudioUrl);
    };
  }, [recordedAudioUrl]);

  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) window.clearInterval(recordingTimerRef.current);
      mediaRecorderRef.current?.stream.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  useEffect(() => {
    const storedLanguage = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (storedLanguage && LANGUAGE_OPTIONS.some((option) => option.code === storedLanguage)) {
      setLanguage(storedLanguage);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  }, [language]);

  useEffect(() => {
    const storedDoctorName = window.localStorage.getItem(DOCTOR_NAME_STORAGE_KEY);
    if (storedDoctorName) {
      setDoctorName(storedDoctorName);
    }
  }, []);

  useEffect(() => {
    if (doctorName.trim()) {
      window.localStorage.setItem(DOCTOR_NAME_STORAGE_KEY, doctorName.trim());
    }
  }, [doctorName]);

  useEffect(() => {
    let isMounted = true;

    const pollEscalations = async () => {
      try {
        const query = doctorName.trim()
          ? `?doctor_name=${encodeURIComponent(doctorName.trim())}`
          : "";
        const response = await fetch(`${API_BASE_URL}/api/escalations${query}`);
        if (!response.ok) {
          throw new Error("Unable to load escalations.");
        }
        const payload = (await response.json()) as { items?: InboxMessage[] };
        if (!isMounted) return;

        const nextItems = Array.isArray(payload.items) ? payload.items : [];
        const nextIdSet = new Set(nextItems.map((item) => item.id));
        const previousIds = previousEscalationIdsRef.current;
        const newItems = nextItems.filter((item) => !previousIds.has(item.id));

        if (previousIds.size > 0 && newItems.length > 0) {
          setUnreadEscalationCount((current) => current + newItems.length);
          setEscalationsBannerDismissed(false);
          addToast(
            "New Escalation",
            `${newItems[0]?.patient_name || "A patient"} sent a new follow-up.`,
          );
        }

        previousEscalationIdsRef.current = nextIdSet;
        setInboxMessages(nextItems);
        setInboxReplies((current) => {
          const next = { ...current };
          for (const item of nextItems) {
            if (!next[item.id]) next[item.id] = item.suggested_reply || "";
          }
          for (const key of Object.keys(next)) {
            if (!nextItems.some((item) => item.id === Number(key))) {
              delete next[Number(key)];
            }
          }
          return next;
        });
      } catch (pollError) {
        console.error(pollError);
      }
    };

    void pollEscalations();
    const intervalId = window.setInterval(pollEscalations, 3000);
    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, [doctorName]);

  useEffect(() => {
    let isMounted = true;

    const pollLabReports = async () => {
      try {
        const query = doctorName.trim()
          ? `?doctor_name=${encodeURIComponent(doctorName.trim())}`
          : "";
        const response = await fetch(`${API_BASE_URL}/api/doctor/lab-reports${query}`);
        if (!response.ok) {
          throw new Error("Unable to load lab reports.");
        }
        const payload = (await response.json()) as { items?: LabReportInboxItem[] };
        if (!isMounted) return;

        const nextItems = Array.isArray(payload.items) ? payload.items : [];
        const nextIdSet = new Set(nextItems.map((item) => item.id));
        const previousIds = previousLabReportIdsRef.current;
        const newItems = nextItems.filter((item) => !previousIds.has(item.id));

        if (previousIds.size > 0 && newItems.length > 0) {
          setUnreadEscalationCount((current) => current + newItems.length);
          addToast(
            "New Lab Report",
            `${newItems[0]?.patient_name || "A patient"} uploaded a new lab report.`,
          );
        }

        previousLabReportIdsRef.current = nextIdSet;
        setLabReports(nextItems);
      } catch (pollError) {
        console.error(pollError);
      }
    };

    void pollLabReports();
    const intervalId = window.setInterval(pollLabReports, 3000);
    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, [doctorName]);

  const stopMediaStream = () => {
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
  };

  const startRecording = async () => {
    setMicrophoneError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";
      const recorder = new MediaRecorder(stream, { mimeType });
      const chunks: BlobPart[] = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };

      recorder.onstop = () => {
        if (chunks.length > 0) {
          setAudioBlob(new Blob(chunks, { type: mimeType }));
          setAudioFile(null);
        }
        stopMediaStream();
      };

      recorder.onerror = () => {
        setMicrophoneError("Unable to continue live recording. Please retry.");
        setIsRecording(false);
        if (recordingTimerRef.current) window.clearInterval(recordingTimerRef.current);
        stopMediaStream();
      };

      mediaRecorderRef.current = recorder;
      setAudioBlob(null);
      setRecordingSeconds(0);
      recorder.start();
      setIsRecording(true);
      recordingTimerRef.current = window.setInterval(() => {
        setRecordingSeconds((current) => current + 1);
      }, 1000);
    } catch (recordingError) {
      console.error(recordingError);
      setMicrophoneError(
        "Microphone access is unavailable. Please allow permissions or upload a file.",
      );
    }
  };

  const stopRecording = () => {
    if (recordingTimerRef.current) {
      window.clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const fetchHistory = async () => {
    if (!mobileNumber.trim() || !doctorName.trim()) {
      setGatekeeperMessage("Doctor name and mobile number are required.");
      return;
    }

    setIsFetchingHistory(true);
    setGatekeeperMessage("");
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/doctor/search?mobile=${encodeURIComponent(mobileNumber.trim())}`,
      );
      if (!response.ok) {
        const errorPayload = (await response.json().catch(() => null)) as
          | { detail?: string }
          | null;
        throw new Error(errorPayload?.detail ?? "Unable to fetch patient history.");
      }
      const data = (await response.json()) as SearchResult;
      setLoadedHistory(data);
      setGatekeeperMessage(data.message);

      if (data.found && data.patient) {
        setPatientName(data.patient.name);
        setLoadedPatientId(data.patient.patient_id);
        setConsultationReady(true);
      }
    } catch (historyError) {
      setGatekeeperMessage(
        historyError instanceof Error
          ? historyError.message
          : "Unable to fetch patient history.",
      );
    } finally {
      setIsFetchingHistory(false);
    }
  };

  const beginNewConsultation = () => {
    if (!patientName.trim() || !mobileNumber.trim() || !doctorName.trim()) {
      setGatekeeperMessage("Full name, mobile number, and doctor name are required.");
      return;
    }

    setLoadedHistory({
      found: false,
      message: "New Patient. Proceed with Consultation intake.",
      consultations: [],
    });
    setLoadedPatientId("");
    setConsultationReady(true);
    setGatekeeperMessage("");
  };

  const resetConsultation = () => {
    setConsultationReady(false);
    setLoadedPatientId("");
    setLoadedHistory(null);
    setPatientName("");
    setMobileNumber("");
    setTranscript("");
    setDoctorNotes("");
    setImageFile(null);
    setAudioFile(null);
    setAudioBlob(null);
    setClinicalData(emptyClinicalData);
    setEditedChiefComplaint("");
    setEditedDiagnosis("");
    setEditedSymptoms("");
    setDoctorSuggestion("");
    setMedicationRows([]);
    setError("");
    setGatekeeperMode("returning");
  };

  const handleAudioSelection = (file: File | null) => {
    if (!file) {
      setAudioFile(null);
      return;
    }
    if (!file.type.startsWith("audio/") && !file.name.endsWith(".webm")) {
      setError("Please upload a valid audio file.");
      return;
    }
    setError("");
    setAudioFile(file);
    setAudioBlob(null);
  };

  const handleImageSelection = (file: File | null) => {
    if (!file) {
      setImageFile(null);
      return;
    }
    if (!file.type.startsWith("image/")) {
      setError("Please upload a valid image file.");
      return;
    }
    setImageFile(file);
  };

  const processConsultation = async () => {
    const resolvedAudio =
      audioMode === "record"
        ? audioBlob
          ? new File([audioBlob], "consultation-recording.webm", {
              type: audioBlob.type || "audio/webm",
            })
          : null
        : audioFile;

    if (!patientName.trim() || !mobileNumber.trim() || !doctorName.trim()) {
      setError("Patient name, mobile number, and doctor name are required.");
      return;
    }
    if (!resolvedAudio) {
      setError("Consultation audio is required.");
      return;
    }

    setIsProcessing(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("name", patientName.trim());
      formData.append("mobile_number", mobileNumber.trim());
      formData.append("language", language);
      formData.append("doctor_notes", doctorNotes);
      formData.append("audio", resolvedAudio, resolvedAudio.name);
      if (imageFile) formData.append("image", imageFile, imageFile.name);

      const response = await fetch(`${API_BASE_URL}/api/transcribe`, {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        const errorPayload = (await response.json().catch(() => null)) as
          | { detail?: string }
          | null;
        throw new Error(errorPayload?.detail ?? "Unable to process consultation.");
      }
      const data = (await response.json()) as {
        transcript?: string;
        clinical_data?: ClinicalData;
      };
      const nextClinicalData = data.clinical_data ?? emptyClinicalData;
      const normalizedClinicalData: ClinicalData = {
        chief_complaint: normalizeDisplayString(nextClinicalData.chief_complaint),
        symptoms: normalizeDisplayList(nextClinicalData.symptoms),
        diagnosis: normalizeDisplayString(nextClinicalData.diagnosis),
        suggested_medications: normalizeDisplayList(
          nextClinicalData.suggested_medications,
        ),
        red_flags: normalizeDisplayList(nextClinicalData.red_flags ?? []),
      };
      setTranscript(data.transcript ?? "");
      setClinicalData(normalizedClinicalData);
      setEditedChiefComplaint(normalizedClinicalData.chief_complaint ?? "");
      setEditedDiagnosis(normalizedClinicalData.diagnosis ?? "");
      setEditedSymptoms((normalizedClinicalData.symptoms ?? []).join(", "));
      setMedicationRows(
        (normalizedClinicalData.suggested_medications ?? []).map((item, index) =>
          medicationToRow(item, index),
        ),
      );
      addToast("AI Extraction Ready", "Clinical extraction is ready for doctor review.");
    } catch (processingError) {
      setError(
        processingError instanceof Error
          ? processingError.message
          : "Unable to process consultation.",
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const saveConsultation = async () => {
    const normalizedSymptoms = editedSymptoms
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    const finalPrescription = finalPrescriptionList;

    if (!transcript || !editedDiagnosis.trim()) {
      setError("Process the consultation before saving.");
      return;
    }
    if (!doctorName.trim()) {
      setError("Doctor name is required.");
      return;
    }
    if (finalPrescription.length === 0) {
      setError("Add at least one final medication.");
      return;
    }

    setIsSaving(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE_URL}/api/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: patientName.trim(),
          mobile_number: mobileNumber.trim(),
          doctor_name: doctorName.trim(),
          doctor_notes: doctorNotes.trim(),
          transcript,
          symptoms: normalizedSymptoms,
          diagnosis: editedDiagnosis.trim(),
          final_prescription_structured: printablePrescription,
          final_prescription: finalPrescription,
        }),
      });
      if (!response.ok) {
        const errorPayload = (await response.json().catch(() => null)) as
          | { detail?: string }
          | null;
        throw new Error(errorPayload?.detail ?? "Unable to save consultation.");
      }
      const data = (await response.json()) as { patient_id?: string };
      setLoadedPatientId(data.patient_id ?? loadedPatientId);
      setSaveModal({ patientId: data.patient_id ?? "PT-0000" });
      addToast("Consultation Saved", "The care plan and patient timeline were updated.");
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Unable to save consultation.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const sendDoctorReply = async (messageId: number) => {
    const replyText = (inboxReplies[messageId] ?? "").trim();
    if (!replyText) {
      setError("Please add a doctor reply before closing the escalation.");
      return;
    }

    setSendingReplyId(messageId);
    try {
      const response = await fetch(`${API_BASE_URL}/api/doctor/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message_id: messageId, reply_text: replyText }),
      });
      if (!response.ok) {
        const errorPayload = (await response.json().catch(() => null)) as
          | { detail?: string }
          | null;
        throw new Error(errorPayload?.detail ?? "Unable to send reply.");
      }
      setInboxMessages((current) => current.filter((message) => message.id !== messageId));
      setUnreadEscalationCount((current) => Math.max(0, current - 1));
      addToast("Reply Sent", "The escalation has been resolved.");
    } catch (replyError) {
      setError(replyError instanceof Error ? replyError.message : "Unable to send reply.");
    } finally {
      setSendingReplyId(null);
    }
  };

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#eef6f5_55%,#f8fafc_100%)] text-slate-900">
      <div className="print:hidden">
        <NotificationStack items={toastItems} />
      </div>

      {saveModal ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/45 px-4 backdrop-blur-md">
          <div className="w-full max-w-xl rounded-[34px] border border-emerald-200 bg-white p-8 shadow-[0_36px_120px_-42px_rgba(16,185,129,0.65)]">
            <div className="flex items-center gap-4">
              <div className="rounded-3xl bg-emerald-50 p-3 text-emerald-700">
                <Check className="h-7 w-7" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-700">
                  Consultation Saved
                </p>
                <h2 className="mt-1 text-3xl font-semibold text-slate-950">
                  Timeline updated successfully
                </h2>
              </div>
            </div>
            <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                Patient ID
              </p>
              <p className="mt-2 text-2xl font-semibold text-slate-950">
                {saveModal.patientId}
              </p>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setSaveModal(null)}
                className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700"
              >
                Continue
              </button>
              <button
                type="button"
                onClick={resetConsultation}
                className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white"
              >
                End Consultation
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {!consultationReady ? (
        <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-6 py-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(20,184,166,0.17),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(14,165,233,0.16),transparent_26%),linear-gradient(145deg,rgba(248,250,252,0.94),rgba(240,253,250,0.92),rgba(255,255,255,0.98))]" />
          <div className="absolute inset-0 backdrop-blur-[10px]" />
          <div className="relative w-full max-w-3xl rounded-[40px] border border-white/80 bg-white/88 p-8 shadow-[0_40px_120px_-55px_rgba(15,23,42,0.45)] backdrop-blur-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.32em] text-teal-700">
                  Elfie Clinical OS
                </p>
                <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950">
                  Gatekeeper Intake
                </h1>
                <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
                  Start every consultation by identifying the patient, loading their
                  longitudinal memory, and declaring the treating doctor.
                </p>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-3 text-slate-700">
                <ShieldCheck className="h-7 w-7" />
              </div>
            </div>

            <div className="mt-8 rounded-[28px] border border-slate-200 bg-slate-50 p-2">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setGatekeeperMode("returning")}
                  className={`rounded-[22px] px-4 py-3 text-sm font-semibold transition-all ${
                    gatekeeperMode === "returning"
                      ? "bg-white text-slate-950 shadow-sm"
                      : "text-slate-500"
                  }`}
                >
                  Returning Patient
                </button>
                <button
                  type="button"
                  onClick={() => setGatekeeperMode("new")}
                  className={`rounded-[22px] px-4 py-3 text-sm font-semibold transition-all ${
                    gatekeeperMode === "new"
                      ? "bg-white text-slate-950 shadow-sm"
                      : "text-slate-500"
                  }`}
                >
                  New Patient
                </button>
              </div>
            </div>

            <div className="mt-8 grid gap-5 md:grid-cols-2">
              <label className="block">
                <span className="text-sm font-medium text-slate-600">Doctor Name</span>
                <input
                  value={doctorName}
                  onChange={(event) => setDoctorName(event.target.value)}
                  placeholder="e.g. Dr. Lee"
                  className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-800 outline-none transition-all focus:border-teal-400 focus:ring-4 focus:ring-teal-100"
                />
              </label>

              {gatekeeperMode === "returning" ? (
                <label className="block">
                  <span className="text-sm font-medium text-slate-600">Mobile Number</span>
                  <input
                    value={mobileNumber}
                    onChange={(event) => setMobileNumber(event.target.value)}
                    placeholder="Enter patient mobile number"
                    className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-800 outline-none transition-all focus:border-teal-400 focus:ring-4 focus:ring-teal-100"
                  />
                </label>
              ) : (
                <>
                  <label className="block">
                    <span className="text-sm font-medium text-slate-600">Full Name</span>
                    <input
                      value={patientName}
                      onChange={(event) => setPatientName(event.target.value)}
                      placeholder="Enter patient full name"
                      className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-800 outline-none transition-all focus:border-teal-400 focus:ring-4 focus:ring-teal-100"
                    />
                  </label>
                  <label className="block">
                    <span className="text-sm font-medium text-slate-600">Mobile Number</span>
                    <input
                      value={mobileNumber}
                      onChange={(event) => setMobileNumber(event.target.value)}
                      placeholder="Enter patient mobile number"
                      className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-800 outline-none transition-all focus:border-teal-400 focus:ring-4 focus:ring-teal-100"
                    />
                  </label>
                </>
              )}
            </div>

            {gatekeeperMessage ? (
              <div className="mt-6 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700">
                {gatekeeperMessage}
              </div>
            ) : null}

            <div className="mt-8 flex justify-end">
              {gatekeeperMode === "returning" ? (
                <button
                  type="button"
                  onClick={fetchHistory}
                  disabled={isFetchingHistory}
                  className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-6 py-3.5 text-sm font-semibold text-white shadow-lg transition-all hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  <Search className="h-4 w-4" />
                  {isFetchingHistory ? "Fetching..." : "Fetch History"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={beginNewConsultation}
                  className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-6 py-3.5 text-sm font-semibold text-white shadow-lg transition-all hover:bg-slate-800"
                >
                  <ClipboardList className="h-4 w-4" />
                  Begin Consultation
                </button>
              )}
            </div>
          </div>

          <div className="fixed right-6 top-6 z-40 flex items-center gap-3 print:hidden">
            {doctorName.trim() ? (
              <div className="rounded-2xl border border-white/70 bg-white/85 px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm backdrop-blur">
                {doctorName.trim()}
              </div>
            ) : null}
            <button
              type="button"
              onClick={() => {
                setInboxOpen((current) => !current);
                setUnreadEscalationCount(0);
              }}
              className="relative flex h-12 w-12 items-center justify-center rounded-2xl border border-white/70 bg-white/90 text-slate-700 shadow-sm backdrop-blur"
            >
              <Bell className="h-5 w-5" />
              {unreadEscalationCount > 0 ? (
                <span className="absolute -right-1 -top-1 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white">
                  {unreadEscalationCount}
                </span>
              ) : null}
            </button>
          </div>

          <aside
            className={`fixed right-0 top-0 z-50 h-screen w-[390px] transform border-l border-slate-200 bg-white shadow-[-20px_0_60px_-36px_rgba(15,23,42,0.35)] transition-transform duration-300 print:hidden ${
              inboxOpen ? "translate-x-0" : "translate-x-[336px]"
            }`}
          >
            <div className="flex h-full flex-col">
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
                    Inbox
                  </p>
                  <h2 className="mt-1 text-xl font-semibold text-slate-950">
                    Escalations
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setInboxOpen((current) => !current);
                    setUnreadEscalationCount(0);
                  }}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-2 text-slate-600"
                >
                  {inboxOpen ? <X className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
                </button>
              </div>

              <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
                {labReports.length ? (
                  <div className="space-y-4">
                    {labReports.map((report) => {
                      let analysis: Record<string, string> = {};
                      try {
                        analysis = JSON.parse(report.ai_analysis || "{}") as Record<string, string>;
                      } catch (parseError) {
                        console.error(parseError);
                      }

                      return (
                        <div
                          key={`gatekeeper-lab-${report.id}`}
                          className="rounded-[26px] border border-sky-200 bg-sky-50/60 p-4"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                                {report.timestamp}
                              </p>
                              <p className="mt-2 text-sm font-semibold text-slate-900">
                                {report.patient_name || "Patient"} • {report.mobile_number || "Unknown mobile"}
                              </p>
                              <p className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-sky-700">
                                Lab report routed to {report.doctor_name || "Doctor"}
                              </p>
                            </div>
                            <a
                              href={report.file_base64}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-2xl border border-sky-200 bg-white px-3 py-2 text-xs font-semibold text-sky-700 shadow-sm"
                            >
                              View Raw File
                            </a>
                          </div>
                          <details className="group mt-3 rounded-2xl border border-sky-200 bg-white p-3">
                            <summary className="cursor-pointer text-sm font-semibold text-indigo-600">
                              🤖 Click to view AI analysis
                            </summary>
                            <div className="mt-3 space-y-3">
                              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                                  Purpose
                                </p>
                                <p className="mt-2 text-sm leading-6 text-slate-700">
                                  {analysis.purpose_of_test || "No purpose summary available."}
                                </p>
                              </div>
                              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                                  Findings
                                </p>
                                <p className="mt-2 text-sm leading-6 text-slate-700">
                                  {analysis.what_the_report_says || "No findings summary available."}
                                </p>
                              </div>
                              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3">
                                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">
                                  Abnormal Results
                                </p>
                                <p className="mt-2 text-sm leading-6 text-amber-900">
                                  {analysis.concerns_and_abnormals || "No abnormal result summary available."}
                                </p>
                              </div>
                            </div>
                          </details>
                        </div>
                      );
                    })}
                  </div>
                ) : null}

                {inboxMessages.length ? (
                  inboxMessages.map((message) => (
                    <div
                      key={`gatekeeper-message-${message.id}`}
                      className="rounded-[26px] border border-slate-200 bg-slate-50 p-4"
                    >
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                        {message.timestamp}
                      </p>
                      <p className="mt-2 text-sm font-semibold text-slate-900">
                        {message.patient_name || "Patient"} • {message.mobile_number || "Unknown mobile"}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        {message.message}
                      </p>
                      <details className="group mt-3 rounded-2xl border border-teal-200 bg-teal-50 p-3">
                        <summary className="cursor-pointer text-sm font-semibold text-indigo-600">
                          🤖 Click to view AI analysis
                        </summary>
                        <div className="mt-3 rounded-2xl border border-teal-100 bg-white/80 p-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">
                            AI Advice
                          </p>
                          <p className="mt-2 text-sm leading-6 text-teal-900">
                            {message.clinical_advice}
                          </p>
                        </div>
                      </details>
                      <textarea
                        value={inboxReplies[message.id] ?? ""}
                        onChange={(event) =>
                          setInboxReplies((current) => ({
                            ...current,
                            [message.id]: event.target.value,
                          }))
                        }
                        className="mt-3 min-h-[110px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-800 outline-none transition-all focus:border-teal-400 focus:ring-4 focus:ring-teal-100"
                      />
                      <button
                        type="button"
                        onClick={() => sendDoctorReply(message.id)}
                        disabled={sendingReplyId === message.id}
                        className="mt-3 inline-flex w-full items-center justify-center rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
                      >
                        {sendingReplyId === message.id ? "Sending..." : "Reply & Close"}
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                    No live escalations right now.
                  </div>
                )}
              </div>
            </div>
          </aside>
        </div>
      ) : (
        <div className="min-h-screen">
          <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/92 backdrop-blur print:hidden">
            <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4 px-6 py-4 sm:px-8">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-teal-700">
                  {uiCopy.activeConsultation}
                </p>
                <h1 className="mt-1 text-2xl font-semibold text-slate-950">
                  {patientName || "Patient"} • {mobileNumber}
                </h1>
                <p className="mt-1 text-sm text-slate-500">
                  {uiCopy.treatingClinician}: {doctorName || "Doctor"} {loadedPatientId ? `• ${loadedPatientId}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setInboxOpen((current) => !current);
                    setUnreadEscalationCount(0);
                  }}
                  className="relative flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm"
                >
                  <Bell className="h-5 w-5" />
                  {unreadEscalationCount > 0 ? (
                    <span className="absolute -right-1 -top-1 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white">
                      {unreadEscalationCount}
                    </span>
                  ) : null}
                </button>
                <select
                  value={language}
                  onChange={(event) => setLanguage(event.target.value)}
                  className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm outline-none"
                >
                  {LANGUAGE_OPTIONS.map((option) => (
                    <option key={option.code} value={option.code}>
                      {option.code}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={resetConsultation}
                  className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-lg"
                >
                  End Consultation
                </button>
              </div>
            </div>
          </header>

          <div className="mx-auto flex max-w-[1500px] gap-6 px-6 py-6 sm:px-8 print:px-0 print:py-0">
            <div className="grid min-w-0 flex-1 gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
              <section className="space-y-6 print:hidden">
                <div className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_24px_70px_-40px_rgba(15,23,42,0.22)]">
                  <div className="flex items-center gap-3">
                    <div className="rounded-2xl bg-teal-50 p-3 text-teal-700">
                      <History className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
                        {uiCopy.patientHistory}
                      </p>
                      <h2 className="mt-1 text-xl font-semibold text-slate-950">
                        {uiCopy.longitudinalTimeline}
                      </h2>
                    </div>
                  </div>

                  <div className="mt-5 max-h-[340px] space-y-4 overflow-y-auto pr-1">
                    {loadedHistory?.consultations?.length ? (
                      loadedHistory.consultations
                        .slice()
                        .reverse()
                        .map((visit) => (
                          <div
                            key={visit.id}
                            className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                          >
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                              {visit.timestamp} • {visit.doctor_name || "Doctor"}
                            </p>
                            <p className="mt-2 text-sm font-semibold text-slate-900">
                              {visit.diagnosis || "Diagnosis pending"}
                            </p>
                            <p className="mt-2 text-sm leading-6 text-slate-600">
                              {visit.final_prescription || "No medications recorded."}
                            </p>
                          </div>
                        ))
                    ) : (
                      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                        New Patient. Proceed with Consultation intake.
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_24px_70px_-40px_rgba(15,23,42,0.22)]">
                  <div className="flex items-center gap-3">
                    <div className="rounded-2xl bg-slate-900 p-3 text-white">
                      <FileAudio2 className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
                        {uiCopy.consultationCapture}
                      </p>
                      <h2 className="mt-1 text-xl font-semibold text-slate-950">
                        {uiCopy.liveAudioAndContext}
                      </h2>
                    </div>
                  </div>

                  <div className="mt-5 rounded-[24px] border border-slate-200 bg-slate-50 p-2">
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setAudioMode("upload")}
                        className={`rounded-[18px] px-4 py-3 text-sm font-semibold ${
                          audioMode === "upload"
                            ? "bg-white text-slate-950 shadow-sm"
                            : "text-slate-500"
                        }`}
                      >
                        {uiCopy.uploadFile}
                      </button>
                      <button
                        type="button"
                        onClick={() => setAudioMode("record")}
                        className={`rounded-[18px] px-4 py-3 text-sm font-semibold ${
                          audioMode === "record"
                            ? "bg-white text-slate-950 shadow-sm"
                            : "text-slate-500"
                        }`}
                      >
                        {uiCopy.recordLive}
                      </button>
                    </div>
                  </div>

                  <input
                    ref={audioInputRef}
                    type="file"
                    accept="audio/*,.webm"
                    className="hidden"
                    onChange={(event: ChangeEvent<HTMLInputElement>) =>
                      handleAudioSelection(event.target.files?.[0] ?? null)
                    }
                  />

                  {audioMode === "upload" ? (
                    <button
                      type="button"
                      onClick={() => audioInputRef.current?.click()}
                      className="mt-5 flex w-full items-center justify-between rounded-[24px] border border-dashed border-slate-300 bg-white px-5 py-5 text-left"
                    >
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          Consultation audio
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          {audioFile ? audioFile.name : "Upload consultation audio file"}
                        </p>
                      </div>
                      <div className="rounded-2xl bg-slate-50 p-3 text-slate-600">
                        <Upload className="h-5 w-5" />
                      </div>
                    </button>
                  ) : (
                    <div className="mt-5 rounded-[24px] border border-slate-200 bg-gradient-to-br from-slate-950 via-slate-900 to-teal-950 p-5 text-white shadow-[0_24px_80px_-36px_rgba(15,23,42,0.8)]">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-sm font-semibold">Live consultation recorder</p>
                          <p className="mt-1 text-sm text-white/70">
                            Start secure browser capture for the active consult.
                          </p>
                        </div>
                        <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-sm font-semibold">
                          <span
                            className={`h-2.5 w-2.5 rounded-full ${
                              isRecording ? "animate-pulse bg-rose-400" : "bg-white/40"
                            }`}
                          />
                          {formatDuration(recordingSeconds)}
                        </div>
                      </div>

                      <div className="mt-5 flex gap-3">
                        {!isRecording ? (
                          <button
                            type="button"
                            onClick={startRecording}
                            className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-rose-500 px-5 py-4 text-sm font-semibold text-white"
                          >
                            <Mic className="h-4 w-4" />
                            Start Consultation Recording
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={stopRecording}
                            className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-white px-5 py-4 text-sm font-semibold text-slate-950"
                          >
                            <Square className="h-4 w-4" />
                            Stop Recording
                          </button>
                        )}
                      </div>

                      {microphoneError ? (
                        <div className="mt-4 rounded-2xl border border-rose-300/40 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
                          {microphoneError}
                        </div>
                      ) : null}

                      {recordedAudioUrl ? (
                        <audio controls className="mt-4 w-full">
                          <source src={recordedAudioUrl} type={audioBlob?.type || "audio/webm"} />
                        </audio>
                      ) : null}
                    </div>
                  )}

                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event: ChangeEvent<HTMLInputElement>) =>
                      handleImageSelection(event.target.files?.[0] ?? null)
                    }
                  />

                  <button
                    type="button"
                    onClick={() => imageInputRef.current?.click()}
                    className="mt-5 flex w-full flex-col items-center justify-center rounded-[24px] border border-dashed border-slate-300 bg-slate-50 px-5 py-6 text-center"
                  >
                    {imagePreviewUrl ? (
                      <div className="w-full overflow-hidden rounded-3xl border border-slate-200 bg-white">
                        <Image
                          src={imagePreviewUrl}
                          alt="Symptom preview"
                          width={960}
                          height={640}
                          className="h-40 w-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-slate-500 shadow-sm">
                        <ImagePlus className="h-7 w-7" />
                      </div>
                    )}
                    <p className="mt-4 text-sm font-semibold text-slate-800">
                      {imageFile ? imageFile.name : "Optional symptom image"}
                    </p>
                  </button>

                  <label className="mt-5 block">
                    <span className="text-sm font-medium text-slate-600">
                      {uiCopy.doctorNotes}
                    </span>
                    <textarea
                      value={doctorNotes}
                      onChange={(event) => setDoctorNotes(event.target.value)}
                      placeholder="Add focused observations, differentials, and bedside context."
                      className="mt-2 min-h-[150px] w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-7 text-slate-800 outline-none transition-all focus:border-teal-400 focus:ring-4 focus:ring-teal-100"
                    />
                  </label>
                </div>
              </section>

              <section className="space-y-6 print:col-span-full">
                {error ? (
                  <div className="rounded-3xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-medium text-rose-700">
                    {error}
                  </div>
                ) : null}

                <div className="hidden print:block">
                  <div className="rounded-none border border-slate-300 bg-white p-8 text-slate-900">
                    <div className="border-b border-slate-300 pb-5">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="font-semibold">Patient Name</p>
                          <p>{patientName || "Patient"}</p>
                        </div>
                        <div>
                          <p className="font-semibold">Patient Number</p>
                          <p>{mobileNumber || "-"}</p>
                        </div>
                        <div>
                          <p className="font-semibold">Patient ID</p>
                          <p>{loadedPatientId || "-"}</p>
                        </div>
                        <div>
                          <p className="font-semibold">Doctor Name</p>
                          <p>{doctorName || "-"}</p>
                        </div>
                        <div>
                          <p className="font-semibold">Date & Time</p>
                          <p>{printTimestamp}</p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-6">
                      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                        {uiCopy.diagnosis}
                      </p>
                      <p className="mt-2 text-lg font-semibold">{editedDiagnosis || "-"}</p>
                    </div>

                    <div className="mt-6">
                      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                        {uiCopy.patientReportedConcern}
                      </p>
                      <p className="mt-2 leading-7">{editedChiefComplaint || transcript || "-"}</p>
                    </div>

                    <div className="mt-6">
                      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                        {uiCopy.prescriptionPlan}
                      </p>
                      <table className="mt-3 w-full border-collapse text-left text-sm">
                        <tbody>
                          <tr>
                            <th className="border border-slate-300 bg-slate-100 px-3 py-3 font-semibold">
                              Field
                            </th>
                            {printablePrescription.length ? (
                              printablePrescription.map((item) => (
                                <td key={`name-${item.name}`} className="border border-slate-300 px-3 py-3">
                                  {item.name}
                                </td>
                              ))
                            ) : (
                              <td className="border border-slate-300 px-3 py-3">-</td>
                            )}
                          </tr>
                          <tr>
                            <th className="border border-slate-300 bg-slate-100 px-3 py-3 font-semibold">
                              Dose
                            </th>
                            {printablePrescription.length ? (
                              printablePrescription.map((item) => (
                                <td key={`dose-${item.name}`} className="border border-slate-300 px-3 py-3">
                                  {item.dose}
                                </td>
                              ))
                            ) : (
                              <td className="border border-slate-300 px-3 py-3">-</td>
                            )}
                          </tr>
                          <tr>
                            <th className="border border-slate-300 bg-slate-100 px-3 py-3 font-semibold">
                              Before / After Food
                            </th>
                            {printablePrescription.length ? (
                              printablePrescription.map((item) => (
                                <td key={`food-${item.name}`} className="border border-slate-300 px-3 py-3">
                                  {item.food}
                                </td>
                              ))
                            ) : (
                              <td className="border border-slate-300 px-3 py-3">-</td>
                            )}
                          </tr>
                          <tr>
                            <th className="border border-slate-300 bg-slate-100 px-3 py-3 font-semibold">
                              Timing
                            </th>
                            {printablePrescription.length ? (
                              printablePrescription.map((item) => (
                                <td key={`time-${item.name}`} className="border border-slate-300 px-3 py-3">
                                  {item.timing}
                                </td>
                              ))
                            ) : (
                              <td className="border border-slate-300 px-3 py-3">-</td>
                            )}
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {doctorSuggestion.trim() ? (
                      <div className="mt-6">
                        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                          {uiCopy.doctorSuggestions}
                        </p>
                        <div className="mt-3 rounded-xl border border-slate-300 px-4 py-4 leading-7">
                          {doctorSuggestion}
                        </div>
                      </div>
                    ) : null}

                    <div className="mt-12 flex justify-end">
                      <div className="w-72">
                        <div className="h-24 rounded-xl border border-dashed border-slate-400" />
                        <p className="mt-3 text-sm font-semibold">{uiCopy.printedSignature}</p>
                        <p className="text-sm">{doctorName || "-"}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {!escalationsBannerDismissed &&
                inboxMessages &&
                inboxMessages.length > 0 && (
                  <div className="rounded-[28px] border border-amber-200 bg-[linear-gradient(135deg,rgba(255,251,235,0.96),rgba(255,255,255,0.98))] px-5 py-4 shadow-[0_20px_50px_-32px_rgba(217,119,6,0.45)] print:hidden">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className="rounded-2xl bg-amber-100 p-2.5 text-amber-700">
                          <Bell className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-700">
                            Urgent Escalations
                          </p>
                          <p className="mt-1 text-sm text-slate-700">
                            {inboxMessages.length} live patient follow-up
                            {inboxMessages.length > 1 ? "s require" : " requires"} doctor review.
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setEscalationsBannerDismissed(true)}
                        className="rounded-2xl border border-amber-200 bg-white p-2 text-amber-700"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}

                {labReports && labReports.length > 0 && (
                  <div className="rounded-[28px] border border-sky-200 bg-[linear-gradient(135deg,rgba(239,246,255,0.96),rgba(255,255,255,0.98))] px-5 py-4 shadow-[0_20px_50px_-32px_rgba(14,165,233,0.35)] print:hidden">
                    <div className="flex items-center gap-3">
                      <div className="rounded-2xl bg-sky-100 p-2.5 text-sky-700">
                        <FlaskConical className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-700">
                          Incoming Lab Reports
                        </p>
                        <p className="mt-1 text-sm text-slate-700">
                          {labReports.length} lab report{labReports.length > 1 ? "s are" : " is"} ready for clinical review.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_24px_70px_-40px_rgba(15,23,42,0.22)] print:hidden">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
                        {uiCopy.aiClinicalExtraction}
                      </p>
                      <h2 className="mt-1 text-2xl font-semibold text-slate-950">
                        {uiCopy.diagnosisReview}
                      </h2>
                    </div>
                    <div className="rounded-2xl bg-teal-50 p-3 text-teal-700">
                      <Stethoscope className="h-5 w-5" />
                    </div>
                  </div>

                  <div className="mt-6 grid gap-4 md:grid-cols-2">
                    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                        {uiCopy.diagnosis}
                      </p>
                      <textarea
                        value={editedDiagnosis}
                        onChange={(event) => setEditedDiagnosis(event.target.value)}
                        placeholder="AI diagnosis will appear here for doctor review."
                        className="mt-3 min-h-[120px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-7 text-slate-800 outline-none transition-all focus:border-teal-400 focus:ring-4 focus:ring-teal-100"
                      />
                    </div>
                    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                        {uiCopy.chiefComplaint}
                      </p>
                      <textarea
                        value={editedChiefComplaint}
                        onChange={(event) => setEditedChiefComplaint(event.target.value)}
                        placeholder="Chief complaint will appear here after processing."
                        className="mt-3 min-h-[120px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-7 text-slate-800 outline-none transition-all focus:border-teal-400 focus:ring-4 focus:ring-teal-100"
                      />
                    </div>
                  </div>

                  <div className="mt-4 rounded-3xl border border-slate-200 bg-white p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                      {uiCopy.symptoms}
                    </p>
                    <textarea
                      value={editedSymptoms}
                      onChange={(event) => setEditedSymptoms(event.target.value)}
                      placeholder="Comma-separated symptoms"
                      className="mt-4 min-h-[120px] w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-7 text-slate-800 outline-none transition-all focus:border-teal-400 focus:ring-4 focus:ring-teal-100"
                    />
                    <div className="mt-4 flex flex-wrap gap-3">
                      {editedSymptoms
                        .split(",")
                        .map((item) => item.trim())
                        .filter(Boolean).length ? (
                        editedSymptoms
                          .split(",")
                          .map((item) => item.trim())
                          .filter(Boolean)
                          .map((symptom) => (
                          <span
                            key={symptom}
                            className="rounded-full border border-teal-200 bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-700"
                          >
                            {symptom}
                          </span>
                          ))
                      ) : (
                        <span className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700">
                          Symptoms will appear after processing
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 rounded-3xl border border-slate-200 bg-white p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                      {uiCopy.smartPrescriptionBuilder}
                    </p>
                    <div className="mt-4 space-y-3">
                      {medicationRows.length ? (
                        medicationRows.map((medication) => (
                          <div
                            key={medication.id}
                            className={`rounded-2xl border px-4 py-4 ${
                              medication.selected
                                ? "border-emerald-300 bg-emerald-50/60"
                                : "border-slate-200 bg-slate-50"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <label className="inline-flex items-center gap-3 text-sm font-semibold text-slate-800">
                                <input
                                  type="checkbox"
                                  checked={medication.selected}
                                  onChange={() =>
                                    setMedicationRows((current) =>
                                      current.map((item) =>
                                        item.id === medication.id
                                          ? { ...item, selected: !item.selected }
                                          : item,
                                      ),
                                    )
                                  }
                                  className="h-4 w-4"
                                />
                                Include in final prescription
                              </label>
                              <button
                                type="button"
                                onClick={() =>
                                  setMedicationRows((current) =>
                                    current.filter((item) => item.id !== medication.id),
                                  )
                                }
                                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600"
                              >
                                Remove
                              </button>
                            </div>
                            <div className="mt-4 grid gap-3 md:grid-cols-2">
                              <input
                                value={medication.name}
                                onChange={(event) =>
                                  setMedicationRows((current) =>
                                    current.map((item) =>
                                      item.id === medication.id
                                        ? { ...item, name: event.target.value }
                                        : item,
                                    ),
                                  )
                                }
                                placeholder="Medicine name"
                                className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-800 outline-none transition-all focus:border-teal-400 focus:ring-4 focus:ring-teal-100"
                              />
                              <input
                                value={medication.dose}
                                onChange={(event) =>
                                  setMedicationRows((current) =>
                                    current.map((item) =>
                                      item.id === medication.id
                                        ? { ...item, dose: event.target.value }
                                        : item,
                                    ),
                                  )
                                }
                                placeholder="Dose"
                                className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-800 outline-none transition-all focus:border-teal-400 focus:ring-4 focus:ring-teal-100"
                              />
                              <input
                                value={medication.timing}
                                onChange={(event) =>
                                  setMedicationRows((current) =>
                                    current.map((item) =>
                                      item.id === medication.id
                                        ? { ...item, timing: event.target.value }
                                        : item,
                                    ),
                                  )
                                }
                                placeholder="Timing"
                                className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-800 outline-none transition-all focus:border-teal-400 focus:ring-4 focus:ring-teal-100"
                              />
                              <select
                                value={medication.food}
                                onChange={(event) =>
                                  setMedicationRows((current) =>
                                    current.map((item) =>
                                      item.id === medication.id
                                        ? { ...item, food: event.target.value }
                                        : item,
                                    ),
                                  )
                                }
                                className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-800 outline-none transition-all focus:border-teal-400 focus:ring-4 focus:ring-teal-100"
                              >
                                <option value="">Select food instruction</option>
                                <option value="Before food">Before food</option>
                                <option value="After food">After food</option>
                                <option value="With food">With food</option>
                                <option value="Without food">Without food</option>
                              </select>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                          Suggested medications will appear after processing.
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setMedicationRows((current) => [
                          ...current,
                          {
                            id: `custom-${Date.now()}`,
                            name: "",
                            dose: "",
                            timing: "",
                            food: "",
                            selected: true,
                          },
                        ])
                      }
                      className="mt-4 inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm"
                    >
                      Add Medicine Row
                    </button>
                  </div>

                  <details className="group mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <summary className="cursor-pointer font-semibold flex items-center text-indigo-600">
                      {uiCopy.aiAnalysis}
                    </summary>
                    <div className="mt-4 space-y-4">
                      <div className="rounded-3xl border border-slate-200 bg-white p-5">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                          {uiCopy.redFlags}
                        </p>
                        <div className="mt-4 flex flex-wrap gap-3">
                          {normalizeDisplayList(clinicalData.red_flags).length ? (
                            normalizeDisplayList(clinicalData.red_flags).map((flag) => (
                              <span
                                key={flag}
                                className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700"
                              >
                                {flag}
                              </span>
                            ))
                          ) : (
                            <span className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700">
                              No AI red flags available yet
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="rounded-3xl border border-slate-200 bg-white p-5">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                          {uiCopy.transcript}
                        </p>
                        <p className="mt-3 text-sm leading-7 text-slate-700">
                          {transcript ||
                            "The processed consultation transcript will appear here."}
                        </p>
                      </div>
                    </div>
                  </details>

                  <div className="mt-4 rounded-3xl border border-slate-200 bg-white p-5 print:hidden">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                      {uiCopy.doctorSuggestions}
                    </p>
                    <textarea
                      value={doctorSuggestion}
                      onChange={(event) => setDoctorSuggestion(event.target.value)}
                      placeholder={uiCopy.doctorSuggestionsPlaceholder}
                      className="mt-4 min-h-[110px] w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-7 text-slate-800 outline-none transition-all focus:border-teal-400 focus:ring-4 focus:ring-teal-100"
                    />
                  </div>

                  <div className="mt-6 flex flex-wrap gap-3 print:hidden">
                    <button
                      type="button"
                      onClick={processConsultation}
                      disabled={isProcessing}
                      className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-6 py-3.5 text-sm font-semibold text-white shadow-lg disabled:cursor-not-allowed disabled:bg-slate-300"
                    >
                      {isProcessing ? "Processing..." : uiCopy.processConsultation}
                    </button>
                    <button
                      type="button"
                      onClick={saveConsultation}
                      disabled={isSaving || isProcessing}
                      className="inline-flex items-center justify-center rounded-2xl bg-teal-600 px-6 py-3.5 text-sm font-semibold text-white shadow-lg disabled:cursor-not-allowed disabled:bg-teal-300"
                    >
                      {isSaving ? "Saving..." : uiCopy.approveAndSave}
                    </button>
                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 py-3.5 text-sm font-semibold text-slate-700 shadow-sm"
                    >
                      {uiCopy.exportPdf}
                    </button>
                  </div>
                </div>
              </section>
            </div>

            <aside
              className={`fixed right-0 top-0 z-50 h-screen w-[390px] transform border-l border-slate-200 bg-white shadow-[-20px_0_60px_-36px_rgba(15,23,42,0.35)] transition-transform duration-300 print:hidden ${
                inboxOpen ? "translate-x-0" : "translate-x-[336px]"
              }`}
            >
              <div className="flex h-full flex-col">
                <div className="flex items-center justify-between border-b border-slate-200 px-5 py-5">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
                      Inbox
                    </p>
                    <h2 className="mt-1 text-xl font-semibold text-slate-950">
                      Escalations
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setInboxOpen((current) => !current);
                      setUnreadEscalationCount(0);
                    }}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-2 text-slate-600"
                  >
                    {inboxOpen ? <X className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
                  </button>
                </div>

                <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
                  {labReports.length ? (
                    <div className="space-y-4">
                      {labReports.map((report) => {
                        let analysis: Record<string, string> = {};
                        try {
                          analysis = JSON.parse(report.ai_analysis || "{}") as Record<string, string>;
                        } catch (parseError) {
                          console.error(parseError);
                        }

                        return (
                          <div
                            key={`lab-${report.id}`}
                            className="rounded-[26px] border border-sky-200 bg-sky-50/60 p-4"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                                  {report.timestamp}
                                </p>
                                <p className="mt-2 text-sm font-semibold text-slate-900">
                                  {report.patient_name || "Patient"} • {report.mobile_number || "Unknown mobile"}
                                </p>
                                <p className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-sky-700">
                                  Lab report routed to {report.doctor_name || "Doctor"}
                                </p>
                              </div>
                              <a
                                href={report.file_base64}
                                target="_blank"
                                rel="noreferrer"
                                className="rounded-2xl border border-sky-200 bg-white px-3 py-2 text-xs font-semibold text-sky-700 shadow-sm"
                              >
                                View Raw File
                              </a>
                            </div>

                            <div className="mt-3 space-y-3">
                              <div className="rounded-2xl border border-slate-200 bg-white p-3">
                                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                                  Purpose
                                </p>
                                <p className="mt-2 text-sm leading-6 text-slate-700">
                                  {analysis.purpose_of_test || "No purpose summary available."}
                                </p>
                              </div>
                              <div className="rounded-2xl border border-slate-200 bg-white p-3">
                                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                                  Findings
                                </p>
                                <p className="mt-2 text-sm leading-6 text-slate-700">
                                  {analysis.what_the_report_says || "No findings summary available."}
                                </p>
                              </div>
                              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3">
                                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">
                                  Abnormal Results
                                </p>
                                <p className="mt-2 text-sm leading-6 text-amber-900">
                                  {analysis.concerns_and_abnormals || "No abnormal result summary available."}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : null}

                  {inboxMessages.length ? (
                    inboxMessages.map((message) => (
                      <div
                        key={message.id}
                        className="rounded-[26px] border border-slate-200 bg-slate-50 p-4"
                      >
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                          {message.timestamp}
                        </p>
                        <p className="mt-2 text-sm font-semibold text-slate-900">
                          {message.patient_name || "Patient"} • {message.mobile_number || "Unknown mobile"}
                        </p>
                        <p className="mt-2 text-sm leading-6 text-slate-600">
                          {message.message}
                        </p>
                        <details className="group mt-3 rounded-2xl border border-teal-200 bg-teal-50 p-3">
                          <summary className="cursor-pointer text-sm font-semibold text-indigo-600">
                            🤖 Click to view AI analysis
                          </summary>
                          <div className="mt-3 rounded-2xl border border-teal-100 bg-white/80 p-3">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">
                              AI Advice
                            </p>
                            <p className="mt-2 text-sm leading-6 text-teal-900">
                              {message.clinical_advice}
                            </p>
                          </div>
                        </details>
                        <textarea
                          value={inboxReplies[message.id] ?? ""}
                          onChange={(event) =>
                            setInboxReplies((current) => ({
                              ...current,
                              [message.id]: event.target.value,
                            }))
                          }
                          className="mt-3 min-h-[110px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-800 outline-none transition-all focus:border-teal-400 focus:ring-4 focus:ring-teal-100"
                        />
                        <button
                          type="button"
                          onClick={() => sendDoctorReply(message.id)}
                          disabled={sendingReplyId === message.id}
                          className="mt-3 inline-flex w-full items-center justify-center rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
                        >
                          {sendingReplyId === message.id ? "Sending..." : "Reply & Close"}
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                      No live escalations right now.
                    </div>
                  )}
                </div>
              </div>
            </aside>
          </div>
        </div>
      )}
    </main>
  );
}

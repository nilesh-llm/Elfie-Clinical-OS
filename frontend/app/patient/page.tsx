"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  FlaskConical,
  FileImage,
  LockKeyhole,
  LogIn,
  LogOut,
  Send,
  ShieldCheck,
  Sparkles,
  Smartphone,
  UserRound,
} from "lucide-react";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
const PATIENT_SESSION_KEY = "elfie-patient-session";
const LANGUAGE_STORAGE_KEY = "elfie-global-language";

const LANGUAGE_OPTIONS = [
  { code: "EN", label: "English" },
  { code: "FR", label: "Français" },
  { code: "AR", label: "العربية" },
  { code: "VI", label: "Tiếng Việt" },
] as const;

const PATIENT_UI_COPY = {
  EN: {
    talkToDoctor: "Talk to Doctor",
    sendReports: "Send Reports",
    uploadLabReport: "Upload Lab Report",
    sendToDoctor: "Send to Doctor",
    sendReport: "Send Report",
    doctorsOrders: "Doctor's Orders",
    diagnosis: "Diagnosis",
    finalPrescription: "Final Prescription",
    aiHealthGuide: "AI Health Guide",
    checkInAndHistory: "Check-In & History",
    secureChat: "Real-time secure chat with your care team",
  },
  FR: {
    talkToDoctor: "Parler au médecin",
    sendReports: "Envoyer des rapports",
    uploadLabReport: "Téléverser un rapport",
    sendToDoctor: "Envoyer au médecin",
    sendReport: "Envoyer le rapport",
    doctorsOrders: "Ordonnances du médecin",
    diagnosis: "Diagnostic",
    finalPrescription: "Prescription finale",
    aiHealthGuide: "Guide santé IA",
    checkInAndHistory: "Suivi et historique",
    secureChat: "Messagerie sécurisée en temps réel avec votre équipe soignante",
  },
  AR: {
    talkToDoctor: "التحدث مع الطبيب",
    sendReports: "إرسال التقارير",
    uploadLabReport: "رفع تقرير",
    sendToDoctor: "إرسال إلى الطبيب",
    sendReport: "إرسال التقرير",
    doctorsOrders: "تعليمات الطبيب",
    diagnosis: "التشخيص",
    finalPrescription: "الوصفة النهائية",
    aiHealthGuide: "الدليل الصحي بالذكاء الاصطناعي",
    checkInAndHistory: "المتابعة والسجل",
    secureChat: "محادثة آمنة مباشرة مع فريق الرعاية",
  },
  VI: {
    talkToDoctor: "Trao đổi với bác sĩ",
    sendReports: "Gửi báo cáo",
    uploadLabReport: "Tải báo cáo xét nghiệm",
    sendToDoctor: "Gửi cho bác sĩ",
    sendReport: "Gửi báo cáo",
    doctorsOrders: "Chỉ định của bác sĩ",
    diagnosis: "Chẩn đoán",
    finalPrescription: "Đơn thuốc cuối cùng",
    aiHealthGuide: "Hướng dẫn sức khỏe AI",
    checkInAndHistory: "Theo dõi và lịch sử",
    secureChat: "Trò chuyện bảo mật thời gian thực với đội ngũ chăm sóc",
  },
} as const;

type DashboardData = {
  doctor_name: string;
  diagnosis: string;
  final_prescription: string;
  timestamp: string;
  patient_friendly_summary: string;
  doctor_reply?: string;
  day_3_question?: string;
  ai_patient_explanation?: string;
};

type HistoryItem = {
  doctor_name: string;
};

type LabAnalysis = {
  purpose_of_test: string;
  what_the_report_says: string;
  concerns_and_abnormals: string;
  not_a_concern: string;
  patient_friendly_summary: string;
};

type PatientMessageRecord = {
  id: number;
  message: string | null;
  image_base64: string | null;
  doctor_reply: string | null;
  timestamp: string;
};

type ChatMessage = {
  id: string;
  role: "patient" | "doctor";
  text: string;
  timestamp: string;
  image_base64?: string;
};

type ToastItem = {
  id: number;
  title: string;
  description: string;
};

function NotificationStack({ items }: { items: ToastItem[] }) {
  return (
    <div className="pointer-events-none fixed right-4 top-4 z-50 flex w-full max-w-sm flex-col gap-3">
      {items.map((item) => (
        <div
          key={item.id}
          className="pointer-events-auto rounded-[24px] border border-teal-200 bg-white/95 px-4 py-4 shadow-[0_24px_60px_-28px_rgba(13,148,136,0.45)] backdrop-blur toast-slide-in"
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

function mapRecordsToChat(records: PatientMessageRecord[]): ChatMessage[] {
  const messages: ChatMessage[] = [];
  for (const record of records) {
    const patientMessage = (record.message || "").trim();
    const doctorReply = (record.doctor_reply || "").trim();

    if (patientMessage) {
      messages.push({
        id: `patient-${record.id}`,
        role: "patient",
        text: patientMessage,
        timestamp: record.timestamp,
        image_base64: (record.image_base64 || "").trim() || undefined,
      });
    }
    if (doctorReply) {
      messages.push({
        id: `doctor-${record.id}`,
        role: "doctor",
        text: doctorReply,
        timestamp: record.timestamp,
      });
    }
  }
  return messages;
}

export default function PatientPortalPage() {
  const previousDoctorReplyIdsRef = useRef<Set<string>>(new Set());

  const [patientId, setPatientId] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [patientName, setPatientName] = useState("");
  const [language, setLanguage] = useState("EN");
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [pastDoctors, setPastDoctors] = useState<string[]>([]);
  const [activePatientPane, setActivePatientPane] = useState<"doctor" | "reports">(
    "doctor",
  );
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [checkInMessage, setCheckInMessage] = useState("");
  const [checkInImage, setCheckInImage] = useState<File | null>(null);
  const [labFile, setLabFile] = useState<File | null>(null);
  const [labAnalysis, setLabAnalysis] = useState<LabAnalysis | null>(null);
  const [isAnalyzingLab, setIsAnalyzingLab] = useState(false);
  const [isSendingLab, setIsSendingLab] = useState(false);
  const [selectedDoctorForLab, setSelectedDoctorForLab] = useState("");
  const [notificationCount, setNotificationCount] = useState(0);
  const [toastItems, setToastItems] = useState<ToastItem[]>([]);
  const [isRestoringSession, setIsRestoringSession] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const imageLabel = useMemo(() => {
    return checkInImage ? checkInImage.name : "Add an image if a symptom has changed";
  }, [checkInImage]);

  const labFileLabel = useMemo(() => {
    return labFile ? labFile.name : "Upload a PDF or image of your lab report";
  }, [labFile]);

  const addToast = (title: string, description: string) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToastItems((current) => [...current, { id, title, description }]);
    window.setTimeout(() => {
      setToastItems((current) => current.filter((item) => item.id !== id));
    }, 4200);
  };

  const uiCopy =
    PATIENT_UI_COPY[language as keyof typeof PATIENT_UI_COPY] ?? PATIENT_UI_COPY.EN;

  const persistSession = (nextPatientId: string, nextMobileNumber: string) => {
    window.localStorage.setItem(
      PATIENT_SESSION_KEY,
      JSON.stringify({
        patient_id: nextPatientId,
        mobile_number: nextMobileNumber,
      }),
    );
  };

  const clearSession = () => {
    window.localStorage.removeItem(PATIENT_SESSION_KEY);
  };

  const syncPatientState = async (
    nextPatientId: string,
    nextMobileNumber: string,
    options: { silent: boolean; nextPatientName?: string },
  ) => {
    const [dashboardResponse, messagesResponse, historyResponse] = await Promise.all([
      fetch(`${API_BASE_URL}/api/patient/${nextPatientId}/dashboard`),
      fetch(`${API_BASE_URL}/api/patient/${nextPatientId}/messages`),
      fetch(`${API_BASE_URL}/api/history/${nextPatientId}`),
    ]);

    if (!dashboardResponse.ok) {
      const errorPayload = (await dashboardResponse.json().catch(() => null)) as
        | { detail?: string }
        | null;
      throw new Error(errorPayload?.detail ?? "Unable to load your dashboard.");
    }
    if (!messagesResponse.ok) {
      const errorPayload = (await messagesResponse.json().catch(() => null)) as
        | { detail?: string }
        | null;
      throw new Error(errorPayload?.detail ?? "Unable to sync your messages.");
    }
    if (!historyResponse.ok) {
      const errorPayload = (await historyResponse.json().catch(() => null)) as
        | { detail?: string }
        | null;
      throw new Error(errorPayload?.detail ?? "Unable to load your history.");
    }

    const nextDashboard = (await dashboardResponse.json()) as DashboardData;
    const records = (await messagesResponse.json()) as PatientMessageRecord[];
    const historyRecords = (await historyResponse.json()) as HistoryItem[];
    const safeDashboard: DashboardData = {
      doctor_name: nextDashboard?.doctor_name || "",
      diagnosis: nextDashboard?.diagnosis || "",
      final_prescription: nextDashboard?.final_prescription || "",
      timestamp: nextDashboard?.timestamp || "",
      patient_friendly_summary: nextDashboard?.patient_friendly_summary || "",
      doctor_reply: nextDashboard?.doctor_reply || "",
      day_3_question: nextDashboard?.day_3_question || "",
      ai_patient_explanation: nextDashboard?.ai_patient_explanation || "",
    };
    const nextChatMessages = mapRecordsToChat(Array.isArray(records) ? records : []);
    const nextDoctorReplyIds = new Set(
      nextChatMessages.filter((message) => message.role === "doctor").map((message) => message.id),
    );
    const trueNewDoctorReplies = nextChatMessages.filter(
      (message) =>
        message.role === "doctor" &&
        !previousDoctorReplyIdsRef.current.has(message.id),
    );

    if (options.silent && previousDoctorReplyIdsRef.current.size > 0 && trueNewDoctorReplies.length) {
      setNotificationCount((current) => current + trueNewDoctorReplies.length);
      addToast("New Message from Doctor", trueNewDoctorReplies[0].text);
    }

    previousDoctorReplyIdsRef.current = nextDoctorReplyIds;
    setPatientId(nextPatientId);
    setMobileNumber(nextMobileNumber);
    setPatientName(options.nextPatientName ?? patientName);
    setDashboard(safeDashboard);
    const nextPastDoctors = Array.from(
      new Set(
        (Array.isArray(historyRecords) ? historyRecords : [])
          .map((item) => (item?.doctor_name || "").trim())
          .filter(Boolean),
      ),
    );
    setPastDoctors(nextPastDoctors);
    setSelectedDoctorForLab((current) =>
      current && nextPastDoctors.includes(current)
        ? current
        : nextPastDoctors[0] || "",
    );
    setChatMessages(nextChatMessages);
    setIsLoggedIn(true);
  };

  useEffect(() => {
    const storedLanguage = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (storedLanguage && LANGUAGE_OPTIONS.some((option) => option.code === storedLanguage)) {
      setLanguage(storedLanguage);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  }, [language]);

  const performLogin = async (
    nextPatientId: string,
    nextMobileNumber: string,
    options?: { restore?: boolean },
  ) => {
    setIsLoggingIn(true);
    setError("");
    try {
      const loginResponse = await fetch(`${API_BASE_URL}/api/patient/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patient_id: nextPatientId.trim(),
          mobile_number: nextMobileNumber.trim(),
        }),
      });
      if (!loginResponse.ok) {
        const errorPayload = (await loginResponse.json().catch(() => null)) as
          | { detail?: string }
          | null;
        throw new Error(errorPayload?.detail ?? "Secure login failed.");
      }
      const loginData = (await loginResponse.json()) as { name?: string };
      await syncPatientState(nextPatientId.trim(), nextMobileNumber.trim(), {
        silent: false,
        nextPatientName: loginData.name,
      });
      persistSession(nextPatientId.trim(), nextMobileNumber.trim());

      if (options?.restore) {
        addToast("Session Restored", "Your care plan and messages are ready.");
      }
    } catch (loginError) {
      clearSession();
      setError(loginError instanceof Error ? loginError.message : "Unable to log in.");
    } finally {
      setIsLoggingIn(false);
      setIsRestoringSession(false);
    }
  };

  useEffect(() => {
    const storedSession = window.localStorage.getItem(PATIENT_SESSION_KEY);
    if (!storedSession) {
      setIsRestoringSession(false);
      return;
    }
    try {
      const parsed = JSON.parse(storedSession) as {
        patient_id?: string;
        mobile_number?: string;
      };
      if (parsed.patient_id && parsed.mobile_number) {
        void performLogin(parsed.patient_id, parsed.mobile_number, { restore: true });
        return;
      }
    } catch (sessionError) {
      console.error(sessionError);
    }
    clearSession();
    setIsRestoringSession(false);
  }, []);

  useEffect(() => {
    if (!isLoggedIn || !patientId.trim() || !mobileNumber.trim()) return;

    let isMounted = true;
    const intervalId = window.setInterval(async () => {
      if (!isMounted) return;
      try {
        await syncPatientState(patientId.trim(), mobileNumber.trim(), {
          silent: true,
          nextPatientName: patientName,
        });
      } catch (pollError) {
        console.error(pollError);
      }
    }, 3000);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, [isLoggedIn, patientId, mobileNumber, patientName]);

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!patientId.trim() || !mobileNumber.trim()) {
      setError("Please enter your Patient ID and Mobile Number.");
      return;
    }
    await performLogin(patientId, mobileNumber);
  };

  const handleLogout = () => {
    clearSession();
    previousDoctorReplyIdsRef.current = new Set();
    setIsLoggedIn(false);
    setPatientId("");
    setMobileNumber("");
    setPatientName("");
    setDashboard(null);
    setChatMessages([]);
    setNotificationCount(0);
    setCheckInMessage("");
    setCheckInImage(null);
    setLabFile(null);
    setLabAnalysis(null);
    setPastDoctors([]);
    setSelectedDoctorForLab("");
    setError("");
  };

  const handleImageSelection = (file: File | null) => {
    if (!file) {
      setCheckInImage(null);
      return;
    }
    if (!file.type.startsWith("image/")) {
      setError("Please upload a valid image file.");
      return;
    }
    setError("");
    setCheckInImage(file);
  };

  const sendCheckIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!checkInMessage.trim()) {
      setError("Please describe how you are feeling before sending.");
      return;
    }

    setIsSubmitting(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("patient_id", patientId.trim());
      formData.append("message", checkInMessage.trim());
      if (checkInImage) {
        formData.append("image", checkInImage, checkInImage.name);
      }
      const response = await fetch(`${API_BASE_URL}/api/patient/check-in`, {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        const errorPayload = (await response.json().catch(() => null)) as
          | { detail?: string }
          | null;
        throw new Error(errorPayload?.detail ?? "Unable to send your update.");
      }
      setCheckInMessage("");
      setCheckInImage(null);
      addToast("Update Sent", "Your message was securely delivered.");
      await syncPatientState(patientId.trim(), mobileNumber.trim(), {
        silent: false,
        nextPatientName: patientName,
      });
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Unable to send your update.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLabSelection = async (file: File | null) => {
    if (!file) {
      setLabFile(null);
      setLabAnalysis(null);
      return;
    }

    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    const isImage = file.type.startsWith("image/");
    if (!isPdf && !isImage) {
      setError("Please upload a PDF or image lab report.");
      return;
    }

    setLabFile(file);
    setLabAnalysis(null);
    setIsAnalyzingLab(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", file, file.name);
      formData.append("language", language);

      const response = await fetch(`${API_BASE_URL}/api/patient/analyze-lab`, {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        const errorPayload = (await response.json().catch(() => null)) as
          | { detail?: string }
          | null;
        throw new Error(errorPayload?.detail ?? "Unable to analyze the lab report.");
      }

      const payload = (await response.json()) as { analysis?: LabAnalysis };
      setLabAnalysis(payload.analysis ?? null);
      addToast("Lab Analysis Ready", "Your report was analyzed securely.");
    } catch (analysisError) {
      setError(
        analysisError instanceof Error
          ? analysisError.message
          : "Unable to analyze the lab report.",
      );
    } finally {
      setIsAnalyzingLab(false);
    }
  };

  const sendLabReport = async () => {
    if (!patientId.trim()) {
      setError("Please log in before sending a lab report.");
      return;
    }
    if (!labFile || !labAnalysis) {
      setError("Analyze a lab report before sending it to a doctor.");
      return;
    }
    if (!selectedDoctorForLab.trim()) {
      setError("Select a doctor before sending the lab report.");
      return;
    }

    setIsSendingLab(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("patient_id", patientId.trim());
      formData.append("doctor_name", selectedDoctorForLab.trim());
      formData.append("language", language);
      formData.append("ai_analysis", JSON.stringify(labAnalysis));
      formData.append("file", labFile, labFile.name);

      const response = await fetch(`${API_BASE_URL}/api/patient/send-lab`, {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        const errorPayload = (await response.json().catch(() => null)) as
          | { detail?: string }
          | null;
        throw new Error(errorPayload?.detail ?? "Unable to send the lab report.");
      }

      addToast(
        "✅ Report Sent",
        `Report and AI Analysis sent to Dr. ${selectedDoctorForLab} securely.`,
      );
    } catch (sendError) {
      setError(
        sendError instanceof Error ? sendError.message : "Unable to send the lab report.",
      );
    } finally {
      setIsSendingLab(false);
    }
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-[linear-gradient(180deg,#f8fafc_0%,#effaf8_60%,#f8fafc_100%)] px-4 py-8 text-slate-900">
      <NotificationStack items={toastItems} />
      <div className="mx-auto w-full max-w-[420px]">
        <div className="overflow-hidden rounded-[36px] border border-white/80 bg-white/90 shadow-[0_40px_120px_-40px_rgba(15,23,42,0.35)] backdrop-blur-xl">
          <header className="border-b border-slate-200 bg-[linear-gradient(135deg,rgba(255,255,255,0.94),rgba(240,253,250,0.9))] px-5 pb-5 pt-8">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-teal-50 p-2.5 text-teal-700 shadow-sm">
                  <Smartphone className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-teal-700">
                    Elfie Care
                  </p>
                  <h1 className="mt-1 text-lg font-semibold text-slate-950">
                    {isLoggedIn
                      ? `Treated by ${dashboard?.doctor_name || "your doctor"}`
                      : "Secure Patient Login"}
                  </h1>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={language}
                  onChange={(event) => setLanguage(event.target.value)}
                  className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-sm outline-none"
                >
                  {LANGUAGE_OPTIONS.map((option) => (
                    <option key={option.code} value={option.code}>
                      {option.code}
                    </option>
                  ))}
                </select>
                {isLoggedIn ? (
                  <>
                  <button
                    type="button"
                    onClick={() => setNotificationCount(0)}
                    className="relative flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm"
                  >
                    <Bell className="h-5 w-5" />
                    {notificationCount > 0 ? (
                      <span className="absolute -right-1 -top-1 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white">
                        {notificationCount}
                      </span>
                    ) : null}
                  </button>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm"
                  >
                    <LogOut className="h-4 w-4" />
                  </button>
                  </>
                ) : null}
              </div>
            </div>
          </header>

          <section className="space-y-5 px-5 py-5">
            {error ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
                {error}
              </div>
            ) : null}

            {!isLoggedIn ? (
              <>
                <div className="rounded-[28px] border border-teal-100 bg-gradient-to-br from-teal-50 via-white to-slate-50 p-5 shadow-[0_20px_55px_-32px_rgba(13,148,136,0.32)]">
                  <p className="text-sm leading-7 text-slate-600">
                    Sign in with the credentials provided by your clinic to review your
                    treatment plan, understand the doctor’s decisions, and send secure updates.
                  </p>
                  {isRestoringSession ? (
                    <p className="mt-3 text-xs font-semibold uppercase tracking-[0.2em] text-teal-700">
                      Restoring session...
                    </p>
                  ) : null}
                </div>

                <form onSubmit={handleLogin} className="space-y-4">
                  <label className="block">
                    <span className="text-sm font-medium text-slate-600">Patient ID</span>
                    <div className="mt-2 flex items-center rounded-2xl border border-slate-200 bg-white px-4 shadow-sm">
                      <UserRound className="h-4 w-4 text-slate-400" />
                      <input
                        value={patientId}
                        onChange={(event) => setPatientId(event.target.value)}
                        placeholder="Enter your Patient ID"
                        className="h-12 w-full bg-transparent px-3 text-sm text-slate-800 outline-none"
                      />
                    </div>
                  </label>

                  <label className="block">
                    <span className="text-sm font-medium text-slate-600">Mobile Number</span>
                    <div className="mt-2 flex items-center rounded-2xl border border-slate-200 bg-white px-4 shadow-sm">
                      <LockKeyhole className="h-4 w-4 text-slate-400" />
                      <input
                        value={mobileNumber}
                        onChange={(event) => setMobileNumber(event.target.value)}
                        placeholder="Enter your mobile number"
                        className="h-12 w-full bg-transparent px-3 text-sm text-slate-800 outline-none"
                      />
                    </div>
                  </label>

                  <button
                    type="submit"
                    disabled={isLoggingIn}
                    className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 text-sm font-semibold text-white shadow-lg disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    <LogIn className="h-4 w-4" />
                    {isLoggingIn ? "Signing In..." : "Secure Login"}
                  </button>
                </form>
              </>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3 rounded-[24px] border border-slate-200 bg-white p-2 shadow-sm">
                  <button
                    type="button"
                    onClick={() => setActivePatientPane("doctor")}
                    className={`rounded-[18px] px-4 py-3 text-sm font-semibold transition ${
                      activePatientPane === "doctor"
                        ? "bg-slate-900 text-white shadow-sm"
                        : "text-slate-600"
                    }`}
                  >
                    {uiCopy.talkToDoctor}
                  </button>
                  <button
                    type="button"
                    onClick={() => setActivePatientPane("reports")}
                    className={`rounded-[18px] px-4 py-3 text-sm font-semibold transition ${
                      activePatientPane === "reports"
                        ? "bg-slate-900 text-white shadow-sm"
                        : "text-slate-600"
                    }`}
                  >
                    {uiCopy.sendReports}
                  </button>
                </div>

                <div className="rounded-[30px] border border-teal-200 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(240,253,250,0.92))] p-5 shadow-[0_24px_70px_-34px_rgba(13,148,136,0.3)]">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
                    {uiCopy.doctorsOrders}
                  </p>
                  <div className="mt-4 space-y-4">
                    <div className="rounded-2xl border border-teal-200 bg-white p-4 shadow-sm">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                        {uiCopy.diagnosis}
                      </p>
                      <p className="mt-2 text-base font-semibold text-slate-950">
                        {dashboard?.diagnosis || "Awaiting diagnosis"}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-teal-200 bg-white p-4 shadow-sm">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                        {uiCopy.finalPrescription}
                      </p>
                      <p className="mt-2 text-sm leading-7 text-slate-700">
                        {dashboard?.final_prescription || "Awaiting prescription"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-[30px] border border-teal-200 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(240,253,250,0.92),rgba(240,249,255,0.92))] p-[1px] shadow-[0_24px_70px_-36px_rgba(13,148,136,0.45)]">
                  <div className="rounded-[28px] bg-white px-5 py-5">
                    <div className="flex items-center gap-3">
                      <div className="rounded-2xl bg-teal-50 p-2.5 text-teal-700">
                        <Sparkles className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-teal-700">
                          {uiCopy.aiHealthGuide}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          Why your doctor chose this diagnosis and treatment
                        </p>
                      </div>
                    </div>
                    <details className="group mt-4 rounded-lg border border-teal-100 bg-slate-50 p-4">
                      <summary className="cursor-pointer font-semibold flex items-center text-indigo-600">
                        🤖 Click to view AI Health Guide & Explanation
                      </summary>
                      <p className="mt-4 text-sm leading-7 text-slate-700">
                        {dashboard?.ai_patient_explanation ||
                          dashboard?.patient_friendly_summary ||
                          "Your explanation will appear here after the doctor saves the consultation."}
                      </p>
                    </details>
                    {dashboard?.day_3_question ? (
                      <div className="mt-4 rounded-2xl border border-teal-200 bg-teal-50 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-700">
                          Day-3 Check-In Prompt
                        </p>
                        <p className="mt-2 text-sm leading-6 text-teal-900">
                          {dashboard.day_3_question}
                        </p>
                      </div>
                    ) : null}
                  </div>
                </div>

                {activePatientPane === "reports" ? (
                <div className="rounded-[30px] border border-sky-200 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(239,246,255,0.95),rgba(240,253,250,0.92))] p-5 shadow-[0_24px_70px_-36px_rgba(14,165,233,0.3)]">
                  <div className="flex items-center gap-3">
                    <div className="rounded-2xl bg-sky-50 p-2.5 text-sky-700">
                      <FlaskConical className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-700">
                        {uiCopy.uploadLabReport}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        Share a PDF or image for an instant multilingual explanation
                      </p>
                    </div>
                  </div>

                  <label className="mt-5 flex cursor-pointer items-center justify-between rounded-2xl border border-dashed border-sky-200 bg-white px-4 py-4 shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="rounded-2xl bg-sky-50 p-2.5 text-sky-700">
                        <FileImage className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-800">{labFileLabel}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          PDF, scan, or photo of a medical report
                        </p>
                      </div>
                    </div>
                    <input
                      type="file"
                      accept="application/pdf,image/*"
                      className="hidden"
                      onChange={(event: ChangeEvent<HTMLInputElement>) =>
                        void handleLabSelection(event.target.files?.[0] ?? null)
                      }
                    />
                  </label>

                  {isAnalyzingLab ? (
                    <div className="mt-4 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-medium text-sky-800">
                      Analyzing your report securely...
                    </div>
                  ) : null}

                  {labAnalysis ? (
                    <div className="mt-5 space-y-3">
                      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                          Purpose
                        </p>
                        <p className="mt-2 text-sm leading-7 text-slate-700">
                          {labAnalysis.purpose_of_test}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                          Findings
                        </p>
                        <p className="mt-2 text-sm leading-7 text-slate-700">
                          {labAnalysis.what_the_report_says}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">
                          Concerns
                        </p>
                        <p className="mt-2 text-sm leading-7 text-amber-900">
                          {labAnalysis.concerns_and_abnormals}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
                          No Concerns
                        </p>
                        <p className="mt-2 text-sm leading-7 text-emerald-900">
                          {labAnalysis.not_a_concern}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 shadow-sm">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-700">
                          Patient-Friendly Summary
                        </p>
                        <p className="mt-2 text-sm leading-7 text-sky-900">
                          {labAnalysis.patient_friendly_summary}
                        </p>
                      </div>

                      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                        <label className="block">
                          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                            {uiCopy.sendToDoctor}
                          </span>
                          <select
                            value={selectedDoctorForLab}
                            onChange={(event) => setSelectedDoctorForLab(event.target.value)}
                            className="mt-3 h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-800 outline-none"
                          >
                            <option value="">Select doctor</option>
                            {pastDoctors.map((doctor) => (
                              <option key={doctor} value={doctor}>
                                {doctor}
                              </option>
                            ))}
                          </select>
                        </label>
                        <button
                          type="button"
                          onClick={sendLabReport}
                          disabled={isSendingLab || !pastDoctors.length}
                          className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 text-sm font-semibold text-white shadow-lg disabled:cursor-not-allowed disabled:bg-slate-300"
                        >
                          <Send className="h-4 w-4" />
                          {isSendingLab ? "Sending..." : uiCopy.sendReport}
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
                ) : null}

                {activePatientPane === "doctor" ? (
                <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_50px_-32px_rgba(15,23,42,0.24)]">
                  <div className="flex items-center gap-3">
                    <div className="rounded-2xl bg-slate-50 p-2.5 text-slate-700">
                      <ShieldCheck className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
                        {uiCopy.checkInAndHistory}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        {uiCopy.secureChat}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 space-y-3">
                    {chatMessages.length ? (
                      chatMessages.map((message) => (
                        <div
                          key={message.id}
                          className={`rounded-[24px] px-4 py-3 ${
                            message.role === "doctor"
                              ? "mr-6 border border-teal-200 bg-teal-50"
                              : "ml-6 border border-slate-200 bg-slate-50"
                          }`}
                        >
                          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                            {message.role === "doctor" ? "Doctor" : "You"} • {message.timestamp}
                          </p>
                          <p className="mt-2 text-sm leading-6 text-slate-700">
                            {message.text}
                          </p>
                          {message.image_base64 ? (
                            <img
                              src={message.image_base64}
                              alt="Patient upload"
                              className="mt-3 h-36 w-full rounded-2xl object-cover"
                            />
                          ) : null}
                        </div>
                      ))
                    ) : (
                      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                        Your secure conversation history will appear here.
                      </div>
                    )}
                  </div>

                  <form onSubmit={sendCheckIn} className="mt-5 space-y-4">
                    <textarea
                      value={checkInMessage}
                      onChange={(event) => setCheckInMessage(event.target.value)}
                      placeholder={
                        dashboard?.day_3_question ||
                        "Tell your doctor how you are feeling today..."
                      }
                      className="min-h-[120px] w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-800 outline-none transition-all focus:border-teal-400 focus:ring-4 focus:ring-teal-100"
                    />
                    <label className="flex cursor-pointer items-center justify-between rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="rounded-2xl bg-white p-2.5 text-slate-600 shadow-sm">
                          <FileImage className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-800">{imageLabel}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            Optional photo for visible symptoms
                          </p>
                        </div>
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(event: ChangeEvent<HTMLInputElement>) =>
                          handleImageSelection(event.target.files?.[0] ?? null)
                        }
                      />
                    </label>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="inline-flex h-12 w-full items-center justify-center rounded-2xl bg-slate-900 text-sm font-semibold text-white shadow-lg disabled:cursor-not-allowed disabled:bg-slate-300"
                    >
                      {isSubmitting ? "Sending..." : "Send Update to Doctor"}
                    </button>
                  </form>
                </div>
                ) : null}
              </>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

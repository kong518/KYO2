/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Users,
  CheckCircle2,
  Clock,
  LayoutDashboard,
  FileText,
  Search,
  Eye,
  Trash2,
  RefreshCw,
  ChevronRight,
  UserCheck,
  Calendar,
  Layers,
  FileSpreadsheet,
  X,
  Sparkles,
  ClipboardCheck,
  Award,
  Lock,
  LogOut,
  Settings,
  Printer,
  Download,
  Smartphone,
  Monitor,
  Check,
  Share2,
  ExternalLink,
  Laptop,
  AlertCircle,
  Loader2,
  Key,
  Ban,
  Shield,
  BookOpen
} from "lucide-react";
import AssistantForm from "./components/AssistantForm";
import ApiKeyModal from "./components/ApiKeyModal";
import BatchAiVerificationModal from "./components/BatchAiVerificationModal";
import UserManagementView from "./components/UserManagementView";
import { analyzeCertificateWithGemini } from "./services/aiVerification";
import { EducationCertificate, EducationStats } from "./types";

const isPdfFile = (imgUrl: string | undefined | null) => {
  if (!imgUrl) return false;
  return imgUrl.startsWith("data:application/pdf") || imgUrl.includes(".pdf");
};

import { db, getStoredGeminiApiKey, saveStoredGeminiApiKey, auth, googleProvider } from "./firebase";
import { 
  collection, 
  query, 
  orderBy, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc,
  setDoc,
  where
} from "firebase/firestore";
import { signInWithPopup, signOut } from "firebase/auth";

// Google GenAI Platform


export default function App() {
  const [userMode, setUserMode] = useState<"assistant" | "admin">("assistant");
  const [submissions, setSubmissions] = useState<EducationCertificate[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Authentication status
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState<boolean>(() => {
    return sessionStorage.getItem("isAdminLoggedIn") === "true";
  });
  const [currentAdminName, setCurrentAdminName] = useState<string>(() => {
    return sessionStorage.getItem("adminUserName") || "admin";
  });
  const [adminName, setAdminName] = useState<string>("");
  const [adminPasscode, setAdminPasscode] = useState<string>("");
  const [adminApiKeyInput, setAdminApiKeyInput] = useState<string>("");
  const [geminiApiKey, setGeminiApiKey] = useState<string>(() => {
    return localStorage.getItem("USER_GEMINI_API_KEY") || "";
  });
  const [showApiKeyModal, setShowApiKeyModal] = useState<boolean>(false);
  const [isApiKeyMandatory, setIsApiKeyMandatory] = useState<boolean>(false);
  const [showBatchAiModal, setShowBatchAiModal] = useState<boolean>(false);
  const [isRegistering, setIsRegistering] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState<boolean>(false);

  // Administrative Control States
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null);
  const [adminViewMode, setAdminViewMode] = useState<"inspector" | "list" | "gallery" | "users">("inspector");
  const [printTarget, setPrintTarget] = useState<"ledger" | "photos">("ledger");
  
  // Verification form states for current selection
  const [courseName, setCourseName] = useState<string>("");
  const [trainingHours, setTrainingHours] = useState<string>("");
  const [managerNotes, setManagerNotes] = useState<string>("");
  const [subFilter, setSubFilter] = useState<"all" | "pending" | "completed">("all");
  
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  // AI OCR States
  const [aiAnalysisLoading, setAiAnalysisLoading] = useState<boolean>(false);
  const [singleAiLoading, setSingleAiLoading] = useState<boolean>(false);
  const [aiFeedback, setAiFeedback] = useState<{ type: "success" | "error" | "mismatch"; message: string } | null>(null);

  // PWA Desktop / Mobile Install States
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState<any>(null);
  const [isAppInstalled, setIsAppInstalled] = useState<boolean>(false);
  const [showInstallModal, setShowInstallModal] = useState<boolean>(false);
  const [installGuideTab, setInstallGuideTab] = useState<"pc" | "android" | "ios">("pc");
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  // Load API Key on mount and prompt if missing in admin mode
  useEffect(() => {
    const initKey = async () => {
      const key = await getStoredGeminiApiKey();
      if (key) {
        setGeminiApiKey(key);
      } else if (isAdminLoggedIn && userMode === "admin") {
        setShowApiKeyModal(true);
        setIsApiKeyMandatory(true);
      }
    };
    initKey();
  }, [isAdminLoggedIn, userMode]);

  useEffect(() => {
    if (isAdminLoggedIn) {
      fetchSubmissions(true);
    }
  }, [isAdminLoggedIn]);

  useEffect(() => {
    const handleBeforeInstall = (e: any) => {
      e.preventDefault();
      setDeferredInstallPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
  }, []);

  const handleCopyLink = () => {
    const url = window.location.origin.includes("ais-dev-")
      ? window.location.origin.replace("ais-dev-", "ais-pre-")
      : window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    });
  };

  const handleAdminAuth = async () => {
    setAuthError(null);
    setAuthSuccess(null);

    const name = adminName.trim();
    const pass = adminPasscode.trim();

    if (!name || !pass) {
      setAuthError("이름(아이디)과 비밀번호를 모두 입력해 주세요.");
      return;
    }

    setIsAuthenticating(true);

    try {
      if (isRegistering) {
        // Registering a new admin account
        if (name.toLowerCase() === "admin") {
          setAuthError("'admin'은 시스템 마스터 관리자 ID로 이미 예약되어 있습니다. 다른 관리자 이름을 사용해 주세요.");
          setIsAuthenticating(false);
          return;
        }

        const q = query(collection(db, "admins"), where("name", "==", name));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          setAuthError("이미 등록되어 있는 관리자 이름입니다. 기존 계정으로 로그인하시거나 다른 이름을 사용해 주세요.");
          setIsAuthenticating(false);
          return;
        }

        await addDoc(collection(db, "admins"), {
          name: name,
          password: pass,
          role: "admin",
          isBanned: false,
          createdAt: new Date().toISOString()
        });

        if (adminApiKeyInput.trim()) {
          localStorage.setItem("USER_GEMINI_API_KEY", adminApiKeyInput.trim());
          setGeminiApiKey(adminApiKeyInput.trim());
        }

        setAuthSuccess(`'${name}' 관리자 계정이 성공적으로 등록되었습니다! 대시보드로 즉시 입장합니다.`);
        sessionStorage.setItem("isAdminLoggedIn", "true");
        sessionStorage.setItem("adminUserName", name);
        setCurrentAdminName(name);

        setTimeout(() => {
          setIsAdminLoggedIn(true);
          setUserMode("admin");
          setIsRegistering(false);
          setIsAuthenticating(false);
          fetchSubmissions(true);
          // Check API Key
          const currentKey = localStorage.getItem("USER_GEMINI_API_KEY") || "";
          if (!currentKey) {
            setShowApiKeyModal(true);
            setIsApiKeyMandatory(true);
          }
        }, 500);
        return;
      }

      // Login Mode
      // 1. Check Master Admin Credential (admin / 1130 or 관리자 / 1130)
      const isMaster = (name.toLowerCase() === "admin" || name === "관리자") && pass === "1130";

      if (isMaster) {
        setAuthSuccess("마스터 관리자(admin) 인증 완료! 대시보드로 이동합니다...");
        sessionStorage.setItem("isAdminLoggedIn", "true");
        sessionStorage.setItem("adminUserName", "admin (마스터)");
        setCurrentAdminName("admin (마스터)");

        // Sync master record to Firestore admins collection in background if not yet present
        try {
          const qMaster = query(collection(db, "admins"), where("name", "==", "admin"));
          const masterSnap = await getDocs(qMaster);
          if (masterSnap.empty) {
            await addDoc(collection(db, "admins"), {
              name: "admin",
              password: "1130",
              role: "master",
              isBanned: false,
              createdAt: new Date().toISOString()
            });
          }
        } catch (e) {
          console.warn("Master admin record sync note:", e);
        }

        setTimeout(() => {
          setIsAdminLoggedIn(true);
          setUserMode("admin");
          setIsAuthenticating(false);
          fetchSubmissions(true);
          // Check API Key
          const currentKey = localStorage.getItem("USER_GEMINI_API_KEY") || "";
          if (!currentKey) {
            setShowApiKeyModal(true);
            setIsApiKeyMandatory(true);
          }
        }, 400);
        return;
      }

      // 2. Check Custom Registered Admins from Firestore
      const q = query(collection(db, "admins"), where("name", "==", name));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        setAuthError(
          "등록되지 않은 관리자 계정입니다. 계정 정보를 확인하시거나, 아래 [계정이 없으신가요? 신규 등록]을 통해 계정을 생성해 주세요."
        );
        setIsAuthenticating(false);
        return;
      }

      const matchedDoc = querySnapshot.docs.find(d => d.data().password === pass);
      if (!matchedDoc) {
        setAuthError("비밀번호가 일치하지 않습니다. 다시 확인해 주세요.");
        setIsAuthenticating(false);
        return;
      }

      // 3. Check if user has been banned by master admin
      const userData = matchedDoc.data();
      if (userData.isBanned) {
        setAuthError("해당 계정은 마스터 관리자에 의해 차단(벤)되었습니다. 관리자에게 문의해 주세요.");
        setIsAuthenticating(false);
        return;
      }

      // Match found!
      setAuthSuccess(`'${name}' 관리자님 환영합니다! 대시보드로 이동합니다.`);
      sessionStorage.setItem("isAdminLoggedIn", "true");
      sessionStorage.setItem("adminUserName", name);
      setCurrentAdminName(name);

      setTimeout(() => {
        setIsAdminLoggedIn(true);
        setUserMode("admin");
        setIsAuthenticating(false);
        fetchSubmissions(true);
        // Check API Key
        const currentKey = localStorage.getItem("USER_GEMINI_API_KEY") || "";
        if (!currentKey) {
          setShowApiKeyModal(true);
          setIsApiKeyMandatory(true);
        }
      }, 400);

    } catch (err: any) {
      console.error("Admin auth error:", err);
      // Fallback: If network error but user entered master admin admin/1130:
      if ((name.toLowerCase() === "admin" || name === "관리자") && pass === "1130") {
        setAuthSuccess("마스터 관리자(admin) 인증 완료! 대시보드로 이동합니다.");
        sessionStorage.setItem("isAdminLoggedIn", "true");
        sessionStorage.setItem("adminUserName", "admin (마스터)");
        setCurrentAdminName("admin (마스터)");
        setTimeout(() => {
          setIsAdminLoggedIn(true);
          setUserMode("admin");
          setIsAuthenticating(false);
          fetchSubmissions(true);
        }, 400);
        return;
      }

      setAuthError("인증 처리 중 문제가 발생했습니다: " + (err.message || "네트워크 상태를 확인해주세요."));
      setIsAuthenticating(false);
    }
  };

  const handleAdminLogout = () => {
    sessionStorage.removeItem("isAdminLoggedIn");
    sessionStorage.removeItem("adminUserName");
    setIsAdminLoggedIn(false);
    setUserMode("assistant");
    setAdminName("");
    setAdminPasscode("");
    setAuthError(null);
    setAuthSuccess(null);
  };

  const handleInstallAppClick = () => {
    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      deferredInstallPrompt.userChoice.then((choiceResult: any) => {
        if (choiceResult.outcome === 'accepted') {
          console.log('User accepted the install prompt');
        }
        setDeferredInstallPrompt(null);
      });
    } else {
      setShowInstallModal(true);
    }
  };

  const fetchSubmissions = async (isLoggedInOverride?: boolean) => {
    const active = isLoggedInOverride !== undefined ? isLoggedInOverride : isAdminLoggedIn;
    if (!active) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const q = query(collection(db, "submissions"), orderBy("submittedAt", "desc"));
      const querySnapshot = await getDocs(q);
      const data: EducationCertificate[] = [];
      querySnapshot.forEach((docSnap) => {
        const item = docSnap.data();
        data.push({
          id: docSnap.id,
          assistantName: item.assistantName || "",
          birthDate: item.birthDate || "",
          certificateImage: item.certificateImage || "",
          submittedAt: item.submittedAt || "",
          isCompleted: item.isCompleted || false,
          trainingHours: item.trainingHours || "",
          courseName: item.courseName || "",
          managerNotes: item.managerNotes || "",
          reviewedAt: item.reviewedAt || "",
        });
      });
      setSubmissions(data);
      if (data.length > 0 && !selectedSubmissionId) {
        // Auto-select first item
        const first = data[0];
        setSelectedSubmissionId(first.id);
        setCourseName(first.courseName || "");
        setTrainingHours(first.trainingHours || "");
        setManagerNotes(first.managerNotes || "");
      }
    } catch (error: any) {
      console.error("Failed to fetch submissions from Firestore:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshList = async () => {
    if (!isAdminLoggedIn) return;
    setRefreshing(true);
    try {
      const q = query(collection(db, "submissions"), orderBy("submittedAt", "desc"));
      const querySnapshot = await getDocs(q);
      const data: EducationCertificate[] = [];
      querySnapshot.forEach((docSnap) => {
        const item = docSnap.data();
        data.push({
          id: docSnap.id,
          assistantName: item.assistantName || "",
          birthDate: item.birthDate || "",
          certificateImage: item.certificateImage || "",
          submittedAt: item.submittedAt || "",
          isCompleted: item.isCompleted || false,
          trainingHours: item.trainingHours || "",
          courseName: item.courseName || "",
          managerNotes: item.managerNotes || "",
          reviewedAt: item.reviewedAt || "",
        });
      });
      setSubmissions(data);
      if (selectedSubmissionId) {
        const current = data.find((item: any) => item.id === selectedSubmissionId);
        if (current) {
          setCourseName(current.courseName || "");
          setTrainingHours(current.trainingHours || "");
          setManagerNotes(current.managerNotes || "");
        }
      }
    } catch (error) {
      console.error("Error refreshing submissions:", error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleNewSubmission = async (newSub: { 
    assistantName: string; 
    birthDate: string; 
    certificateImage: string;
    apiKey?: string;
  }) => {
    try {
      let extractedCourse = "장애인활동지원사 교육";
      let extractedHours = "8시간";
      let extractedInstitution = "";
      let extractedCompletionDate = "";
      let extractedCertNumber = "";
      let extractedSummary = "자동 판독 완료";
      let isAiParsed = false;

      const activeApiKey = newSub.apiKey?.trim() || geminiApiKey || localStorage.getItem("USER_GEMINI_API_KEY") || "";
      
      if (activeApiKey && newSub.certificateImage) {
        try {
          const ocrResult = await analyzeCertificateWithGemini(newSub.certificateImage, activeApiKey);
          if (ocrResult.success) {
            extractedCourse = ocrResult.courseName || extractedCourse;
            extractedHours = ocrResult.trainingHours || extractedHours;
            extractedInstitution = ocrResult.institution || "";
            extractedCompletionDate = ocrResult.completionDate || "";
            extractedCertNumber = ocrResult.certNumber || "";
            extractedSummary = ocrResult.summary || "AI 자동 판독 완료";
            isAiParsed = true;
          }
        } catch (ocrErr) {
          console.warn("Automatic submission OCR analysis note:", ocrErr);
        }
      }

      const submitData = {
        assistantName: newSub.assistantName,
        birthDate: newSub.birthDate,
        certificateImage: newSub.certificateImage,
        submittedAt: new Date().toISOString(),
        isCompleted: false, // Default to pending until manager clicks 교육수강확인
        trainingHours: extractedHours,
        courseName: extractedCourse,
        institution: extractedInstitution,
        completionDate: extractedCompletionDate,
        certNumber: extractedCertNumber,
        managerNotes: isAiParsed ? extractedSummary : "수료증 접수 완료",
        aiVerified: isAiParsed,
      };

      const docSnap = await addDoc(collection(db, "submissions"), submitData);
      const itemWithId: EducationCertificate = {
        id: docSnap.id,
        ...submitData
      };

      // Live state syncing locally to let user feel immediate satisfaction
      setSubmissions((prev) => [itemWithId, ...prev]);
      
      // Auto-focus selected
      setSelectedSubmissionId(docSnap.id);
      setCourseName(extractedCourse);
      setTrainingHours(extractedHours);
      setManagerNotes(submitData.managerNotes);
      
      return { success: true };
    } catch (error: any) {
      console.error("Failed to submit certificate to Firestore:", error);
      return { 
        success: false, 
        error: error.message || "데이터 저장 중 오류가 발생했습니다. 보안 제약을 확인해 주세요." 
      };
    }
  };

  // Handles updating the training metadata and completion state 
  const handleSaveVerification = async (id: string, isCompletedStatus: boolean) => {
    if (!isAdminLoggedIn) {
      alert("로그인이 만료되었거나 승인 권한이 없습니다.");
      return;
    }
    setActionLoading(true);
    try {
      const currentSub = submissions.find((item) => item.id === id);
      const docRef = doc(db, "submissions", id);
      const updateData = {
        isCompleted: isCompletedStatus,
        trainingHours: trainingHours || currentSub?.trainingHours || "",
        courseName: courseName || currentSub?.courseName || "",
        managerNotes,
        reviewedAt: new Date().toISOString(),
      };

      await updateDoc(docRef, updateData);

      setSubmissions((prev) =>
        prev.map((item) => (item.id === id ? { ...item, ...updateData } : item))
      );
      alert(isCompletedStatus ? "교육 이수 확인 처리가 완료되었습니다!" : "수료 정보가 안전하게 임시 저장되었습니다.");
    } catch (error: any) {
      console.error("Verification processing failed:", error);
      alert("처리에 실패하였습니다. 관리 권한이 누락되었습니다: " + (error.message || ""));
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!isAdminLoggedIn) {
      alert("삭제 권한이 없습니다.");
      return;
    }
    if (!confirm("이 제출 이력을 영구 삭제하시겠습니까? 수료증 이미지 등 등록된 정보가 완전히 제거됩니다.")) {
      return;
    }
    try {
      await deleteDoc(doc(db, "submissions", id));
      const remaining = submissions.filter((item) => item.id !== id);
      setSubmissions(remaining);
      if (selectedSubmissionId === id) {
        if (remaining.length > 0) {
          setSelectedSubmissionId(remaining[0].id);
          setCourseName(remaining[0].courseName || "");
          setTrainingHours(remaining[0].trainingHours || "");
          setManagerNotes(remaining[0].managerNotes || "");
        } else {
          setSelectedSubmissionId(null);
          setCourseName("");
          setTrainingHours("");
          setManagerNotes("");
        }
      }
      alert("성공적으로 삭제되었습니다.");
    } catch (error: any) {
      console.error("Delete failed:", error);
      alert("삭제에 실패했습니다: " + (error.message || ""));
    }
  };

  const handleSelectItem = (sub: EducationCertificate) => {
    setSelectedSubmissionId(sub.id);
    setCourseName(sub.courseName || "");
    setTrainingHours(sub.trainingHours || "");
    setManagerNotes(sub.managerNotes || "");
    setAiFeedback(null);
  };

  const handleSingleAiAnalysis = async (sub: EducationCertificate) => {
    if (!geminiApiKey) {
      setShowApiKeyModal(true);
      setIsApiKeyMandatory(true);
      return;
    }
    setSingleAiLoading(true);
    setAiFeedback(null);
    try {
      const res = await analyzeCertificateWithGemini(sub.certificateImage, geminiApiKey);
      if (res.success) {
        const nextCourse = res.courseName || sub.courseName || "장애인활동지원사 교육";
        const nextHours = res.trainingHours || sub.trainingHours || "8시간";
        const nextNotes = res.summary || "AI 판독 완료";

        setCourseName(nextCourse);
        setTrainingHours(nextHours);
        setManagerNotes(nextNotes);

        const docRef = doc(db, "submissions", sub.id);
        const updates = {
          courseName: nextCourse,
          trainingHours: nextHours,
          institution: res.institution || sub.institution || "",
          completionDate: res.completionDate || sub.completionDate || "",
          certNumber: res.certNumber || sub.certNumber || "",
          managerNotes: nextNotes,
          isCompleted: true,
          aiVerified: true,
          reviewedAt: new Date().toISOString(),
        };

        await updateDoc(docRef, updates);
        setSubmissions((prev) =>
          prev.map((item) => (item.id === sub.id ? { ...item, ...updates } : item))
        );

        setAiFeedback({
          type: "success",
          message: `✨ AI 자동 판독 성공: ${nextCourse} (${nextHours})${res.institution ? ` [${res.institution}]` : ""}`,
        });
      } else {
        setAiFeedback({
          type: "error",
          message: res.error || "수료증 AI 판독에 실패했습니다.",
        });
      }
    } catch (err: any) {
      setAiFeedback({
        type: "error",
        message: "AI 판독 중 오류가 발생했습니다: " + err.message,
      });
    } finally {
      setSingleAiLoading(false);
    }
  };

  const getGeminiApiKey = () => {
    return geminiApiKey || localStorage.getItem("USER_GEMINI_API_KEY") || "";
  };

  const handleSaveApiKeySetting = async (key: string) => {
    const trimmedKey = key.trim();
    if (!trimmedKey) return;
    try {
      await saveStoredGeminiApiKey(trimmedKey);
      setGeminiApiKey(trimmedKey);
      setShowApiKeyModal(false);
    } catch (err: any) {
      console.error("API Key save error:", err);
    }
  };

  const handleAiOcrAnalysis = async (imgBase64: string, subName: string, subBirth: string) => {
    if (!imgBase64) {
      setAiFeedback({ type: "error", message: "수료증 원본 이미지가 등록되어 있지 않습니다." });
      return;
    }

    setAiAnalysisLoading(true);
    setAiFeedback(null);
    try {
      let data: any = null;
      let usedServer = false;

      // 1. Try server OCR first
      try {
        const response = await fetch('/api/submissions/ocr', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ imageBase64: imgBase64 }),
        });

        if (response.ok) {
          const textRes = await response.text();
          data = JSON.parse(textRes);
          usedServer = true;
        }
      } catch (err) {
        console.warn("Express backend OCR unavailable or returned error, attempting client-side fallback...", err);
      }

      // 2. Client-side fallback if server failed (e.g., on Vercel)
      if (!usedServer) {
        const key = await getStoredGeminiApiKey();
        if (!key) {
          throw new Error("서버 또는 데이터베이스에 등록된 Gemini API Key가 없습니다. 우측 상단의 [⚙️ API Key 설정] 버튼을 클릭해 등록해주세요.");
        }

        const { GoogleGenAI, Type } = await import('@google/genai');
        
        // Clean up base64
        let rawBase64 = imgBase64;
        let mimeType = 'image/png';
        if (imgBase64.includes(";base64,")) {
          const parts = imgBase64.split(";base64,");
          rawBase64 = parts[1];
          mimeType = parts[0].replace("data:", "").split(";")[0];
        }

        const ai = new GoogleGenAI({ apiKey: key });
        const modelsToTry = ["gemini-3.5-flash", "gemini-flash-latest", "gemini-3.1-flash-lite"];
        let response: any = null;
        let lastError: any = null;

        for (const currentModel of modelsToTry) {
          let attempt = 0;
          const maxRetries = 3;
          const initialDelay = 1000;

          console.log(`[Admin Gemini OCR] Trying direct analysis using model: ${currentModel}`);
          
          while (attempt < maxRetries) {
            try {
              response = await ai.models.generateContent({
                model: currentModel,
                contents: [
                  {
                    inlineData: {
                      data: rawBase64,
                      mimeType,
                    }
                  },
                  `Please analyze this uploaded training certificate. 
Extract the following details from this image/PDF:
1. Name (성명/이름)
2. Date of Birth (생년월일 - 6자리 예시: 740125)
3. Course Name (교육명칭/수강과정명)
4. Training Hours (교육이수시간)

Return the parsed values in Korean language inside the requested JSON schema.`
                ],
                config: {
                  responseMimeType: "application/json",
                  responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                      assistantName: { type: Type.STRING },
                      birthDate: { type: Type.STRING },
                      courseName: { type: Type.STRING },
                      trainingHours: { type: Type.STRING }
                    },
                    required: ["assistantName", "birthDate", "courseName", "trainingHours"]
                  }
                }
              });
              break; // Succeeded! Break retry loop
            } catch (error: any) {
              attempt++;
              lastError = error;
              const errMsg = error.message || "";
              console.warn(`[Admin Gemini OCR] Model ${currentModel} Attempt ${attempt}/${maxRetries} failed:`, errMsg);

              const isRetryable = 
                error.status === "UNAVAILABLE" || 
                error.code === 503 ||
                error.status === "RESOURCE_EXHAUSTED" || 
                error.code === 429 ||
                errMsg.includes("503") || 
                errMsg.includes("UNAVAILABLE") || 
                errMsg.includes("high demand") ||
                errMsg.includes("429") ||
                errMsg.includes("RESOURCE_EXHAUSTED") ||
                errMsg.includes("rate limit") ||
                errMsg.includes("overloaded");

              if (isRetryable && attempt < maxRetries) {
                const delay = initialDelay * Math.pow(2, attempt - 1) * (0.8 + Math.random() * 0.4);
                console.log(`[Admin Gemini OCR] Retrying in ${Math.round(delay)}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
              } else {
                break; // Non-retryable error or exhausted retries for this model
              }
            }
          }

          if (response && response.text) {
            break; // Successfully got response, stop trying other models
          }
        }

        if (!response || !response.text) {
          throw lastError || new Error("수행된 직접분석의 응답 본문이 비어있거나 분석에 실패했습니다 (시도된 모든 모델 실패).");
        }
        data = JSON.parse(response.text.trim());
      }

      const extractedCourse = data.courseName || "";
      const extractedHours = data.trainingHours || "";
      const extractedName = data.assistantName || "";
      const extractedBirth = data.birthDate || "";

      setCourseName(extractedCourse);
      
      let normalizedHours = extractedHours;
      const matchedNum = extractedHours.replace(/[^0-9.]/g, "");
      if (matchedNum && !isNaN(parseFloat(matchedNum))) {
        normalizedHours = matchedNum;
      }
      setTrainingHours(normalizedHours);

      const cleanNameSub = subName.replace(/\s+/g, "");
      const cleanNameExt = extractedName.replace(/\s+/g, "");
      
      const cleanBirthSub = subBirth.replace(/[^0-9]/g, "");
      const cleanBirthExt = extractedBirth.replace(/[^0-9]/g, "");
      
      const isNameMismatch = cleanNameSub && cleanNameExt && !cleanNameSub.includes(cleanNameExt) && !cleanNameExt.includes(cleanNameSub);
      const isBirthMismatch = cleanBirthSub && cleanBirthExt && cleanBirthSub !== cleanBirthExt;

      if (isNameMismatch || isBirthMismatch) {
        let mismatchDetail = "⚠️ 제출 정보와 수료증 분석 정보가 일치하지 않습니다:\n";
        if (isNameMismatch) {
          mismatchDetail += `• 제출 성명: ${subName} ↔ AI 분석: ${extractedName}\n`;
        }
        if (isBirthMismatch) {
          mismatchDetail += `• 제출 생년월일: ${subBirth} ↔ AI 분석: ${extractedBirth}\n`;
        }
        mismatchDetail += "\n정확한 서류 수료 대상인지 확인 후 시간 승인을 진행해 주십시오.";
        setAiFeedback({
          type: "mismatch",
          message: mismatchDetail,
        });
      } else {
        setAiFeedback({
          type: "success",
          message: `✨ AI 분석 완료: 과정명과 이수시간을 자동으로 입력했습니다. (수료증 정보: ${extractedName || "성명미상"}, ${extractedBirth || "생년월일미상"})`,
        });
      }
    } catch (error: any) {
      console.error("AI Analysis error:", error);
      let errMsg = error.message || "";
      if (
        errMsg.includes("API key expired") || 
        errMsg.includes("API_KEY_INVALID") || 
        errMsg.includes("INVALID_ARGUMENT") || 
        errMsg.includes("key expired") ||
        errMsg.includes("400")
      ) {
        errMsg = "현재 입력 및 서버에 설정된 Gemini API 키가 올바르지 않거나 만료되었습니다.\n우측 상단의 [⚙️ API Key 설정] 메뉴에서 유효한 Gemini API Key를 새로 등록하여 주십시오 (구글 AI 스튜디오에서 무료 발급 가능).";
      }
      setAiFeedback({
        type: "error",
        message: "분석 실패: " + errMsg
      });
    } finally {
      setAiAnalysisLoading(false);
    }
  };

  // Stats Calculations for verifying completion & total training hours
  const stats = {
    total: submissions.length,
    completedCount: submissions.filter((s) => s.isCompleted).length,
    pendingCount: submissions.filter((s) => !s.isCompleted).length,
    totalHours: submissions
      .filter((s) => s.isCompleted && s.trainingHours)
      .reduce((sum, s) => {
        // Parse numbers out of training hours text
        const num = parseFloat(s.trainingHours.replace(/[^0-9.]/g, ""));
        return isNaN(num) ? sum : sum + num;
      }, 0),
  };

  const selectedSubmission = submissions.find((s) => s.id === selectedSubmissionId);

  // Search and status filters
  const filteredSubmissions = submissions.filter((sub) => {
    const matchesSearch =
      sub.assistantName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sub.birthDate.includes(searchQuery) ||
      (sub.courseName && sub.courseName.toLowerCase().includes(searchQuery.toLowerCase()));

    if (subFilter === "pending") {
      return matchesSearch && !sub.isCompleted;
    }
    if (subFilter === "completed") {
      return matchesSearch && sub.isCompleted;
    }
    return matchesSearch;
  });

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans" id="app-viewport">
      {/* Top Main Banner Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex flex-row justify-between items-center gap-4 sticky top-0 z-40 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-md shadow-indigo-100">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold tracking-wider text-indigo-600 block">장애인활동지원</span>
            <h1 className="text-base font-bold tracking-tight text-slate-900">
              온라인 수료증 제출
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Desktop & Mobile App Install Button */}
          <button
            id="btn-install-desktop-app"
            onClick={handleInstallAppClick}
            className="text-xs font-bold text-indigo-700 hover:text-indigo-900 px-3 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100/90 border border-indigo-200/90 transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs"
            title="바탕화면 또는 홈 화면에 바로가기 앱 설치"
          >
            <Download className="w-3.5 h-3.5 text-indigo-600" />
            <span className="leading-none">{isAppInstalled ? "앱 설치 안내" : "바탕화면 앱 설치"}</span>
          </button>

          {isAdminLoggedIn && (
            <div className="hidden sm:flex items-center gap-2 mr-2 border-r border-slate-200 pr-4">
              <div className="w-7 h-7 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600 font-bold text-[10px] uppercase">
                AD
              </div>
              <div className="text-left leading-none font-sans">
                <span className="text-[10px] font-bold text-slate-800 block leading-tight">
                  {currentAdminName || "지정 관리자"}
                </span>
                <span className="text-[8px] text-slate-400 block leading-tight font-mono">수료증 확인 권한</span>
              </div>
            </div>
          )}

          {userMode === "admin" && isAdminLoggedIn && (
            <>
              <button
                onClick={() => {
                  setIsApiKeyMandatory(false);
                  setShowApiKeyModal(true);
                }}
                className={`text-xs font-semibold px-3 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                  geminiApiKey
                    ? "bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200"
                    : "bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 animate-pulse"
                }`}
                title="Google Gemini AI Key 설정"
              >
                <Key className="w-3.5 h-3.5 text-indigo-600" />
                <span className="hidden leading-none md:inline">
                  {geminiApiKey ? "API 키: 연동됨" : "API 키 설정 필요"}
                </span>
              </button>
              
              <button
                onClick={handleAdminLogout}
                className="text-xs font-semibold text-rose-600 hover:text-rose-800 px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 transition-all cursor-pointer flex items-center gap-1"
                title="로그아웃"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden leading-none md:inline">로그아웃</span>
              </button>
            </>
          )}

          {/* Switcher back to User mode when viewing Coordinator Dashboard */}
          {userMode === "admin" && (
            <button
              id="back-to-assistant-btn"
              onClick={() => setUserMode("assistant")}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 px-4 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100/85 transition-all cursor-pointer flex items-center gap-1.5"
            >
              ← 제출 화면으로 돌아가기
            </button>
          )}
        </div>
      </header>

      {/* Main Execution Arena */}
      <main className="w-full" id="main-content-area">
        <AnimatePresence mode="wait">
          {userMode === "assistant" ? (
            /* =======================================
               ROLE: ASSISTANT SUBMISSION PORT PORTAL
               ======================================= */
            <motion.div
              key="assistant-portal"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3 }}
              className="py-10 max-w-4xl mx-auto px-4"
              id="assistant-section"
            >
              {/* Form container with modern card styling and rounded corner layout */}
              <div 
                className="bg-white border border-slate-200/80 p-2 sm:p-5 shadow-lg shadow-slate-100 rounded-3xl"
                id="assistant-form-outer-card"
              >
                <AssistantForm onNewSubmission={handleNewSubmission} />
              </div>
            </motion.div>
          ) : !isAdminLoggedIn ? (
            /* =======================================
               ROLE: ADMINISTRATIVE AUTHENTICATION GATE
               ======================================= */
            <motion.div
              key="admin-login-gate"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3 }}
              className="py-16 max-w-md mx-auto px-4"
              id="admin-login-section"
            >
              <div className="bg-white border border-slate-200 p-7 sm:p-8 shadow-xl rounded-3xl text-center space-y-5">
                <div className="w-16 h-16 bg-indigo-50 border border-indigo-100/80 rounded-2xl flex items-center justify-center mx-auto text-indigo-600 shadow-xs">
                  <Lock className="w-8 h-8" />
                </div>
                
                <div className="space-y-1.5">
                  <h3 className="text-lg font-bold text-slate-900">
                    {isRegistering ? "관리자 계정 신규 등록" : "관리자 계정 인증"}
                  </h3>
                  <p className="text-slate-500 text-xs leading-relaxed font-medium">
                    {isRegistering 
                      ? "새로운 관리자 계정을 생성합니다. 이름(ID)과 비밀번호를 설정하세요."
                      : "장애인활동지원 수료대장 확인 및 교육시간 승인을 위해 로그인해 주세요."
                    }
                  </p>
                </div>

                {/* Inline Error and Success Badges */}
                {authError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-xl text-left flex items-start gap-2 animate-in fade-in">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                    <span className="leading-relaxed">{authError}</span>
                  </div>
                )}

                {authSuccess && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-xl text-left flex items-start gap-2 animate-in fade-in">
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
                    <span className="leading-relaxed">{authSuccess}</span>
                  </div>
                )}

                <div className="space-y-3.5 text-left">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      {isRegistering ? "등록할 관리자 이름 (ID)" : "관리자 이름 (ID)"}
                    </label>
                    <input
                      type="text"
                      value={adminName}
                      onChange={(e) => {
                        setAdminName(e.target.value);
                        setAuthError(null);
                      }}
                      onKeyDown={(e) => e.key === "Enter" && handleAdminAuth()}
                      placeholder="예: admin 또는 본인 이름"
                      className="w-full px-4 py-2.5 border border-slate-200 bg-slate-50/70 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white transition-all shadow-2xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      비밀번호
                    </label>
                    <input
                      type="password"
                      value={adminPasscode}
                      onChange={(e) => {
                        setAdminPasscode(e.target.value);
                        setAuthError(null);
                      }}
                      onKeyDown={(e) => e.key === "Enter" && handleAdminAuth()}
                      placeholder="비밀번호 입력"
                      className="w-full px-4 py-2.5 border border-slate-200 bg-slate-50/70 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white transition-all shadow-2xs"
                    />
                  </div>
                  
                  <button
                    type="button"
                    onClick={handleAdminAuth}
                    disabled={isAuthenticating}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-bold text-xs rounded-xl shadow-md hover:shadow-lg transition-all cursor-pointer mt-2"
                  >
                    {isAuthenticating ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>인증 확인 중...</span>
                      </>
                    ) : (
                      <>
                        <UserCheck className="w-4 h-4" />
                        <span>{isRegistering ? "계정 신규 등록 및 대시보드 입장" : "인증 및 대시보드 입장"}</span>
                      </>
                    )}
                  </button>
                  
                  <div className="pt-1 text-center">
                    <button
                      type="button"
                      onClick={() => {
                        setIsRegistering(!isRegistering);
                        setAuthError(null);
                        setAuthSuccess(null);
                      }}
                      className="text-xs font-semibold text-slate-500 hover:text-indigo-600 transition-colors inline-block underline cursor-pointer"
                    >
                      {isRegistering ? "이미 계정이 있으신가요? 기존 계정으로 로그인" : "계정이 없으신가요? 신규 관리자 등록"}
                    </button>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setUserMode("assistant")}
                    className="text-xs font-semibold text-slate-400 hover:text-slate-600 transition-colors inline-block underline cursor-pointer"
                  >
                    ← 활동지원사 수료증 제출 화면으로 이동
                  </button>
                </div>
              </div>
            </motion.div>
          ) : (
            /* =======================================
               ROLE: INSTITUTION ADMIN PORT PORTAL (SIGNED IN)
               ======================================= */
            <motion.div
              key="admin-portal"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="py-10 max-w-7xl mx-auto px-4 space-y-8"
              id="admin-section"
            >
              {/* Admin Hero Header */}
              <div className="flex flex-col md:flex-row justify-between items-start md:items-end border-b border-slate-200 pb-5 gap-4" id="admin-hero">
                <div>
                  <h2 className="text-xl font-bold tracking-tight text-slate-900">
                    수료증 승인 및 이력 관리
                  </h2>
                  <p className="text-slate-505 text-xs mt-1">
                    활동지원사 분들이 접수한 수료 내역 및 파일 원본을 성실히 검증하고, 연수 이수 시간을 신속하게 결산합니다.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2.5 w-full sm:w-auto" id="header-action-panel">
                  {/* ✨ 수료증 AI 일괄 확인 버튼 */}
                  <button
                    id="btn-batch-ai-verification"
                    type="button"
                    onClick={() => {
                      if (!geminiApiKey) {
                        setShowApiKeyModal(true);
                        setIsApiKeyMandatory(true);
                        return;
                      }
                      setShowBatchAiModal(true);
                    }}
                    className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2 shadow-md shadow-indigo-100 cursor-pointer group"
                    title="제출된 수료증 사진/PDF를 AI가 일괄 분석하여 대장에 자동 입력 및 목록화"
                  >
                    <Sparkles className="w-4 h-4 text-amber-300 group-hover:scale-110 transition-transform" />
                    <span>수료증 AI 일괄 확인</span>
                    {stats.pendingCount > 0 && (
                      <span className="bg-amber-400 text-amber-950 text-[10px] font-extrabold px-1.5 py-0.5 rounded-full leading-none">
                        미확인 {stats.pendingCount}건
                      </span>
                    )}
                  </button>

                  <button
                    id="btn-trigger-refresh"
                    onClick={handleRefreshList}
                    disabled={refreshing}
                    className="px-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold text-xs border border-slate-200 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
                    목록 새로고침
                  </button>
                  
                  <button
                    id="btn-fake-export"
                    onClick={() => {
                      if (submissions.length === 0) {
                        alert("다운로드할 데이터가 없습니다.");
                        return;
                      }

                      const formatHoursNumber = (raw: string) => {
                        if (!raw) return 0;
                        let cleaned = raw.trim();
                        cleaned = cleaned.replace(/시간시간/g, "시간");
                        cleaned = cleaned.replace(/(\d+분)\s*시간/g, "$1");
                        const num = parseFloat(cleaned.replace(/[^0-9.]/g, ""));
                        return isNaN(num) ? 0 : num;
                      };

                      const lastRow = submissions.length + 3; // data starts at row 4

                      const totalHoursSum = submissions
                        .filter((s) => s.trainingHours)
                        .reduce((sum, s) => sum + formatHoursNumber(s.trainingHours), 0);

                      const dataRowsXml = submissions.map((s, idx) => {
                        const hoursNum = formatHoursNumber(s.trainingHours);
                        return `
   <Row ss:Height="20">
    <Cell ss:StyleID="centerText"><Data ss:Type="String">${s.assistantName || ""}</Data></Cell>
    <Cell ss:StyleID="centerText"><Data ss:Type="String">${s.birthDate || ""}</Data></Cell>
    <Cell ss:StyleID="centerText"><Data ss:Type="String">이수</Data></Cell>
    <Cell ss:StyleID="centerNumber"><Data ss:Type="Number">${hoursNum}</Data></Cell>
    <Cell ss:StyleID="centerText"><Data ss:Type="String">${s.courseName || "미입력"}</Data></Cell>
   </Row>`;
                      }).join("");

                      const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Center" ss:Horizontal="Center"/>
   <Borders/>
   <Font ss:FontName="Malgun Gothic" ss:Size="11"/>
   <Interior/>
   <Protection/>
  </Style>
  <Style ss:ID="TitleStyle">
   <Alignment ss:Vertical="Center" ss:Horizontal="Center"/>
   <Font ss:FontName="Malgun Gothic" ss:Size="16" ss:Bold="1"/>
  </Style>
  <Style ss:ID="SummaryStyle">
   <Alignment ss:Vertical="Center" ss:Horizontal="Right"/>
   <Font ss:FontName="Malgun Gothic" ss:Size="11" ss:Bold="1"/>
   <Interior ss:Color="#F8FAFC" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#9CA3AF"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#9CA3AF"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#9CA3AF"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#9CA3AF"/>
   </Borders>
  </Style>
  <Style ss:ID="SummaryValueStyle">
   <Alignment ss:Vertical="Center" ss:Horizontal="Center"/>
   <Font ss:FontName="Malgun Gothic" ss:Size="11" ss:Bold="1"/>
   <Interior ss:Color="#F8FAFC" ss:Pattern="Solid"/>
   <NumberFormat ss:Format="#,##0&quot;시간&quot;"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#9CA3AF"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#9CA3AF"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#9CA3AF"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#9CA3AF"/>
   </Borders>
  </Style>
  <Style ss:ID="HeaderStyle">
   <Alignment ss:Vertical="Center" ss:Horizontal="Center"/>
   <Font ss:FontName="Malgun Gothic" ss:Size="11" ss:Bold="1"/>
   <Interior ss:Color="#E0E7FF" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#9CA3AF"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#9CA3AF"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#9CA3AF"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#9CA3AF"/>
   </Borders>
  </Style>
  <Style ss:ID="centerText">
   <Alignment ss:Vertical="Center" ss:Horizontal="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
   </Borders>
  </Style>
  <Style ss:ID="centerNumber">
   <Alignment ss:Vertical="Center" ss:Horizontal="Center"/>
   <NumberFormat ss:Format="#,##0&quot;시간&quot;"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
   </Borders>
  </Style>
 </Styles>
 <Worksheet ss:Name="교육수료목록">
  <Table ss:ExpandedColumnCount="5" ss:ExpandedRowCount="${lastRow}" x:FullColumns="1" x:FullRows="1" ss:DefaultRowHeight="20">
   <Column ss:Width="160"/> <!-- A열 너비 20 (~160px) -->
   <Column ss:Width="72"/>  <!-- B열 너비 9 (~72px) -->
   <Column ss:Width="85"/>  <!-- C열 구분 (~85px) -->
   <Column ss:Width="150"/> <!-- D열 너비 19 (~150px) -->
   <Column ss:Width="380"/> <!-- E열 너비 50 (~380px) -->
   
   <!-- Row 1: Title (Height 35) -->
   <Row ss:Height="35">
    <Cell ss:MergeAcross="4" ss:StyleID="TitleStyle"><Data ss:Type="String">장애인활동지원 온라인 교육 목록</Data></Cell>
   </Row>
   
   <!-- Row 2: Summary with SUBTOTAL formula (Height 23) -->
   <Row ss:Height="23">
    <Cell ss:MergeAcross="3" ss:StyleID="SummaryStyle"><Data ss:Type="String">총 이수 누적시간 (필터 반영):</Data></Cell>
    <Cell ss:StyleID="SummaryValueStyle" ss:Formula="=SUBTOTAL(9,R4C4:R${lastRow}C4)"><Data ss:Type="Number">${totalHoursSum}</Data></Cell>
   </Row>
   
   <!-- Row 3: Header (Height 30) -->
   <Row ss:Height="30">
    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">지원사 성명</Data></Cell>
    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">생년월일</Data></Cell>
    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">구분</Data></Cell>
    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">승인 교육시간</Data></Cell>
    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">이수 교육과정명</Data></Cell>
   </Row>
   
   ${dataRowsXml}
  </Table>
  <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">
   <PageSetup>
    <Header x:Margin="0.3"/>
    <Footer x:Margin="0.3"/>
    <PageMargins x:Bottom="0.75" x:Left="0.7" x:Right="0.7" x:Top="0.75"/>
   </PageSetup>
   <Selected/>
   <AutoFilter x:Range="R3C1:R${lastRow}C5" xmlns="urn:schemas-microsoft-com:office:excel"></AutoFilter>
   <ProtectObjects>False</ProtectObjects>
   <ProtectScenarios>False</ProtectScenarios>
  </WorksheetOptions>
 </Worksheet>
</Workbook>`;

                      const blob = new Blob(["\uFEFF" + xmlContent], { type: "application/vnd.ms-excel;charset=utf-8;" });
                      const url = URL.createObjectURL(blob);
                      const link = document.createElement("a");
                      link.setAttribute("href", url);
                      link.setAttribute("download", `장애인활동지원_온라인교육목록_${new Date().toISOString().slice(0,10)}.xml`);
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                    }}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-md shadow-indigo-100 cursor-pointer"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    엑셀 대장 다운로드 (CSV)
                  </button>
                </div>
              </div>

              {/* Verified Dynamic counters strip */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6" id="stats-grid">
                <div className="p-5 bg-white border border-slate-200 shadow-xs rounded-2xl flex items-center justify-between" id="stat-total">
                  <div>
                    <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase block">총 접수 수료증</span>
                    <h3 className="text-2xl font-bold mt-1 text-slate-900">{stats.total}건</h3>
                  </div>
                  <div className="w-10 h-10 bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-500 rounded-xl font-bold ml-2">
                    <FileText className="w-5 h-5 text-indigo-500" />
                  </div>
                </div>

                <div className="p-5 bg-emerald-50/40 border border-emerald-100 shadow-xs rounded-2xl flex items-center justify-between" id="stat-completed">
                  <div>
                    <span className="text-[10px] font-bold tracking-wider text-emerald-600 uppercase block">교육 이수 확인</span>
                    <h3 className="text-2xl font-bold mt-1 text-emerald-900">{stats.completedCount}건</h3>
                  </div>
                  <div className="w-10 h-10 bg-emerald-100/50 border border-emerald-200/50 flex items-center justify-center text-emerald-600 rounded-xl ml-2">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                </div>

                <div className="p-5 bg-amber-50/40 border border-amber-100 shadow-xs rounded-2xl flex items-center justify-between" id="stat-pending">
                  <div>
                    <span className="text-[10px] font-bold tracking-wider text-amber-600 uppercase block">검토 대기 건수</span>
                    <h3 className="text-2xl font-bold mt-1 text-amber-900">{stats.pendingCount}건</h3>
                  </div>
                  <div className="w-10 h-10 bg-amber-100/50 border border-amber-200/50 flex items-center justify-center text-amber-600 rounded-xl ml-2">
                    <Clock className="w-5 h-5" />
                  </div>
                </div>

                <div className="p-5 bg-indigo-50/40 border border-indigo-100 shadow-xs rounded-2xl flex items-center justify-between" id="stat-hours">
                  <div>
                    <span className="text-[10px] font-bold tracking-wider text-indigo-600 uppercase block">누적 승인 교육시간</span>
                    <h3 className="text-2xl font-bold mt-1 text-indigo-900">{stats.totalHours}시간</h3>
                  </div>
                  <div className="w-10 h-10 bg-indigo-100/50 border border-indigo-200/50 flex items-center justify-center text-indigo-600 rounded-xl font-bold ml-2">
                    <Award className="w-5 h-5 text-indigo-600" />
                  </div>
                </div>
              </div>

              {/* 대장 보기 및 개별 검토 탭 스위처 */}
              <div className="flex border-b border-slate-200/85 gap-6 pb-0.5 pt-2" id="admin-view-mode-tabs">
                <button
                  type="button"
                  onClick={() => setAdminViewMode("inspector")}
                  className={`pb-3.5 text-xs sm:text-xs font-bold transition-all relative flex items-center gap-1.5 cursor-pointer md:px-1 ${
                    adminViewMode === "inspector"
                      ? "text-indigo-600 font-bold border-b-2 border-indigo-600"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <LayoutDashboard className="w-3.5 h-3.5" />
                  <span>개별 수료 대조 및 승인</span>
                  {stats.pendingCount > 0 && (
                    <span className="bg-amber-500 text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded-full inline-block min-w-[16px] text-center leading-none">
                      {stats.pendingCount}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setAdminViewMode("list")}
                  className={`pb-3.5 text-xs sm:text-xs font-bold transition-all relative flex items-center gap-1.5 cursor-pointer md:px-1 ${
                    adminViewMode === "list"
                      ? "text-indigo-600 font-bold border-b-2 border-indigo-600"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>수료증 제출대장 (전체대장 형식)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAdminViewMode("gallery")}
                  className={`pb-3.5 text-xs sm:text-xs font-bold transition-all relative flex items-center gap-1.5 cursor-pointer md:px-1 ${
                    adminViewMode === "gallery"
                      ? "text-indigo-600 font-bold border-b-2 border-indigo-600"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>이수증 사진 모아보기 (일괄인쇄)</span>
                </button>
                {(currentAdminName?.toLowerCase().includes("admin") || currentAdminName === "admin (마스터)") && (
                  <button
                    type="button"
                    onClick={() => setAdminViewMode("users")}
                    className={`pb-3.5 text-xs sm:text-xs font-bold transition-all relative flex items-center gap-1.5 cursor-pointer md:px-1 ${
                      adminViewMode === "users"
                        ? "text-indigo-600 font-bold border-b-2 border-indigo-600"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>가입 계정/회원 관리 (벤 제어)</span>
                  </button>
                )}
              </div>

              {adminViewMode === "inspector" ? (
                /* Master-Detail Dual Columns Workdesk */
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8" id="admin-work-stage">
                
                {/* LEFT CONTEXT PANEL: Search, Filter & List of submissions */}
                <div className="lg:col-span-5 bg-white border border-slate-205/85 p-5 rounded-2xl shadow-sm flex flex-col min-h-[500px]" id="submissions-list-pane">
                  
                  {/* Title & Filter Options */}
                  <div className="mb-4 space-y-3" id="filters-container">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider block">접수 수료증 내역</h3>
                      <span className="text-[10px] font-medium text-slate-400">정렬기준: 최신순</span>
                    </div>

                    {/* Filter Mode Switching Badges */}
                    <div className="flex flex-wrap gap-1.5" id="records-tab-toggles">
                      <button
                        id="filter-all"
                        onClick={() => setSubFilter("all")}
                        className={`px-3 py-1.5 text-[10px] font-semibold rounded-lg border transition-all cursor-pointer ${
                          subFilter === "all"
                            ? "bg-slate-800 border-slate-800 text-white"
                            : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        전체 ({submissions.length})
                      </button>
                      <button
                        id="filter-pending"
                        onClick={() => setSubFilter("pending")}
                        className={`px-3 py-1.5 text-[10px] font-semibold rounded-lg border transition-all cursor-pointer ${
                          subFilter === "pending"
                            ? "bg-amber-600 border-amber-500 text-white"
                            : "bg-white border-slate-200 text-slate-650 hover:bg-slate-50"
                        }`}
                      >
                        미확인 ({submissions.filter(s => !s.isCompleted).length})
                      </button>
                      <button
                        id="filter-completed"
                        onClick={() => setSubFilter("completed")}
                        className={`px-3 py-1.5 text-[10px] font-semibold rounded-lg border transition-all cursor-pointer ${
                          subFilter === "completed"
                            ? "bg-emerald-600 border-emerald-500 text-white"
                            : "bg-white border-slate-200 text-slate-650 hover:bg-slate-50"
                        }`}
                      >
                        확인완료 ({submissions.filter(s => s.isCompleted).length})
                      </button>
                    </div>

                    {/* Unified Search Input Textbox */}
                    <div className="relative">
                      <span className="absolute left-3 top-3 text-slate-400">
                        <Search className="w-3.5 h-3.5" />
                      </span>
                      <input
                        id="admin-search-text"
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="이름, 생년월일 또는 교육과정명 검색..."
                        className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-xs bg-slate-50/20 focus:bg-white focus:outline-none transition-colors"
                      />
                    </div>
                  </div>

                  {/* Dynamic Records scroll region */}
                  <div className="flex-1 max-h-[500px] overflow-y-auto divide-y divide-slate-100 pr-1.5" id="submissions-records-scroll">
                    {loading ? (
                      <div className="text-center py-10 font-medium text-slate-400 text-xs">기록을 불러오는 중입니다...</div>
                    ) : filteredSubmissions.length === 0 ? (
                      <div className="text-center py-16 text-slate-400 text-xs font-semibold bg-slate-50 border border-slate-100 rounded-xl">
                        조건에 일치하는 내역이 존재하지 않습니다.
                      </div>
                    ) : (
                      filteredSubmissions.map((sub) => {
                        const isSelected = sub.id === selectedSubmissionId;
                        return (
                          <div
                            key={sub.id}
                            id={`submission-item-${sub.id}`}
                            onClick={() => handleSelectItem(sub)}
                            className={`p-3 my-1.5 cursor-pointer transition-all border flex items-center justify-between rounded-xl ${
                              isSelected
                                ? "bg-indigo-50/50 border-indigo-200 ring-2 ring-indigo-50/30"
                                : "bg-white border-transparent hover:bg-slate-50"
                            }`}
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-sm text-slate-800">{sub.assistantName}</span>
                                <span className="text-[10px] font-medium text-slate-400">{sub.birthDate}</span>
                              </div>
                              <p className="text-xs text-slate-500 truncate max-w-[200px]">
                                {sub.courseName || <em className="text-slate-400 font-normal">과정명 미지정</em>}
                              </p>
                              <div className="flex items-center gap-3 text-[10px] text-slate-400">
                                <span>시간: {sub.trainingHours || "미입력"}</span>
                                <span>제출: {new Date(sub.submittedAt).toLocaleDateString()}</span>
                              </div>
                            </div>
                            <div className="shrink-0 pl-2">
                              {sub.isCompleted ? (
                                <span className="px-2 py-0.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold rounded-full">
                                  이수 완료
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-bold rounded-full">
                                  검토 대기
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* RIGHT CONTEXT PANEL: Certificate Verification Workdesk details */}
                <div className="lg:col-span-7 bg-white border border-slate-200 p-6 rounded-2xl shadow-sm flex flex-col min-h-[500px]" id="verification-inspector-pane">
                  {selectedSubmission ? (
                    <div className="space-y-5" id="inspector-workdesk">
                      
                      <div className="flex justify-between items-center border-b border-slate-100 pb-3" id="inspector-action-header">
                        <div>
                          <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider block">제출물 검증</span>
                          <h4 className="text-sm font-semibold text-slate-800">교육 세부 수료 사항 검토</h4>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] font-mono text-slate-400 block">ID: {selectedSubmission.id}</span>
                        </div>
                      </div>

                      {/* Split layout: Photo Frame + Form settings inside inspector */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6" id="inspector-split">
                        
                        {/* Certificate picture zoom/visualizer */}
                        <div className="space-y-2" id="inspector-cert-image-preview">
                          <span className="block text-xs font-semibold text-slate-500">활동지원사 송부 수료 문서</span>
                          
                          <div className="bg-slate-50 border border-slate-200/80 p-2.5 relative flex flex-col items-center justify-center min-h-[225px] overflow-hidden rounded-xl bg-slate-50">
                            {selectedSubmission.certificateImage ? (
                              <>
                                {isPdfFile(selectedSubmission.certificateImage) ? (
                                  <iframe
                                    src={selectedSubmission.certificateImage}
                                    className="w-full h-[220px] rounded-lg border border-slate-150 bg-white"
                                    title="PDF 수료증 미리보기"
                                  />
                                ) : (
                                  <img
                                    id="img-inspector-canvas"
                                    src={selectedSubmission.certificateImage}
                                    alt="Certificate original file"
                                    className="max-h-[220px] object-contain mx-auto border border-slate-100 rounded-lg max-w-full"
                                    referrerPolicy="no-referrer"
                                  />
                                )}
                                <button
                                  id="btn-zoom-inspector-img"
                                  onClick={() => setZoomedImage(selectedSubmission.certificateImage)}
                                  className="absolute bottom-2 right-2 bg-slate-900/85 hover:bg-indigo-600 text-white font-medium text-[10px] px-2.5 py-1 transition-all rounded-lg cursor-pointer"
                                >
                                  크게보기
                                </button>
                              </>
                            ) : (
                              <div className="text-xs text-slate-400" id="blank-img-state">수료증이 등록되지 않았습니다.</div>
                            )}
                          </div>
                        </div>

                        {/* Review Inputs */}
                        <div className="space-y-3.5" id="inspector-interactive-inputs">
                          <div className="flex items-center justify-between">
                            <span className="block text-[10px] text-indigo-700 font-extrabold uppercase tracking-wide">
                              수료증 대장 입력 및 검토
                            </span>
                            <button
                              type="button"
                              onClick={() => handleSingleAiAnalysis(selectedSubmission)}
                              disabled={singleAiLoading}
                              className="px-2.5 py-1 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-bold text-[10px] rounded-lg shadow-xs flex items-center gap-1 cursor-pointer transition-all disabled:opacity-50"
                              title="Gemini AI로 이 수료증의 과정명과 시간을 자동 판독합니다"
                            >
                              <Sparkles className="w-3 h-3 text-amber-300" />
                              <span>{singleAiLoading ? "AI 판독 중..." : "AI 즉시 판독"}</span>
                            </button>
                          </div>

                          {/* AI Feedback Banner */}
                          {aiFeedback && (
                            <div
                              className={`p-2.5 rounded-xl text-xs font-semibold flex items-start gap-2 ${
                                aiFeedback.type === "success"
                                  ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
                                  : "bg-rose-50 border border-rose-200 text-rose-700"
                              }`}
                            >
                              {aiFeedback.type === "success" ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                              ) : (
                                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                              )}
                              <span className="leading-relaxed">{aiFeedback.message}</span>
                            </div>
                          )}

                          <div className="p-3.5 bg-slate-50/80 border border-slate-200/80 rounded-xl space-y-3 text-xs font-medium shadow-2xs">
                            <div className="grid grid-cols-2 gap-2">
                              <div className="bg-white p-2 rounded-lg border border-slate-200/60 shadow-2xs">
                                <span className="text-slate-400 text-[9px] font-bold block">성명</span>
                                <p className="text-slate-800 text-xs font-extrabold mt-0.5">{selectedSubmission.assistantName}</p>
                              </div>
                              <div className="bg-white p-2 rounded-lg border border-slate-200/60 shadow-2xs">
                                <span className="text-slate-400 text-[9px] font-bold block">생년월일(6자리)</span>
                                <p className="text-slate-800 text-xs font-mono font-extrabold mt-0.5">{selectedSubmission.birthDate}</p>
                              </div>
                            </div>

                            <div>
                              <label className="text-slate-500 text-[10px] font-bold block mb-1">
                                이수 교육과정명
                              </label>
                              <input
                                type="text"
                                value={courseName}
                                onChange={(e) => setCourseName(e.target.value)}
                                placeholder="예: 2024년 활동지원사 보수교육"
                                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-500"
                              />
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-slate-500 text-[10px] font-bold block mb-1">
                                  인정 교육시간
                                </label>
                                <input
                                  type="text"
                                  value={trainingHours}
                                  onChange={(e) => setTrainingHours(e.target.value)}
                                  placeholder="예: 8시간"
                                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-indigo-600 focus:outline-none focus:border-indigo-500 font-mono"
                                />
                              </div>
                              <div>
                                <label className="text-slate-500 text-[10px] font-bold block mb-1">
                                  발급기관
                                </label>
                                <input
                                  type="text"
                                  value={selectedSubmission.institution || ""}
                                  readOnly
                                  placeholder="AI 분석 시 자동 기재"
                                  className="w-full px-3 py-1.5 bg-slate-100/60 border border-slate-200 rounded-lg text-xs text-slate-600"
                                />
                              </div>
                            </div>

                            {selectedSubmission.aiVerified && (
                              <div className="pt-1 flex items-center justify-between text-[10px] text-indigo-600">
                                <span className="flex items-center gap-1 font-bold">
                                  <Sparkles className="w-3 h-3" /> AI 자동 판독 등록 완료
                                </span>
                                {selectedSubmission.completionDate && (
                                  <span className="text-slate-400 font-mono">
                                    이수일: {selectedSubmission.completionDate}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                      </div>

                      {/* Textarea for note taking */}
                      <div className="space-y-1.5" id="review-notes-container">
                        <label className="block text-xs font-semibold text-slate-700">관리자 검토 비고 (메모사항)</label>
                        <textarea
                          id="admin-manager-notes"
                          value={managerNotes || ""}
                          onChange={(e) => setManagerNotes(e.target.value)}
                          placeholder="추가적인 확인사항이나 메모사항이 있는 경우 입력해 둡니다."
                          className="w-full border border-slate-200 rounded-xl p-2.5 text-xs bg-slate-50/30 focus:bg-white focus:outline-none font-medium h-16 transition-colors"
                        />
                      </div>

                      {/* Dynamic Action row */}
                      <div className="border-t border-slate-100 pt-4 flex flex-col sm:flex-row justify-between items-center gap-3" id="verifying-action-bar">
                        
                        <div className="flex gap-2 w-full sm:w-auto" id="left-actions">
                          <button
                            id="btn-action-delete"
                            onClick={() => handleDelete(selectedSubmission.id)}
                            className="p-2.5 bg-rose-50 hover:bg-rose-100 border border-rose-100 text-rose-600 rounded-xl transition-all flex items-center justify-center gap-1 cursor-pointer"
                            title="제출 영구 삭제"
                          >
                            <Trash2 className="w-4 h-4" />
                            <span className="text-xs font-semibold sm:hidden">기록 영구삭제</span>
                          </button>
                        </div>

                        <div className="flex gap-2.5 w-full sm:w-auto justify-end" id="main-workflow-actions">
                          {/* Pending / Temporary Hold */}
                          <button
                            id="btn-action-hold"
                            onClick={() => handleSaveVerification(selectedSubmission.id, false)}
                            disabled={actionLoading}
                            className="px-4 py-2.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1 cursor-pointer"
                          >
                            임시 보류 / 저장
                          </button>

                          {/* Completed & Verified */}
                          <button
                            id="btn-action-approve"
                            onClick={() => handleSaveVerification(selectedSubmission.id, true)}
                            disabled={actionLoading}
                            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl shadow-md hover:shadow-lg hover:shadow-indigo-50 shadow-indigo-100 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <ClipboardCheck className="w-4 h-4" />
                            교육 수강 완료 확인
                          </button>
                        </div>

                      </div>

                    </div>
                  ) : (
                    <div className="flex-grow flex flex-col items-center justify-center p-8 text-center" id="inspector-blank-state">
                      <Award className="w-16 h-16 text-slate-200 mb-2 animate-pulse" />
                      <h4 className="font-semibold text-xs text-slate-700 tracking-wider">이수 내역 미선택</h4>
                      <p className="text-xs text-slate-400 mt-1.5 max-w-sm">
                        상세 수료 파일 분석과 인정 시간 검토를 진행하시려면, 왼쪽 제출 내역 목록에서 대상자를 클릭해 주세요.
                      </p>
                    </div>
                  )}
                </div>

              </div>
              ) : adminViewMode === "list" ? (
                /* Ledger Table list layout (수료증 제출대장 전체보기) */
                <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6 space-y-5" id="ledger-table-view">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-bold text-slate-850 font-sans">장애인활동지원 온라인 교육 수료대장 완료자 명단</h3>
                        <span className="bg-indigo-50 border border-indigo-200 text-indigo-700 text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 font-sans">
                          총 인정 교육시간: <strong className="text-indigo-805">{stats.totalHours}시간</strong>
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1 font-sans">
                        검색 및 정렬 필터 기준 총 {filteredSubmissions.length}건이 반영되었습니다. (전체 목록 총 누적 교육시간: {stats.totalHours}시간)
                      </p>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                      {/* 테이블 검색 인풋 */}
                      <div className="relative flex-1 sm:flex-initial">
                        <span className="absolute left-3 top-2.5 text-slate-400">
                          <Search className="w-3.5 h-3.5" />
                        </span>
                        <input
                          id="admin-table-search-text"
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="성명, 생년월일 또는 교육과정 검색..."
                          className="w-full sm:w-60 pl-9 pr-3 py-1.5 border border-slate-200 rounded-xl text-xs bg-slate-50/20 focus:bg-white focus:outline-none transition-colors font-sans"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => window.print()}
                        className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 border border-slate-900 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shadow-xs font-sans"
                        title="대장 양식으로 전체 데이터 출력"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>대장 인쇄</span>
                      </button>
                    </div>
                  </div>

                  {/* Filter tabs inside desk ledger */}
                  <div className="flex flex-wrap gap-1" id="ledger-filter-pills">
                    <button
                      type="button"
                      onClick={() => setSubFilter("all")}
                      className={`px-3 py-1.5 text-[10px] font-semibold rounded-lg border transition-all cursor-pointer ${
                        subFilter === "all"
                          ? "bg-slate-800 border-slate-800 text-white"
                          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      전체 ({submissions.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setSubFilter("pending")}
                      className={`px-3 py-1.5 text-[10px] font-semibold rounded-lg border transition-all cursor-pointer ${
                        subFilter === "pending"
                          ? "bg-amber-600 border-amber-500 text-white"
                          : "bg-white border-slate-200 text-slate-650 hover:bg-slate-50"
                      }`}
                    >
                      검토대기 ({submissions.filter(s => !s.isCompleted).length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setSubFilter("completed")}
                      className={`px-3 py-1.5 text-[10px] font-semibold rounded-lg border transition-all cursor-pointer ${
                        subFilter === "completed"
                          ? "bg-emerald-600 border-emerald-500 text-white"
                          : "bg-white border-slate-200 text-slate-650 hover:bg-slate-50"
                      }`}
                    >
                      이수완료 ({submissions.filter(s => s.isCompleted).length})
                    </button>
                  </div>

                  {/* Table area */}
                  <div className="block w-full overflow-x-auto border border-slate-150 rounded-xl bg-white shadow-2xs" id="ledger-table-container">
                    <table className="w-full text-left border-collapse" id="ledger-table-element">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200/80 text-[10px] font-bold text-slate-505 uppercase tracking-wider text-slate-500">
                          <th className="px-4 py-3 text-center w-12">No</th>
                          <th className="px-4 py-3">성명</th>
                          <th className="px-4 py-3">생년월일</th>
                          <th className="px-4 py-3">이수 교육과정명</th>
                          <th className="px-4 py-3 text-center w-28">인정 시간</th>
                          <th className="px-4 py-3 text-center font-sans">제출일자</th>
                          <th className="px-4 py-3 text-center w-28">이수상태</th>
                          <th className="px-4 py-3">검토메모</th>
                          <th className="px-4 py-3 text-center w-36">이수작성</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs font-medium">
                        {filteredSubmissions.length === 0 ? (
                          <tr>
                            <td colSpan={9} className="px-4 py-16 text-center text-slate-400 font-semibold bg-slate-50/50">
                              조건에 합치되는 제출 수료 기록이 리스트에 존재하지 않습니다.
                            </td>
                          </tr>
                        ) : (
                          filteredSubmissions.map((sub, idx) => (
                            <tr key={sub.id} className="hover:bg-slate-50/50 transition-colors">
                              <td className="px-4 py-3.5 text-center font-mono text-slate-400">{idx + 1}</td>
                              <td className="px-4 py-3.5 font-bold text-slate-800">{sub.assistantName}</td>
                              <td className="px-4 py-3.5 font-mono text-slate-500">{sub.birthDate}</td>
                              <td className="px-4 py-3.5 text-slate-600 max-w-xs truncate" title={sub.courseName || '과정명 미지정'}>
                                {sub.courseName || <span className="text-slate-300 italic">과정명 미지정</span>}
                              </td>
                              <td className="px-4 py-3.5 text-center font-mono font-bold text-indigo-600 text-sm">
                                {sub.trainingHours ? (sub.trainingHours.includes("시간") ? sub.trainingHours : `${sub.trainingHours}시간`) : <span className="text-slate-300 font-normal">미입력</span>}
                              </td>
                              <td className="px-4 py-3.5 text-center text-slate-400 font-mono">
                                {new Date(sub.submittedAt).toLocaleDateString()}
                              </td>
                              <td className="px-4 py-3.5 text-center">
                                {sub.isCompleted ? (
                                  <span className="px-2 py-0.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold rounded-full">
                                    이수 완료
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-bold rounded-full">
                                    검토 대기
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3.5 text-slate-400 max-w-[150px] truncate" title={sub.managerNotes || ''}>
                                {sub.managerNotes || <span className="text-slate-300 italic">-</span>}
                              </td>
                              <td className="px-4 py-3.5 text-center">
                                <div className="flex items-center justify-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setAdminViewMode("inspector");
                                      handleSelectItem(sub);
                                    }}
                                    className="px-2.5 py-1 hover:bg-slate-100 border border-slate-200 text-slate-600 rounded-lg text-[10px] font-bold cursor-pointer transition-all flex items-center gap-0.5"
                                  >
                                    <Eye className="w-3 h-3" />
                                    <span>검토</span>
                                  </button>
                                  {/* No individual certificate print needed */}
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : adminViewMode === "gallery" ? (
                /* Gallery Grid layout (이수증 사진 모아보기) */
                <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6 space-y-5" id="gallery-grid-view">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-bold text-slate-850 font-sans">제출 수료증 사진 모아보기</h3>
                        <span className="bg-indigo-50 border border-indigo-200 text-indigo-700 text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 font-sans">
                          총 수료증 이미지: <strong className="text-indigo-805">{filteredSubmissions.filter(s => s.certificateImage).length}개</strong>
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1 font-sans">
                        제출된 수료증 사진(원본)을 바둑판식으로 모아보고, 필요 시 한 번에 인쇄할 수 있습니다.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                      {/* Search text box inside gallery */}
                      <div className="relative flex-1 sm:flex-initial">
                        <span className="absolute left-3 top-2.5 text-slate-400">
                          <Search className="w-3.5 h-3.5" />
                        </span>
                        <input
                          id="admin-gallery-search-text"
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="성명, 생년월일 또는 교육과정 검색..."
                          className="w-full sm:w-60 pl-9 pr-3 py-1.5 border border-slate-200 rounded-xl text-xs bg-slate-50/20 focus:bg-white focus:outline-none transition-colors font-sans"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setPrintTarget("photos");
                          setTimeout(() => {
                            window.print();
                          }, 50);
                        }}
                        className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 border border-slate-900 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shadow-xs font-sans"
                        title="모아둔 수료증 이미지를 페이지 규격에 맞게 일괄 인쇄"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>수료증 한꺼번에 인쇄하기</span>
                      </button>
                    </div>
                  </div>

                  {/* Filter tabs inside gallery */}
                  <div className="flex flex-wrap gap-1" id="gallery-filter-pills">
                    <button
                      type="button"
                      onClick={() => setSubFilter("all")}
                      className={`px-3 py-1.5 text-[10px] font-semibold rounded-lg border transition-all cursor-pointer ${
                        subFilter === "all"
                          ? "bg-slate-800 border-slate-800 text-white"
                          : "bg-white border-slate-200 text-slate-650 hover:bg-slate-50"
                      }`}
                    >
                      전체 ({submissions.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setSubFilter("pending")}
                      className={`px-3 py-1.5 text-[10px] font-semibold rounded-lg border transition-all cursor-pointer ${
                        subFilter === "pending"
                          ? "bg-amber-600 border-amber-500 text-white"
                          : "bg-white border-slate-200 text-slate-650 hover:bg-slate-50"
                      }`}
                    >
                      검토대기 ({submissions.filter(s => !s.isCompleted).length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setSubFilter("completed")}
                      className={`px-3 py-1.5 text-[10px] font-semibold rounded-lg border transition-all cursor-pointer ${
                        subFilter === "completed"
                          ? "bg-emerald-600 border-emerald-500 text-white"
                          : "bg-white border-slate-200 text-slate-650 hover:bg-slate-50"
                      }`}
                    >
                      이수완료 ({submissions.filter(s => s.isCompleted).length})
                    </button>
                  </div>

                  {/* Certificate image gallery grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6" id="gallery-images-grid">
                    {filteredSubmissions.length === 0 ? (
                      <div className="col-span-full py-16 text-center text-slate-400 font-semibold bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                        조건에 부합하는 수료증 이미지가 없습니다.
                      </div>
                    ) : (
                      filteredSubmissions.map((sub) => (
                        <div key={sub.id} className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 flex flex-col justify-between hover:shadow-md transition-all">
                          <div className="space-y-2">
                            {/* Certificate thumbnail block */}
                            <div className="bg-white border border-slate-100 rounded-lg h-44 overflow-hidden relative flex items-center justify-center select-none group">
                              {sub.certificateImage ? (
                                <>
                                  {isPdfFile(sub.certificateImage) ? (
                                    <div className="w-full h-full p-2 bg-slate-50 flex flex-col items-center justify-center text-center">
                                      <FileText className="w-10 h-10 text-slate-400 mb-1" />
                                      <span className="text-[10px] font-semibold text-slate-550 truncate max-w-full px-2">PDF 수료증 문서</span>
                                    </div>
                                  ) : (
                                    <img
                                      src={sub.certificateImage}
                                      alt={`${sub.assistantName} 수료증`}
                                      className="w-full h-full object-cover"
                                      referrerPolicy="no-referrer"
                                    />
                                  )}
                                  <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity cursor-pointer" onClick={() => setZoomedImage(sub.certificateImage)}>
                                    <span className="bg-white/95 text-slate-800 text-[10px] font-bold px-2.5 py-1.5 rounded-lg shadow-sm flex items-center gap-1">
                                      <Eye className="w-3 h-3" /> 크게보기
                                    </span>
                                  </div>
                                </>
                              ) : (
                                <div className="text-[11px] text-slate-350 italic">수료증 파일 없음</div>
                              )}
                            </div>

                            {/* Info list */}
                            <div className="space-y-1 text-xs">
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-slate-850 truncate">{sub.assistantName}</span>
                                <span className="text-[10px] text-slate-400 font-mono">{sub.birthDate}</span>
                              </div>
                              <p className="text-[11px] text-slate-500 truncate" title={sub.courseName || "과정명 미지정"}>
                                {sub.courseName || <span className="text-slate-300 italic">과정명 미지정</span>}
                              </p>
                              <div className="flex items-center justify-between text-[10px] text-slate-400">
                                <span>인정 시간: <strong className="text-indigo-600 font-mono font-bold">{sub.trainingHours ? (sub.trainingHours.includes("시간") ? sub.trainingHours : `${sub.trainingHours}시간`) : "-"}</strong></span>
                                <span>{new Date(sub.submittedAt).toLocaleDateString()}</span>
                              </div>
                            </div>
                          </div>

                          {/* Quick action button line */}
                          <div className="border-t border-slate-100 mt-2.5 pt-2 flex items-center justify-between">
                            {sub.isCompleted ? (
                              <span className="px-2 py-0.5 bg-emerald-50 border border-emerald-100 text-emerald-700 text-[9px] font-extrabold rounded-md leading-none">
                                이수 완료
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 bg-amber-50 border border-amber-100 text-amber-700 text-[9px] font-extrabold rounded-md leading-none">
                                검토 대기
                              </span>
                            )}

                            <div className="flex gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setAdminViewMode("inspector");
                                  handleSelectItem(sub);
                                }}
                                className="px-2 py-1 bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 rounded-md text-[9px] font-bold cursor-pointer transition-all flex items-center gap-0.5"
                              >
                                <span>검증 및 승인</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ) : adminViewMode === "users" ? (
                <UserManagementView
                  currentAdminName={currentAdminName}
                  submissions={submissions}
                  onRefreshData={() => fetchSubmissions(true)}
                />
              ) : null}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* ──────────────────────────────────────────────
          PWA DESKTOP / MOBILE INSTALLATION MODAL
          ────────────────────────────────────────────── */}
      <AnimatePresence>
        {showInstallModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs font-sans">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Modal Header */}
              <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 p-5 text-white flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/15 rounded-xl flex items-center justify-center text-white border border-white/20">
                    <Download className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold leading-tight">바탕화면 / 홈 화면 앱 설치 안내</h3>
                    <p className="text-xs text-indigo-100 mt-0.5">구글 로그인 없이 바탕화면 아이콘으로 바로 접속</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowInstallModal(false)}
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-6 space-y-5 overflow-y-auto flex-1 text-slate-700">
                {/* Standalone Installation Action if browser prompt ready */}
                {deferredInstallPrompt && (
                  <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="flex h-2.5 w-2.5 rounded-full bg-indigo-600 animate-ping" />
                      <p className="text-xs font-bold text-indigo-900">브라우저 설치 준비 완료</p>
                    </div>
                    <p className="text-xs text-indigo-700">
                      아래 버튼을 누르면 브라우저의 공식 설치 대화상자가 즉시 실행되어 바탕화면에 바로가기 아이콘이 생성됩니다.
                    </p>
                    <button
                      onClick={handleInstallAppClick}
                      className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                      <span>지금 바로 원클릭 앱 설치하기</span>
                    </button>
                  </div>
                )}

                {/* Shared URL Direct Link Copier */}
                <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-600">공유 전용 다이렉트 주소</span>
                    <button
                      onClick={handleCopyLink}
                      className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer bg-white px-2.5 py-1 rounded-md border border-slate-200 shadow-2xs"
                    >
                      {copiedLink ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="text-emerald-600">복사 완료!</span>
                        </>
                      ) : (
                        <>
                          <Share2 className="w-3.5 h-3.5" />
                          <span>링크 복사</span>
                        </>
                      )}
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400 font-mono break-all bg-white p-2 rounded-lg border border-slate-150 select-all">
                    {window.location.origin.includes("ais-dev-")
                      ? window.location.origin.replace("ais-dev-", "ais-pre-")
                      : window.location.href}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    💡 이 링크는 Google AI Studio 로그인이 필요없는 독립형 웹앱 주소입니다. 활동지원사분들께 카카오톡이나 문자로 전송하시면 바로 접속됩니다.
                  </p>
                </div>

                {/* OS/Device Tabs */}
                <div>
                  <span className="text-xs font-bold text-slate-800 block mb-2">기기별 바탕화면 설치 방법</span>
                  <div className="flex border border-slate-200 rounded-xl p-1 bg-slate-100 gap-1 text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => setInstallGuideTab("pc")}
                      className={`flex-1 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                        installGuideTab === "pc" ? "bg-white text-indigo-700 shadow-2xs font-bold" : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      <Laptop className="w-3.5 h-3.5" />
                      <span>PC 컴퓨터 (크롬/엣지)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setInstallGuideTab("android")}
                      className={`flex-1 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                        installGuideTab === "android" ? "bg-white text-indigo-700 shadow-2xs font-bold" : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      <Smartphone className="w-3.5 h-3.5" />
                      <span>갤럭시/안드로이드</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setInstallGuideTab("ios")}
                      className={`flex-1 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                        installGuideTab === "ios" ? "bg-white text-indigo-700 shadow-2xs font-bold" : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      <Smartphone className="w-3.5 h-3.5" />
                      <span>아이폰/아이패드</span>
                    </button>
                  </div>
                </div>

                {/* Tab Guide Details */}
                {installGuideTab === "pc" && (
                  <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 space-y-3 text-xs">
                    <p className="font-bold text-slate-800 flex items-center gap-1.5">
                      <Monitor className="w-4 h-4 text-indigo-600" />
                      컴퓨터 바탕화면에 아이콘 생성하는 방법
                    </p>
                    <ol className="list-decimal list-inside space-y-2 text-slate-600 leading-relaxed font-medium">
                      <li>
                        상단 인터넷 주소창 우측 끝에 있는 <strong>[컴퓨터/설치 💻]</strong> 아이콘을 클릭합니다.
                      </li>
                      <li>
                        또는 브라우저 오른쪽 위 <strong>점 3개(⋮) 메뉴</strong> ➔ <strong>[저장 및 공유]</strong> ➔ <strong>[바로가기 만들기]</strong>(또는 <strong>[앱 설치]</strong>)를 클릭합니다.
                      </li>
                      <li>
                        <strong>[창으로 열기]</strong>에 체크 후 <strong>[만들기/설치]</strong>를 누르면 컴퓨터 바탕화면에 독립 실행형 전용 앱 아이콘이 생성됩니다.
                      </li>
                      <li className="text-indigo-700 font-semibold">
                        이제부터는 바탕화면의 아이콘만 더블클릭하면 구글 로그인 없이 시스템이 바로 열립니다!
                      </li>
                    </ol>
                  </div>
                )}

                {installGuideTab === "android" && (
                  <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 space-y-3 text-xs">
                    <p className="font-bold text-slate-800 flex items-center gap-1.5">
                      <Smartphone className="w-4 h-4 text-indigo-600" />
                      스마트폰(갤럭시/크롬/삼성인터넷) 홈 화면 설치
                    </p>
                    <ol className="list-decimal list-inside space-y-2 text-slate-600 leading-relaxed font-medium">
                      <li>스마트폰 브라우저 우측 상단(또는 우측 하단)의 <strong>점 3개(⋮) 메뉴</strong> 또는 <strong>선 3개(≡)</strong>를 누릅니다.</li>
                      <li>메뉴 목록에서 <strong>[홈 화면에 추가]</strong> 또는 <strong>[앱 설치]</strong>를 터치합니다.</li>
                      <li>이름을 확인 후 <strong>[추가]</strong>를 누르면 스마트폰 앱 목록 및 홈 화면에 바로가기 앱이 설치됩니다.</li>
                    </ol>
                  </div>
                )}

                {installGuideTab === "ios" && (
                  <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 space-y-3 text-xs">
                    <p className="font-bold text-slate-800 flex items-center gap-1.5">
                      <Smartphone className="w-4 h-4 text-indigo-600" />
                      아이폰/아이패드 (Safari 사파리) 홈 화면 설치
                    </p>
                    <ol className="list-decimal list-inside space-y-2 text-slate-600 leading-relaxed font-medium">
                      <li>사파리 브라우저 화면 하단 중앙의 <strong>[공유 버튼 ⎋ (네모 위 화살표)]</strong>를 터치합니다.</li>
                      <li>공유 메뉴를 아래로 스크롤하여 <strong>[홈 화면에 추가]</strong>를 누릅니다.</li>
                      <li>우측 상단 <strong>[추가]</strong>를 누르면 아이폰 바탕화면에 전용 수료증 제출 앱이 등록됩니다.</li>
                    </ol>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowInstallModal(false)}
                  className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl transition-all cursor-pointer"
                >
                  확인 완료
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ──────────────────────────────────────────────
          ZOOMED IMAGE MODAL
          ────────────────────────────────────────────── */}
      <AnimatePresence>
        {zoomedImage && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xs font-sans">
            <div className="relative max-w-4xl w-full max-h-[90vh] bg-white rounded-2xl overflow-hidden shadow-2xl flex flex-col">
              <div className="p-3 bg-slate-800 text-white flex items-center justify-between">
                <span className="text-xs font-bold px-2">수료증 원본 확대 보기</span>
                <button
                  onClick={() => setZoomedImage(null)}
                  className="w-7 h-7 rounded-full bg-slate-700 hover:bg-slate-600 flex items-center justify-center text-white transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-4 flex items-center justify-center overflow-auto bg-slate-100 flex-1">
                {isPdfFile(zoomedImage) ? (
                  <iframe
                    src={zoomedImage}
                    className="w-full h-[70vh] rounded-lg border border-slate-200 bg-white"
                    title="PDF 크게보기"
                  />
                ) : (
                  <img
                    src={zoomedImage}
                    alt="확대 수료증"
                    className="max-h-[75vh] max-w-full object-contain rounded-lg shadow-sm"
                    referrerPolicy="no-referrer"
                  />
                )}
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* ──────────────────────────────────────────────
          GEMINI API KEY SETTING MODAL
          ────────────────────────────────────────────── */}
      <ApiKeyModal
        isOpen={showApiKeyModal}
        onClose={() => {
          setShowApiKeyModal(false);
          setIsApiKeyMandatory(false);
        }}
        currentKey={geminiApiKey}
        onKeySaved={(newKey) => {
          setGeminiApiKey(newKey);
          setIsApiKeyMandatory(false);
        }}
        isMandatory={isApiKeyMandatory && !geminiApiKey}
        onExitToAssistant={() => {
          setShowApiKeyModal(false);
          setIsApiKeyMandatory(false);
          setUserMode("assistant");
        }}
      />

      {/* ──────────────────────────────────────────────
          BATCH AI CERTIFICATE VERIFICATION MODAL
          ────────────────────────────────────────────── */}
      <BatchAiVerificationModal
        isOpen={showBatchAiModal}
        onClose={() => setShowBatchAiModal(false)}
        submissions={submissions}
        apiKey={geminiApiKey}
        onUpdateSubmissions={(updated) => {
          setSubmissions(updated);
        }}
        onOpenApiKeyModal={() => {
          setShowApiKeyModal(true);
          setIsApiKeyMandatory(true);
        }}
      />

      {/* App Footer banner design credits */}
      <footer className="bg-slate-50 border-t border-slate-200/60 py-8 text-center text-xs text-slate-400 font-medium space-y-3 mt-12" id="app-footer">
        <div className="flex justify-center items-center gap-3">
          <span>© 2026 온라인 수료증 제출 시스템. All rights reserved.</span>
          {userMode === "assistant" && (
            <>
              <span className="text-slate-300">|</span>
              <button
                id="btn-switch-to-admin-small"
                onClick={() => {
                  setUserMode("admin");
                  fetchSubmissions();
                  if (isAdminLoggedIn && !geminiApiKey) {
                    setShowApiKeyModal(true);
                    setIsApiKeyMandatory(true);
                  }
                }}
                className="text-slate-400 hover:text-indigo-600 transition-colors underline font-medium cursor-pointer"
              >
                관리
              </button>
            </>
          )}
        </div>
      </footer>

      {/* ──────────────────────────────────────────────
          PRINTER PRINTING SHEET (HIDDEN ON SCREEN, ONLY FOR PRINT)
          ────────────────────────────────────────────── */}
      <div className="hidden print:block font-sans min-h-screen text-slate-900 bg-white" id="printing-sheet">
        <div className={`${printTarget === "ledger" ? "p-8" : "p-0"} w-full block`}>
          {printTarget === "ledger" ? (
            <>
              {/* Header section designed beautifully for printed reports */}
              <div className="text-center pb-6 border-b-2 border-slate-850 mb-6">
                <h1 className="text-2xl font-bold tracking-tight font-sans text-slate-900">장애인활동지원 온라인 교육 수료대장</h1>
                <p className="text-[10px] text-slate-500 mt-1 font-mono">수원시장애인종합복지관 | 출력 일자: {new Date().toLocaleDateString()}</p>
              </div>
              
              {/* Aggregate summary fact blocks printed neat and clean */}
              <div className="grid grid-cols-3 gap-4 border border-slate-350 bg-slate-50 p-4 rounded-lg mb-6 text-xs font-sans">
                <div>
                  <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-0.5">대장 집계 범위</p>
                  <p className="font-extrabold text-slate-800 text-sm">
                    {subFilter === "all" ? "전체 등록자" : subFilter === "completed" ? "이수완료자 명단" : "검토대기자 명단"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-0.5">총 인원 집계</p>
                  <p className="font-extrabold text-slate-850 text-sm">{filteredSubmissions.length} 명</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-0.5">총 누적 인정시간</p>
                  <p className="font-extrabold text-indigo-700 text-sm">
                    {filteredSubmissions
                      .filter((s) => s.isCompleted && s.trainingHours)
                      .reduce((sum, s) => {
                        const num = parseFloat(s.trainingHours.replace(/[^0-9.]/g, ""));
                        return isNaN(num) ? sum : sum + num;
                      }, 0)} 시간
                  </p>
                </div>
              </div>
              
              {/* Elegant printable data table */}
              <table className="w-full text-xs border-collapse border border-slate-350">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-350 text-[10px] font-bold text-slate-800 tracking-wide uppercase">
                    <th className="border border-slate-350 px-2 py-2 text-center w-10 whitespace-nowrap">No</th>
                    <th className="border border-slate-350 px-2.5 py-2 text-left w-[85px] whitespace-nowrap">지원사 성명</th>
                    <th className="border border-slate-350 px-2.5 py-2 text-center w-[90px] whitespace-nowrap">생년월일</th>
                    <th className="border border-slate-350 px-3.5 py-2 text-left">이수 교육과정명</th>
                    <th className="border border-slate-350 px-3 py-2 text-center w-[80px] whitespace-nowrap">인정 시간</th>
                    <th className="border border-slate-350 px-3 py-2 text-center w-[110px] whitespace-nowrap">제출(수합)일자</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSubmissions.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="border border-slate-350 px-3 py-16 text-center text-slate-400 font-sans">
                        출력할 수 있는 내역이 없습니다.
                      </td>
                    </tr>
                  ) : (
                    <>
                      {filteredSubmissions.map((sub, index) => (
                        <tr key={sub.id} className="text-[11px] font-sans hover:bg-slate-50/20 animate-none">
                          <td className="border border-slate-350 px-2 py-1.5 text-center font-mono text-slate-500 whitespace-nowrap">{index + 1}</td>
                          <td className="border border-slate-350 px-2.5 py-1.5 font-bold text-slate-900 text-[11px] whitespace-nowrap">{sub.assistantName}</td>
                          <td className="border border-slate-350 px-2.5 py-1.5 text-center font-mono text-slate-600 whitespace-nowrap">{sub.birthDate}</td>
                          <td className="border border-slate-350 px-3.5 py-1.5 text-slate-800 font-medium text-[11px] leading-normal">{sub.courseName || "확인중"}</td>
                          <td className="border border-slate-350 px-3 py-1.5 text-center font-mono font-bold text-slate-850 whitespace-nowrap">
                            {sub.trainingHours ? (sub.trainingHours.includes("시간") ? sub.trainingHours : `${sub.trainingHours}시간`) : "-"}
                          </td>
                          <td className="border border-slate-350 px-3 py-1.5 text-center font-mono text-slate-500 whitespace-nowrap">
                            {sub.submittedAt ? new Date(sub.submittedAt).toLocaleDateString() : "-"}
                          </td>
                        </tr>
                      ))}
                      
                      {/* Ledger summary totals row */}
                      <tr className="bg-slate-50 font-bold text-xs">
                        <td colSpan={3} className="border border-slate-350 px-3.5 py-2.5 text-center text-slate-700">
                          합계
                        </td>
                        <td className="border border-slate-350 px-3.5 py-2.5 text-left text-slate-600 font-sans text-[10px]">
                          완료 {filteredSubmissions.filter(s => s.isCompleted).length}건 / 대기 {filteredSubmissions.filter(s => !s.isCompleted).length}건
                        </td>
                        <td className="border border-slate-350 px-3 py-2.5 text-center text-indigo-700 font-extrabold text-sm font-mono whitespace-nowrap">
                          {filteredSubmissions
                            .filter((s) => s.isCompleted && s.trainingHours)
                            .reduce((sum, s) => {
                              const num = parseFloat(s.trainingHours.replace(/[^0-9.]/g, ""));
                              return isNaN(num) ? sum : sum + num;
                            }, 0)}시간
                        </td>
                        <td className="border border-slate-350 px-3 py-2.5 bg-slate-50"></td>
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
              
              {/* Footer part */}
              <div className="mt-12 text-center text-xs font-semibold text-slate-400 font-sans border-t border-slate-100 pt-6">
                수원시장애인종합복지관
              </div>
            </>
          ) : (
            <>
              {filteredSubmissions.length === 0 ? (
                <div className="text-center py-20 text-slate-400 font-sans border border-slate-200 rounded-lg">
                  출력할 수 있는 증빙 문서가 없습니다.
                </div>
              ) : (
                <div className="space-y-0">
                  {filteredSubmissions.map((sub) => (
                    <div 
                      key={sub.id} 
                      className="w-full h-screen block break-after-page page-break-after-always flex items-center justify-center p-0 bg-white"
                      style={{ pageBreakAfter: "always", breakAfter: "page" }}
                    >
                      {sub.certificateImage ? (
                        isPdfFile(sub.certificateImage) ? (
                          <div className="text-center py-32 font-sans text-slate-400 text-sm">
                            <FileText className="w-16 h-16 text-slate-300 mx-auto mb-3" />
                            PDF 형식의 수료증 문서입니다. (활동지원사: {sub.assistantName})<br/>
                            (브라우저 인쇄 설정에서 무늬/배경 이미지 출력을 체크해 주십시오.)
                          </div>
                        ) : (
                          <img
                            src={sub.certificateImage}
                            alt={`${sub.assistantName} 교육 수료증`}
                            className="max-h-screen object-contain max-w-full m-auto"
                            referrerPolicy="no-referrer"
                          />
                        )
                      ) : (
                        <div className="text-slate-350 italic font-sans py-24 text-sm text-center">
                          수료증 파일 원본이 존재하지 않습니다. (활동지원사: {sub.assistantName})
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

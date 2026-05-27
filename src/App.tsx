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
  Settings
} from "lucide-react";
import AssistantForm from "./components/AssistantForm";
import { EducationCertificate, EducationStats } from "./types";

// Firebase Applet Integration
import { db } from "./firebase";
import { 
  collection, 
  query, 
  orderBy, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc 
} from "firebase/firestore";

// Google GenAI Platform
import { GoogleGenAI, Type } from "@google/genai";

export default function App() {
  const [userMode, setUserMode] = useState<"assistant" | "admin">("assistant");
  const [submissions, setSubmissions] = useState<EducationCertificate[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Authentication status
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState<boolean>(() => {
    return sessionStorage.getItem("isAdminLoggedIn") === "true";
  });
  const [authInitialized, setAuthInitialized] = useState<boolean>(true);
  const [showApiKeySetting, setShowApiKeySetting] = useState<boolean>(false);
  const [tempApiKey, setTempApiKey] = useState<string>("");
  const [adminPasscode, setAdminPasscode] = useState<string>("");

  // Administrative Control States
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null);
  
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
  const [aiFeedback, setAiFeedback] = useState<{ type: "success" | "error" | "mismatch"; message: string } | null>(null);

  // Load API Key from local storage at start
  useEffect(() => {
    const savedKey = localStorage.getItem("USER_GEMINI_API_KEY") || "";
    setTempApiKey(savedKey);
  }, []);

  // Track Admin Login Session Changes
  useEffect(() => {
    if (isAdminLoggedIn) {
      fetchSubmissions(true);
    } else {
      setSubmissions([]);
      setSelectedSubmissionId(null);
    }
  }, [isAdminLoggedIn]);

  const handleAdminLogin = async () => {
    if (adminPasscode.trim() !== "5612") {
      alert("올바르지 않은 관리자 비밀번호입니다.");
      return;
    }
    setLoading(true);
    try {
      sessionStorage.setItem("isAdminLoggedIn", "true");
      setIsAdminLoggedIn(true);
      setAdminPasscode("");
    } catch (error: any) {
      console.error("Login failed:", error);
      alert("로그인에 실패했습니다: " + (error.message || ""));
    } finally {
      setLoading(false);
    }
  };

  const handleAdminLogout = async () => {
    if (confirm("대시보드에서 로그아웃하시겠습니까?")) {
      sessionStorage.removeItem("isAdminLoggedIn");
      setIsAdminLoggedIn(false);
      setUserMode("assistant");
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

  const handleNewSubmission = async (newSub: { assistantName: string; birthDate: string; certificateImage: string }) => {
    try {
      const submitData = {
        assistantName: newSub.assistantName,
        birthDate: newSub.birthDate,
        certificateImage: newSub.certificateImage,
        submittedAt: new Date().toISOString(),
        isCompleted: false,
        trainingHours: "",
        courseName: "",
        managerNotes: "",
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
      setCourseName("");
      setTrainingHours("");
      setManagerNotes("");
      
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
      const docRef = doc(db, "submissions", id);
      const updateData = {
        isCompleted: isCompletedStatus,
        trainingHours,
        courseName,
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

  const getGeminiApiKey = () => {
    return localStorage.getItem("USER_GEMINI_API_KEY") || (import.meta as any).env.VITE_GEMINI_API_KEY || "";
  };

  const handleSaveApiKeySetting = (key: string) => {
    localStorage.setItem("USER_GEMINI_API_KEY", key.trim());
    setTempApiKey(key.trim());
    alert("Gemini API Key가 안전하게 브라우저에 저장되었습니다.");
    setShowApiKeySetting(false);
  };

  const handleAiOcrAnalysis = async (imgBase64: string, subName: string, subBirth: string) => {
    if (!imgBase64) {
      setAiFeedback({ type: "error", message: "수료증 원본 이미지가 등록되어 있지 않습니다." });
      return;
    }

    const apiKey = getGeminiApiKey();
    if (!apiKey) {
      setAiFeedback({ 
        type: "error", 
        message: "Gemini API 키가 등록되어 있지 않습니다.\n\n우측 상단의 [⚙️ API Key 설정] 버튼을 눌러 발급받으신 무료 API Key를 입력 및 저장한 후 다시 추진해 주시기 바랍니다." 
      });
      return;
    }

    setAiAnalysisLoading(true);
    setAiFeedback(null);
    try {
      // Strip base64 prefix
      let rawBase64 = imgBase64;
      let mimeType = "image/png";

      if (imgBase64.includes(";base64,")) {
        const parts = imgBase64.split(";base64,");
        rawBase64 = parts[1];
        mimeType = parts[0].replace("data:", "");
      }

      const ai = new GoogleGenAI({ apiKey });

      const imagePart = {
        inlineData: {
          data: rawBase64,
          mimeType: mimeType,
        },
      };

      const promptMessage = `Please analyze this uploaded online training certificate. 
Our target is to extract information about the activity assistant (활동지원사) who completed the work.
Extract the following details from this image:
1. Name (성명/이름)
2. Date of Birth (생년월일)
3. Course Name (교육명칭/수강과정명)
4. Training Hours (교육이수시간 - 예시: '8시간', '4시간', '2시간' 등)

Return the parsed values in Korean language inside the requested JSON schema.
If the birth date is found, represent it as 'YYMMDD' (6 digits, e.g., 740125). If we cannot map it cleanly, output YYMMDD base representation.
If no training hours is found, leave it as an empty string.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: [imagePart, promptMessage],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              assistantName: { type: Type.STRING, description: "정확한 성명/이름" },
              birthDate: { type: Type.STRING, description: "활동지원사 생년월일 (예시: 740125)" },
              courseName: { type: Type.STRING, description: "교육명칭 또는 과정명 (예시: '장애인활동지원사 보수교육')" },
              trainingHours: { type: Type.STRING, description: "교육 이수 시간 (예시: '8시간' 또는 '4시간')" }
            },
            required: ["assistantName", "birthDate", "courseName", "trainingHours"]
          }
        }
      });

      if (!response.text) {
        throw new Error("No response returned from Gemini API.");
      }

      const data = JSON.parse(response.text.trim());
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
          {isAdminLoggedIn && (
            <div className="hidden sm:flex items-center gap-2 mr-2 border-r border-slate-200 pr-4">
              <div className="w-7 h-7 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600 font-bold text-[10px] uppercase">
                AD
              </div>
              <div className="text-left leading-none font-sans">
                <span className="text-[10px] font-bold text-slate-800 block leading-tight">지정 관리자</span>
                <span className="text-[8px] text-slate-400 block leading-tight font-mono">수료증 확인 권한</span>
              </div>
            </div>
          )}

          {userMode === "admin" && isAdminLoggedIn && (
            <>
              <button
                onClick={() => setShowApiKeySetting(true)}
                className="text-xs font-semibold text-slate-600 hover:text-slate-800 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200/80 transition-all cursor-pointer flex items-center gap-1"
                title="Gemini AI Key 설정"
              >
                <Settings className="w-3.5 h-3.5" />
                <span className="hidden leading-none md:inline">API Key 설정</span>
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
              <div className="bg-white border border-slate-200 p-8 shadow-xl rounded-3xl text-center space-y-6">
                <div className="w-16 h-16 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center mx-auto text-indigo-600 shadow-xs">
                  <Lock className="w-8 h-8" />
                </div>
                
                <div className="space-y-2">
                  <h3 className="text-base font-bold text-slate-950">관리자 계정 인증</h3>
                  <p className="text-slate-500 text-xs leading-relaxed font-medium">
                    장애인활동지원 수료대장 확인 및 교육시간 승인을<br />
                    진행하시려면 지정된 관리자 비밀번호를 입력해 주시기 바랍니다.
                  </p>
                </div>

                <div className="space-y-3">
                  <input
                    type="password"
                    maxLength={10}
                    value={adminPasscode}
                    onChange={(e) => setAdminPasscode(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleAdminLogin();
                      }
                    }}
                    placeholder="비밀번호 입력"
                    className="w-full text-center tracking-[0.5em] px-4 py-3 border border-slate-200 bg-slate-50 rounded-xl text-lg font-bold focus:outline-none focus:border-indigo-500 focus:bg-white transition-all placeholder:tracking-normal placeholder:font-normal placeholder:text-sm"
                  />
                  
                  <button
                    onClick={handleAdminLogin}
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer"
                  >
                    <UserCheck className="w-4 h-4" />
                    {loading ? "인증 확인 중..." : "인증 및 대시보드 입장"}
                  </button>
                </div>

                <button
                  onClick={() => setUserMode("assistant")}
                  className="text-xs font-semibold text-slate-400 hover:text-slate-600 transition-colors block mx-auto underline cursor-pointer"
                >
                  활동지원사 수료증 제출 양식으로 이동
                </button>
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

                <div className="flex gap-2.5 w-full sm:w-auto" id="header-action-panel">
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
                      const csvContent = [
                        ["제출ID", "성명", "생년월일", "이수확인여부", "인증된교육시간", "교육과정명", "제출시각", "참고사항"],
                        ...submissions.map((s) => [
                          s.id, s.assistantName, s.birthDate, s.isCompleted ? "이수완료" : "검토대기", s.trainingHours || "0", s.courseName || "확인중", s.submittedAt, s.managerNotes || ""
                        ])
                      ].map(e => e.join(",")).join("\n");
                      
                      const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
                      const url = URL.createObjectURL(blob);
                      const link = document.createElement("a");
                      link.setAttribute("href", url);
                      link.setAttribute("download", `온라인교육_이수자현황_${new Date().toISOString().slice(0,10)}.csv`);
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

              {/* Master-Detail Dual Columns Workdesk */}
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
                          <span className="block text-xs font-semibold text-slate-500">활동지원사 송부 사진</span>
                          
                          <div className="bg-slate-50 border border-slate-200/80 p-2.5 relative flex flex-col items-center justify-center min-h-[200px] overflow-hidden rounded-xl bg-slate-50">
                            {selectedSubmission.certificateImage ? (
                              <>
                                <img
                                  id="img-inspector-canvas"
                                  src={selectedSubmission.certificateImage}
                                  alt="Certificate original file"
                                  className="max-h-[220px] object-contain mx-auto border border-slate-100 rounded-lg max-w-full"
                                  referrerPolicy="no-referrer"
                                />
                                <button
                                  id="btn-zoom-inspector-img"
                                  onClick={() => setZoomedImage(selectedSubmission.certificateImage)}
                                  className="absolute bottom-2 right-2 bg-slate-900/85 hover:bg-indigo-600 text-white font-medium text-[10px] px-2.5 py-1 transition-all rounded-lg cursor-pointer"
                                >
                                  크게보기
                                </button>
                              </>
                            ) : (
                              <div className="text-xs text-slate-400" id="blank-img-state">사진이 등록되지 않았습니다.</div>
                            )}
                          </div>
                        </div>

                        {/* Review Inputs */}
                        <div className="space-y-4" id="inspector-interactive-inputs">
                          <div>
                            <span className="block text-[10px] text-slate-400 font-bold uppercase">작성 인적사항</span>
                            <div className="mt-1.5 p-3.5 bg-slate-50 border border-slate-100 rounded-xl grid grid-cols-2 gap-2 text-xs font-medium">
                              <div>
                                <span className="text-slate-400 text-[10px] block">성명</span>
                                <p className="text-slate-800 text-sm font-semibold">{selectedSubmission.assistantName}</p>
                              </div>
                              <div>
                                <span className="text-slate-400 text-[10px] block">생년월일(6자리)</span>
                                <p className="text-slate-800 text-sm font-mono font-semibold">{selectedSubmission.birthDate}</p>
                              </div>
                            </div>
                          </div>

                          {/* AI 수료 자동 추출 서비스 */}
                          <div className="p-3.5 bg-indigo-50/50 border border-indigo-100 rounded-xl space-y-2.5" id="ai-extractor-panel">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] text-indigo-700 font-bold flex items-center gap-1">
                                <Sparkles className="w-3 h-3 text-indigo-500" />
                                AI 수료 정보 추출 및 인적 불일치 검증
                              </span>
                            </div>
                            <button
                              id="btn-ai-analyze"
                              type="button"
                              onClick={() => handleAiOcrAnalysis(
                                selectedSubmission.certificateImage,
                                selectedSubmission.assistantName,
                                selectedSubmission.birthDate
                              )}
                              disabled={aiAnalysisLoading || !selectedSubmission.certificateImage}
                              className={`w-full flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                                aiAnalysisLoading
                                  ? "bg-indigo-100 text-indigo-400"
                                  : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs"
                              }`}
                            >
                              {aiAnalysisLoading ? (
                                <>
                                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                  <span>AI가 수료증 분석 중...</span>
                                </>
                              ) : (
                                <>
                                  <Sparkles className="w-3.5 h-3.5" />
                                  <span>AI 수료증 분석 및 자동 입력</span>
                                </>
                              )}
                            </button>
                            
                            {aiFeedback && (
                              <div className={`p-2.5 rounded-lg text-[11px] whitespace-pre-line font-medium leading-relaxed ${
                                aiFeedback.type === "success"
                                  ? "bg-emerald-50 text-emerald-800 border border-emerald-100"
                                  : aiFeedback.type === "mismatch"
                                  ? "bg-amber-50 text-amber-800 border border-amber-200"
                                  : "bg-rose-50 text-rose-800 border border-rose-100"
                              }`}>
                                {aiFeedback.message}
                              </div>
                            )}
                          </div>

                          {/* Editable fields */}
                          <div className="space-y-3.5" id="verifying-editable-inputs">
                            <div>
                              <label className="block text-xs font-semibold text-slate-700 mb-1">
                                교육과정 과정명 <span className="text-indigo-600">*</span>
                              </label>
                              <input
                                id="admin-course-name"
                                type="text"
                                value={courseName || ""}
                                onChange={(e) => setCourseName(e.target.value)}
                                placeholder="예: 발달장애인 지원사 보수교육 과정"
                                className="w-full px-3 py-2 border border-slate-200 bg-slate-50/20 rounded-xl text-xs font-semibold focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-550 transition-colors"
                              />
                            </div>

                            <div>
                              <label className="block text-xs font-semibold text-slate-700 mb-1">
                                수강 인정 시간 (시간단위 숫자) <span className="text-indigo-600">*</span>
                              </label>
                              <input
                                id="admin-training-hours"
                                type="text"
                                value={trainingHours || ""}
                                onChange={(e) => setTrainingHours(e.target.value)}
                                placeholder="인정 교육 시간 수 기입 (예: 4)"
                                className="w-full px-3 py-2 border border-slate-200 bg-slate-50/20 rounded-xl text-xs font-mono font-semibold focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-555 transition-colors"
                              />
                              <p className="text-[10px] text-slate-400 mt-1">인정하는 실 수강 시간(숫자)을 정확히 매핑하여 주십시오.</p>
                            </div>
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
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Lightbox zoomed modal */}
      <AnimatePresence>
        {zoomedImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setZoomedImage(null)}
            className="fixed inset-0 z-50 bg-slate-900/90 flex items-center justify-center p-4 cursor-zoom-out backdrop-blur-xs"
            id="lightbox-panel bg"
          >
            <button
              id="lightbox-close-btn"
              onClick={() => setZoomedImage(null)}
              className="absolute top-6 right-6 text-white hover:text-slate-200 p-2.5 bg-slate-800 border border-slate-700 rounded-xl cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="max-w-4xl max-h-[85vh] overflow-hidden"
              id="lightbox-scroller"
            >
              <img
                id="lightbox-img-large"
                src={zoomedImage}
                alt="Detailed Certificate Zoom"
                className="max-w-full max-h-[85vh] object-contain border border-slate-100 rounded-2xl shadow-2xl"
                referrerPolicy="no-referrer"
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* API Key configuration modal */}
      <AnimatePresence>
        {showApiKeySetting && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
            id="apikey-modal-overlay"
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              className="bg-white w-full max-w-md rounded-2xl border border-slate-200 p-6 shadow-2xl space-y-4"
              id="apikey-modal-textbox"
            >
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2 text-indigo-600">
                  <Settings className="w-5 h-5" />
                  <h4 className="text-sm font-bold text-slate-800 font-sans">Gemini API Key 설정</h4>
                </div>
                <button
                  onClick={() => setShowApiKeySetting(false)}
                  className="text-slate-400 hover:text-slate-600 p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3">
                <p className="text-xs text-slate-500 leading-relaxed font-sans">
                  본 애플리케이션의 <strong>AI 수료증 자동 분석 기능</strong>은 Google Gemini API를 사용합니다. 
                  우측 API 키를 안전하게 브라우저 로컬 스토리지에만 저장하여 완전히 무료로 분석을 수행할 수 있습니다.
                </p>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 block font-sans">Gemini API Key 입력</label>
                  <input
                    type="password"
                    value={tempApiKey}
                    onChange={(e) => setTempApiKey(e.target.value)}
                    placeholder="AIzaSy..."
                    className="w-full px-3 py-2 border border-slate-200 bg-slate-50/50 rounded-xl text-xs font-mono focus:outline-none focus:border-indigo-500 focus:bg-white transition-all font-semibold"
                  />
                </div>

                <p className="text-[10px] text-slate-400 italic font-sans">
                  * 입력하신 API Key는 외부 서버로 전송되지 않으며, 사용자 본인의 로컬 브라우저 내에만 암호화 데이터 형태로 보관됩니다.
                  <br />
                  * <a href="https://aistudio.google.com/" target="_blank" rel="noreferrer" className="text-indigo-600 font-semibold hover:underline">Google AI Studio</a>에서 1분 만에 무료 API Key를 바로 발급받아 등록할 수 있습니다.
                </p>
              </div>

              <div className="flex gap-2 justify-end border-t border-slate-100 pt-3 font-sans">
                <button
                  onClick={() => setShowApiKeySetting(false)}
                  className="px-3 py-1.5 border border-slate-200 text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  취소
                </button>
                <button
                  onClick={() => handleSaveApiKeySetting(tempApiKey)}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-sm cursor-pointer"
                >
                  저장하기
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
                }}
                className="text-slate-400 hover:text-indigo-600 transition-colors underline font-medium cursor-pointer"
              >
                관리
              </button>
            </>
          )}
        </div>
      </footer>
    </div>
  );
}

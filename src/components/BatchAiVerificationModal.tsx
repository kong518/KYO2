/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Sparkles, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Loader2, 
  X, 
  Award, 
  BookOpen, 
  Building2,
  Calendar,
  Layers,
  ChevronRight,
  ShieldCheck
} from "lucide-react";
import { EducationCertificate } from "../types";
import { analyzeCertificateWithGemini } from "../services/aiVerification";
import { db } from "../firebase";
import { doc, updateDoc } from "firebase/firestore";

interface BatchAiVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  submissions: EducationCertificate[];
  apiKey: string;
  onUpdateSubmissions: (updated: EducationCertificate[]) => void;
  onOpenApiKeyModal: () => void;
}

interface VerificationLogItem {
  id: string;
  assistantName: string;
  success: boolean;
  courseName?: string;
  trainingHours?: string;
  institution?: string;
  completionDate?: string;
  summary?: string;
  error?: string;
}

export default function BatchAiVerificationModal({
  isOpen,
  onClose,
  submissions,
  apiKey,
  onUpdateSubmissions,
  onOpenApiKeyModal,
}: BatchAiVerificationModalProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [hasCompleted, setHasCompleted] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentTargetName, setCurrentTargetName] = useState("");
  const [logs, setLogs] = useState<VerificationLogItem[]>([]);
  const [targetMode, setTargetMode] = useState<"pending" | "all">("pending");
  const [stopRequested, setStopRequested] = useState(false);

  // Filter pending items
  const pendingItems = submissions.filter((s) => !s.isCompleted || !s.courseName || !s.trainingHours);
  const targetItems = targetMode === "pending" ? pendingItems : submissions;

  useEffect(() => {
    if (isOpen) {
      setHasCompleted(false);
      setIsRunning(false);
      setLogs([]);
      setCurrentIndex(0);
      setCurrentTargetName("");
      setStopRequested(false);
      // If no pending items, default to all
      if (pendingItems.length === 0 && submissions.length > 0) {
        setTargetMode("all");
      } else {
        setTargetMode("pending");
      }
    }
  }, [isOpen, submissions.length]);

  if (!isOpen) return null;

  const startBatchVerification = async () => {
    if (!apiKey) {
      onOpenApiKeyModal();
      return;
    }

    if (targetItems.length === 0) {
      alert("분석할 수료증 대상이 없습니다.");
      return;
    }

    setIsRunning(true);
    setHasCompleted(false);
    setStopRequested(false);
    setLogs([]);

    const updatedSubmissions = [...submissions];
    let processedCount = 0;

    for (let i = 0; i < targetItems.length; i++) {
      if (stopRequested) break;

      const item = targetItems[i];
      setCurrentIndex(i + 1);
      setCurrentTargetName(item.assistantName);

      // Perform AI Analysis
      const result = await analyzeCertificateWithGemini(item.certificateImage, apiKey);

      const logItem: VerificationLogItem = {
        id: item.id,
        assistantName: item.assistantName,
        success: result.success,
        courseName: result.courseName,
        trainingHours: result.trainingHours,
        institution: result.institution,
        completionDate: result.completionDate,
        summary: result.summary,
        error: result.error,
      };

      setLogs((prev) => [logItem, ...prev]);

      if (result.success) {
        // Save to Firestore
        try {
          const docRef = doc(db, "submissions", item.id);
          const updates = {
            courseName: result.courseName || item.courseName || "장애인활동지원사 교육",
            trainingHours: result.trainingHours || item.trainingHours || "8시간",
            institution: result.institution || item.institution || "",
            completionDate: result.completionDate || item.completionDate || "",
            certNumber: result.certNumber || item.certNumber || "",
            managerNotes: result.summary || "AI 판독 완료",
            isCompleted: true,
            aiVerified: true,
            reviewedAt: new Date().toISOString(),
          };

          await updateDoc(docRef, updates);

          // Update in local state array
          const subIdx = updatedSubmissions.findIndex((s) => s.id === item.id);
          if (subIdx !== -1) {
            updatedSubmissions[subIdx] = {
              ...updatedSubmissions[subIdx],
              ...updates,
            };
          }
        } catch (dbErr) {
          console.error("Firestore update failed during batch AI:", dbErr);
        }
      }

      processedCount++;
      // Brief pause to allow UI update & respect rate limits
      await new Promise((res) => setTimeout(res, 250));
    }

    onUpdateSubmissions(updatedSubmissions);
    setIsRunning(false);
    setHasCompleted(true);
  };

  const totalTargetCount = targetItems.length;
  const progressPercent = totalTargetCount > 0 ? Math.round((currentIndex / totalTargetCount) * 100) : 0;
  const successCount = logs.filter((l) => l.success).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs font-sans">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-2xl w-full overflow-hidden flex flex-col max-h-[85vh]"
        id="batch-ai-verification-modal"
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-gradient-to-r from-indigo-50/80 to-purple-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-100">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span>수료증 AI 일괄 확인 및 자동 목록화</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-extrabold">
                  Gemini 3.8 Flash
                </span>
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                AI가 수료증 원본(사진/PDF)을 정밀 분석하여 과정명, 인정시간, 기관을 대장에 자동 입력합니다.
              </p>
            </div>
          </div>

          {!isRunning && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Content Area */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* Target Selection & Status (When not yet running or completed) */}
          {!isRunning && !hasCompleted && (
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-3">
                <span className="text-[11px] font-bold text-slate-700 block">
                  분석 대상 선택
                </span>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setTargetMode("pending")}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      targetMode === "pending"
                        ? "bg-indigo-50/70 border-indigo-300 ring-2 ring-indigo-500/20 text-indigo-950 font-bold"
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-100/50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs">미확인 수료증만</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-800 font-bold">
                        {pendingItems.length}건
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1 font-normal">
                      아직 승인되지 않았거나 과정명이 비어있는 건
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTargetMode("all")}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      targetMode === "all"
                        ? "bg-indigo-50/70 border-indigo-300 ring-2 ring-indigo-500/20 text-indigo-950 font-bold"
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-100/50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs">전체 수료증 재분석</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-slate-200 text-slate-700 font-bold">
                        {submissions.length}건
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1 font-normal">
                      이미 완료된 건을 포함한 전체 수료증 갱신
                    </p>
                  </button>
                </div>
              </div>

              {/* Notice Card */}
              <div className="p-4 bg-indigo-50/40 border border-indigo-100/80 rounded-2xl text-xs space-y-2">
                <div className="font-bold text-indigo-900 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-indigo-600" />
                  <span>AI 자동 분석 작동 방식</span>
                </div>
                <ul className="text-[11px] text-slate-600 space-y-1 list-disc list-inside leading-relaxed pl-1">
                  <li>각 수료증 원본 이미지/PDF를 Gemini 모델로 판독합니다.</li>
                  <li><strong>교육과정명, 인정 교육시간(시간), 발급기관, 이수일자</strong>를 자동 추출합니다.</li>
                  <li>추출된 즉시 Firestore에 저장되며, <strong>[교육 수강 완료 확인]</strong> 상태로 전환됩니다.</li>
                </ul>
              </div>
            </div>
          )}

          {/* Running Progress Bar & Target */}
          {isRunning && (
            <div className="space-y-4 p-5 bg-indigo-50/30 border border-indigo-100 rounded-2xl">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-indigo-900 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                  <span>
                    수료증 분석 중: <strong>{currentTargetName}</strong> 활동지원사
                  </span>
                </span>
                <span className="font-mono font-bold text-indigo-600 text-sm">
                  {currentIndex} / {totalTargetCount} ({progressPercent}%)
                </span>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                <motion.div
                  className="bg-indigo-600 h-full rounded-full transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              <div className="flex justify-between items-center text-[11px] text-slate-500 pt-1">
                <span>진행 상황 실시간 기록 중...</span>
                <button
                  type="button"
                  onClick={() => setStopRequested(true)}
                  className="text-rose-600 hover:text-rose-800 font-semibold hover:underline cursor-pointer"
                >
                  중단하기
                </button>
              </div>
            </div>
          )}

          {/* Completed Banner */}
          {hasCompleted && (
            <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-2xl text-center space-y-2">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-xs">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h4 className="text-sm font-bold text-emerald-950">
                수료증 AI 일괄 분석 및 목록화 완료!
              </h4>
              <p className="text-xs text-emerald-800 leading-relaxed font-medium">
                총 <strong>{logs.length}</strong>건 중 <strong>{successCount}</strong>건의 수료증 데이터가
                대장에 성공적으로 자동 입력되었습니다.
              </p>
            </div>
          )}

          {/* Results Live Log */}
          {logs.length > 0 && (
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-[11px] font-bold text-slate-700">
                  분석 및 등록 결과 ({logs.length}건)
                </span>
                <span className="text-[10px] text-emerald-600 font-semibold">
                  성공 {successCount}건
                </span>
              </div>

              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {logs.map((log) => (
                  <div
                    key={log.id}
                    className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 ${
                      log.success
                        ? "bg-white border-slate-200/90 shadow-2xs"
                        : "bg-rose-50/60 border-rose-200"
                    }`}
                  >
                    {log.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    )}

                    <div className="flex-1 space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-slate-900">
                          {log.assistantName}
                        </span>
                        {log.trainingHours && (
                          <span className="font-mono font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md text-[10px]">
                            {log.trainingHours}
                          </span>
                        )}
                      </div>

                      {log.success ? (
                        <>
                          <p className="text-[11px] text-slate-700 font-medium">
                            {log.courseName}
                          </p>
                          <div className="flex flex-wrap gap-2 text-[10px] text-slate-400">
                            {log.institution && <span>발급처: {log.institution}</span>}
                            {log.completionDate && <span>이수일: {log.completionDate}</span>}
                          </div>
                        </>
                      ) : (
                        <p className="text-[11px] text-rose-700">{log.error}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-between items-center">
          <button
            type="button"
            onClick={onClose}
            disabled={isRunning}
            className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-semibold rounded-xl text-xs cursor-pointer disabled:opacity-50"
          >
            {hasCompleted ? "닫기" : "취소"}
          </button>

          {!hasCompleted ? (
            <button
              type="button"
              onClick={startBatchVerification}
              disabled={isRunning || targetItems.length === 0}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-bold rounded-xl flex items-center gap-2 shadow-md shadow-indigo-100 cursor-pointer text-xs"
            >
              {isRunning ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>일괄 분석 처리 중...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>{targetItems.length}건 AI 일괄 확인 시작</span>
                </>
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl flex items-center gap-1.5 shadow-md shadow-indigo-100 cursor-pointer text-xs"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>완료 및 수료대장 확인하기</span>
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}

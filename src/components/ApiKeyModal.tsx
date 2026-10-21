/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { motion } from "motion/react";
import { 
  Key, 
  ExternalLink, 
  Eye, 
  EyeOff, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  ShieldCheck, 
  Sparkles,
  ArrowRight
} from "lucide-react";
import { saveStoredGeminiApiKey, removeStoredGeminiApiKey } from "../firebase";

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentKey: string;
  onKeySaved: (newKey: string) => void;
  isMandatory?: boolean; // If true, user must enter key or exit to assistant view
  onExitToAssistant?: () => void;
}

export default function ApiKeyModal({
  isOpen,
  onClose,
  currentKey,
  onKeySaved,
  isMandatory = false,
  onExitToAssistant,
}: ApiKeyModalProps) {
  const [apiKeyInput, setApiKeyInput] = useState(currentKey || "");
  const [showKey, setShowKey] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const trimmed = apiKeyInput.trim();
    if (!trimmed) {
      setErrorMsg("Google Gemini API 키를 입력해 주세요.");
      return;
    }

    if (trimmed.length < 15) {
      setErrorMsg("입력하신 키의 길이가 너무 짧습니다. 올바른 Gemini API 키를 입력해 주세요.");
      return;
    }

    setIsSaving(true);
    try {
      await saveStoredGeminiApiKey(trimmed);
      setSuccessMsg("Gemini API 키가 안전하게 저장되었습니다!");
      onKeySaved(trimmed);
      setTimeout(() => {
        setIsSaving(false);
        onClose();
      }, 700);
    } catch (err: any) {
      setIsSaving(false);
      setErrorMsg(err.message || "API 키 저장 중 오류가 발생했습니다.");
    }
  };

  const handleClear = async () => {
    if (window.confirm("설정된 Gemini API 키를 삭제하시겠습니까?")) {
      await removeStoredGeminiApiKey();
      setApiKeyInput("");
      onKeySaved("");
      setSuccessMsg("API 키가 삭제되었습니다.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs font-sans">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden"
        id="api-key-setup-modal"
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-xs">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Google Gemini API 키 설정
              </h3>
              <p className="text-[11px] text-slate-500">
                수료증 AI 일괄 분석 및 대장 자동 입력을 위한 필수 설정
              </p>
            </div>
          </div>

          {!isMandatory && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Body Content */}
        <div className="p-6 space-y-5 text-xs">
          {/* Guide Card with Direct Link */}
          <div className="p-4 bg-indigo-50/60 border border-indigo-100 rounded-2xl space-y-3">
            <div className="flex items-center gap-2 text-indigo-900 font-bold text-xs">
              <Sparkles className="w-4 h-4 text-indigo-600 shrink-0" />
              <span>Gemini API 키 무료 발급 안내</span>
            </div>

            <ol className="space-y-2 text-slate-600 text-[11px] leading-relaxed list-decimal list-inside pl-1">
              <li>
                아래 파란색 버튼을 눌러 <strong>Google AI Studio</strong> 페이지로 이동합니다.
              </li>
              <li>
                구글 계정으로 로그인 후 <strong>[+ Create API key]</strong> 버튼을 클릭하여 새 키를 생성합니다.
              </li>
              <li>
                발급받은 키(<code>AIzaSy...</code>)를 복사한 후 아래 입력란에 붙여넣습니다.
              </li>
            </ol>

            {/* Direct Link Button */}
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer group"
            >
              <span>Google AI Studio에서 무료 API 키 발급받기</span>
              <ExternalLink className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </a>
          </div>

          {/* Messages */}
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-semibold flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-semibold flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="font-bold text-slate-700 text-[11px]">
                  Google Gemini API 키 입력
                </label>
                {currentKey && (
                  <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> 연동된 키 보관 중
                  </span>
                )}
              </div>

              <div className="relative">
                <input
                  type={showKey ? "text" : "password"}
                  value={apiKeyInput}
                  onChange={(e) => {
                    setApiKeyInput(e.target.value);
                    setErrorMsg(null);
                  }}
                  placeholder="AIzaSy로 시작하는 키를 입력하세요"
                  className="w-full pr-10 pl-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs text-slate-800 focus:bg-white focus:outline-none focus:border-indigo-500 transition-colors shadow-2xs"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                  title={showKey ? "키 가리기" : "키 보기"}
                >
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[10px] text-slate-400 mt-1.5">
                입력된 키는 브라우저 및 관리 시스템에 안전하게 저장되며, 수료증 자동 OCR 판독에만 사용됩니다.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              {currentKey ? (
                <button
                  type="button"
                  onClick={handleClear}
                  className="text-[11px] text-rose-600 hover:text-rose-800 font-semibold hover:underline cursor-pointer"
                >
                  키 초기화
                </button>
              ) : (
                <div />
              )}

              <div className="flex items-center gap-2">
                {isMandatory && onExitToAssistant && (
                  <button
                    type="button"
                    onClick={onExitToAssistant}
                    className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl cursor-pointer text-xs"
                  >
                    제출 화면으로 나가기
                  </button>
                )}

                {!isMandatory && (
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl cursor-pointer text-xs"
                  >
                    닫기
                  </button>
                )}

                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-bold rounded-xl flex items-center gap-1.5 shadow-md shadow-indigo-100 cursor-pointer text-xs"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>{isSaving ? "저장 중..." : "저장 및 관리자 입장"}</span>
                </button>
              </div>
            </div>
          </form>
        </div>
      </motion.div>
    </div>
  );
}

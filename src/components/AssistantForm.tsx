/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { motion } from 'motion/react';
import { 
  Upload, User, Calendar, CheckCircle2, AlertCircle, 
  Sparkles, ShieldCheck, Loader2, RefreshCw, X, Eye
} from 'lucide-react';

interface AssistantFormProps {
  onNewSubmission: (submission: { assistantName: string; birthDate: string; certificateImage: string }) => Promise<boolean>;
}

export default function AssistantForm({ onNewSubmission }: AssistantFormProps) {
  // Submit Form States
  const [assistantName, setAssistantName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  // OCR processing state
  const [isOcrProcessing, setIsOcrProcessing] = useState(false);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [ocrSuccess, setOcrSuccess] = useState(false);
  
  // Submit control states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Raw file to base64 converter
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const processFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('이미지 파일(PNG, JPG, JPEG)만 업로드할 수 있습니다.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64String = event.target?.result as string;
      setImagePreview(base64String);
      setOcrSuccess(false);
      setOcrError(null);
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  // Triggers Gemini OCR over the uploaded certificate image to auto-fill Name & Birthdate
  const triggerAiOcr = async () => {
    if (!imagePreview) return;
    
    setIsOcrProcessing(true);
    setOcrError(null);
    setOcrSuccess(false);

    try {
      const response = await fetch('/api/submissions/ocr', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ imageBase64: imagePreview }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Gemini 분석 중 오류 발생');
      }

      // Fill Name & Birthdate only
      if (data.assistantName) setAssistantName(data.assistantName);
      if (data.birthDate) setBirthDate(data.birthDate);

      setOcrSuccess(true);
      setTimeout(() => setOcrSuccess(false), 4000);
    } catch (err: any) {
      console.error(err);
      setOcrError(err.message || '수료증 이미지 분석에 실패했습니다. 직접 성함과 생년월일을 입력해주시기 바랍니다.');
    } finally {
      setIsOcrProcessing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!imagePreview) {
      setSubmitError('수료증 원본 사진을 등록해주시기 바랍니다.');
      return;
    }
    if (!assistantName.trim()) {
      setSubmitError('보내시는 분의 성명을 입력해주세요.');
      return;
    }
    if (!birthDate.trim() || birthDate.length < 6) {
      setSubmitError('생년월일 6자리(예: 740125)를 입력해주세요.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const success = await onNewSubmission({
        assistantName,
        birthDate,
        certificateImage: imagePreview,
      });

      if (success) {
        setSubmitSuccess(true);
        // Clean fields
        setAssistantName('');
        setBirthDate('');
        setImagePreview(null);
      } else {
        setSubmitError('수료증 등록 서버 저장에 실패했습니다. 잠시 후 다시 시도해주세요.');
      }
    } catch (err: any) {
      setSubmitError(err.message || '서버 통신 실패');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-2 py-4" id="assistant-form-root">
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200/80 shadow-md shadow-slate-100"
        id="assistant-submit-form-panel"
      >
        {/* Header Information strip */}
        <div className="mb-6 border-l-4 border-indigo-500 bg-indigo-50/40 p-4 rounded-r-xl border border-slate-100" id="intro-info-card">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-indigo-600" />
            온라인 수료증 제출
          </h3>
        </div>

        {submitSuccess ? (
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-center py-10 px-4"
            id="submit-success-box"
          >
            <div className="w-16 h-16 bg-emerald-50 text-emerald-650 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-100">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h3 className="text-xl font-bold text-slate-900">수료증이 성공적으로 전송되었습니다!</h3>
            <p className="text-slate-500 text-xs mt-3 max-w-sm mx-auto leading-relaxed">
              작성하신 정보가 담당 사회복지사 관리 시스템에 정상 접수되었습니다.
            </p>
            <button
              id="btn-submit-another"
              onClick={() => setSubmitSuccess(false)}
              className="mt-6 px-5 py-2 bg-indigo-600 text-white font-semibold text-xs tracking-wide hover:bg-indigo-750 transition-all inline-flex items-center gap-2 rounded-xl shadow-xs cursor-pointer"
            >
              추가 수료증 제출하기
            </button>
          </motion.div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6" id="form-actual">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8" id="form-grid">
              {/* Left Side: Photo Upload dropzone */}
              <div className="space-y-4" id="upload-col">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  수료증 사진 첨부 <span className="text-red-500">*</span>
                </label>

                <div
                  id="upload-dropzone"
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`relative border-2 border-dashed p-6 text-center cursor-pointer transition-all duration-250 min-h-[220px] flex flex-col justify-center items-center rounded-2xl ${
                    imagePreview 
                      ? 'border-indigo-400 bg-indigo-50/10' 
                      : isDragging 
                        ? 'border-indigo-505 bg-indigo-50/20' 
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                  }`}
                >
                  <input
                    id="input-file-hidden"
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="image/*"
                    className="hidden"
                  />

                  {imagePreview ? (
                    <div className="relative w-full h-full max-h-[280px] overflow-hidden rounded-xl group" id="selected-preview-box">
                      <img
                        id="img-cert-preview"
                        src={imagePreview}
                        alt="수료증 미리보기"
                        className="w-full h-auto max-h-[260px] object-contain mx-auto rounded-lg border border-slate-100"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-2 rounded-xl">
                        <span className="bg-white text-slate-800 px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 shadow-xs border border-slate-100 rounded-lg">
                          <Eye className="w-3.5 h-3.5" /> 원본 열람 중
                        </span>
                        <button
                          id="btn-remove-selected-img"
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setImagePreview(null);
                            setOcrSuccess(false);
                            setOcrError(null);
                          }}
                          className="bg-red-500 hover:bg-red-600 text-white p-2 rounded-lg transition-colors shadow-xs border border-red-400"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3" id="blank-upload-prompt">
                      <div className="mx-auto w-12 h-12 bg-slate-50 border border-slate-100 text-slate-400 rounded-xl flex items-center justify-center shadow-xs">
                        <Upload className="w-5 h-5 text-indigo-500" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-800">클릭하거나 이미지 파일을 끌어와 등록하세요</p>
                        <p className="text-xs text-slate-400 mt-1">스마트폰인 경우 즉시 수료증을 촬영하여 등록 가능</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Gemini intelligent extraction button and notification card */}
                {imagePreview && (
                  <div className="bg-indigo-50/50 border border-indigo-100/80 p-4 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs" id="btn-ocr-panel">
                    <div className="flex items-start gap-2.5">
                      <div className="p-1.5 bg-indigo-600 text-white rounded-lg mt-0.5 shadow-sm">
                        <Sparkles className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-indigo-950">AI 글자 인식 마법사</h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">이미지 내 성명과 생년월일을 자동 추출하여 폼에 입력해 줍니다.</p>
                      </div>
                    </div>
                    <button
                      id="btn-ocr-magician"
                      type="button"
                      onClick={triggerAiOcr}
                      disabled={isOcrProcessing}
                      className="w-full sm:w-auto shrink-0 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 border border-indigo-500 text-white text-xs font-semibold px-4 py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer"
                    >
                      {isOcrProcessing ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          글자 분석 중...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-3.5 h-3.5" />
                          이름·생년월일 자동입력
                        </>
                      )}
                    </button>
                  </div>
                )}

                {ocrSuccess && (
                  <div 
                    className="bg-emerald-50/50 border border-emerald-200 text-emerald-800 text-xs p-3 rounded-lg flex items-center gap-2 font-medium"
                    id="ocr-notif-success"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>사진 속 인적사항을 자동 인식하였습니다. 하단의 내용을 확인하여 주십시오.</span>
                  </div>
                )}

                {ocrError && (
                  <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs p-3 rounded-lg flex items-start gap-2 font-medium" id="ocr-notif-error">
                    <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                    <span>{ocrError}</span>
                  </div>
                )}
              </div>

              {/* Right Side: Text Input forms */}
              <div className="space-y-5" id="form-inputs-col">
                <h4 className="text-xs font-bold tracking-wider text-slate-400 uppercase border-b border-slate-100 pb-2">기본 인적 사항</h4>

                {/* Name Input */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    성명 <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-3 text-slate-450">
                      <User className="w-4 h-4 text-slate-400" />
                    </span>
                    <input
                      id="assistant-name"
                      type="text"
                      required
                      value={assistantName}
                      onChange={(e) => setAssistantName(e.target.value)}
                      placeholder="본인의 성명을 입력하세요."
                      className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 bg-slate-50/30 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 transition-colors font-medium shadow-xs"
                    />
                  </div>
                </div>

                {/* Birth Date Input */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    생년월일 <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-3 text-slate-450">
                      <Calendar className="w-4 h-4 text-slate-400" />
                    </span>
                    <input
                      id="birth-date"
                      type="text"
                      required
                      maxLength={6}
                      value={birthDate}
                      onChange={(e) => setBirthDate(e.target.value.replace(/[^0-9]/g, ''))}
                      placeholder="숫자 6자리 입력 (예: 740125)"
                      className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 bg-slate-50/30 font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 transition-colors font-medium shadow-xs"
                    />
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1.5">
                    예시: 1974년 1월 25일생인 경우 “740125”로 숫자 6자리 기입
                  </p>
                </div>
              </div>
            </div>

            {submitError && (
              <div className="bg-rose-55 border border-rose-200 text-rose-800 text-xs p-3 rounded-lg flex items-center gap-2 font-medium" id="submit-error-box">
                <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />
                <span>{submitError}</span>
              </div>
            )}

            {/* Submit Button Action bar */}
            <div className="flex justify-end pt-4 border-t border-slate-100" id="form-actions-border">
              <button
                id="btn-submit-form"
                type="submit"
                disabled={isSubmitting}
                className="w-full sm:w-auto px-8 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 text-white font-semibold text-xs tracking-wider rounded-xl shadow-md hover:shadow-lg hover:shadow-indigo-50 shadow-indigo-100 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    수료증 정보 전송 중...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    수료증 전송하기
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </motion.div>
    </div>
  );
}

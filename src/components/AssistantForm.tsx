/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Upload, User, Calendar, CheckCircle2, AlertCircle, 
  Sparkles, ShieldCheck, Loader2, RefreshCw, X, Eye, FileText, Clock, BookOpen,
  Settings, Key, Download, Smartphone, Laptop
} from 'lucide-react';
import { getStoredGeminiApiKey } from '../firebase';

interface AssistantFormProps {
  onNewSubmission: (submission: { 
    assistantName: string; 
    birthDate: string; 
    certificateImage: string;
  }) => Promise<{ success: boolean; error?: string }>;
}

export default function AssistantForm({ onNewSubmission }: AssistantFormProps) {
  // Submit Form States
  const [assistantName, setAssistantName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  
  
  
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [fileType, setFileType] = useState<'image' | 'pdf' | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
        setFileType(file.type.includes('pdf') ? 'pdf' : 'image');
        setFileName(file.name);
      };
      reader.readAsDataURL(file);
    }
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!imagePreview) {
      setSubmitError('수료증 원본 스캔 이미지 또는 PDF 문서를 등록해 주십시오.');
      return;
    }
    if (!assistantName.trim()) {
      setSubmitError('성명을 입력해주세요.');
      return;
    }
    if (!birthDate.trim() || birthDate.length < 6) {
      setSubmitError('본인의 생년월일 6자리(예: 740125)를 입력해주세요.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const result = await onNewSubmission({
        assistantName,
        birthDate,
        certificateImage: imagePreview,
      });

      if (result.success) {
        setSubmitSuccess(true);
        // Clean fields
        setAssistantName('');
        setBirthDate('');
        setImagePreview(null);
        setFileType(null);
        setFileName('');
      } else {
        setSubmitError(result.error || '수료증 등록 서버 저장에 실패했습니다. 잠시 후 다시 시도해주세요.');
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
        <div className="mb-6 border-l-4 border-indigo-500 bg-indigo-50/40 p-4 rounded-r-xl border border-slate-100" id="intro-info-card">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-indigo-600" />
            온라인 수료증 제출
          </h3>
          <p className="text-xs text-slate-500 mt-1.5 leading-relaxed font-sans">
            사진이나 PDF형식의 교육 수료증을 등록하고, 인적사항을 입력하여 제출해주세요.
          </p>
        </div>

        {submitSuccess ? (
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-center py-10 px-4"
            id="submit-success-box"
          >
            <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-100">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h3 className="text-xl font-bold text-slate-900">수료증이 성공적으로 전송되었습니다!</h3>
            <button
              id="btn-submit-another"
              onClick={() => setSubmitSuccess(false)}
              className="mt-6 px-5 py-2 bg-indigo-600 text-white font-semibold text-xs tracking-wide hover:bg-indigo-700 transition-all inline-flex items-center gap-2 rounded-xl shadow-xs cursor-pointer"
            >
              추가 수료증 제출하기
            </button>
          </motion.div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6" id="form-actual">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8" id="form-grid">
              <div className="space-y-4" id="upload-col">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  수료증 사진 또는 PDF 등록 <span className="text-red-500">*</span>
                </label>
                <div
                  id="upload-dropzone"
                  onClick={() => fileInputRef.current?.click()}
                  className={`relative border-2 border-dashed p-6 text-center cursor-pointer transition-all duration-250 min-h-[220px] flex flex-col justify-center items-center rounded-2xl ${
                    imagePreview 
                      ? 'border-indigo-400 bg-indigo-50/10' 
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                  }`}
                >
                  <input
                    id="input-file-hidden"
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="image/*,application/pdf"
                    className="hidden"
                  />
                  {imagePreview ? (
                    <div className="relative w-full h-full max-h-[300px] overflow-hidden rounded-xl group" id="selected-preview-box">
                      {fileType === 'pdf' ? (
                        <div className="flex flex-col items-center justify-center p-6 space-y-3">
                          <div className="w-16 h-16 bg-red-50 border border-red-100 rounded-2xl flex items-center justify-center text-red-500 shadow-sm">
                            <FileText className="w-9 h-9" />
                          </div>
                          <p className="text-sm font-semibold text-slate-800 max-w-[240px] truncate">{fileName}</p>
                        </div>
                      ) : (
                        <img
                          id="img-cert-preview"
                          src={imagePreview}
                          alt="수료증 미리보기"
                          className="w-full h-auto max-h-[240px] object-contain mx-auto rounded-lg border border-slate-100"
                          referrerPolicy="no-referrer"
                        />
                      )}
                      <div className="absolute inset-x-0 bottom-0 bg-slate-900/60 p-2.5 flex items-center justify-between pointer-events-auto">
                        <button
                          id="btn-remove-selected-img"
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setImagePreview(null);
                            setFileType(null);
                            setFileName('');
                          }}
                          className="bg-red-500 hover:bg-red-650 text-white p-1.5 rounded-lg transition-colors border border-red-400 cursor-pointer"
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
                      <p className="text-sm font-semibold text-slate-800">클릭하거나 사진/PDF를 여기에 끌어다 놓으세요</p>
                    </div>
                  )}
                </div>
              </div>
              <div className="space-y-4" id="form-inputs-col">
                <h4 className="text-xs font-bold tracking-wider text-slate-400 uppercase border-b border-slate-100 pb-2">인적사항 및 교육 정보</h4>
                <div>
                  <label className="block text-xs font-bold text-slate-900 mb-1.5">
                     활동지원사 성명 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={assistantName}
                    onChange={(e) => setAssistantName(e.target.value)}
                    placeholder="성명을 입력하세요"
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 bg-slate-50/30 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 transition-colors font-medium shadow-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-900 mb-1.5">
                     생년월일(6자리) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={birthDate}
                    onChange={(e) => setBirthDate(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="숫자 6자리 (예: 740125)"
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 bg-slate-50/30 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 transition-colors font-medium shadow-xs"
                  />
                </div>

            
              </div>
            </div>
            {submitError && (
              <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs p-3 rounded-lg flex items-center gap-2 font-medium">
                <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />
                <span>{submitError}</span>
              </div>
            )}
            <div className="flex justify-end pt-4 border-t border-slate-100">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full sm:w-auto px-8 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 text-white font-semibold text-xs tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {isSubmitting ? '전송 중...' : '수료증 전송하기'}
              </button>
            </div>
          </form>
        )}
      </motion.div>
    </div>
  );
}

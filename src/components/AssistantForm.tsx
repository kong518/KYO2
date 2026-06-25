/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Upload, User, Calendar, CheckCircle2, AlertCircle, 
  Sparkles, ShieldCheck, Loader2, RefreshCw, X, Eye, FileText, Clock, BookOpen,
  Settings, Key
} from 'lucide-react';
import { getStoredGeminiApiKey } from '../firebase';

interface AssistantFormProps {
  onNewSubmission: (submission: { 
    assistantName: string; 
    birthDate: string; 
    certificateImage: string;
    courseName?: string;
    trainingHours?: string;
  }) => Promise<{ success: boolean; error?: string }>;
}

export default function AssistantForm({ onNewSubmission }: AssistantFormProps) {
  // Submit Form States
  const [assistantName, setAssistantName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [courseName, setCourseName] = useState('');
  const [trainingHours, setTrainingHours] = useState('');
  
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [fileType, setFileType] = useState<'image' | 'pdf' | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);
  
  // OCR processing state
  const [isOcrProcessing, setIsOcrProcessing] = useState(false);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [ocrSuccess, setOcrSuccess] = useState(false);
  const [ocrStatusMessage, setOcrStatusMessage] = useState('');
  
  // Submit control states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // User-provided Gemini API Key States
  const [userApiKey, setUserApiKey] = useState<string>('');
  const [showApiKeySetting, setShowApiKeySetting] = useState<boolean>(false);
  const [isApiKeySaved, setIsApiKeySaved] = useState<boolean>(false);

  useEffect(() => {
    const savedKey = localStorage.getItem("USER_GEMINI_API_KEY") || "";
    setUserApiKey(savedKey);
    setIsApiKeySaved(!!savedKey);
  }, []);

  const handleSaveApiKey = async (key: string) => {
    const trimmed = key.trim();
    try {
      // Save to server config first so it is preserved centrally for ALL users/links
      const res = await fetch("/api/settings/apikey", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ apiKey: trimmed }),
      });
      if (!res.ok) {
        throw new Error("서버에 API Key를 저장하는 중 오류가 발생했습니다.");
      }

      if (trimmed) {
        localStorage.setItem("USER_GEMINI_API_KEY", trimmed);
        setIsApiKeySaved(true);
        setUserApiKey(trimmed);
        alert("Gemini API Key가 애플리케이션 서버 앱 및 브라우저에 안전하게 저장되었습니다.\n이제 링크를 받는 모든 사용자가 별도의 설정 없이 수료증 자동 분석 기능을 즉시 이용할 수 있습니다.");
      } else {
        localStorage.removeItem("USER_GEMINI_API_KEY");
        setIsApiKeySaved(false);
        setUserApiKey('');
        alert("개인 API Key가 초기화되었습니다. 이제 기본 공용 AI 분석으로 동작합니다.");
      }
      setShowApiKeySetting(false);
    } catch (err: any) {
      alert("API Key 저장 실패: " + (err.message || err));
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Client-side image compression to downscale high-resolution mobile photos
  const compressImage = (base64Str: string, maxW = 1600, maxH = 1600): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxW || height > maxH) {
          if (width > height) {
            height = Math.round((height * maxW) / width);
            width = maxW;
          } else {
            width = Math.round((width * maxH) / height);
            height = maxH;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.82));
        } else {
          resolve(base64Str);
        }
      };
      img.onerror = () => {
        resolve(base64Str);
      };
      img.src = base64Str;
    });
  };

  // Raw file to base64 converter
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const processFile = (file: File) => {
    const isImage = file.type.startsWith('image/');
    const isPdf = file.type === 'application/pdf';

    if (!isImage && !isPdf) {
      alert('이미지 파일(PNG, JPG, JPEG)과 PDF 파일만 업로드할 수 있습니다.');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64String = event.target?.result as string;
      
      if (isImage) {
        setFileType('image');
        setFileName(file.name);
        setIsOcrProcessing(true);
        setOcrStatusMessage('업로드 중...');
        
        try {
          const compressedString = await compressImage(base64String);
          setImagePreview(compressedString);
          setOcrSuccess(false);
          setOcrError(null);
          
          // Trigger OCR automatically
          triggerAiOcr(compressedString, 'image');
        } catch (err) {
          setImagePreview(base64String);
          triggerAiOcr(base64String, 'image');
        }
      } else {
        setFileType('pdf');
        setFileName(file.name);
        setImagePreview(base64String);
        setOcrSuccess(false);
        setOcrError(null);
        
        // Trigger OCR automatically
        triggerAiOcr(base64String, 'pdf');
      }
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

  // Triggers Gemini OCR over the uploaded certificate image/PDF
  const triggerAiOcr = async (base64Data: string, type: 'image' | 'pdf') => {
    setIsOcrProcessing(true);
    setOcrStatusMessage('AI 인공지능이 서류 글자를 분석 및 판독하고 있습니다 (약 3~5초 소요)...');
    setOcrError(null);
    setOcrSuccess(false);

    try {
      let parsedData;
      let usedServer = false;
      let serverErrorMsg = "";
      let isServerKeyMissing = false;

      // 1. ALWAYS try the central server OCR endpoint first so visitors/helpers need zero local configuration!
      try {
        const response = await fetch('/api/submissions/ocr', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ imageBase64: base64Data }),
        });

        const textRes = await response.text();
        if (response.ok) {
          try {
            parsedData = JSON.parse(textRes);
            usedServer = true;
          } catch {
            serverErrorMsg = "서버 분석 응답 데이터 파싱 실패";
          }
        } else {
          let errJSON: any = {};
          try {
            errJSON = JSON.parse(textRes);
          } catch (e) {}
          
          serverErrorMsg = errJSON.error || `서버 처리 오류 (상태 코드: ${response.status})`;
          if (response.status === 505) {
            isServerKeyMissing = true;
          }
        }
      } catch (serverErr: any) {
        console.warn("Server OCR failed, falling back to local storage key check...", serverErr);
        serverErrorMsg = "서버 연결 실패: " + (serverErr.message || serverErr);
      }

      // 2. If server didn't analyze successfully, check if there is a client-side key
      if (!usedServer) {
        const clientApiKey = await getStoredGeminiApiKey();
        if (clientApiKey) {
          setOcrStatusMessage('현재 환경에 맞게 안전한 브라우저 엔진 직접 분석으로 우회하여 자동 해독을 처리 중입니다...');
          const { GoogleGenAI, Type } = await import('@google/genai');
          
          let rawBase64 = base64Data;
          let mimeType = type === 'pdf' ? 'application/pdf' : 'image/png';

          if (base64Data.includes(";base64,")) {
            const parts = base64Data.split(";base64,");
            rawBase64 = parts[1];
            mimeType = parts[0].replace("data:", "").split(";")[0];
          }

          const ai = new GoogleGenAI({ apiKey: clientApiKey });
          const dataPart = {
            inlineData: {
              data: rawBase64,
              mimeType: mimeType,
            },
          };

          const modelsToTry = ["gemini-3.5-flash", "gemini-3.1-flash-lite"];
          let response: any = null;
          let lastError: any = null;

          for (const currentModel of modelsToTry) {
            let attempt = 0;
            const maxRetries = 3;
            const initialDelay = 1000;

            console.log(`[Client Gemini OCR] Trying direct analysis using model: ${currentModel}`);
            
            while (attempt < maxRetries) {
              try {
                response = await ai.models.generateContent({
                  model: currentModel,
                  contents: [
                    dataPart,
                    `Please analyze this uploaded online training certificate. 
Our target is to extract information about the activity assistant (활동지원사) who completed the training.
Extract the following details from this image/PDF:
1. Name (성명/이름)
2. Date of Birth (생년월일 - 6자리 예시: 740125)
3. Course Name (교육명칭/수강과정명 - 예시: '활동지원사 온라인 보수교육', '발달장애인 지원 교육' 등)
4. Training Hours (교육이수시간 - 예시: '8시간', '4시간' 등)

Return the parsed values in Korean language inside the requested JSON schema.
If no training hours option is visible, leave it as an empty string.`
                  ],
                  config: {
                    responseMimeType: "application/json",
                    responseSchema: {
                      type: Type.OBJECT,
                      properties: {
                        assistantName: { type: Type.STRING, description: "정확한 성명/이름" },
                        birthDate: { type: Type.STRING, description: "활동지원사 생년월일 (예시: 740125)" },
                        courseName: { type: Type.STRING, description: "교육과정명 또는 교육명 (예시: 복지교육)" },
                        trainingHours: { type: Type.STRING, description: "교육 이수 시간 (예시: 8시간)" }
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
                console.warn(`[Client Gemini OCR] Model ${currentModel} Attempt ${attempt}/${maxRetries} failed:`, errMsg);

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
                  console.log(`[Client Gemini OCR] Retrying in ${Math.round(delay)}ms...`);
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
            throw lastError || new Error("Gemini 분석 엔진에서 응답이 생성되지 않았습니다 (시도된 모든 모델 실패).");
          }
          parsedData = JSON.parse(response.text.trim());
        } else {
          throw new Error("Gemini API Key가 안전하게 서버 또는 데이터베이스에 저장되어 있지 않습니다. 관리자 화면의 [API Key 설정] 메뉴를 통해 키를 발급해 먼저 등록해주십시오.");
        }
      }

      // Auto-fill extracted values
      if (parsedData.assistantName) setAssistantName(parsedData.assistantName);
      if (parsedData.courseName) setCourseName(parsedData.courseName);
      if (parsedData.trainingHours) setTrainingHours(parsedData.trainingHours);
      
      // Let only Date of Birth be inputted by User themselves ("생년월일만 본인이 입력할 수 있게")
      setBirthDate(''); 

      setOcrSuccess(true);
    } catch (err: any) {
      console.error(err);
      let errMsg = err.message || '';
      if (
        errMsg.includes("API key expired") || 
        errMsg.includes("API_KEY_INVALID") || 
        errMsg.includes("INVALID_ARGUMENT") || 
        errMsg.includes("key expired") ||
        errMsg.includes("400")
      ) {
        setOcrError("저장 및 설정된 Gemini API Key가 올바르지 않거나 허가 만료 상태입니다.\n상단의 [AI 서버 설정] 메뉴를 클릭하여 올바른 API Key를 새로 저장해 주시거나 다른 키로 시도해 주세요.");
      } else {
        setOcrError(errMsg || '수료증 문서 AI 자동 분석에 실패했습니다. 직접 성함과 교육 과정을 입력해 주십시오.');
      }
    } finally {
      setIsOcrProcessing(false);
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
        courseName,
        trainingHours,
      });

      if (result.success) {
        setSubmitSuccess(true);
        // Clean fields
        setAssistantName('');
        setBirthDate('');
        setCourseName('');
        setTrainingHours('');
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
        {/* Header Information strip */}
        <div className="mb-6 border-l-4 border-indigo-500 bg-indigo-50/40 p-4 rounded-r-xl border border-slate-100" id="intro-info-card">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2 font-sans">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-indigo-600" />
              온라인 수료증 제출 시스템
            </h3>
          </div>

          <p className="text-xs text-slate-500 mt-1.5 leading-relaxed font-sans">
            사진이나 PDF형식의 교육 수료증을 등록해주세요.{" "}
            <span className="font-bold text-indigo-600">
              AI 인공지능이 이름, 교육명, 교육시간을 자동으로 적어줍니다. 생년월일(6자리)만 본인이 입력해주세요. 정보 확인 후 밑에 "수료증 전송하기"를 꼭 눌러서 제출해주세요.
            </span>
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
            <p className="text-slate-500 text-xs mt-3 max-w-sm mx-auto leading-relaxed">
              작성하신 정보가 담당 사회복지사 관리 시스템에 정상 접수되었습니다.
            </p>
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
              {/* Left Side: Photo Upload dropzone */}
              <div className="space-y-4" id="upload-col">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  수료증 사진 또는 PDF 등록 <span className="text-red-500">*</span>
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
                        ? 'border-indigo-500 bg-indigo-50/20' 
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
                          <div className="text-center font-sans">
                            <p className="text-sm font-semibold text-slate-800 max-w-[240px] truncate">{fileName}</p>
                            <p className="text-[10px] text-slate-400 mt-1">PDF 수료증 문서 등록됨</p>
                          </div>
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
                        <span className="text-[10px] text-white font-medium flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          {fileType === 'pdf' ? 'PDF 등록됨' : '이미지 등록됨'}
                        </span>
                        <button
                          id="btn-remove-selected-img"
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setImagePreview(null);
                            setFileType(null);
                            setFileName('');
                            setAssistantName('');
                            setBirthDate('');
                            setCourseName('');
                            setTrainingHours('');
                            setOcrSuccess(false);
                            setOcrError(null);
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
                      <div>
                        <p className="text-sm font-semibold text-slate-800">클릭하거나 사진/PDF를 여기에 끌어다 놓으세요</p>
                        <p className="text-xs text-slate-400 mt-1 leading-normal">
                          스마트폰은 즉시 수료증을 촬영하여 제출 가능합니다.<br/>
                          (지원 형식: PNG, JPG, JPEG, PDF)
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Gemini intelligent extraction status card */}
                {isOcrProcessing && (
                  <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-xl flex items-start gap-2.5 animate-pulse" id="ocr-processing">
                    <Loader2 className="w-4 h-4 text-indigo-600 animate-spin shrink-0 mt-0.5" />
                    <div className="font-sans">
                      <h4 className="text-xs font-bold text-indigo-950">AI 글자 인식 로봇 분주히 분석 중...</h4>
                      <p className="text-[10px] text-slate-500 mt-0.5">{ocrStatusMessage}</p>
                    </div>
                  </div>
                )}

                {ocrSuccess && (
                  <div 
                    className="bg-emerald-50/60 border border-emerald-200 text-emerald-800 text-xs p-3.5 rounded-xl flex items-start gap-2 font-medium"
                    id="ocr-notif-success"
                  >
                    <Sparkles className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold block text-emerald-950">AI 자동 판독이 완료되었습니다!</span>
                      <p className="text-[10px] text-emerald-700/80 mt-0.5">
                        수료증 정보에서 <span className="underline">이름, 교육과정명, 교육시간</span>을 자동 분석해 채워 넣었습니다.
                        내용이 정답인지 검토하시고, 마지막으로 <span className="font-bold underline text-indigo-700">생년월일(6자리)</span>만 직접 적어주세요.
                      </p>
                    </div>
                  </div>
                )}

                {ocrError && (
                  <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs p-3.5 rounded-xl flex items-start gap-2 font-medium" id="ocr-notif-error">
                    <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold block text-amber-950">자동 인식 오류 알림</span>
                      <p className="text-[10px] text-slate-500 mt-0.5">{ocrError}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Right Side: Text Input forms */}
              <div className="space-y-4" id="form-inputs-col">
                <h4 className="text-xs font-bold tracking-wider text-slate-400 uppercase border-b border-slate-100 pb-2">인적사항 및 교육 정보</h4>

                {/* Highly visible notice message for teachers while AI is analyzing */}
                {isOcrProcessing && (
                  <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-xl flex items-start gap-2.5 animate-pulse" id="ocr-waiting-notice">
                    <Loader2 className="w-4 h-4 text-amber-600 animate-spin shrink-0 mt-0.5" />
                    <div className="font-sans text-xs">
                      <span className="font-bold text-amber-950 block">잠시만 기다려 주세요!</span>
                      <p className="text-slate-650 font-semibold mt-1 text-[11px] leading-relaxed">
                        사진이나 PDF형식의 교육수료증을 등록하시면 인공지능이 이름, 교육명, 교육시간을 자동으로 작성중입니다.
                      </p>
                    </div>
                  </div>
                )}

                {/* Birth Date Input (Now placing Birth Date strictly above assistantName) */}
                <div className="pt-2">
                  <label className="block text-xs font-bold text-slate-900 mb-1.5 flex items-center justify-between bg-yellow-50/50 p-1 rounded-md border border-yellow-100/50 px-2">
                    <span className="flex items-center gap-1 text-slate-800 font-sans">
                      <Calendar className="w-4 h-4 text-indigo-600 animate-pulse" />
                      활동지원사 본인 생년월일 <span className="text-red-500 font-bold">*</span>
                    </span>
                    <span className="text-[9px] text-indigo-700 font-bold">※ 반드시 본인이 입력</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-3 text-slate-400">
                      <Calendar className="w-4 h-4 text-indigo-500" />
                    </span>
                    <input
                      id="birth-date"
                      type="text"
                      required
                      maxLength={6}
                      value={birthDate}
                      onChange={(e) => setBirthDate(e.target.value.replace(/[^0-9]/g, ''))}
                      placeholder="숫자 6자리 입력 (예: 740125)"
                      className="w-full pl-9 pr-4 py-2.5 border-2 border-indigo-500 rounded-xl text-sm text-slate-900 bg-indigo-50/10 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-100 transition-colors font-bold tracking-wider shadow-xs placeholder:font-normal placeholder:tracking-normal placeholder:text-slate-400"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1.5 font-medium leading-relaxed">
                    예시: 1974년 1월 25일생인 경우 <span className="font-bold underline text-indigo-600">“740125”</span> 로 숫자 6자리 기입하십시오.
                  </p>
                </div>

                {/* Name Input */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
                    <span>활동지원사 성명 <span className="text-red-500">*</span></span>
                    {ocrSuccess && <span className="text-[9px] bg-emerald-50 text-emerald-650 px-1.5 py-0.5 rounded-md font-bold">AI 인식됨</span>}
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-3 text-slate-400">
                      <User className="w-4 h-4" />
                    </span>
                    <input
                      id="assistant-name"
                      type="text"
                      required
                      value={assistantName}
                      onChange={(e) => setAssistantName(e.target.value)}
                      placeholder={isOcrProcessing ? "AI 분석 중..." : "본인의 성명을 입력하세요"}
                      className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 bg-slate-50/30 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 transition-colors font-medium shadow-xs"
                    />
                  </div>
                </div>

                {/* Course Name Input */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
                    <span>수강하신 교육명 (과정명) <span className="text-indigo-600">(선택)</span></span>
                    {ocrSuccess && courseName && <span className="text-[9px] bg-emerald-50 text-emerald-650 px-1.5 py-0.5 rounded-md font-bold">AI 인식됨</span>}
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-3 text-slate-400">
                      <BookOpen className="w-4 h-4" />
                    </span>
                    <input
                      id="course-name"
                      type="text"
                      value={courseName}
                      onChange={(e) => setCourseName(e.target.value)}
                      placeholder={isOcrProcessing ? "AI 분석 중..." : "예: 장애인활동지원 보수교육 (수료증 내 문구)"}
                      className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 bg-slate-50/30 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 transition-colors font-medium shadow-xs"
                    />
                  </div>
                </div>

                {/* Training Hours Input */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
                    <span>교육 이수 시간 <span className="text-indigo-600">(선택)</span></span>
                    {ocrSuccess && trainingHours && <span className="text-[9px] bg-emerald-50 text-emerald-650 px-1.5 py-0.5 rounded-md font-bold">AI 인식됨</span>}
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-3 text-slate-400">
                      <Clock className="w-4 h-4" />
                    </span>
                    <input
                      id="training-hours"
                      type="text"
                      value={trainingHours}
                      onChange={(e) => setTrainingHours(e.target.value)}
                      placeholder={isOcrProcessing ? "AI 분석 중..." : "예: 8시간 (수료증 내 인정 시간)"}
                      className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 bg-slate-50/30 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 transition-colors font-medium shadow-xs"
                    />
                  </div>
                </div>
              </div>
            </div>

            {submitError && (
              <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs p-3 rounded-lg flex items-center gap-2 font-medium" id="submit-error-box">
                <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />
                <span>{submitError}</span>
              </div>
            )}

            {/* Submit Button Action bar */}
            <div className="flex justify-end pt-4 border-t border-slate-100" id="form-actions-border">
              <button
                id="btn-submit-form"
                type="submit"
                disabled={isSubmitting || isOcrProcessing}
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

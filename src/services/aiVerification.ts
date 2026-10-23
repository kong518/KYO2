/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, Type } from "@google/genai";

export interface CertificateAnalysisResult {
  success: boolean;
  assistantName?: string;
  birthDate?: string;
  courseName?: string;
  trainingHours?: string;
  institution?: string;
  completionDate?: string;
  certNumber?: string;
  summary?: string;
  error?: string;
}

/**
 * Extracts base64 and mimeType from a data URL string
 */
function parseDataUrl(dataUrl: string): { mimeType: string; base64: string } {
  if (!dataUrl) {
    throw new Error("수료증 데이터가 비어 있습니다.");
  }

  const commaIndex = dataUrl.indexOf(",");
  if (commaIndex === -1) {
    // Raw base64 fallback
    return { mimeType: "image/jpeg", base64: dataUrl };
  }

  const meta = dataUrl.substring(0, commaIndex);
  const base64 = dataUrl.substring(commaIndex + 1);

  const mimeMatch = meta.match(/data:([^;]+)/);
  let mimeType = mimeMatch ? mimeMatch[1] : "image/jpeg";

  // PDF or standard images
  if (mimeType.includes("pdf")) {
    mimeType = "application/pdf";
  } else if (!mimeType.startsWith("image/")) {
    mimeType = "image/jpeg";
  }

  return { mimeType, base64 };
}

/**
 * Verifies a single certificate image/PDF using Google Gemini
 */
export async function analyzeCertificateWithGemini(
  certificateDataUrl: string,
  apiKey: string
): Promise<CertificateAnalysisResult> {
  const cleanKey = apiKey?.trim();
  if (!cleanKey) {
    return {
      success: false,
      error: "Google Gemini API 키가 설정되지 않았습니다. API 키를 먼저 등록해 주세요.",
    };
  }

  const timeout = (ms: number) => new Promise((_, reject) => setTimeout(() => reject(new Error("AI 분석 응답 시간이 초과되었습니다.")), ms));

  try {
    const { mimeType, base64 } = parseDataUrl(certificateDataUrl);

    const ai = new GoogleGenAI({ apiKey: cleanKey });

    const prompt = `이 교육 수료증 이미지/문서에서 다음 항목을 정확히 추출하여 JSON으로 반환해주세요:
1. assistantName: 수료자 성명 (이름)
2. birthDate: 생년월일 (YYMMDD 또는 YYYY-MM-DD)
3. courseName: 수료증에 기재된 정확한 교육과정명 (임의로 축약하거나 변경하지 말고 원문 그대로 추출)
4. trainingHours: 수료증에 기재된 정확한 교육 이수 시간 (예: "8시간", "16시간" 등)
5. summary: 간단한 판독 요약 1문장`;

    // Robust list of models with retry / backoff
    const modelsToTry = ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-flash-latest", "gemini-1.5-pro"];
    let response: any = null;
    let lastError: any = null;

    for (const modelName of modelsToTry) {
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          response = await Promise.race([
            ai.models.generateContent({
              model: modelName,
              contents: [
                {
                  role: "user",
                  parts: [
                    {
                      inlineData: {
                        mimeType,
                        data: base64,
                      },
                    },
                    {
                      text: prompt,
                    },
                  ],
                },
              ],
              config: {
                responseMimeType: "application/json",
                responseSchema: {
                  type: Type.OBJECT,
                  properties: {
                    assistantName: { type: Type.STRING },
                    birthDate: { type: Type.STRING },
                    courseName: { type: Type.STRING },
                    trainingHours: { type: Type.STRING },
                    summary: { type: Type.STRING },
                  },
                  required: ["courseName", "trainingHours"],
                },
              },
            }),
            timeout(25000)
          ]);

          if (response && response.text) {
            break;
          }
        } catch (err: any) {
          lastError = err;
          console.warn(`[AI Verification] Model ${modelName} attempt ${attempt} failed (503/Quota/Error):`, err?.message || err);
          
          if (err.status === 429 || err.message?.includes("429") || err.message?.includes("RESOURCE_EXHAUSTED")) {
            return {
              success: false,
              error: "Gemini API 사용량 한도(Quota)를 초과했습니다. 잠시 후 다시 시도해 주세요.",
            };
          }

          // If 503 / UNAVAILABLE, wait briefly and retry
          if (err.status === 503 || err.message?.includes("503") || err.message?.includes("high demand") || err.message?.includes("UNAVAILABLE")) {
            await new Promise(resolve => setTimeout(resolve, 1500 * attempt));
          }
        }
      }
      if (response && response.text) {
        break;
      }
    }

    if (!response || !response.text) {
      return {
        success: false,
        error: lastError?.message?.includes("503") || lastError?.message?.includes("UNAVAILABLE")
          ? "AI 모델이 일시적으로 높은 부하(503)를 받고 있습니다. 잠시 후 [AI 분석 재시도]를 눌러주세요."
          : "수료증에서 교육명과 이수 시간을 추출하지 못했습니다. 직접 입력하시거나 [AI 분석 재시도]를 진행해 주세요.",
      };
    }

    const text = response.text;

    try {
      const parsed = JSON.parse(text);
      const courseName = parsed.courseName?.trim() || "";
      const trainingHours = parsed.trainingHours?.trim() || "";

      if (!courseName || !trainingHours) {
        return {
          success: false,
          error: "수료증 이미지/PDF에서 교육명 또는 이수시간이 정확히 감지되지 않았습니다. 직접 입력해 주시거나 재시도 해주세요.",
        };
      }

      return {
        success: true,
        assistantName: parsed.assistantName?.trim() || "",
        birthDate: parsed.birthDate?.trim() || "",
        courseName,
        trainingHours,
        summary: parsed.summary?.trim() || "AI 정확 판독 완료",
      };
    } catch (parseErr) {
      return {
        success: false,
        error: "AI 응답 데이터 파싱에 실패했습니다. 다시 시도해 주세요.",
      };
    }
  } catch (err: any) {
    console.error("Gemini API certificate verification error:", err);
    let errorMsg = err.message || "수료증 분석 중 오류가 발생했습니다.";
    
    if (errorMsg.includes("429") || errorMsg.includes("RESOURCE_EXHAUSTED") || errorMsg.includes("quota")) {
      errorMsg = "API 사용량 한도(Quota)를 초과했습니다. 잠시 후 다시 시도해 주세요.";
    } else if (errorMsg.includes("503") || errorMsg.includes("UNAVAILABLE") || errorMsg.includes("high demand")) {
      errorMsg = "AI 모델이 일시적으로 과부하 상태입니다 (503). [AI 분석 재시도] 버튼을 눌러 다시 분석해 주세요.";
    }

    return {
      success: false,
      error: errorMsg,
    };
  }
}



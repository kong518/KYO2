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
 * Verifies a single certificate image/PDF using Google Gemini 2.5 Flash
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

    const prompt = `수료증을 분석하여 JSON으로 추출하세요:
assistantName, birthDate(YYMMDD), courseName, trainingHours(숫자+시간), institution, completionDate, certNumber, summary.`;

    // Robust list of models
    const modelsToTry = ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-pro", "gemini-flash-latest"];
    let response: any = null;
    let lastError: any = null;

    for (const modelName of modelsToTry) {
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
                  institution: { type: Type.STRING },
                  completionDate: { type: Type.STRING },
                  certNumber: { type: Type.STRING },
                  summary: { type: Type.STRING },
                },
                required: ["courseName", "trainingHours"],
              },
            },
          }),
          timeout(30000)
        ]);

        if (response && response.text) {
          break;
        }
      } catch (err: any) {
        lastError = err;
        console.warn(`[AI Verification] Model ${modelName} failed:`, err?.message || err);
        
        // If quota exceeded, don't bother trying other models
        if (err.status === 429 || err.message?.includes("429") || err.message?.includes("RESOURCE_EXHAUSTED")) {
          throw new Error("Gemini API 사용량 한도(Quota)를 초과했습니다. 잠시 후 다시 시도해 주세요.");
        }
      }
    }

    if (!response || !response.text) {
      throw lastError || new Error("AI 분석에 실패했습니다.");
    }

    const text = response.text;

    try {
      const parsed = JSON.parse(text);
      return {
        success: true,
        assistantName: parsed.assistantName?.trim() || "",
        birthDate: parsed.birthDate?.trim() || "",
        courseName: parsed.courseName?.trim() || "장애인활동지원사 교육",
        trainingHours: parsed.trainingHours?.trim() || "8시간",
        institution: parsed.institution?.trim() || "",
        completionDate: parsed.completionDate?.trim() || "",
        certNumber: parsed.certNumber?.trim() || "",
        summary: parsed.summary?.trim() || "AI 자동 판독 완료",
      };
    } catch (parseErr) {
      return {
        success: false,
        error: "AI 응답 형식이 올바르지 않습니다.",
      };
    }
  } catch (err: any) {
    console.error("Gemini API certificate verification error:", err);
    return {
      success: false,
      error: err.message || "수료증 분석 중 오류가 발생했습니다.",
    };
  }
}

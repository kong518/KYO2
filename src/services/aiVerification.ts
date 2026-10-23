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
    return { mimeType: "image/jpeg", base64: dataUrl };
  }

  const meta = dataUrl.substring(0, commaIndex);
  const base64 = dataUrl.substring(commaIndex + 1);

  const mimeMatch = meta.match(/data:([^;]+)/);
  let mimeType = mimeMatch ? mimeMatch[1] : "image/jpeg";

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

    // GSEEK 및 일반 수료증 특성을 완벽히 반영한 고도화 프롬프트
    const prompt = `당신은 대한민국 평생교육 및 사회복지 교육 수료증(특히 GSEEK 경기도평생학습포털 등)을 분석하는 전문 OCR 데이터 추출기입니다.
제공된 수료증 이미지/문서에서 다음 항목을 빠짐없이 정확하게 추출하여 JSON 형식으로 반환해주세요.

추출 규칙:
1. assistantName: 수료자 성명 (예: "박은희", "봉세은" 등. '성 명' 또는 '성명' 바로 뒤의 텍스트)
2. birthDate: 생년월일이 명시되어 있다면 추출 (없으면 빈 문자열 "")
3. courseName: 강좌명 또는 교육명 원문 그대로 추출 (예: "노인일자리 사례로 배우는 안전사고 예방교육". 임의로 줄이거나 바꾸지 마세요.)
4. trainingHours: 학습 시간 또는 이수 시간 (예: "6시간", "8시간" 등 숫자와 단위를 포함하여 추출)
5. certNumber: 제1호 또는 발급번호 (예: "제 26102110132N6291537호")
6. completionDate: 수료일 또는 학습 기간 종료일 (예: "2026.10.21")
7. summary: 판독 내용 요약 1문장

주의사항: 
- 배경의 연한 워터마크(경기도 로고 등)에 현혹되지 말고 전면의 검은색 글씨를 정확히 읽으세요.
- 값이 명확하지 않거나 없는 항목은 빈 문자열("")로 두세요. 절대 임의의 기본값을 지어내지 마세요.`;

    const modelsToTry = ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-flash-latest"];
    let response: any = null;

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
                // 스키마를 유연하게 풀어주어 파싱 에러 방지
                responseSchema: {
                  type: Type.OBJECT,
                  properties: {
                    assistantName: { type: Type.STRING },
                    birthDate: { type: Type.STRING },
                    courseName: { type: Type.STRING },
                    trainingHours: { type: Type.STRING },
                    certNumber: { type: Type.STRING },
                    completionDate: { type: Type.STRING },
                    summary: { type: Type.STRING },
                  },
                },
              },
            }),
            timeout(25000)
          ]);

          if (response && response.text) {
            break;
          }
        } catch (err: any) {
          console.warn(`[AI Verification] Model ${modelName} attempt ${attempt} failed:`, err?.message || err);
          
          if (err.status === 429 || err.message?.includes("429") || err.message?.includes("RESOURCE_EXHAUSTED")) {
            return {
              success: false,
              error: "Gemini API 사용량 한도(Quota)를 초과했습니다. 잠시 후 다시 시도해 주세요.",
            };
          }

          if (err.status === 503 || err.message?.includes("503") || err.message?.includes("UNAVAILABLE")) {
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
        error: "AI가 수료증에서 텍스트를 읽어내지 못했습니다. 이미지 화질을 확인하거나 다시 업로드해 주세요.",
      };
    }

    const text = response.text;
    const parsed = JSON.parse(text);

    // 필수 항목이 비어있을 때만 최소한의 가드 적용 (무조건 가짜 데이터로 덮어씌우지 않음)
    const courseName = parsed.courseName?.trim() || "";
    const trainingHours = parsed.trainingHours?.trim() || "";

    if (!courseName && !trainingHours) {
      return {
        success: false,
        error: "수료증 양식을 인식했으나 강좌명과 이수 시간을 추출하지 못했습니다.",
      };
    }

    return {
      success: true,
      assistantName: parsed.assistantName?.trim() || "",
      birthDate: parsed.birthDate?.trim() || "",
      courseName: courseName || "확인 필요 (직접 입력 권장)",
      trainingHours: trainingHours || "0시간",
      certNumber: parsed.certNumber?.trim() || "",
      completionDate: parsed.completionDate?.trim() || "",
      summary: parsed.summary?.trim() || "GSEEK 수료증 AI 판독 완료",
    };

  } catch (err: any) {
    console.error("Gemini API certificate verification error:", err);
    return {
      success: false,
      error: `수료증 분석 중 오류가 발생했습니다: ${err?.message || "알 수 없는 오류"}`,
    };
  }
}
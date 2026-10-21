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

  try {
    const { mimeType, base64 } = parseDataUrl(certificateDataUrl);

    const ai = new GoogleGenAI({ apiKey: cleanKey });

    const prompt = `당신은 대한민국 장애인활동지원사 교육 수료증 전문 분석관입니다.
첨부된 수료증 사진/문서(이미지 또는 PDF)를 꼼꼼하게 판독하여 다음 수료대장 정보를 정밀 추출해 주세요.

추출 항목:
1. assistantName: 교육 이수자 성명 (수료증에 적힌 한글 성명)
2. birthDate: 생년월일 (YYMMDD 또는 YYYY-MM-DD 형식)
3. courseName: 교육과정명 (예: 활동지원사 보수교육, 이론교육, 실무직무교육 등 수료증에 기재된 정식 교육명)
4. trainingHours: 교육 인정 시간 (예: "8시간", "4시간", "40시간" 등 정확한 수치와 '시간' 표기)
5. institution: 수료증 발급기관/주관기관 (예: 한국장애인개발원, 경기장애인복지관, 수원재활센터 등 직인 또는 발급처)
6. completionDate: 수료/이수일자 (예: 2024-05-18 또는 2024.05.18)
7. certNumber: 수료증 발급 번호 (예: 제2024-호, 번호가 보이지 않으면 빈 문자열)
8. summary: 판독 내용 요약 1문장 (예: 수원재활센터 보수교육 8시간 이수 확인)`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
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
    });

    const text = response.text;
    if (!text) {
      return {
        success: false,
        error: "AI 모델로부터 판독 결과를 수신하지 못했습니다.",
      };
    }

    try {
      const parsed = JSON.parse(text);
      return {
        success: true,
        assistantName: parsed.assistantName?.trim() || "",
        birthDate: parsed.birthDate?.trim() || "",
        courseName: parsed.courseName?.trim() || "장애인활동지원사 보수교육",
        trainingHours: parsed.trainingHours?.trim() || "8시간",
        institution: parsed.institution?.trim() || "",
        completionDate: parsed.completionDate?.trim() || "",
        certNumber: parsed.certNumber?.trim() || "",
        summary: parsed.summary?.trim() || "AI 자동 판독 완료",
      };
    } catch (parseErr) {
      console.warn("JSON parse failed, text was:", text);
      return {
        success: false,
        error: "AI 응답 형식이 올바르지 않습니다.",
      };
    }
  } catch (err: any) {
    console.error("Gemini API certificate verification error:", err);
    let msg = err?.message || "수료증 분석 중 오류가 발생했습니다.";
    if (msg.includes("API key not valid") || msg.includes("API_KEY_INVALID")) {
      msg = "유효하지 않은 Gemini API 키입니다. API 키 설정을 다시 확인해 주세요.";
    } else if (msg.includes("Resource has been exhausted") || msg.includes("429")) {
      msg = "API 사용량 한도를 초과했습니다. 잠시 후 다시 시도해 주세요.";
    }
    return {
      success: false,
      error: msg,
    };
  }
}

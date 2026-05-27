/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import fs from "fs/promises";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// Increase request size limits to handle base64 image uploads
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "submissions.json");

// Ensure data directory and file exist
async function ensureDataFile() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    try {
      await fs.access(DATA_FILE);
    } catch {
      await fs.writeFile(DATA_FILE, JSON.stringify([], null, 2), "utf-8");
    }
  } catch (error) {
    console.error("Failed to initialize data store:", error);
  }
}

// Read submissions from JSON file
async function readSubmissions() {
  await ensureDataFile();
  try {
    const data = await fs.readFile(DATA_FILE, "utf-8");
    return JSON.parse(data);
  } catch (error) {
    console.error("Failed to read submissions:", error);
    return [];
  }
}

// Write submissions to JSON file
async function writeSubmissions(data: any[]) {
  await ensureDataFile();
  try {
    await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (error) {
    console.error("Failed to write submissions:", error);
  }
}

// API: Get all submissions
app.get("/api/submissions", async (req, res) => {
  try {
    const submissions = await readSubmissions();
    res.json(submissions);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// API: Submit certificate
app.post("/api/submissions", async (req, res) => {
  try {
    const { assistantName, birthDate, certificateImage } = req.body;

    if (!assistantName || !birthDate || !certificateImage) {
      return res.status(400).json({ error: "필수 입력 항목이 누락되었습니다." });
    }

    const submissions = await readSubmissions();

    const newSubmission = {
      id: "sub_" + Math.random().toString(36).substring(2, 9),
      assistantName,
      birthDate,
      certificateImage,
      submittedAt: new Date().toISOString(),
      isCompleted: false,
      trainingHours: "",
      courseName: "",
      managerNotes: "",
    };

    submissions.unshift(newSubmission);
    await writeSubmissions(submissions);

    res.json(newSubmission);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// API: Review/Verify submission
app.put("/api/submissions/:id/review", async (req, res) => {
  try {
    const { id } = req.params;
    const { isCompleted, trainingHours, courseName, managerNotes } = req.body;

    const submissions = await readSubmissions();
    const index = submissions.findIndex((s: any) => s.id === id);

    if (index === -1) {
      return res.status(404).json({ error: "해당 제출 내역을 찾을 수 없습니다." });
    }

    submissions[index].isCompleted = isCompleted === true;
    submissions[index].trainingHours = trainingHours || "";
    if (courseName !== undefined) {
      submissions[index].courseName = courseName;
    }
    submissions[index].managerNotes = managerNotes || "";
    submissions[index].reviewedAt = new Date().toISOString();

    await writeSubmissions(submissions);
    res.json(submissions[index]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// API: Delete submission
app.delete("/api/submissions/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const submissions = await readSubmissions();
    const filtered = submissions.filter((s: any) => s.id !== id);

    if (filtered.length === submissions.length) {
      return res.status(404).json({ error: "해당 제출 내역을 찾을 수 없습니다." });
    }

    await writeSubmissions(filtered);
    res.json({ success: true, message: "제출 내역이 성공적으로 삭제되었습니다." });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// API: Gemini Certificate OCR Parser
app.post("/api/submissions/ocr", async (req, res) => {
  try {
    const { imageBase64 } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ error: "수료증 이미지가 누락되었습니다." });
    }

    // Check if GEMINI_API_KEY is available
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ 
        error: "Gemini API 키가 서버에 구성되지 않았습니다. 수동으로 입력해 주세요." 
      });
    }

    // Strip out base64 heading if exists
    let rawBase64 = imageBase64;
    let mimeType = "image/png";

    if (imageBase64.includes(";base64,")) {
      const parts = imageBase64.split(";base64,");
      rawBase64 = parts[1];
      mimeType = parts[0].replace("data:", "");
    }

    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });

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

    const parsedData = JSON.parse(response.text.trim());
    res.json(parsedData);
  } catch (error: any) {
    console.error("Gemini OCR Error:", error);
    res.status(500).json({ error: "교육 수료증 정보 분석에 실패하였습니다: " + error.message });
  }
});


// Serve static/compiled assets or use Vite in dev mode
async function startServer() {
  await ensureDataFile();

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is running at http://0.0.0.0:${PORT}`);
  });
}

startServer();

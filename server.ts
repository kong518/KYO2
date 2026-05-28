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
import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore";

dotenv.config();

const app = express();
const PORT = 3000;

// Increase request size limits to handle base64 image uploads
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "submissions.json");
const CONFIG_FILE = path.join(DATA_DIR, "config.json");

// Initialize Firebase client on server-side for Firestore access
let firestoreDb: any = null;

async function getFirestoreDb() {
  if (firestoreDb) return firestoreDb;
  try {
    const configPath = path.join(process.cwd(), "firebase-applet-config.json");
    const configRaw = await fs.readFile(configPath, "utf-8");
    const firebaseConfig = JSON.parse(configRaw);
    const appInstance = initializeApp(firebaseConfig);
    firestoreDb = getFirestore(appInstance, firebaseConfig.firestoreDatabaseId);
    return firestoreDb;
  } catch (error) {
    console.error("Failed to initialize firestore connection:", error);
    return null;
  }
}

// Read config
async function readConfig() {
  await ensureDataFile();
  let localConfig: any = {};
  
  // 1. Try reading from local file first
  try {
    const data = await fs.readFile(CONFIG_FILE, "utf-8");
    localConfig = JSON.parse(data);
  } catch {
    localConfig = {};
  }

  // 2. Fetch from Firestore persistently if local cache lacks the key
  if (!localConfig.geminiApiKey) {
    try {
      const firestore = await getFirestoreDb();
      if (firestore) {
        const docRef = doc(firestore, "settings", "config");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const cloudConfig = docSnap.data();
          if (cloudConfig && cloudConfig.geminiApiKey) {
            localConfig.geminiApiKey = cloudConfig.geminiApiKey.trim();
            // Cache locally for faster subsequent access
            try {
              await fs.writeFile(CONFIG_FILE, JSON.stringify(localConfig, null, 2), "utf-8");
              console.log("Cached API Key from Firestore cloud locally.");
            } catch (e) {
              console.error("Failed to cache Cloud API Key locally:", e);
            }
          }
        }
      }
    } catch (e) {
      console.error("Failed to load API Key from Firestore cloud:", e);
    }
  }

  return localConfig;
}

// Write config
async function writeConfig(config: any) {
  await ensureDataFile();
  
  // 1. Save to local file
  try {
    await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2), "utf-8");
  } catch (error) {
    console.error("Failed to write config locally:", error);
  }

  // 2. Save persistently to central Firestore database
  if (config.geminiApiKey) {
    try {
      const firestore = await getFirestoreDb();
      if (firestore) {
        const docRef = doc(firestore, "settings", "config");
        await setDoc(docRef, {
          geminiApiKey: config.geminiApiKey.trim(),
          updatedAt: new Date().toISOString(),
        });
        console.log("Saved API Key persistently to Firestore database.");
      }
    } catch (e) {
      console.error("Failed to save API Key to Firestore cloud:", e);
    }
  }
}

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

// API: Get app configuration status
app.get("/api/settings/config", async (req, res) => {
  try {
    const config = await readConfig();
    const hasKey = !!(process.env.GEMINI_API_KEY || config.geminiApiKey);
    res.json({ hasKey });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// API: Set server-side Gemini API key
app.post("/api/settings/apikey", async (req, res) => {
  try {
    const { apiKey } = req.body;
    if (apiKey === undefined) {
      return res.status(400).json({ error: "API Key value is missing." });
    }
    const config = await readConfig();
    config.geminiApiKey = apiKey.trim();
    await writeConfig(config);
    res.json({ success: true, message: "Gemini API Key가 서버 앱 설정에 성공적으로 저장되었습니다." });
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

    // Load API Key from environment or local config stored on server
    const config = await readConfig();
    const apiKey = process.env.GEMINI_API_KEY || config.geminiApiKey || "";

    // Check if GEMINI_API_KEY is available
    if (!apiKey) {
      return res.status(505).json({ 
        error: "Gemini API 키가 서버 앱에 안전하게 저장되어 있지 않습니다. 우측 상단의 [⚙️ API Key 설정] 버튼을 눌러 먼저 API Key를 등록 및 저장해 주세요." 
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
      apiKey: apiKey,
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
    const errMsg = error.message || "";
    if (
      errMsg.includes("API key expired") || 
      errMsg.includes("API_KEY_INVALID") || 
      errMsg.includes("INVALID_ARGUMENT") || 
      errMsg.includes("key expired") ||
      errMsg.includes("400")
    ) {
      return res.status(400).json({
        error: "사용 승인된 Gemini API Key가 만료되었거나 발급 상태가 올바르지 않습니다.\n\n우측 상단의 [⚙️ Settings] 버튼 -> API Keys 탭에서 유효한 Gemini API Key를 등록 및 저장한 후 다시 시도해 주시기 바랍니다."
      });
    }
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

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface EducationCertificate {
  id: string;
  assistantName: string;
  birthDate: string;
  certificateImage: string; // Base64 Data URL
  submittedAt: string;       // ISO string
  
  // Verification states managed by administrative staff
  isCompleted: boolean;      // 교육 수강 여부 확인 (완료 / 대기)
  trainingHours: string;     // 교육 수강 시간 확인 (예: "8시간", "4시간")
  courseName?: string;       // 교육 과정 이름 (또는 OCR 자동 추출값)
  institution?: string;      // 교육기관 / 발급처
  completionDate?: string;   // 교육 이수일자
  certNumber?: string;       // 수료증 발급번호
  managerNotes?: string;     // 관리용 간단 참고용 메모
  reviewedAt?: string;
  aiVerified?: boolean;      // AI 자동 분석 및 확인 여부
  aiSummary?: string;        // AI 판독 요약 정보
}

export interface EducationStats {
  total: number;
  completedCount: number;
  pendingCount: number;
}

export interface AdminUser {
  id: string;
  name: string;
  role?: string;            // 'master' | 'admin'
  createdAt: string;
  password?: string;
  isBanned?: boolean;
  bannedAt?: string;
}

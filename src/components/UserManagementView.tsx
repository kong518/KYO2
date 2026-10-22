/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { 
  Users, 
  Ban, 
  CheckCircle2, 
  Trash2, 
  Search, 
  RefreshCw, 
  UserCheck,
  Key,
  Shield
} from "lucide-react";
import { AdminUser, EducationCertificate } from "../types";
import { db } from "../firebase";
import { 
  collection, 
  getDocs, 
  doc, 
  updateDoc, 
  deleteDoc, 
  query 
} from "firebase/firestore";

interface UserManagementViewProps {
  currentAdminName: string;
  submissions: EducationCertificate[];
  onRefreshData?: () => void;
}

export default function UserManagementView({
  currentAdminName,
}: UserManagementViewProps) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, "admins"));
      const snap = await getDocs(q);
      const list: AdminUser[] = [];
      snap.forEach((docSnap) => {
        const d = docSnap.data();
        list.push({
          id: docSnap.id,
          name: d.name || "",
          role: d.role || (d.name?.toLowerCase() === "admin" ? "master" : "admin"),
          createdAt: d.createdAt || "",
          isBanned: Boolean(d.isBanned),
          bannedAt: d.bannedAt,
        });
      });
      // Sort master first, then by date
      list.sort((a, b) => {
        if (a.role === "master") return -1;
        if (b.role === "master") return 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      setUsers(list);
    } catch (err) {
      console.error("Failed to fetch admin users:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleToggleBan = async (user: AdminUser) => {
    if (user.role === "master" || user.name.toLowerCase() === "admin") {
      alert("마스터 관리자(admin) 계정은 차단할 수 없습니다.");
      return;
    }

    const nextBanned = !user.isBanned;
    const confirmText = nextBanned
      ? `'${user.name}' 사용자를 차단(벤)하시겠습니까?\n차단된 계정은 더 이상 관리자 로그인이 불가능합니다.`
      : `'${user.name}' 사용자의 차단을 해제(언벤)하시겠습니까?`;

    if (!window.confirm(confirmText)) return;

    setActionLoadingId(user.id);
    try {
      const userRef = doc(db, "admins", user.id);
      await updateDoc(userRef, {
        isBanned: nextBanned,
        bannedAt: nextBanned ? new Date().toISOString() : null,
      });

      setUsers((prev) =>
        prev.map((u) =>
          u.id === user.id
            ? { ...u, isBanned: nextBanned, bannedAt: nextBanned ? new Date().toISOString() : undefined }
            : u
        )
      );
    } catch (err: any) {
      alert("차단 상태 변경 실패: " + err.message);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDeleteUser = async (user: AdminUser) => {
    if (user.role === "master" || user.name.toLowerCase() === "admin") {
      alert("마스터 관리자(admin) 계정은 삭제할 수 없습니다.");
      return;
    }

    if (!window.confirm(`'${user.name}' 관리자 계정을 영구 삭제하시겠습니까?`)) {
      return;
    }

    setActionLoadingId(user.id);
    try {
      await deleteDoc(doc(db, "admins", user.id));
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
    } catch (err: any) {
      alert("계정 삭제 실패: " + err.message);
    } finally {
      setActionLoadingId(null);
    }
  };

  const filteredUsers = users.filter((u) =>
    u.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const stats = {
    total: users.length,
    active: users.filter((u) => !u.isBanned).length,
    banned: users.filter((u) => u.isBanned).length,
  };

  return (
    <div className="space-y-6 font-sans" id="user-management-view">
      {/* Header Banner */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-bold">
              <Users className="w-4 h-4" />
            </div>
            <h3 className="text-base font-bold text-slate-900">
              가입 관리자 계정 명단 및 벤(차단) 제어
            </h3>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-bold">
              마스터 관리자 권한 (admin)
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
            시스템에 등록된 관리자 계정 명단을 확인하고, 부정 접근이나 불필요한 계정을 즉시 <strong>차단(벤)</strong>하거나 해제할 수 있습니다.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchUsers}
          disabled={loading}
          className="px-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-xs border border-slate-200 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>명단 새로고침</span>
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-2xs">
          <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase block">전체 등록 관리자</span>
          <h4 className="text-2xl font-bold mt-1 text-slate-900">{stats.total}명</h4>
        </div>

        <div className="p-5 bg-emerald-50/50 border border-emerald-100 rounded-2xl shadow-2xs">
          <span className="text-[10px] font-bold tracking-wider text-emerald-600 uppercase block">정상 이용 중</span>
          <h4 className="text-2xl font-bold mt-1 text-emerald-900">{stats.active}명</h4>
        </div>

        <div className="p-5 bg-rose-50/50 border border-rose-100 rounded-2xl shadow-2xs">
          <span className="text-[10px] font-bold tracking-wider text-rose-600 uppercase block">차단(벤)된 계정</span>
          <h4 className="text-2xl font-bold mt-1 text-rose-900">{stats.banned}명</h4>
        </div>
      </div>

      {/* Admin Users Table Section */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-slate-50/50">
          <div>
            <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Shield className="w-4 h-4 text-indigo-600" />
              <span>가입 관리자 계정 목록</span>
            </h4>
            <p className="text-[11px] text-slate-400 mt-0.5">
              총 {filteredUsers.length}개의 관리자 계정이 등록되어 있습니다.
            </p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="이름(ID) 검색..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[11px] font-bold">
              <tr>
                <th className="px-5 py-3">관리자 이름 (ID)</th>
                <th className="px-4 py-3">구분 및 역할</th>
                <th className="px-4 py-3">등록 일시</th>
                <th className="px-4 py-3">상태</th>
                <th className="px-5 py-3 text-right">계정 관리 / 벤 제어</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-500" />
                    <span>회원 명단을 불러오는 중입니다...</span>
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    등록된 관리자 계정이 없습니다.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  const isMaster = user.role === "master" || user.name.toLowerCase() === "admin";
                  const isSelf = user.name === currentAdminName;

                  return (
                    <tr
                      key={user.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        user.isBanned ? "bg-rose-50/20" : ""
                      }`}
                    >
                      <td className="px-5 py-3.5 font-bold text-slate-900 flex items-center gap-2">
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-[10px] ${
                            isMaster
                              ? "bg-amber-100 text-amber-800"
                              : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {user.name.slice(0, 2).toUpperCase()}
                        </div>
                        <span>{user.name}</span>
                        {isSelf && (
                          <span className="text-[10px] text-indigo-600 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded font-semibold">
                            본인
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3.5">
                        {isMaster ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                            <Key className="w-3 h-3" /> 마스터 관리자
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                            등록 관리자
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3.5 text-slate-500 text-[11px] font-mono">
                        {user.createdAt ? user.createdAt.slice(0, 16).replace("T", " ") : "-"}
                      </td>

                      <td className="px-4 py-3.5">
                        {user.isBanned ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-100/80 border border-rose-200 px-2 py-0.5 rounded-full">
                            <Ban className="w-3 h-3" /> 차단됨 (BANNED)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                            <CheckCircle2 className="w-3 h-3" /> 정상 이용
                          </span>
                        )}
                      </td>

                      <td className="px-5 py-3.5 text-right">
                        {isMaster ? (
                          <span className="text-[11px] text-slate-400 italic">
                            마스터 계정 (보호됨)
                          </span>
                        ) : (
                          <div className="flex items-center justify-end gap-1.5">
                            {user.isBanned ? (
                              <button
                                type="button"
                                onClick={() => handleToggleBan(user)}
                                disabled={actionLoadingId === user.id}
                                className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-bold rounded-lg text-[11px] transition-all cursor-pointer flex items-center gap-1"
                              >
                                <UserCheck className="w-3 h-3" />
                                <span>차단 해제</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleToggleBan(user)}
                                disabled={actionLoadingId === user.id}
                                className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold rounded-lg text-[11px] transition-all cursor-pointer flex items-center gap-1"
                              >
                                <Ban className="w-3 h-3" />
                                <span>차단하기 (벤)</span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => handleDeleteUser(user)}
                              disabled={actionLoadingId === user.id}
                              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="계정 삭제"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

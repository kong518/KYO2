const fs = require('fs');

try {
  let content = fs.readFileSync('src/App.tsx', 'utf8');

  // STEP 1: Fix Left list pane panel truncation (between 'id="admin-search-text"' and 'id="verification-inspector-pane"')
  const inputSearchAnchor = 'id="admin-search-text"';
  const rightPaneAnchor = 'id="verification-inspector-pane"';

  const startIdxList = content.indexOf(inputSearchAnchor);
  const endIdxList = content.indexOf(rightPaneAnchor);

  if (startIdxList !== -1 && endIdxList !== -1) {
    // We want to keep everything before the search input's attributes, up to "placeholder"
    const inputOpening = content.substring(0, startIdxList);
    const restOfFile = content.substring(endIdxList);

    const listReplacement = `id="admin-search-text"
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="이름, 생년월일 또는 교육과정명 검색..."
                        className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-xs bg-slate-50/20 focus:bg-white focus:outline-none transition-colors"
                      />
                    </div>

                    {/* Submissions List */}
                    <div className="flex-1 overflow-y-auto space-y-2 mt-4 pr-1 max-h-[500px]" id="submissions-list">
                      {filteredSubmissions.length === 0 ? (
                        <div className="text-center py-12 text-slate-400 text-xs">
                          검색 조건에 맞는 제출물이 없습니다.
                        </div>
                      ) : (
                        filteredSubmissions.map((sub) => {
                          const isSelected = selectedSubmission?.id === sub.id;
                          return (
                            <div
                              key={sub.id}
                              onClick={() => {
                                setSelectedSubmission(sub);
                                setCourseName(sub.courseName);
                                setTrainingHours(sub.trainingHours || "");
                                setAdminNotes(sub.adminNotes || "");
                              }}
                              className={\`p-3 rounded-xl border transition-all cursor-pointer text-left flex items-center justify-between \${
                                isSelected
                                  ? "bg-indigo-50/50 border-indigo-200 ring-1 ring-indigo-200"
                                  : "bg-white border-slate-100 hover:border-slate-200 hover:bg-slate-50"
                              }\`}
                            >
                              <div className="space-y-1">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-bold text-xs text-slate-800">\{sub.assistantName\}</span>
                                  <span className="font-mono text-[10px] text-slate-400 font-medium">(\{sub.birthDate\})</span>
                                </div>
                                <div className="text-[10px] text-indigo-600 font-semibold truncate max-w-[160px]">
                                  \{sub.courseName || "교육명 미지정"\}
                                </div>
                                <div className="flex items-center gap-2 text-[10px] text-slate-400">
                                  <span>시간: \{sub.trainingHours || "미인정"\}</span>
                                  <span>제출: \{new Date(sub.submittedAt).toLocaleDateString()\}</span>
                                </div>
                              </div>
                              <div className="shrink-0 pl-2">
                                \{sub.isCompleted ? (
                                  <span className="px-2 py-0.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold rounded-full">
                                    이수 완료
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-bold rounded-full">
                                    검토 대기
                                  </span>
                                )\}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>

                {/* RIGHT CONTEXT PANEL: Certificate Verification Workdesk details */}
                <div `;

    content = inputOpening + listReplacement + restOfFile;
    console.log("SUCCESS Step 1: Repaired submissions-list-pane list-mapping truncation.");
  } else {
    console.error("ERROR Step 1: Could not find search list anchors!", { startIdxList, endIdxList });
  }


  // STEP 2: Fix Right inspector inputs duplication and corrupted Unicode signs
  const rightInputsAnchor = '<div className="space-y-4" id="inspector-inputs">';
  const notesAnchor = '{/* Textarea for note taking */}';

  const startIdxInputs = content.indexOf(rightInputsAnchor);
  const endIdxInputs = content.indexOf(notesAnchor);

  if (startIdxInputs !== -1 && endIdxInputs !== -1) {
    const before = content.substring(0, startIdxInputs);
    const after = content.substring(endIdxInputs);

    const rightPanelReplacement = `<div className="space-y-4" id="inspector-inputs">
                          
                          {/* 작성 인적사항 section */}
                          <div className="bg-slate-50 border border-slate-100 rounded-xl p-3.5 space-y-3">
                            <span className="block text-xs font-bold text-slate-600 border-b border-slate-200/60 pb-1.5">작성 인적사항</span>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <span className="text-slate-400 text-[10px] block font-semibold">성명</span>
                                <p className="text-slate-800 text-sm font-semibold">{selectedSubmission.assistantName}</p>
                              </div>
                              <div>
                                <span className="text-slate-400 text-[10px] block font-semibold">생년월일(6자리)</span>
                                <p className="text-slate-800 text-sm font-mono font-semibold">{selectedSubmission.birthDate}</p>
                              </div>
                            </div>
                          </div>

                          {/* Editable fields */}
                          <div className="space-y-3.5" id="verifying-editable-inputs">
                            <div>
                              <label className="block text-xs font-semibold text-slate-700 mb-1 flex justify-between">
                                <span>교육과정 과정명 <span className="text-indigo-600">*</span></span>
                                <span className="text-[10px] text-indigo-500 font-medium">(수정 가능)</span>
                              </label>
                              <input
                                id="admin-course-name"
                                type="text"
                                value={courseName || ""}
                                onChange={(e) => setCourseName(e.target.value)}
                                placeholder="예: 발달장애인 지원사 보수교육 과정"
                                className="w-full px-3 py-2 border border-slate-200 bg-white rounded-xl text-xs font-semibold focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-550 transition-colors text-slate-800"
                              />
                            </div>

                            <div>
                              <label className="block text-xs font-semibold text-slate-700 mb-1 flex justify-between">
                                <span>수강 인정 시간 (숫자) <span className="text-indigo-600">*</span></span>
                                <span className="text-[10px] text-indigo-500 font-medium">(수정 가능)</span>
                              </label>
                              <input
                                id="admin-training-hours"
                                type="text"
                                value={trainingHours || ""}
                                onChange={(e) => setTrainingHours(e.target.value)}
                                placeholder="인정 교육 시간 수 기입 (예: 4)"
                                className="w-full px-3 py-2 border border-slate-200 bg-white rounded-xl text-xs font-mono font-semibold focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-555 transition-colors text-slate-800"
                              />
                              <p className="text-[10px] text-slate-400 mt-1">인정하는 실 수강 시간(숫자)을 정확히 변경 및 매핑하여 주십시오.</p>
                            </div>
                          </div>

                        </div>

                      </div>

                      `;

    content = before + rightPanelReplacement + after;
    console.log("SUCCESS Step 2: Repaired right-panel input duplicate fields and invalid tags.");
  } else {
    console.error("ERROR Step 2: Could not find right panel anchors!", { startIdxInputs, endIdxInputs });
  }

  // Write files back
  fs.writeFileSync('src/App.tsx', content, 'utf8');
  console.log("OVERALL SUCCESS: Automatically repaired App.tsx!");
} catch (err) {
  console.error("CRITICAL ERROR: Failed to execute automated code repair script:", err);
}

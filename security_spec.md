# Firebase Security Specification (TDD SPEC)

## 1. Data Invariants

1. **Submission Creation**: Anyone (anonymous or verified) can create a submission to allow public entry from external training targets.
2. **Submission Verification**: Editing or writing fields like `trainingHours`, `courseName`, `isCompleted` or modifying existing entries is restricted exclusively to administrators or designated verifiers.
3. **Data Integrity**: The `assistantName` and `birthDate` fields are strictly required, must be string types, and must comply with realistic length and format boundaries.
4. **Temporal Consistency**: `submittedAt` and `reviewedAt` must align with server timestamps (`request.time`) or valid ISO 8601 strings. 
5. **PII and Image Protection**: Non-owners (unauthorized general users) must not be allowed to arbitrary scrape list queries of all available submissions.

---

## 2. The "Dirty Dozen" Malicious Payloads (Vulnerability Scenarios)

Below are the 12 malicious payloads designed to bypass identity, integrity, and states in the Firestore `submissions` collection. All of these must be rejected with `PERMISSION_DENIED`.

### Scenario 1: Unrestricted List Scraping by General User
- **Intent**: Anyone queries or pulls the entire spreadsheet list containing PII.
- **Payload/Query**: `db.collection('submissions').get()` without filter constraints or admin credentials.

### Scenario 2: Overwriting Existing Verified Record
- **Intent**: An external user tries to modify or approve a submission they do not own.
- **Payload**: `updateDoc(doc(db, 'submissions', 'existing_sub_123'), { isCompleted: true, trainingHours: '100' })` by a guest user.

### Scenario 3: Missing Required Fields on Create
- **Intent**: Injecting corrupted data.
- **Payload**: `{ birthDate: "740125" }` (Missing `assistantName` and `certificateImage`).

### Scenario 4: Poisonous Data Type Injection
- **Intent**: Setting `trainingHours` to an array or boolean instead of string.
- **Payload**: `{ assistantName: "김철수", birthDate: "810214", certificateImage: "...", trainingHours: [8, 12] }`

### Scenario 5: Buffer Overflow Attack (Massive Payload ID)
- **Intent**: Injecting 1MB of garbage into the document ID.
- **Payload**: Creating a document with ID `A * 1000000`.

### Scenario 6: Changing Immutable Metadata Fields
- **Intent**: Altering `submittedAt` timestamp post-creation to bypass deadlines.
- **Payload**: `updateDoc(doc(db, 'submissions', 'sub_1'), { submittedAt: "1990-01-01T00:00:00Z" })`

### Scenario 7: State Shortcutting / Self-approval
- **Intent**: 활동지원사 (Assistant) self-approves their training hours without admin review.
- **Payload**: `{ assistantName: "이영희", birthDate: "900505", isCompleted: true, trainingHours: "8" }` on creation by a guest.

### Scenario 8: Invalid Date of Birth Format (Value Poisoning)
- **Intent**: Bypassing date of birth length bounds.
- **Payload**: `{ assistantName: "윤하늬", birthDate: "1995-12-31-VERY-LONG-STRING...", certificateImage: "..." }`

### Scenario 9: Image Injection of non-base64 format / massive string
- **Intent**: Storing corrupted image indicators.
- **Payload**: `{ certificateImage: ["not", "base64"] }`

### Scenario 10: Unauthorized Administrative Review Modify
- **Intent**: Changing `managerNotes` of an active review by a general visitor.
- **Payload**: `updateDoc(doc(db, 'submissions', 'sub_1'), { managerNotes: "This assistant is super great!" })`

### Scenario 11: Attempting Bulk Delete (DoS)
- **Intent**: An adversary tries to invoke `deleteDoc` on submissions to clear records.
- **Payload**: `deleteDoc(doc(db, 'submissions', 'sub_123'))` by non-admin.

### Scenario 12: Injection of Hidden Privilege Role Field
- **Intent**: Injecting `role: "admin"` directly inside the submission object.
- **Payload**: `{ assistantName: "홍길동", birthDate: "720911", role: "admin" }`

---

## 3. Test Validation Plan

We will deploy a highly restricted Firebase security ruleset (`firestore.rules`) with clean guards that protect the submission collection matching these invariants.

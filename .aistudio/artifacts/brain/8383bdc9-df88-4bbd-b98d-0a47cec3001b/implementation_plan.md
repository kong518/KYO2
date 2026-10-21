# Multi-Role System Implementation Plan

This plan outlines the transition from a single-user tool to a multi-tenant application with a public submission interface and a secure administrator portal.

## Overview
- **Goal**: Enable public users to submit certificate photos and data without handling API keys, while providing administrators with a secure, partitioned portal to manage, analyze, and export submissions.
- **Roles**:
  - **Submitter (Public)**: Submits name, birthdate, and certificate photo. No login required.
  - **Administrator (Admin)**: Logs in via Google OAuth, manages their specific submissions, and runs AI analysis (individual or batch).

## User Review & Critical Decisions
- **Confirmed Decision 1**: Admins use Google OAuth for login.
- **Confirmed Decision 2**: Admin accounts are created manually (by the developer or super-admin).
- **Confirmed Decision 3**: Analysis can be triggered both individually (on-demand) and in batch.

## 1. Core Concept
- **Public Submission**: A simplified landing page (the current form) that saves data directly to Firestore with a `pending` status.
- **Admin Portal**: A password-protected dashboard (accessible only to authorized emails) that pulls `pending` submissions, allows viewing/editing, and performs AI analysis using the *admin's* or *system-configured* API key.

## 2. User Experience & Visual Design
- **Public Page**: Maintain existing UI for simplicity, focusing on rapid data entry.
- **Admin Portal**:
  - **Dashboard**: A list view of submissions (Date, Name, Status, Thumbnail).
  - **Action Bar**: "Analyze Selected", "Download CSV", "Mark as Processed".
  - **Data Detail View**: Full screen view of the certificate, editable text fields for extracted data, and "Analyze" button if auto-extraction needs correction.

## 3. Technical Architecture & Data Strategy
- **Data Model**:
  - `submissions`: `{ id, submitterName, birthdate, photoUrl, status: 'pending' | 'analyzed', extractedData: {}, adminId: string, createdAt }`
  - `admins`: `{ uid, email, role: 'admin' }`
- **Security**: Firestore Rules will enforce that `submissions` can only be read/updated by the user whose UID matches the `adminId` field (or a super-admin).
- **Processing**:
  - A cloud function or a secure frontend handler will manage the Gemini API interactions, ensuring API keys are never exposed in client-side code.

## 4. Key Implementation Steps
1. **Infrastructure**: Provision Google Auth, setup `admins` collection.
2. **Public Submission**: Update the current form to write to `submissions` instead of immediate analysis.
3. **Admin Auth**: Implement a login wrapper that redirects to the Admin Portal.
4. **Admin Dashboard**: Build the list view and detail view with analysis triggers.
5. **Rules**: Harden security rules to ensure data isolation between admins.

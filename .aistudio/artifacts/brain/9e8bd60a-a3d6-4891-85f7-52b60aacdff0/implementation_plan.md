# Luyện Thi Pro - Implementation Plan

Hệ thống quản lý lớp học và luyện thi trực tuyến, hỗ trợ giáo viên quản lý lớp, xây dựng kho đề, giao bài tập trực tuyến và theo dõi báo cáo kết quả học tập của học sinh.

## 1. Overview & Core Concept

- **What It Does**: Provides a dashboard-based platform for teachers to manage student classes, organize question banks, administer online tests with automatic grading, and visualize student progress.
- **Target Audience / Persona**: Teachers (creating content, managing classes, viewing analytics) and Students (taking tests, viewing results).
- **Key Value**: Centralized platform for streamlined test preparation and data-driven performance monitoring.

## 2. User Experience & Visual Design

- **Key User Flows**:
    - **Teacher**: Auth -> Dashboard -> Create Class -> Create Question Bank -> Compose Test -> Assign Test -> View Reports.
    - **Student**: Auth -> Dashboard -> Join Class -> View Assigned Tests -> Take Test -> Review Results.
- **Visual Identity & Theme**:
    - *Aesthetic Direction*: Professional, clean, and utilitarian dashboard.
    - *Color Palette*: Dominant neutral canvas (`#F8FAFC`), structural surfaces (light slate borders), accent budget (`#0284C7` / `#059669`).
    - *Typography*: Clean `Plus Jakarta Sans` for titles, `DM Sans` for body, `IBM Plex Mono` for tabular data.
- **Design Patterns**: Two-zone sandbox for test-taking and report visualization, segmented control filters, clean typographic metadata.

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Persistence**
    - *Chosen Approach*: Firebase Firestore.
    - *Why*: Reliable, scalable, and simplifies real-time updates for test results and class interactions.
- **Decision 2: State Management**
    - *Chosen Approach*: React context for Auth + lightweight local state (`useState`/`useEffect`) for component-specific data.
    - *Why*: Sufficient for the application's complexity without introducing unnecessary overhead.

## 4. Technical Architecture & Data Strategy

```
┌──────────────────────────────────────────────┐
│                  Firebase                    │
│   (Auth, Firestore: Users, Classes, Exams)   │
└──────────────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│           React SPA (Vite + Tailwind)        │
│ ┌──────────────┐ ┌──────────────┐ ┌────────┐ │
│ │  Teacher App │ │  Student App │ │ Auth   │ │
│ └──────────────┘ └──────────────┘ └────────┘ │
└──────────────────────────────────────────────┘
```

- **Data Model**:
    - `users`: `{ uid, email, role (teacher/student), profile }`
    - `classes`: `{ id, name, teacherId, studentIds: [] }`
    - `questionBanks`: `{ id, teacherId, name, questions: [] }`
    - `exams`: `{ id, classId, title, questions: [], status, timeLimit }`
    - `submissions`: `{ id, examId, studentId, answers: [], score }`

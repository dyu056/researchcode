# Literature Review Engine - Frontend Specification

## Overview

Simplified React/TypeScript frontend for the Literature Review Engine. No D3 graph - citation trees are static LaTeX/TikZ diagrams in the output document.

## Tech Stack

- React 18 + TypeScript + Vite
- TanStack Query v5 (API + SSE streaming)
- Zustand (global UI state)
- Tailwind CSS + dark mode
- MathJax (LaTeX rendering)

## Page Structure

```
/                           → redirect to /new
/new                        → SurveyWizard
/surveys/:id               → SurveyDashboard (layout shell)
/surveys/:id/papers        → Papers table
/surveys/:id/schools       → Schools of thought
/surveys/:id/socratic      → Socratic analysis
/surveys/:id/document      → Literature review preview + download
/surveys/:id/labs          → Top labs table
```

## Component Architecture

```
Router
└── Layout
    ├── Header (title, theme toggle)
    ├── TabBar (5 tabs)
    └── Routes
        ├── /new
        │   └── SurveyWizard
        │       ├── Step 1: Topic input OR seed papers
        │       └── Start button → POST /api/surveys/start
        └── /surveys/:id
            ├── ProgressPanel (SSE-driven live metrics)
            ├── /papers
            │   ├── PapersTable (paginated)
            │   └── PaperCard
            ├── /schools
            │   ├── SchoolsList
            │   └── SchoolCard (papers, methodology, timeline)
            ├── /socratic
            │   ├── DisagreementCard (side A/B arguments)
            │   ├── MentalModelCard
            │   └── QuestionCard (+ annotation why distinguishes understanding)
            ├── /document
            │   ├── LatexPreview (MathJax)
            │   └── DownloadBar (PDF / LaTeX)
            └── /labs
                └── LabsTable (filterable, sortable)
```

## State Management

### Three-tier state model

| Tier | Tool | What it holds |
|------|------|---------------|
| Global UI | Zustand | activeSurveyId, activeTab, theme, selectedPaperId |
| Server State | TanStack Query | papers, schools, socratic, labs, graph data |
| Local UI | useState | form inputs, panel collapse, filters |

### SSE Streaming

`useSurveyStatus(surveyId)` connects to `GET /api/surveys/{id}/status` (SSE) and pushes events into TanStack Query cache. ProgressPanel and dashboard header both subscribe to the same cache entry.

## API Client

```typescript
const api = {
  startSurvey: (body: { topic?: string; seedPapers?: string[] }) =>
    req<{ surveyId: string }>('/api/surveys/start', { method: 'POST', body }),

  getPapers: (id: string, page = 1) =>
    req<{ papers: Paper[]; total: number }>(`/api/surveys/${id}/papers?page=${page}`),

  getSchools: (id: string) =>
    req<{ schools: School[] }>(`/api/surveys/${id}/schools`),

  getSocratic: (id: string) =>
    req<SocraticAnalysis>(`/api/surveys/${id}/socratic`),

  getLabs: (id: string) =>
    req<{ labs: Lab[] }>(`/api/surveys/${id}/top-labs`),

  downloadLatex: (id: string) => `${BASE}/api/surveys/${id}/latex`,
  downloadPdf: (id: string) => `${BASE}/api/surveys/${id}/pdf`,

  getStatusUrl: (id: string) => `${BASE}/api/surveys/${id}/status`,
};
```

## Core Types

```typescript
export type SurveyStage =
  | 'idle' | 'retrieving' | 'building_graph'
  | 'analyzing_schools' | 'generating_analysis'
  | 'complete' | 'error';

export interface ProgressMetrics {
  papersRetrieved: number;
  papersAnalyzed: number;
  edgesFound: number;
  communities: number;
}

export interface Paper {
  id: string;
  doi?: string;
  title: string;
  authors: string[];
  year: number;
  abstract: string;
  citationCount: number;
  venue: string;
  url: string;
  schools: string[];
}

export interface School {
  id: string;
  name: string;
  description: string;
  paperIds: string[];
  methodology: string;
  timeline: Array<{ year: number; milestone: string }>;
}

export interface Disagreement {
  question: string;
  sideA: { claim: string; paperIds: string[] };
  sideB: { claim: string; paperIds: string[] };
}

export interface MentalModel {
  name: string;
  description: string;
  paperIds: string[];
}

export interface SocraticQuestion {
  question: string;
  annotation: string;  // why this distinguishes understanding vs memorization
  relatedPaperIds: string[];
}

export interface SocraticAnalysis {
  disagreements: Disagreement[];
  mentalModels: MentalModel[];
  questions: SocraticQuestion[];
}

export interface Lab {
  name: string;
  university: string;
  country: string;
  keyResearchers: string[];
  paperCount: number;
  website?: string;
}
```

## SSE Event Schema

```
event: progress
data: {"stage":"retrieving","metrics":{"papersRetrieved":42,...}}

event: stage_complete
data: {"stage":"building_graph","nextStage":"analyzing_schools"}

event: complete
data: {"latexUrl":"/api/surveys/{id}/latex"}
```

## Build Order

| Phase | Days | Deliverable |
|-------|------|-------------|
| 1. Foundation | 2-3 | Project setup, API client, types, routing, layout |
| 2. Survey + SSE | 2 | Start survey, live progress panel |
| 3. Papers + Schools | 2-3 | Papers table, schools list |
| 4. Socratic | 2 | Disagreements, mental models, questions |
| 5. Document + Labs | 2 | LaTeX preview (MathJax), labs table |
| 6. Polish | 1-2 | Dark mode, error handling, testing |

## Vite Proxy

```typescript
// vite.config.ts
export default defineConfig({
  server: {
    proxy: {
      '/api': { target: 'http://localhost:8000', changeOrigin: true },
    },
  },
});
```

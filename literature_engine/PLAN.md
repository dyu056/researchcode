# Literature Review Engine - Implementation Plan

## Vision

Build an AI-powered Surveyor that:
1. **Builds Citation Trees**: Creates a tree diagram of entire research fields from citation networks
2. **Identifies Root Nodes**: Finds foundational textbooks/papers that form the roots
3. **Traces Main Lines**: Uses Markov chain modeling to trace mainstream development paths
4. **Classifies Debates**: Identifies different schools of thought/routes in academic development
5. **Generates Socratic Analysis**:
   - "3 places where experts fundamentally disagree, and each side's strongest argument"
   - "5 core mental models every expert in this field shares"
   - "10 questions that expose deep understanding vs memorization"

## Core Architecture

### Data Layer
- Multi-source retrieval: Semantic Scholar (primary), OpenAlex, arXiv, CrossRef
- Canonical `Paper` schema with DOI deduplication
- Diskcache + SQLite for persistent storage

### Citation Graph Engine
- `CitationGraph` built with NetworkX
- **Root identification**: Scoring formula combining indegree, age, influential citation count, synthesis ratio
- **Citation forest**: BFS from roots following incoming edges
- **Louvain community detection** for schools of thought

### Markov Chain Model
- **State space**: (methodology, application) clusters via BERTopic
- **Transition matrix**: P(topic_j | topic_i) weighted by recency
- **Beam search** to trace mainstream development paths
- **Entropy analysis** to detect branch points (paradigm shifts)

### LLM Orchestration (5 Stages)
```
Stage 1: Per-paper analysis (parallel, GPT-4o-mini)
Stage 2: School synthesis (per community)
Stage 3: Cross-school disagreement finding
Stage 4: Socratic question generation
Stage 5: LaTeX document assembly
```

### Socratic Outputs
- "3 fundamental disagreements" with each side's strongest argument
- "5 core mental models" shared by experts
- "10 questions" exposing memorization vs. deep understanding

## File Structure
```
literature_engine/
├── schemas/paper.py          # Paper dataclass
├── data/retrieval_engine.py # Multi-source API
├── graph/citation_graph.py  # Graph construction
├── markov/transition_matrix.py
├── llm/socratic_generator.py
└── output/latex_generator.py
```

## Key Challenges & Solutions

1. **Incomplete citation data** → Multi-source triangulation with confidence scores
2. **LLM hallucination** → Ground every claim in paper data, two-pass verification
3. **Cost at scale** → Hierarchical sampling (200 full analysis + rest metadata only)
4. **Topic coherence** → BERTopic with coherence score optimization

---

## Frontend Specification

### Simplified Frontend (No D3 Graph)

The frontend delivers:
1. **Survey Wizard** - enter topic
2. **Progress Panel** - streaming SSE status
3. **Papers Table** - paginated list with filters
4. **Schools of Thought** - expandable cards with paper lists
5. **Socratic Analysis** - text sections (disagreements, mental models, questions)
6. **Literature Review** - rendered LaTeX/MathJax preview + download PDF
7. **Top Labs** - filterable table

### Citation Tree Output
- Static citation tree as LaTeX TikZ diagram or PNG embedded in document
- NOT an interactive web visualization
- Markov chain traces "main line development" as text paths

### Tech Stack
- React 18 + TypeScript + Vite
- TanStack Query v5 for API + SSE
- Zustand for global UI state
- Tailwind CSS + dark mode
- MathJax for LaTeX rendering

### API Endpoints
```
POST /api/surveys/start          # Start new survey with topic/seeds
GET  /api/surveys/{id}/status   # SSE stream for progress
GET  /api/surveys/{id}/papers   # Paginated papers
GET  /api/surveys/{id}/schools  # Schools of thought
GET  /api/surveys/{id}/socratic # Socratic analysis
GET  /api/surveys/{id}/latex    # Download LaTeX
GET  /api/surveys/{id}/pdf       # Download PDF
GET  /api/surveys/{id}/top-labs # Top labs data
```

### Component Structure
```
src/
├── routes/
│   ├── index.tsx                    ← redirect to /new
│   ├── new.tsx                     ← SurveyWizard
│   └── surveys/
│       ├── $id.tsx                 ← SurveyDashboard layout
│       ├── $id.papers.tsx
│       ├── $id.schools.tsx
│       ├── $id.socratic.tsx
│       ├── $id.document.tsx
│       └── $id.labs.tsx
├── components/
│   ├── layout/Layout, Header, TabBar
│   ├── survey/ProgressPanel, SurveyWizard
│   ├── papers/PapersTable, PaperCard
│   ├── schools/SchoolsList, SchoolCard
│   ├── socratic/SocraticDashboard, DisagreementCard, QuestionCard
│   ├── document/LatexPreview
│   └── labs/LabsTable
├── hooks/
│   ├── useSurveyStatus.ts (SSE)
│   ├── usePapers.ts
│   ├── useSchools.ts
│   ├── useSocratic.ts
│   └── useLabs.ts
├── api/
│   ├── client.ts
│   └── types.ts
└── store/
    └── useSurveyStore.ts
```

## Implementation Order

| Phase | Days | Deliverable |
|-------|------|-------------|
| 1. Foundation | 2-3 | Project setup, API client, types, routing |
| 2. Survey + SSE | 2 | Start survey, live progress |
| 3. Papers + Schools | 2-3 | Papers table, schools list |
| 4. Socratic | 2 | Disagreements, mental models, questions |
| 5. Document + Labs | 2 | LaTeX preview, labs table |
| 6. Polish | 1-2 | Dark mode, error handling, testing |

**Total: ~11-14 days**

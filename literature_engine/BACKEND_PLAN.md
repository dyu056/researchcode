# Literature Review Engine - Backend Technical Plan

## Executive Summary

**Recommended stack**: Python (core engine) + Neo4j or NetworkX (citation graphs) + LangChain/LiteLLM (LLM orchestration) + React/TypeScript (frontend) + LaTeX (output).

**Estimated timeline**: 12-16 weeks for full implementation, with a working MVP in 6-8 weeks.

---

## 1. Data Gathering Strategy

### 1.1 Source Priority Matrix

| Source | Coverage | Depth | Rate Limit | Auth Required | Priority |
|--------|----------|-------|------------|---------------|----------|
| Semantic Scholar API | High (8M+ papers) | Full abstracts, citations, author metadata | 100 req/s free tier | Free API key | **Primary** |
| arXiv API | Medium (2M+ papers) | Full text (PDF/LaTeX), abstracts, references | 1 req/3s per IP | None | **Primary (CS/Physics)** |
| CrossRef API | High | Metadata + DOI resolution, limited citations | 50 req/s | Free token | **Secondary** |
| OpenAlex API | High | Citations, concepts, institutions, papers | 10 req/s | Free token | **Secondary** |
| Google Scholar (scraping) | Very High | Full citation data | Blocked often | None | **Last resort / enrichment only** |
| University lab websites | Low | Targeted lab papers, preprints | N/A | None | **Tertiary (enrichment)** |

### 1.2 Data Schema

```python
@dataclass
class Paper:
    paper_id: str                    # Canonical ID (prefer DOI > arXiv ID > hash)
    doi: Optional[str] = None
    arxiv_id: Optional[str] = None
    title: str
    authors: list[str] = field(default_factory=list)
    year: Optional[int] = None
    venue: Optional[str] = None      # Conference/journal name
    abstract: Optional[str] = None
    raw_citations: list[str] = field(default_factory=list)   # IDs of papers this cites
    raw_cited_by: list[str] = field(default_factory=list)    # IDs of papers citing this
    citation_count: int = 0
    fields_of_study: list[str] = field(default_factory=list)
    tldr: Optional[str] = None       # Semantic Scholar provides this
    influential_citation_count: int = 0
    url: Optional[str] = None
    pdf_url: Optional[str] = None
    source: str = ""
```

### 1.3 Multi-Source Normalization Pipeline

Build source adapters with a common interface:

```
PaperSource (abstract base)
├── SemanticScholarAdapter  (implements: search, get_by_id, get_citations)
├── ArxivAdapter            (implements: search, get_by_id, get_references_from_pdf)
├── CrossRefAdapter         (implements: search, get_by_id)
├── OpenAlexAdapter         (implements: search, get_citation_graph)
└── LabWebsiteAdapter       (implements: scrape_lab_page)
```

---

## 2. Citation Tree Building Algorithm

### 2.1 Graph Construction

Build a **directed citation graph** `G = (V, E)` where:
- Nodes `V` = papers
- Edges `E` = directed edges from citing paper to cited paper

### 2.2 Identifying Root Nodes (Foundational Works)

A foundational paper has:
1. High indegree (cited by many papers) relative to its year
2. Low outdegree (cites few prior papers)
3. Old relative to the field
4. High influential citation count

```python
def foundational_score(paper: Paper, graph: nx.DiGraph) -> float:
    indegree = graph.in_degree(paper.canonical_id)
    outdegree = graph.out_degree(paper.canonical_id)
    age_factor = max(1, 2026 - paper.year) / 30
    synthesis_ratio = outdegree / (indegree + 1)

    score = (
        0.4 * min(indegree / 100, 1.0) +
        0.3 * min(paper.influential_citation_count / 50, 1.0) +
        0.2 * age_factor +
        0.1 * (1 - min(synthesis_ratio, 1.0))
    )
    return score
```

### 2.3 Building the Citation Tree

BFS from roots following incoming edges (papers that cite the root).

### 2.4 Detecting Schools of Thought

Apply **Louvain community detection** on the undirected version of the citation graph.

---

## 3. Markov Chain Model for Field Development

### 3.1 State Space Definition

```
State = (methodology_topic, application_domain)
```

Cluster papers into states using **BERTopic** on abstracts.

### 3.2 Transition Matrix

```
P(topic_j | topic_i) = probability that a paper in topic i cites topic j
```

Weighted by recency using exponential time decay.

### 3.3 Tracing Mainstream Development Paths

Beam search from root-state to present, using transition probability as score.

### 3.4 Identifying Branch Points

High-entropy states in the transition matrix = paradigm shifts / major debates.

---

## 4. LLM Orchestration Flow

### Stage 1: Per-Paper Analysis (parallel)
```python
class PaperAnalysis(BaseModel):
    methodology: str
    contribution_type: str
    key_assumptions: list[str]
    limitations: list[str]
    disagreement_with: list[str]
    agreement_with: list[str]
    school_of_thought: str
```

### Stage 2: School Synthesis
Synthesize per-school analyses into defining characteristics, core mental models, disagreements.

### Stage 3: Cross-School Disagreements
Identify top 3 fundamental disagreements between schools with strongest arguments.

### Stage 4: Socratic Question Generation
Generate:
- "3 fundamental disagreements" with each side's strongest argument
- "5 core mental models" shared by experts
- "10 questions" exposing deep understanding vs memorization

### Stage 5: LaTeX Document Assembly

---

## 5. File Outputs

| Output | Format | Location |
|--------|--------|----------|
| Full literature review | `.tex` + `.pdf` | `output/{session_id}/literature_review.tex` |
| Citation tree | `.dot` (GraphViz) + `.png` | `output/{session_id}/citation_tree/` |
| Socratic analysis | `.md` + integrated into LaTeX | `output/{session_id}/socratic_analysis.md` |
| Top labs directory | `.csv` + `.json` | `output/{session_id}/top_labs.csv` |
| Development path | `.json` | `output/{session_id}/development_paths.json` |

---

## 6. Key Challenges and Mitigation

| Challenge | Mitigation |
|-----------|------------|
| Citation graph incomplete | Multi-source triangulation + confidence scores |
| LLM hallucination | Ground every claim in paper data, two-pass verification |
| Computational cost at scale | Hierarchical sampling (200 full analysis + rest metadata) |
| Topic modeling quality | BERTopic with coherence score optimization |

---

## 7. Implementation Roadmap

| Phase | Weeks | Milestone |
|-------|-------|-----------|
| Phase 1: Data Foundation | 1-3 | Paper retrieval from 3+ sources |
| Phase 2: Graph Engine | 3-5 | Citation graph + root identification |
| Phase 3: Markov Model | 5-7 | Topic classification + development paths |
| Phase 4: LLM Orchestration | 7-10 | Full Socratic analysis pipeline |
| Phase 5: Output Generation | 10-12 | LaTeX + citation tree visualization |
| Phase 6: Refinement | 12-16 | Quality tuning, local model fallback |

---

## 8. Success Metrics

| Metric | Target |
|--------|--------|
| Citation graph coverage | >80% of Semantic Scholar references found |
| Root node precision | >75% of top-10 scored papers actually foundational |
| School of thought coherence | >80% map to real research communities |
| Socratic question quality | >70% rated "good" by domain expert |
| End-to-end cost | <$10 in LLM API calls per 500-paper survey |
| Processing time | <30 minutes for 500-paper survey |

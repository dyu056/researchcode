# Literature Review Engine - Phase 1 Plan

## Revised Vision

### Layout
```
┌─────────────────────────────────────────────────────────────────┐
│  Header: Topic Title + Controls                                 │
├──────────────────────────────┬────────────────────────────────┤
│                              │                                 │
│   Literature Tree             │   OpenCode Terminal / Chat      │
│   (Main Display Area)        │   (Interactive Code Interface)  │
│                              │                                 │
│   - Nodes = Papers           │   - Direct access to opencode  │
│   - Hierarchical layout      │   - Opencode can call API      │
│   - Hover shows details      │   - User can interact via     │
│   - Click to expand/collapse │     natural language           │
│                              │                                 │
└──────────────────────────────┴────────────────────────────────┘
```

### Literature Node Data Structure
```typescript
interface LiteratureNode {
  id: string;                    // unique ID (DOI or hash)
  title: string;                // paper title
  authors: string[];             // author names
  link: string;                 // URL to paper (DOI, arXiv, venue)
  abstract: string;              // paper abstract
  rank: {
    influenceIndex: number;      // citation count / influence metric
    isBestPaper: boolean;       // best paper award
    venue: string;              // conference/journal
    venuePrestige: 'top' | 'high' | 'medium' | 'low';
  };
  citations: string[];           // IDs of papers this paper cites (previous layer)
  citedBy: string[];             // IDs of papers citing this (next layer)
  organizations: string[];       // MIT, Stanford, Berkeley, etc.
}
```

## Phase 1 Scope: "Trace-Up" Function

### Goal
Starting from 10 best papers from well-known organizations, trace backwards through citations until reaching:
1. A root paper (foundational work with no further citations in our data)
2. OR a textbook-level node (papers that summarize entire fields)

### Algorithm
```
1. INPUT: Research topic (e.g., "Attention Mechanisms in Transformers")
2. FIND SEED PAPERS:
   - Query Semantic Scholar for top papers on topic
   - Filter by: citation count > threshold, from top universities
   - Select top 10 as seeds
3. TRACE-UP LOOP:
   For each seed paper:
     While (has citations AND depth < max_depth):
       Get paper's references (who it cites)
       Add references as child nodes
       Move to next depth level
       Stop if: reach root OR hit textbook-level paper OR depth exhausted
4. OUTPUT: Tree of citations from seeds back to roots
```

### Textbook Detection Heuristic
A paper is "textbook-level" if:
- Published > 20 years ago AND citation count > 10,000
- OR title contains "introduction", "foundations", "principles", "handbook"
- OR it's a well-known survey paper with 500+ citations

## Frontend Components

### 1. Tree View (Left Panel)
```typescript
// React component structure
<LiteratureTree>
  <TreeNode
    data={LiteratureNode}
    onHover={showTooltip}
    onClick={toggleExpand}
    isExpanded={boolean}
    depth={number}
  />
</LiteratureTree>

// D3 or custom tree layout
// Hierarchical layout: root at top or left, children expand right/down
// Node rendering: card with title, authors, rank badges
// Hover tooltip: full details panel
```

### 2. Tooltip on Hover
Shows complete node information:
```
┌─────────────────────────────┐
│ [Venue Badge] [Rank: #42]   │
│ Title: Attention Is All...   │
│ Authors: Vaswani et al.     │
│ Organizations: Google Brain  │
│ ─────────────────────────────│
│ Abstract:                   │
│ We propose a new architect...│
│ ─────────────────────────────│
│ Citations: 89,234            │
│ Cited By: 1,203 papers       │
│ [Link to Paper]             │
└─────────────────────────────┘
```

### 3. Chat/Terminal (Right Panel)
- Embedded opencode terminal (same relay mechanism as Sparker)
- User can ask: "Explain this paper", "Find related work", "Expand this branch"
- Opencode has access to tree API to read/modify the tree

## API Endpoints

### Tree Management
```
POST   /api/trees                    # Create new tree for topic
GET    /api/trees/{id}               # Get full tree structure
DELETE /api/trees/{id}               # Delete tree

GET    /api/trees/{id}/nodes         # List all nodes (paginated)
GET    /api/trees/{id}/nodes/{nodeId} # Get single node details
POST   /api/trees/{id}/nodes/{nodeId}/expand  # Expand node (fetch citations)
POST   /api/trees/{id}/nodes/{nodeId}/trace-up # Trace up from node
```

### Tree Node Schema
```typescript
// GET /api/trees/{id}
{
  id: string;
  topic: string;
  createdAt: string;
  rootNodes: string[];  // IDs of root nodes
  nodes: Record<string, LiteratureNode>;  // nodeId -> node data
}
```

## Data Model

### SQLite Tables
```sql
CREATE TABLE trees (
  id TEXT PRIMARY KEY,
  topic TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE nodes (
  id TEXT PRIMARY KEY,
  tree_id TEXT REFERENCES trees(id),
  title TEXT NOT NULL,
  authors TEXT,  -- JSON array
  link TEXT,
  abstract TEXT,
  influence_index INTEGER DEFAULT 0,
  is_best_paper BOOLEAN DEFAULT FALSE,
  venue TEXT,
  venue_prestige TEXT,
  organizations TEXT,  -- JSON array
  citations TEXT,  -- JSON array of node IDs
  cited_by TEXT,  -- JSON array of node IDs
  depth INTEGER DEFAULT 0,
  is_expanded BOOLEAN DEFAULT FALSE,
  is_textbook_level BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_nodes_tree ON nodes(tree_id);
CREATE INDEX idx_nodes_parent ON nodes(tree_id, citations);
```

## Implementation Steps

### Step 1: Project Setup (1 day)
- [ ] Set up React + TypeScript + Vite project in `literature_frontend/`
- [ ] Set up Python FastAPI backend in `literature_backend/`
- [ ] SQLite database initialization
- [ ] Basic layout: split pane with tree left, terminal right
- [ ] Install D3.js or use custom tree layout library

### Step 2: Tree Data Model + API (1 day)
- [ ] Define LiteratureNode schema
- [ ] Implement SQLite tables
- [ ] Create tree CRUD endpoints
- [ ] Implement trace-up algorithm
- [ ] Connect to Semantic Scholar API for paper data

### Step 3: Tree Visualization (1-2 days)
- [ ] Implement hierarchical tree layout (horizontal or vertical)
- [ ] Render LiteratureNode as card with title/authors
- [ ] Implement hover tooltip with full details
- [ ] Implement expand/collapse on click
- [ ] Add expand button to fetch citations from API

### Step 4: Terminal Integration (1 day)
- [ ] Embed opencode relay terminal on right panel
- [ ] Expose tree API to opencode (opencode can call REST API)
- [ ] Opencode can read tree structure and node details
- [ ] User can interact with tree via natural language

### Step 5: Trace-Up Implementation (1-2 days)
- [ ] Implement "Find Top Papers" for topic
- [ ] Implement trace-up loop with depth limit
- [ ] Textbook-level detection
- [ ] Visualize trace path in tree

## File Structure
```
literature_engine/
├── PLAN.md
├── PHASE1_PLAN.md (this file)
├── literature_backend/
│   ├── main.py              # FastAPI app
│   ├── db.py                 # SQLite connection
│   ├── models.py            # Pydantic models
│   ├── api/
│   │   └── trees.py         # Tree endpoints
│   ├── services/
│   │   ├── trace_up.py      # Trace-up algorithm
│   │   └── semantic_scholar.py  # Paper retrieval
│   └── schemas/
│       └── paper.py
│
└── literature_frontend/
    ├── src/
    │   ├── App.tsx
    │   ├── main.tsx
    │   ├── components/
    │   │   ├── LiteratureTree.tsx
    │   │   ├── TreeNode.tsx
    │   │   ├── NodeTooltip.tsx
    │   │   └── Terminal.tsx
    │   ├── hooks/
    │   │   └── useTree.ts
    │   ├── api/
    │   │   └── client.ts
    │   └── types/
    │       └── tree.ts
    ├── index.html
    └── vite.config.ts
```

## OpenCode Integration

OpenCode will have access to these commands:
```
# Read tree
GET /api/trees/{id}              → returns full tree
GET /api/trees/{id}/nodes/{id}   → returns node details

# Modify tree
POST /api/trees/{id}/nodes/{id}/expand     → expand node
POST /api/trees/{id}/trace-up?from={id}   → trace up from node
POST /api/trees/{id}/nodes               → add manual node

# Search
GET /api/trees/{id}/search?q={query}      → search nodes
```

OpenCode can use these to answer questions like:
- "What papers led to this work?"
- "Show me the citation chain from BERT back to its roots"
- "Who are the key researchers in this field?"

## Success Criteria for Phase 1
1. User enters topic → system finds 10 best papers from top orgs
2. Tree displays papers with hover showing all details
3. User can expand nodes to trace citations back
4. Trace-up stops at root OR textbook-level paper
5. Opencode terminal can read tree structure via API
6. User can interact with tree via natural language through terminal

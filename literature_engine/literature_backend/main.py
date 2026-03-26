"""
Literature Review Engine - Backend
FastAPI + SQLite
OpenCode is the algorithm executor; this backend is just a data store.
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
import uuid
import json

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from db import database, init_db

app = FastAPI(title="Literature Review Engine API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Pydantic Models

class RankInfo(BaseModel):
    influenceIndex: int = 0
    isBestPaper: bool = False
    venue: str = ""
    venuePrestige: str = "medium"  # 'top', 'high', 'medium', 'low'
    organizations: list[str] = []


class LiteratureNode(BaseModel):
    id: str = ""
    title: str
    authors: list[str] = []
    link: str = ""
    abstract: str = ""
    rank: RankInfo = RankInfo()
    citations: list[str] = []  # IDs of papers this cites
    citedBy: list[str] = []  # IDs of papers citing this
    depth: int = 0
    isExpanded: bool = False
    isTextbookLevel: bool = False
    isRoot: bool = False


class CreateTreeRequest(BaseModel):
    topic: str


class CreateNodeRequest(BaseModel):
    title: str
    authors: list[str] = []
    link: str = ""
    abstract: str = ""
    rank: Optional[RankInfo] = None
    citations: list[str] = []
    depth: int = 0
    isTextbookLevel: bool = False
    isRoot: bool = False


class UpdateNodeRequest(BaseModel):
    citedBy: Optional[list[str]] = None
    isExpanded: Optional[bool] = None


class TreeResponse(BaseModel):
    id: str
    topic: str
    createdAt: str
    rootNodes: list[str]
    nodes: dict[str, LiteratureNode]


@app.on_event("startup")
async def startup():
    init_db()


@app.get("/")
async def root():
    return {"status": "ok", "service": "Literature Review Engine API"}


# Tree Endpoints

@app.post("/trees", response_model=dict)
async def create_tree(req: CreateTreeRequest):
    """Create a new tree for a research topic."""
    tree_id = str(uuid.uuid4())[:8]
    now = datetime.utcnow().isoformat()

    database["trees"][tree_id] = {
        "id": tree_id,
        "topic": req.topic,
        "createdAt": now,
        "rootNodes": [],
        "nodes": {}
    }

    return {"id": tree_id, "topic": req.topic, "createdAt": now}


@app.get("/trees/{tree_id}", response_model=TreeResponse)
async def get_tree(tree_id: str):
    """Get full tree structure."""
    if tree_id not in database["trees"]:
        raise HTTPException(status_code=404, detail="Tree not found")

    tree = database["trees"][tree_id]
    nodes = {}
    for node_id, node_data in tree["nodes"].items():
        nodes[node_id] = LiteratureNode(
            id=node_id,
            title=node_data["title"],
            authors=node_data.get("authors", []),
            link=node_data.get("link", ""),
            abstract=node_data.get("abstract", ""),
            rank=RankInfo(**node_data.get("rank", {})),
            citations=node_data.get("citations", []),
            citedBy=node_data.get("citedBy", []),
            depth=node_data.get("depth", 0),
            isExpanded=node_data.get("isExpanded", False),
            isTextbookLevel=node_data.get("isTextbookLevel", False),
            isRoot=node_data.get("isRoot", False),
        )

    return TreeResponse(
        id=tree["id"],
        topic=tree["topic"],
        createdAt=tree["createdAt"],
        rootNodes=tree["rootNodes"],
        nodes=nodes,
    )


@app.delete("/trees/{tree_id}")
async def delete_tree(tree_id: str):
    """Delete a tree and all its nodes."""
    if tree_id not in database["trees"]:
        raise HTTPException(status_code=404, detail="Tree not found")

    del database["trees"][tree_id]
    return {"status": "deleted", "id": tree_id}


@app.get("/trees")
async def list_trees():
    """List all trees."""
    trees = []
    for tree_id, tree in database["trees"].items():
        trees.append({
            "id": tree_id,
            "topic": tree["topic"],
            "createdAt": tree["createdAt"],
            "nodeCount": len(tree["nodes"]),
            "rootCount": len(tree["rootNodes"]),
        })
    return trees


# Node Endpoints

@app.post("/trees/{tree_id}/nodes", response_model=LiteratureNode)
async def create_node(tree_id: str, req: CreateNodeRequest):
    """Add a node to a tree."""
    if tree_id not in database["trees"]:
        raise HTTPException(status_code=404, detail="Tree not found")

    node_id = str(uuid.uuid4())[:12]

    # Generate link if not provided
    link = req.link or f"https://doi.org/{node_id}"

    node_data = {
        "id": node_id,
        "title": req.title,
        "authors": req.authors,
        "link": link,
        "abstract": req.abstract,
        "rank": req.rank.model_dump() if req.rank else RankInfo().model_dump(),
        "citations": req.citations,
        "citedBy": [],
        "depth": req.depth,
        "isExpanded": False,
        "isTextbookLevel": req.isTextbookLevel,
        "isRoot": req.isRoot,
    }

    database["trees"][tree_id]["nodes"][node_id] = node_data

    # Update parent's citedBy
    for parent_id in req.citations:
        if parent_id in database["trees"][tree_id]["nodes"]:
            if node_id not in database["trees"][tree_id]["nodes"][parent_id]["citedBy"]:
                database["trees"][tree_id]["nodes"][parent_id]["citedBy"].append(node_id)

    # If this node has no citations, it's a root
    if not req.citations:
        if node_id not in database["trees"][tree_id]["rootNodes"]:
            database["trees"][tree_id]["rootNodes"].append(node_id)

    return LiteratureNode(id=node_id, **node_data)


@app.get("/trees/{tree_id}/nodes/{node_id}", response_model=LiteratureNode)
async def get_node(tree_id: str, node_id: str):
    """Get a single node."""
    if tree_id not in database["trees"]:
        raise HTTPException(status_code=404, detail="Tree not found")

    if node_id not in database["trees"][tree_id]["nodes"]:
        raise HTTPException(status_code=404, detail="Node not found")

    node_data = database["trees"][tree_id]["nodes"][node_id]
    return LiteratureNode(id=node_id, **node_data)


@app.patch("/trees/{tree_id}/nodes/{node_id}", response_model=LiteratureNode)
async def update_node(tree_id: str, node_id: str, req: UpdateNodeRequest):
    """Update a node (e.g., mark as expanded)."""
    if tree_id not in database["trees"]:
        raise HTTPException(status_code=404, detail="Tree not found")

    if node_id not in database["trees"][tree_id]["nodes"]:
        raise HTTPException(status_code=404, detail="Node not found")

    node = database["trees"][tree_id]["nodes"][node_id]

    if req.citedBy is not None:
        node["citedBy"] = req.citedBy

    if req.isExpanded is not None:
        node["isExpanded"] = req.isExpanded

    return LiteratureNode(id=node_id, **node)


@app.post("/trees/{tree_id}/nodes/{node_id}/expand", response_model=LiteratureNode)
async def expand_node(tree_id: str, node_id: str):
    """Mark a node as expanded (citations fetched)."""
    if tree_id not in database["trees"]:
        raise HTTPException(status_code=404, detail="Tree not found")

    if node_id not in database["trees"][tree_id]["nodes"]:
        raise HTTPException(status_code=404, detail="Node not found")

    database["trees"][tree_id]["nodes"][node_id]["isExpanded"] = True

    node_data = database["trees"][tree_id]["nodes"][node_id]
    return LiteratureNode(id=node_id, **node_data)


@app.get("/trees/{tree_id}/search")
async def search_nodes(tree_id: str, q: str = ""):
    """Search nodes by title."""
    if tree_id not in database["trees"]:
        raise HTTPException(status_code=404, detail="Tree not found")

    results = []
    q_lower = q.lower()
    for node_id, node_data in database["trees"][tree_id]["nodes"].items():
        if q_lower in node_data["title"].lower():
            results.append(LiteratureNode(id=node_id, **node_data))

    return results


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

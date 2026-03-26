"""
Literature Review Engine - OpenCode Executor
Spawns OpenCode as a subprocess to autonomously build citation trees.
"""

import subprocess
import json
import os
import asyncio
from typing import Optional, AsyncGenerator
from dataclasses import dataclass


# Base directory for all literature sessions
SESSIONS_DIR = "/Volumes/UBag/Documents/claude_code_modifications/researchcode/literature_sessions"


@dataclass
class PaperInfo:
    title: str
    authors: list[str]
    link: str
    abstract: str
    venue: str
    influence_index: int
    is_best_paper: bool
    venue_prestige: str
    organizations: list[str]
    citations: list[str]  # titles of papers this cites


@dataclass
class ToolEvent:
    tool: str
    title: str
    status: str
    output: Optional[str] = None
    error: Optional[str] = None


async def run_opencode(
    tree_id: str,
    topic: str,
    api_base: str = "http://localhost:8000",
) -> AsyncGenerator[ToolEvent, None]:
    """
    Run OpenCode to build a citation tree for the given topic.
    Yields tool events as OpenCode works.
    """

    # Create session directory for this tree
    session_dir = os.path.join(SESSIONS_DIR, tree_id)
    os.makedirs(session_dir, exist_ok=True)

    # Create soul.md with instructions
    soul_path = os.path.join(session_dir, "soul.md")
    with open(soul_path, "w") as f:
        f.write(f"""You are an academic researcher building a citation tree for: {topic}

Your task:
1. Search for the TOP 10 most influential papers on "{topic}" from top universities (MIT, Stanford, Berkeley, Carnegie Mellon, Harvard, Oxford, Cambridge, etc.)
2. For each paper, find what it cites (its references)
3. Continue tracing citations backward until you reach root papers (foundational/textbook level)
4. Create a JSON file "papers.json" with all found papers
5. Create "citation_tree.json" showing citation relationships

Output format for papers.json:
{{
  "papers": [
    {{
      "title": "Paper Title",
      "authors": ["Author 1", "Author 2"],
      "link": "https://...",
      "abstract": "...",
      "venue": "NeurIPS 2023",
      "influence_index": 95,
      "is_best_paper": false,
      "venue_prestige": "top",
      "organizations": ["Stanford University"],
      "cites": ["Title of referenced paper"]
    }}
  ]
}}

Use web search to find papers, then web fetch to get abstracts and references.
Only include papers from elite institutions.
Rank by influence (citation count, venue prestige, awards).
""")

    # Build the OpenCode command
    cmd = [
        "opencode",
        "run",
        f"Build a citation tree for {topic}. Search for top papers, trace citations backward, save to papers.json and citation_tree.json.",
        "--dir", session_dir,
        "--format", "json",
        "--no-share",
    ]

    # Spawn OpenCode process
    process = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
        cwd=session_dir,
    )

    # Parse JSON output line by line
    buffer = ""
    papers_found = []

    try:
        while True:
            line = await process.stdout.readline()
            if not line:
                break

            decoded = line.decode("utf-8").strip()
            if not decoded:
                continue

            try:
                event = json.loads(decoded)

                # Handle different event types
                event_type = event.get("type")

                if event_type == "tool_use":
                    part = event.get("part", {})
                    state = part.get("state", {})
                    tool_name = part.get("tool", "unknown")
                    status = state.get("status", "unknown")
                    output = state.get("output", "")
                    error = state.get("error", "")

                    # Extract title from tool input
                    title = ""
                    if tool_name == "websearch":
                        input_data = state.get("input", {})
                        query = input_data.get("query", "") if isinstance(input_data, dict) else ""
                        title = f"WebSearch: {query}"
                    elif tool_name == "webfetch":
                        input_data = state.get("input", {})
                        url = input_data.get("url", "") if isinstance(input_data, dict) else ""
                        title = f"WebFetch: {url}"
                    elif tool_name == "write":
                        input_data = state.get("input", {})
                        filepath = input_data.get("filePath", "") if isinstance(input_data, dict) else ""
                        title = f"Write: {filepath}"

                        # Check if this is the papers.json being written
                        if "papers.json" in filepath and status == "completed":
                            # Read the papers.json file
                            papers_file = os.path.join(session_dir, "papers.json")
                            if os.path.exists(papers_file):
                                with open(papers_file) as f:
                                    data = json.load(f)
                                    papers_found = data.get("papers", [])
                    else:
                        title = f"{tool_name}: {status}"

                    yield ToolEvent(
                        tool=tool_name,
                        title=title,
                        status=status,
                        output=output if status == "completed" else None,
                        error=error if status == "error" else None,
                    )

                elif event_type == "text":
                    # Text output from the model
                    pass  # We don't yield these as tool events

                elif event_type == "step_start":
                    step = event.get("part", {}).get("step", {})
                    yield ToolEvent(
                        tool="system",
                        title=f"Step {step.get('number', '?')}: {step.get('title', 'Processing')}",
                        status="running",
                    )

            except json.JSONDecodeError:
                # Not JSON, might be plain text output
                pass

        # Wait for process to complete
        await process.wait()

    except Exception as e:
        yield ToolEvent(
            tool="error",
            title=str(e),
            status="error",
            error=str(e),
        )

    # Return final papers found
    yield ToolEvent(
        tool="complete",
        title=f"Found {len(papers_found)} papers",
        status="completed",
    )


async def create_nodes_from_papers(
    tree_id: str,
    api_base: str,
    session_dir: str,
) -> list[str]:
    """
    Read papers.json and create nodes in the backend via HTTP API.
    Returns list of created node IDs.
    """
    import urllib.request
    import urllib.error

    papers_file = os.path.join(session_dir, "papers.json")
    if not os.path.exists(papers_file):
        return []

    with open(papers_file) as f:
        data = json.load(f)

    node_ids = []
    title_to_id = {}  # Map title to node_id for building citation relationships

    # First pass: create all nodes
    for paper in data.get("papers", []):
        cites_titles = paper.get("cites", [])

        # Create node via API
        node_data = {
            "title": paper.get("title", ""),
            "authors": paper.get("authors", []),
            "link": paper.get("link", ""),
            "abstract": paper.get("abstract", ""),
            "rank": {
                "influenceIndex": paper.get("influence_index", 0),
                "isBestPaper": paper.get("is_best_paper", False),
                "venue": paper.get("venue", ""),
                "venuePrestige": paper.get("venue_prestige", "medium"),
                "organizations": paper.get("organizations", []),
            },
            "citations": [],  # Will be updated in second pass
            "depth": 0,
            "isTextbookLevel": False,
            "isRoot": len(cites_titles) == 0,
        }

        # Make API request
        req = urllib.request.Request(
            f"{api_base}/trees/{tree_id}/nodes",
            data=json.dumps(node_data).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )

        try:
            with urllib.request.urlopen(req) as resp:
                result = json.loads(resp.read().decode("utf-8"))
                node_id = result.get("id", "")
                node_ids.append(node_id)
                title_to_id[paper.get("title", "")] = node_id
        except urllib.error.HTTPError as e:
            print(f"Error creating node: {e.read().decode()}")

    # Second pass: update citation relationships
    # Read nodes back to find their IDs based on titles
    with open(papers_file) as f:
        data = json.load(f)

    for paper in data.get("papers", []):
        paper_title = paper.get("title", "")
        if paper_title not in title_to_id:
            continue

        node_id = title_to_id[paper_title]
        cites_titles = paper.get("cites", [])

        # Find node IDs for cited papers
        cited_ids = []
        for cited_title in cites_titles:
            if cited_title in title_to_id:
                cited_ids.append(title_to_id[cited_title])

        if cited_ids:
            # Update node with citation IDs
            update_data = {"citedBy": cited_ids}
            req = urllib.request.Request(
                f"{api_base}/trees/{tree_id}/nodes/{node_id}",
                data=json.dumps(update_data).encode("utf-8"),
                headers={"Content-Type": "application/json"},
                method="PATCH",
            )
            try:
                with urllib.request.urlopen(req) as resp:
                    pass
            except urllib.error.HTTPError as e:
                print(f"Error updating node citations: {e.read().decode()}")

    return node_ids

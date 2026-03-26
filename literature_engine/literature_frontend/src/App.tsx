// Literature Review Engine - Main App

import { useState, useCallback } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LiteratureTree } from './components/LiteratureTree';
import { NodeTooltip } from './components/NodeTooltip';
import { Terminal } from './components/Terminal';
import { useTree, useCreateTree } from './hooks/useTree';
import { api } from './api/client';
import type { LiteratureNode } from './types';
import './App.css';

const queryClient = new QueryClient();

function AppContent() {
  const [treeId, setTreeId] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<LiteratureNode | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  const { data: tree, isLoading, refetch } = useTree(treeId);
  const createTree = useCreateTree();

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    setTooltipPos({ x: e.clientX, y: e.clientY });
  }, []);

  const handleStartBuild = useCallback(async (topic: string) => {
    // Create new tree
    const result = await createTree.mutateAsync({ topic });
    setTreeId(result.id);

    // Trigger OpenCode build via API
    // The Terminal component will connect to SSE stream for progress
    try {
      await api.buildTree(result.id);
    } catch (e) {
      console.error('Failed to start build:', e);
    }
  }, [createTree]);

  const handleBuildComplete = useCallback((nodeCount: number) => {
    // Refetch tree data to show new nodes
    if (treeId) {
      refetch();
    }
  }, [treeId, refetch]);

  const handleNodeHover = useCallback((node: LiteratureNode | null) => {
    setHoveredNode(node);
  }, []);

  return (
    <div className="app" onMouseMove={handleMouseMove}>
      <header className="app-header">
        <h1>Literature Review Engine</h1>
        <div className="header-info">
          {treeId && <span>Tree: {treeId}</span>}
          {tree && <span>{Object.keys(tree.nodes).length} papers</span>}
        </div>
      </header>

      <main className="app-main">
        <div className="tree-panel">
          {isLoading && treeId && (
            <div className="loading">Loading tree...</div>
          )}
          {!treeId && !isLoading && (
            <div className="no-tree">
              <p>No tree selected</p>
              <p>Type <code>build tree for [topic]</code> in the terminal to start</p>
            </div>
          )}
          {tree && !isLoading && (
            <LiteratureTree
              tree={tree}
              onNodeHover={handleNodeHover}
              onNodeClick={() => {}}
            />
          )}
        </div>

        <div className="terminal-panel">
          <Terminal
            treeId={treeId}
            onStartBuild={handleStartBuild}
            onBuildComplete={handleBuildComplete}
          />
        </div>
      </main>

      {hoveredNode && (
        <NodeTooltip node={hoveredNode} position={tooltipPos} />
      )}
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  );
}

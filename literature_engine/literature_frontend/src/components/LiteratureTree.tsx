// Literature Review Engine - Literature Tree Component

import { useState, useCallback, useMemo } from 'react';
import type { LiteratureNode, TreeData } from '../types';
import './LiteratureTree.css';

interface Props {
  tree: TreeData;
  onNodeHover: (node: LiteratureNode | null) => void;
  onNodeClick: (nodeId: string) => void;
}

interface TreeNodeProps {
  node: LiteratureNode;
  nodes: Record<string, LiteratureNode>;
  depth: number;
  onHover: (node: LiteratureNode | null) => void;
  onClick: (nodeId: string) => void;
}

function TreeNode({ node, nodes, depth, onHover, onClick }: TreeNodeProps) {
  const [isExpanded, setIsExpanded] = useState(node.isExpanded);

  // Get children (nodes that cite this node)
  const children = useMemo(() => {
    return Object.values(nodes).filter(n => n.citations.includes(node.id));
  }, [nodes, node.id]);

  // Only show children if expanded
  const visibleChildren = isExpanded ? children : [];

  const handleToggle = () => {
    setIsExpanded(!isExpanded);
    onClick(node.id);
  };

  const venueColor = {
    top: '#10b981',
    high: '#3b82f6',
    medium: '#f59e0b',
    low: '#6b7280',
  }[node.rank.venuePrestige] || '#6b7280';

  return (
    <div className="tree-node" style={{ marginLeft: depth * 24 }}>
      <div
        className="node-card"
        onMouseEnter={() => onHover(node)}
        onMouseLeave={() => onHover(null)}
        onClick={handleToggle}
      >
        <div className="node-header">
          {visibleChildren.length > 0 && (
            <span className={`expand-icon ${isExpanded ? 'expanded' : ''}`}>
              ▶
            </span>
          )}
          <span className="node-title">{node.title}</span>
        </div>
        <div className="node-meta">
          <span className="venue-badge" style={{ backgroundColor: venueColor }}>
            {node.rank.venue || 'Unknown Venue'}
          </span>
          {node.rank.isBestPaper && <span className="best-paper">★ Best Paper</span>}
          {node.isTextbookLevel && <span className="textbook">📚 Textbook</span>}
          {node.isRoot && <span className="root">🌱 Root</span>}
          <span className="citations">
            ↑ {node.citedBy.length} | ↓ {node.citations.length}
          </span>
        </div>
        <div className="node-authors">
          {node.authors.slice(0, 3).join(', ')}
          {node.authors.length > 3 && ` +${node.authors.length - 3}`}
        </div>
      </div>

      {visibleChildren.length > 0 && isExpanded && (
        <div className="node-children">
          {visibleChildren.map(child => (
            <TreeNode
              key={child.id}
              node={child}
              nodes={nodes}
              depth={depth + 1}
              onHover={onHover}
              onClick={onClick}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function LiteratureTree({ tree, onNodeHover, onNodeClick }: Props) {
  // Find root nodes (nodes with no citations pointing to them)
  const rootNodes = useMemo(() => {
    return Object.values(tree.nodes).filter(
      node => node.isRoot || node.citations.length === 0
    );
  }, [tree.nodes]);

  if (Object.keys(tree.nodes).length === 0) {
    return (
      <div className="empty-tree">
        <p>No papers yet.</p>
        <p>OpenCode will build the tree autonomously.</p>
        <p>Start by entering a topic in the chat.</p>
      </div>
    );
  }

  return (
    <div className="literature-tree">
      <div className="tree-stats">
        <span>{Object.keys(tree.nodes).length} papers</span>
        <span>{rootNodes.length} roots</span>
      </div>
      <div className="tree-content">
        {rootNodes.map(node => (
          <TreeNode
            key={node.id}
            node={node}
            nodes={tree.nodes}
            depth={0}
            onHover={onNodeHover}
            onClick={onNodeClick}
          />
        ))}
      </div>
    </div>
  );
}

// Literature Review Engine - Node Tooltip Component

import type { LiteratureNode } from '../types';
import './NodeTooltip.css';

interface Props {
  node: LiteratureNode;
  position: { x: number; y: number };
}

export function NodeTooltip({ node, position }: Props) {
  return (
    <div
      className="node-tooltip"
      style={{
        left: Math.min(position.x + 16, window.innerWidth - 400),
        top: position.y,
      }}
    >
      <div className="tooltip-header">
        <div className="tooltip-badges">
          <span className={`venue-${node.rank.venuePrestige}`}>
            {node.rank.venue || 'Unknown Venue'}
          </span>
          {node.rank.isBestPaper && <span className="best-paper">★ Best Paper</span>}
          {node.isTextbookLevel && <span className="textbook">📚 Textbook Level</span>}
          {node.isRoot && <span className="root">🌱 Root Paper</span>}
        </div>
        <div className="tooltip-rank">
          Rank #{node.rank.influenceIndex}
        </div>
      </div>

      <h3 className="tooltip-title">{node.title}</h3>

      <div className="tooltip-authors">
        <strong>Authors:</strong> {node.authors.join(', ')}
      </div>

      {node.rank.organizations.length > 0 && (
        <div className="tooltip-orgs">
          <strong>Organizations:</strong> {node.rank.organizations.join(', ')}
        </div>
      )}

      <div className="tooltip-abstract">
        <strong>Abstract:</strong>
        <p>{node.abstract || 'No abstract available.'}</p>
      </div>

      <div className="tooltip-citations">
        <div>Cited by: <strong>{node.citedBy.length}</strong> papers</div>
        <div>Cites: <strong>{node.citations.length}</strong> papers</div>
      </div>

      <div className="tooltip-depth">
        Depth: {node.depth}
      </div>

      {node.link && (
        <a
          href={node.link}
          target="_blank"
          rel="noopener noreferrer"
          className="tooltip-link"
        >
          View Paper →
        </a>
      )}
    </div>
  );
}

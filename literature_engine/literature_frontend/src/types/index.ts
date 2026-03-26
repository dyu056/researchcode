// Literature Review Engine - TypeScript Types

export interface RankInfo {
  influenceIndex: number;
  isBestPaper: boolean;
  venue: string;
  venuePrestige: 'top' | 'high' | 'medium' | 'low';
  organizations: string[];
}

export interface LiteratureNode {
  id: string;
  title: string;
  authors: string[];
  link: string;
  abstract: string;
  rank: RankInfo;
  citations: string[];  // IDs of papers this cites
  citedBy: string[];  // IDs of papers citing this
  depth: number;
  isExpanded: boolean;
  isTextbookLevel: boolean;
  isRoot: boolean;
}

export interface TreeData {
  id: string;
  topic: string;
  createdAt: string;
  rootNodes: string[];
  nodes: Record<string, LiteratureNode>;
}

export interface TreeListItem {
  id: string;
  topic: string;
  createdAt: string;
  nodeCount: number;
  rootCount: number;
}

export interface CreateTreeRequest {
  topic: string;
}

export interface CreateNodeRequest {
  title: string;
  authors: string[];
  link?: string;
  abstract?: string;
  rank?: RankInfo;
  citations?: string[];
  depth?: number;
  isTextbookLevel?: boolean;
  isRoot?: boolean;
}

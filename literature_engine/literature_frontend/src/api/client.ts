// Literature Review Engine - API Client

import type {
  TreeData,
  TreeListItem,
  LiteratureNode,
  CreateTreeRequest,
  CreateNodeRequest,
} from '../types';

const BASE = '/api';

async function req<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...opts?.headers,
    },
  });
  if (!res.ok) {
    const error = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${error}`);
  }
  return res.json();
}

export const api = {
  // Tree operations
  createTree: (body: CreateTreeRequest) =>
    req<{ id: string; topic: string; createdAt: string }>('/trees', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  getTree: (id: string) =>
    req<TreeData>(`/trees/${id}`),

  deleteTree: (id: string) =>
    req<{ status: string; id: string }>(`/trees/${id}`, { method: 'DELETE' }),

  listTrees: () =>
    req<TreeListItem[]>('/trees'),

  // Node operations
  createNode: (treeId: string, body: CreateNodeRequest) =>
    req<LiteratureNode>(`/trees/${treeId}/nodes`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  getNode: (treeId: string, nodeId: string) =>
    req<LiteratureNode>(`/trees/${treeId}/nodes/${nodeId}`),

  expandNode: (treeId: string, nodeId: string) =>
    req<LiteratureNode>(`/trees/${treeId}/nodes/${nodeId}/expand`, {
      method: 'POST',
    }),

  searchNodes: (treeId: string, q: string) =>
    req<LiteratureNode[]>(`/trees/${treeId}/search?q=${encodeURIComponent(q)}`),
};

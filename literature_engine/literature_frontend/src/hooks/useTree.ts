// Literature Review Engine - Tree Hooks

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import type { CreateTreeRequest, CreateNodeRequest } from '../types';

// Query keys
export const treeKeys = {
  all: ['trees'] as const,
  list: () => [...treeKeys.all, 'list'] as const,
  detail: (id: string) => [...treeKeys.all, 'detail', id] as const,
};

// Hooks
export function useTrees() {
  return useQuery({
    queryKey: treeKeys.list(),
    queryFn: () => api.listTrees(),
  });
}

export function useTree(id: string | null) {
  return useQuery({
    queryKey: treeKeys.detail(id || ''),
    queryFn: () => api.getTree(id!),
    enabled: !!id,
    refetchInterval: 2000, // Poll for updates as OpenCode adds nodes
  });
}

export function useCreateTree() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateTreeRequest) => api.createTree(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: treeKeys.list() });
    },
  });
}

export function useDeleteTree() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteTree(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: treeKeys.list() });
    },
  });
}

export function useCreateNode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ treeId, body }: { treeId: string; body: CreateNodeRequest }) =>
      api.createNode(treeId, body),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: treeKeys.detail(variables.treeId) });
    },
  });
}

export function useExpandNode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ treeId, nodeId }: { treeId: string; nodeId: string }) =>
      api.expandNode(treeId, nodeId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: treeKeys.detail(variables.treeId) });
    },
  });
}

import { z } from 'zod';
import { apiJson } from '@/services/api';

const AdminModelFileSchema = z.object({
  name: z.string(),
  relativePath: z.string(),
  absolutePath: z.string(),
  kind: z.enum(['generated', 'parametric', 'export']),
  sizeBytes: z.number(),
  modifiedAt: z.string(),
});

const AdminConversationWorkspaceSchema = z.object({
  conversationId: z.string(),
  title: z.string().nullable(),
  type: z.string().nullable(),
  userId: z.string().nullable(),
  ownerLabel: z.string().nullable(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
  workspacePath: z.string(),
  totalBytes: z.number(),
  fileCount: z.number(),
  modelCount: z.number(),
  orphaned: z.boolean(),
  models: z.array(AdminModelFileSchema),
});

export const AdminModelInventorySchema = z.object({
  workspaceRoot: z.string(),
  workspaceCount: z.number(),
  orphanedCount: z.number(),
  modelCount: z.number(),
  totalBytes: z.number(),
  workspaces: z.array(AdminConversationWorkspaceSchema),
});

const AdminWorkspaceDeleteResultSchema = z.object({
  success: z.literal(true),
  orphaned: z.boolean(),
});

export type AdminModelFile = z.infer<typeof AdminModelFileSchema>;
export type AdminConversationWorkspace = z.infer<
  typeof AdminConversationWorkspaceSchema
>;
export type AdminModelInventory = z.infer<typeof AdminModelInventorySchema>;

export function getAdminModelInventory() {
  return apiJson(
    'settings/adminModels',
    { method: 'GET' },
    AdminModelInventorySchema,
  );
}

export function deleteAdminModelWorkspace(conversationId: string) {
  return apiJson(
    'settings/adminModels',
    {
      method: 'POST',
      body: JSON.stringify({ conversationId }),
    },
    AdminWorkspaceDeleteResultSchema,
  );
}

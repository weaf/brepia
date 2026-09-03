import { createFileRoute } from '@tanstack/react-router';
import { BrepProjectPreview } from '@/components/brep/BrepProjectPreview';

export const Route = createFileRoute('/_layout/_auth/brep')({
  component: () => <BrepProjectPreview createProject />,
});

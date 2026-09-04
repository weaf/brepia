import { createFileRoute } from '@tanstack/react-router';
import { BrepAiCreatePanel } from '@/components/brep/BrepAiCreatePanel';
import { BrepProjectPreview } from '@/components/brep/BrepProjectPreview';

export const Route = createFileRoute('/_layout/_auth/brep/')({
  component: BrepCreatePage,
});

function BrepCreatePage() {
  return (
    <div className="h-full overflow-auto">
      <BrepAiCreatePanel />
      <BrepProjectPreview createProject importPackage />
    </div>
  );
}

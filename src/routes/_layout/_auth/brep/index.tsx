import { createFileRoute } from '@tanstack/react-router';
import { BrepProjectPreview } from '@/components/brep/BrepProjectPreview';

export const Route = createFileRoute('/_layout/_auth/brep/')({
  component: BrepCreatePage,
});

function BrepCreatePage() {
  return (
    <div className="h-full overflow-auto">
      <BrepProjectPreview createProject importPackage />
    </div>
  );
}

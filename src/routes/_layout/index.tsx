import { createFileRoute } from '@tanstack/react-router';
import { LandingView } from '@/views/LandingView';

export const Route = createFileRoute('/_layout/')({
  component: LandingView,
});

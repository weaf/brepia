import { ActivityIndicator, BrepiaMark } from '@/components/brand';
import { useSharedSpinnerVerb } from '@/hooks/useSharedSpinnerVerb';

type Props = {
  showLoadingText?: boolean;
  label?: string;
};

const Loader = ({ showLoadingText = false, label }: Props) => {
  const sharedVerb = useSharedSpinnerVerb(showLoadingText);
  const loadingLabel = label ?? `${sharedVerb}…`;

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="flex h-24 w-24 items-center justify-center rounded-2xl border border-adam-neutral-700 bg-adam-neutral-900/70">
        <BrepiaMark title="Brepia" className="h-14 w-14" />
      </div>
      {showLoadingText && (
        <ActivityIndicator
          className="mt-4 text-base text-adam-text-primary"
          label={loadingLabel}
          showLabel
          size="sm"
        />
      )}
    </div>
  );
};

export default Loader;

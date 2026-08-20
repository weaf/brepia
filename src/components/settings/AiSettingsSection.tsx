import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AiModelsSettings } from './AiModelsSettings';
import { PromptProfilesSettings } from './PromptProfilesSettings';
import { ProvidersSettings } from './ProvidersSettings';
import { VisionSettings } from './VisionSettings';

export function AiSettingsSection() {
  return (
    <section className="rounded-xl border border-adam-neutral-800 bg-adam-background-2 p-4 text-adam-neutral-100 sm:p-6">
      <h2 className="mb-4 text-lg font-semibold text-adam-neutral-50">
        AI Settings
      </h2>
      <Tabs defaultValue="models">
        <TabsList className="mb-4">
          <TabsTrigger value="models">Models</TabsTrigger>
          <TabsTrigger value="prompts">Prompts</TabsTrigger>
          <TabsTrigger value="providers">Providers</TabsTrigger>
          <TabsTrigger value="vision">Vision</TabsTrigger>
        </TabsList>
        <TabsContent value="models">
          <AiModelsSettings />
        </TabsContent>
        <TabsContent value="prompts">
          <PromptProfilesSettings />
        </TabsContent>
        <TabsContent value="providers">
          <ProvidersSettings />
        </TabsContent>
        <TabsContent value="vision">
          <VisionSettings />
        </TabsContent>
      </Tabs>
    </section>
  );
}

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AiModelsSettings } from './AiModelsSettings';
import { PromptProfilesSettings } from './PromptProfilesSettings';
import { ProvidersSettings } from './ProvidersSettings';

export function AiSettingsSection() {
  return (
    <section className="rounded-xl border border-adam-neutral-800 bg-adam-background-2 p-6">
      <h2 className="text-adam-text-1 mb-4 text-lg font-semibold">
        AI Settings
      </h2>
      <Tabs defaultValue="models">
        <TabsList className="mb-4">
          <TabsTrigger value="models">Models</TabsTrigger>
          <TabsTrigger value="prompts">Prompts</TabsTrigger>
          <TabsTrigger value="providers">Providers</TabsTrigger>
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
      </Tabs>
    </section>
  );
}

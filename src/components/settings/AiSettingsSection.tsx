import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AiModelsSettings } from './AiModelsSettings';
import { DefaultModelSettings } from './DefaultModelSettings';
import { LocalModelsSettings } from './LocalModelsSettings';
import { PromptProfilesSettings } from './PromptProfilesSettings';
import { ProvidersSettings } from './ProvidersSettings';
import { VisionSettings } from './VisionSettings';

export function AiSettingsSection() {
  return (
    <section className="min-w-0 rounded-xl border border-adam-neutral-800 bg-adam-background-2 p-4 text-adam-neutral-100 sm:p-6">
      <h2 className="mb-4 text-lg font-semibold text-adam-neutral-50">
        AI Settings
      </h2>
      <Tabs defaultValue="models" className="min-w-0">
        <div className="hide-scrollbar mb-4 min-w-0 overflow-x-auto">
          <TabsList className="h-auto w-max min-w-full justify-start gap-1">
            <TabsTrigger value="models">Models</TabsTrigger>
            <TabsTrigger value="local-models">Local Models</TabsTrigger>
            <TabsTrigger value="prompts">Prompts</TabsTrigger>
            <TabsTrigger value="providers">Providers</TabsTrigger>
            <TabsTrigger value="vision">Vision</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="models" className="min-w-0">
          <DefaultModelSettings />
          <AiModelsSettings />
        </TabsContent>
        <TabsContent value="local-models" className="min-w-0">
          <LocalModelsSettings />
        </TabsContent>
        <TabsContent value="prompts" className="min-w-0">
          <PromptProfilesSettings />
        </TabsContent>
        <TabsContent value="providers" className="min-w-0">
          <ProvidersSettings />
        </TabsContent>
        <TabsContent value="vision" className="min-w-0">
          <VisionSettings />
        </TabsContent>
      </Tabs>
    </section>
  );
}

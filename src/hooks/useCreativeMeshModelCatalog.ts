import {
  CORE_CREATIVE_MESH_MODELS,
  getCreativeMeshInputCapability,
  type CreativeMeshModelDefinition,
  type CreativeMeshProvider,
} from '@shared/creativeMeshModels';
import type { ModelConfig } from '@/types/misc';
import { apiJson } from '@/services/api';
import { useQuery } from '@tanstack/react-query';

type CreativeMeshProviderStatus = {
  id: CreativeMeshProvider;
  label: string;
  optional: boolean;
  enabled: boolean;
  configured: boolean;
  modelIds: string[];
};

type CreativeMeshCatalogResponse = {
  models: CreativeMeshModelDefinition[];
  providers: CreativeMeshProviderStatus[];
};

function toModelConfig(definition: CreativeMeshModelDefinition): ModelConfig {
  return {
    id: definition.id,
    name: definition.name,
    description: definition.description,
    provider: definition.providerLabel,
    timeEstimate: definition.timeEstimate,
    inputCapability: getCreativeMeshInputCapability(definition.id),
  };
}

const FALLBACK_MODELS = CORE_CREATIVE_MESH_MODELS.map(toModelConfig);

export function useCreativeMeshModelCatalog() {
  const query = useQuery({
    queryKey: ['creative-mesh-model-catalog'],
    queryFn: () =>
      apiJson('models/catalog?scope=creative') as Promise<CreativeMeshCatalogResponse>,
    staleTime: 30_000,
  });

  return {
    ...query,
    models: query.data?.models.map(toModelConfig) ?? FALLBACK_MODELS,
    providers: query.data?.providers ?? [],
  };
}

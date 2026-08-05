import {
  type FauxProviderHandle,
  fauxProvider,
  type RegisterFauxProviderOptions,
} from "@earendil-works/pi-ai"
import { ModelRegistry, ModelRuntime } from "@earendil-works/pi-coding-agent"

export { getModel } from "@earendil-works/pi-ai/compat"

export interface FauxProviderRegistration extends FauxProviderHandle {
  modelRuntime: ModelRuntime
  modelRegistry: ModelRegistry
  unregister(): void
}

/** Register Pi 0.83's provider-owned faux backend in a real ModelRuntime. */
export async function registerFauxProvider(
  options: RegisterFauxProviderOptions,
): Promise<FauxProviderRegistration> {
  const faux = fauxProvider(options)
  const modelRuntime = await ModelRuntime.create({ modelsPath: null })
  modelRuntime.registerNativeProvider(faux.provider)
  const modelRegistry = new ModelRegistry(modelRuntime)

  return Object.assign(faux, {
    modelRuntime,
    modelRegistry,
    unregister: () => modelRuntime.unregisterProvider(faux.provider.id),
  })
}

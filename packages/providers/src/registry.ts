import { providerNotFound, validationError } from "@reprise/core";
import type { Provider } from "./types.js";

/**
 * Registry for provider implementations.
 */
export class ProviderRegistry {
  private readonly providers = new Map<string, Provider>();

  register(provider: Provider): void {
    if (!provider.name) {
      throw validationError("Provider.name is required");
    }
    this.providers.set(provider.name, provider);
  }

  unregister(name: string): boolean {
    return this.providers.delete(name);
  }

  get(name: string): Provider {
    const provider = this.providers.get(name);
    if (!provider) throw providerNotFound(name);
    return provider;
  }

  tryGet(name: string): Provider | undefined {
    return this.providers.get(name);
  }

  has(name: string): boolean {
    return this.providers.has(name);
  }

  list(): string[] {
    return [...this.providers.keys()].sort();
  }

  clear(): void {
    this.providers.clear();
  }
}

export const globalProviderRegistry = new ProviderRegistry();

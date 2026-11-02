import { createHash } from 'node:crypto';
import { statSync } from 'node:fs';
import { SecureKeyStore } from '@aviation/keystore';
import type { ProviderConfiguration } from './ExplainerClient.js';

export type ExplanationEnvironment = Readonly<Record<string, string | undefined>>;

/** Canonical rcc fields; private E2E runtimes never construct this normal reader. */
export function providerConfigurationReader(environment: ExplanationEnvironment = process.env,
  keystorePath?: string): () => ProviderConfiguration | undefined {
  let cachedIdentity = '';
  let fields: { requestUrl?: string; apiToken?: string } = {};
  return () => {
    // Unit-test imports do not discover a workstation's provider or credential store.
    if (environment.NODE_ENV === 'test') return undefined;
    const selectedPath = keystorePath ?? environment.KEYSTORE_PATH;
    const master = environment.KEYSTORE_ENCRYPTION_KEY;
    if (selectedPath && master && master.length >= 32) {
      try {
        const info = statSync(selectedPath, { bigint: true });
        const identity = [selectedPath, info.ino, info.mtimeNs, info.ctimeNs, info.size,
          createHash('sha256').update(master).digest('hex')].join(':');
        if (identity !== cachedIdentity) {
          const store = new SecureKeyStore({ storePath: selectedPath, encryptionKey: master });
          fields = { requestUrl: store.getSecret('rcc', 'request_url'), apiToken: store.getSecret('rcc', 'api_token') };
          cachedIdentity = identity;
        }
      } catch { fields = {}; cachedIdentity = ''; }
    } else { fields = {}; cachedIdentity = ''; }
    return {
      brainUrl: fields.requestUrl ?? environment.RCC_BRAIN_URL,
      apiToken: fields.apiToken ?? environment.RCC_API_TOKEN,
      publicBaseUrl: environment.AVIATION_EXPLAIN_PUBLIC_URL,
    };
  };
}

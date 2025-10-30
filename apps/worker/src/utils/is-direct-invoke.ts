import { pathToFileURL } from 'node:url';

export function isDirectCliInvocation(metaUrl: string, argvEntry: string | undefined): boolean {
  if (!argvEntry) {
    return false;
  }

  try {
    const cliUrl = pathToFileURL(argvEntry).href;
    return cliUrl === metaUrl;
  } catch {
    return false;
  }
}


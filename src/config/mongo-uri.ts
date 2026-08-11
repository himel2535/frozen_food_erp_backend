import dns from 'node:dns/promises';

/** Public resolvers — avoids ISP DNS refusing Node SRV queries on Windows. */
const PUBLIC_DNS = ['8.8.8.8', '1.1.1.1', '8.8.4.4'];

export function sanitizeMongoUri(uri: string): string {
  return uri.replace(/\/\/([^:@/]+):([^@/]+)@/, '//$1:***@');
}

/**
 * Convert mongodb+srv:// to mongodb:// using DNS SRV + TXT records.
 * Keeps Atlas URIs in .env while bypassing broken local SRV resolution.
 */
export async function resolveMongoUri(uri: string): Promise<string> {
  if (!uri.startsWith('mongodb+srv://')) {
    return uri;
  }

  dns.setServers(PUBLIC_DNS);

  const withoutScheme = uri.slice('mongodb+srv://'.length);
  const atIdx = withoutScheme.indexOf('@');
  if (atIdx === -1) {
    return uri;
  }

  const credentials = withoutScheme.slice(0, atIdx);
  const rest = withoutScheme.slice(atIdx + 1);
  const slashIdx = rest.indexOf('/');
  const hostname = (slashIdx === -1 ? rest : rest.slice(0, slashIdx)).split('?')[0]!;
  const pathAndQuery = slashIdx === -1 ? '' : rest.slice(slashIdx);
  const queryIdx = pathAndQuery.indexOf('?');
  const dbPath = queryIdx === -1 ? pathAndQuery : pathAndQuery.slice(0, queryIdx);
  const userQuery = queryIdx === -1 ? '' : pathAndQuery.slice(queryIdx + 1);

  const srvRecords = await dns.resolveSrv(`_mongodb._tcp.${hostname}`);
  const hosts = srvRecords
    .sort((a, b) => a.priority - b.priority || b.weight - a.weight)
    .map((r) => `${r.name.replace(/\.$/, '')}:${r.port}`)
    .join(',');

  const params = new URLSearchParams();
  try {
    const txtRecords = await dns.resolveTxt(hostname);
    for (const part of txtRecords.flat().join('').split('&')) {
      const eq = part.indexOf('=');
      if (eq > 0) {
        params.set(part.slice(0, eq), part.slice(eq + 1));
      }
    }
  } catch {
    // TXT optional — replicaSet may still work via driver discovery
  }

  if (userQuery) {
    for (const [key, value] of new URLSearchParams(userQuery)) {
      params.set(key, value);
    }
  }

  if (!params.has('ssl')) params.set('ssl', 'true');
  if (!params.has('authSource')) params.set('authSource', 'admin');

  const qs = params.toString();
  return `mongodb://${credentials}@${hosts}${dbPath}${qs ? `?${qs}` : ''}`;
}

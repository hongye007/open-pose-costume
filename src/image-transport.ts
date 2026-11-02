/** Only the local Vite server provides these fixed-destination routes. */
export function imageRequestEndpoint(endpoint: string, development: boolean): string {
  if (!development) return endpoint;
  const url = new URL(endpoint);
  const route =
    url.origin === 'https://atomflow.vip'
      ? 'site'
      : url.origin === 'https://api.atomflow.vip'
        ? 'api'
        : null;
  return route && url.pathname === '/v1/images/edits' && !url.search && !url.hash
    ? `/__opc-image/${route}/v1/images/edits`
    : endpoint;
}

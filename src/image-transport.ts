export function atomflowRoute(endpoint: string): 'site' | 'api' | null {
  const url = new URL(endpoint);
  return url.pathname === '/v1/images/edits' && !url.search && !url.hash
    ? url.origin === 'https://atomflow.vip'
      ? 'site'
      : url.origin === 'https://api.atomflow.vip'
        ? 'api'
        : null
    : null;
}

/** Route only exact Atomflow edit endpoints through a fixed-destination transport. */
export function imageRequestEndpoint(
  endpoint: string,
  development: boolean,
  productionProxy = '',
): string {
  const route = atomflowRoute(endpoint);
  if (!route) return endpoint;
  if (development) return `/__opc-image/${route}/v1/images/edits`;
  if (!productionProxy.trim()) return endpoint;
  const proxy = new URL(productionProxy.trim());
  if (proxy.protocol !== 'https:' || proxy.username || proxy.password || proxy.search || proxy.hash)
    throw new Error('invalidProxyEndpoint');
  const pathname = proxy.pathname.replace(/\/+$/, '');
  return `${proxy.origin}${pathname}/${route}/v1/images/edits`;
}

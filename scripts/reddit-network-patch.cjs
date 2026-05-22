const dns = require('node:dns');

const redditHosts = new Set([
  'developers.reddit.com',
  'devvit-gateway.reddit.com',
  'gql-fed.reddit.com',
  'oauth.reddit.com',
  'www.reddit.com',
]);

const fastlyEdges = [
  '151.101.1.140',
  '151.101.129.140',
  '151.101.193.140',
  '151.101.65.140',
];

const counters = new Map();
const originalLookup = dns.lookup;

dns.lookup = function redditEdgeLookup(hostname, options, callback) {
  if (!redditHosts.has(hostname)) {
    return originalLookup.call(this, hostname, options, callback);
  }

  const index = counters.get(hostname) ?? 0;
  counters.set(hostname, index + 1);
  const address = fastlyEdges[index % fastlyEdges.length];

  if (typeof options === 'function') {
    return process.nextTick(options, null, address, 4);
  }

  if (options?.all) {
    return process.nextTick(
      callback,
      null,
      fastlyEdges.map((edge) => ({ address: edge, family: 4 }))
    );
  }

  return process.nextTick(callback, null, address, 4);
};

const originalFetch = globalThis.fetch;

if (typeof originalFetch === 'function') {
  globalThis.fetch = async function retryRedditFetch(input, init) {
    const url = typeof input === 'string' ? input : input?.url;
    const shouldRetry =
      typeof url === 'string' &&
      [...redditHosts].some((host) => url.includes(`://${host}`));

    if (!shouldRetry) {
      return originalFetch(input, init);
    }

    let lastError;
    for (let attempt = 0; attempt < fastlyEdges.length; attempt += 1) {
      try {
        return await originalFetch(input, init);
      } catch (error) {
        lastError = error;
        if (!(error instanceof TypeError) || error.message !== 'fetch failed') {
          throw error;
        }
      }
    }

    throw lastError;
  };
}

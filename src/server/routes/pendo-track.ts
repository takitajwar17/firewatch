const PENDO_TRACK_URL = 'https://data.pendo.io/data/track';
const PENDO_INTEGRATION_KEY = '4f3080b2-73a1-450a-9e26-b97791526b0f';

/**
 * Sends a server-side Track Event to the Pendo Track API.
 * Fire-and-forget: tracking failures are silently caught so they never
 * break application flow.
 */
export function trackPendoEvent(
  event: string,
  visitorId: string,
  accountId: string,
  properties?: Record<string, unknown>
): void {
  try {
    fetch(PENDO_TRACK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-pendo-integration-key': PENDO_INTEGRATION_KEY,
      },
      body: JSON.stringify({
        type: 'track',
        event,
        visitorId,
        accountId,
        timestamp: Date.now(),
        properties: properties ?? {},
      }),
    }).catch(() => {
      // Silently ignore network errors — tracking must not break the app
    });
  } catch {
    // Silently ignore — tracking must not break the app
  }
}

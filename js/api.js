const WORKER_URL = 'https://aijudge-proxy.mortuexhavoc.workers.dev';
const REQUEST_TIMEOUT_MS = 30000;

export async function judgeArgument(argument) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ argument }),
      signal: controller.signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('The court is taking too long to respond. Please try again.');
    }
    throw new Error('Could not reach the court. Check your connection and try again.');
  } finally {
    clearTimeout(timeoutId);
  }

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Judgment failed');
  }

  return data.result;
}

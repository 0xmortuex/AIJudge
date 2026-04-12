const WORKER_URL = 'https://aijudge-proxy.mortuexhavoc.workers.dev';

export async function judgeArgument(argument) {
  const response = await fetch(WORKER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ argument }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Judgment failed');
  }

  return data.result;
}

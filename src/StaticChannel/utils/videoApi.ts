// Direct calls to the seetacloud img2video endpoint. CORS is open
// (Access-Control-Allow-Origin: *) so the browser can hit it with no proxy.
// Submit returns a task_id immediately; the heavy bake (≈60–240s) runs
// server-side and is resumable — ANY client can poll a task_id to completion.
// Success yields a durable CDN url (https://cdn.aiwaves.tech/...).
//
// ⚠️ This host is the ephemeral per-instance SeetaCloud GPU URL — it can change
// without notice. Verify with a curl before trusting it.

const SUBMIT_URL = 'https://u545921-b746-8a491f44.westc.seetacloud.com:8443/video';
const POLL_URL = 'https://u545921-b746-8a491f44.westc.seetacloud.com:8443/video_task';

export interface SubmitVideoOpts {
  image_url: string;
  end_image_url: string;
  prompt: string;
  env?: 'prod' | 'test';
}

export interface PollResult {
  status: 'processing' | 'success' | 'failed';
  url?: string;
  log?: string;
}

export async function submitVideo(opts: SubmitVideoOpts): Promise<string> {
  const body = {
    query: '',
    params: {
      image_url: opts.image_url,
      end_image_url: opts.end_image_url,
      prompt: opts.prompt,
      env: opts.env ?? 'prod',
    },
  };
  const res = await fetch(SUBMIT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`video submit: HTTP ${res.status}`);
  const json = (await res.json()) as { task_id?: string };
  if (!json.task_id) throw new Error('video submit: no task_id');
  return json.task_id;
}

export async function pollOnce(task_id: string): Promise<PollResult> {
  const res = await fetch(POLL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: '', params: { task_id } }),
  });
  if (!res.ok) throw new Error(`video poll: HTTP ${res.status}`);
  return (await res.json()) as PollResult;
}

// Poll an already-submitted task to completion. Resolves with the video URL,
// rejects on failure/timeout. Cheap to call — safe to resume from any client.
export async function pollToCompletion(
  task_id: string,
  { pollIntervalMs = 6000, timeoutMs = 20 * 60 * 1000 }: { pollIntervalMs?: number; timeoutMs?: number } = {},
): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const r = await pollOnce(task_id);
    if (r.status === 'success') {
      if (!r.url) throw new Error('video poll: success without url');
      return r.url;
    }
    if (r.status === 'failed') throw new Error(`video failed (task ${task_id}): ${r.log || 'no log'}`);
    await new Promise(res => setTimeout(res, pollIntervalMs));
  }
  throw new Error('video poll: timed out');
}

const proofs = new Map();
const keyFor = (email, purpose) => `${purpose}:${String(email || '').trim().toLowerCase()}`;
const base = (import.meta.env.VITE_API_BASE_URL?.trim() || 'http://localhost:8080/api').replace(/\/+$/, '');
const apiBase = base.endsWith('/api') ? base : `${base}/api`;

export function rememberEmailProof(email, purpose, proof, expiresIn) {
  proofs.set(keyFor(email, purpose), { proof, expiresAt: Date.now() + expiresIn * 1000 });
}

export function emailVerifiedUntil(email, purpose) {
  const value = proofs.get(keyFor(email, purpose));
  return value && value.expiresAt > Date.now() ? value.expiresAt : 0;
}

export function forgetEmailProof(email, purpose) {
  proofs.delete(keyFor(email, purpose));
}

export function emailVerificationHeaders() {
  for (const [key, value] of proofs) if (value.expiresAt <= Date.now()) proofs.delete(key);
  return [...proofs.values()].slice(-20).map((value) => value.proof).join(',');
}

export async function emailVerificationRequest(action, body) {
  const response = await fetch(`${apiBase}/auth/email/${action}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.message || 'Email verification failed. Please try again.');
  return result;
}

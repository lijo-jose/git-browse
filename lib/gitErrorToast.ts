import { toast } from 'sonner';
import { classifyGitError } from './errorClassifier';
import type { OpHandle } from './operationLog';

/**
 * Classify a git error, record it on the op handle, and show a toast.
 * Returns the classification so callers can react to specific codes (e.g. isConflict).
 */
export function gitErrorToast(label: string, err: unknown, op?: OpHandle) {
  const msg = String(err);
  const info = classifyGitError(msg);
  op?.error(msg, info?.suggestion);
  toast.error(label, { description: info?.suggestion ?? msg });
  return info;
}

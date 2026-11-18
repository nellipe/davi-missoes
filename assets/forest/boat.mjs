// An interactive trip remains at its destination until the next release.
export function boatProgress(now, releasedAt, still, duration) {
  if (releasedAt === null) return .08;
  const elapsed = now - releasedAt;
  if (still) return elapsed < .28 ? .08 : .94;
  return .08 + .86 * Math.max(0, Math.min(1, (elapsed - .20) / duration));
}

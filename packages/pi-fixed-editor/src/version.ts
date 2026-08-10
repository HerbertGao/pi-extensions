export type PiSupport = "legacy" | "upgrade" | "native"

export function getPiSupport(version: string): PiSupport {
  const match = /^(\d+)\.(\d+)\.(\d+)/.exec(version)
  if (!match) return "native"

  const major = Number(match[1])
  const minor = Number(match[2])
  const patch = Number(match[3])
  if (major === 0 && minor < 84) return "legacy"
  if (major === 0 && minor === 84 && patch === 0) return "upgrade"
  return "native"
}

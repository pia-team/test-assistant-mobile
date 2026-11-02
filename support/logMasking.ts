const SECRET_PATTERNS: RegExp[] = [
  /((?:password|passwd|pwd|token|secret|cookie|authorization)["']?\s*[:=]\s*["']?)[^\s"',;&]+/gi,
  /(bearer\s+)[A-Za-z0-9\-._~+/]+=*/gi,
  /((?:set-)?cookie:\s*)[^\r\n]+/gi,
];

export function maskDeviceLog(text: string): string {
  return SECRET_PATTERNS.reduce((acc, pattern) => acc.replace(pattern, '$1***'), text);
}

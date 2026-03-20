
import { Agent, fetch as undiciFetch, type RequestInit as UndiciRequestInit } from "undici";

// Configuration from environment
const MAIL_API_USER = process.env.MAIL_API_USER || "";
const MAIL_API_PASSWORD = process.env.MAIL_API_PASSWORD || "";
const MAIL_API_REGISTRY_KEY = process.env.MAIL_API_REGISTRY_KEY || "";
const MAIL_API_APP_ID = process.env.MAIL_API_APP_ID || "";
const MAIL_API_BASE_URL = process.env.MAIL_API_BASE_URL || "https://jajitapps.jindalstainless.com:9234";

// SSL verification - disable for corporate proxy/Zscaler environments
const SKIP_SSL_VERIFY = process.env.MAIL_API_SKIP_SSL_VERIFY === "true";

// Network resilience configuration
const FETCH_TIMEOUT_MS = 15_000; // 15 second timeout
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000; // Initial delay, uses exponential backoff

// Token cache
let cachedToken: { token: string; expiresAt: number } | null = null;

// Log SSL configuration once at startup
if (SKIP_SSL_VERIFY) {
  console.warn("[Mail API] WARNING: SSL verification is DISABLED (MAIL_API_SKIP_SSL_VERIFY=true)");
}

/**
 * Extract hostname from URL for TLS SNI
 */
function getHostnameFromUrl(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

/**
 * Create a custom undici Agent with proper TLS settings
 * For corporate proxy environments (Zscaler), SSL verification may need to be disabled
 */
function createHttpsAgent(hostname: string): Agent {
  return new Agent({
    connect: {
      // Set servername for SNI - ensures proper TLS handshake
      servername: hostname,
      // SSL verification - disable for corporate proxy/Zscaler environments
      rejectUnauthorized: !SKIP_SSL_VERIFY,
      // Disable keep-alive to avoid connection pooling issues with proxies
      keepAlive: false,
    },
    // Connection settings optimized for corporate proxy environments
    pipelining: 1,
    connections: 1,
  });
}

/**
 * Check if an error is a transient network error that should be retried
 */
function isRetryableError(error: unknown): boolean {
  const err = error as { message?: string; cause?: { message?: string; code?: string } };
  const message = err?.message?.toLowerCase() || "";
  const causeMessage = err?.cause?.message?.toLowerCase() || err?.cause?.code?.toLowerCase() || "";

  const retryablePatterns = [
    "econnreset",
    "econnrefused",
    "etimedout",
    "enotfound",
    "enetunreach",
    "ehostunreach",
    "epipe",
    "socket hang up",
    "fetch failed",
    "network error",
    "aborted",
  ];

  // Don't retry certificate errors - they won't fix themselves
  const nonRetryablePatterns = [
    "certificate",
    "altnames",
    "ssl",
    "tls",
  ];

  const isNonRetryable = nonRetryablePatterns.some(
    (p) => message.includes(p) || causeMessage.includes(p)
  );

  if (isNonRetryable) return false;

  return retryablePatterns.some(
    (pattern) => message.includes(pattern) || causeMessage.includes(pattern)
  );
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Robust fetch with custom HTTPS agent, timeout, and retry logic
 */
async function robustFetch(
  url: string,
  options: UndiciRequestInit & { body?: string },
  retries = MAX_RETRIES
): Promise<Response> {
  let lastError: Error | null = null;
  const hostname = getHostnameFromUrl(url);

  // Log configuration on first call (helps with debugging)
  console.log(`[Mail API] Request to: ${url} (SSL verify: ${!SKIP_SSL_VERIFY})`);

  for (let attempt = 1; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    // Create a fresh agent for each attempt (avoids stale connection issues)
    const agent = createHttpsAgent(hostname);

    try {
      // Use undici fetch with custom dispatcher (agent)
      const response = await undiciFetch(url, {
        ...options,
        signal: controller.signal,
        dispatcher: agent,
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          ...options.headers,
        },
      });

      clearTimeout(timeoutId);

      // Convert undici Response to standard Response for compatibility
      return response as unknown as Response;
    } catch (error: unknown) {
      clearTimeout(timeoutId);
      lastError = error as Error;

      const err = error as { message?: string; cause?: { message?: string; code?: string } };
      const cause = err.cause ? ` | Cause: ${err.cause.message || err.cause.code}` : "";
      const isRetryable = isRetryableError(error);
      const isLastAttempt = attempt === retries;

      console.warn(
        `[Mail API] Fetch attempt ${attempt}/${retries} failed: ${err.message}${cause}` +
          (isRetryable && !isLastAttempt ? " (will retry)" : "")
      );

      if (!isRetryable || isLastAttempt) {
        throw error;
      }

      // Exponential backoff: 1s, 2s, 4s...
      const delay = RETRY_DELAY_MS * Math.pow(2, attempt - 1);
      console.log(`[Mail API] Retrying in ${delay}ms...`);
      await sleep(delay);
    } finally {
      // Clean up the agent
      agent.close();
    }
  }

  throw lastError || new Error("Fetch failed after all retries");
}

async function getAuthToken(): Promise<string> {
  // Return cached token if still valid (with 60s buffer)
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
    return cachedToken.token;
  }

  if (!MAIL_API_BASE_URL || !MAIL_API_USER || !MAIL_API_PASSWORD) {
    throw new Error(
      "Mail API credentials not configured. Set MAIL_API_USER, MAIL_API_PASSWORD, MAIL_API_REGISTRY_KEY, MAIL_API_APP_ID, and MAIL_API_BASE_URL in .env",
    );
  }

  const res = await robustFetch(`${MAIL_API_BASE_URL}/api/Auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ccmsUser: MAIL_API_USER,
      password: MAIL_API_PASSWORD,
      regiKey: MAIL_API_REGISTRY_KEY,
      appId: MAIL_API_APP_ID,
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Mail API auth failed (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const token = data.token || data.accEmailess_token || data.bearerToken;

  if (!token) {
    throw new Error("Mail API auth response missing token");
  }

  // Cache token (default 1 hour expiry if not provided)
  const expiresIn = data.expiresIn || data.expires_in || 3600;
  cachedToken = {
    token,
    expiresAt: Date.now() + expiresIn * 1000,
  };

  console.log("Mail API: Token acquired successfully", token);
  return token;
}

interface EmailOptions {
  subject: string;
  emailBody: string;
  toEmail: string;
  ccEmail?: string;
  bccEmail?: string;
}

/**
 * Enhanced email response with comprehensive verification details
 */
export interface EmailResponse {
  // Status
  success: boolean;
  status: "sent" | "failed" | "partial";

  // Timing
  timestamp: string; // ISO 8601 format
  duration: number; // milliseconds

  // Recipients
  recipients: {
    to: string[];
    cc: string[];
    bcc: string[];
    totalCount: number;
  };

  // API Response
  messageId?: string;
  apiResponse?: {
    statusCode: number;
    data?: any;
  };

  // Request Details
  request: {
    subject: string;
    fromEmail: string;
    fromName: string;
    bodyLength: number;
  };

  // Network Details
  network?: {
    attempts: number;
    sslVerified: boolean;
    endpoint: string;
  };

  // Error Details (if failed)
  error?: {
    message: string;
    code?: string;
    cause?: string;
    timestamp: string;
  };
}

/**
 * Parse email string into array (handles comma-separated emails)
 */
function parseEmailString(emailStr: string | undefined): string[] {
  if (!emailStr || emailStr.trim() === "") return [];
  return emailStr
    .split(",")
    .map((e) => e.trim())
    .filter((e) => e.length > 0);
}

export async function sendEmail(options: EmailOptions): Promise<EmailResponse> {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();

  const toEmails = parseEmailString(options.toEmail);
  const ccEmails = parseEmailString(options.ccEmail);
  const bccEmails = parseEmailString(options.bccEmail);
  const totalRecipients = toEmails.length + ccEmails.length + bccEmails.length;

  const toEmailForLog = toEmails.join(", ");

  const emailPayload = {
    fromName: "Training Need Identification Portal",
    fromEmail: "no-reply@jindalstainless.com",
    toEmail: options.toEmail,
    ccEmail: options.ccEmail || "",
    bccEmail: options.bccEmail || "",
    subject: options.subject,
    emailBody: options.emailBody,
  };

  let attempts = 0;
  let lastStatusCode = 0;

  /**
   * Internal function to attempt sending email with current token
   */
  async function attemptSend(token: string): Promise<Response> {
    attempts++;
    return robustFetch(`${MAIL_API_BASE_URL}/api/AutoEmail/InstantEmailSend`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(emailPayload),
    });
  }

  try {
    let token = await getAuthToken();
    let res = await attemptSend(token);
    lastStatusCode = res.status;

    // If 401, clear token cache and retry once with fresh token
    if (res.status === 401) {
      console.log("[Mail API] Token expired, refreshing...");
      cachedToken = null;
      token = await getAuthToken();
      res = await attemptSend(token);
      lastStatusCode = res.status;
    }

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`Mail API send failed (${res.status}): ${errText}`);
    }

    const data = await res.json();
    const duration = Date.now() - startTime;

    console.log(`[Mail API] Email sent successfully → ${toEmailForLog} (${duration}ms)`);

    return {
      success: true,
      status: "sent",
      timestamp,
      duration,
      recipients: {
        to: toEmails,
        cc: ccEmails,
        bcc: bccEmails,
        totalCount: totalRecipients,
      },
      messageId: data.messageId || data.id || data.emailId,
      apiResponse: {
        statusCode: lastStatusCode,
        data: data,
      },
      request: {
        subject: options.subject,
        fromEmail: "no-reply@jindalstainless.com",
        fromName: "Internal Audit Management System Hisar",
        bodyLength: options.emailBody.length,
      },
      network: {
        attempts,
        sslVerified: !SKIP_SSL_VERIFY,
        endpoint: MAIL_API_BASE_URL,
      },
    };
  } catch (error: any) {
    const duration = Date.now() - startTime;
    const errorTimestamp = new Date().toISOString();

    const cause = error.cause
      ? ` | Cause: ${error.cause?.message || error.cause?.code || error.cause}`
      : "";
    const fullError = error.message + cause;

    console.error(`[Mail API] Failed to send email to ${toEmailForLog}:`, fullError);

    return {
      success: false,
      status: "failed",
      timestamp,
      duration,
      recipients: {
        to: toEmails,
        cc: ccEmails,
        bcc: bccEmails,
        totalCount: totalRecipients,
      },
      apiResponse: lastStatusCode > 0 ? { statusCode: lastStatusCode } : undefined,
      request: {
        subject: options.subject,
        fromEmail: "no-reply@jindalstainless.com",
        fromName: "Internal Audit Management System Hisar",
        bodyLength: options.emailBody.length,
      },
      network: {
        attempts,
        sslVerified: !SKIP_SSL_VERIFY,
        endpoint: MAIL_API_BASE_URL,
      },
      error: {
        message: error.message,
        code: error.code || error.cause?.code,
        cause: error.cause?.message || error.cause?.code,
        timestamp: errorTimestamp,
      },
    };
  }
}

// Health check
export function getMailApiStatus() {
  return {
    configured: !!(MAIL_API_USER && MAIL_API_PASSWORD && MAIL_API_BASE_URL),
    baseUrl: MAIL_API_BASE_URL || "NOT SET",
    user: MAIL_API_USER ? `${MAIL_API_USER.substring(0, 3)}***` : "NOT SET",
    appId: MAIL_API_APP_ID || "NOT SET",
    registryKey: MAIL_API_REGISTRY_KEY ? "SET" : "NOT SET",
    tokenCached: !!cachedToken,
    sslVerification: !SKIP_SSL_VERIFY,
  };
}

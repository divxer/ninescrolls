import type { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, UpdateCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client, CopyObjectCommand, DeleteObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { z } from 'zod';
import crypto from 'node:crypto';
import { RFQ_FIELD_LIMITS as L } from '../../lib/rfq/limits';
import {
    RFQ_EQUIPMENT_CATEGORY_VALUES,
    RFQ_ATTACHMENT_MIME_TYPES,
    RFQ_ROLE_VALUES,
    RFQ_BUDGET_RANGE_VALUES,
    RFQ_TIMELINE_VALUES,
    RFQ_FUNDING_STATUS_VALUES,
    MAX_RFQ_ATTACHMENTS,
    MAX_RFQ_ATTACHMENT_SIZE,
    normalizeRfqText,
    normalizeRfqEmail,
    type RfqEquipmentCategory,
} from '../../lib/rfq/contract';
import { invokeOrganizationApi } from '../../lib/organization/invoke-org-api';
import { computeRfqScore } from '../../lib/organization/lead-score';
import { emitTimelineEventToCrm, invokeCrmAction } from '../../lib/crm/invoke-crm-api';
import { buildRfqEmitArgs } from '../../lib/crm/emit-builders';
import { toSend, upsertVisitorBridge } from '../../lib/crm/visitor-bridge';

// ---------------------------------------------------------------------------
// Clients
// ---------------------------------------------------------------------------
const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient, {
    marshallOptions: { removeUndefinedValues: true },
});
const s3Client = new S3Client({});

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------
const TABLE_NAME = () => process.env.INTELLIGENCE_TABLE!;
const BUCKET_NAME = () => process.env.DOCUMENTS_BUCKET!;
const TURNSTILE_SECRET = () => process.env.TURNSTILE_SECRET_KEY!;
const SENDGRID_API_KEY = () => process.env.SENDGRID_API_KEY;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const ALLOWED_ORIGINS = [
    'https://ninescrolls.com',
    'https://www.ninescrolls.com',
    'http://localhost:5173',
];

// Equipment categories + attachment constraints come from the shared RFQ
// contract (amplify/lib/rfq/contract.ts); the form derives the same values, so
// a category or file type one side accepts and the other rejects can't ship.
// Guarded by the parity tests in handler.test.ts + rfqEquipmentOptions.test.ts.

// role / budget / timeline / funding enums now come from the shared contract
// (RFQ_ROLE_VALUES etc.) so the formal schema and the draft schema cannot drift.
// referralSource stays local — it is not a draft field.
const REFERRAL_SOURCES = [
    'web-search',
    'google-ads',
    'referral',
    'linkedin',
    'conference',
    'publication',
    'existing-customer',
    'direct-outreach',
    'other',
] as const;

// Attachment upload constraints come from the shared RFQ contract so the form's
// ALLOWED_FILE_TYPES / MAX_FILES / MAX_FILE_SIZE and this Lambda cannot diverge.
const PRESIGNED_URL_EXPIRY = 15 * 60; // 15 minutes

/**
 * Shape of every key this Lambda hands out: temp/rfq/<16 hex>/<sanitized name>.
 * moveAttachments() feeds these straight into CopyObject + DeleteObject with
 * bucket-wide write credentials, so anything not matching this exact shape must
 * never reach it — otherwise a caller could name an arbitrary key (an order
 * contract, say) and have the server relocate and delete it.
 */
const TEMP_ATTACHMENT_KEY_RE = /^temp\/rfq\/[a-f0-9]{16}\/[a-zA-Z0-9._-]{1,200}$/;

export function isValidTempAttachmentKey(key: string): boolean {
    return TEMP_ATTACHMENT_KEY_RE.test(key) && !key.includes('..');
}

// ---------------------------------------------------------------------------
// Zod Schema — matches §12.10.3 API format
// ---------------------------------------------------------------------------
// Length caps derive from the shared source of truth (amplify/lib/rfq/limits)
// so client (maxLength + validateField) and server can never drift.
// Normalize (trim + NFC) human-entered prose/address text before length
// validation, using the same canonical helper the draft schema uses. Applied
// ONLY to human text — never to opaque/security values (turnstileToken,
// attachmentKeys, visitorId) or field-specific canonicalizers (referralSource).
const nText = (schema: z.ZodString) => z.string().transform(normalizeRfqText).pipe(schema);

export const rfqSchema = z.object({
    name: nText(z.string().min(L.name.min).max(L.name.max)),
    email: z.string().transform(normalizeRfqEmail).pipe(z.string().max(L.email.max).email()),
    phone: nText(z.string().max(L.phone.max)).optional(),
    institution: nText(z.string().min(L.institution.min).max(L.institution.max)),
    department: nText(z.string().max(L.department.max)).optional(),
    role: z.enum(RFQ_ROLE_VALUES).optional(),
    equipmentCategory: z.enum(RFQ_EQUIPMENT_CATEGORY_VALUES),
    specificModel: nText(z.string().max(L.specificModel.max)).optional(),
    applicationDescription: nText(z.string().min(L.applicationDescription.min).max(L.applicationDescription.max)),
    keySpecifications: nText(z.string().max(L.keySpecifications.max)).optional(),
    quantity: z.number().int().positive().default(1),
    budgetRange: z.enum(RFQ_BUDGET_RANGE_VALUES).optional(),
    timeline: z.enum(RFQ_TIMELINE_VALUES).optional(),
    fundingStatus: z.enum(RFQ_FUNDING_STATUS_VALUES).optional(),
    referralSource: z.enum(REFERRAL_SOURCES).optional(),
    existingEquipment: nText(z.string().max(L.existingEquipment.max)).optional(),
    additionalComments: nText(z.string().max(L.additionalComments.max)).optional(),
    turnstileToken: z.string().min(1),
    // Browser visitor identity for the VISITOR# bridge (2C-analytics)
    visitorId: z.string().max(L.visitorId.max).optional(),
    // First-party last-non-direct attribution snapshot (paid-click join). utm
    // fields lowercased client-side; click ids verbatim. All sub-fields optional.
    attribution: z.object({
        source: z.string().max(L.attribution.source.max).optional(),
        medium: z.string().max(L.attribution.medium.max).optional(),
        campaign: z.string().max(L.attribution.campaign.max).optional(),
        term: z.string().max(L.attribution.term.max).optional(),
        content: z.string().max(L.attribution.content.max).optional(),
        gclid: z.string().max(L.attribution.gclid.max).optional(),
        gbraid: z.string().max(L.attribution.gbraid.max).optional(),
        wbraid: z.string().max(L.attribution.wbraid.max).optional(),
        msclkid: z.string().max(L.attribution.msclkid.max).optional(),
        capturedAt: z.string().max(L.attribution.capturedAt.max).optional(),
        landingPath: z.string().max(L.attribution.landingPath.max).optional(),
    }).optional(),
    // S3 keys from presigned URL uploads — must be temp/rfq/ keys this Lambda issued
    attachmentKeys: z
        .array(z.string().max(500).refine(isValidTempAttachmentKey, {
            message: 'attachmentKeys must reference a temp/rfq/ upload',
        }))
        .max(MAX_RFQ_ATTACHMENTS)
        .optional(),
    // Budgetary quote with shipping address for tax calculation
    needsBudgetaryQuote: z.boolean().optional(),
    shippingAddress: nText(z.string().max(L.shippingAddress.max)).optional(),
    shippingCity: nText(z.string().max(L.shippingCity.max)).optional(),
    shippingState: nText(z.string().max(L.shippingState.max)).optional(),
    shippingZipCode: nText(z.string().max(L.shippingZipCode.max)).optional(),
    shippingCountry: nText(z.string().max(L.shippingCountry.max)).optional(),
    // Article attribution — silently dropped if invalid (never blocks submission)
    referrerSource: z
        .string()
        .optional()
        .transform((v) => {
            if (!v) return undefined;
            if (v.length > L.referrerSource.max || !/^(insights|news|products)\/[a-z0-9-]+$/.test(v)) {
                console.warn(`Invalid referrerSource ignored: ${v.slice(0, 50)}`);
                return undefined;
            }
            return v;
        }),
}).refine(
    (data) => {
        if (!data.needsBudgetaryQuote) return true;
        return !!(data.shippingAddress?.trim() && data.shippingCity?.trim() &&
                  data.shippingState?.trim() && data.shippingZipCode?.trim());
    },
    { message: 'Shipping address is required for budgetary quote', path: ['shippingAddress'] },
);

export type RfqInput = z.infer<typeof rfqSchema>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function getCorsHeaders(origin?: string) {
    const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
    return {
        'Access-Control-Allow-Origin': allowed,
        'Access-Control-Allow-Methods': 'POST,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '300',
    };
}

function sanitize(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function generateRfqId(): string {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand = crypto.randomBytes(3).toString('hex');
    return `rfq-${date}-${rand}`;
}

function generateReferenceNumber(rfqId: string): string {
    // Extract date and short hash: rfq-20260310-a1b2c3 → RFQ-20260310-A1B2
    const parts = rfqId.split('-');
    const date = parts[1];
    const hash = parts[2].substring(0, 4).toUpperCase();
    return `RFQ-${date}-${hash}`;
}

function hashIp(ip: string): string {
    return crypto.createHash('sha256').update(ip).digest('hex');
}

// ---------------------------------------------------------------------------
// Turnstile verification
// ---------------------------------------------------------------------------
async function verifyTurnstile(token: string): Promise<boolean> {
    const secret = TURNSTILE_SECRET();
    if (!secret) {
        console.warn('TURNSTILE_SECRET_KEY not configured, skipping verification');
        return true;
    }

    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            secret,
            response: token,
        }),
    });

    const result = await response.json() as { success: boolean; 'error-codes'?: string[] };
    if (!result.success) {
        console.error('Turnstile verification failed:', JSON.stringify(result));
    }
    return result.success;
}

// ---------------------------------------------------------------------------
// getUploadUrl — presigned PUT into temp/rfq/ for the public RFQ form
//
// Runs before Turnstile: files are uploaded while the visitor is still filling
// the form, so there is no token to spend yet. Abuse is bounded by the signed
// ContentLength (S3 rejects any body of a different size), the MIME allow-list,
// and the bucket's 1-day temp/ expiry. Keys only become durable if a later
// submit-RFQ call passes Turnstile and moves them to rfqs/<rfqId>/.
// ---------------------------------------------------------------------------
export const uploadUrlSchema = z.object({
    action: z.literal('getUploadUrl'),
    fileName: z.string().min(1).max(255),
    mimeType: z.enum(RFQ_ATTACHMENT_MIME_TYPES),
    fileSize: z.number().int().positive().max(MAX_RFQ_ATTACHMENT_SIZE),
});

async function handleGetUploadUrl(
    rawBody: unknown,
    corsHeaders: Record<string, string>,
) {
    const parsed = uploadUrlSchema.safeParse(rawBody);
    if (!parsed.success) {
        return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({
                success: false,
                error: 'Invalid upload request',
                details: parsed.error.flatten().fieldErrors,
            }),
        };
    }

    const { fileName, mimeType, fileSize } = parsed.data;

    // Strip any path components before sanitizing, so a name like
    // "../../etc/passwd" cannot contribute directory structure to the key.
    const baseName = fileName.split('/').pop()!.split('\\').pop()!;
    const safeName = baseName.replace(/\.\./g, '').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 200) || 'upload';
    const uploadId = crypto.randomBytes(8).toString('hex');
    const s3Key = `temp/rfq/${uploadId}/${safeName}`;

    const command = new PutObjectCommand({
        Bucket: BUCKET_NAME(),
        Key: s3Key,
        ContentType: mimeType,
        // Signed, so S3 rejects a PUT whose body length differs — this is what
        // enforces MAX_RFQ_ATTACHMENT_SIZE for an unauthenticated caller.
        ContentLength: fileSize,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- AWS SDK version mismatch between root and function deps
    const uploadUrl = await getSignedUrl(s3Client as any, command as any, {
        expiresIn: PRESIGNED_URL_EXPIRY,
    });

    console.log(`RFQ attachment presigned: ${s3Key}`);

    return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
            success: true,
            uploadUrl,
            s3Key,
            expiresAt: new Date(Date.now() + PRESIGNED_URL_EXPIRY * 1000).toISOString(),
        }),
    };
}

// ---------------------------------------------------------------------------
// capturePartial — persist Step-1 fields for an abandoned RFQ
//
// Fired when the customer advances from Step 1 to Step 2. Keyed by visitorId so
// repeated captures overwrite one row and a later full submission can supersede
// it (see the delete in the submit path). Fields are lenient (Step-1 validation
// already passed client-side; this is best-effort visibility, not the RFQ of
// record) — capped + normalized, no min-length, no CAPTCHA, no side effects.
// ---------------------------------------------------------------------------
const VISITOR_ID_RE = /^[A-Za-z0-9_-]{1,100}$/;

/** Deterministic key for a visitor's partial row, so re-capture overwrites + submit can delete it. */
export function partialRfqId(visitorId: string): string {
    return `PARTIAL#${visitorId}`;
}

export const capturePartialSchema = z.object({
    action: z.literal('capturePartial'),
    visitorId: z.string().regex(VISITOR_ID_RE),
    name: nText(z.string().max(L.name.max)).optional(),
    email: z.string().transform(normalizeRfqEmail).pipe(z.string().max(L.email.max)).optional(),
    institution: nText(z.string().max(L.institution.max)).optional(),
    equipmentCategory: z.enum(RFQ_EQUIPMENT_CATEGORY_VALUES).optional(),
    applicationDescription: nText(z.string().max(L.applicationDescription.max)).optional(),
});

async function handleCapturePartial(rawBody: unknown, corsHeaders: Record<string, string>) {
    const parsed = capturePartialSchema.safeParse(rawBody);
    if (!parsed.success) {
        return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({ success: false, error: 'Invalid partial capture' }),
        };
    }
    const { visitorId, name, email, institution, equipmentCategory, applicationDescription } = parsed.data;
    const now = new Date().toISOString();
    const rfqId = partialRfqId(visitorId);
    const item: Record<string, unknown> = {
        PK: `RFQ#${rfqId}`,
        SK: 'META',
        // Same GSI1 status-partition convention the admin listRfqs resolver queries.
        GSI1PK: 'RFQ_STATUS#partial',
        GSI1SK: `${now}#${rfqId}`,
        rfqId,
        status: 'partial',
        submittedAt: now, // capture time — drives the admin list ordering + display
        updatedAt: now,
        visitorId,
        // Bound growth: abandoned partials that never convert are cleaned up by the
        // table's TTL (attribute name 'TTL', epoch seconds). Converted ones are deleted
        // sooner by the submit path. 90 days = generous follow-up window for sales.
        TTL: Math.floor(Date.parse(now) / 1000) + 90 * 24 * 60 * 60,
    };
    if (name) item.name = name;
    if (email) item.email = email;
    if (institution) item.institution = institution;
    if (equipmentCategory) item.equipmentCategory = equipmentCategory;
    if (applicationDescription) item.applicationDescription = applicationDescription;

    // Unconditional Put = upsert: the same visitor advancing to Step 2 again just
    // refreshes their single partial row rather than piling up duplicates.
    await docClient.send(new PutCommand({ TableName: TABLE_NAME(), Item: item }));
    console.log(`Partial RFQ captured for visitor ${visitorId}`);

    return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ success: true }) };
}

// ---------------------------------------------------------------------------
// Move attachments from temp/ to rfqs/<rfqId>/
// ---------------------------------------------------------------------------
interface MoveAttachmentsResult {
    /** Final rfqs/<rfqId>/ keys for the files that relocated successfully. */
    movedKeys: string[];
    /** Original temp/ keys of files that failed to copy/delete (never saved). */
    failedKeys: string[];
}

/**
 * Relocates each temp upload to its permanent RFQ prefix. A per-file failure is
 * isolated (logged, its source key returned) rather than aborting the batch — the
 * caller must surface the loss instead of silently dropping an intended attachment.
 */
async function moveAttachments(rfqId: string, tempKeys: string[]): Promise<MoveAttachmentsResult> {
    const bucket = BUCKET_NAME();
    const movedKeys: string[] = [];
    const failedKeys: string[] = [];

    for (const tempKey of tempKeys) {
        // Re-checked here and not only at the schema: this loop deletes whatever
        // key it is handed, so it must not depend on a caller having validated first.
        if (!isValidTempAttachmentKey(tempKey)) {
            console.error(`Refusing to move non-temp attachment key: ${tempKey.slice(0, 100)}`);
            continue;
        }

        const fileName = tempKey.split('/').pop() ?? tempKey;
        const destKey = `rfqs/${rfqId}/${fileName}`;

        // The copy is the operation that saves the file. If it fails, the file is
        // genuinely lost — record the source key so the caller can surface it.
        try {
            await s3Client.send(new CopyObjectCommand({
                Bucket: bucket,
                CopySource: `${bucket}/${tempKey}`,
                Key: destKey,
            }));
        } catch (err) {
            failedKeys.push(tempKey);
            console.error(`Failed to copy attachment ${tempKey}:`, err);
            continue;
        }

        // Copy succeeded: the file is safely at destKey, so it counts as moved
        // regardless of whether temp cleanup below succeeds.
        movedKeys.push(destKey);
        console.log(`Attachment moved: ${tempKey} → ${destKey}`);

        // Deleting the temp source is best-effort cleanup, not data loss — a
        // failure just leaves an orphaned temp object (lifecycle-expired later).
        try {
            await s3Client.send(new DeleteObjectCommand({
                Bucket: bucket,
                Key: tempKey,
            }));
        } catch (err) {
            console.warn(`Copied ${tempKey} → ${destKey} but failed to delete temp source:`, err);
        }
    }

    return { movedKeys, failedKeys };
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

// Total map: every RfqEquipmentCategory must have a friendly label, so a newly
// added category is a compile error here rather than a raw enum value in the email.
/** Human-readable labels for equipment category values (used in Request Summary) */
export const equipmentCategoryLabels: Record<RfqEquipmentCategory, string> = {
    'ICP': 'ICP Etching System',
    'PECVD': 'PECVD System',
    'Sputter': 'Sputter Deposition System',
    'E-Beam': 'E-Beam Evaporation System',
    'ALD': 'ALD System',
    'RIE': 'RIE System',
    'IBE': 'Ion Beam Etching System',
    'HDP-CVD': 'HDP-CVD System',
    'Plasma-Cleaner': 'Plasma Cleaner',
    'Stripper': 'Photoresist Stripping System',
    'Coater-Developer': 'Coater / Developer',
    'Probe-Station': 'Wafer Probe Station',
    'Other': 'Other / Need Recommendation',
};

// Intentionally Partial: 'Other' has no sensible product-family phrase and falls
// back to "plasma processing systems" in the greeting. Real categories should map.
/** Short product-family phrase for the greeting line (no trailing "system/systems") */
export const equipmentGreetingPhrase: Partial<Record<RfqEquipmentCategory, string>> = {
    'ICP': 'ICP etching',
    'PECVD': 'PECVD',
    'Sputter': 'sputter deposition',
    'E-Beam': 'e-beam evaporation',
    'ALD': 'ALD',
    'RIE': 'RIE',
    'IBE': 'ion beam etching',
    'HDP-CVD': 'HDP-CVD',
    'Plasma-Cleaner': 'plasma cleaner',
    'Stripper': 'photoresist stripping',
    'Coater-Developer': 'coater/developer',
    'Probe-Station': 'wafer probing',
};

/** Send confirmation email to customer via SendGrid — §12.10.9 */
async function sendConfirmationEmail(data: RfqInput, referenceNumber: string, failedAttachmentCount = 0): Promise<void> {
    const apiKey = SENDGRID_API_KEY();
    if (!apiKey) {
        console.warn('SENDGRID_API_KEY not configured, skipping confirmation email');
        return;
    }

    const equipmentLabel = equipmentCategoryLabels[data.equipmentCategory] ?? data.equipmentCategory;
    // Partial map: undefined for 'Other', which falls back to the generic greeting.
    const greetingPhrase = equipmentGreetingPhrase[data.equipmentCategory];

    // Build summary rows — only include fields that have values
    const summaryRows = [
        `<tr><td style="padding:6px 12px 6px 0;font-weight:600;color:#555;white-space:nowrap;vertical-align:top;">Equipment:</td><td style="padding:6px 0;vertical-align:top;">${sanitize(equipmentLabel)}${data.specificModel ? ' — ' + sanitize(data.specificModel) : ''}</td></tr>`,
        `<tr><td style="padding:6px 12px 6px 0;font-weight:600;color:#555;white-space:nowrap;vertical-align:top;">Quantity:</td><td style="padding:6px 0;vertical-align:top;">${data.quantity}</td></tr>`,
        `<tr><td style="padding:6px 12px 6px 0;font-weight:600;color:#555;white-space:nowrap;vertical-align:top;">Institution:</td><td style="padding:6px 0;vertical-align:top;">${sanitize(data.institution)}</td></tr>`,
        data.applicationDescription ? `<tr><td style="padding:6px 12px 6px 0;font-weight:600;color:#555;white-space:nowrap;vertical-align:top;">Application:</td><td style="padding:6px 0;vertical-align:top;">${sanitize(data.applicationDescription.length > 120 ? data.applicationDescription.slice(0, 120) + '…' : data.applicationDescription)}</td></tr>` : '',
        data.keySpecifications ? `<tr><td style="padding:6px 12px 6px 0;font-weight:600;color:#555;white-space:nowrap;vertical-align:top;">Key Specs:</td><td style="padding:6px 0;vertical-align:top;">${sanitize(data.keySpecifications.length > 120 ? data.keySpecifications.slice(0, 120) + '…' : data.keySpecifications)}</td></tr>` : '',
        data.needsBudgetaryQuote && data.shippingCountry ? `<tr><td style="padding:6px 12px 6px 0;font-weight:600;color:#555;white-space:nowrap;vertical-align:top;">Shipping Location:</td><td style="padding:6px 0;vertical-align:top;">${[data.shippingState, data.shippingCountry].filter(Boolean).map(s => sanitize(s!)).join(', ')}</td></tr>` : '',
    ].filter(Boolean).join('\n');

    // Gentle, actionable note when one or more uploads didn't make it through —
    // better the customer re-sends than believes a lost file arrived. Kept low-key.
    const attachmentNotice = failedAttachmentCount > 0 ? `
<p style="background:#fff8e1;border-left:3px solid #f0b400;padding:10px 14px;margin-top:16px;font-size:14px;">
  Note: we couldn't process ${failedAttachmentCount === 1 ? 'one of your attached files' : `${failedAttachmentCount} of your attached files`}. Please reply to this email to resend ${failedAttachmentCount === 1 ? 'it' : 'them'} so we can include ${failedAttachmentCount === 1 ? 'it' : 'them'} with your request.
</p>` : '';

    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            personalizations: [{ to: [{ email: data.email }] }],
            from: { email: 'noreply@ninescrolls.com', name: 'NineScrolls Sales Team' },
            subject: `Quote Request Received – ${referenceNumber}`,
            content: [{
                type: 'text/html',
                value: `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #333; line-height: 1.6; max-width: 600px;">

<p>Dear ${sanitize(data.name)},</p>

<p>Thank you for your interest in our ${greetingPhrase ? sanitize(greetingPhrase) + ' systems' : 'plasma processing systems'}.</p>

<p>Your request has been logged under reference number <strong>${referenceNumber}</strong>. Our sales and technical team will review the submitted requirements and respond with the appropriate recommendation and quotation within 1–2 business days.</p>

<p style="font-weight:600;margin-bottom:8px;">Request Summary</p>
<table style="border-collapse:collapse;font-size:14px;">
${summaryRows}
</table>
${attachmentNotice}
<p style="margin-top:20px;">If you need to add any specifications or supporting documents, simply reply to this email or contact us at <a href="mailto:sales@ninescrolls.com">sales@ninescrolls.com</a>. Please reference <strong>${referenceNumber}</strong> in any future communications regarding this request.</p>

<p style="color:#888;font-size:13px;margin-top:20px;">This is an automated acknowledgment of your request. A member of our team will follow up shortly.</p>

<hr style="border:none;border-top:1px solid #e0e0e0;margin:24px 0 16px;">
<p style="font-size:13px;color:#666;margin:0;">
  Best regards,<br>
  <strong>NineScrolls Sales Team</strong><br>
  NineScrolls LLC<br>
  <a href="mailto:sales@ninescrolls.com" style="color:#1a73e8;text-decoration:none;">sales@ninescrolls.com</a>
  &nbsp;·&nbsp;
  <a href="https://ninescrolls.com" style="color:#1a73e8;text-decoration:none;">ninescrolls.com</a>
</p>

</div>
                `.trim(),
            }],
            reply_to: { email: 'sales@ninescrolls.com', name: 'NineScrolls Sales Team' },
        }),
    });

    if (!response.ok) {
        const errBody = await response.text();
        console.error(`SendGrid error ${response.status}: ${errBody}`);
    } else {
        console.log(`Confirmation email sent to ${data.email}`);
    }
}

/** Send internal notification email to sales team via SendGrid */
async function sendInternalNotification(data: RfqInput, rfqId: string, referenceNumber: string, attachmentKeys: string[], failedAttachmentKeys: string[] = []): Promise<void> {
    const apiKey = SENDGRID_API_KEY();
    if (!apiKey) {
        console.warn('SENDGRID_API_KEY not configured, skipping internal notification');
        return;
    }

    const timelineLabels: Record<string, string> = {
        'immediate': 'Immediate',
        'within-3-months': 'Within 3 months',
        'within-6-months': 'Within 6 months',
        '6-plus-months': '6+ months',
        'budgetary-planning': 'Budgetary planning',
    };

    const fundingLabels: Record<string, string> = {
        'funded': 'Funded',
        'budget-under-review': 'Budget under review',
        'grant-pending': 'Grant pending',
        'exploring': 'Exploring',
        'prefer-not-to-say': 'Prefer not to say',
    };

    const shippingSection = data.needsBudgetaryQuote ? `
        <h3 style="margin-top:20px;">Shipping Address (Budgetary Quote)</h3>
        <p>${[data.shippingAddress, data.shippingCity, data.shippingState, data.shippingZipCode, data.shippingCountry]
            .filter(Boolean).map(s => sanitize(s!)).join(', ')}</p>
    ` : '';

    // Surface partial attachment loss explicitly — a file that failed to relocate
    // is gone, and neither sales nor the customer learns of it otherwise. The lead
    // still succeeds (handler returns 200); we just refuse to hide the loss.
    const totalRequested = attachmentKeys.length + failedAttachmentKeys.length;
    const failedCount = failedAttachmentKeys.length;
    const attachmentHeading = failedCount > 0
        ? `Attachments (${attachmentKeys.length} of ${totalRequested} attached; ${failedCount} failed to process)`
        : `Attachments (${attachmentKeys.length})`;
    const failedAttachmentBlock = failedCount > 0 ? `
        <p style="color:#b91c1c;font-weight:700;margin-top:8px;">⚠ ${failedCount} attachment${failedCount === 1 ? '' : 's'} failed to process and ${failedCount === 1 ? 'was' : 'were'} NOT saved — ask the customer to resend:</p>
        <ul>${failedAttachmentKeys.map(k => `<li style="color:#b91c1c;">${sanitize(k)}</li>`).join('')}</ul>
    ` : '';
    const attachmentSection = totalRequested > 0 ? `
        <h3 style="margin-top:20px;">${attachmentHeading}</h3>
        ${attachmentKeys.length > 0 ? `<ul>${attachmentKeys.map(k => `<li>${sanitize(k)}</li>`).join('')}</ul>` : ''}
        ${failedAttachmentBlock}
    ` : '';

    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            personalizations: [{ to: [{ email: 'sales@ninescrolls.com' }] }],
            from: { email: 'noreply@ninescrolls.com', name: 'NineScrolls RFQ System' },
            reply_to: { email: data.email, name: data.name },
            subject: `New RFQ: ${referenceNumber} — ${equipmentCategoryLabels[data.equipmentCategory] ?? data.equipmentCategory} — ${sanitize(data.institution)}`,
            content: [{
                type: 'text/html',
                value: `
<h2>New RFQ Submission</h2>
<p><strong>Reference:</strong> ${referenceNumber} &nbsp;|&nbsp; <strong>ID:</strong> ${rfqId}</p>

<h3>Contact Information</h3>
<table style="border-collapse:collapse;">
  <tr><td style="padding:4px 8px;font-weight:600;">Name:</td><td style="padding:4px 8px;">${sanitize(data.name)}</td></tr>
  <tr><td style="padding:4px 8px;font-weight:600;">Email:</td><td style="padding:4px 8px;"><a href="mailto:${sanitize(data.email)}">${sanitize(data.email)}</a></td></tr>
  ${data.phone ? `<tr><td style="padding:4px 8px;font-weight:600;">Phone:</td><td style="padding:4px 8px;">${sanitize(data.phone)}</td></tr>` : ''}
  <tr><td style="padding:4px 8px;font-weight:600;">Institution:</td><td style="padding:4px 8px;">${sanitize(data.institution)}</td></tr>
  ${data.department ? `<tr><td style="padding:4px 8px;font-weight:600;">Department:</td><td style="padding:4px 8px;">${sanitize(data.department)}</td></tr>` : ''}
  ${data.role ? `<tr><td style="padding:4px 8px;font-weight:600;">Role:</td><td style="padding:4px 8px;">${sanitize(data.role)}</td></tr>` : ''}
</table>

<h3 style="margin-top:20px;">Equipment & Application</h3>
<table style="border-collapse:collapse;">
  <tr><td style="padding:4px 8px;font-weight:600;">Category:</td><td style="padding:4px 8px;"><strong>${sanitize(equipmentCategoryLabels[data.equipmentCategory] ?? data.equipmentCategory)}</strong></td></tr>
  ${data.specificModel ? `<tr><td style="padding:4px 8px;font-weight:600;">Specific Model:</td><td style="padding:4px 8px;">${sanitize(data.specificModel)}</td></tr>` : ''}
  <tr><td style="padding:4px 8px;font-weight:600;">Quantity:</td><td style="padding:4px 8px;">${data.quantity}</td></tr>
  ${data.budgetRange ? `<tr><td style="padding:4px 8px;font-weight:600;">Budget Range:</td><td style="padding:4px 8px;">${sanitize(data.budgetRange)}</td></tr>` : ''}
  ${data.timeline ? `<tr><td style="padding:4px 8px;font-weight:600;">Timeline:</td><td style="padding:4px 8px;">${timelineLabels[data.timeline] ?? data.timeline}</td></tr>` : ''}
  ${data.fundingStatus ? `<tr><td style="padding:4px 8px;font-weight:600;">Funding Status:</td><td style="padding:4px 8px;">${fundingLabels[data.fundingStatus] ?? data.fundingStatus}</td></tr>` : ''}
  <tr><td style="padding:4px 8px;font-weight:600;">Budgetary Quote:</td><td style="padding:4px 8px;">${data.needsBudgetaryQuote ? 'Yes' : 'No'}</td></tr>
</table>

<h3 style="margin-top:20px;">Application Description</h3>
<p style="background:#f8f9fa;padding:12px;border-radius:4px;">${sanitize(data.applicationDescription)}</p>

${data.keySpecifications ? `<h3 style="margin-top:20px;">Key Specifications</h3><p style="background:#f8f9fa;padding:12px;border-radius:4px;">${sanitize(data.keySpecifications)}</p>` : ''}

${data.existingEquipment ? `<h3 style="margin-top:20px;">Existing Equipment</h3><p style="background:#f8f9fa;padding:12px;border-radius:4px;">${sanitize(data.existingEquipment)}</p>` : ''}

${data.additionalComments ? `<h3 style="margin-top:20px;">Additional Comments</h3><p style="background:#f8f9fa;padding:12px;border-radius:4px;">${sanitize(data.additionalComments)}</p>` : ''}

${shippingSection}
${attachmentSection}

<hr style="margin-top:30px;border:none;border-top:1px solid #e0e0e0;">
<p style="color:#666;font-size:12px;">This is an automated notification from the NineScrolls RFQ system. Reply directly to respond to the customer.</p>
                `.trim(),
            }],
            tracking_settings: {
                click_tracking: { enable: false },
                open_tracking: { enable: false },
            },
        }),
    });

    if (!response.ok) {
        const errBody = await response.text();
        console.error(`SendGrid internal notification error ${response.status}: ${errBody}`);
    } else {
        console.log(`Internal notification sent to sales@ninescrolls.com for ${referenceNumber}`);
    }
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------
export const handler: APIGatewayProxyHandlerV2 = async (event) => {
    console.log('submit-rfq Lambda invoked');

    const origin = event.headers?.origin || event.headers?.Origin;
    const corsHeaders = getCorsHeaders(origin);

    // Handle CORS preflight
    const method = event.requestContext?.http?.method
        || (event as unknown as { httpMethod?: string }).httpMethod;

    if (method === 'OPTIONS') {
        return { statusCode: 200, headers: corsHeaders, body: '' };
    }

    try {
        // 0. Parse body
        if (!event.body) {
            return {
                statusCode: 400,
                headers: corsHeaders,
                body: JSON.stringify({ success: false, error: 'Request body is required' }),
            };
        }

        let rawBody: unknown;
        try {
            rawBody = JSON.parse(event.body);
        } catch {
            return {
                statusCode: 400,
                headers: corsHeaders,
                body: JSON.stringify({ success: false, error: 'Invalid JSON' }),
            };
        }

        // 0b. Attachment presign requests share this Lambda but skip the RFQ path.
        // Dispatch on the body's `action` rather than the request path: this handler
        // is typed for payload v2 but mounted on a v1 REST API, so the path shape
        // differs between the two event formats while the body does not.
        if ((rawBody as { action?: unknown } | null)?.action === 'getUploadUrl') {
            return await handleGetUploadUrl(rawBody, corsHeaders);
        }

        // Step-1 partial capture shares this Lambda but skips the full RFQ path:
        // no CAPTCHA (mid-form), no side effects, just one upsert so an abandoned
        // Step 1 is still visible in the admin RFQ list.
        if ((rawBody as { action?: unknown } | null)?.action === 'capturePartial') {
            return await handleCapturePartial(rawBody, corsHeaders);
        }

        // 1. Validate Turnstile CAPTCHA
        const isPrivateIP = (addr: string): boolean => {
            const parts = addr.split('.').map(Number);
            if (parts.length !== 4 || parts.some(isNaN)) return false;
            const [a, b] = parts;
            return a === 10 || (a === 172 && b >= 16 && b <= 31) ||
                (a === 192 && b === 168) || a === 127 ||
                (a === 169 && b === 254) || (a === 100 && b >= 64 && b <= 127);
        };
        const cfViewerAddr = event.headers?.['CloudFront-Viewer-Address'] || event.headers?.['cloudfront-viewer-address'];
        const xff = event.headers?.['x-forwarded-for'];
        const ip = (() => {
            if (cfViewerAddr) {
                return cfViewerAddr.split(':').slice(0, -1).join(':') || cfViewerAddr;
            }
            if (xff) {
                const ips = xff.split(',').map((s: string) => s.trim());
                return ips.find((addr: string) => !isPrivateIP(addr)) || ips[0];
            }
            return event.requestContext?.http?.sourceIp || '0.0.0.0';
        })();

        const turnstileToken = (rawBody as Record<string, unknown>).turnstileToken as string;
        if (!turnstileToken) {
            return {
                statusCode: 400,
                headers: corsHeaders,
                body: JSON.stringify({ success: false, error: 'CAPTCHA verification required' }),
            };
        }

        const turnstileValid = await verifyTurnstile(turnstileToken);
        if (!turnstileValid) {
            return {
                statusCode: 403,
                headers: corsHeaders,
                body: JSON.stringify({ success: false, error: 'CAPTCHA verification failed' }),
            };
        }

        // 2. Schema validation with Zod
        const parseResult = rfqSchema.safeParse(rawBody);
        if (!parseResult.success) {
            const errors = parseResult.error.issues.map(i => ({
                field: i.path.join('.'),
                message: i.message,
            }));
            // Log field names only (never values — the body carries customer PII).
            // Without this a rejected RFQ is invisible in CloudWatch.
            console.error(JSON.stringify({
                event: 'submit-rfq.validation-failed',
                fields: errors.map(e => e.field),
            }));
            return {
                statusCode: 400,
                headers: corsHeaders,
                body: JSON.stringify({ success: false, error: 'Validation failed', details: errors }),
            };
        }

        const data = parseResult.data;

        // 3. Generate IDs
        const rfqId = generateRfqId();
        const referenceNumber = generateReferenceNumber(rfqId);
        const submittedAt = new Date().toISOString();
        const ipHashed = hashIp(ip);

        // 5. Create RFQ_SUBMISSION entity in DynamoDB — §12.10.4
        //    matchedOrgId + GSI2PK are backfilled below after organization-api upsert.
        const normalizedEmail = data.email.trim().toLowerCase();
        const item: Record<string, unknown> = {
            PK: `RFQ#${rfqId}`,
            SK: 'META',
            GSI1PK: 'RFQ_STATUS#pending',
            GSI1SK: `${submittedAt}#${rfqId}`,
            GSI4PK: `EMAIL#${normalizedEmail}`,
            GSI4SK: `RFQ#${submittedAt}`,
            rfqId,
            referenceNumber,
            status: 'pending',
            submittedAt,
            ipHash: ipHashed,
            visitorId: data.visitorId,
            attribution: data.attribution,
            // All form fields (stored raw; sanitize() is applied inline in email templates)
            name: data.name,
            email: data.email,
            phone: data.phone,
            institution: data.institution,
            department: data.department,
            role: data.role,
            equipmentCategory: data.equipmentCategory,
            specificModel: data.specificModel,
            applicationDescription: data.applicationDescription,
            keySpecifications: data.keySpecifications,
            quantity: data.quantity,
            budgetRange: data.budgetRange,
            timeline: data.timeline,
            fundingStatus: data.fundingStatus,
            referralSource: data.referralSource,
            existingEquipment: data.existingEquipment,
            additionalComments: data.additionalComments,
            // Budgetary quote shipping address
            needsBudgetaryQuote: data.needsBudgetaryQuote || false,
            shippingAddress: data.shippingAddress,
            shippingCity: data.shippingCity,
            shippingState: data.shippingState,
            shippingZipCode: data.shippingZipCode,
            shippingCountry: data.shippingCountry,
            TTL: 0, // No expiry
        };

        // Add article attribution if present and valid
        if (data.referrerSource) {
            item.referrerSource = data.referrerSource;
        }

        // Always populate GSI2SK so a later backfill of GSI2PK indexes correctly
        item.GSI2SK = `RFQ#${submittedAt}`;

        await docClient.send(new PutCommand({
            TableName: TABLE_NAME(),
            Item: item,
        }));
        console.log(`RFQ_SUBMISSION created: ${rfqId}`);

        // Supersede this visitor's Step-1 partial row, if any — the full RFQ now
        // exists, so the admin should see one record, not a partial + a submission.
        // Best-effort: a stray partial (TTL-less but low-value) never blocks the lead.
        if (data.visitorId) {
            try {
                await docClient.send(new DeleteCommand({
                    TableName: TABLE_NAME(),
                    Key: { PK: `RFQ#${partialRfqId(data.visitorId)}`, SK: 'META' },
                }));
            } catch (err) {
                console.warn('Failed to delete superseded partial RFQ (non-fatal):', err);
            }
        }

        // 6. Upsert customer Organization + backfill matchedOrgId/GSI2PK
        let matchedOrgId: string | null = null;
        try {
            const orgResult = await invokeOrganizationApi({
                action: 'upsertFromSubmission',
                source: 'rfq',
                email: data.email,
                institution: data.institution,
                submittedAt,
                scoreDelta: computeRfqScore({
                    fundingStatus: data.fundingStatus,
                    timeline: data.timeline,
                }),
            });
            matchedOrgId = orgResult.matchedOrgId;
        } catch (err) {
            console.error(JSON.stringify({
                event: 'submit-rfq.org-upsert-failed',
                error: String(err),
                rfqId,
            }));
        }

        if (matchedOrgId) {
            await docClient.send(new UpdateCommand({
                TableName: TABLE_NAME(),
                Key: { PK: `RFQ#${rfqId}`, SK: 'META' },
                UpdateExpression: 'SET matchedOrgId = :id, GSI2PK = :gsi2',
                ExpressionAttributeValues: {
                    ':id': matchedOrgId,
                    ':gsi2': `ORG#${matchedOrgId}`,
                },
            }));
        }

        // 2C-analytics: VISITOR# identity bridge + retro-resolve fire (non-fatal; upgrade-only).
        if (data.visitorId) {
            try {
                const bridge = await upsertVisitorBridge(
                    toSend(docClient), TABLE_NAME(),
                    {
                        visitorId: data.visitorId, matchedOrgId: matchedOrgId ?? null, email: data.email ?? null,
                        sourceEntityType: 'rfq', sourceEntityId: rfqId, now: submittedAt,
                    },
                );
                if (bridge.created || bridge.orgUpgraded) {
                    await invokeCrmAction({ action: 'reResolveVisitorSessions', visitorId: data.visitorId });
                }
            } catch (err) {
                console.error(JSON.stringify({
                    event: 'crm.visitor_bridge.write_failed',
                    visitorId: data.visitorId,
                    error: err instanceof Error ? err.message : String(err),
                }));
            }
        }

        // Emit rfq_submitted timeline event to CRM (async fire-and-forget;
        // the helper logs/swallows its own dispatch failures — never blocks the response).
        await emitTimelineEventToCrm(buildRfqEmitArgs(
            {
                rfqId,
                submittedAt,
                email: data.email,
                equipmentCategory: data.equipmentCategory,
                specificModel: data.specificModel,
            },
            matchedOrgId ?? null,
        ));

        // 7. Move attachments from temp/ → rfqs/<rfqId>/
        //    A per-file relocation failure is isolated, not fatal: the lead is worth
        //    more than the file. We keep the 200 but surface the loss in the emails
        //    below so an intended attachment never goes missing silently.
        let attachmentKeys: string[] = [];
        let failedAttachmentKeys: string[] = [];
        if (data.attachmentKeys && data.attachmentKeys.length > 0) {
            const moveResult = await moveAttachments(rfqId, data.attachmentKeys);
            attachmentKeys = moveResult.movedKeys;
            failedAttachmentKeys = moveResult.failedKeys;

            if (failedAttachmentKeys.length > 0) {
                console.error(JSON.stringify({
                    event: 'submit-rfq.attachment-move-partial-failure',
                    rfqId,
                    requested: data.attachmentKeys.length,
                    moved: attachmentKeys.length,
                    failed: failedAttachmentKeys.length,
                }));
            }

            // Update the record with final attachment keys
            if (attachmentKeys.length > 0) {
                await docClient.send(new UpdateCommand({
                    TableName: TABLE_NAME(),
                    Key: { PK: `RFQ#${rfqId}`, SK: 'META' },
                    UpdateExpression: 'SET attachmentKeys = :keys',
                    ExpressionAttributeValues: { ':keys': attachmentKeys },
                }));
            }
        }

        // 9. Send emails (best-effort, non-blocking)
        await Promise.allSettled([
            sendConfirmationEmail(data, referenceNumber, failedAttachmentKeys.length),
            sendInternalNotification(data, rfqId, referenceNumber, attachmentKeys, failedAttachmentKeys),
        ]).then(results => {
            results.forEach((result, i) => {
                const label = i === 0 ? 'Confirmation email' : 'Internal notification';
                if (result.status === 'rejected') {
                    console.warn(`${label} failed (non-critical):`, result.reason);
                }
            });
        });

        // 10. Return success — §12.10.3
        return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({
                success: true,
                rfqId,
                message: "Thank you. We'll respond within 1-2 business days.",
                referenceNumber,
            }),
        };

    } catch (error) {
        console.error('Error in submit-rfq Lambda:', error);
        return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({ success: false, error: 'Internal server error. Please try again later.' }),
        };
    }
};

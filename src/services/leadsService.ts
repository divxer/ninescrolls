/**
 * Unified Leads API service.
 *
 * All customer-facing forms (contact, download gate, newsletter) submit through
 * POST /api/leads. The backend stores every lead in DynamoDB, sends email
 * notifications via SendGrid, and pushes contacts to HubSpot CRM.
 */

const LEADS_API_URL = 'https://api.ninescrolls.com/api/leads';

// ---------------------------------------------------------------------------
// Request types
// ---------------------------------------------------------------------------

export interface ContactLeadRequest {
    type: 'contact';
    name: string;
    email: string;
    phone?: string;
    organization?: string;
    message: string;
    productName?: string;
    inquiryType?: string;
    topic?: string;
    turnstileToken?: string;
}

export interface DownloadGateLeadRequest {
    type: 'download_gate';
    fullName: string;
    email: string;
    organization: string;
    researchAreas: string;
    jobTitle?: string;
    intent: string;
    fileName?: string;
    fileUrl?: string;
    marketingOptIn: boolean;
    turnstileToken?: string;
}

export interface NewsletterLeadRequest {
    type: 'newsletter';
    email: string;
    source?: string;
}

export type LeadRequest = ContactLeadRequest | DownloadGateLeadRequest | NewsletterLeadRequest;

// ---------------------------------------------------------------------------
// Response type
// ---------------------------------------------------------------------------

export interface LeadResponse {
    success: boolean;
    leadId?: string;
    message?: string;
    alreadySubscribed?: boolean;
    error?: string;
    details?: Array<{ field: string; message: string }>;
}

// ---------------------------------------------------------------------------
// Submit function
// ---------------------------------------------------------------------------

export async function submitLead(data: LeadRequest): Promise<LeadResponse> {
    const response = await fetch(LEADS_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });

    const body = await response.json() as LeadResponse;

    if (!response.ok) {
        throw new Error(body.error || 'Failed to submit lead');
    }

    return body;
}

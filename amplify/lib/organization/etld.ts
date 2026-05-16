import { parse } from 'tldts';

const FREE_MAIL_DOMAINS = new Set([
    'gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.co.jp', 'rocketmail.com', 'ymail.com',
    'hotmail.com', 'outlook.com', 'live.com', 'live.co.uk', 'live.com.au', 'msn.com',
    'aol.com', 'icloud.com', 'me.com', 'mac.com',
    'qq.com', 'vip.qq.com', '163.com', '163.net', 'vip.163.com', '126.com', 'sina.com', 'sina.cn',
    'sohu.com', 'foxmail.com', 'yeah.net', '139.com', '189.cn',
    'tom.com', '21cn.com',
    'naver.com', 'daum.net', 'hanmail.net',
    'yandex.ru', 'mail.ru', 'rambler.ru',
    'gmx.com', 'gmx.de', 'web.de', 't-online.de',
    'zoho.com', 'protonmail.com', 'proton.me', 'protonmail.ch', 'tutanota.com', 'tuta.io', 'hey.com', 'pm.me', 'fastmail.com',
    'hotmail.co.uk', 'btinternet.com',
    'mailinator.com', 'tempmail.org', '10minutemail.com',
]);

export interface EmailDomainResult {
    orgId: string | null;
    domain: string;
    isFreeMailDomain: boolean;
}

/**
 * Extract the Organization identity (eTLD+1) from an email address.
 *
 * Returns `orgId: null` if the email is invalid, lacks a recognizable TLD,
 * or belongs to a free-mail provider. The raw post-@ domain is always
 * returned in `domain` (or empty string) so callers can still log it.
 *
 * Edge cases NOT handled (acceptable for the target customer segment):
 * - RFC 5321 quoted-string local parts like `"a@b"@stanford.edu` — first @ is
 *   treated as the separator, yielding a wrong domain.
 * - Internationalized domain names with raw Unicode TLDs — `tldts` may
 *   return null. Log via the `org.upsert.no-etld` warning at call sites.
 */
export function classifyEmailDomain(email: string): EmailDomainResult {
    const lower = email.toLowerCase().trim();
    const atIdx = lower.indexOf('@');
    if (atIdx === -1 || atIdx === lower.length - 1) {
        return { orgId: null, domain: '', isFreeMailDomain: false };
    }
    const domain = lower.slice(atIdx + 1);
    const parsed = parse(domain);
    // Require a PSL-recognized public suffix (ICANN or private); reject
    // synthetic/unknown TLDs that `tldts` would otherwise echo back verbatim.
    const etldPlusOne = parsed.domain;
    // PSL-private hosts (github.io, vercel.app, etc.) are admitted as Orgs by design;
    // downstream classification + lead score filters low-value PaaS-rooted records.
    if (!etldPlusOne || (!parsed.isIcann && !parsed.isPrivate)) {
        return { orgId: null, domain, isFreeMailDomain: false };
    }
    const isFreeMailDomain = FREE_MAIL_DOMAINS.has(etldPlusOne);
    return {
        orgId: isFreeMailDomain ? null : etldPlusOne,
        domain,
        isFreeMailDomain,
    };
}

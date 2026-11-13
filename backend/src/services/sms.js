import { env, isProd } from '../config/env.js';
import { HttpError } from '../utils/helpers.js';

/**
 * Deliver an OTP by SMS.
 *  - console : development only, prints the OTP to the server terminal
 *  - msg91   : MSG91 OTP API (needs a DLT-approved template id)
 *  - fast2sms: Fast2SMS OTP route
 * Check your provider's current docs if you change plans/templates.
 */
export async function sendOtpSms(phone, otp) {
  if (env.SMS_PROVIDER === 'console') {
    if (isProd) throw new HttpError(500, 'SMS provider not configured');
    console.log(`[DEV ONLY] OTP for ${phone}: ${otp}`);
    return;
  }
  let res;
  if (env.SMS_PROVIDER === 'msg91') {
    const q = new URLSearchParams({ template_id: env.MSG91_TEMPLATE_ID, mobile: `91${phone}`, authkey: env.SMS_API_KEY, otp });
    res = await fetch(`https://control.msg91.com/api/v5/otp?${q}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
  } else {
    const q = new URLSearchParams({ authorization: env.SMS_API_KEY, route: 'otp', variables_values: otp, numbers: phone });
    res = await fetch(`https://www.fast2sms.com/dev/bulkV2?${q}`);
  }
  if (!res.ok) {
    console.error('SMS provider error', res.status);
    throw new HttpError(502, 'Could not send OTP right now. Please try again.');
  }
  const data = await res.json().catch(() => ({}));
  if (data.type === 'error' || data.return === false) {
    console.error('SMS provider rejected request');
    throw new HttpError(502, 'Could not send OTP right now. Please try again.');
  }
}

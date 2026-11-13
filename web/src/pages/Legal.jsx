import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

const BIZ = import.meta.env.VITE_BUSINESS_NAME || 'PG Platform';
const EMAIL = import.meta.env.VITE_SUPPORT_EMAIL || '';
const PHONE = import.meta.env.VITE_SUPPORT_PHONE || '';
const ADDRESS = import.meta.env.VITE_BUSINESS_ADDRESS || '';
const UPDATED = import.meta.env.VITE_POLICY_UPDATED || new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

const Contact = () => (
  <ul className="mt-2 space-y-1 text-sm">
    {EMAIL && <li>Email: <a className="text-brand-600" href={`mailto:${EMAIL}`}>{EMAIL}</a></li>}
    {PHONE && <li>Phone: <a className="text-brand-600" href={`tel:${PHONE}`}>{PHONE}</a></li>}
    {ADDRESS && <li>Address: {ADDRESS}</li>}
    {!EMAIL && !PHONE && !ADDRESS && <li>Please use the in-app Messages option to reach your PG owner or our support team.</li>}
  </ul>
);

const PAGES = {
  terms: { title: 'Terms & Conditions', body: () => (<>
    <p>These terms govern your use of {BIZ} (the "Service"), a platform that helps PG (paying guest) owners manage properties, tenants and rent, and helps tenants find a PG, book visits and pay rent.</p>
    <h2>Accounts</h2><p>You must provide accurate details and verify your mobile number with an OTP. You are responsible for keeping your password confidential and for all activity on your account.</p>
    <h2>Owners</h2><p>Owners are responsible for the accuracy of their listings, rent amounts, food menus and tenant records, and for complying with applicable laws including tenant verification requirements.</p>
    <h2>Tenants</h2><p>Tenants agree to provide genuine KYC documents, pay rent on time and follow the rules of the PG they stay in. Rent is a contract between the tenant and the PG owner.</p>
    <h2>Payments</h2><p>Online payments are processed by Razorpay. We do not store card, UPI or bank details. A payment is shown as paid only after it is confirmed by the payment gateway.</p>
    <h2>Acceptable use</h2><p>You must not misuse the Service, upload unlawful content, attempt to access other users' data, or interfere with the platform's operation. We may suspend accounts that violate these terms.</p>
    <h2>Liability</h2><p>The Service is provided on an "as is" basis. We are not a party to the rental agreement between owners and tenants and are not liable for disputes between them, to the extent permitted by law.</p>
    <h2>Changes</h2><p>We may update these terms from time to time. Continued use after changes means you accept the updated terms.</p>
    <h2>Contact</h2><Contact />
  </>) },
  privacy: { title: 'Privacy Policy', body: () => (<>
    <p>This policy explains what information {BIZ} collects and how it is used.</p>
    <h2>Information we collect</h2><p>Name, mobile number, email (optional), profile photo, tenancy details, rent and payment status, expense records, messages, concerns raised, and KYC documents uploaded by tenants or owners.</p>
    <h2>How we use it</h2><p>To create and secure your account, manage PG operations, verify tenants, process rent payments, send reminders and notifications, and provide support.</p>
    <h2>KYC documents</h2><p>KYC files are stored in private, access-controlled storage and are visible only to the PG owner the tenant is staying with. They are never shown publicly.</p>
    <h2>Sharing</h2><p>Information is shared only with the PG owner or tenant relevant to a stay, and with service providers needed to run the Service (hosting, SMS/OTP delivery, file storage, and Razorpay for payments). We do not sell personal data.</p>
    <h2>Security</h2><p>Passwords are stored hashed, traffic is encrypted in transit, and access is restricted by role. No system is perfectly secure, so please keep your credentials private.</p>
    <h2>Your choices</h2><p>You can update your profile at any time and request deletion of your account and data by contacting us below.</p>
    <h2>Contact</h2><Contact />
  </>) },
  refund: { title: 'Refund & Cancellation Policy', body: () => (<>
    <p>This policy applies to rent and other payments made through {BIZ}.</p>
    <h2>Rent payments</h2><p>Rent paid through the app is paid for the PG owner's accommodation. Refund eligibility (for example a security deposit or an excess payment) is decided by the PG owner under the tenant's agreement with them. Please contact your PG owner first.</p>
    <h2>Failed or duplicate payments</h2><p>If money is deducted but the payment shows as failed, or you are charged twice, the amount is automatically reversed to your original payment method by the payment gateway, typically within 5–7 working days. If it is not, contact us with your payment ID.</p>
    <h2>Visit bookings</h2><p>Visit bookings are free and can be cancelled from the app before the slot time.</p>
    <h2>Cancelling a stay</h2><p>To leave a PG, give a vacate notice in the app. Notice periods and deposit settlement follow your agreement with the PG owner.</p>
    <h2>Contact</h2><Contact />
  </>) },
  contact: { title: 'Contact Us', body: () => (<><p>We're happy to help with accounts, payments or any problem you face.</p><Contact /></>) },
};

export default function Legal({ kind }) {
  const p = PAGES[kind];
  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-3xl px-5 py-10">
        <Link to="/" className="mb-6 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"><ArrowLeft className="h-4 w-4" /> Home</Link>
        <h1 className="text-3xl font-bold text-slate-900">{p.title}</h1>
        <p className="mt-1 text-sm text-slate-400">{BIZ} · Last updated {UPDATED}</p>
        <div className="mt-6 space-y-3 text-slate-700 [&_h2]:mt-6 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-slate-900">{p.body()}</div>
        <nav className="mt-10 flex flex-wrap gap-4 border-t pt-4 text-sm text-brand-600">
          <Link to="/terms">Terms</Link><Link to="/privacy">Privacy</Link><Link to="/refund-policy">Refunds</Link><Link to="/contact">Contact</Link>
        </nav>
      </div>
    </div>
  );
}

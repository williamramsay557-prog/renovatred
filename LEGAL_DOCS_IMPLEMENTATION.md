# Legal Documents Implementation Guide

## Quick Integration Steps

### Step 1: Create Legal Pages (5 minutes)

Create these new React components in `src/components/`:

**Option A: Simple Static Pages**
```tsx
// src/components/PrivacyPolicyPage.tsx
export const PrivacyPolicyPage = () => {
  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-6">Privacy Policy</h1>
      {/* Copy content from PRIVACY_POLICY.md */}
      {/* Convert markdown to JSX */}
    </div>
  );
};
```

**Option B: Use Markdown Renderer** (Better)
```bash
npm install react-markdown
```

```tsx
// src/components/LegalPage.tsx
import ReactMarkdown from 'react-markdown';

export const LegalPage = ({ content, title }: { content: string, title: string }) => {
  return (
    <div className="max-w-4xl mx-auto p-8 prose prose-blue">
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  );
};
```

### Step 2: Add Footer Links (10 minutes)

Update your main layout/footer component:

```tsx
// In App.tsx or Footer component
<footer className="bg-gray-100 border-t mt-auto">
  <div className="max-w-7xl mx-auto px-4 py-6">
    <div className="flex flex-wrap justify-center gap-6 text-sm text-gray-600">
      <a href="/privacy" className="hover:text-blue-600">Privacy Policy</a>
      <a href="/terms" className="hover:text-blue-600">Terms of Service</a>
      <a href="/cookies" className="hover:text-blue-600">Cookie Policy</a>
      <a href="/affiliate" className="hover:text-blue-600">Affiliate Disclosure</a>
      <a href="/help" className="hover:text-blue-600">Help</a>
    </div>
    
    {/* Amazon Affiliate Disclosure (Required) */}
    <p className="text-center text-xs text-gray-500 mt-4">
      As an Amazon Associate, Renovatr earns from qualifying purchases.
    </p>
    
    <p className="text-center text-xs text-gray-500 mt-2">
      © 2025 Renovatr. All rights reserved.
    </p>
  </div>
</footer>
```

### Step 3: Add Cookie Consent Banner (30 minutes)

**Install cookie consent library:**
```bash
npm install vanilla-cookieconsent
```

**Create cookie consent component:**
```tsx
// src/components/CookieConsent.tsx
import { useEffect } from 'react';
import 'vanilla-cookieconsent/dist/cookieconsent.css';
import * as CookieConsent from 'vanilla-cookieconsent';

export const CookieConsentBanner = () => {
  useEffect(() => {
    CookieConsent.run({
      guiOptions: {
        consentModal: {
          layout: 'box inline',
          position: 'bottom right',
        },
      },
      categories: {
        necessary: {
          enabled: true,
          readOnly: true,
        },
        analytics: {
          enabled: false,
          autoClear: {
            cookies: [
              {
                name: /^(_ga|_gid)/,
              },
            ],
          },
        },
      },
      language: {
        default: 'en',
        translations: {
          en: {
            consentModal: {
              title: 'We use cookies',
              description:
                'We use cookies to enhance your experience. Essential cookies are required for the site to work, while analytics cookies help us improve our service.',
              acceptAllBtn: 'Accept all',
              acceptNecessaryBtn: 'Essential only',
              showPreferencesBtn: 'Manage preferences',
            },
            preferencesModal: {
              title: 'Cookie Preferences',
              acceptAllBtn: 'Accept all',
              acceptNecessaryBtn: 'Essential only',
              savePreferencesBtn: 'Save preferences',
              sections: [
                {
                  title: 'Essential Cookies',
                  description: 'Required for the site to function.',
                  linkedCategory: 'necessary',
                },
                {
                  title: 'Analytics Cookies',
                  description: 'Help us understand how visitors use our site.',
                  linkedCategory: 'analytics',
                },
              ],
            },
          },
        },
      },
    });
  }, []);

  return null;
};
```

**Add to App.tsx:**
```tsx
import { CookieConsentBanner } from './components/CookieConsent';

function App() {
  return (
    <>
      {/* Your app content */}
      <CookieConsentBanner />
    </>
  );
}
```

### Step 4: Update Routing (if using React Router)

```tsx
// In your routing setup
import { PrivacyPolicyPage } from './components/PrivacyPolicyPage';
import { TermsPage } from './components/TermsPage';
// etc...

<Routes>
  <Route path="/" element={<LandingPage />} />
  <Route path="/privacy" element={<PrivacyPolicyPage />} />
  <Route path="/terms" element={<TermsPage />} />
  <Route path="/cookies" element={<CookiePolicyPage />} />
  <Route path="/affiliate" element={<AffiliateDisclosurePage />} />
  {/* ... other routes */}
</Routes>
```

### Step 5: Add Inline Affiliate Disclosures

Wherever you show Amazon links in the app:

```tsx
// In task material list or AI recommendations
<div className="bg-blue-50 border-l-4 border-blue-400 p-3 mb-4 text-sm">
  <p className="text-blue-800">
    <span className="font-semibold">Affiliate Link Disclosure:</span> 
    Product links are Amazon affiliate links. We earn a small commission 
    on purchases at no extra cost to you.
  </p>
</div>

<a 
  href={amazonLink} 
  target="_blank" 
  rel="nofollow noopener noreferrer"
  className="text-blue-600 hover:underline"
>
  {productName} on Amazon →
</a>
```

## Quick Implementation Checklist

### Immediate (Required for Launch)
- [ ] Add footer with legal links
- [ ] Create Privacy Policy page
- [ ] Create Terms of Service page
- [ ] Add Amazon affiliate disclosure to footer
- [ ] Add inline disclosures near Amazon links

### This Week (Before Production)
- [ ] Implement cookie consent banner
- [ ] Create Cookie Policy page
- [ ] Create Affiliate Disclosure page
- [ ] Test all legal pages display correctly
- [ ] Verify mobile responsiveness

### Email Template (For support@)

When you set up your support email, use this auto-reply template:

```
Thank you for contacting Renovatr support!

We've received your message and will respond within 48 hours.

In the meantime:
- Privacy Policy: [your-domain]/privacy
- Terms of Service: [your-domain]/terms
- Help & FAQ: [your-domain]/help

Best regards,
The Renovatr Team
```

## File Locations

Store the markdown files in your project:

```
src/
  legal/
    privacy-policy.md
    terms-of-service.md
    cookie-policy.md
    affiliate-disclosure.md
```

Then import and render them with react-markdown.

## Testing Checklist

Before launch, verify:
- [ ] All legal pages accessible from footer
- [ ] Cookie banner appears on first visit
- [ ] Cookie preferences can be changed
- [ ] Amazon affiliate disclosure visible
- [ ] Mobile-friendly legal pages
- [ ] Links work (no 404s)
- [ ] Contact email in policies is correct
- [ ] "Last Updated" dates are correct

## Important Notes

1. **Update Email Addresses:** Replace `support@renovatr.app` with your actual support email
2. **Update Domain:** Replace `[your-domain]` with your actual Replit domain
3. **Review Dates:** Ensure "Last Updated" dates are accurate
4. **Customize Content:** Personalize any sections that need your specific details

## Need Help?

The legal documents are ready to use as-is, but you may want to:
- Have a solicitor review them (optional for freemium MVP)
- Customize the company information section
- Adjust tone or wording to match your brand

For now, they provide strong legal protection and full UK compliance.

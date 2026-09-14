import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export const publicDescription = 'VidyantraErp is a cloud-based School and College ERP for student management, attendance, fees, examinations, results, transport, library, hostel, salary, reports and more.';
const titles = { '/': 'VidyantraErp | School & College ERP Management Software', '/privacy': 'Privacy Policy | VidyantraErp', '/terms': 'Terms of Service | VidyantraErp', '/register': 'Register Your Institute | VidyantraErp' };
export default function PublicMetadata() {
  const { pathname } = useLocation();
  useEffect(() => {
    const path = pathname.replace(/\/$/, '') || '/';
    const title = titles[path] || 'VidyantraErp';
    document.title = title;
    function meta(key, value, property = false) {
      const attribute = property ? 'property' : 'name';
      let element = document.querySelector(`meta[${attribute}="${key}"]`);
      if (!element) { element = document.createElement('meta'); element.setAttribute(attribute, key); document.head.append(element); }
      element.content = value;
    }
    const description = path === '/' ? publicDescription : path === '/privacy' ? 'How VidyantraErp uses account, institution, session and support information.' : path === '/terms' ? 'Service terms for institution accounts, subscriptions and permitted use of VidyantraErp.' : 'Register and manage your institution with VidyantraErp.';
    const origin = import.meta.env.VITE_PUBLIC_SITE_URL || 'https://erpfrontend-kohl.vercel.app';
    const url = `${new URL(origin).origin}${path}`;
    meta('description', description); meta('robots', ['/', '/privacy', '/terms'].includes(path) ? 'index,follow' : 'noindex,follow');
    meta('og:title', title, true); meta('og:description', description, true); meta('og:url', url, true);
    meta('twitter:title', title); meta('twitter:description', description);
    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) { canonical = document.createElement('link'); canonical.rel = 'canonical'; document.head.append(canonical); }
    canonical.href = url;
    if (!window.location.hash) window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

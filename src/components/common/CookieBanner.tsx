import { useState, useEffect } from 'react';

export function CookieBanner() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Check if user has already made a choice
    const cookieConsent = localStorage.getItem('cookieConsent');
    if (!cookieConsent) {
      setIsVisible(true);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem('cookieConsent', 'accepted');
    setIsVisible(false);
    // Enable analytics and other cookies here
  };

  const handleReject = () => {
    localStorage.setItem('cookieConsent', 'rejected');
    setIsVisible(false);
    // Disable analytics and other cookies here
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-[1000] p-4 bg-white/95 backdrop-blur-sm shadow-[0_-2px_10px_rgba(0,0,0,0.1)] border-t border-outline-variant">
      <div className="max-w-[1200px] mx-auto flex items-center justify-between gap-8 max-md:flex-col max-md:text-center max-md:gap-4">
        <p className="m-0 text-sm text-on-surface leading-relaxed font-body">
          We use cookies to enhance your browsing experience, serve personalized content,
          and analyze our traffic. By clicking &quot;Accept All&quot;, you consent to our use of cookies.
        </p>
        <div className="flex gap-4 shrink-0 max-md:w-full max-md:justify-center">
          <button
            onClick={handleAccept}
            className="px-4 py-2 rounded bg-primary text-on-primary text-sm font-medium border-none cursor-pointer transition-all duration-200 hover:bg-primary/90 max-md:flex-1 max-md:max-w-[200px]"
          >
            Accept All
          </button>
          <button
            onClick={handleReject}
            className="px-4 py-2 rounded bg-surface-container-low text-on-surface text-sm font-medium border border-outline-variant cursor-pointer transition-all duration-200 hover:bg-outline-variant/30 max-md:flex-1 max-md:max-w-[200px]"
          >
            Reject All
          </button>
        </div>
      </div>
    </div>
  );
}

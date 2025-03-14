import { useState, useEffect } from 'react';
import '../../styles/CookieBanner.css';

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
    <div className="cookie-banner">
      <div className="cookie-content">
        <p>
          We use cookies to enhance your browsing experience, serve personalized content, 
          and analyze our traffic. By clicking "Accept All", you consent to our use of cookies.
        </p>
        <div className="cookie-buttons">
          <button onClick={handleAccept} className="cookie-button accept">
            Accept All
          </button>
          <button onClick={handleReject} className="cookie-button reject">
            Reject All
          </button>
        </div>
      </div>
    </div>
  );
} 
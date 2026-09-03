import { useState, useEffect } from 'react';
import { Button } from './ui/button';

const CookieConsent = () => {
  const [showConsent, setShowConsent] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem('cookie_consent');
    if (consent === null) {
      setShowConsent(true);
    }
  }, []);

  const acceptCookies = () => {
    localStorage.setItem('cookie_consent', 'true');
    setShowConsent(false);
    window.location.reload();
  };

  const declineCookies = () => {
    localStorage.setItem('cookie_consent', 'false');
    setShowConsent(false);
  };

  if (!showConsent) {
    return null;
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-gray-800 text-white p-4 flex justify-between items-center">
      <p className="text-sm">
        We use cookies to enhance your experience. By clicking "Accept", you agree to our use of cookies.
      </p>
      <div className="flex gap-4">
        <Button onClick={acceptCookies} variant="default">Accept</Button>
        <Button onClick={declineCookies} variant="secondary">Decline</Button>
      </div>
    </div>
  );
};

export default CookieConsent;

import QRCode from 'qrcode';
import { useEffect, useState } from 'react';

export function useQrCodeDataUrl(value, size = 512) {
  const [dataUrl, setDataUrl] = useState('');

  useEffect(() => {
    let active = true;
    if (!value) {
      setDataUrl('');
      return () => { active = false; };
    }

    QRCode.toDataURL(value, {
      width: size,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: { dark: '#020617', light: '#ffffff' },
    }).then((url) => {
      if (active) setDataUrl(url);
    }).catch(() => {
      if (active) setDataUrl('');
    });

    return () => { active = false; };
  }, [size, value]);

  return dataUrl;
}

export async function downloadQrCode(qrCodeData, personName, entityType = 'identity') {
  if (!qrCodeData) throw new Error('QR code is not available.');
  const dataUrl = await QRCode.toDataURL(qrCodeData, {
    width: 1024,
    margin: 3,
    errorCorrectionLevel: 'M',
    color: { dark: '#020617', light: '#ffffff' },
  });
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = `${(personName || entityType).replace(/\s+/g, '-').toLowerCase()}-qr.png`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

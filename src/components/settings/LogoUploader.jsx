// ── LogoUploader ─────────────────────────────────────────────────────────
//
// Inline control used inside SettingsPanel for the optional mosque logo.
// Reads a user-picked file (PNG / JPG / SVG / WebP) into a base64 data URL
// and hands it up via onChange. Stored alongside other settings; the
// header reads `logoDataUrl` and falls back to the built-in MosqueIcon SVG
// when empty.
//
// Why base64 (not file path / blob URL)?
//   - localStorage can't store file paths or blob URLs (blob URLs are
//     session-scoped — they'd die on reload).
//   - Data URLs are just strings → they survive serialization and reload
//     cleanly with no extra storage layer.
//
// Why a 100 KB cap?
//   - localStorage has a ~5 MB total budget on most browsers.
//   - Base64 encoding inflates size by ~33%, so a 100 KB cap on the raw
//     file is ~133 KB stored.
//   - 100 KB is plenty for a mosque logo at typical header sizes (40–80 px).
//   - Larger uploads get rejected with a clear inline message instead of
//     silently failing later when localStorage's quota is hit.

import { useRef, useState } from 'react';

const MAX_BYTES = 100 * 1024; // 100 KB
const ACCEPTED = 'image/png,image/jpeg,image/svg+xml,image/webp';

export default function LogoUploader({ value, onChange }) {
  const inputRef = useRef(null);
  // Local error/status message — cleared on next interaction.
  const [msg, setMsg] = useState('');

  const handleFile = (file) => {
    if (!file) return;

    // Size check BEFORE reading — avoids burning CPU on a giant image
    // just to reject it.
    if (file.size > MAX_BYTES) {
      setMsg(`Too large (${(file.size / 1024).toFixed(0)} KB). Max is 100 KB.`);
      return;
    }
    if (!ACCEPTED.split(',').includes(file.type)) {
      setMsg(`Unsupported format (${file.type || 'unknown'}). Use PNG, JPG, SVG, or WebP.`);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      // result is a data URL like "data:image/png;base64,iVBOR..."
      onChange(reader.result);
      setMsg('Logo loaded — click Save to apply.');
    };
    reader.onerror = () => {
      setMsg('Failed to read file. Try a different image.');
    };
    reader.readAsDataURL(file);
  };

  const handleClear = () => {
    onChange('');
    setMsg('');
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className="logo-uploader">
      {/* Preview row — only renders when a logo is set */}
      {value && (
        <div className="logo-uploader-preview-row">
          <img src={value} alt="Logo preview" className="logo-uploader-preview" />
          <div className="logo-uploader-preview-meta">
            <div className="logo-uploader-preview-label">Current logo</div>
            <div className="logo-uploader-preview-size">
              {Math.ceil((value.length * 0.75) / 1024)} KB
            </div>
          </div>
        </div>
      )}

      {/* Hidden file input — triggered by the styled buttons below. */}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED}
        onChange={(e) => handleFile(e.target.files?.[0])}
        style={{ display: 'none' }}
      />

      <div className="logo-uploader-actions">
        <button type="button" className="sbtn" onClick={() => inputRef.current?.click()}>
          {value ? 'Replace logo' : 'Choose logo file'}
        </button>
        {value && (
          <button type="button" className="sbtn" onClick={handleClear}>
            Remove
          </button>
        )}
      </div>

      {/* Inline status / error feedback */}
      <div className="logo-uploader-msg">
        {msg || 'PNG, JPG, SVG, or WebP. Max 100 KB. Square images work best.'}
      </div>
    </div>
  );
}

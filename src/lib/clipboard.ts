// Puts a text into the clipboard; resolves with whether it worked.
export async function copyText(text: string) {
  try { await navigator.clipboard.writeText(text); return true; } catch {}
  // Older browsers and pages opened without HTTPS.
  const field = document.createElement('textarea');
  field.value = text;
  field.setAttribute('readonly', '');
  field.style.cssText = 'position:fixed;opacity:0';
  document.body.append(field);
  field.select();
  const done = document.execCommand('copy');
  field.remove();
  return done;
}

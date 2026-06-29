/** Trigger a browser download of a file at `href` saved as `filename`. */
export function downloadFile(href: string, filename: string): void {
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

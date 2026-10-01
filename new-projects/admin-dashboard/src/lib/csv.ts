/** CSV with a byte order mark so spreadsheet apps open Cyrillic text correctly. */
export function downloadCsv(name: string, headers: string[], rows: (string | number)[][]) {
  const quote = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
  const body = String.fromCharCode(0xfeff) + [headers, ...rows].map((row) => row.map(quote).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([body], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

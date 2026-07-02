function field(v) {
  const s = String(v ?? '');
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

export function toCsv(items) {
  const lines = ['serial,captured_at'];
  for (const it of items) {
    const ts = it.ts ? new Date(it.ts).toISOString() : '';
    lines.push(field(it.serial) + ',' + field(ts));
  }
  return lines.join('\r\n');
}

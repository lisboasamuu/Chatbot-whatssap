import { createRequire } from 'node:module';

interface QrCodeInstance { addData(value: string): void; make(): void; getModuleCount(): number; isDark(row: number, column: number): boolean; }
interface QrCodeConstructor { new(typeNumber: number, errorCorrectLevel: number): QrCodeInstance; }

const load = createRequire(__filename);
const QrCode = load('qrcode-terminal/vendor/QRCode') as QrCodeConstructor;
const QrErrorCorrectLevel = load('qrcode-terminal/vendor/QRCode/QRErrorCorrectLevel') as { L: number };

export function qrValueToDataUrl(value: string): string {
  const qr = new QrCode(-1, QrErrorCorrectLevel.L);
  qr.addData(value); qr.make();
  const count = qr.getModuleCount(), quiet = 4, size = count + quiet * 2;
  const commands: string[] = [];
  for (let row = 0; row < count; row += 1) for (let column = 0; column < count; column += 1) if (qr.isDark(row, column)) commands.push(`M${column + quiet} ${row + quiet}h1v1h-1z`);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="white"/><path d="${commands.join('')}" fill="black"/></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`;
}

export function normalizeInboundText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function phraseMatches(input: string, variation: string): boolean {
  return input === variation || ` ${input} `.includes(` ${variation} `);
}

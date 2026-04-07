// ABOUTME: Generates regex patterns matching "number >= min" for PoE stash search.
// ABOUTME: Ported from poe-vendor-string's GenerateNumberRegex.ts — handles 1-999+ ranges.

function truncateLastDigit(n: number): number {
  return Math.floor(n / 10);
}

export function generateNumberRegex(input: string, optimize: boolean): string {
  const numbers = input.match(/\d/g);
  if (numbers === null) return '';

  const quant = optimize
    ? Math.floor(Number(numbers.join('')) / 10) * 10
    : Number(numbers.join(''));

  if (Number.isNaN(quant) || quant === 0) {
    if (optimize && numbers.length === 1) return '.';
    return '';
  }

  if (quant >= 200) {
    const v = truncateLastDigit(truncateLastDigit(quant));
    return `[${v}-9]..`;
  }

  if (quant >= 150) {
    const str = quant.toString();
    const d1 = str[1];
    const d2 = str[2];
    if (d1 === '0' && d2 === '0') return `([2-9]..|${str[0]}..)`;
    if (d2 === '0') return `([2-9]..|1[${d1}-9].)`;
    if (d1 === '0') return `([2-9]..|\\d0[${d2}-9]|\\d[1-9].)`;
    if (d1 === '9' && d2 === '9') return '([2-9]..|199)';
    if (d1 === '9') return `([2-9]..|19[${d2}-9])`;
    return `[12]([${d1}-9][${d2}-9]|[${Number(d1) + 1}-9].)`;
  }

  if (quant > 100) {
    const str = quant.toString();
    const d1 = str[1];
    const d2 = str[2];
    if (d1 === '0' && d2 === '0') return `${str[0]}..`;
    if (d2 === '0') return `(1[${d1}-9].|[2-9]..)`;
    if (d1 === '0') return `(\\d0[${d2}-9]|\\d[1-9].)`;
    if (d1 === '9' && d2 === '9') return '(199|[2-9]..)';
    if (d1 === '9') return `19[${d2}-9]`;
    return `(1([${d1}-9][${d2}-9]|[${Number(d1) + 1}-9].)|[2-9]..)`;
  }

  if (quant === 100) return '\\d..';

  if (quant > 9) {
    const str = quant.toString();
    const d0 = str[0];
    const d1 = str[1];
    if (d1 === '0') return `([${d0}-9].|\\d..)`;
    if (d0 === '9') return `(${d0}[${d1}-9]|\\d..)`;
    return `(${d0}[${d1}-9]|[${Number(d0) + 1}-9].|\\d..)`;
  }

  if (quant <= 9) return `([${quant}-9]|\\d..?)`;

  return input;
}

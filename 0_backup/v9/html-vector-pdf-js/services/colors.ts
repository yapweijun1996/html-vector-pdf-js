export const parseColor = (c: string): [number, number, number] => {
  if (!c || c === 'transparent' || c === 'rgba(0, 0, 0, 0)') return [255, 255, 255];
  if (c.startsWith('#')) {
    const r = parseInt(c.slice(1, 3), 16);
    const g = parseInt(c.slice(3, 5), 16);
    const b = parseInt(c.slice(5, 7), 16);
    return isNaN(r) ? [0, 0, 0] : [r, g, b];
  }
  const m = c.match(/\d+/g);
  if (c.startsWith('rgba') && m && m[3] === '0') return [255, 255, 255];
  return m && m.length >= 3 ? [parseInt(m[0]), parseInt(m[1]), parseInt(m[2])] : [0, 0, 0];
};

export const isTransparent = (c: string): boolean => {
  if (!c || c === 'transparent' || c === 'rgba(0, 0, 0, 0)') return true;
  if (c.startsWith('rgba')) {
    const m = c.match(/\d+/g);
    if (m && m[3] === '0') return true;
  }
  return false;
};


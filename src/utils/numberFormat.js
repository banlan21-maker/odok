export const formatCount = (value) => {
  const num = Number(value) || 0;
  if (num < 1000) return `${num}`;
  if (num < 10000) return `${(num / 1000).toFixed(1)}k`;
  if (num < 100000) return `${Math.floor(num / 1000)}k`;
  if (num < 1000000) return `${(num / 10000).toFixed(1)}만`;
  if (num < 10000000) return `${Math.floor(num / 10000)}만`;
  return `${(num / 100000000).toFixed(1)}억`;
};

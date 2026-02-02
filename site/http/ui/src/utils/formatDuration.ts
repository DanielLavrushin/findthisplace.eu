export function formatDuration(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  if (days >= 365) {
    const years = Math.floor(days / 365);
    const rem = days % 365;
    const months = Math.floor(rem / 30);
    return months > 0 ? `${years} г. ${months} мес.` : `${years} г.`;
  }
  if (days >= 30) {
    const months = Math.floor(days / 30);
    const rem = days % 30;
    return rem > 0 ? `${months} мес. ${rem} дн.` : `${months} мес.`;
  }
  return `${days} дн.`;
}

export function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatDeadlineShort(dateStr: string): string {
  // "2026-03-24" → "24" (если текущий месяц и год)
  // "2026-03-24" → "03-24" (если другой месяц, но текущий год)
  // "2027-03-24" → "24 '27" (если другой год)

  // Проверка на пустую строку
  if (!dateStr) return '';

  const today = new Date();
  const deadline = new Date(dateStr);

  // Проверка на Invalid Date
  if (isNaN(deadline.getTime())) {
    return dateStr; // Возвращаем исходную строку как fallback
  }

  const isSameYear = today.getFullYear() === deadline.getFullYear();
  const isSameMonth = today.getMonth() === deadline.getMonth();

  // Если текущий месяц и год — показываем только день
  if (isSameYear && isSameMonth) {
    return deadline.getDate().toString();
  }

  const day = deadline.getDate().toString().padStart(2, '0');
  const month = (deadline.getMonth() + 1).toString().padStart(2, '0');

  // Если текущий год — показываем месяц-день
  if (isSameYear) {
    return `${month}-${day}`;
  }

  // Если другой год — показываем день и сокращённый год
  const yearShort = deadline.getFullYear().toString().slice(-2);
  return `${day} '${yearShort}`;
}

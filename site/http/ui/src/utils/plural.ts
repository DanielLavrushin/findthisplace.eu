const words: Record<string, [string, string, string]> = {
  загадка: ["загадка", "загадки", "загадок"],
  пост: ["пост", "поста", "постов"],
  страна: ["страна", "страны", "стран"],
  маркер: ["маркер", "маркера", "маркеров"],
};

export function plural(n: number, key: string): string {
  const forms = words[key];
  if (!forms) return key;

  const abs = Math.abs(n);
  const mod10 = abs % 10;
  const mod100 = abs % 100;

  if (mod10 === 1 && mod100 !== 11) return `${n} ${forms[0]}`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return `${n} ${forms[1]}`;
  return `${n} ${forms[2]}`;
}

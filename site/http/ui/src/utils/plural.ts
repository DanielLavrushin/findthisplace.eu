const words: Record<string, [string, string, string]> = {
  загадка: ["загадка", "загадки", "загадок"],
  пост: ["пост", "поста", "постов"],
  страна: ["страна", "страны", "стран"],
  маркер: ["маркер", "маркера", "маркеров"],
  находка: ["находка", "находки", "находок"],
};

export function plural(n: number, key: string, wordOnly = false): string {
  const forms = words[key];
  if (!forms) return key;

  const abs = Math.abs(n);
  const mod10 = abs % 10;
  const mod100 = abs % 100;

  if (mod10 === 1 && mod100 !== 11) return wordOnly ? forms[0] : `${n} ${forms[0]}`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return wordOnly ? forms[1] : `${n} ${forms[1]}`;
  return wordOnly ? forms[2] : `${n} ${forms[2]}`;
}

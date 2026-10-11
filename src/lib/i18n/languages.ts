/** Languages the team can add without developer help. Add a row here to offer another one. */
export interface LanguageInfo {
  code: string;
  name: string; // English name, shown to the team
  nativeName: string; // shown to visitors in the language switcher
  dir?: "rtl";
}

export const LANGUAGE_CATALOG: LanguageInfo[] = [
  { code: "en", name: "English", nativeName: "English" },
  { code: "ta", name: "Tamil", nativeName: "தமிழ்" },
  { code: "si", name: "Sinhala", nativeName: "සිංහල" },
  { code: "hi", name: "Hindi", nativeName: "हिन्दी" },
  { code: "zh", name: "Chinese (Simplified)", nativeName: "简体中文" },
  { code: "ja", name: "Japanese", nativeName: "日本語" },
  { code: "de", name: "German", nativeName: "Deutsch" },
  { code: "fr", name: "French", nativeName: "Français" },
  { code: "ru", name: "Russian", nativeName: "Русский" },
  { code: "ar", name: "Arabic", nativeName: "العربية", dir: "rtl" },
  { code: "ms", name: "Malay", nativeName: "Bahasa Melayu" },
  { code: "nl", name: "Dutch", nativeName: "Nederlands" },
];

export function languageInfo(code: string): LanguageInfo {
  return LANGUAGE_CATALOG.find((l) => l.code === code) ?? { code, name: code.toUpperCase(), nativeName: code.toUpperCase() };
}

export function languageName(code: string): string {
  return languageInfo(code).name;
}

export function formatLanguageList(codes: string[]): string {
  const names = codes.map(languageName);
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

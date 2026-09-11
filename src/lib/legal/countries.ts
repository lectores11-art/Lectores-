/** ISO 3166-1 alpha-2 codes used for residence and book licenses. */
export const COUNTRY_OPTIONS: { code: string; name: string }[] = [
  { code: "AR", name: "Argentina" },
  { code: "BO", name: "Bolivia" },
  { code: "CL", name: "Chile" },
  { code: "CO", name: "Colombia" },
  { code: "CR", name: "Costa Rica" },
  { code: "CU", name: "Cuba" },
  { code: "DO", name: "República Dominicana" },
  { code: "EC", name: "Ecuador" },
  { code: "SV", name: "El Salvador" },
  { code: "GT", name: "Guatemala" },
  { code: "HN", name: "Honduras" },
  { code: "MX", name: "México" },
  { code: "NI", name: "Nicaragua" },
  { code: "PA", name: "Panamá" },
  { code: "PY", name: "Paraguay" },
  { code: "PE", name: "Perú" },
  { code: "PR", name: "Puerto Rico" },
  { code: "UY", name: "Uruguay" },
  { code: "VE", name: "Venezuela" },
  { code: "ES", name: "España" },
  { code: "PT", name: "Portugal" },
  { code: "FR", name: "Francia" },
  { code: "IT", name: "Italia" },
  { code: "DE", name: "Alemania" },
  { code: "BE", name: "Bélgica" },
  { code: "NL", name: "Países Bajos" },
  { code: "IE", name: "Irlanda" },
  { code: "GB", name: "Reino Unido" },
  { code: "US", name: "Estados Unidos" },
  { code: "CA", name: "Canadá" },
  { code: "BR", name: "Brasil" },
  { code: "AD", name: "Andorra" },
  { code: "CH", name: "Suiza" },
  { code: "AT", name: "Austria" },
  { code: "PL", name: "Polonia" },
  { code: "RO", name: "Rumanía" },
  { code: "SE", name: "Suecia" },
  { code: "NO", name: "Noruega" },
  { code: "DK", name: "Dinamarca" },
  { code: "FI", name: "Finlandia" },
  { code: "GR", name: "Grecia" },
  { code: "AU", name: "Australia" },
  { code: "NZ", name: "Nueva Zelanda" },
  { code: "JP", name: "Japón" },
  { code: "KR", name: "Corea del Sur" },
  { code: "CN", name: "China" },
  { code: "IN", name: "India" },
  { code: "MA", name: "Marruecos" },
  { code: "ZA", name: "Sudáfrica" },
  { code: "IL", name: "Israel" },
];

export const WORLDWIDE_TERRITORY = "*";

const COUNTRY_CODES = new Set(COUNTRY_OPTIONS.map((c) => c.code));

export function normalizeCountryCode(value: string | null | undefined): string | null {
  if (!value) return null;
  const code = value.trim().toUpperCase();
  if (code === WORLDWIDE_TERRITORY) return WORLDWIDE_TERRITORY;
  return COUNTRY_CODES.has(code) ? code : null;
}

export function isValidCountryCode(value: string | null | undefined): boolean {
  const code = normalizeCountryCode(value);
  return Boolean(code) && code !== WORLDWIDE_TERRITORY;
}

export function countryName(code: string): string {
  if (code === WORLDWIDE_TERRITORY) return "Todo el mundo";
  return COUNTRY_OPTIONS.find((c) => c.code === code)?.name ?? code;
}

export interface Country {
  code: string
  name: string
}

export const COUNTRIES: Country[] = [
  { code: 'AD', name: 'Andorra' },
  { code: 'DE', name: 'Alemania' },
  { code: 'AR', name: 'Argentina' },
  { code: 'AU', name: 'Australia' },
  { code: 'AT', name: 'Austria' },
  { code: 'BE', name: 'Bélgica' },
  { code: 'BO', name: 'Bolivia' },
  { code: 'BR', name: 'Brasil' },
  { code: 'CA', name: 'Canadá' },
  { code: 'CL', name: 'Chile' },
  { code: 'CO', name: 'Colombia' },
  { code: 'CR', name: 'Costa Rica' },
  { code: 'CU', name: 'Cuba' },
  { code: 'EC', name: 'Ecuador' },
  { code: 'SV', name: 'El Salvador' },
  { code: 'ES', name: 'España' },
  { code: 'US', name: 'Estados Unidos' },
  { code: 'FR', name: 'Francia' },
  { code: 'GT', name: 'Guatemala' },
  { code: 'HN', name: 'Honduras' },
  { code: 'IE', name: 'Irlanda' },
  { code: 'IT', name: 'Italia' },
  { code: 'JP', name: 'Japón' },
  { code: 'MX', name: 'México' },
  { code: 'NI', name: 'Nicaragua' },
  { code: 'NO', name: 'Noruega' },
  { code: 'NL', name: 'Países Bajos' },
  { code: 'PA', name: 'Panamá' },
  { code: 'PY', name: 'Paraguay' },
  { code: 'PE', name: 'Perú' },
  { code: 'PT', name: 'Portugal' },
  { code: 'PR', name: 'Puerto Rico' },
  { code: 'GB', name: 'Reino Unido' },
  { code: 'DO', name: 'República Dominicana' },
  { code: 'SE', name: 'Suecia' },
  { code: 'CH', name: 'Suiza' },
  { code: 'UY', name: 'Uruguay' },
  { code: 'VE', name: 'Venezuela' },
].sort((a, b) => a.name.localeCompare(b.name))

export function getCountryName(code: string): string {
  const cleanCode = (code || '').trim().toUpperCase()
  const found = COUNTRIES.find((c) => c.code === cleanCode)
  return found ? found.name : cleanCode
}

export function getCountryFlag(code: string): string {
  const cleanCode = (code || '').trim().toUpperCase()
  if (!cleanCode) return ''
  const twoLetter =
    cleanCode === 'ESP' ? 'ES' :
    cleanCode === 'ITA' ? 'IT' :
    cleanCode === 'FRA' ? 'FR' :
    cleanCode === 'GER' ? 'DE' :
    cleanCode === 'GBR' ? 'GB' :
    cleanCode === 'BEL' ? 'BE' :
    cleanCode === 'USA' ? 'US' :
    cleanCode === 'JPN' ? 'JP' :
    cleanCode === 'BRA' ? 'BR' :
    cleanCode === 'QAT' ? 'QA' :
    cleanCode === 'POR' ? 'PT' :
    cleanCode === 'ARG' ? 'AR' :
    cleanCode === 'MEX' ? 'MX' :
    cleanCode === 'CHI' ? 'CL' :
    cleanCode === 'COL' ? 'CO' :
    cleanCode === 'AUS' ? 'AU' :
    cleanCode === 'NED' ? 'NL' :
    cleanCode === 'CAN' ? 'CA' :
    cleanCode === 'AUT' ? 'AT' :
    cleanCode === 'SGP' ? 'SG' :
    cleanCode === 'ARE' ? 'AE' :
    cleanCode.slice(0, 2)

  if (twoLetter.length !== 2) return ''
  const codePoints = twoLetter
    .split('')
    .map((char) => 127397 + char.charCodeAt(0))
  try {
    return String.fromCodePoint(...codePoints)
  } catch (e) {
    return ''
  }
}

// Compartido entre la acción de servidor (actions.ts, 'use server', solo puede exportar
// funciones async), la página del formulario y la ruta de exportación a Excel.
//
// `sanctionType` en la base de datos es texto libre (ver prisma/schema.prisma), no un enum: una
// sanción real casi siempre combina varios códigos (p. ej. "DT + SG 30s"), así que aquí solo se
// define la lista de códigos SUGERIDOS en el formulario — el comisario puede marcar varios a la
// vez o escribir algo distinto si la tabla no cubre el caso (reglamento, art. 14.1 y 14.8).

/** Códigos de sanción del reglamento (ERC v2.5, art. 14.10 — tabla orientativa de sanciones). */
export const SANCTION_CODES = [
  'Warning',
  'SL',
  'Aislamiento 1h',
  '3 puestos',
  '5 puestos',
  'DT',
  'SG 10s',
  'SG 20s',
  'SG 30s',
  '+60s',
  '+100s',
  'Towing +5 min',
  'Towing +10 min',
  'Long Pit +3 min',
  'DNF',
  'DNS',
  'DSQ',
  'Kick',
  'RB',
  'SB',
] as const

export type SanctionCode = (typeof SANCTION_CODES)[number]

/** Significado de cada código, para mostrar como ayuda junto a los checkboxes (art. 14.10). */
export const SANCTION_CODE_MEANINGS: Record<SanctionCode, string> = {
  Warning: 'Aviso',
  SL: 'Start Last — empieza la carrera en la última posición de su categoría',
  'Aislamiento 1h': 'No puede interactuar con la comunidad durante 1 hora',
  '3 puestos': 'Pierde 3 puestos en la salida',
  '5 puestos': 'Pierde 5 puestos en la salida',
  DT: 'Drive Through — pasar por boxes sin detenerse',
  'SG 10s': 'Stop & Go — parar 10s en su caja de boxes',
  'SG 20s': 'Stop & Go — parar 20s en su caja de boxes',
  'SG 30s': 'Stop & Go — parar 30s en su caja de boxes',
  '+60s': 'Se suman 60s al tiempo final de carrera',
  '+100s': 'Se suman 100s al tiempo final de carrera',
  'Towing +5 min': 'Towing al finalizar — se suman 5 min',
  'Towing +10 min': 'Towing al finalizar (Le Mans) — se suman 10 min',
  'Long Pit +3 min': 'Long Pit — se suman 3 min',
  DNF: 'Did Not Finish — no se clasifica como terminada',
  DNS: 'Did Not Start — no puede tomar la salida',
  DSQ: 'Disqualified — descalificado de la sesión',
  Kick: 'Expulsión instantánea del servidor (puede volver a entrar)',
  RB: 'Race Ban — no puede participar en la siguiente carrera',
  SB: 'Season Ban — no puede participar en lo que queda de temporada',
}

/** Catálogo íntegro de infracciones del reglamento (ERC v2.5), agrupado por capítulo, para el
 *  desplegable "Infracción" — autorrellena el motivo y los códigos de sanción sugeridos, que el
 *  comisario puede ajustar a mano después (el reglamento les da potestad para ello, art. 14.1). */
export const SANCTION_RULEBOOK: { chapter: string; articles: { code: string; action: string; sanction: SanctionCode[] }[] }[] = [
  {
    chapter: '1. Comportamiento fuera de pista',
    articles: [
      { code: '1.1', action: 'No asistir al briefing de carrera después de pasar lista.', sanction: ['SL'] },
      { code: '1.2', action: 'Hacer comentarios que rompan la seriedad en el briefing de clasificación o carrera.', sanction: ['Aislamiento 1h'] },
      { code: '1.3', action: 'Cambiar la alineación después de la fecha límite.', sanction: ['SL'] },
      { code: '1.4', action: 'Insultar o no respetar a cualquier miembro del Discord.', sanction: ['RB', 'SB'] },
      { code: '1.5', action: 'Insultar o no respetar a los miembros de la administración.', sanction: ['SB'] },
    ],
  },
  {
    chapter: '2. Entrada de boxes',
    articles: [
      { code: '2.1', action: 'Choque con otro coche en la entrada a boxes.', sanction: ['DT', 'SG 30s'] },
      { code: '2.2', action: 'Amagar la entrada a boxes pisando la bifurcación.', sanction: ['DT'] },
      { code: '2.3', action: 'Pisar la bifurcación o tocar el bolardo del inicio del carril de boxes.', sanction: ['DT'] },
      { code: '2.4', action: 'Entrar a boxes para cumplir una penalización en la última vuelta de carrera.', sanction: ['DSQ'] },
    ],
  },
  {
    chapter: '3. Boxes',
    articles: [
      { code: '3.1', action: 'Terminar la carrera en boxes.', sanction: ['DNF'] },
      { code: '3.2', action: 'Usar "volver a boxes" en tu caja de boxes para omitir el tiempo de parada en carrera.', sanction: ['SG 10s', '+60s'] },
    ],
  },
  {
    chapter: '4. Salida de boxes',
    articles: [
      { code: '4.1', action: 'Incorporarse a pista atravesando con una rueda la línea continua.', sanction: ['DT'] },
      { code: '4.2', action: 'No salir a la máxima velocidad sin ningún motivo obstruyendo la salida a los demás pilotos.', sanction: ['SG 10s'] },
      { code: '4.3', action: 'Adelantar después de la línea horizontal bajo Full Course Yellow.', sanction: ['DT'] },
    ],
  },
  {
    chapter: '5. Retirada',
    articles: [
      { code: '5.1', action: 'Quedarte parado sin combustible antes de terminar la carrera. No está permitido empujar otro coche para ayudar a llegar a la calle de boxes. (Towing en Le Mans: +10 min.)', sanction: ['Towing +5 min'] },
      { code: '5.2', action: 'Usar "volver a boxes" o desconectarse fuera de boxes en carrera. (Towing en Le Mans: +10 min.)', sanction: ['Towing +5 min'] },
      { code: '5.3', action: 'Cruzar la línea de meta al finalizar la carrera dentro de boxes.', sanction: ['DSQ'] },
      { code: '5.4', action: 'Detener el vehículo delante de la meta y esperar a que se acabe el tiempo.', sanction: ['SL'] },
    ],
  },
  {
    chapter: '6. Comportamiento en pista',
    articles: [
      { code: '6.1', action: 'Usar la cuenta de otro piloto en cualquier sesión (práctica, clasificación o carrera).', sanction: ['SB'] },
      { code: '6.2', action: 'Usar trucos para ganar una ventaja significativa sobre los competidores.', sanction: ['SB'] },
      { code: '6.3', action: 'Provocar una colisión bajo Full Course Yellow.', sanction: ['SG 10s', 'DSQ'] },
      { code: '6.4', action: 'Molestar a otros pilotos cuando tu coche es inconducible por daños u otros problemas.', sanction: ['DT'] },
      { code: '6.5', action: 'Provocar un accidente cuando tu coche es inconducible por daños u otros problemas.', sanction: ['SG 10s', 'DSQ'] },
      { code: '6.6', action: 'Reincorporación peligrosa.', sanction: ['DT', 'SG 30s'] },
      { code: '6.7', action: 'Adelantamiento con golpe sin devolver la posición.', sanction: ['DT', 'SG 10s'] },
      { code: '6.8', action: 'Accidente deliberado.', sanction: ['DSQ', 'SB'] },
      { code: '6.9', action: 'Molestar de forma excesiva en las sesiones de práctica (se considera excesivo más de 3 veces por piloto).', sanction: ['DNS', 'DSQ'] },
      { code: '6.10', action: 'Adelantar excediendo de los límites de la pista.', sanction: ['DT', 'SG 30s'] },
      { code: '6.11', action: 'Adelantar bajo Full Course Yellow (FCY).', sanction: ['DT', 'SG 10s'] },
      { code: '6.12', action: 'Realizar maniobras peligrosas (ejemplo: conducción errática a criterio de los directores de carrera).', sanction: ['DT', 'SG 10s'] },
      { code: '6.13', action: 'Cambiar de dirección más de 2 veces en recta = Waving (no afecta bajo Full Course Yellow).', sanction: ['DT'] },
      { code: '6.14', action: 'Empujar en clasificación a un coche en recta para hacerle ganar velocidad.', sanction: ['SL'] },
      { code: '6.15', action: 'Cambiar de dirección en frenada o frenar en diagonal.', sanction: ['Warning'] },
      { code: '6.16', action: 'Cambiar de dirección en frenada o frenar en diagonal y provocar una colisión.', sanction: ['DT', 'SG 20s'] },
      { code: '6.17', action: 'Ralentizar sin motivo en la vuelta de formación.', sanction: ['SG 10s'] },
      { code: '6.18', action: 'Aprovechar un bug / una ventaja / exploit del juego o del Real Penalty.', sanction: ['DSQ'] },
      { code: '6.19', action: 'No ofrecer cámara cuando los comisarios la solicitan (los segundos de sanción se añaden al final de la carrera).', sanction: ['SL', '+60s'] },
      { code: '6.20', action: 'Acortar el circuito para ahorrar tiempo en clasificación (si te clasificas y caes fuera del TOP con esta sanción NO podrás participar en la carrera).', sanction: ['5 puestos'] },
      { code: '6.21', action: 'Perjudicar en pista de forma obvia a otro coche sin estar en la misma vuelta por órdenes del equipo.', sanction: ['DSQ'] },
      { code: '6.22', action: 'Perjudicar en pista de forma obvia a otro coche sin estar en la misma vuelta.', sanction: ['SG 10s'] },
      { code: '6.23', action: 'Siendo el líder, detener el vehículo delante de la meta y alargar el tiempo de carrera.', sanction: ['DSQ', 'SL'] },
    ],
  },
  {
    chapter: '7. Banderas',
    articles: [
      { code: '7.1', action: 'Obstaculizar bajo bandera azul o vuelta perdida en tu misma categoría en carrera.', sanction: ['DT'] },
      { code: '7.2', action: 'Obstaculizar bajo bandera azul en clasificación.', sanction: ['3 puestos'] },
      { code: '7.3', action: 'Provocar un accidente bajo bandera azul en carrera.', sanction: ['SG 10s'] },
      { code: '7.4', action: 'Provocar un accidente bajo bandera azul en clasificación.', sanction: ['5 puestos', 'SL'] },
      { code: '7.5', action: 'Adelantar bajo bandera amarilla en carrera.', sanction: ['DT'] },
      { code: '7.6', action: 'No entrar a boxes con daños bajo bandera negra y naranja (Meatball).', sanction: ['+100s', 'SG 10s'] },
      { code: '7.7', action: 'Adelantar bajo bandera roja.', sanction: ['SG 20s'] },
    ],
  },
  {
    chapter: '8. Doblajes',
    articles: [
      { code: '8.1', action: 'Forzar fuera de pista a un rival.', sanction: ['Warning'] },
      { code: '8.2', action: 'Forzar fuera de pista a un rival haciéndole perder el control del vehículo.', sanction: ['DT'] },
      { code: '8.3', action: 'Dañar una parte importante del vehículo rival (ejemplo: suspensión).', sanction: ['DT', 'SG 30s'] },
      { code: '8.4', action: 'Destrozar el vehículo del rival.', sanction: ['SG 30s'] },
      { code: '8.5', action: 'Destrozar el vehículo del rival causando un accidente múltiple.', sanction: ['DSQ'] },
      { code: '8.6', action: 'Perder demasiadas vueltas con el líder de tu categoría.', sanction: ['DSQ'] },
    ],
  },
  {
    chapter: 'RP. Sanciones automáticas: Real Penalty',
    articles: [
      { code: 'RP.1', action: 'Entrar al servidor sin el Real Penalty instalado y activado.', sanction: ['Kick'] },
      { code: 'RP.2', action: 'No cumplir una penalización de Drive Through o Stop&Go en boxes después de 10 vueltas.', sanction: ['DSQ'] },
      { code: 'RP.3', action: 'Terminar la carrera con una penalización de Drive Through o Stop&Go pendiente.', sanction: ['+60s'] },
      { code: 'RP.4', action: 'Exceder los límites de pista X veces (N avisos + 1 = Drive Through).', sanction: ['DT'] },
      { code: 'RP.5', action: 'Exceder el límite de velocidad de boxes.', sanction: ['DT', 'SG 20s'] },
      { code: 'RP.6', action: 'Exceder el límite de velocidad durante el procedimiento de salida en carrera.', sanction: ['DT', 'SG 20s'] },
      { code: 'RP.7', action: 'Al cambiar de piloto, salir de boxes antes de que acabe el contador regresivo de Long Pit.', sanction: ['SG 10s'] },
      { code: 'RP.8', action: 'Terminar el periodo de Full Course Yellow con una delta excesiva.', sanction: ['DT', 'SG 10s'] },
      { code: 'RP.9', action: 'Terminar el periodo de Full Course Yellow a una velocidad excesiva.', sanction: ['DT', 'SG 10s'] },
      { code: 'RP.X', action: 'Desconexión del servidor fuera de boxes en carrera.', sanction: ['Long Pit +3 min'] },
    ],
  },
]

/** Para mostrar algo razonable en sanciones antiguas, guardadas con el enum genérico anterior. */
const LEGACY_LABELS: Record<string, string> = {
  warning: 'Aviso',
  time_penalty: 'Penalización de tiempo',
  points_deduction: 'Resta de puntos',
  grid_drop: 'Penalización en parrilla',
  disqualification: 'Descalificación',
  race_ban: 'Race Ban',
  season_ban: 'Season Ban',
  other: 'Otra',
}

export function formatSanctionType(value: string): string {
  return LEGACY_LABELS[value] || value
}

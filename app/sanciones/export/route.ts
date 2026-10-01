import ExcelJS from 'exceljs'
import { NextResponse } from 'next/server'
import { getAdminAccessContext, getCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { redirectTo } from '@/lib/redirect'
import { formatSanctionType } from '@/lib/sanctions'

export async function GET(request: Request) {
  const session = await getCurrentUser()
  if (!session) return redirectTo('/perfil')

  const access = await getAdminAccessContext(session.userId)
  if (!access.canAccessAnyLeagueAdmin) return redirectTo('/perfil')

  const { searchParams } = new URL(request.url)
  const requestedLeagueId = searchParams.get('leagueId') || undefined

  // Un comisario solo puede exportar sus propios campeonatos, nunca todos ni los de otro.
  if (requestedLeagueId && !access.canAccessPlatformAdmin && !access.managedLeagueIds.includes(requestedLeagueId)) {
    return new NextResponse('Forbidden', { status: 403 })
  }

  const where = requestedLeagueId
    ? { leagueId: requestedLeagueId }
    : access.canAccessPlatformAdmin
      ? undefined
      : { leagueId: { in: access.managedLeagueIds } }

  const records = await db.sanctionRecord.findMany({
    where,
    include: { event: { select: { title: true, circuitName: true } }, league: { select: { title: true } } },
    orderBy: { createdAt: 'desc' },
  })

  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'RSX Hub'
  workbook.created = new Date()

  const sheet = workbook.addWorksheet('Sanciones', { views: [{ state: 'frozen', ySplit: 1 }] })
  sheet.columns = [
    { header: 'Fecha', key: 'date', width: 18 },
    { header: 'Campeonato', key: 'league', width: 26 },
    { header: 'Dorsal', key: 'dorsal', width: 10 },
    { header: 'Piloto', key: 'driver', width: 24 },
    { header: 'Equipo', key: 'team', width: 24 },
    { header: 'Carrera', key: 'event', width: 28 },
    { header: 'Tipo de sanción', key: 'type', width: 20 },
    { header: 'Motivo', key: 'reason', width: 50 },
    { header: 'Puesta por', key: 'by', width: 20 },
  ]
  sheet.getRow(1).font = { bold: true }

  for (const r of records) {
    const eventLabel = r.event ? `${r.event.title || r.event.circuitName}` : ''
    sheet.addRow({
      date: r.createdAt.toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' }),
      league: r.league.title,
      dorsal: r.dorsal ?? '',
      driver: r.driverName || '',
      team: r.teamNameSnapshot || '',
      event: eventLabel,
      type: formatSanctionType(r.sanctionType),
      reason: r.reason,
      by: r.createdByName,
    })
  }

  sheet.autoFilter = { from: 'A1', to: 'I1' }

  const buffer = Buffer.from(await workbook.xlsx.writeBuffer())
  const filename = requestedLeagueId ? `sanciones-${requestedLeagueId}.xlsx` : 'sanciones.xlsx'

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}

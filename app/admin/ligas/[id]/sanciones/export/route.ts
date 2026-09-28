import ExcelJS from 'exceljs'
import { NextResponse } from 'next/server'
import { canAccessPlatformAdmin, canStewardLeague, getCurrentUser, getLeagueRole, getPlatformRole } from '@/lib/auth'
import { db } from '@/lib/db'
import { redirectTo } from '@/lib/redirect'
import { SANCTION_TYPE_LABELS, type SanctionType } from '@/lib/sanctions'

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id: leagueId } = await context.params
  const session = await getCurrentUser()
  if (!session) return redirectTo('/perfil')

  const [platformRole, leagueRole] = await Promise.all([getPlatformRole(session.userId), getLeagueRole(leagueId, session.userId)])
  if (!(canAccessPlatformAdmin(platformRole) || canStewardLeague(leagueRole))) {
    return redirectTo('/admin')
  }

  const league = await db.league.findUnique({ where: { id: leagueId }, select: { title: true } })
  if (!league) return new NextResponse('League not found', { status: 404 })

  const records = await db.sanctionRecord.findMany({
    where: { leagueId },
    include: { event: { select: { title: true, circuitName: true, startsAt: true } } },
    orderBy: { createdAt: 'desc' },
  })

  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'RSX Hub'
  workbook.created = new Date()

  const sheet = workbook.addWorksheet('Sanciones', { views: [{ state: 'frozen', ySplit: 1 }] })
  sheet.columns = [
    { header: 'Fecha', key: 'date', width: 18 },
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
      driver: r.driverName || '',
      team: r.teamNameSnapshot || '',
      event: eventLabel,
      type: SANCTION_TYPE_LABELS[r.sanctionType as SanctionType] || r.sanctionType,
      reason: r.reason,
      by: r.createdByName,
    })
  }

  sheet.autoFilter = { from: 'A1', to: 'G1' }

  const buffer = Buffer.from(await workbook.xlsx.writeBuffer())
  const filename = `sanciones-${(league.title || 'campeonato').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.xlsx`

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}

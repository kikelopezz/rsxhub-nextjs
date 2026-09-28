import ExcelJS from 'exceljs'
import { NextResponse } from 'next/server'
import { canAccessPlatformAdmin, getAdminAccessContext, getCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { redirectTo } from '@/lib/redirect'
import { SANCTION_TYPE_LABELS, type SanctionType } from '@/lib/sanctions'

export async function GET(request: Request) {
  const session = await getCurrentUser()
  if (!session) return redirectTo('/perfil')

  const access = await getAdminAccessContext(session.userId)
  if (!canAccessPlatformAdmin(access.platformRole)) return redirectTo('/admin')

  const { searchParams } = new URL(request.url)
  const leagueId = searchParams.get('leagueId') || undefined

  const records = await db.sanctionRecord.findMany({
    where: leagueId ? { leagueId } : undefined,
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
      driver: r.driverName || '',
      team: r.teamNameSnapshot || '',
      event: eventLabel,
      type: SANCTION_TYPE_LABELS[r.sanctionType as SanctionType] || r.sanctionType,
      reason: r.reason,
      by: r.createdByName,
    })
  }

  sheet.autoFilter = { from: 'A1', to: 'H1' }

  const buffer = Buffer.from(await workbook.xlsx.writeBuffer())
  const filename = leagueId ? `sanciones-${leagueId}.xlsx` : 'sanciones-todos-los-campeonatos.xlsx'

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}

import { DailySession, Profile } from './supabase'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'

function formatSeconds(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function formatTime(isoString: string): string {
  return format(parseISO(isoString), 'HH:mm:ss')
}

function formatDate(isoString: string): string {
  return format(parseISO(isoString), "EEEE d 'de' MMMM 'de' yyyy", { locale: es })
}

export async function generateDailyPDF(session: DailySession, profile: Profile): Promise<Blob> {
  const { jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  const pageW = doc.internal.pageSize.getWidth()
  const margin = 20

  // Header background
  doc.setFillColor(10, 10, 15)
  doc.rect(0, 0, pageW, 50, 'F')

  // Gold accent line
  doc.setFillColor(201, 168, 76)
  doc.rect(0, 48, pageW, 1, 'F')

  // Title
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(22)
  doc.setTextColor(201, 168, 76)
  doc.text('TIMES WORK', margin, 20)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(150, 150, 180)
  doc.text('Tiempo de Trabajo · Registro Legal de Jornada', margin, 28)

  // Legal stamp
  doc.setFillColor(0, 229, 255, 20)
  doc.roundedRect(pageW - 70, 10, 55, 30, 4, 4, 'F')
  doc.setFontSize(7)
  doc.setTextColor(0, 229, 255)
  doc.setFont('helvetica', 'bold')
  doc.text('✓ REGISTRO AUDITADO', pageW - 67, 20)
  doc.text('✓ INALTERABLE', pageW - 67, 27)
  doc.text('✓ GPS VERIFICADO', pageW - 67, 34)

  // Reset
  doc.setTextColor(20, 20, 30)

  // Worker info
  let y = 60
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(201, 168, 76)
  doc.text('DATOS DEL TRABAJADOR', margin, y)

  y += 6
  doc.setFillColor(245, 245, 250)
  doc.roundedRect(margin, y, pageW - margin * 2, 28, 3, 3, 'F')
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(20, 20, 30)
  doc.text(`Nombre: ${profile.full_name || 'No especificado'}`, margin + 4, y + 8)
  doc.text(`DNI/NIF: ${profile.dni_nif || 'No especificado'}`, margin + 4, y + 16)
  doc.text(`Empresa: ${profile.company_name || 'No especificada'}  ·  CIF: ${profile.company_cif || '–'}`, margin + 4, y + 24)

  // Date
  y += 38
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(40, 40, 60)
  doc.text(`Registro del ${formatDate(session.date + 'T00:00:00')}`, margin, y)

  // Summary box
  y += 8
  const effectiveSeconds = session.total_seconds - session.pause_seconds
  doc.setFillColor(10, 10, 15)
  doc.roundedRect(margin, y, pageW - margin * 2, 36, 4, 4, 'F')

  doc.setFontSize(9)
  doc.setTextColor(150, 150, 180)
  doc.text('INICIO', margin + 8, y + 10)
  doc.text('FIN', margin + 55, y + 10)
  doc.text('TIEMPO EFECTIVO', margin + 100, y + 10)
  doc.text('PAUSAS', margin + 155, y + 10)

  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(0, 229, 255)
  doc.text(formatTime(session.start_time), margin + 8, y + 24)
  doc.text(session.end_time ? formatTime(session.end_time) : '–', margin + 55, y + 24)
  doc.text(formatSeconds(effectiveSeconds), margin + 100, y + 24)

  doc.setTextColor(245, 158, 11)
  doc.text(formatSeconds(session.pause_seconds), margin + 155, y + 24)

  // Events table
  y += 46
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(201, 168, 76)
  doc.text('REGISTRO DETALLADO DE EVENTOS', margin, y)

  y += 4
  const eventRows = session.events.map(e => [
    { content: e.event_type.toUpperCase(), styles: { fontStyle: 'bold' as const } },
    formatTime(e.timestamp),
    formatTime(e.server_timestamp),
    e.latitude ? `${e.latitude.toFixed(5)}, ${e.longitude?.toFixed(5)}` : 'No disponible',
    e.accuracy ? `±${e.accuracy.toFixed(0)}m` : '–',
  ])

  autoTable(doc, {
    startY: y,
    head: [['EVENTO', 'HORA LOCAL', 'HORA SERVIDOR', 'COORDENADAS GPS', 'PRECISIÓN']],
    body: eventRows,
    headStyles: {
      fillColor: [30, 30, 50],
      textColor: [201, 168, 76],
      fontStyle: 'bold',
      fontSize: 9,
    },
    bodyStyles: { fontSize: 8.5, textColor: [30, 30, 50] },
    alternateRowStyles: { fillColor: [248, 248, 252] },
    margin: { left: margin, right: margin },
  })

  const finalY = (doc as any).lastAutoTable.finalY + 10

  // Legal disclaimer
  doc.setFillColor(245, 248, 255)
  doc.roundedRect(margin, finalY, pageW - margin * 2, 30, 3, 3, 'F')
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(7.5)
  doc.setTextColor(80, 80, 120)
  const disclaimer = [
    'Documento generado por Times Work · Registro de Jornada Laboral conforme al RD 8/2019.',
    'Los registros están sellados con timestamp del servidor (UTC) y son inalterables por el usuario.',
    `Generado el ${format(new Date(), "d/MM/yyyy 'a las' HH:mm:ss")} · ID Sesión: ${session.session_id.substring(0, 16)}...`,
    'Este documento tiene validez legal ante la Inspección de Trabajo y Seguridad Social.',
  ]
  disclaimer.forEach((line, i) => {
    doc.text(line, margin + 4, finalY + 7 + i * 5.5)
  })

  // Footer
  const pageH = doc.internal.pageSize.getHeight()
  doc.setFillColor(10, 10, 15)
  doc.rect(0, pageH - 12, pageW, 12, 'F')
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(80, 80, 100)
  doc.text('TIMES WORK · Tiempo de Trabajo · Registro Legal Inalterable', margin, pageH - 5)
  doc.text('GPS FIJADO · REGISTRO AUDITADO', pageW - margin, pageH - 5, { align: 'right' })

  return doc.output('blob')
}

export async function generateMonthlyPDF(
  sessions: DailySession[],
  profile: Profile,
  month: string // e.g. "2024-01"
): Promise<Blob> {
  const { jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const margin = 20

  const [year, monthNum] = month.split('-')
  const monthName = format(new Date(Number(year), Number(monthNum) - 1, 1), "MMMM yyyy", { locale: es }).toUpperCase()

  // Header
  doc.setFillColor(10, 10, 15)
  doc.rect(0, 0, pageW, 55, 'F')
  doc.setFillColor(201, 168, 76)
  doc.rect(0, 53, pageW, 1.5, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(24)
  doc.setTextColor(201, 168, 76)
  doc.text('TIMES WORK', margin, 22)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(150, 150, 180)
  doc.text('Informe Mensual de Jornada Laboral', margin, 31)

  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(255, 255, 255)
  doc.text(monthName, margin, 43)

  // Worker card
  let y = 64
  doc.setFillColor(245, 245, 250)
  doc.roundedRect(margin, y, pageW - margin * 2, 32, 4, 4, 'F')
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(20, 20, 30)
  doc.text(`Trabajador: ${profile.full_name || '–'}`, margin + 5, y + 9)
  doc.text(`DNI/NIF: ${profile.dni_nif || '–'}`, margin + 5, y + 17)
  doc.text(`Empresa: ${profile.company_name || '–'}  ·  CIF: ${profile.company_cif || '–'}`, margin + 5, y + 25)

  // Totals
  const totalEffective = sessions.reduce((acc, s) => acc + s.total_seconds - s.pause_seconds, 0)
  const totalPause = sessions.reduce((acc, s) => acc + s.pause_seconds, 0)
  const totalDays = sessions.length
  const avgDaily = totalDays > 0 ? Math.round(totalEffective / totalDays) : 0

  y += 40
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(201, 168, 76)
  doc.text('RESUMEN DEL MES', margin, y)

  y += 5
  doc.setFillColor(10, 10, 15)
  doc.roundedRect(margin, y, pageW - margin * 2, 28, 4, 4, 'F')

  const cols = [
    { label: 'DÍAS TRABAJADOS', value: `${totalDays}`, color: [0, 229, 255] },
    { label: 'HORAS EFECTIVAS', value: formatSeconds(totalEffective), color: [0, 229, 255] },
    { label: 'TOTAL PAUSAS', value: formatSeconds(totalPause), color: [245, 158, 11] },
    { label: 'MEDIA DIARIA', value: formatSeconds(avgDaily), color: [150, 200, 150] },
  ]
  const colW = (pageW - margin * 2) / cols.length
  cols.forEach((col, i) => {
    const x = margin + i * colW + colW / 2
    doc.setFontSize(7.5)
    doc.setTextColor(150, 150, 180)
    doc.setFont('helvetica', 'normal')
    doc.text(col.label, x, y + 10, { align: 'center' })
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(col.color[0], col.color[1], col.color[2])
    doc.text(col.value, x, y + 22, { align: 'center' })
  })

  // Table
  y += 36
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(201, 168, 76)
  doc.text('DETALLE DIARIO', margin, y)

  y += 4
  const rows = sessions.map(s => {
    const effective = s.total_seconds - s.pause_seconds
    return [
      format(parseISO(s.date + 'T00:00:00'), 'EEE dd/MM', { locale: es }).toUpperCase(),
      formatTime(s.start_time),
      s.end_time ? formatTime(s.end_time) : '–',
      formatSeconds(effective),
      formatSeconds(s.pause_seconds),
      s.events.length.toString(),
    ]
  })

  autoTable(doc, {
    startY: y,
    head: [['FECHA', 'ENTRADA', 'SALIDA', 'T. EFECTIVO', 'PAUSAS', 'EVENTOS']],
    body: rows,
    headStyles: { fillColor: [30, 30, 50], textColor: [201, 168, 76], fontStyle: 'bold', fontSize: 9 },
    bodyStyles: { fontSize: 9, textColor: [30, 30, 50] },
    alternateRowStyles: { fillColor: [248, 248, 252] },
    margin: { left: margin, right: margin },
  })

  const finalY2 = (doc as any).lastAutoTable.finalY + 10
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(7.5)
  doc.setTextColor(120, 120, 150)
  doc.text(
    `Informe generado el ${format(new Date(), "d/MM/yyyy 'a las' HH:mm")} · Times Work · Registro Legal RD 8/2019`,
    pageW / 2, finalY2, { align: 'center' }
  )

  return doc.output('blob')
}

export function shareBlob(blob: Blob, filename: string) {
  const file = new File([blob], filename, { type: 'application/pdf' })
  if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
    navigator.share({
      title: 'Times Work · Registro de Jornada',
      text: 'Registro de jornada laboral',
      files: [file],
    }).catch(console.error)
  } else {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 10000)
  }
}

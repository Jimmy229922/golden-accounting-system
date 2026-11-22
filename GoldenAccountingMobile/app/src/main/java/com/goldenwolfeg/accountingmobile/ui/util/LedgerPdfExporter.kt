package com.goldenwolfeg.accountingmobile.ui.util

import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Typeface
import android.graphics.pdf.PdfDocument
import androidx.core.content.FileProvider
import com.goldenwolfeg.accountingmobile.data.model.Party
import com.goldenwolfeg.accountingmobile.data.model.PartyLedgerEntry
import com.goldenwolfeg.accountingmobile.ui.components.formatCurrency
import java.io.File
import java.io.FileOutputStream
import java.math.BigDecimal

object LedgerPdfExporter {

    fun exportAndShare(
        context: Context,
        party: Party,
        entries: List<PartyLedgerEntry>
    ): Result<Unit> {
        return try {
            val pdfDoc = PdfDocument()
            val pageWidth = 595
            val pageHeight = 842
            val margin = 32f

            val navyPaint = Paint().apply { color = Color.parseColor("#0B132B") }
            val goldLinePaint = Paint().apply {
                color = Color.parseColor("#D4AF37")
                strokeWidth = 2f
            }
            val headerTitlePaint = Paint().apply {
                color = Color.WHITE
                textSize = 18f
                typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
                textAlign = Paint.Align.RIGHT
                isAntiAlias = true
            }
            val headerSubPaint = Paint().apply {
                color = Color.parseColor("#F3E5AB")
                textSize = 11f
                textAlign = Paint.Align.RIGHT
                isAntiAlias = true
            }
            val labelPaint = Paint().apply {
                color = Color.parseColor("#0F172A")
                textSize = 12f
                typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
                textAlign = Paint.Align.RIGHT
                isAntiAlias = true
            }
            val bodyPaint = Paint().apply {
                color = Color.parseColor("#1E293B")
                textSize = 10f
                textAlign = Paint.Align.RIGHT
                isAntiAlias = true
            }
            val tableHeaderBg = Paint().apply { color = Color.parseColor("#1C2541") }
            val tableHeaderText = Paint().apply {
                color = Color.WHITE
                textSize = 10f
                typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
                textAlign = Paint.Align.RIGHT
                isAntiAlias = true
            }
            val zebraBg = Paint().apply { color = Color.parseColor("#F8FAFC") }
            val borderPaint = Paint().apply {
                color = Color.parseColor("#CBD5E1")
                strokeWidth = 0.8f
            }

            var pageNumber = 1
            var pageInfo = PdfDocument.PageInfo.Builder(pageWidth, pageHeight, pageNumber).create()
            var page = pdfDoc.startPage(pageInfo)
            var canvas = page.canvas

            canvas.drawRect(0f, 0f, pageWidth.toFloat(), 84f, navyPaint)
            canvas.drawLine(0f, 84f, pageWidth.toFloat(), 84f, goldLinePaint)
            canvas.drawText("Golden Accounting System", pageWidth - margin, 36f, headerTitlePaint)
            canvas.drawText("كشف حساب موحد — ${party.name}", pageWidth - margin, 60f, headerSubPaint)

            var y = 110f
            val statusText = when {
                party.balance > BigDecimal.ZERO -> "مستحق لنا"
                party.balance < BigDecimal.ZERO -> "مستحق علينا"
                else -> "متزن"
            }
            canvas.drawText("الطرف: ${party.name}  |  الكود: ${party.code}  |  النوع: ${party.type.label}", pageWidth - margin, y, labelPaint)
            y += 20f
            canvas.drawText("الرصيد الحالي: ${formatCurrency(party.balance)} ($statusText)  |  عدد الحركات: ${entries.size}", pageWidth - margin, y, labelPaint)
            y += 18f
            canvas.drawLine(margin, y, pageWidth - margin, y, borderPaint)
            y += 16f

            fun drawTableHeader(startY: Float): Float {
                canvas.drawRect(margin, startY, pageWidth - margin, startY + 24f, tableHeaderBg)
                val textY = startY + 16f
                canvas.drawText("التاريخ", pageWidth - margin - 6f, textY, tableHeaderText)
                canvas.drawText("المستند", pageWidth - margin - 95f, textY, tableHeaderText)
                canvas.drawText("الإجمالي", pageWidth - margin - 240f, textY, tableHeaderText)
                canvas.drawText("المدفوع", pageWidth - margin - 340f, textY, tableHeaderText)
                canvas.drawText("الرصيد", pageWidth - margin - 435f, textY, tableHeaderText)
                return startY + 28f
            }

            y = drawTableHeader(y)

            entries.forEachIndexed { index, entry ->
                if (y > pageHeight - 50f) {
                    pdfDoc.finishPage(page)
                    pageNumber += 1
                    pageInfo = PdfDocument.PageInfo.Builder(pageWidth, pageHeight, pageNumber).create()
                    page = pdfDoc.startPage(pageInfo)
                    canvas = page.canvas
                    y = drawTableHeader(margin)
                }

                if (index % 2 == 1) {
                    canvas.drawRect(margin, y - 13f, pageWidth - margin, y + 7f, zebraBg)
                }

                val docLabel = listOf(entry.docType, entry.docNumber).filter { it.isNotBlank() }.joinToString(" #").take(24)
                canvas.drawText(entry.transDate, pageWidth - margin - 6f, y, bodyPaint)
                canvas.drawText(docLabel, pageWidth - margin - 95f, y, bodyPaint)
                canvas.drawText(formatCurrency(entry.totalAmount), pageWidth - margin - 240f, y, bodyPaint)
                canvas.drawText(formatCurrency(entry.paidAmount), pageWidth - margin - 340f, y, bodyPaint)
                canvas.drawText(formatCurrency(entry.runningBalance), pageWidth - margin - 435f, y, bodyPaint)
                canvas.drawLine(margin, y + 7f, pageWidth - margin, y + 7f, borderPaint)
                y += 22f
            }

            pdfDoc.finishPage(page)

            val pdfDir = File(context.cacheDir, "pdfs").apply { if (!exists()) mkdirs() }
            val safeName = party.name.replace(Regex("[^\\p{L}\\p{N}_-]"), "_").take(40).ifBlank { "statement" }
            val outFile = File(pdfDir, "كشف_حساب_$safeName.pdf")
            FileOutputStream(outFile).use { fos -> pdfDoc.writeTo(fos) }
            pdfDoc.close()

            val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", outFile)
            val shareIntent = Intent(Intent.ACTION_SEND).apply {
                type = "application/pdf"
                putExtra(Intent.EXTRA_STREAM, uri)
                putExtra(Intent.EXTRA_SUBJECT, "كشف حساب - ${party.name}")
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
            context.startActivity(Intent.createChooser(shareIntent, "مشاركة كشف الحساب (PDF)"))
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}

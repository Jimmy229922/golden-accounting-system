package com.goldenwolfeg.accountingmobile.ui.util

import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

object DateTimeFormatter {

    fun formatIsoToLocalArabic(isoDateStr: String?): String {
        if (isoDateStr.isNullOrBlank()) return "-"
        return try {
            val cleanStr = isoDateStr.take(19)
            val inputFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US).apply {
                timeZone = TimeZone.getTimeZone("UTC")
            }
            val date = inputFormat.parse(cleanStr) ?: return isoDateStr

            val outputFormat = SimpleDateFormat("yyyy-MM-dd hh:mm a", Locale("ar"))
            outputFormat.timeZone = TimeZone.getDefault()
            outputFormat.format(date)
                .replace("AM", "ص")
                .replace("PM", "م")
        } catch (_: Exception) {
            isoDateStr
        }
    }

    fun getCurrentLocalArabicTime(): String {
        val outputFormat = SimpleDateFormat("yyyy-MM-dd hh:mm a", Locale("ar"))
        return outputFormat.format(Date())
            .replace("AM", "ص")
            .replace("PM", "م")
    }
}

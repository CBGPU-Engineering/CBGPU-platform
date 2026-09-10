package com.cbgpu.cbgpu_app.widgets

import android.appwidget.AppWidgetManager
import android.content.Context
import android.content.SharedPreferences
import android.net.Uri
import android.view.View
import android.widget.RemoteViews
import com.cbgpu.cbgpu_app.MainActivity
import com.cbgpu.cbgpu_app.R
import es.antonborri.home_widget.HomeWidgetLaunchIntent
import es.antonborri.home_widget.HomeWidgetProvider

/**
 * Renders today's schedule as an actual row-per-period table (period badge +
 * subject) instead of one run-on line of text. RemoteViews doesn't support
 * TableLayout, so each row is its own inflated widget_timetable_row.xml
 * appended to the @id/timetable_rows container with addView() — the
 * RemoteViews equivalent of what a real list would do, just built fresh
 * every refresh instead of recycled (six rows at most, so that's fine).
 *
 * "timetable.rows" (written by lib/core/home_widgets.dart's
 * _refreshTimetable, format "period::subject" lines) is empty whenever
 * there's no real schedule to show (not logged in, weekend, fetch failed) —
 * in that case this falls back to the plain "timetable.body" status message
 * instead, same text the pre-table rendering always used for those states.
 */
class TimetableWidgetProvider : HomeWidgetProvider() {
  override fun onUpdate(
      context: Context,
      appWidgetManager: AppWidgetManager,
      appWidgetIds: IntArray,
      widgetData: SharedPreferences,
  ) {
    val rowsRaw = widgetData.getString("timetable.rows", "") ?: ""
    val body = widgetData.getString("timetable.body", "불러오는 중…") ?: ""
    val updatedAt = widgetData.getString("timetable.updatedAt", "") ?: ""

    val rows =
        rowsRaw.splitToSequence('\n')
            .filter { it.isNotBlank() }
            .mapNotNull { line ->
              val i = line.indexOf("::")
              if (i < 0) null else line.substring(0, i) to line.substring(i + 2)
            }
            .toList()

    for (widgetId in appWidgetIds) {
      val views = RemoteViews(context.packageName, R.layout.widget_timetable)
      views.removeAllViews(R.id.timetable_rows)

      if (rows.isEmpty()) {
        views.setViewVisibility(R.id.widget_body, View.VISIBLE)
        views.setTextViewText(R.id.widget_body, body)
      } else {
        views.setViewVisibility(R.id.widget_body, View.GONE)
        for ((period, subject) in rows) {
          val row = RemoteViews(context.packageName, R.layout.widget_timetable_row)
          row.setTextViewText(R.id.row_period, period)
          row.setTextViewText(R.id.row_subject, subject)
          views.addView(R.id.timetable_rows, row)
        }
      }
      views.setTextViewText(R.id.widget_meta, updatedAt)
      applyWidgetAppearance(context, views, widgetId)

      val uri = Uri.parse("cbgpu://open/timetable")
      val pendingIntent = HomeWidgetLaunchIntent.getActivity(context, MainActivity::class.java, uri)
      views.setOnClickPendingIntent(R.id.widget_root, pendingIntent)

      appWidgetManager.updateAppWidget(widgetId, views)
    }
  }

  override fun onDeleted(context: Context, appWidgetIds: IntArray) {
    for (widgetId in appWidgetIds) WidgetConfigPrefs.clear(context, widgetId)
  }
}

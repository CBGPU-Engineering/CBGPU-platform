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
 * One mini card per printer (the same real Bambu Lab X1 Carbon photo as the
 * web app's PrinterVisual.tsx, drawable-nodpi/bambu_x1c_*), arranged two per
 * row — not one aggregate photo, since "which of our printers" is exactly
 * the thing a glance at this widget needs to answer. Per cell: a number
 * badge (this printer's position, top-left), full color while printing or
 * done-and-awaiting-pickup, grayscale while idle, red X overlay when flagged
 * for maintenance. RemoteViews can't apply a runtime color filter to a
 * photo, so "grayscale" is a second baked PNG rather than a ColorMatrix.
 *
 * Reads "printer3d.rows" (lib/core/home_widgets.dart, "name::status" lines)
 * — empty whenever there's nothing to grid (not logged in, no printers
 * registered, fetch failed), in which case "printer3d.body" is shown as
 * plain status text instead.
 */
class Printer3dWidgetProvider : HomeWidgetProvider() {
  override fun onUpdate(
      context: Context,
      appWidgetManager: AppWidgetManager,
      appWidgetIds: IntArray,
      widgetData: SharedPreferences,
  ) {
    val rowsRaw = widgetData.getString("printer3d.rows", "") ?: ""
    val body = widgetData.getString("printer3d.body", "불러오는 중…") ?: ""
    val updatedAt = widgetData.getString("printer3d.updatedAt", "") ?: ""

    val printers =
        rowsRaw.splitToSequence('\n')
            .filter { it.isNotBlank() }
            .mapNotNull { line ->
              val i = line.indexOf("::")
              if (i < 0) null else line.substring(0, i) to line.substring(i + 2)
            }
            .toList()

    for (widgetId in appWidgetIds) {
      val views = RemoteViews(context.packageName, R.layout.widget_status_grid)
      views.setTextViewText(R.id.grid_icon, "🖨️")
      views.setTextViewText(R.id.grid_title, "3D 프린터")
      views.removeAllViews(R.id.grid_rows)

      if (printers.isEmpty()) {
        views.setViewVisibility(R.id.widget_body, View.VISIBLE)
        views.setTextViewText(R.id.widget_body, body)
      } else {
        views.setViewVisibility(R.id.widget_body, View.GONE)
        var index = 0
        for (pairRow in printers.chunked(2)) {
          val rowViews = RemoteViews(context.packageName, R.layout.widget_status_row)
          for ((name, status) in pairRow) {
            index++
            val cell = RemoteViews(context.packageName, R.layout.widget_status_cell)
            cell.setTextViewText(R.id.cell_badge, index.toString())
            cell.setTextViewText(R.id.cell_label, name)
            val inUse = status == "printing" || status == "done"
            cell.setImageViewResource(
                R.id.cell_image,
                if (inUse) R.drawable.bambu_x1c_color else R.drawable.bambu_x1c_gray,
            )
            cell.setViewVisibility(
                R.id.cell_x_mark,
                if (status == "maintenance") View.VISIBLE else View.GONE,
            )
            rowViews.addView(R.id.status_row, cell)
          }
          views.addView(R.id.grid_rows, rowViews)
        }
      }
      views.setTextViewText(R.id.widget_meta, updatedAt)
      applyWidgetAppearance(context, views, widgetId)

      val uri = Uri.parse("cbgpu://open/manufacturing")
      val pendingIntent = HomeWidgetLaunchIntent.getActivity(context, MainActivity::class.java, uri)
      views.setOnClickPendingIntent(R.id.widget_root, pendingIntent)

      appWidgetManager.updateAppWidget(widgetId, views)
    }
  }

  override fun onDeleted(context: Context, appWidgetIds: IntArray) {
    for (widgetId in appWidgetIds) WidgetConfigPrefs.clear(context, widgetId)
  }
}

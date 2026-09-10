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
 * Mirrors Printer3dWidgetProvider's per-item grid, one mini card per GPU
 * (numbered top-left) — same real RTX 5000 photo the web app's GPUCard.tsx
 * uses (public/img/rtx5000.jpg), full color while reachable, grayscale
 * (drawable-nodpi/rtx5000_gray.png, baked rather than a runtime filter, same
 * reasoning as the printer widget's two PNGs). Unlike the printer widget, no
 * X mark here — X specifically means "broken/needs maintenance" there, and
 * an unreachable GPU isn't necessarily broken (supabase/functions/gpu-status
 * is just an HTTP ping); grayscale alone says "not available right now"
 * without implying a fault.
 *
 * Reads "gpu_status.rows" (lib/core/home_widgets.dart, "GPU1::online" style
 * lines) — empty only if the fetch itself failed, in which case
 * "gpu_status.body" is shown as plain status text instead.
 */
class GpuStatusWidgetProvider : HomeWidgetProvider() {
  override fun onUpdate(
      context: Context,
      appWidgetManager: AppWidgetManager,
      appWidgetIds: IntArray,
      widgetData: SharedPreferences,
  ) {
    val rowsRaw = widgetData.getString("gpu_status.rows", "") ?: ""
    val body = widgetData.getString("gpu_status.body", "불러오는 중…") ?: ""
    val updatedAt = widgetData.getString("gpu_status.updatedAt", "") ?: ""

    val gpus =
        rowsRaw.splitToSequence('\n')
            .filter { it.isNotBlank() }
            .mapNotNull { line ->
              val i = line.indexOf("::")
              if (i < 0) null else line.substring(0, i) to line.substring(i + 2)
            }
            .toList()

    for (widgetId in appWidgetIds) {
      val views = RemoteViews(context.packageName, R.layout.widget_status_grid)
      views.setTextViewText(R.id.grid_icon, "🖥️")
      views.setTextViewText(R.id.grid_title, "GPU 상태")
      views.removeAllViews(R.id.grid_rows)

      if (gpus.isEmpty()) {
        views.setViewVisibility(R.id.widget_body, View.VISIBLE)
        views.setTextViewText(R.id.widget_body, body)
      } else {
        views.setViewVisibility(R.id.widget_body, View.GONE)
        var index = 0
        for (pairRow in gpus.chunked(2)) {
          val rowViews = RemoteViews(context.packageName, R.layout.widget_status_row)
          for ((label, status) in pairRow) {
            index++
            val online = status == "online"
            val cell = RemoteViews(context.packageName, R.layout.widget_status_cell)
            cell.setTextViewText(R.id.cell_badge, index.toString())
            cell.setTextViewText(R.id.cell_label, label)
            cell.setImageViewResource(
                R.id.cell_image,
                if (online) R.drawable.rtx5000_color else R.drawable.rtx5000_gray,
            )
            cell.setViewVisibility(R.id.cell_x_mark, View.GONE)
            rowViews.addView(R.id.status_row, cell)
          }
          views.addView(R.id.grid_rows, rowViews)
        }
      }
      views.setTextViewText(R.id.widget_meta, updatedAt)
      applyWidgetAppearance(context, views, widgetId)

      val uri = Uri.parse("cbgpu://open/dashboard")
      val pendingIntent = HomeWidgetLaunchIntent.getActivity(context, MainActivity::class.java, uri)
      views.setOnClickPendingIntent(R.id.widget_root, pendingIntent)

      appWidgetManager.updateAppWidget(widgetId, views)
    }
  }

  override fun onDeleted(context: Context, appWidgetIds: IntArray) {
    for (widgetId in appWidgetIds) WidgetConfigPrefs.clear(context, widgetId)
  }
}

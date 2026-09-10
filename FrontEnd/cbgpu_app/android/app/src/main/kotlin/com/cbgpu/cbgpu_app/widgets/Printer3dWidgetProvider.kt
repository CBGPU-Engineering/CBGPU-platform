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
 * Shows the same real Bambu Lab X1 Carbon photo (drawable-nodpi/bambu_x1c_*)
 * and status treatment as the web app's PrinterVisual.tsx — full color when
 * any printer's in use, grayscale otherwise, red X overlay when any is
 * flagged for maintenance. RemoteViews can't apply a runtime color filter,
 * so "grayscale" is a second baked PNG rather than a ColorMatrix.
 *
 * Reads the same "printer3d.body" text lib/core/home_widgets.dart already
 * writes for the plain-text rendering (used here for the state check by
 * substring, and shown as-is below the photo) rather than adding a second
 * structured channel just for this.
 */
class Printer3dWidgetProvider : HomeWidgetProvider() {
  override fun onUpdate(
      context: Context,
      appWidgetManager: AppWidgetManager,
      appWidgetIds: IntArray,
      widgetData: SharedPreferences,
  ) {
    val body = widgetData.getString("printer3d.body", "불러오는 중…") ?: ""
    val updatedAt = widgetData.getString("printer3d.updatedAt", "") ?: ""
    val printing = body.contains("사용중")
    val broken = body.contains("고장")

    for (widgetId in appWidgetIds) {
      val views = RemoteViews(context.packageName, R.layout.widget_printer3d)
      views.setImageViewResource(
          R.id.printer_photo,
          if (printing) R.drawable.bambu_x1c_color else R.drawable.bambu_x1c_gray,
      )
      views.setViewVisibility(R.id.printer_broken_mark, if (broken) View.VISIBLE else View.GONE)
      views.setTextViewText(R.id.widget_body, body)
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

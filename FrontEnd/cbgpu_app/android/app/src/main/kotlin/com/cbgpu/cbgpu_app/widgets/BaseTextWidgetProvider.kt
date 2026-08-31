package com.cbgpu.cbgpu_app.widgets

import android.appwidget.AppWidgetManager
import android.content.Context
import android.content.SharedPreferences
import android.net.Uri
import android.widget.RemoteViews
import com.cbgpu.cbgpu_app.MainActivity
import com.cbgpu.cbgpu_app.R
import es.antonborri.home_widget.HomeWidgetLaunchIntent
import es.antonborri.home_widget.HomeWidgetProvider

/**
 * Shared rendering for every simple "glance + tap to open a screen" widget
 * this app ships (GPU status, 3D printer queue, laser queue, meal,
 * timetable, self-study). Each subclass just names its own SharedPreferences
 * keys (written from Dart via HomeWidget.saveWidgetData — see
 * lib/core/home_widgets.dart) and the deep-link route to open on tap.
 *
 * Data is refreshed two ways: whenever the Flutter app runs in the
 * foreground (each relevant screen pushes fresh data), and periodically in
 * the background via a WorkManager task (registered in home_widgets.dart)
 * that fetches all six widgets' data in one pass and calls
 * HomeWidget.updateWidget(), which is what actually invokes onUpdate here.
 */
abstract class BaseTextWidgetProvider : HomeWidgetProvider() {
  abstract val keyPrefix: String
  abstract val icon: String
  abstract val title: String
  abstract val deepLinkPath: String

  override fun onUpdate(
      context: Context,
      appWidgetManager: AppWidgetManager,
      appWidgetIds: IntArray,
      widgetData: SharedPreferences,
  ) {
    val body = widgetData.getString("$keyPrefix.body", "불러오는 중…")
    val updatedAt = widgetData.getString("$keyPrefix.updatedAt", "")

    for (widgetId in appWidgetIds) {
      val views = RemoteViews(context.packageName, R.layout.widget_common)
      views.setTextViewText(R.id.widget_icon, icon)
      views.setTextViewText(R.id.widget_title, title)
      views.setTextViewText(R.id.widget_body, body)
      views.setTextViewText(R.id.widget_meta, updatedAt)

      val uri = Uri.parse("cbgpu://open$deepLinkPath")
      val pendingIntent = HomeWidgetLaunchIntent.getActivity(context, MainActivity::class.java, uri)
      views.setOnClickPendingIntent(R.id.widget_root, pendingIntent)

      appWidgetManager.updateAppWidget(widgetId, views)
    }
  }
}

package com.cbgpu.cbgpu_app.widgets

import android.appwidget.AppWidgetManager
import android.content.Context
import android.content.SharedPreferences
import android.net.Uri
import androidx.core.content.ContextCompat
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
      applyAppearance(context, views, widgetId)

      val uri = Uri.parse("cbgpu://open$deepLinkPath")
      val pendingIntent = HomeWidgetLaunchIntent.getActivity(context, MainActivity::class.java, uri)
      views.setOnClickPendingIntent(R.id.widget_root, pendingIntent)

      appWidgetManager.updateAppWidget(widgetId, views)
    }
  }

  override fun onDeleted(context: Context, appWidgetIds: IntArray) {
    for (widgetId in appWidgetIds) WidgetConfigPrefs.clear(context, widgetId)
  }

  /**
   * AUTO+OPAQUE (the default for every widget nobody has opened
   * WidgetConfigureActivity for) is left entirely alone here — the XML
   * layout's own @drawable/widget_background + @color/widget_*_color
   * references already do the right thing (day/night-qualified, opaque),
   * exactly as before this per-widget config feature existed. Only an
   * explicit theme or opacity choice reaches into RemoteViews to override it.
   */
  private fun applyAppearance(context: Context, views: RemoteViews, widgetId: Int) {
    val theme = WidgetConfigPrefs.theme(context, widgetId)
    val opacity = WidgetConfigPrefs.opacity(context, widgetId)
    if (theme == WidgetTheme.AUTO && opacity == WidgetOpacity.OPAQUE) return

    val backgroundRes =
        when (theme) {
          WidgetTheme.AUTO ->
              if (opacity == WidgetOpacity.TRANSLUCENT) R.drawable.widget_background_translucent
              else R.drawable.widget_background
          WidgetTheme.LIGHT ->
              if (opacity == WidgetOpacity.TRANSLUCENT) R.drawable.widget_background_light_translucent
              else R.drawable.widget_background_light_opaque
          WidgetTheme.DARK ->
              if (opacity == WidgetOpacity.TRANSLUCENT) R.drawable.widget_background_dark_translucent
              else R.drawable.widget_background_dark_opaque
        }
    views.setInt(R.id.widget_root, "setBackgroundResource", backgroundRes)

    if (theme == WidgetTheme.LIGHT) {
      views.setTextColor(R.id.widget_title, ContextCompat.getColor(context, R.color.widget_title_color_light))
      views.setTextColor(R.id.widget_body, ContextCompat.getColor(context, R.color.widget_body_color_light))
      views.setTextColor(R.id.widget_meta, ContextCompat.getColor(context, R.color.widget_meta_color_light))
    } else if (theme == WidgetTheme.DARK) {
      views.setTextColor(R.id.widget_title, ContextCompat.getColor(context, R.color.widget_title_color_dark))
      views.setTextColor(R.id.widget_body, ContextCompat.getColor(context, R.color.widget_body_color_dark))
      views.setTextColor(R.id.widget_meta, ContextCompat.getColor(context, R.color.widget_meta_color_dark))
    }
  }
}

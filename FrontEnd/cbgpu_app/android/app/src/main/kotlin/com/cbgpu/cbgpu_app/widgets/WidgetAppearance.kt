package com.cbgpu.cbgpu_app.widgets

import android.content.Context
import android.widget.RemoteViews
import androidx.core.content.ContextCompat
import com.cbgpu.cbgpu_app.R

/**
 * Shared by every widget layout (widget_common, widget_status_grid,
 * widget_timetable) — they all use the same @id/widget_root,
 * @id/widget_title, @id/widget_body and @id/widget_meta names for the parts
 * this touches. RemoteViews silently no-ops a setter for an id that isn't
 * actually present in the inflated layout, so it's safe to call this even
 * from a layout missing one of those.
 *
 * AUTO+100 (the default for every widget nobody has opened
 * WidgetConfigureActivity for) is left entirely alone — each layout's own
 * @drawable/widget_background + @color/widget_*_color references already do
 * the right thing (day/night-qualified, opaque). Only an explicit theme or
 * a non-100 opacity reaches into RemoteViews to override it.
 */
fun applyWidgetAppearance(context: Context, views: RemoteViews, widgetId: Int) {
  val theme = WidgetConfigPrefs.theme(context, widgetId)
  val opacity = WidgetConfigPrefs.opacity(context, widgetId)
  if (theme == WidgetTheme.AUTO && opacity == 100) return

  views.setInt(R.id.widget_root, "setBackgroundResource", backgroundResFor(theme, opacity))

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

/** Every (theme, opacity) combination is a real, compile-checked drawable — see the widget_background*.xml family. */
fun backgroundResFor(theme: WidgetTheme, opacity: Int): Int =
    when (theme) {
      WidgetTheme.AUTO ->
          when (opacity) {
            80 -> R.drawable.widget_background_a80
            60 -> R.drawable.widget_background_a60
            40 -> R.drawable.widget_background_a40
            20 -> R.drawable.widget_background_a20
            else -> R.drawable.widget_background
          }
      WidgetTheme.LIGHT ->
          when (opacity) {
            80 -> R.drawable.widget_background_light_a80
            60 -> R.drawable.widget_background_light_a60
            40 -> R.drawable.widget_background_light_a40
            20 -> R.drawable.widget_background_light_a20
            else -> R.drawable.widget_background_light_opaque
          }
      WidgetTheme.DARK ->
          when (opacity) {
            80 -> R.drawable.widget_background_dark_a80
            60 -> R.drawable.widget_background_dark_a60
            40 -> R.drawable.widget_background_dark_a40
            20 -> R.drawable.widget_background_dark_a20
            else -> R.drawable.widget_background_dark_opaque
          }
    }

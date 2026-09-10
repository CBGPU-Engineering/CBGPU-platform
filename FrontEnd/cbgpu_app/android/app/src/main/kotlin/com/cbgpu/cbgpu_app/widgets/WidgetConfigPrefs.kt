package com.cbgpu.cbgpu_app.widgets

import android.content.Context

/** "자동"/"라이트"/"다크" — matches the three choices in WidgetConfigureActivity. */
enum class WidgetTheme { AUTO, LIGHT, DARK }

/** One of the 5 baked opacity levels — see the widget_background*_a{N}.xml drawables. */
val OPACITY_LEVELS = listOf(100, 80, 60, 40, 20)

/**
 * Per-widget-instance appearance settings, set from WidgetConfigureActivity
 * when a widget is placed (or re-opened via its long-press menu) and read by
 * applyWidgetAppearance() on every render. Untouched widgets (the common
 * case) resolve to AUTO/100, which is deliberately the exact rendering this
 * app always had — see WidgetAppearance.kt for why that combination skips
 * the RemoteViews overrides entirely.
 */
object WidgetConfigPrefs {
  private const val PREFS_NAME = "widget_config"

  private fun prefs(context: Context) = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

  fun theme(context: Context, appWidgetId: Int): WidgetTheme =
      when (prefs(context).getString("theme_$appWidgetId", null)) {
        "light" -> WidgetTheme.LIGHT
        "dark" -> WidgetTheme.DARK
        else -> WidgetTheme.AUTO
      }

  /** Nearest supported level to whatever was last saved (defaults to fully opaque). */
  fun opacity(context: Context, appWidgetId: Int): Int {
    val saved = prefs(context).getInt("opacity_$appWidgetId", 100)
    return OPACITY_LEVELS.minByOrNull { kotlin.math.abs(it - saved) } ?: 100
  }

  fun save(context: Context, appWidgetId: Int, theme: WidgetTheme, opacityPercent: Int) {
    prefs(context).edit()
        .putString(
            "theme_$appWidgetId",
            when (theme) {
              WidgetTheme.LIGHT -> "light"
              WidgetTheme.DARK -> "dark"
              WidgetTheme.AUTO -> "auto"
            },
        )
        .putInt("opacity_$appWidgetId", opacityPercent)
        .apply()
  }

  fun clear(context: Context, appWidgetId: Int) {
    prefs(context).edit().remove("theme_$appWidgetId").remove("opacity_$appWidgetId").apply()
  }
}

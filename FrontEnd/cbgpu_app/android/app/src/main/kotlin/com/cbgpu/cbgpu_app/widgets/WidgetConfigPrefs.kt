package com.cbgpu.cbgpu_app.widgets

import android.content.Context

/** "자동"/"라이트"/"다크" — matches the three choices in WidgetConfigureActivity. */
enum class WidgetTheme { AUTO, LIGHT, DARK }

/** "불투명"/"반투명". */
enum class WidgetOpacity { OPAQUE, TRANSLUCENT }

/**
 * Per-widget-instance appearance settings, set from WidgetConfigureActivity
 * when a widget is placed (or re-opened via its long-press menu) and read by
 * BaseTextWidgetProvider on every render. Untouched widgets (the common
 * case) resolve to AUTO/OPAQUE, which is deliberately the exact rendering
 * this app always had — see BaseTextWidgetProvider for why that combination
 * skips these overrides entirely rather than resolving to equivalent-looking
 * resources.
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

  fun opacity(context: Context, appWidgetId: Int): WidgetOpacity =
      when (prefs(context).getString("opacity_$appWidgetId", null)) {
        "translucent" -> WidgetOpacity.TRANSLUCENT
        else -> WidgetOpacity.OPAQUE
      }

  fun save(context: Context, appWidgetId: Int, theme: WidgetTheme, opacity: WidgetOpacity) {
    prefs(context).edit()
        .putString(
            "theme_$appWidgetId",
            when (theme) {
              WidgetTheme.LIGHT -> "light"
              WidgetTheme.DARK -> "dark"
              WidgetTheme.AUTO -> "auto"
            },
        )
        .putString(
            "opacity_$appWidgetId",
            when (opacity) {
              WidgetOpacity.TRANSLUCENT -> "translucent"
              WidgetOpacity.OPAQUE -> "opaque"
            },
        )
        .apply()
  }

  fun clear(context: Context, appWidgetId: Int) {
    prefs(context).edit().remove("theme_$appWidgetId").remove("opacity_$appWidgetId").apply()
  }
}

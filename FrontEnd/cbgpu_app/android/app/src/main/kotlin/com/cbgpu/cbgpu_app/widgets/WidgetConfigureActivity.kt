package com.cbgpu.cbgpu_app.widgets

import android.app.Activity
import android.appwidget.AppWidgetManager
import android.content.Intent
import android.os.Bundle
import android.widget.RadioGroup
import com.cbgpu.cbgpu_app.R

/**
 * Shown once when any of the six widgets in this package is placed (wired up
 * via android:configure in each widget-info XML under res/xml) — lets the user
 * pick a theme/opacity for that one widget instance before it's committed,
 * saved via WidgetConfigPrefs and read back by BaseTextWidgetProvider on
 * every render. Not tied to any specific widget type: the result broadcast
 * below re-triggers whichever provider actually owns this widget ID.
 */
class WidgetConfigureActivity : Activity() {
  private var appWidgetId = AppWidgetManager.INVALID_APPWIDGET_ID

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    setResult(RESULT_CANCELED)
    setContentView(R.layout.widget_configure_activity)

    appWidgetId =
        intent?.extras?.getInt(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID)
            ?: AppWidgetManager.INVALID_APPWIDGET_ID
    if (appWidgetId == AppWidgetManager.INVALID_APPWIDGET_ID) {
      finish()
      return
    }

    val themeGroup = findViewById<RadioGroup>(R.id.theme_group)
    val opacityGroup = findViewById<RadioGroup>(R.id.opacity_group)

    when (WidgetConfigPrefs.theme(this, appWidgetId)) {
      WidgetTheme.LIGHT -> themeGroup.check(R.id.theme_light)
      WidgetTheme.DARK -> themeGroup.check(R.id.theme_dark)
      WidgetTheme.AUTO -> themeGroup.check(R.id.theme_auto)
    }
    when (WidgetConfigPrefs.opacity(this, appWidgetId)) {
      WidgetOpacity.TRANSLUCENT -> opacityGroup.check(R.id.opacity_translucent)
      WidgetOpacity.OPAQUE -> opacityGroup.check(R.id.opacity_opaque)
    }

    findViewById<android.widget.Button>(R.id.confirm_button).setOnClickListener {
      val theme =
          when (themeGroup.checkedRadioButtonId) {
            R.id.theme_light -> WidgetTheme.LIGHT
            R.id.theme_dark -> WidgetTheme.DARK
            else -> WidgetTheme.AUTO
          }
      val opacity =
          if (opacityGroup.checkedRadioButtonId == R.id.opacity_translucent) WidgetOpacity.TRANSLUCENT
          else WidgetOpacity.OPAQUE
      WidgetConfigPrefs.save(this, appWidgetId, theme, opacity)
      requestRedraw()

      val result = Intent().putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId)
      setResult(RESULT_OK, result)
      finish()
    }
  }

  /**
   * Broadcasts a normal widget-update request scoped to this one ID, aimed
   * at whichever provider component the widget host says actually owns it —
   * this activity is shared by all six widget types, so it can't just call
   * one provider's onUpdate() directly.
   */
  private fun requestRedraw() {
    val manager = AppWidgetManager.getInstance(this)
    val provider = manager.getAppWidgetInfo(appWidgetId)?.provider ?: return
    val intent =
        Intent(AppWidgetManager.ACTION_APPWIDGET_UPDATE).apply {
          component = provider
          putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, intArrayOf(appWidgetId))
        }
    sendBroadcast(intent)
  }
}

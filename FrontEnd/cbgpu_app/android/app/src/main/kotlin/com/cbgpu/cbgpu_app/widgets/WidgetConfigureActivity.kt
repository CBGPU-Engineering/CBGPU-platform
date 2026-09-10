package com.cbgpu.cbgpu_app.widgets

import android.app.Activity
import android.appwidget.AppWidgetManager
import android.content.Intent
import android.os.Bundle
import android.widget.RadioGroup
import android.widget.SeekBar
import android.widget.TextView
import androidx.core.content.ContextCompat
import com.cbgpu.cbgpu_app.R

/**
 * Shown once when any of the six widgets in this package is placed (wired up
 * via android:configure in each widget-info XML under res/xml) — lets the user
 * pick a theme/opacity for that one widget instance before it's committed,
 * saved via WidgetConfigPrefs and read back by applyWidgetAppearance() on
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
    val opacitySeekBar = findViewById<SeekBar>(R.id.opacity_seekbar)

    when (WidgetConfigPrefs.theme(this, appWidgetId)) {
      WidgetTheme.LIGHT -> themeGroup.check(R.id.theme_light)
      WidgetTheme.DARK -> themeGroup.check(R.id.theme_dark)
      WidgetTheme.AUTO -> themeGroup.check(R.id.theme_auto)
    }
    opacitySeekBar.progress = OPACITY_LEVELS.indexOf(WidgetConfigPrefs.opacity(this, appWidgetId)).coerceAtLeast(0)

    updatePreview()
    themeGroup.setOnCheckedChangeListener { _, _ -> updatePreview() }
    opacitySeekBar.setOnSeekBarChangeListener(
        object : SeekBar.OnSeekBarChangeListener {
          override fun onProgressChanged(seekBar: SeekBar?, progress: Int, fromUser: Boolean) = updatePreview()
          override fun onStartTrackingTouch(seekBar: SeekBar?) {}
          override fun onStopTrackingTouch(seekBar: SeekBar?) {}
        },
    )

    findViewById<android.widget.Button>(R.id.confirm_button).setOnClickListener {
      WidgetConfigPrefs.save(this, appWidgetId, selectedTheme(), selectedOpacity())
      requestRedraw()

      val result = Intent().putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId)
      setResult(RESULT_OK, result)
      finish()
    }
  }

  private fun selectedTheme(): WidgetTheme =
      when (findViewById<RadioGroup>(R.id.theme_group).checkedRadioButtonId) {
        R.id.theme_light -> WidgetTheme.LIGHT
        R.id.theme_dark -> WidgetTheme.DARK
        else -> WidgetTheme.AUTO
      }

  private fun selectedOpacity(): Int =
      OPACITY_LEVELS[findViewById<SeekBar>(R.id.opacity_seekbar).progress.coerceIn(0, OPACITY_LEVELS.lastIndex)]

  /** Mirrors applyWidgetAppearance's own resource picking, against the local preview card. */
  private fun updatePreview() {
    val theme = selectedTheme()
    val opacity = selectedOpacity()
    findViewById<android.view.View>(R.id.preview_card).setBackgroundResource(backgroundResFor(theme, opacity))
    findViewById<TextView>(R.id.opacity_value_label).text = "$opacity%"

    val bodyColorRes =
        when (theme) {
          WidgetTheme.LIGHT -> R.color.widget_body_color_light
          WidgetTheme.DARK -> R.color.widget_body_color_dark
          WidgetTheme.AUTO -> R.color.widget_body_color
        }
    findViewById<TextView>(R.id.preview_body).setTextColor(ContextCompat.getColor(this, bodyColorRes))
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

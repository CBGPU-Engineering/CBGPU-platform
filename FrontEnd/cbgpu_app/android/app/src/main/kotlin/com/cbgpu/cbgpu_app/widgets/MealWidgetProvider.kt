package com.cbgpu.cbgpu_app.widgets

class MealWidgetProvider : BaseTextWidgetProvider() {
  override val keyPrefix = "meal"
  override val icon = "🍚"
  override val title = "오늘 급식"
  override val deepLinkPath = "/meal"
}

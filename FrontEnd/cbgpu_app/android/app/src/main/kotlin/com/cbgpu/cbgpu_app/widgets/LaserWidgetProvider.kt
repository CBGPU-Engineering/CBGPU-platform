package com.cbgpu.cbgpu_app.widgets

class LaserWidgetProvider : BaseTextWidgetProvider() {
  override val keyPrefix = "laser"
  override val icon = "✂️"
  override val title = "레이저 커팅"
  override val deepLinkPath = "/manufacturing"
}

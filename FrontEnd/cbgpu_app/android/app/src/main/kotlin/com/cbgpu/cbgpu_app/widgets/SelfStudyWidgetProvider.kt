package com.cbgpu.cbgpu_app.widgets

class SelfStudyWidgetProvider : BaseTextWidgetProvider() {
  override val keyPrefix = "selfstudy"
  override val icon = "📖"
  override val title = "자습신청"
  override val deepLinkPath = "/study"
}

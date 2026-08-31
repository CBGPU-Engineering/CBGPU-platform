package com.cbgpu.cbgpu_app.widgets

class GpuStatusWidgetProvider : BaseTextWidgetProvider() {
  override val keyPrefix = "gpu_status"
  override val icon = "🖥️"
  override val title = "GPU 상태"
  override val deepLinkPath = "/dashboard"
}

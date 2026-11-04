/// Backend endpoints used by native screens. These Supabase Edge Functions
/// share the app's authentication and data backend. The WebView shell loads
/// the mobile workspace at https://app.cbgpu.com.
class ApiConfig {
  static const functionsUrl = 'https://cbgpu.com/backend/functions/v1';
}

/// Redirect user-facing desktop URLs to the mobile workspace.
/// API fetches are unaffected: this policy is used only for top-level navigation.
Uri? appNavigationTarget(Uri uri) {
  if (uri.scheme != 'https' && uri.scheme != 'http') return null;
  final host = uri.host.toLowerCase().replaceFirst(RegExp(r'\.$'), '');
  const modes = {
    'student.cbgpu.com': 'student',
    'researcher.cbgpu.com': 'researcher',
    'developer.cbgpu.com': 'researcher',
  };
  final desktop =
      host == 'cbgpu.com' || host == 'www.cbgpu.com' || modes.containsKey(host);
  final repairApp =
      host == 'app.cbgpu.com' &&
      (uri.scheme != 'https' || uri.port != 443 || uri.userInfo.isNotEmpty);
  if (!desktop && !repairApp) return null;
  final query = <String, dynamic>{...uri.queryParametersAll};
  if (modes.containsKey(host)) query['mode'] = modes[host];
  return Uri(
    scheme: 'https',
    host: 'app.cbgpu.com',
    path: uri.path == '/workspace' ? '/' : uri.path,
    queryParameters: query.isEmpty ? null : query,
    fragment: uri.fragment.isEmpty ? null : uri.fragment,
  );
}

/// Owned services can stay in the WebView; they do not receive the native bridge.
bool isInAppWebNavigation(Uri uri) {
  if (uri.scheme != 'https' || uri.userInfo.isNotEmpty || uri.port != 443) {
    return false;
  }
  final host = uri.host.toLowerCase().replaceFirst(RegExp(r'\.$'), '');
  const services = {
    'app.cbgpu.com',
    'docs.cbgpu.com',
    'arxiv.cbgpu.com',
    'latex.cbgpu.com',
    'gpu.cbgpu.com',
    'print.cbgpu.com',
    'laser.cbgpu.com',
    'manufacturing.cbgpu.com',
    'admin.cbgpu.com',
    'developers.cbgpu.com',
  };
  return services.contains(host) ||
      RegExp(
        r'^[a-z0-9][a-z0-9-]*\.(front|server)\.cbgpu\.com$',
      ).hasMatch(host);
}

bool isNativeBridgeOrigin(Uri uri) =>
    uri.scheme == 'https' &&
    uri.host == 'app.cbgpu.com' &&
    uri.port == 443 &&
    uri.userInfo.isEmpty;

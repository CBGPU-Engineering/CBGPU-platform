import 'dart:convert';

bool isEdusetLoginOrigin(Uri uri) =>
    uri.scheme == 'https' &&
    uri.host == 'cbsh.edu-set.com' &&
    uri.port == 443 &&
    uri.userInfo.isEmpty;

/// Candidate format only. CBGPU verifies this session with EduSet before saving.
String? edusetSessionCandidate(Object result, DateTime now) {
  if (result is! String || result.length > 16384) return null;
  var token = result;
  try {
    if (token.startsWith('"')) {
      final decoded = jsonDecode(token);
      if (decoded is! String) return null;
      token = decoded;
    }
    if (token.isEmpty || token.length > 8192) return null;
    final parts = token.split('.');
    if (parts.length != 3 || parts.any((part) => part.isEmpty)) return null;
    final claims = jsonDecode(
      utf8.decode(base64Url.decode(base64Url.normalize(parts[1]))),
    );
    final subject = claims['userId'];
    final expires = claims['exp'];
    if (subject is! String && subject is! int) return null;
    if (!RegExp(r'^[A-Za-z0-9_-]{1,100}$').hasMatch('$subject')) return null;
    if (expires is! num ||
        !expires.isFinite ||
        expires * 1000 <= now.millisecondsSinceEpoch + 30000)
      return null;
    return token;
  } catch (_) {
    return null;
  }
}

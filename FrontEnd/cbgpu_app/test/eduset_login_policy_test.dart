import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:cbgpu_app/core/eduset_login_policy.dart';

void main() {
  test('Only the exact HTTPS school origin may provide a session', () {
    expect(
      isEdusetLoginOrigin(Uri.parse('https://cbsh.edu-set.com/signin')),
      isTrue,
    );
    for (final url in [
      'http://cbsh.edu-set.com/',
      'https://cbsh.edu-set.com.evil.invalid/',
      'https://evil.invalid/',
      'https://user@cbsh.edu-set.com/',
      'https://cbsh.edu-set.com:8443/',
    ]) {
      expect(isEdusetLoginOrigin(Uri.parse(url)), isFalse, reason: url);
    }
  });
  test(
    'Handles platform JS results, expiry and malformed candidates without granting auth',
    () {
      final now = DateTime.utc(2026, 11, 3);
      String token(Object payload) =>
          'header.${base64Url.encode(utf8.encode(jsonEncode(payload))).replaceAll('=', '')}.signature';
      final valid = token({
        'userId': 'school-student',
        'exp': now.millisecondsSinceEpoch ~/ 1000 + 3600,
      });
      expect(edusetSessionCandidate(valid, now), valid);
      expect(edusetSessionCandidate(jsonEncode(valid), now), valid);
      expect(
        edusetSessionCandidate(
          token({
            'userId': 'school-student',
            'exp': now.millisecondsSinceEpoch ~/ 1000,
          }),
          now,
        ),
        isNull,
      );
      expect(
        edusetSessionCandidate(
          token({'userId': '../other', 'exp': 9999999999}),
          now,
        ),
        isNull,
      );
      for (final value in ['', 'null', '{}', 'a.b.c', 'x' * 9000]) {
        expect(edusetSessionCandidate(value, now), isNull);
      }
    },
  );
}

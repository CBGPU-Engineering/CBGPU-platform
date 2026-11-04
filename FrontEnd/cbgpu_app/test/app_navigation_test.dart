import 'package:flutter_test/flutter_test.dart';
import 'package:cbgpu_app/core/app_navigation.dart';

void main() {
  test(
    'Owned services stay inside the app without receiving the native bridge',
    () {
      for (final host in [
        'docs.cbgpu.com',
        'arxiv.cbgpu.com',
        'gpu.cbgpu.com',
        'latex.cbgpu.com',
        'laser.cbgpu.com',
        'print.cbgpu.com',
        'project.front.cbgpu.com',
        'project.server.cbgpu.com',
      ]) {
        final uri = Uri.parse('https://$host/');
        expect(isInAppWebNavigation(uri), true);
        expect(isNativeBridgeOrigin(uri), false);
      }
      expect(
        isNativeBridgeOrigin(Uri.parse('https://app.cbgpu.com/profile')),
        true,
      );
      for (final url in [
        'https://app.cbgpu.com.evil.org/',
        'https://unknown.cbgpu.com/',
        'https://example.org/',
        'http://app.cbgpu.com/',
        'https://app.cbgpu.com:8443/',
        'https://name:password@app.cbgpu.com/',
      ]) {
        expect(isInAppWebNavigation(Uri.parse(url)), false);
        expect(isNativeBridgeOrigin(Uri.parse(url)), false);
      }
    },
  );
  test(
    'Desktop modes always return to app while retaining route, query and fragment',
    () {
      for (final entry in {
        'student': 'student',
        'researcher': 'researcher',
        'developer': 'researcher',
      }.entries) {
        final target = appNavigationTarget(
          Uri.parse('https://${entry.key}.cbgpu.com/materials?a=1&a=2#files'),
        )!;
        expect(target.host, 'app.cbgpu.com');
        expect(target.queryParameters['mode'], entry.value);
        expect(target.path, '/materials');
        expect(target.queryParametersAll['a'], ['1', '2']);
        expect(target.fragment, 'files');
      }
    },
  );
  test('Main website and www cannot open the desktop launcher', () {
    for (final host in ['cbgpu.com', 'www.cbgpu.com', 'cbgpu.com.']) {
      final target = appNavigationTarget(
        Uri.parse('http://$host/?mode=researcher'),
      )!;
      expect(target.scheme, 'https');
      expect(target.host, 'app.cbgpu.com');
      expect(target.queryParameters['mode'], 'researcher');
    }
  });
  test(
    'Specialist services stay distinct and external links are not rewritten',
    () {
      for (final host in [
        'latex.cbgpu.com',
        'docs.cbgpu.com',
        'arxiv.cbgpu.com',
        'gpu.cbgpu.com',
        'print.cbgpu.com',
        'laser.cbgpu.com',
        'developers.cbgpu.com',
        'example.org',
      ]) {
        expect(appNavigationTarget(Uri.parse('https://$host/')), null);
      }
      expect(
        appNavigationTarget(Uri.parse('https://app.cbgpu.com/?mode=developer')),
        null,
      );
    },
  );
  test(
    'Malformed app authority is repaired without keeping embedded credentials',
    () {
      final target = appNavigationTarget(
        Uri.parse('http://someone:password@app.cbgpu.com:8080/profile'),
      )!;
      expect(target.scheme, 'https');
      expect(target.host, 'app.cbgpu.com');
      expect(target.port, 443);
      expect(target.userInfo, '');
    },
  );
}

import 'package:cbgpu_app/core/theme.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('global elevated buttons never request infinite row width', () {
    for (final theme in [AppTheme.light(), AppTheme.dark()]) {
      final minimumSize = theme.elevatedButtonTheme.style?.minimumSize?.resolve(
        const <WidgetState>{},
      );
      expect(minimumSize, isNotNull);
      expect(minimumSize!.width.isFinite, isTrue);
    }
  });
}

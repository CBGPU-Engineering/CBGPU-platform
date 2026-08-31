import 'dart:convert';
import 'dart:typed_data';

import 'package:cbgpu_app/core/svg_converter.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('converts SVG primitives and paths into DXF polylines', () {
    const svg =
        '<svg xmlns="http://www.w3.org/2000/svg"><rect x="1" y="2" width="3" height="4"/><path d="M0 0 L10 0 L10 10 Z"/></svg>';
    final dxf = utf8.decode(
      convertSvgToDxf(Uint8List.fromList(utf8.encode(svg))),
    );
    expect(RegExp('LWPOLYLINE').allMatches(dxf).length, 2);
    expect(dxf, contains('10\n1.0\n20\n-2.0'));
    expect(dxf, endsWith('0\nENDSEC\n0\nEOF\n'));
  });
}

import 'dart:convert';
import 'dart:math' as math;
import 'dart:typed_data';

import 'package:path_parsing/path_parsing.dart';
import 'package:xml/xml.dart';

typedef _Point = (double, double);

/// Converts SVG geometry to the same polyline-only DXF representation used by
/// the React app. Curves are sampled locally, so no source drawing is uploaded
/// to a third-party conversion service.
Uint8List convertSvgToDxf(Uint8List source) {
  final document = XmlDocument.parse(utf8.decode(source));
  final polylines = <List<_Point>>[];
  for (final element in document.descendants.whereType<XmlElement>()) {
    switch (element.localName.toLowerCase()) {
      case 'path':
        final data = element.getAttribute('d');
        if (data != null && data.trim().isNotEmpty) {
          final collector = _PathCollector();
          writeSvgPathDataToPath(data, collector);
          polylines.addAll(collector.paths.where((p) => p.length > 1));
        }
      case 'line':
        polylines.add([
          (_n(element, 'x1'), _n(element, 'y1')),
          (_n(element, 'x2'), _n(element, 'y2')),
        ]);
      case 'rect':
        final x = _n(element, 'x');
        final y = _n(element, 'y');
        final w = _n(element, 'width');
        final h = _n(element, 'height');
        if (w > 0 && h > 0) {
          polylines.add([
            (x, y),
            (x + w, y),
            (x + w, y + h),
            (x, y + h),
            (x, y),
          ]);
        }
      case 'circle':
        _ellipse(
          polylines,
          _n(element, 'cx'),
          _n(element, 'cy'),
          _n(element, 'r'),
          _n(element, 'r'),
        );
      case 'ellipse':
        _ellipse(
          polylines,
          _n(element, 'cx'),
          _n(element, 'cy'),
          _n(element, 'rx'),
          _n(element, 'ry'),
        );
      case 'polyline' || 'polygon':
        final values = RegExp(r'[-+]?(?:\d*\.)?\d+(?:[eE][-+]?\d+)?')
            .allMatches(element.getAttribute('points') ?? '')
            .map((m) => double.parse(m.group(0)!))
            .toList();
        final points = <_Point>[
          for (var i = 0; i + 1 < values.length; i += 2)
            (values[i], values[i + 1]),
        ];
        if (element.localName.toLowerCase() == 'polygon' && points.isNotEmpty) {
          points.add(points.first);
        }
        if (points.length > 1) polylines.add(points);
    }
  }
  if (polylines.isEmpty) {
    throw const FormatException('SVG에서 변환 가능한 도형을 찾지 못했습니다.');
  }

  final entities = polylines.map((points) {
    final coordinates = points.map((p) => '10\n${p.$1}\n20\n${-p.$2}\n').join();
    return '0\nLWPOLYLINE\n8\n0\n90\n${points.length}\n70\n0\n$coordinates';
  }).join();
  return Uint8List.fromList(
    utf8.encode('0\nSECTION\n2\nENTITIES\n${entities}0\nENDSEC\n0\nEOF\n'),
  );
}

double _n(XmlElement element, String name) =>
    double.tryParse(element.getAttribute(name) ?? '') ?? 0;

void _ellipse(
  List<List<_Point>> output,
  double cx,
  double cy,
  double rx,
  double ry,
) {
  if (rx <= 0 || ry <= 0) return;
  output.add([
    for (var i = 0; i <= 72; i++)
      (
        cx + rx * math.cos(math.pi * 2 * i / 72),
        cy + ry * math.sin(math.pi * 2 * i / 72),
      ),
  ]);
}

class _PathCollector extends PathProxy {
  final paths = <List<_Point>>[];
  List<_Point>? _current;
  _Point _point = (0, 0);
  _Point _start = (0, 0);

  @override
  void moveTo(double x, double y) {
    _current = <_Point>[(x, y)];
    paths.add(_current!);
    _point = (x, y);
    _start = _point;
  }

  @override
  void lineTo(double x, double y) {
    _ensurePath();
    _current!.add((x, y));
    _point = (x, y);
  }

  @override
  void cubicTo(
    double x1,
    double y1,
    double x2,
    double y2,
    double x3,
    double y3,
  ) {
    _ensurePath();
    final p0 = _point;
    for (var i = 1; i <= 24; i++) {
      final t = i / 24;
      final u = 1 - t;
      _current!.add((
        u * u * u * p0.$1 +
            3 * u * u * t * x1 +
            3 * u * t * t * x2 +
            t * t * t * x3,
        u * u * u * p0.$2 +
            3 * u * u * t * y1 +
            3 * u * t * t * y2 +
            t * t * t * y3,
      ));
    }
    _point = (x3, y3);
  }

  @override
  void close() {
    _ensurePath();
    if (_current!.last != _start) _current!.add(_start);
    _point = _start;
  }

  void _ensurePath() {
    if (_current != null) return;
    moveTo(_point.$1, _point.$2);
  }
}

import 'dart:convert';
import 'dart:math' as math;

import 'package:archive/archive.dart';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:xml/xml.dart';

class DxfPreviewCard extends StatelessWidget {
  const DxfPreviewCard({super.key, required this.url});
  final String url;

  @override
  Widget build(BuildContext context) => _PreviewFrame(
    label: 'DXF PREVIEW',
    loader: () async => _DxfPainter.parse(
      utf8.decode(
        (await http.get(Uri.parse(url))).bodyBytes,
        allowMalformed: true,
      ),
    ),
  );
}

class Model3mfPreviewCard extends StatelessWidget {
  const Model3mfPreviewCard({super.key, required this.url});
  final String url;

  @override
  Widget build(BuildContext context) => _PreviewFrame(
    label: '3MF PREVIEW',
    loader: () async =>
        _ModelPainter.parse((await http.get(Uri.parse(url))).bodyBytes),
  );
}

class _PreviewFrame extends StatefulWidget {
  const _PreviewFrame({required this.label, required this.loader});
  final String label;
  final Future<CustomPainter> Function() loader;

  @override
  State<_PreviewFrame> createState() => _PreviewFrameState();
}

class _PreviewFrameState extends State<_PreviewFrame> {
  late final Future<CustomPainter> _preview = widget.loader();

  @override
  Widget build(BuildContext context) => Container(
    height: 340,
    margin: const EdgeInsets.only(bottom: 16),
    decoration: BoxDecoration(
      color: Theme.of(context).colorScheme.surface.withValues(alpha: 0.65),
      border: Border.all(color: Theme.of(context).dividerColor),
      borderRadius: BorderRadius.circular(16),
    ),
    clipBehavior: Clip.antiAlias,
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(14, 10, 14, 8),
          child: Text(
            widget.label,
            style: const TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.w900,
              letterSpacing: 1.2,
              color: Colors.grey,
            ),
          ),
        ),
        const Divider(height: 1),
        Expanded(
          child: FutureBuilder<CustomPainter>(
            future: _preview,
            builder: (context, snapshot) {
              if (snapshot.connectionState != ConnectionState.done) {
                return const Center(child: CircularProgressIndicator());
              }
              if (snapshot.hasError) {
                return Center(
                  child: Text(
                    '미리보기를 불러오지 못했습니다.\n${snapshot.error}',
                    textAlign: TextAlign.center,
                    style: const TextStyle(fontSize: 11, color: Colors.grey),
                  ),
                );
              }
              return InteractiveViewer(
                minScale: 0.5,
                maxScale: 8,
                child: SizedBox.expand(
                  child: CustomPaint(painter: snapshot.data),
                ),
              );
            },
          ),
        ),
      ],
    ),
  );
}

typedef _P2 = (double, double);

class _DxfPainter extends CustomPainter {
  _DxfPainter(this.paths);
  final List<List<_P2>> paths;

  static _DxfPainter parse(String dxf) {
    final lines = const LineSplitter().convert(dxf);
    final paths = <List<_P2>>[];
    List<_P2>? current;
    double? x;
    for (var i = 0; i + 1 < lines.length; i += 2) {
      final code = lines[i].trim();
      final value = lines[i + 1].trim();
      if (code == '0') {
        if (current != null && current.length > 1) paths.add(current);
        current = {'LWPOLYLINE', 'POLYLINE', 'LINE'}.contains(value)
            ? <_P2>[]
            : null;
      } else if (current != null && code == '10') {
        x = double.tryParse(value);
      } else if (current != null && code == '20' && x != null) {
        final y = double.tryParse(value);
        if (y != null) current.add((x, y));
        x = null;
      }
    }
    if (current != null && current.length > 1) paths.add(current);
    if (paths.isEmpty) throw const FormatException('표시 가능한 DXF 선을 찾지 못했습니다.');
    return _DxfPainter(paths);
  }

  @override
  void paint(Canvas canvas, Size size) =>
      _paintPaths(canvas, size, paths, const Color(0xFF0082E6));

  @override
  bool shouldRepaint(covariant _DxfPainter oldDelegate) => false;
}

class _ModelPainter extends CustomPainter {
  _ModelPainter(this.paths);
  final List<List<_P2>> paths;

  static _ModelPainter parse(List<int> bytes) {
    final archive = ZipDecoder().decodeBytes(bytes);
    final model = archive.findFile('3D/3dmodel.model');
    if (model == null) throw const FormatException('3MF 모델 데이터를 찾지 못했습니다.');
    final xml = XmlDocument.parse(utf8.decode(model.content as List<int>));
    final vertices = xml.findAllElements('vertex').map((v) {
      final x = double.parse(v.getAttribute('x')!);
      final y = double.parse(v.getAttribute('y')!);
      final z = double.parse(v.getAttribute('z')!);
      return (x - y, (x + y) * 0.45 - z);
    }).toList();
    final paths = <List<_P2>>[];
    for (final triangle in xml.findAllElements('triangle').take(6000)) {
      final a = int.parse(triangle.getAttribute('v1')!);
      final b = int.parse(triangle.getAttribute('v2')!);
      final c = int.parse(triangle.getAttribute('v3')!);
      if (a < vertices.length && b < vertices.length && c < vertices.length) {
        paths.add([vertices[a], vertices[b], vertices[c], vertices[a]]);
      }
    }
    if (paths.isEmpty) throw const FormatException('표시 가능한 3MF 메시를 찾지 못했습니다.');
    return _ModelPainter(paths);
  }

  @override
  void paint(Canvas canvas, Size size) =>
      _paintPaths(canvas, size, paths, const Color(0xFF34D399));

  @override
  bool shouldRepaint(covariant _ModelPainter oldDelegate) => false;
}

void _paintPaths(Canvas canvas, Size size, List<List<_P2>> paths, Color color) {
  final points = paths.expand((p) => p);
  var minX = double.infinity,
      minY = double.infinity,
      maxX = -double.infinity,
      maxY = -double.infinity;
  for (final p in points) {
    minX = math.min(minX, p.$1);
    minY = math.min(minY, p.$2);
    maxX = math.max(maxX, p.$1);
    maxY = math.max(maxY, p.$2);
  }
  final scale = math.min(
    (size.width - 32) / math.max(maxX - minX, 1),
    (size.height - 32) / math.max(maxY - minY, 1),
  );
  final dx = (size.width - (maxX - minX) * scale) / 2 - minX * scale;
  final dy = (size.height - (maxY - minY) * scale) / 2 - minY * scale;
  final paint = Paint()
    ..color = color.withValues(alpha: 0.72)
    ..style = PaintingStyle.stroke
    ..strokeWidth = 1;
  for (final line in paths) {
    final path = Path()
      ..moveTo(line.first.$1 * scale + dx, line.first.$2 * scale + dy);
    for (final p in line.skip(1)) {
      path.lineTo(p.$1 * scale + dx, p.$2 * scale + dy);
    }
    canvas.drawPath(path, paint);
  }
}

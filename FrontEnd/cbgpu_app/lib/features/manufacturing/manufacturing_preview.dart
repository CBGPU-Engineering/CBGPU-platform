import 'dart:convert';
import 'dart:math' as math;
import 'dart:typed_data';
import 'dart:ui' show Vertices, VertexMode;

import 'package:archive/archive.dart';
import 'package:flutter/foundation.dart' show compute;
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
    loader: () async {
      final bytes = (await http.get(Uri.parse(url))).bodyBytes;
      // The web viewer renders via WebGL (Three.js), which is GPU-accelerated
      // and never touches the main JS thread for the heavy work. This parser
      // does the equivalent XML/zip decoding + matrix math on the CPU, which
      // — run inline — froze the whole UI ("응답 없음") on any real print
      // model. compute() runs it on a background isolate (a real OS thread
      // natively; a Web Worker on Flutter web) so the app stays responsive
      // while it works, even though the underlying work is unchanged.
      final data = await compute(_parseModelBytes, bytes);
      return _ModelPainter(data);
    },
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

typedef _P3 = (double, double, double);

/// A 3MF `transform` attribute: 12 numbers "M00 M01 M02 M10 M11 M12 M20 M21
/// M22 M30 M31 M32" — a row-major 4x3 affine matrix (translation in the last
/// row) applied to a row vector as v' = v * M. Composing two of these (child
/// transform applied first, then parent) requires real 4x4 matrix
/// multiplication, not just adding the numbers — that's what `then` does.
class _Affine {
  const _Affine(this.m);
  final List<double> m;

  static const identity = _Affine([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0]);

  static _Affine? parse(String? s) {
    if (s == null) return null;
    final parts = s.trim().split(RegExp(r'\s+'));
    if (parts.length != 12) return null;
    final values = <double>[];
    for (final p in parts) {
      final v = double.tryParse(p);
      if (v == null) return null;
      values.add(v);
    }
    return _Affine(values);
  }

  _P3 apply(_P3 p) {
    final (x, y, z) = p;
    return (
      x * m[0] + y * m[3] + z * m[6] + m[9],
      x * m[1] + y * m[4] + z * m[7] + m[10],
      x * m[2] + y * m[5] + z * m[8] + m[11],
    );
  }

  /// Returns the transform that applies `this` first, then `other` — i.e.
  /// the matrix product `this * other` in row-vector convention.
  _Affine then(_Affine other) {
    List<double> as4x4(_Affine a) => [
      a.m[0], a.m[1], a.m[2], 0,
      a.m[3], a.m[4], a.m[5], 0,
      a.m[6], a.m[7], a.m[8], 0,
      a.m[9], a.m[10], a.m[11], 1,
    ];
    final a = as4x4(this);
    final b = as4x4(other);
    final r = List<double>.filled(16, 0);
    for (var i = 0; i < 4; i++) {
      for (var j = 0; j < 4; j++) {
        var sum = 0.0;
        for (var k = 0; k < 4; k++) {
          sum += a[i * 4 + k] * b[k * 4 + j];
        }
        r[i * 4 + j] = sum;
      }
    }
    return _Affine([
      r[0], r[1], r[2],
      r[4], r[5], r[6],
      r[8], r[9], r[10],
      r[12], r[13], r[14],
    ]);
  }
}

class _Object3mf {
  _Object3mf({this.mesh, this.components = const []});
  final ({List<_P3> vertices, List<(int, int, int)> triangles})? mesh;
  final List<({String objectId, _Affine transform})> components;
}

/// Target triangle count for the renderer. A real multi-plate project 3MF
/// (Bambu/Orca) can have 90+ separate objects and well over a million
/// triangles total. This used to be an early-exit cap: once 30,000 triangles
/// were collected, resolution just stopped — which meant only the first
/// handful of objects (in whatever arbitrary file/map order) ever got
/// rendered, all squeezed to fill the canvas by the bounding-box-fit
/// projection. That looked like one small merged blob instead of the real
/// scattered multi-part layout, because the crop wasn't visually obvious —
/// it silently discarded 97%+ of the model rather than sampling it. Now a
/// two-pass approach (count everything, then keep every Nth triangle) keeps
/// this budget while representing every object at its correct position.
// Uniform stride-sampling a triangle *list* (as opposed to real mesh
// simplification) drops whole triangles rather than shrinking them, so each
// solid face turns into a sparse speckle of surviving fragments once enough
// are discarded — visually worse than just paying the cost of drawing every
// triangle. compute() keeps this off the UI thread regardless of count, so
// the budget only needs to guard against truly pathological files, not
// ordinary multi-plate multi-million-triangle prints.
const _targetTriangles = 4000000;

/// Must be a top-level function (not a method/closure) to run via compute().
/// Returns a flat buffer: 7 floats per triangle — (x,y) for each of its 3
/// projected 2D vertices, then a 0..1 flat-shading brightness — since typed
/// data transfers between isolates without copying, unlike a List of
/// records, which Dart isolate messaging would have to walk and rebuild.
Float32List _parseModelBytes(Uint8List bytes) {
  final archive = ZipDecoder().decodeBytes(bytes);
    // Slicer-exported "project" 3MF files (Bambu Studio, OrcaSlicer, ...)
    // commonly split each object's geometry into its own part under
    // 3D/Objects/*.model, with the top-level 3D/3dmodel.model only holding
    // <build>/<component> references — so the old code, which only ever
    // looked at 3D/3dmodel.model, found an XML file with zero <vertex>/
    // <triangle> elements and always threw "메시를 찾지 못했습니다". Scan every
    // *.model part in the archive instead.
    final modelFiles = archive.files.where(
      (f) => f.isFile && f.name.toLowerCase().endsWith('.model'),
    );
    if (modelFiles.isEmpty) {
      throw const FormatException('3MF 모델 데이터를 찾지 못했습니다.');
    }

    // Object ids are unique within a model part per the 3MF core spec (cross-
    // part references add a `path` attribute this best-effort parser
    // ignores) — a flat id -> object map is good enough for the common case
    // of a single print job.
    final objects = <String, _Object3mf>{};
    final buildItems = <({String objectId, _Affine transform})>[];

    for (final file in modelFiles) {
      final xml = XmlDocument.parse(
        utf8.decode(file.content as List<int>, allowMalformed: true),
      );
      for (final object in xml.findAllElements('object')) {
        final id = object.getAttribute('id');
        if (id == null) continue;
        final meshEl = object.findElements('mesh').firstOrNull;
        final componentsEl = object.findElements('components').firstOrNull;
        ({List<_P3> vertices, List<(int, int, int)> triangles})? mesh;
        if (meshEl != null) {
          final verticesEl = meshEl.findElements('vertices').firstOrNull;
          final trianglesEl = meshEl.findElements('triangles').firstOrNull;
          if (verticesEl != null && trianglesEl != null) {
            final vertices = verticesEl.findElements('vertex').map((v) {
              return (
                double.parse(v.getAttribute('x')!),
                double.parse(v.getAttribute('y')!),
                double.parse(v.getAttribute('z')!),
              );
            }).toList();
            final triangles = <(int, int, int)>[];
            for (final t in trianglesEl.findElements('triangle')) {
              final a = int.tryParse(t.getAttribute('v1') ?? '');
              final b = int.tryParse(t.getAttribute('v2') ?? '');
              final c = int.tryParse(t.getAttribute('v3') ?? '');
              if (a != null && b != null && c != null) {
                triangles.add((a, b, c));
              }
            }
            mesh = (vertices: vertices, triangles: triangles);
          }
        }
        final components = <({String objectId, _Affine transform})>[];
        if (componentsEl != null) {
          for (final c in componentsEl.findElements('component')) {
            final cid = c.getAttribute('objectid');
            if (cid == null) continue;
            components.add((
              objectId: cid,
              transform: _Affine.parse(c.getAttribute('transform')) ??
                  _Affine.identity,
            ));
          }
        }
        objects[id] = _Object3mf(mesh: mesh, components: components);
      }
      for (final item in xml.findAllElements('item')) {
        final id = item.getAttribute('objectid');
        if (id == null) continue;
        buildItems.add((
          objectId: id,
          transform:
              _Affine.parse(item.getAttribute('transform')) ??
              _Affine.identity,
        ));
      }
    }
    if (objects.isEmpty) {
      throw const FormatException('3MF 모델 데이터를 찾지 못했습니다.');
    }
    // Some plate/part files carry objects but no <build> section of their
    // own — fall back to drawing every object that isn't only referenced as
    // a sub-component of another, at identity placement, rather than
    // showing nothing.
    final referencedIds = objects.values
        .expand((o) => o.components)
        .map((c) => c.objectId)
        .toSet();
    final items = buildItems.isNotEmpty
        ? buildItems
        : [
            for (final id in objects.keys)
              if (!referencedIds.contains(id))
                (objectId: id, transform: _Affine.identity),
          ];

  _P2 project(_P3 p) {
    final (x, y, z) = p;
    return (x - y, (x + y) * 0.45 - z);
  }

  // Fixed light direction for a cheap flat-shading approximation — enough to
  // read as a solid 3D object instead of a flat wireframe, without a real
  // lighting pipeline (Three.js's MeshStandardMaterial does this properly on
  // the GPU; this is the closest approximation worth the CPU cost here).
  const light = (0.4, 0.6, 0.7);
  double lightLen() {
    final (lx, ly, lz) = light;
    return math.sqrt(lx * lx + ly * ly + lz * lz);
  }

  // Pass 1: count every triangle every item resolves to, with no vertex
  // math, so a uniform sampling stride can be picked before any real work.
  var totalTriangleCount = 0;
  void countOnly(String objectId, int depth) {
    if (depth > 8) return;
    final object = objects[objectId];
    if (object == null) return;
    if (object.mesh != null) {
      final vs = object.mesh!.vertices;
      for (final (a, b, c) in object.mesh!.triangles) {
        if (a < vs.length && b < vs.length && c < vs.length) {
          totalTriangleCount++;
        }
      }
    }
    for (final component in object.components) {
      countOnly(component.objectId, depth + 1);
    }
  }

  for (final item in items) {
    countOnly(item.objectId, 0);
  }
  final stride = totalTriangleCount > _targetTriangles
      ? (totalTriangleCount / _targetTriangles).ceil()
      : 1;
  final keptEstimate = stride == 1
      ? totalTriangleCount
      : (totalTriangleCount / stride).ceil() + 1;

  final out = Float32List(keptEstimate * 7);
  var seenTriangleCount = 0; // every triangle walked in pass 2, kept or not
  var triangleCount = 0; // triangles actually written to `out`

  void emit(_P3 a, _P3 b, _P3 c) {
    if (seenTriangleCount % stride != 0) {
      seenTriangleCount++;
      return;
    }
    seenTriangleCount++;
    if (triangleCount * 7 >= out.length) return;
    final (ax, ay, az) = a;
    final (bx, by, bz) = b;
    final (cx, cy, cz) = c;
    // Flat-shading normal via the two edge vectors' cross product.
    final e1 = (bx - ax, by - ay, bz - az);
    final e2 = (cx - ax, cy - ay, cz - az);
    final nx = e1.$2 * e2.$3 - e1.$3 * e2.$2;
    final ny = e1.$3 * e2.$1 - e1.$1 * e2.$3;
    final nz = e1.$1 * e2.$2 - e1.$2 * e2.$1;
    final nLen = math.sqrt(nx * nx + ny * ny + nz * nz);
    final (lx, ly, lz) = light;
    final brightness = nLen == 0
        ? 0.6
        : ((nx * lx + ny * ly + nz * lz) / (nLen * lightLen())).abs().clamp(
            0.25,
            1.0,
          );
    final pa = project(a);
    final pb = project(b);
    final pc = project(c);
    final base = triangleCount * 7;
    out[base] = pa.$1;
    out[base + 1] = pa.$2;
    out[base + 2] = pb.$1;
    out[base + 3] = pb.$2;
    out[base + 4] = pc.$1;
    out[base + 5] = pc.$2;
    out[base + 6] = brightness;
    triangleCount++;
  }

  void resolve(String objectId, _Affine transform, int depth) {
    if (depth > 8) return; // guard against malformed circular references
    final object = objects[objectId];
    if (object == null) return;
    final mesh = object.mesh;
    if (mesh != null) {
      final vs = mesh.vertices;
      for (final (a, b, c) in mesh.triangles) {
        if (a < vs.length && b < vs.length && c < vs.length) {
          emit(transform.apply(vs[a]), transform.apply(vs[b]), transform.apply(vs[c]));
        }
      }
    }
    for (final component in object.components) {
      resolve(component.objectId, component.transform.then(transform), depth + 1);
    }
  }

  for (final item in items) {
    resolve(item.objectId, item.transform, 0);
  }

  if (triangleCount == 0) {
    throw const FormatException('표시 가능한 3MF 메시를 찾지 못했습니다.');
  }
  return Float32List.sublistView(out, 0, triangleCount * 7);
}

/// Draws the whole mesh with a single drawVertices call instead of one
/// canvas.drawPath per triangle — for a model with tens of thousands of
/// triangles, that loop of individual stroke draws was the other half of
/// the "heavy" complaint alongside the parsing cost `compute()` now offloads.
class _ModelPainter extends CustomPainter {
  _ModelPainter(this.data);
  final Float32List data;

  @override
  void paint(Canvas canvas, Size size) {
    if (data.isEmpty) return;
    var minX = double.infinity,
        minY = double.infinity,
        maxX = -double.infinity,
        maxY = -double.infinity;
    for (var i = 0; i < data.length; i += 7) {
      for (final j in [0, 2, 4]) {
        final x = data[i + j], y = data[i + j + 1];
        minX = math.min(minX, x);
        minY = math.min(minY, y);
        maxX = math.max(maxX, x);
        maxY = math.max(maxY, y);
      }
    }
    final scale = math.min(
      (size.width - 32) / math.max(maxX - minX, 1),
      (size.height - 32) / math.max(maxY - minY, 1),
    );
    final dx = (size.width - (maxX - minX) * scale) / 2 - minX * scale;
    final dy = (size.height - (maxY - minY) * scale) / 2 - minY * scale;

    const base = Color(0xFF34D399);
    final positions = Float32List(data.length ~/ 7 * 6);
    final colors = Int32List(data.length ~/ 7 * 3);
    var pi = 0;
    var ci = 0;
    for (var i = 0; i < data.length; i += 7) {
      final brightness = data[i + 6];
      final color = Color.lerp(
        base.withValues(alpha: 0.5),
        Colors.white,
        (brightness - 0.25) / 0.75 * 0.5,
      )!.toARGB32();
      for (final j in [0, 2, 4]) {
        positions[pi++] = data[i + j] * scale + dx;
        positions[pi++] = data[i + j + 1] * scale + dy;
        colors[ci++] = color;
      }
    }
    canvas.drawVertices(
      Vertices.raw(VertexMode.triangles, positions, colors: colors),
      BlendMode.srcOver,
      Paint(),
    );
  }

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

extension _FirstOrNull<T> on Iterable<T> {
  T? get firstOrNull => isEmpty ? null : first;
}

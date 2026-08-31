import 'dart:convert';
import 'dart:typed_data';

import 'package:archive/archive.dart';

class _Point3 {
  const _Point3(this.x, this.y, this.z);
  final double x;
  final double y;
  final double z;
}

class _Mesh {
  const _Mesh(this.vertices, this.triangles);
  final List<_Point3> vertices;
  final List<(int, int, int)> triangles;
}

/// Converts the same STL/OBJ formats supported by the React client into a
/// minimal standards-compliant 3MF archive. The conversion is local and works
/// on Android, iOS and web without uploading the source model elsewhere.
Uint8List convertModelTo3mf(Uint8List source, String extension) {
  final mesh = switch (extension.toLowerCase()) {
    'stl' => _parseStl(source),
    'obj' => _parseObj(utf8.decode(source, allowMalformed: true)),
    _ => throw const FormatException('지원하지 않는 3D 모델 형식입니다.'),
  };
  if (mesh.vertices.isEmpty || mesh.triangles.isEmpty) {
    throw const FormatException('모델에서 출력 가능한 메시를 찾지 못했습니다.');
  }

  final vertices = mesh.vertices
      .map((v) => '<vertex x="${v.x}" y="${v.y}" z="${v.z}"/>')
      .join();
  final triangles = mesh.triangles
      .map((t) => '<triangle v1="${t.$1}" v2="${t.$2}" v3="${t.$3}"/>')
      .join();
  final model = '''<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02"><resources><object id="1" type="model"><mesh><vertices>$vertices</vertices><triangles>$triangles</triangles></mesh></object></resources><build><item objectid="1"/></build></model>''';
  const contentTypes = '''<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>''';
  const relationships = '''<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>''';

  final archive = Archive()
    ..addFile(ArchiveFile.string('[Content_Types].xml', contentTypes))
    ..addFile(ArchiveFile.string('_rels/.rels', relationships))
    ..addFile(ArchiveFile.string('3D/3dmodel.model', model));
  return Uint8List.fromList(ZipEncoder().encode(archive));
}

_Mesh _parseStl(Uint8List bytes) {
  if (bytes.length >= 84) {
    final data = ByteData.sublistView(bytes);
    final count = data.getUint32(80, Endian.little);
    if (84 + count * 50 <= bytes.length) {
      final vertices = <_Point3>[];
      final triangles = <(int, int, int)>[];
      var offset = 84;
      for (var face = 0; face < count; face++, offset += 50) {
        final first = vertices.length;
        for (var vertex = 0; vertex < 3; vertex++) {
          final p = offset + 12 + vertex * 12;
          vertices.add(
            _Point3(
              data.getFloat32(p, Endian.little),
              data.getFloat32(p + 4, Endian.little),
              data.getFloat32(p + 8, Endian.little),
            ),
          );
        }
        triangles.add((first, first + 1, first + 2));
      }
      return _Mesh(vertices, triangles);
    }
  }

  final text = utf8.decode(bytes, allowMalformed: true);
  final values =
      RegExp(
            r'vertex\s+([-+\d.eE]+)\s+([-+\d.eE]+)\s+([-+\d.eE]+)',
            caseSensitive: false,
          )
          .allMatches(text)
          .map(
            (m) => _Point3(
              double.parse(m[1]!),
              double.parse(m[2]!),
              double.parse(m[3]!),
            ),
          )
          .toList();
  final triangles = <(int, int, int)>[];
  for (var i = 0; i + 2 < values.length; i += 3) {
    triangles.add((i, i + 1, i + 2));
  }
  return _Mesh(values, triangles);
}

_Mesh _parseObj(String text) {
  final vertices = <_Point3>[];
  final triangles = <(int, int, int)>[];
  for (final raw in const LineSplitter().convert(text)) {
    final line = raw.trim();
    if (line.startsWith('v ')) {
      final parts = line.split(RegExp(r'\s+'));
      if (parts.length >= 4) {
        vertices.add(
          _Point3(
            double.parse(parts[1]),
            double.parse(parts[2]),
            double.parse(parts[3]),
          ),
        );
      }
    } else if (line.startsWith('f ')) {
      final parts = line.split(RegExp(r'\s+')).skip(1).map((p) {
        final rawIndex = int.parse(p.split('/').first);
        return rawIndex < 0 ? vertices.length + rawIndex : rawIndex - 1;
      }).toList();
      for (var i = 1; i + 1 < parts.length; i++) {
        triangles.add((parts.first, parts[i], parts[i + 1]));
      }
    }
  }
  return _Mesh(vertices, triangles);
}

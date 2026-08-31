import 'dart:convert';
import 'dart:typed_data';

import 'package:archive/archive.dart';
import 'package:cbgpu_app/core/model_converter.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  for (final sample in <String, String>{
    'stl':
        'solid test\nfacet normal 0 0 1\nouter loop\nvertex 0 0 0\nvertex 1 0 0\nvertex 0 1 0\nendloop\nendfacet\nendsolid test',
    'obj': 'v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3',
  }.entries) {
    test('converts ${sample.key.toUpperCase()} into a valid 3MF package', () {
      final bytes = convertModelTo3mf(
        Uint8List.fromList(utf8.encode(sample.value)),
        sample.key,
      );
      final archive = ZipDecoder().decodeBytes(bytes);
      expect(archive.findFile('[Content_Types].xml'), isNotNull);
      expect(archive.findFile('_rels/.rels'), isNotNull);
      final model = archive.findFile('3D/3dmodel.model');
      expect(model, isNotNull);
      final xml = utf8.decode(model!.content as List<int>);
      expect(xml, contains('<triangle v1="0" v2="1" v3="2"/>'));
    });
  }
}

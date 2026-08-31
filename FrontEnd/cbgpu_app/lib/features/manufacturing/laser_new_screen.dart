import 'dart:typed_data';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../core/glass.dart';
import '../../core/svg_converter.dart';

class _FileEntry {
  _FileEntry(this.name, this.bytes);
  final String name;
  final Uint8List bytes;
  final quantityController = TextEditingController(text: '1');
  String catalogId = '';
}

class LaserNewScreen extends StatefulWidget {
  const LaserNewScreen({super.key});
  @override
  State<LaserNewScreen> createState() => _LaserNewScreenState();
}

class _LaserNewScreenState extends State<LaserNewScreen> {
  List<Map<String, dynamic>> _catalog = [];
  final List<_FileEntry> _fileEntries = [];
  final _purposeController = TextEditingController();
  final _notesController = TextEditingController();
  List<Map<String, dynamic>> _managers = [];
  String _managerId = '';
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _purposeController.dispose();
    _notesController.dispose();
    for (final e in _fileEntries) {
      e.quantityController.dispose();
    }
    super.dispose();
  }

  Future<void> _load() async {
    final catalog = await Supabase.instance.client
        .from('laser_materials')
        .select('*')
        .order('material')
        .order('thickness_mm');
    final managers = await Supabase.instance.client
        .from('profiles')
        .select('id, full_name, student_id')
        .eq('is_laser_cut_manager', true)
        .order('student_id');
    if (mounted) {
      setState(() {
        _catalog = (catalog as List).cast<Map<String, dynamic>>();
        _managers = (managers as List).cast<Map<String, dynamic>>();
      });
    }
  }

  Future<void> _pickFiles() async {
    final files = await FilePicker.pickFiles(
      type: FileType.custom,
      allowedExtensions: ['dxf', 'svg', 'dwg'],
    );
    for (final f in files) {
      final ext = f.extension?.toLowerCase();
      if (ext == 'dwg') {
        _snack('"${f.name}"의 DWG 변환은 준비 중입니다. DXF 또는 SVG 파일을 선택해주세요.');
        continue;
      }
      try {
        final source = await f.readAsBytes();
        final converted = ext == 'svg' ? convertSvgToDxf(source) : source;
        final name = ext == 'svg'
            ? '${f.name.substring(0, f.name.lastIndexOf('.'))}.dxf'
            : f.name;
        if (mounted) {
          setState(() => _fileEntries.add(_FileEntry(name, converted)));
        }
      } catch (error) {
        _snack('"${f.name}" 변환 실패: $error');
      }
    }
  }

  void _snack(String msg) {
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
    }
  }

  Future<void> _submit() async {
    final user = Supabase.instance.client.auth.currentUser;
    if (user == null) return;
    final profile = await Supabase.instance.client
        .from('profiles')
        .select('is_approved')
        .eq('id', user.id)
        .maybeSingle();
    if (profile?['is_approved'] == false) {
      return _snack('학번 또는 이름 확인이 필요해 신청할 수 없습니다. 프로필에서 정보를 확인해 주세요.');
    }
    if (_fileEntries.isEmpty) return _snack('dxf 파일을 한 개 이상 업로드해주세요.');
    if (_purposeController.text.trim().isEmpty) return _snack('사용 목적을 입력해주세요.');
    for (final e in _fileEntries) {
      if (e.catalogId.isEmpty) return _snack('"${e.name}"의 재질/두께를 선택해주세요.');
      final q = int.tryParse(e.quantityController.text.trim());
      if (q == null || q <= 0) return _snack('"${e.name}"의 수량을 올바르게 입력해주세요.');
    }

    setState(() => _submitting = true);
    try {
      final rows = <Map<String, dynamic>>[];
      for (final entry in _fileEntries) {
        final cat = _catalog.firstWhere((c) => c['id'] == entry.catalogId);
        final filePath =
            '${user.id}/laser/${DateTime.now().millisecondsSinceEpoch}_${entry.name}';
        await Supabase.instance.client.storage
            .from('manufacturing')
            .uploadBinary(filePath, entry.bytes);
        rows.add({
          'user_id': user.id,
          'user_email': user.email,
          'manager_id': _managerId.isEmpty ? null : _managerId,
          'purpose': _purposeController.text.trim(),
          'file_path': filePath,
          'file_name': entry.name,
          'material': cat['material'],
          'thickness_mm': cat['thickness_mm'],
          'quantity': int.parse(entry.quantityController.text.trim()),
          'notes': _notesController.text.trim(),
        });
      }
      final inserted = await Supabase.instance.client
          .from('laser_jobs')
          .insert(rows)
          .select('id');
      if (!mounted) return;
      if (rows.length == 1) {
        _snack('레이저 커팅이 신청됐습니다. 담당자 승인을 기다려주세요.');
        context.pushReplacement(
          '/manufacturing/laser/${(inserted as List).first['id']}',
        );
      } else {
        _snack('파일 ${rows.length}개가 각각 신청됐습니다. 담당자 승인을 기다려주세요.');
        context.pop();
      }
    } catch (e) {
      _snack('신청 실패: $e');
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AmbientBackground(
      child: ListView(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 100),
        children: [
          Row(
            children: [
              IconButton(
                icon: const Icon(Icons.arrow_back),
                onPressed: () => context.pop(),
              ),
              const Expanded(
                child: Text(
                  '레이저 커팅 신청',
                  style: TextStyle(fontWeight: FontWeight.w900, fontSize: 17),
                ),
              ),
              ElevatedButton(
                onPressed: (_submitting || _catalog.isEmpty) ? null : _submit,
                child: Text(
                  _submitting
                      ? '신청 중…'
                      : (_fileEntries.length > 1
                            ? '${_fileEntries.length}건 신청하기'
                            : '신청하기'),
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          const Text(
            'MDF · 아크릴',
            style: TextStyle(fontSize: 10, color: Colors.grey),
          ),
          const SizedBox(height: 16),

          Text(
            '사용 목적 *',
            style: TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.w900,
              color: Colors.grey.shade600,
            ),
          ),
          const SizedBox(height: 8),
          TextField(
            controller: _purposeController,
            decoration: const InputDecoration(
              hintText: '예: 동아리 전시용 케이스, 개인 프로젝트 부품 등',
            ),
          ),
          const SizedBox(height: 20),

          Text(
            '설계 파일 * — 여러 개 선택 가능',
            style: TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.w900,
              color: Colors.grey.shade600,
            ),
          ),
          const SizedBox(height: 8),
          if (_catalog.isEmpty)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 16),
              child: Center(
                child: Text(
                  '현재 담당자가 등록해둔 재질/두께가 없습니다.',
                  style: TextStyle(fontSize: 11, color: Colors.grey),
                ),
              ),
            )
          else ...[
            InkWell(
              onTap: _pickFiles,
              borderRadius: BorderRadius.circular(14),
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(vertical: 24),
                decoration: BoxDecoration(
                  border: Border.all(color: Colors.grey.withValues(alpha: 0.3)),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Column(
                  children: [
                    const Icon(Icons.upload_file, size: 28, color: Colors.grey),
                    const SizedBox(height: 8),
                    const Text(
                      '탭해서 파일 선택 (여러 개 가능)',
                      style: TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 12,
                      ),
                    ),
                    const SizedBox(height: 2),
                    const Text(
                      '.dxf · .svg (SVG는 앱에서 DXF로 자동 변환)',
                      style: TextStyle(fontSize: 9, color: Colors.grey),
                      textAlign: TextAlign.center,
                    ),
                  ],
                ),
              ),
            ),
            if (_fileEntries.isNotEmpty) ...[
              const SizedBox(height: 10),
              for (var i = 0; i < _fileEntries.length; i++) ...[
                _fileEntryCard(i),
                const SizedBox(height: 8),
              ],
            ],
          ],
          const SizedBox(height: 20),

          Text(
            '담당자 지정',
            style: TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.w900,
              color: Colors.grey.shade600,
            ),
          ),
          const SizedBox(height: 8),
          DropdownMenu<String>(
            width: double.infinity,
            hintText: '아무나 (자동 배정)',
            dropdownMenuEntries: [
              for (final m in _managers)
                DropdownMenuEntry(
                  value: m['id'] as String,
                  label:
                      '${m['full_name'] ?? 'Unknown'} (${m['student_id'] ?? '-'})',
                ),
            ],
            onSelected: (v) => setState(() => _managerId = v ?? ''),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _notesController,
            maxLines: 3,
            decoration: const InputDecoration(
              hintText: '메모: 원하는 완성 규격 등 요청사항...',
            ),
          ),
        ],
      ),
    );
  }

  Widget _fileEntryCard(int i) {
    final entry = _fileEntries[i];
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: Colors.grey.withValues(alpha: 0.06),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  entry.name,
                  style: const TextStyle(
                    fontWeight: FontWeight.w900,
                    fontSize: 12,
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              IconButton(
                icon: const Icon(Icons.close, size: 16),
                onPressed: () => setState(() => _fileEntries.removeAt(i)),
              ),
            ],
          ),
          DropdownMenu<String>(
            width: double.infinity,
            hintText: '재질 / 두께 선택',
            dropdownMenuEntries: [
              for (final c in _catalog)
                DropdownMenuEntry(
                  value: c['id'] as String,
                  label:
                      '${c['material'] == 'mdf' ? 'MDF' : '아크릴'} ${c['thickness_mm']}mm',
                ),
            ],
            onSelected: (v) => setState(() => entry.catalogId = v ?? ''),
          ),
          const SizedBox(height: 6),
          TextField(
            controller: entry.quantityController,
            keyboardType: TextInputType.number,
            decoration: const InputDecoration(labelText: '수량'),
          ),
        ],
      ),
    );
  }
}

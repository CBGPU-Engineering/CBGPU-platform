import 'dart:typed_data';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../core/glass.dart';
import '../../core/model_converter.dart';

class _FileEntry {
  _FileEntry(this.name, this.bytes);
  final String name;
  final Uint8List bytes;
  final quantityController = TextEditingController(text: '1');
  final plateCountController = TextEditingController(text: '1');
  String filamentId = '';
}

class PrintNewScreen extends StatefulWidget {
  const PrintNewScreen({super.key});
  @override
  State<PrintNewScreen> createState() => _PrintNewScreenState();
}

class _PrintNewScreenState extends State<PrintNewScreen> {
  String _mode = 'beginner';
  final List<_FileEntry> _fileEntries = [];
  final _purposeController = TextEditingController();
  final _notesController = TextEditingController();
  List<Map<String, dynamic>> _printers = [];
  int? _printerId;
  Map<int, int> _plateBacklog = {};
  List<Map<String, dynamic>> _managers = [];
  String _managerId = '';
  List<Map<String, dynamic>> _filaments = [];
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
      e.plateCountController.dispose();
    }
    super.dispose();
  }

  Future<void> _load() async {
    final printers = await Supabase.instance.client
        .from('printers')
        .select('*')
        .order('id', ascending: true);
    final filaments = await Supabase.instance.client
        .from('print_materials')
        .select('*')
        .order('material', ascending: true)
        .order('color', ascending: true);
    try {
      final rows = await Supabase.instance.client.rpc('printer_plate_backlog');
      final map = <int, int>{};
      for (final r in rows as List) {
        map[r['printer_id'] as int] = r['plates'] as int;
      }
      if (mounted) setState(() => _plateBacklog = map);
    } catch (_) {}
    if (mounted) {
      setState(() {
        _printers = (printers as List).cast<Map<String, dynamic>>();
        _filaments = (filaments as List).cast<Map<String, dynamic>>();
      });
    }
  }

  Future<void> _onSelectPrinter(int id) async {
    setState(() {
      _printerId = id;
      _managerId = '';
      _managers = [];
    });
    final pm = await Supabase.instance.client
        .from('printer_managers')
        .select('user_id')
        .eq('printer_id', id);
    final ids = (pm as List)
        .map((r) => r['user_id'] as String)
        .toSet()
        .toList();
    if (ids.isEmpty) return;
    final rows = await Supabase.instance.client
        .from('profiles')
        .select('id, full_name, student_id')
        .inFilter('id', ids)
        .order('student_id', ascending: true);
    if (mounted) {
      setState(() => _managers = (rows as List).cast<Map<String, dynamic>>());
    }
  }

  Future<void> _pickFiles() async {
    final files = await FilePicker.pickFiles(
      type: FileType.custom,
      allowedExtensions: ['3mf', 'stl', 'obj'],
    );
    for (final f in files) {
      final ext = f.extension?.toLowerCase();
      try {
        final source = await f.readAsBytes();
        final converted = ext == '3mf'
            ? source
            : convertModelTo3mf(source, ext ?? '');
        final name = ext == '3mf'
            ? f.name
            : '${f.name.substring(0, f.name.lastIndexOf('.'))}.3mf';
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
    if (_fileEntries.isEmpty) return _snack('3mf 파일을 한 개 이상 업로드해주세요.');
    if (_printerId == null) return _snack('사용할 프린터를 선택해주세요.');
    if (_purposeController.text.trim().isEmpty) return _snack('사용 목적을 입력해주세요.');
    for (final e in _fileEntries) {
      final q = int.tryParse(e.quantityController.text.trim());
      if (q == null || q <= 0) return _snack('"${e.name}"의 수량을 올바르게 입력해주세요.');
      final pc = int.tryParse(e.plateCountController.text.trim());
      if (pc == null || pc <= 0) {
        return _snack('"${e.name}"의 플레이트 수를 올바르게 입력해주세요.');
      }
    }

    setState(() => _submitting = true);
    try {
      final rows = <Map<String, dynamic>>[];
      for (final entry in _fileEntries) {
        final filament = _filaments
            .where((f) => f['id'] == entry.filamentId)
            .firstOrNull;
        final filePath =
            '${user.id}/print/${DateTime.now().millisecondsSinceEpoch}_${entry.name}';
        await Supabase.instance.client.storage
            .from('manufacturing')
            .uploadBinary(filePath, entry.bytes);
        rows.add({
          'user_id': user.id,
          'user_email': user.email,
          'mode': _mode,
          'manager_id': _managerId.isEmpty ? null : _managerId,
          'preferred_printer_id': _printerId,
          'purpose': _purposeController.text.trim(),
          'quantity': int.parse(entry.quantityController.text.trim()),
          'plate_count': int.parse(entry.plateCountController.text.trim()),
          'material': filament?['material'],
          'color': filament?['color'],
          'file_path': filePath,
          'file_name': entry.name,
          'notes': _notesController.text.trim(),
        });
      }
      final inserted = await Supabase.instance.client
          .from('print_jobs')
          .insert(rows)
          .select('id');
      if (!mounted) return;
      if (rows.length == 1) {
        _snack('3D 프린팅이 신청됐습니다. 담당자 승인을 기다려주세요.');
        context.pushReplacement(
          '/manufacturing/print/${(inserted as List).first['id']}',
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
                  '3D 프린팅 신청',
                  style: TextStyle(fontWeight: FontWeight.w900, fontSize: 17),
                ),
              ),
              ElevatedButton(
                onPressed: _submitting ? null : _submit,
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
            'Bambu Lab X1C',
            style: TextStyle(fontSize: 10, color: Colors.grey),
          ),
          const SizedBox(height: 16),

          Text(
            '사용할 프린터 선택 *',
            style: TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.w900,
              color: Colors.grey.shade600,
            ),
          ),
          const SizedBox(height: 8),
          GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 2,
              mainAxisSpacing: 8,
              crossAxisSpacing: 8,
              childAspectRatio: 1.6,
            ),
            itemCount: _printers.length,
            itemBuilder: (context, i) {
              final p = _printers[i];
              final selected = _printerId == p['id'];
              return InkWell(
                onTap: () => _onSelectPrinter(p['id']),
                borderRadius: BorderRadius.circular(14),
                child: Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(
                      color: selected
                          ? Theme.of(context).colorScheme.primary
                          : Colors.grey.withValues(alpha: 0.3),
                      width: selected ? 2 : 1,
                    ),
                  ),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(
                        p['name'] as String? ?? '',
                        style: const TextStyle(
                          fontWeight: FontWeight.w900,
                          fontSize: 13,
                        ),
                      ),
                      Text(
                        '밀린 플레이트 ${_plateBacklog[p['id']] ?? 0}개',
                        style: const TextStyle(fontSize: 9, color: Colors.grey),
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
          const SizedBox(height: 20),

          Text(
            '모드 선택',
            style: TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.w900,
              color: Colors.grey.shade600,
            ),
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: _modeCard(
                  'beginner',
                  '초보자',
                  '슬라이싱 전 원본 3mf만 올리면 담당자가 슬라이싱까지 진행',
                  Icons.school_outlined,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _modeCard(
                  'advanced',
                  '고급자',
                  '본인 컴퓨터로 직접 슬라이싱한 완료 파일을 올려서 출력만 요청',
                  Icons.build_outlined,
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),

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
              hintText: '예: 동아리 전시용 모형, 개인 프로젝트 부품 등',
            ),
          ),
          const SizedBox(height: 20),

          Text(
            _mode == 'beginner' ? '모델 파일 *' : '슬라이싱 완료 파일 *',
            style: TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.w900,
              color: Colors.grey.shade600,
            ),
          ),
          const SizedBox(height: 8),
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
                    style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12),
                  ),
                  const SizedBox(height: 2),
                  const Text(
                    '.3mf · .stl · .obj (STL/OBJ는 앱에서 3MF로 자동 변환)',
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
          if (_printerId == null)
            const Text(
              '프린터를 먼저 선택하면 담당자를 고를 수 있습니다.',
              style: TextStyle(fontSize: 11, color: Colors.grey),
            )
          else
            DropdownMenu<String>(
              key: ValueKey(_managers.length),
              width: double.infinity,
              hintText: '아무나 (수락하는 담당자에게 배정)',
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
            decoration: const InputDecoration(hintText: '메모: 서포트 여부 등 요청사항...'),
          ),
        ],
      ),
    );
  }

  Widget _modeCard(String value, String label, String desc, IconData icon) {
    final selected = _mode == value;
    return InkWell(
      onTap: () => setState(() => _mode = value),
      borderRadius: BorderRadius.circular(14),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: selected
                ? Theme.of(context).colorScheme.primary
                : Colors.grey.withValues(alpha: 0.3),
            width: selected ? 2 : 1,
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(
              icon,
              size: 18,
              color: selected
                  ? Theme.of(context).colorScheme.primary
                  : Colors.grey,
            ),
            const SizedBox(height: 6),
            Text(
              label,
              style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 12),
            ),
            Text(desc, style: const TextStyle(fontSize: 9, color: Colors.grey)),
          ],
        ),
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
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: entry.quantityController,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(labelText: '수량'),
                ),
              ),
              const SizedBox(width: 6),
              Expanded(
                child: TextField(
                  controller: entry.plateCountController,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(labelText: '플레이트 수'),
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          DropdownMenu<String>(
            width: double.infinity,
            hintText: '필라멘트 (상관없음)',
            dropdownMenuEntries: [
              for (final f in _filaments)
                DropdownMenuEntry(
                  value: f['id'] as String,
                  label:
                      '${f['material']} · ${f['color']}${f['stock_count'] == 0 ? ' (품절)' : ''}',
                ),
            ],
            onSelected: (v) => setState(() => entry.filamentId = v ?? ''),
          ),
        ],
      ),
    );
  }
}

extension _FirstOrNullExt<T> on Iterable<T> {
  T? get firstOrNull => isEmpty ? null : first;
}

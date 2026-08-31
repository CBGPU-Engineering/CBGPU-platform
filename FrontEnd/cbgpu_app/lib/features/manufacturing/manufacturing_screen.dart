import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../core/glass.dart';
import '../../core/locate_student.dart' as locate;

const _durationPresets = [
  ('1시간', 1.0),
  ('2시간', 2.0),
  ('4시간', 4.0),
  ('8시간', 8.0),
  ('12시간', 12.0),
  ('24시간', 24.0),
];

const _printStatusLabels = {
  'pending': '승인 대기',
  'accepted': '대기열',
  'queued': '대기열',
  'printing': '프린팅 중',
  'done': '완료',
  'rejected': '거절됨',
  'canceled': '취소됨',
};
const _laserStatusLabels = {
  'pending': '승인 대기',
  'accepted': '대기중',
  'in_progress': '작업 중',
  'done': '완료',
  'rejected': '거절됨',
  'canceled': '취소됨',
};
const _statusColors = {
  'pending': Colors.amber,
  'accepted': Colors.blue,
  'queued': Colors.blue,
  'printing': Colors.green,
  'in_progress': Colors.green,
  'done': Colors.green,
  'rejected': Colors.red,
  'canceled': Colors.grey,
};

class ManufacturingScreen extends StatefulWidget {
  const ManufacturingScreen({super.key});
  @override
  State<ManufacturingScreen> createState() => _ManufacturingScreenState();
}

class _ManufacturingScreenState extends State<ManufacturingScreen> {
  String _tab = 'print';
  bool _isAdmin = false;
  bool _isLaserManager = false;
  List<int> _managedPrinterIds = [];
  bool get _isPrintManager => _managedPrinterIds.isNotEmpty || _isAdmin;

  List<Map<String, dynamic>> _printers = [];
  List<Map<String, dynamic>> _myPrintJobs = [];
  bool _printLoading = true;
  Map<int, int> _plateBacklog = {};

  List<Map<String, dynamic>> _myLaserJobs = [];
  bool _laserLoading = true;

  List<Map<String, dynamic>> _allPrintJobs = [];
  bool _managerPrintLoading = true;
  List<Map<String, dynamic>> _filamentCatalog = [];
  final _newFilamentMaterial = TextEditingController();
  final _newFilamentColor = TextEditingController();
  final _newFilamentStock = TextEditingController(text: '1');

  List<Map<String, dynamic>> _allLaserJobs = [];
  bool _managerLaserLoading = true;
  List<Map<String, dynamic>> _laserCatalog = [];
  String _newCatalogMaterial = 'mdf';
  final _newCatalogThickness = TextEditingController(text: '3');

  Map<String, Map<String, dynamic>> _requesterProfiles = {};

  String? get _userId => Supabase.instance.client.auth.currentUser?.id;

  @override
  void initState() {
    super.initState();
    _init();
  }

  @override
  void dispose() {
    _newFilamentMaterial.dispose();
    _newFilamentColor.dispose();
    _newFilamentStock.dispose();
    _newCatalogThickness.dispose();
    super.dispose();
  }

  void _snack(String msg) {
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
    }
  }

  Future<void> _init() async {
    final user = Supabase.instance.client.auth.currentUser;
    if (user == null) return;
    final profile = await Supabase.instance.client
        .from('profiles')
        .select('is_admin, is_laser_cut_manager')
        .eq('id', user.id)
        .maybeSingle();
    final pm = await Supabase.instance.client
        .from('printer_managers')
        .select('printer_id')
        .eq('user_id', user.id);
    if (mounted) {
      setState(() {
        _isAdmin = profile?['is_admin'] == true;
        _isLaserManager = profile?['is_laser_cut_manager'] == true;
        _managedPrinterIds = (pm as List)
            .map((r) => r['printer_id'] as int)
            .toList();
      });
    }
    _loadPrintTab();
  }

  Future<void> _fetchPrinters() async {
    final rows = await Supabase.instance.client
        .from('printers')
        .select('*')
        .order('id');
    if (mounted) {
      setState(() => _printers = (rows as List).cast<Map<String, dynamic>>());
    }
  }

  Future<void> _fetchMyPrintJobs() async {
    if (_userId == null) return;
    final rows = await Supabase.instance.client
        .from('print_jobs')
        .select('*, manager:manager_id(full_name, student_id)')
        .eq('user_id', _userId as Object)
        .order('created_at', ascending: false);
    if (mounted) {
      setState(
        () => _myPrintJobs = (rows as List).cast<Map<String, dynamic>>(),
      );
    }
  }

  Future<void> _fetchPlateBacklog() async {
    try {
      final rows = await Supabase.instance.client.rpc('printer_plate_backlog');
      final map = <int, int>{};
      for (final r in rows as List) {
        map[r['printer_id'] as int] = r['plates'] as int;
      }
      if (mounted) setState(() => _plateBacklog = map);
    } catch (_) {}
  }

  Future<void> _loadPrintTab() async {
    setState(() => _printLoading = true);
    await Future.wait([
      _fetchPrinters(),
      _fetchMyPrintJobs(),
      _fetchPlateBacklog(),
    ]);
    if (mounted) setState(() => _printLoading = false);
  }

  Future<void> _fetchMyLaserJobs() async {
    if (_userId == null) return;
    setState(() => _laserLoading = true);
    final rows = await Supabase.instance.client
        .from('laser_jobs')
        .select('*, manager:manager_id(full_name, student_id)')
        .eq('user_id', _userId as Object)
        .order('created_at', ascending: false);
    if (mounted) {
      setState(() {
        _myLaserJobs = (rows as List).cast<Map<String, dynamic>>();
        _laserLoading = false;
      });
    }
  }

  Future<void> _fetchRequesterProfiles(List<String> userIds) async {
    final unique = userIds.toSet().toList();
    if (unique.isEmpty) return;
    final rows = await Supabase.instance.client
        .from('profiles')
        .select('id, full_name, student_id')
        .inFilter('id', unique);
    final next = Map.of(_requesterProfiles);
    for (final p in rows as List) {
      next[p['id'] as String] = p as Map<String, dynamic>;
    }
    if (mounted) setState(() => _requesterProfiles = next);
  }

  String _requesterLabel(Map<String, dynamic> job) {
    final p = _requesterProfiles[job['user_id']];
    if (p == null) return job['user_email'] as String? ?? '';
    return '${p['full_name'] ?? 'Unknown'} (${p['student_id'] ?? '-'})';
  }

  Future<void> _fetchAllPrintJobs() async {
    setState(() => _managerPrintLoading = true);
    final rows = await Supabase.instance.client
        .from('print_jobs')
        .select('*, manager:manager_id(full_name, student_id)')
        .order('created_at', ascending: false)
        .limit(500);
    final jobs = (rows as List).cast<Map<String, dynamic>>();
    if (mounted) {
      setState(() {
        _allPrintJobs = jobs;
        _managerPrintLoading = false;
      });
    }
    _fetchRequesterProfiles(jobs.map((j) => j['user_id'] as String).toList());
  }

  Future<void> _fetchFilamentCatalog() async {
    final rows = await Supabase.instance.client
        .from('print_materials')
        .select('*')
        .order('material')
        .order('color');
    if (mounted) {
      setState(
        () => _filamentCatalog = (rows as List).cast<Map<String, dynamic>>(),
      );
    }
  }

  Future<void> _loadPrintManagerTab() async {
    await Future.wait([
      _fetchPrinters(),
      _fetchAllPrintJobs(),
      _fetchFilamentCatalog(),
      _fetchPlateBacklog(),
    ]);
  }

  Future<void> _fetchAllLaserJobs() async {
    setState(() => _managerLaserLoading = true);
    final rows = await Supabase.instance.client
        .from('laser_jobs')
        .select('*, manager:manager_id(full_name, student_id)')
        .order('created_at', ascending: false)
        .limit(500);
    final jobs = (rows as List).cast<Map<String, dynamic>>();
    if (mounted) {
      setState(() {
        _allLaserJobs = jobs;
        _managerLaserLoading = false;
      });
    }
    _fetchRequesterProfiles(jobs.map((j) => j['user_id'] as String).toList());
  }

  Future<void> _fetchLaserCatalog() async {
    final rows = await Supabase.instance.client
        .from('laser_materials')
        .select('*')
        .order('material')
        .order('thickness_mm');
    if (mounted) {
      setState(
        () => _laserCatalog = (rows as List).cast<Map<String, dynamic>>(),
      );
    }
  }

  void _onTabChanged(String tab) {
    setState(() => _tab = tab);
    if (tab == 'print') _loadPrintTab();
    if (tab == 'laser') _fetchMyLaserJobs();
    if (tab == 'print_manager' && _isPrintManager) _loadPrintManagerTab();
    if (tab == 'laser_manager' && (_isLaserManager || _isAdmin)) {
      _fetchAllLaserJobs();
      _fetchLaserCatalog();
    }
  }

  Future<void> _addFilamentEntry() async {
    if (_newFilamentMaterial.text.trim().isEmpty) return _snack('재질을 입력해주세요.');
    if (_newFilamentColor.text.trim().isEmpty) return _snack('색상을 입력해주세요.');
    final stock = int.tryParse(_newFilamentStock.text.trim());
    if (stock == null || stock < 0) return _snack('재고 수량을 올바르게 입력해주세요.');
    try {
      await Supabase.instance.client.from('print_materials').insert({
        'material': _newFilamentMaterial.text.trim(),
        'color': _newFilamentColor.text.trim(),
        'stock_count': stock,
      });
      _snack('필라멘트가 등록됐습니다.');
      _newFilamentMaterial.clear();
      _newFilamentColor.clear();
      _newFilamentStock.text = '1';
      _fetchFilamentCatalog();
    } catch (e) {
      _snack(e.toString().contains('23505') ? '이미 등록된 조합입니다.' : '추가 실패: $e');
    }
  }

  Future<void> _adjustFilamentStock(Map<String, dynamic> f, int delta) async {
    final next = (f['stock_count'] as int) + delta;
    if (next < 0) return;
    try {
      await Supabase.instance.client
          .from('print_materials')
          .update({'stock_count': next})
          .eq('id', f['id']);
      _fetchFilamentCatalog();
    } catch (e) {
      _snack('재고 수정 실패: $e');
    }
  }

  Future<void> _removeFilamentEntry(String id) async {
    try {
      await Supabase.instance.client
          .from('print_materials')
          .delete()
          .eq('id', id);
      _snack('필라멘트가 삭제됐습니다.');
      _fetchFilamentCatalog();
    } catch (e) {
      _snack('삭제 실패: $e');
    }
  }

  Future<void> _addLaserCatalogEntry() async {
    final thickness = double.tryParse(_newCatalogThickness.text.trim());
    if (thickness == null || thickness <= 0) return _snack('두께를 올바르게 입력해주세요.');
    try {
      await Supabase.instance.client.from('laser_materials').insert({
        'material': _newCatalogMaterial,
        'thickness_mm': thickness,
      });
      _snack('재질이 등록됐습니다.');
      _fetchLaserCatalog();
    } catch (e) {
      _snack(e.toString().contains('23505') ? '이미 등록된 조합입니다.' : '추가 실패: $e');
    }
  }

  Future<void> _removeLaserCatalogEntry(String id) async {
    try {
      await Supabase.instance.client
          .from('laser_materials')
          .delete()
          .eq('id', id);
      _snack('재질이 삭제됐습니다.');
      _fetchLaserCatalog();
    } catch (e) {
      _snack('삭제 실패: $e');
    }
  }

  Future<void> _updatePrintJobStatus(
    Map<String, dynamic> job,
    String status,
  ) async {
    final updates = <String, dynamic>{'status': status};
    if (status == 'done') {
      updates['completed_at'] = DateTime.now().toIso8601String();
    }
    if (status == 'accepted' && job['manager_id'] == null && _userId != null) {
      updates['manager_id'] = _userId;
    }
    try {
      await Supabase.instance.client
          .from('print_jobs')
          .update(updates)
          .eq('id', job['id']);
      _snack('상태가 $status로 변경됐습니다.');
      _fetchAllPrintJobs();
    } catch (e) {
      _snack('처리 실패: $e');
    }
  }

  Future<void> _rejectJob(String type, String id, String reason) async {
    try {
      await Supabase.instance.client
          .from(type == 'print' ? 'print_jobs' : 'laser_jobs')
          .update({
            'status': 'rejected',
            'reject_reason': reason.isEmpty ? null : reason,
          })
          .eq('id', id);
      _snack('거절 처리했습니다.');
      if (type == 'print') {
        _fetchAllPrintJobs();
      } else {
        _fetchAllLaserJobs();
      }
    } catch (e) {
      _snack('처리 실패: $e');
    }
  }

  Future<void> _openRejectDialog(String type, String id) async {
    final controller = TextEditingController();
    final reason = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('신청 거절'),
        content: TextField(
          controller: controller,
          maxLines: 3,
          decoration: const InputDecoration(
            hintText: '예: 인쇄 시간이 너무 길어 처리가 어렵습니다.',
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('취소'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, controller.text.trim()),
            child: const Text('거절하기', style: TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );
    if (reason != null) _rejectJob(type, id, reason);
  }

  Future<void> _markPrintDelivered(Map<String, dynamic> job) async {
    try {
      await Supabase.instance.client
          .from('print_jobs')
          .update({
            'delivered_at': DateTime.now().toIso8601String(),
            'file_path': null,
            'file_name': null,
          })
          .eq('id', job['id']);
      if (job['file_path'] != null) {
        await Supabase.instance.client.storage.from('manufacturing').remove([
          job['file_path'],
        ]);
      }
      _snack('전달 완료로 표시했습니다.');
      _fetchAllPrintJobs();
    } catch (e) {
      _snack('처리 실패: $e');
    }
  }

  Future<void> _markLaserDelivered(Map<String, dynamic> job) async {
    try {
      await Supabase.instance.client
          .from('laser_jobs')
          .update({
            'delivered_at': DateTime.now().toIso8601String(),
            'file_path': null,
            'file_name': null,
          })
          .eq('id', job['id']);
      if (job['file_path'] != null) {
        await Supabase.instance.client.storage.from('manufacturing').remove([
          job['file_path'],
        ]);
      }
      _snack('전달 완료로 표시했습니다.');
      _fetchAllLaserJobs();
    } catch (e) {
      _snack('처리 실패: $e');
    }
  }

  Future<void> _updateLaserJobStatus(
    Map<String, dynamic> job,
    String status,
  ) async {
    final updates = <String, dynamic>{'status': status};
    if (status == 'done') {
      updates['completed_at'] = DateTime.now().toIso8601String();
    }
    if (status == 'accepted' && job['manager_id'] == null && _userId != null) {
      updates['manager_id'] = _userId;
    }
    try {
      await Supabase.instance.client
          .from('laser_jobs')
          .update(updates)
          .eq('id', job['id']);
      _snack('상태가 변경됐습니다.');
      _fetchAllLaserJobs();
    } catch (e) {
      _snack('처리 실패: $e');
    }
  }

  Future<void> _openQueueDialog(Map<String, dynamic> printer) async {
    final idleJobs = [
      ..._allPrintJobs.where(
        (j) => j['status'] == 'accepted' && j['printer_id'] == null,
      ),
    ]..sort((a, b) => a['created_at'].compareTo(b['created_at']));
    String? selectedJobId;
    var hours = 4.0;
    await showDialog(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: Text('${printer['name']} 인쇄 시작'),
          content: SizedBox(
            width: 380,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                DropdownButtonFormField<String>(
                  initialValue: selectedJobId,
                  decoration: const InputDecoration(labelText: '작업 선택'),
                  items: [
                    for (final j in idleJobs)
                      DropdownMenuItem(
                        value: j['id'] as String,
                        child: Text(
                          '${_requesterLabel(j)} · ${j['file_name']}',
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                  ],
                  onChanged: (v) => setDialogState(() => selectedJobId = v),
                ),
                const SizedBox(height: 12),
                Wrap(
                  spacing: 6,
                  children: [
                    for (final p in _durationPresets)
                      ChoiceChip(
                        label: Text(p.$1),
                        selected: hours == p.$2,
                        onSelected: (_) => setDialogState(() => hours = p.$2),
                      ),
                  ],
                ),
                const SizedBox(height: 8),
                TextField(
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(labelText: '예상 소요 시간'),
                  controller: TextEditingController(text: '$hours'),
                  onChanged: (v) => hours = double.tryParse(v) ?? hours,
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('취소'),
            ),
            ElevatedButton(
              onPressed: () async {
                if (selectedJobId == null) {
                  _snack('작업을 선택해주세요.');
                  return;
                }
                final now = DateTime.now();
                final end = now.add(Duration(minutes: (hours * 60).round()));
                try {
                  await Supabase.instance.client
                      .from('print_jobs')
                      .update({
                        'status': 'printing',
                        'printer_id': printer['id'],
                        'started_at': now.toIso8601String(),
                        'estimated_end_at': end.toIso8601String(),
                      })
                      .eq('id', selectedJobId!);
                  await Supabase.instance.client
                      .from('printers')
                      .update({
                        'status': 'printing',
                        'current_job_id': selectedJobId,
                        'started_at': now.toIso8601String(),
                        'estimated_end_at': end.toIso8601String(),
                      })
                      .eq('id', printer['id']);
                  if (context.mounted) Navigator.pop(context);
                  _snack('인쇄를 시작했습니다.');
                  _loadPrintManagerTab();
                } catch (e) {
                  _snack('시작 실패: $e');
                }
              },
              child: const Text('시작'),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _openPlateComplete(
    Map<String, dynamic> printer,
    Map<String, dynamic> job,
  ) async {
    final usedUpIds = <String>{};
    await showDialog(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: const Text('완료 처리'),
          content: SizedBox(
            width: 360,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Text(
                  '이번에 다 쓴 필라멘트 롤이 있으면 체크해주세요.',
                  style: TextStyle(fontSize: 11, color: Colors.grey),
                ),
                const SizedBox(height: 8),
                for (final f in _filamentCatalog)
                  CheckboxListTile(
                    dense: true,
                    value: usedUpIds.contains(f['id']),
                    onChanged: (_) => setDialogState(
                      () => usedUpIds.contains(f['id'])
                          ? usedUpIds.remove(f['id'])
                          : usedUpIds.add(f['id']),
                    ),
                    title: Text(
                      '${f['material']} · ${f['color']} (재고 ${f['stock_count']})',
                      style: const TextStyle(fontSize: 12),
                    ),
                  ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('취소'),
            ),
            ElevatedButton(
              onPressed: () async {
                for (final id in usedUpIds) {
                  final f = _filamentCatalog.firstWhere((x) => x['id'] == id);
                  await Supabase.instance.client
                      .from('print_materials')
                      .update({
                        'stock_count': (f['stock_count'] as int) - 1 < 0
                            ? 0
                            : (f['stock_count'] as int) - 1,
                      })
                      .eq('id', id);
                }
                if (usedUpIds.isNotEmpty) _fetchFilamentCatalog();

                final newCompleted = (job['plates_completed'] as int? ?? 0) + 1;
                try {
                  if (newCompleted >= (job['plate_count'] as int)) {
                    await Supabase.instance.client
                        .from('print_jobs')
                        .update({
                          'plates_completed': newCompleted,
                          'status': 'done',
                          'completed_at': DateTime.now().toIso8601String(),
                        })
                        .eq('id', job['id']);
                    await Supabase.instance.client
                        .from('printers')
                        .update({'status': 'done', 'estimated_end_at': null})
                        .eq('id', printer['id']);
                    _snack('인쇄 완료 처리했습니다. 회수하면 "회수함"을 눌러주세요.');
                  } else {
                    await Supabase.instance.client
                        .from('print_jobs')
                        .update({'plates_completed': newCompleted})
                        .eq('id', job['id']);
                    _snack('$newCompleted번 플레이트를 완료 처리했습니다.');
                  }
                  if (context.mounted) Navigator.pop(context);
                  _loadPrintManagerTab();
                } catch (e) {
                  _snack('처리 실패: $e');
                }
              },
              child: const Text('완료 처리'),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _collectPrint(Map<String, dynamic> printer) async {
    try {
      if (printer['current_job_id'] != null) {
        await Supabase.instance.client
            .from('print_jobs')
            .update({'collected_at': DateTime.now().toIso8601String()})
            .eq('id', printer['current_job_id']);
      }
      await Supabase.instance.client
          .from('printers')
          .update({
            'status': 'idle',
            'current_job_id': null,
            'started_at': null,
            'estimated_end_at': null,
          })
          .eq('id', printer['id']);
      _snack('회수 처리했습니다. 프린터가 다시 대기 상태가 됐습니다.');
      _loadPrintManagerTab();
    } catch (e) {
      _snack('처리 실패: $e');
    }
  }

  Future<void> _markPrinterBroken(Map<String, dynamic> printer) async {
    try {
      if (printer['current_job_id'] != null &&
          printer['status'] == 'printing') {
        await Supabase.instance.client
            .from('print_jobs')
            .update({
              'status': 'accepted',
              'printer_id': null,
              'started_at': null,
              'estimated_end_at': null,
            })
            .eq('id', printer['current_job_id']);
      }
      await Supabase.instance.client
          .from('printers')
          .update({
            'status': 'maintenance',
            'current_job_id': null,
            'started_at': null,
            'estimated_end_at': null,
          })
          .eq('id', printer['id']);
      _snack('고장으로 표시했습니다.');
      _loadPrintManagerTab();
    } catch (e) {
      _snack('처리 실패: $e');
    }
  }

  Future<void> _repairPrinter(Map<String, dynamic> printer) async {
    try {
      await Supabase.instance.client
          .from('printers')
          .update({'status': 'idle'})
          .eq('id', printer['id']);
      _snack('정상 상태로 복구했습니다.');
      _loadPrintManagerTab();
    } catch (e) {
      _snack('처리 실패: $e');
    }
  }

  Future<void> _showLocateStudent(
    String? studentId,
    String? studentName,
  ) async {
    showDialog(
      context: context,
      builder: (context) => FutureBuilder<locate.LocationResult?>(
        future: locate.locateStudentNow(studentId),
        builder: (context, snapshot) {
          Widget body;
          if (snapshot.connectionState != ConnectionState.done) {
            body = const Padding(
              padding: EdgeInsets.symmetric(vertical: 24),
              child: Center(child: CircularProgressIndicator()),
            );
          } else {
            final result = snapshot.data;
            if (result == null) {
              body = const Padding(
                padding: EdgeInsets.symmetric(vertical: 16),
                child: Text(
                  '학번 정보가 없거나 위치를 확인하지 못했습니다.',
                  textAlign: TextAlign.center,
                ),
              );
            } else if (result is locate.SelfStudyLocation) {
              body = Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    '자습 시간 · ${result.period}교시',
                    style: const TextStyle(
                      fontSize: 11,
                      color: Colors.grey,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    '${result.roomName}${result.seatName != null ? ' · ${result.seatName}' : ''}',
                    style: const TextStyle(
                      fontSize: 22,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ],
              );
            } else if (result is locate.NoSelfStudyLocation) {
              body = Text(
                '현재 ${result.period}교시 자습 시간이지만, 신청 내역이 없습니다.',
                textAlign: TextAlign.center,
              );
            } else if (result is locate.ClassLocation) {
              body = Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    result.period != null
                        ? '일과시간 · ${result.period}교시${result.subject != null ? ' (${result.subject})' : ''}'
                        : '자습 시간 외',
                    style: const TextStyle(
                      fontSize: 11,
                      color: Colors.grey,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    '${result.identity.grade}학년 ${result.identity.classNo}반 교실',
                    style: const TextStyle(
                      fontSize: 22,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ],
              );
            } else {
              body = const SizedBox.shrink();
            }
          }
          return AlertDialog(
            title: Text('${studentName ?? '신청자'} 위치'),
            content: SizedBox(width: 300, child: body),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context),
                child: const Text('닫기'),
              ),
            ],
          );
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final user = Supabase.instance.client.auth.currentUser;
    if (user == null) {
      return AmbientBackground(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.shield_outlined, size: 56, color: Colors.grey),
                const SizedBox(height: 12),
                const Text(
                  'Login Required',
                  style: TextStyle(fontWeight: FontWeight.w900, fontSize: 22),
                ),
                const SizedBox(height: 12),
                ElevatedButton(
                  onPressed: () => context.go('/login'),
                  child: const Text('Login'),
                ),
              ],
            ),
          ),
        ),
      );
    }

    final pendingPrint = _allPrintJobs
        .where((j) => j['status'] == 'pending')
        .length;
    final pendingLaser = _allLaserJobs
        .where((j) => j['status'] == 'pending')
        .length;

    return AmbientBackground(
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 40, 16, 112),
        children: [
          const Text(
            '제작',
            style: TextStyle(
              fontSize: 36,
              fontWeight: FontWeight.w900,
              fontStyle: FontStyle.italic,
              letterSpacing: -1.2,
            ),
          ),
          const SizedBox(height: 4),
          const Text(
            '3D Printing · Laser Cutting',
            style: TextStyle(
              fontSize: 12,
              color: Colors.grey,
              fontWeight: FontWeight.bold,
              letterSpacing: 1.0,
            ),
          ),
          const SizedBox(height: 32),
          Wrap(
            spacing: 6,
            children: [
              ChoiceChip(
                label: const Text('3D 프린팅'),
                selected: _tab == 'print',
                onSelected: (_) => _onTabChanged('print'),
              ),
              ChoiceChip(
                label: const Text('레이저 커팅'),
                selected: _tab == 'laser',
                onSelected: (_) => _onTabChanged('laser'),
              ),
              if (_isPrintManager)
                ChoiceChip(
                  label: Text(
                    '3D 담당자${pendingPrint > 0 ? ' ($pendingPrint)' : ''}',
                  ),
                  selected: _tab == 'print_manager',
                  onSelected: (_) => _onTabChanged('print_manager'),
                ),
              if (_isLaserManager || _isAdmin)
                ChoiceChip(
                  label: Text(
                    '레이저 담당자${pendingLaser > 0 ? ' ($pendingLaser)' : ''}',
                  ),
                  selected: _tab == 'laser_manager',
                  onSelected: (_) => _onTabChanged('laser_manager'),
                ),
            ],
          ),
          const SizedBox(height: 16),
          switch (_tab) {
            'print' => _buildPrintTab(),
            'laser' => _buildLaserTab(),
            'print_manager' => _buildPrintManagerTab(),
            _ => _buildLaserManagerTab(),
          },
        ],
      ),
    );
  }

  Widget _buildPrintTab() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Text(
              '프린터 현황 (Bambu Lab X1C)',
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w900,
                color: Colors.grey.shade700,
              ),
            ),
            const Spacer(),
            ElevatedButton.icon(
              onPressed: () => context
                  .push('/manufacturing/print/new')
                  .then((_) => _loadPrintTab()),
              icon: const Icon(Icons.add, size: 14),
              label: const Text('신청하기'),
            ),
          ],
        ),
        const SizedBox(height: 10),
        GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 2,
            mainAxisSpacing: 10,
            crossAxisSpacing: 10,
            childAspectRatio: 1,
          ),
          itemCount: _printers.length,
          itemBuilder: (context, i) =>
              _printerCard(_printers[i], managerView: false),
        ),
        const SizedBox(height: 20),
        Text(
          '내 신청 내역',
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w900,
            color: Colors.grey.shade700,
          ),
        ),
        const SizedBox(height: 8),
        if (_printLoading)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 32),
            child: Center(child: CircularProgressIndicator()),
          )
        else if (_myPrintJobs.isEmpty)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 32),
            child: Center(
              child: Text('신청 내역이 없습니다.', style: TextStyle(color: Colors.grey)),
            ),
          )
        else
          for (final j in _myPrintJobs) ...[
            _myJobRow(j, isPrint: true),
            const SizedBox(height: 8),
          ],
      ],
    );
  }

  Widget _buildLaserTab() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Text(
              '내 신청 내역',
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w900,
                color: Colors.grey.shade700,
              ),
            ),
            const Spacer(),
            ElevatedButton.icon(
              onPressed: () => context
                  .push('/manufacturing/laser/new')
                  .then((_) => _fetchMyLaserJobs()),
              icon: const Icon(Icons.add, size: 14),
              label: const Text('신청하기'),
            ),
          ],
        ),
        const SizedBox(height: 8),
        if (_laserLoading)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 32),
            child: Center(child: CircularProgressIndicator()),
          )
        else if (_myLaserJobs.isEmpty)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 32),
            child: Center(
              child: Text('신청 내역이 없습니다.', style: TextStyle(color: Colors.grey)),
            ),
          )
        else
          for (final j in _myLaserJobs) ...[
            _myJobRow(j, isPrint: false),
            const SizedBox(height: 8),
          ],
      ],
    );
  }

  Widget _myJobRow(Map<String, dynamic> j, {required bool isPrint}) {
    final status = j['status'] as String;
    final label =
        (isPrint ? _printStatusLabels : _laserStatusLabels)[status] ?? status;
    final color = _statusColors[status] ?? Colors.grey;
    final manager = j['manager'] as Map<String, dynamic>?;

    return GlassCard(
      padding: const EdgeInsets.all(14),
      child: InkWell(
        onTap: () => context
            .push(
              isPrint
                  ? '/manufacturing/print/${j['id']}'
                  : '/manufacturing/laser/${j['id']}',
            )
            .then((_) => isPrint ? _fetchMyPrintJobs() : _fetchMyLaserJobs()),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    j['file_name'] as String? ?? '—',
                    style: const TextStyle(
                      fontWeight: FontWeight.w900,
                      fontSize: 13,
                    ),
                  ),
                  if (manager?['full_name'] != null)
                    Text(
                      '담당: ${manager!['full_name']}',
                      style: const TextStyle(fontSize: 10, color: Colors.grey),
                    ),
                  if (status == 'rejected' && j['reject_reason'] != null)
                    Text(
                      '거절 사유: ${j['reject_reason']}',
                      style: const TextStyle(
                        fontSize: 10,
                        color: Colors.red,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  Text(
                    isPrint
                        ? (j['mode'] == 'beginner' ? '초보자' : '고급자')
                        : '${j['material'] == 'mdf' ? 'MDF' : '아크릴'}${j['thickness_mm'] != null ? ' · ${j['thickness_mm']}mm' : ''}',
                    style: const TextStyle(fontSize: 10, color: Colors.grey),
                  ),
                ],
              ),
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(
                label,
                style: TextStyle(
                  fontSize: 9,
                  fontWeight: FontWeight.w900,
                  color: color,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _printerCard(Map<String, dynamic> p, {required bool managerView}) {
    final status = p['status'] as String;
    final statusLabel =
        {
          'printing': '사용중',
          'done': '회수 대기',
          'maintenance': '고장',
          'idle': '대기',
        }[status] ??
        status;
    final statusColor =
        {
          'printing': Colors.green,
          'done': Colors.amber,
          'maintenance': Colors.red,
          'idle': Colors.grey,
        }[status] ??
        Colors.grey;
    final isMine = _managedPrinterIds.contains(p['id']) || _isAdmin;

    final idleJobsForQueue = _allPrintJobs
        .where((j) => j['status'] == 'accepted' && j['printer_id'] == null)
        .length;

    return GlassCard(
      padding: const EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: double.infinity,
            height: 60,
            decoration: BoxDecoration(
              color: Colors.grey.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(
              Icons.print,
              size: 32,
              color: status == 'printing' ? Colors.green : Colors.grey,
            ),
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: Text(
                  p['name'] as String? ?? '',
                  style: const TextStyle(
                    fontWeight: FontWeight.w900,
                    fontSize: 13,
                  ),
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                decoration: BoxDecoration(
                  color: statusColor.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  statusLabel,
                  style: TextStyle(
                    fontSize: 9,
                    fontWeight: FontWeight.w900,
                    color: statusColor,
                  ),
                ),
              ),
            ],
          ),
          Text(
            '밀린 플레이트 ${_plateBacklog[p['id']] ?? 0}개',
            style: const TextStyle(fontSize: 9, color: Colors.grey),
          ),
          if (!managerView) const SizedBox.shrink(),
          if (managerView) ...[
            const SizedBox(height: 6),
            if (!isMine)
              const Text(
                '담당 프린터가 아닙니다',
                style: TextStyle(fontSize: 9, color: Colors.grey),
              )
            else if (status == 'maintenance')
              SizedBox(
                width: double.infinity,
                child: OutlinedButton(
                  onPressed: () => _repairPrinter(p),
                  child: const Text('정상으로 복구', style: TextStyle(fontSize: 10)),
                ),
              )
            else if (status == 'done')
              Column(
                children: [
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      onPressed: () => _collectPrint(p),
                      child: const Text('회수함', style: TextStyle(fontSize: 10)),
                    ),
                  ),
                  const SizedBox(height: 4),
                  SizedBox(
                    width: double.infinity,
                    child: OutlinedButton(
                      style: OutlinedButton.styleFrom(
                        foregroundColor: Colors.red,
                      ),
                      onPressed: () => _markPrinterBroken(p),
                      child: const Text(
                        '고장 처리',
                        style: TextStyle(fontSize: 10),
                      ),
                    ),
                  ),
                ],
              )
            else if (status == 'printing')
              Column(
                children: [
                  Builder(
                    builder: (context) {
                      final job = _allPrintJobs
                          .where((j) => j['id'] == p['current_job_id'])
                          .firstOrNull;
                      if (job == null) return const SizedBox.shrink();
                      return SizedBox(
                        width: double.infinity,
                        child: OutlinedButton(
                          onPressed: () => _openPlateComplete(p, job),
                          child: Text(
                            '출력 완료 (${job['plates_completed'] ?? 0}/${job['plate_count']})',
                            style: const TextStyle(fontSize: 9),
                          ),
                        ),
                      );
                    },
                  ),
                  const SizedBox(height: 4),
                  SizedBox(
                    width: double.infinity,
                    child: OutlinedButton(
                      style: OutlinedButton.styleFrom(
                        foregroundColor: Colors.red,
                      ),
                      onPressed: () => _markPrinterBroken(p),
                      child: const Text(
                        '고장 처리',
                        style: TextStyle(fontSize: 10),
                      ),
                    ),
                  ),
                ],
              )
            else
              Column(
                children: [
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      onPressed: idleJobsForQueue == 0
                          ? null
                          : () => _openQueueDialog(p),
                      child: const Text(
                        '인쇄 시작',
                        style: TextStyle(fontSize: 10),
                      ),
                    ),
                  ),
                  const SizedBox(height: 4),
                  SizedBox(
                    width: double.infinity,
                    child: OutlinedButton(
                      style: OutlinedButton.styleFrom(
                        foregroundColor: Colors.red,
                      ),
                      onPressed: () => _markPrinterBroken(p),
                      child: const Text(
                        '고장 처리',
                        style: TextStyle(fontSize: 10),
                      ),
                    ),
                  ),
                ],
              ),
          ],
        ],
      ),
    );
  }

  Widget _buildPrintManagerTab() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        GlassCard(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  const Icon(Icons.layers_outlined, size: 16),
                  const SizedBox(width: 6),
                  Text(
                    '필라멘트 카탈로그',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w900,
                      color: Colors.grey.shade700,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              if (_filamentCatalog.isEmpty)
                const Text(
                  '등록된 필라멘트가 없습니다.',
                  style: TextStyle(fontSize: 11, color: Colors.grey),
                )
              else
                for (final f in _filamentCatalog)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 6),
                    child: Row(
                      children: [
                        Expanded(
                          child: Text(
                            '${f['material']} · ${f['color']}${f['stock_count'] == 0 ? ' (품절)' : ''}',
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.bold,
                              color: f['stock_count'] == 0 ? Colors.red : null,
                            ),
                          ),
                        ),
                        IconButton(
                          icon: const Icon(
                            Icons.remove_circle_outline,
                            size: 18,
                          ),
                          onPressed: () => _adjustFilamentStock(f, -1),
                        ),
                        Text(
                          '${f['stock_count']}',
                          style: const TextStyle(fontWeight: FontWeight.w900),
                        ),
                        IconButton(
                          icon: const Icon(Icons.add_circle_outline, size: 18),
                          onPressed: () => _adjustFilamentStock(f, 1),
                        ),
                        IconButton(
                          icon: const Icon(Icons.close, size: 16),
                          onPressed: () => _removeFilamentEntry(f['id']),
                        ),
                      ],
                    ),
                  ),
              const SizedBox(height: 6),
              Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _newFilamentMaterial,
                      decoration: const InputDecoration(hintText: '재질'),
                    ),
                  ),
                  const SizedBox(width: 6),
                  Expanded(
                    child: TextField(
                      controller: _newFilamentColor,
                      decoration: const InputDecoration(hintText: '색상'),
                    ),
                  ),
                  const SizedBox(width: 6),
                  SizedBox(
                    width: 60,
                    child: TextField(
                      controller: _newFilamentStock,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(hintText: '재고'),
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.add),
                    onPressed: _addFilamentEntry,
                  ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        Text(
          '프린터 큐',
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w900,
            color: Colors.grey.shade700,
          ),
        ),
        const SizedBox(height: 8),
        GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 2,
            mainAxisSpacing: 10,
            crossAxisSpacing: 10,
            childAspectRatio: 0.8,
          ),
          itemCount: _printers.length,
          itemBuilder: (context, i) =>
              _printerCard(_printers[i], managerView: true),
        ),
        const SizedBox(height: 20),
        Text(
          '전체 신청 목록',
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w900,
            color: Colors.grey.shade700,
          ),
        ),
        const SizedBox(height: 8),
        if (_managerPrintLoading)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 32),
            child: Center(child: CircularProgressIndicator()),
          )
        else if (_allPrintJobs.isEmpty)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 32),
            child: Center(
              child: Text('신청 내역이 없습니다.', style: TextStyle(color: Colors.grey)),
            ),
          )
        else
          for (final j in _allPrintJobs) ...[
            _managerPrintRow(j),
            const SizedBox(height: 8),
          ],
      ],
    );
  }

  Widget _managerPrintRow(Map<String, dynamic> j) {
    final status = j['status'] as String;
    final label = _printStatusLabels[status] ?? status;
    final color = _statusColors[status] ?? Colors.grey;
    final manager = j['manager'] as Map<String, dynamic>?;
    final requesterId = j['user_id'] as String;
    final requesterProfile = _requesterProfiles[requesterId];

    return GlassCard(
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  _requesterLabel(j),
                  style: const TextStyle(
                    fontWeight: FontWeight.w900,
                    fontSize: 12,
                  ),
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  label,
                  style: TextStyle(
                    fontSize: 9,
                    fontWeight: FontWeight.w900,
                    color: color,
                  ),
                ),
              ),
            ],
          ),
          Text(
            '${j['mode'] == 'beginner' ? '초보자' : '고급자'} · ${j['quantity']}개 · 플레이트 ${j['plate_count']}개${j['material'] != null ? ' · ${j['material']}' : ''}${j['color'] != null ? ' · ${j['color']}' : ''}',
            style: const TextStyle(fontSize: 10, color: Colors.grey),
          ),
          if (j['purpose'] != null)
            Text(
              j['purpose'] as String,
              style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold),
            ),
          if (manager?['full_name'] != null)
            Text(
              '담당: ${manager!['full_name']}',
              style: const TextStyle(fontSize: 10, color: Colors.grey),
            ),
          InkWell(
            onTap: () => context
                .push('/manufacturing/print/${j['id']}')
                .then((_) => _fetchAllPrintJobs()),
            child: const Padding(
              padding: EdgeInsets.only(top: 4),
              child: Text(
                '상세 보기 →',
                style: TextStyle(fontSize: 10, color: Colors.blue),
              ),
            ),
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: [
              if (status == 'pending') ...[
                ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.green.shade700,
                    foregroundColor: Colors.white,
                  ),
                  onPressed: () => _updatePrintJobStatus(j, 'accepted'),
                  child: const Text('수락'),
                ),
                ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.red,
                    foregroundColor: Colors.white,
                  ),
                  onPressed: () => _openRejectDialog('print', j['id']),
                  child: const Text('거절'),
                ),
              ],
              if (status == 'done' && j['delivered_at'] == null) ...[
                OutlinedButton.icon(
                  onPressed: () => _showLocateStudent(
                    requesterProfile?['student_id'],
                    requesterProfile?['full_name'],
                  ),
                  icon: const Icon(Icons.location_on_outlined, size: 14),
                  label: const Text('위치 확인'),
                ),
                ElevatedButton.icon(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.green.shade700,
                    foregroundColor: Colors.white,
                  ),
                  onPressed: () => _markPrintDelivered(j),
                  icon: const Icon(Icons.check, size: 14),
                  label: const Text('가져다 줌'),
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildLaserManagerTab() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        GlassCard(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  const Icon(Icons.layers_outlined, size: 16),
                  const SizedBox(width: 6),
                  Text(
                    '재질 카탈로그',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w900,
                      color: Colors.grey.shade700,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              if (_laserCatalog.isEmpty)
                const Text(
                  '등록된 재질이 없습니다.',
                  style: TextStyle(fontSize: 11, color: Colors.grey),
                )
              else
                Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  children: [
                    for (final c in _laserCatalog)
                      Chip(
                        label: Text(
                          '${c['material'] == 'mdf' ? 'MDF' : '아크릴'} ${c['thickness_mm']}mm',
                          style: const TextStyle(fontSize: 11),
                        ),
                        onDeleted: () => _removeLaserCatalogEntry(c['id']),
                        visualDensity: VisualDensity.compact,
                      ),
                  ],
                ),
              const SizedBox(height: 8),
              Row(
                children: [
                  DropdownButton<String>(
                    value: _newCatalogMaterial,
                    items: const [
                      DropdownMenuItem(value: 'mdf', child: Text('MDF')),
                      DropdownMenuItem(value: 'acrylic', child: Text('아크릴')),
                    ],
                    onChanged: (v) => setState(() => _newCatalogMaterial = v!),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: TextField(
                      controller: _newCatalogThickness,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(hintText: '두께(mm)'),
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.add),
                    onPressed: _addLaserCatalogEntry,
                  ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        Text(
          '전체 신청 목록',
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w900,
            color: Colors.grey.shade700,
          ),
        ),
        const SizedBox(height: 8),
        if (_managerLaserLoading)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 32),
            child: Center(child: CircularProgressIndicator()),
          )
        else if (_allLaserJobs.isEmpty)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 32),
            child: Center(
              child: Text('신청 내역이 없습니다.', style: TextStyle(color: Colors.grey)),
            ),
          )
        else
          for (final j in _allLaserJobs) ...[
            _managerLaserRow(j),
            const SizedBox(height: 8),
          ],
      ],
    );
  }

  Widget _managerLaserRow(Map<String, dynamic> j) {
    final status = j['status'] as String;
    final label = _laserStatusLabels[status] ?? status;
    final color = _statusColors[status] ?? Colors.grey;
    final manager = j['manager'] as Map<String, dynamic>?;
    final requesterId = j['user_id'] as String;
    final requesterProfile = _requesterProfiles[requesterId];

    return GlassCard(
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  _requesterLabel(j),
                  style: const TextStyle(
                    fontWeight: FontWeight.w900,
                    fontSize: 12,
                  ),
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  label,
                  style: TextStyle(
                    fontSize: 9,
                    fontWeight: FontWeight.w900,
                    color: color,
                  ),
                ),
              ),
            ],
          ),
          Text(
            '${j['material'] == 'mdf' ? 'MDF' : '아크릴'}${j['thickness_mm'] != null ? ' · ${j['thickness_mm']}mm' : ''} × ${j['quantity']}',
            style: const TextStyle(fontSize: 10, color: Colors.grey),
          ),
          if (j['purpose'] != null)
            Text(
              j['purpose'] as String,
              style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold),
            ),
          if (manager?['full_name'] != null)
            Text(
              '담당: ${manager!['full_name']}',
              style: const TextStyle(fontSize: 10, color: Colors.grey),
            ),
          InkWell(
            onTap: () => context
                .push('/manufacturing/laser/${j['id']}')
                .then((_) => _fetchAllLaserJobs()),
            child: Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text(
                j['file_name'] as String? ?? '파일 보기',
                style: const TextStyle(fontSize: 10, color: Colors.blue),
              ),
            ),
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: [
              if (status == 'pending') ...[
                ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.green.shade700,
                    foregroundColor: Colors.white,
                  ),
                  onPressed: () => _updateLaserJobStatus(j, 'accepted'),
                  child: const Text('수락'),
                ),
                ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.red,
                    foregroundColor: Colors.white,
                  ),
                  onPressed: () => _openRejectDialog('laser', j['id']),
                  child: const Text('거절'),
                ),
              ],
              if (status == 'accepted')
                OutlinedButton(
                  onPressed: () => _updateLaserJobStatus(j, 'in_progress'),
                  child: const Text('작업 시작'),
                ),
              if (status == 'in_progress')
                ElevatedButton(
                  onPressed: () => _updateLaserJobStatus(j, 'done'),
                  child: const Text('완료'),
                ),
              if (status == 'done' && j['delivered_at'] == null) ...[
                OutlinedButton.icon(
                  onPressed: () => _showLocateStudent(
                    requesterProfile?['student_id'],
                    requesterProfile?['full_name'],
                  ),
                  icon: const Icon(Icons.location_on_outlined, size: 14),
                  label: const Text('위치 확인'),
                ),
                ElevatedButton.icon(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.green.shade700,
                    foregroundColor: Colors.white,
                  ),
                  onPressed: () => _markLaserDelivered(j),
                  icon: const Icon(Icons.check, size: 14),
                  label: const Text('가져다 줌'),
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }
}

extension _FirstOrNullExt<T> on Iterable<T> {
  T? get firstOrNull => isEmpty ? null : first;
}

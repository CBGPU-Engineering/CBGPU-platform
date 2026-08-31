import 'dart:math';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../core/glass.dart';

class AdminScreen extends StatefulWidget {
  const AdminScreen({super.key});
  @override
  State<AdminScreen> createState() => _AdminScreenState();
}

class _AdminScreenState extends State<AdminScreen> {
  bool _loading = true;
  bool _isAdmin = false;
  String _tab = 'gpu';

  List<Map<String, dynamic>> _reservations = [];
  List<Map<String, dynamic>> _cpuProjects = [];
  List<Map<String, dynamic>> _profiles = [];

  List<Map<String, dynamic>> _allProfiles = [];
  List<Map<String, dynamic>> _printers = [];
  List<Map<String, dynamic>> _printerManagers = [];
  List<Map<String, dynamic>> _laserManagers = [];
  final Map<int, String?> _addPrinterManagerSelect = {};
  String? _addLaserManagerSelect;

  final _bannerController = TextEditingController();
  bool _bannerActive = false;
  bool _bannerSaving = false;

  @override
  void initState() {
    super.initState();
    _init();
  }

  @override
  void dispose() {
    _bannerController.dispose();
    super.dispose();
  }

  Future<void> _init() async {
    final user = Supabase.instance.client.auth.currentUser;
    if (user == null) {
      setState(() => _loading = false);
      return;
    }
    final profile = await Supabase.instance.client.from('profiles').select('is_admin').eq('id', user.id).maybeSingle();
    final isAdmin = profile?['is_admin'] == true;
    setState(() { _isAdmin = isAdmin; _loading = false; });
    if (isAdmin) {
      _fetchReservations();
      _fetchCpuProjects();
      _fetchProfiles();
      _fetchBanner();
      _fetchManufactureData();
    }
  }

  void _snack(String msg) {
    if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
  }

  Future<void> _fetchReservations() async {
    try {
      final rows = await Supabase.instance.client.from('reservations').select('*, profiles:user_id(full_name, student_id)').order('created_at', ascending: false).limit(1000);
      if (mounted) setState(() => _reservations = (rows as List).cast<Map<String, dynamic>>());
    } catch (_) {
      _snack('데이터 로드 실패.');
    }
  }

  String _generatePassword() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    final rand = Random.secure();
    return List.generate(16, (_) => chars[rand.nextInt(chars.length)]).join();
  }

  Future<void> _updateReservationStatus(String id, String newStatus, int? gpuId) async {
    if (newStatus == 'approved' && gpuId != null) {
      final target = _reservations.firstWhere((r) => r['id'] == id, orElse: () => {});
      if (target.isNotEmpty) {
        final targetStart = DateTime.parse(target['start_time']);
        final targetEnd = DateTime.parse(target['end_time']);
        final conflict = _reservations.any((r) =>
            r['id'] != id &&
            r['gpu_id'] == gpuId &&
            r['status'] == 'approved' &&
            DateTime.parse(r['start_time']).isBefore(targetEnd) &&
            DateTime.parse(r['end_time']).isAfter(targetStart));
        if (conflict) {
          _snack('승인 불가: 이미 확정된 예약과 시간이 겹칩니다.');
          return;
        }
      }
      try {
        await Supabase.instance.client.from('gpus').upsert({'id': gpuId, 'password': _generatePassword()}, onConflict: 'id');
      } catch (e) {
        _snack('비밀번호 생성 실패: $e');
        return;
      }
    }
    try {
      await Supabase.instance.client.from('reservations').update({'status': newStatus}).eq('id', id);
      _snack('상태가 $newStatus로 변경됐습니다.');
      _fetchReservations();
    } catch (e) {
      _snack('처리 실패: $e');
    }
  }

  Future<void> _fetchCpuProjects() async {
    try {
      final rows = await Supabase.instance.client.from('cpu_projects').select('*').neq('status', 'deleted').order('created_at', ascending: false).limit(1000);
      if (mounted) setState(() => _cpuProjects = (rows as List).cast<Map<String, dynamic>>());
    } catch (_) {
      _snack('서버 프로젝트 로드 실패.');
    }
  }

  Future<void> _updateCpuStatus(String id, String newStatus) async {
    final updates = <String, dynamic>{'status': newStatus};
    if (newStatus == 'approved') updates['deploy_requested_at'] = DateTime.now().toIso8601String();
    try {
      await Supabase.instance.client.from('cpu_projects').update(updates).eq('id', id);
      _snack('상태가 $newStatus로 변경됐습니다.');
      _fetchCpuProjects();
    } catch (e) {
      _snack('처리 실패: $e');
    }
  }

  Future<void> _fetchProfiles() async {
    try {
      final rows = await Supabase.instance.client.from('profiles').select('id, student_id, full_name, is_admin, is_approved, is_laser_cut_manager').order('is_approved', ascending: true, nullsFirst: true).order('full_name');
      if (mounted) setState(() => _profiles = (rows as List).cast<Map<String, dynamic>>());
    } catch (_) {
      _snack('계정 목록 로드 실패.');
    }
  }

  Future<void> _setProfileApproval(String id, bool approved) async {
    try {
      await Supabase.instance.client.from('profiles').update({'is_approved': approved}).eq('id', id);
      _snack(approved ? '승인 처리됐습니다.' : '학번/이름 확인이 필요한 상태로 표시했습니다.');
      _fetchProfiles();
    } catch (e) {
      _snack('처리 실패: $e');
    }
  }

  Future<void> _toggleLaserManager(String id, bool current) async {
    try {
      await Supabase.instance.client.from('profiles').update({'is_laser_cut_manager': !current}).eq('id', id);
      _snack(!current ? '레이저 담당자로 지정됐습니다.' : '레이저 담당자 지정이 해제됐습니다.');
      _fetchProfiles();
      _fetchLaserManagers();
    } catch (e) {
      _snack('처리 실패: $e');
    }
  }

  Future<void> _fetchAllProfiles() async {
    final rows = await Supabase.instance.client.from('profiles').select('id, full_name, student_id').order('student_id');
    if (mounted) setState(() => _allProfiles = (rows as List).cast<Map<String, dynamic>>());
  }

  Future<void> _fetchPrinters() async {
    final rows = await Supabase.instance.client.from('printers').select('*').order('id');
    if (mounted) setState(() => _printers = (rows as List).cast<Map<String, dynamic>>());
  }

  Future<void> _fetchPrinterManagers() async {
    final rows = await Supabase.instance.client.from('printer_managers').select('printer_id, user_id, profiles:user_id(full_name, student_id)');
    if (mounted) setState(() => _printerManagers = (rows as List).cast<Map<String, dynamic>>());
  }

  Future<void> _fetchLaserManagers() async {
    final rows = await Supabase.instance.client.from('profiles').select('id, full_name, student_id').eq('is_laser_cut_manager', true).order('student_id');
    if (mounted) setState(() => _laserManagers = (rows as List).cast<Map<String, dynamic>>());
  }

  Future<void> _fetchManufactureData() async {
    await Future.wait([_fetchAllProfiles(), _fetchPrinters(), _fetchPrinterManagers(), _fetchLaserManagers()]);
  }

  Future<void> _addPrinterManager(int printerId) async {
    final userId = _addPrinterManagerSelect[printerId];
    if (userId == null || userId.isEmpty) {
      _snack('담당자로 지정할 사람을 선택해주세요.');
      return;
    }
    try {
      await Supabase.instance.client.from('printer_managers').insert({'printer_id': printerId, 'user_id': userId});
      _snack('담당자가 추가됐습니다.');
      setState(() => _addPrinterManagerSelect[printerId] = null);
      _fetchPrinterManagers();
    } catch (e) {
      _snack('추가 실패: $e');
    }
  }

  Future<void> _removePrinterManager(int printerId, String userId) async {
    try {
      await Supabase.instance.client.from('printer_managers').delete().eq('printer_id', printerId).eq('user_id', userId);
      _snack('담당자가 제거됐습니다.');
      _fetchPrinterManagers();
    } catch (e) {
      _snack('제거 실패: $e');
    }
  }

  Future<void> _addLaserManager() async {
    if (_addLaserManagerSelect == null || _addLaserManagerSelect!.isEmpty) {
      _snack('담당자로 지정할 사람을 선택해주세요.');
      return;
    }
    await _toggleLaserManager(_addLaserManagerSelect!, false);
    setState(() => _addLaserManagerSelect = null);
  }

  Future<void> _fetchBanner() async {
    try {
      final row = await Supabase.instance.client.from('site_banner').select('message, is_active').eq('id', 1).maybeSingle();
      if (mounted) setState(() { _bannerController.text = row?['message'] as String? ?? ''; _bannerActive = row?['is_active'] as bool? ?? false; });
    } catch (_) {
      _snack('배너 로드 실패.');
    }
  }

  Future<void> _saveBanner(bool active) async {
    setState(() => _bannerSaving = true);
    try {
      await Supabase.instance.client.from('site_banner').upsert({'id': 1, 'message': _bannerController.text, 'is_active': active}, onConflict: 'id');
      setState(() => _bannerActive = active);
      _snack(active ? '배너를 켰습니다.' : '배너를 껐습니다.');
    } catch (e) {
      _snack('저장 실패: $e');
    } finally {
      if (mounted) setState(() => _bannerSaving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const AmbientBackground(child: Center(child: CircularProgressIndicator()));
    if (!_isAdmin) {
      return AmbientBackground(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              const Icon(Icons.shield_outlined, size: 56, color: Colors.red),
              const SizedBox(height: 12),
              const Text('Access Denied', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 24)),
              const Text('Administrator privileges required.', style: TextStyle(color: Colors.grey, fontSize: 12)),
              const SizedBox(height: 16),
              OutlinedButton(onPressed: () => context.go('/'), child: const Text('Return Home')),
            ]),
          ),
        ),
      );
    }

    final pendingCpu = _cpuProjects.where((p) => p['status'] == 'pending').length;
    final unreviewed = _profiles.where((p) => p['is_approved'] == null || p['is_approved'] == false).length;

    return AmbientBackground(
      child: ListView(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 100),
        children: [
          Row(children: [
            TextButton.icon(onPressed: () => context.go('/'), icon: const Icon(Icons.arrow_back, size: 16), label: const Text('Admin Control', style: TextStyle(fontWeight: FontWeight.w900))),
            const Spacer(),
            OutlinedButton.icon(onPressed: () => context.push('/admin/study'), icon: const Icon(Icons.key, size: 14), label: const Text('자습신청 토큰')),
          ]),
          const SizedBox(height: 16),
          GlassCard(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(children: [
                  const Icon(Icons.campaign_outlined, size: 16),
                  const SizedBox(width: 6),
                  Text('전체 공지 배너', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w900, color: Colors.grey.shade600)),
                  if (_bannerActive) Padding(padding: const EdgeInsets.only(left: 6), child: Container(padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1), decoration: BoxDecoration(color: Colors.green.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(8)), child: const Text('표시 중', style: TextStyle(fontSize: 9, fontWeight: FontWeight.w900, color: Colors.green)))),
                ]),
                const SizedBox(height: 6),
                const Text('켜두면 로그인 여부와 상관없이 모든 페이지 상단에 이 문구가 보입니다.', style: TextStyle(fontSize: 11, color: Colors.grey)),
                const SizedBox(height: 10),
                TextField(controller: _bannerController, maxLines: 3, decoration: const InputDecoration(hintText: '예: 7/10(금) 03:00~05:00 서버 점검이 있습니다.')),
                const SizedBox(height: 10),
                Row(children: [
                  ElevatedButton.icon(
                    style: ElevatedButton.styleFrom(backgroundColor: Colors.green.shade700, foregroundColor: Colors.white),
                    onPressed: (_bannerSaving || _bannerController.text.trim().isEmpty) ? null : () => _saveBanner(true),
                    icon: const Icon(Icons.campaign, size: 14),
                    label: const Text('저장하고 켜기'),
                  ),
                  const SizedBox(width: 8),
                  OutlinedButton(onPressed: (_bannerSaving || !_bannerActive) ? null : () => _saveBanner(false), child: const Text('끄기')),
                ]),
              ],
            ),
          ),
          const SizedBox(height: 16),
          Wrap(spacing: 6, children: [
            ChoiceChip(label: const Text('GPU 예약'), selected: _tab == 'gpu', onSelected: (_) => setState(() => _tab = 'gpu')),
            ChoiceChip(label: Text('서버 배포${pendingCpu > 0 ? ' ($pendingCpu)' : ''}'), selected: _tab == 'server', onSelected: (_) => setState(() => _tab = 'server')),
            ChoiceChip(label: Text('계정${unreviewed > 0 ? ' ($unreviewed)' : ''}'), selected: _tab == 'accounts', onSelected: (_) => setState(() => _tab = 'accounts')),
            ChoiceChip(label: const Text('Manufacture'), selected: _tab == 'manufacture', onSelected: (_) => setState(() => _tab = 'manufacture')),
          ]),
          const SizedBox(height: 16),
          switch (_tab) {
            'gpu' => _buildGpuTab(),
            'server' => _buildServerTab(),
            'accounts' => _buildAccountsTab(),
            _ => _buildManufactureTab(),
          },
        ],
      ),
    );
  }

  Widget _buildGpuTab() {
    if (_reservations.isEmpty) return const Padding(padding: EdgeInsets.symmetric(vertical: 48), child: Center(child: Text('No pending requests found.', style: TextStyle(color: Colors.grey))));
    return Column(children: [
      for (final r in _reservations) ...[_reservationRow(r), const SizedBox(height: 8)],
    ]);
  }

  Widget _reservationRow(Map<String, dynamic> r) {
    final profile = r['profiles'] as Map<String, dynamic>?;
    final start = DateTime.parse(r['start_time']);
    final end = DateTime.parse(r['end_time']);
    final isEnded = DateTime.now().isAfter(end);
    final status = r['status'] as String;
    final statusColor = {'pending': Colors.amber, 'approved': Colors.green, 'rejected': Colors.red}[status] ?? Colors.grey;

    return GlassCard(
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(profile?['full_name'] as String? ?? 'Unknown', style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 13)),
                  Text(profile?['student_id'] as String? ?? r['user_email'] as String? ?? '', style: const TextStyle(fontSize: 10, color: Colors.grey)),
                ],
              ),
            ),
            Text('GPU #${r['gpu_id']}', style: TextStyle(fontWeight: FontWeight.w900, fontStyle: FontStyle.italic, color: Theme.of(context).colorScheme.primary)),
            const SizedBox(width: 8),
            Container(padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2), decoration: BoxDecoration(color: statusColor.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(8)), child: Text(status, style: TextStyle(fontSize: 9, fontWeight: FontWeight.w900, color: statusColor))),
          ]),
          const SizedBox(height: 6),
          Text('${start.toLocal()} → ${end.toLocal()}'.replaceAll('.000', ''), style: const TextStyle(fontSize: 10, color: Colors.grey)),
          const SizedBox(height: 8),
          if (isEnded)
            const Text('Session Finished', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: Colors.grey))
          else if (status == 'pending')
            Row(children: [
              ElevatedButton(style: ElevatedButton.styleFrom(backgroundColor: Colors.green.shade700, foregroundColor: Colors.white), onPressed: () => _updateReservationStatus(r['id'], 'approved', r['gpu_id']), child: const Text('Approve')),
              const SizedBox(width: 6),
              ElevatedButton(style: ElevatedButton.styleFrom(backgroundColor: Colors.red, foregroundColor: Colors.white), onPressed: () => _updateReservationStatus(r['id'], 'rejected', null), child: const Text('Reject')),
            ])
          else
            OutlinedButton.icon(onPressed: () => _updateReservationStatus(r['id'], 'pending', null), icon: const Icon(Icons.undo, size: 14), label: const Text('Reset')),
        ],
      ),
    );
  }

  Widget _buildServerTab() {
    if (_cpuProjects.isEmpty) return const Padding(padding: EdgeInsets.symmetric(vertical: 48), child: Center(child: Text('No server projects found.', style: TextStyle(color: Colors.grey))));
    return Column(children: [
      for (final p in _cpuProjects) ...[_projectRow(p), const SizedBox(height: 8)],
    ]);
  }

  Widget _projectRow(Map<String, dynamic> p) {
    final status = p['status'] as String;
    final statusColor = {'pending': Colors.amber, 'approved': Colors.green, 'rejected': Colors.red}[status] ?? Colors.grey;
    final isDocker = p['deploy_type'] == 'docker';

    return GlassCard(
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            Expanded(child: Text(p['name'] as String? ?? '', style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 13))),
            Container(padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2), decoration: BoxDecoration(color: statusColor.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(8)), child: Text(status, style: TextStyle(fontSize: 9, fontWeight: FontWeight.w900, color: statusColor))),
          ]),
          Text(isDocker ? (p['docker_image'] as String? ?? '') : ((p['git_url'] as String?)?.replaceFirst('https://', '') ?? ''), style: const TextStyle(fontSize: 10, color: Colors.grey)),
          const SizedBox(height: 4),
          Text('Port: ${p['host_port']}:${p['container_port']} · CPU: ${p['cpu_limit']} · Mem: ${p['memory_limit']} · ${p['access_scope']}', style: const TextStyle(fontSize: 10, color: Colors.grey)),
          const SizedBox(height: 8),
          Wrap(spacing: 6, runSpacing: 6, children: [
            OutlinedButton.icon(onPressed: () => context.push('/server/${p['id']}'), icon: const Icon(Icons.dns_outlined, size: 14), label: const Text('상세')),
            if (status == 'pending') ...[
              ElevatedButton(style: ElevatedButton.styleFrom(backgroundColor: Colors.green.shade700, foregroundColor: Colors.white), onPressed: () => _updateCpuStatus(p['id'], 'approved'), child: const Text('Approve')),
              ElevatedButton(style: ElevatedButton.styleFrom(backgroundColor: Colors.red, foregroundColor: Colors.white), onPressed: () => _updateCpuStatus(p['id'], 'rejected'), child: const Text('Reject')),
            ] else if (status == 'approved' || status == 'rejected')
              OutlinedButton.icon(onPressed: () => _updateCpuStatus(p['id'], 'pending'), icon: const Icon(Icons.undo, size: 14), label: const Text('Reset')),
          ]),
        ],
      ),
    );
  }

  Widget _buildAccountsTab() {
    if (_profiles.isEmpty) return const Padding(padding: EdgeInsets.symmetric(vertical: 48), child: Center(child: Text('No accounts found.', style: TextStyle(color: Colors.grey))));
    return Column(children: [
      for (final p in _profiles) ...[_profileRow(p), const SizedBox(height: 8)],
    ]);
  }

  Widget _profileRow(Map<String, dynamic> p) {
    final approved = p['is_approved'];
    final (label, color) = approved == false ? ('제한됨', Colors.red) : (approved == null ? ('미검토', Colors.amber) : ('승인됨', Colors.green));

    return GlassCard(
      padding: const EdgeInsets.all(14),
      child: Row(children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Wrap(spacing: 4, crossAxisAlignment: WrapCrossAlignment.center, children: [
                Text(p['full_name'] as String? ?? 'Unknown', style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 13)),
                if (p['is_admin'] == true) _tag('Admin', Colors.amber),
                if (p['is_laser_cut_manager'] == true) _tag('레이저 담당', Colors.blue),
              ]),
              Text(p['student_id'] as String? ?? '-', style: const TextStyle(fontSize: 11, color: Colors.grey, fontWeight: FontWeight.bold)),
              Padding(padding: const EdgeInsets.only(top: 4), child: Container(padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2), decoration: BoxDecoration(color: color.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(8)), child: Text(label, style: TextStyle(fontSize: 9, fontWeight: FontWeight.w900, color: color)))),
            ],
          ),
        ),
        Column(children: [
          if (approved != true) SizedBox(width: 100, child: ElevatedButton(style: ElevatedButton.styleFrom(backgroundColor: Colors.green.shade700, foregroundColor: Colors.white, padding: EdgeInsets.zero), onPressed: () => _setProfileApproval(p['id'], true), child: const Text('승인', style: TextStyle(fontSize: 11)))),
          if (approved != false) Padding(padding: const EdgeInsets.only(top: 6), child: SizedBox(width: 100, child: ElevatedButton(style: ElevatedButton.styleFrom(backgroundColor: Colors.red, foregroundColor: Colors.white, padding: EdgeInsets.zero), onPressed: () => _setProfileApproval(p['id'], false), child: const Text('확인 필요', style: TextStyle(fontSize: 11))))),
        ]),
      ]),
    );
  }

  Widget _tag(String label, Color color) => Container(padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1), decoration: BoxDecoration(color: color.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(8)), child: Text(label, style: TextStyle(fontSize: 9, fontWeight: FontWeight.w900, color: color)));

  Widget _buildManufactureTab() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(children: [const Icon(Icons.print_outlined, size: 16), const SizedBox(width: 6), Text('3D 프린터 담당자', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w900, color: Colors.grey.shade700))]),
        const SizedBox(height: 4),
        const Text('프린터를 먼저 고르고, 그 프린터를 담당할 사람을 추가하세요.', style: TextStyle(fontSize: 10, color: Colors.grey)),
        const SizedBox(height: 10),
        for (final printer in _printers) ...[_printerManagerCard(printer), const SizedBox(height: 8)],
        const SizedBox(height: 20),
        Row(children: [const Icon(Icons.content_cut, size: 16), const SizedBox(width: 6), Text('레이저 커팅 담당자', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w900, color: Colors.grey.shade700))]),
        const SizedBox(height: 10),
        GlassCard(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (_laserManagers.isEmpty) const Text('담당자 없음', style: TextStyle(fontSize: 11, color: Colors.grey)) else Wrap(spacing: 6, runSpacing: 6, children: [for (final m in _laserManagers) _personChip(m['full_name'] as String? ?? 'Unknown', m['student_id'] as String?, () => _toggleLaserManager(m['id'], true))]),
              const SizedBox(height: 10),
              Row(children: [
                Expanded(child: _personDropdown(_allProfiles.where((p) => !_laserManagers.any((m) => m['id'] == p['id'])).toList(), _addLaserManagerSelect, (v) => setState(() => _addLaserManagerSelect = v))),
                const SizedBox(width: 8),
                ElevatedButton.icon(onPressed: _addLaserManager, icon: const Icon(Icons.add, size: 14), label: const Text('추가')),
              ]),
            ],
          ),
        ),
      ],
    );
  }

  Widget _printerManagerCard(Map<String, dynamic> printer) {
    final assigned = _printerManagers.where((pm) => pm['printer_id'] == printer['id']).toList();
    final assignedIds = assigned.map((a) => a['user_id']).toSet();
    final candidates = _allProfiles.where((p) => !assignedIds.contains(p['id'])).toList();

    return GlassCard(
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(printer['name'] as String? ?? '', style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 13)),
          const SizedBox(height: 6),
          if (assigned.isEmpty)
            const Text('담당자 없음', style: TextStyle(fontSize: 11, color: Colors.grey))
          else
            Wrap(spacing: 6, runSpacing: 6, children: [
              for (final a in assigned) _personChip((a['profiles'] as Map<String, dynamic>?)?['full_name'] as String? ?? 'Unknown', (a['profiles'] as Map<String, dynamic>?)?['student_id'] as String?, () => _removePrinterManager(printer['id'], a['user_id'])),
            ]),
          const SizedBox(height: 8),
          Row(children: [
            Expanded(child: _personDropdown(candidates, _addPrinterManagerSelect[printer['id']], (v) => setState(() => _addPrinterManagerSelect[printer['id']] = v))),
            const SizedBox(width: 8),
            ElevatedButton.icon(onPressed: () => _addPrinterManager(printer['id']), icon: const Icon(Icons.add, size: 14), label: const Text('추가')),
          ]),
        ],
      ),
    );
  }

  Widget _personChip(String name, String? studentId, VoidCallback onRemove) {
    return Chip(label: Text('$name${studentId != null ? ' ($studentId)' : ''}', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold)), onDeleted: onRemove, visualDensity: VisualDensity.compact);
  }

  Widget _personDropdown(List<Map<String, dynamic>> candidates, String? value, ValueChanged<String?> onChanged) {
    // Keyed on candidate-set size so the displayed text resets after a
    // selection is consumed (add) — DropdownMenu only reads initialSelection
    // on first build, so without a changing key it would keep showing the
    // just-picked name even after the parent's value goes back to null.
    return DropdownMenu<String>(
      key: ValueKey(candidates.length),
      width: double.infinity,
      initialSelection: value,
      hintText: '이름/학번 검색',
      textStyle: const TextStyle(fontSize: 12),
      dropdownMenuEntries: [for (final c in candidates) DropdownMenuEntry(value: c['id'] as String, label: '${c['full_name'] ?? 'Unknown'} (${c['student_id'] ?? '-'})')],
      onSelected: onChanged,
    );
  }
}

import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:http/http.dart' as http;
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/api_config.dart';
import '../../core/glass.dart';

const _weekdaysMon = ['월', '화', '수', '목', '금', '토', '일'];
const _gpuColors = {
  1: Color(0xFF3B82F6),
  2: Color(0xFF8B5CF6),
  3: Color(0xFF10B981),
  4: Color(0xFFF97316),
};

String _fmtDateTime(DateTime d) => '${d.year}.${d.month}.${d.day} ${d.hour.toString().padLeft(2, '0')}:${d.minute.toString().padLeft(2, '0')}';
String _fmtMd(DateTime d) => '${d.month}/${d.day}';
String _fmtMdWeekday(DateTime d) => '${d.month}/${d.day}(${_weekdaysMon[d.weekday - 1]})';

class _Reservation {
  _Reservation({required this.id, required this.gpuId, required this.userId, required this.start, required this.end, required this.status, this.fullName, this.studentId});
  final String id;
  final int gpuId;
  final String userId;
  final DateTime start;
  final DateTime end;
  final String status;
  final String? fullName;
  final String? studentId;

  factory _Reservation.fromRow(Map<String, dynamic> r) {
    final profile = r['profiles'] as Map<String, dynamic>?;
    return _Reservation(
      id: r['id'] as String,
      gpuId: r['gpu_id'] as int,
      userId: r['user_id'] as String? ?? '',
      start: DateTime.parse(r['start_time'] as String),
      end: DateTime.parse(r['end_time'] as String),
      status: r['status'] as String? ?? 'pending',
      fullName: profile?['full_name'] as String?,
      studentId: profile?['student_id'] as String?,
    );
  }
}

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});
  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  Map<int, String> _gpuStatus = {1: 'checking', 2: 'checking', 3: 'checking', 4: 'checking'};
  DateTime _currentMonth = DateTime(DateTime.now().year, DateTime.now().month);
  List<_Reservation> _calendarReservations = [];
  DateTime? _selectedDay;
  bool _calendarLoading = true;

  int _selectedGpuId = 1;
  bool _isApproved = true;

  List<_Reservation> _myReservations = [];
  Map<int, String> _gpuPasswords = {};
  bool _loading = true;
  String? _openReservationId;
  Map<int, double> _statsHours = {};
  RealtimeChannel? _channel;
  Timer? _clockTimer;
  DateTime _now = DateTime.now();

  String? get _userId => Supabase.instance.client.auth.currentUser?.id;

  @override
  void initState() {
    super.initState();
    _checkGpuStatus();
    _loadCalendar();
    _clockTimer = Timer.periodic(const Duration(minutes: 1), (_) {
      if (mounted) setState(() => _now = DateTime.now());
    });
    _init();
  }

  Future<void> _init() async {
    final user = Supabase.instance.client.auth.currentUser;
    if (user != null) {
      final profile = await Supabase.instance.client.from('profiles').select('is_approved').eq('id', user.id).maybeSingle();
      if (mounted) setState(() => _isApproved = profile?['is_approved'] != false);
      _loadMyReservations();
      _loadPasswords();
      _loadStats();
      _channel = Supabase.instance.client
          .channel('dashboard-rt')
          .onPostgresChanges(event: PostgresChangeEvent.all, schema: 'public', table: 'reservations', callback: (_) { _loadMyReservations(); _loadCalendar(); })
          .subscribe();
    } else {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  void dispose() {
    _clockTimer?.cancel();
    if (_channel != null) Supabase.instance.client.removeChannel(_channel!);
    super.dispose();
  }

  Future<void> _checkGpuStatus() async {
    setState(() => _gpuStatus = {1: 'checking', 2: 'checking', 3: 'checking', 4: 'checking'});
    try {
      final res = await http.get(Uri.parse('${ApiConfig.functionsUrl}/gpu-status')).timeout(const Duration(seconds: 10));
      final body = jsonDecode(res.body) as Map<String, dynamic>;
      final map = <int, String>{};
      for (final g in body['gpus'] as List) {
        map[g['id'] as int] = g['status'] as String;
      }
      if (mounted) setState(() => _gpuStatus = map);
    } catch (_) {
      if (mounted) setState(() => _gpuStatus = {1: 'offline', 2: 'offline', 3: 'offline', 4: 'offline'});
    }
  }

  DateTime get _gridStart {
    final monthStart = DateTime(_currentMonth.year, _currentMonth.month, 1);
    final diff = (monthStart.weekday - 1) % 7;
    return monthStart.subtract(Duration(days: diff));
  }

  DateTime get _gridEnd {
    final monthEnd = DateTime(_currentMonth.year, _currentMonth.month + 1, 0);
    final diff = (7 - monthEnd.weekday) % 7;
    return monthEnd.add(Duration(days: diff));
  }

  Future<void> _loadCalendar() async {
    setState(() => _calendarLoading = true);
    try {
      final rows = await Supabase.instance.client
          .from('reservations')
          .select('id, gpu_id, user_id, start_time, end_time, status, profiles:user_id(full_name, student_id)')
          .eq('status', 'approved')
          .lt('start_time', _gridEnd.add(const Duration(days: 1)).toIso8601String())
          .gt('end_time', _gridStart.toIso8601String())
          .order('start_time');
      if (mounted) setState(() => _calendarReservations = (rows as List).map((r) => _Reservation.fromRow(r as Map<String, dynamic>)).toList());
    } finally {
      if (mounted) setState(() => _calendarLoading = false);
    }
  }

  Future<void> _loadMyReservations() async {
    final user = Supabase.instance.client.auth.currentUser;
    if (user == null) return;
    final rows = await Supabase.instance.client.from('reservations').select('*').eq('user_id', user.id).order('created_at', ascending: false);
    if (mounted) setState(() { _myReservations = (rows as List).map((r) => _Reservation.fromRow(r as Map<String, dynamic>)).toList(); _loading = false; });
  }

  Future<void> _loadPasswords() async {
    final user = Supabase.instance.client.auth.currentUser;
    if (user == null) return;
    final approved = await Supabase.instance.client.from('reservations').select('gpu_id').eq('user_id', user.id).eq('status', 'approved');
    final gpuIds = (approved as List).map((r) => r['gpu_id'] as int).toSet();
    final map = <int, String>{};
    for (final id in gpuIds) {
      try {
        final password = await Supabase.instance.client.rpc('get_active_gpu_password', params: {'p_gpu_id': id});
        if (password != null) map[id] = password as String;
      } catch (_) {}
    }
    if (mounted) setState(() => _gpuPasswords = map);
  }

  Future<void> _loadStats() async {
    final since = DateTime.now().subtract(const Duration(days: 30));
    final rows = await Supabase.instance.client.from('reservations').select('gpu_id, start_time, end_time').gte('start_time', since.toIso8601String());
    final hours = {1: 0.0, 2: 0.0, 3: 0.0, 4: 0.0};
    for (final r in rows as List) {
      final gpuId = r['gpu_id'] as int;
      if (gpuId < 1 || gpuId > 4) continue;
      final s = DateTime.parse(r['start_time'] as String);
      final e = DateTime.parse(r['end_time'] as String);
      hours[gpuId] = (hours[gpuId] ?? 0) + e.difference(s).inMinutes / 60.0;
    }
    if (mounted) setState(() => _statsHours = hours.map((k, v) => MapEntry(k, (v * 10).round() / 10)));
  }

  List<_Reservation> _reservationsForDay(DateTime day) {
    final dayStart = DateTime(day.year, day.month, day.day);
    final dayEnd = dayStart.add(const Duration(days: 1)).subtract(const Duration(milliseconds: 1));
    return _calendarReservations.where((r) => r.start.isBefore(dayEnd) && r.end.isAfter(dayStart)).toList();
  }

  Future<void> _cancelReservation(String id) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('예약을 취소하시겠습니까?'),
        actions: [TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('돌아가기')), TextButton(onPressed: () => Navigator.pop(context, true), child: const Text('취소하기', style: TextStyle(color: Colors.red)))],
      ),
    );
    if (confirmed != true) return;
    try {
      await Supabase.instance.client.from('reservations').delete().eq('id', id);
      _snack('예약이 취소됐습니다.');
      _loadMyReservations();
    } catch (e) {
      _snack('취소 실패: $e');
    }
  }

  Future<void> _endSession(String id) async {
    try {
      await Supabase.instance.client.from('reservations').update({'end_time': DateTime.now().toIso8601String()}).eq('id', id);
      _snack('세션이 종료됐습니다.');
      setState(() => _openReservationId = null);
      _loadMyReservations();
    } catch (e) {
      _snack('세션 종료 실패: $e');
    }
  }

  void _snack(String msg) {
    if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
  }

  Future<void> _exportIcal() async {
    if (_myReservations.isEmpty) {
      _snack('예약이 없습니다.');
      return;
    }
    String fmtDt(DateTime d) => '${d.toUtc().toIso8601String().replaceAll(RegExp(r'[-:]'), '').split('.').first}Z';
    final events = _myReservations.map((r) => ['BEGIN:VEVENT', 'DTSTART:${fmtDt(r.start)}', 'DTEND:${fmtDt(r.end)}', 'SUMMARY:GPU ${r.gpuId} 예약 — CBGPU', 'UID:cbgpu-${r.id}@cbgpu.vercel.app', 'END:VEVENT'].join('\r\n')).join('\r\n');
    final ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//CBGPU//KO', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:CBGPU 예약', 'X-WR-TIMEZONE:Asia/Seoul', events, 'END:VCALENDAR'].join('\r\n');
    final dir = await getTemporaryDirectory();
    final file = File('${dir.path}/cbgpu-reservations.ics');
    await file.writeAsString(ics);
    await SharePlus.instance.share(ShareParams(files: [XFile(file.path)], text: 'CBGPU 예약'));
  }

  @override
  Widget build(BuildContext context) {
    return AmbientBackground(
      child: ListView(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 100),
        children: [
          Row(children: [
            TextButton.icon(onPressed: () => context.go('/'), icon: const Icon(Icons.arrow_back, size: 16), label: const Text('GPU', style: TextStyle(fontWeight: FontWeight.w900))),
            const Spacer(),
            for (final id in [1, 2, 3, 4]) _gpuStatusChip(id),
            IconButton(icon: const Icon(Icons.refresh, size: 16), onPressed: _checkGpuStatus, visualDensity: VisualDensity.compact),
          ]),
          const SizedBox(height: 16),
          _calendarLoading ? const Padding(padding: EdgeInsets.symmetric(vertical: 48), child: Center(child: CircularProgressIndicator())) : _buildCalendar(),
          const SizedBox(height: 28),
          const Divider(),
          const SizedBox(height: 20),
          const Text('예약하기', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 18)),
          const Text('GPU를 선택하고 예약을 신청하세요', style: TextStyle(fontSize: 11, color: Colors.grey)),
          const SizedBox(height: 12),
          Wrap(spacing: 6, children: [for (final id in [1, 2, 3, 4]) ChoiceChip(label: Text('GPU #$id'), selected: _selectedGpuId == id, onSelected: (_) => setState(() => _selectedGpuId = id))]),
          const SizedBox(height: 12),
          _selectedGpuId == 1 ? _DailyBookingCard(key: const ValueKey(1), gpuId: 1, isApproved: _isApproved, onBooked: _loadMyReservations) : _WeeklyBookingCard(key: ValueKey(_selectedGpuId), gpuId: _selectedGpuId, isApproved: _isApproved, onBooked: _loadMyReservations),
          const SizedBox(height: 28),
          if (_userId == null)
            const Padding(padding: EdgeInsets.symmetric(vertical: 32), child: Center(child: Text('로그인 후 예약 현황을 확인할 수 있습니다.', style: TextStyle(color: Colors.grey))))
          else ...[
            Row(children: [
              const Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text('My Reservations', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 18)),
                  Text('내 예약 관리', style: TextStyle(fontSize: 11, color: Colors.grey)),
                ]),
              ),
              IconButton(icon: const Icon(Icons.file_download_outlined, size: 18), onPressed: _exportIcal, tooltip: 'iCal 내보내기'),
              IconButton(icon: const Icon(Icons.refresh, size: 18), onPressed: _loadMyReservations),
            ]),
            if (_statsHours.values.any((v) => v > 0)) ...[
              const SizedBox(height: 12),
              _StatsBar(hours: _statsHours),
            ],
            const SizedBox(height: 16),
            if (_loading)
              const Padding(padding: EdgeInsets.symmetric(vertical: 48), child: Center(child: CircularProgressIndicator()))
            else if (_myReservations.isEmpty)
              const Padding(padding: EdgeInsets.symmetric(vertical: 48), child: Center(child: Text('예약 내역이 없습니다.', style: TextStyle(color: Colors.grey))))
            else
              for (final r in _myReservations) ...[
                _ReservationCard(
                  reservation: r,
                  now: _now,
                  password: _gpuPasswords[r.gpuId],
                  expanded: _openReservationId == r.id,
                  onToggle: () => setState(() => _openReservationId = _openReservationId == r.id ? null : r.id),
                  onCancel: () => _cancelReservation(r.id),
                  onEndSession: () => _endSession(r.id),
                ),
                const SizedBox(height: 10),
              ],
          ],
        ],
      ),
    );
  }

  Widget _gpuStatusChip(int id) {
    final status = _gpuStatus[id] ?? 'checking';
    final icon = status == 'checking' ? Icons.circle : (status == 'online' ? Icons.wifi : Icons.wifi_off);
    final color = status == 'checking' ? Colors.amber : (status == 'online' ? Colors.green : Colors.red);
    return Padding(
      padding: const EdgeInsets.only(left: 4),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
        decoration: BoxDecoration(color: Colors.grey.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(8)),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          Icon(icon, size: 10, color: color),
          const SizedBox(width: 3),
          Text('GPU$id', style: const TextStyle(fontSize: 9, fontWeight: FontWeight.w900)),
        ]),
      ),
    );
  }

  Widget _buildCalendar() {
    final days = <DateTime>[];
    for (var d = _gridStart; !d.isAfter(_gridEnd); d = d.add(const Duration(days: 1))) {
      days.add(d);
    }
    final today = DateTime.now();

    return Column(
      children: [
        GlassCard(
          padding: const EdgeInsets.all(4),
          child: Column(
            children: [
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
                child: Row(children: [
                  IconButton(icon: const Icon(Icons.chevron_left), onPressed: () { setState(() => _currentMonth = DateTime(_currentMonth.year, _currentMonth.month - 1)); _loadCalendar(); }),
                  Expanded(child: Center(child: Text('${_currentMonth.year}년 ${_currentMonth.month}월', style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 15)))),
                  IconButton(icon: const Icon(Icons.chevron_right), onPressed: () { setState(() => _currentMonth = DateTime(_currentMonth.year, _currentMonth.month + 1)); _loadCalendar(); }),
                ]),
              ),
              Wrap(spacing: 4, alignment: WrapAlignment.center, children: [for (final id in [1, 2, 3, 4]) _gpuLegend(id)]),
              const SizedBox(height: 6),
              GridView.builder(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                padding: const EdgeInsets.all(4),
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: 7, childAspectRatio: 0.75),
                itemCount: 7,
                itemBuilder: (context, i) => Center(child: Text(_weekdaysMon[i], style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: Colors.grey))),
              ),
              GridView.builder(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                padding: const EdgeInsets.all(4),
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: 7, childAspectRatio: 0.85),
                itemCount: days.length,
                itemBuilder: (context, i) {
                  final day = days[i];
                  final inMonth = day.month == _currentMonth.month;
                  final isToday = day.year == today.year && day.month == today.month && day.day == today.day;
                  final isSelected = _selectedDay != null && _selectedDay!.year == day.year && _selectedDay!.month == day.month && _selectedDay!.day == day.day;
                  final dayRes = _reservationsForDay(day);
                  return InkWell(
                    onTap: () => setState(() => _selectedDay = isSelected ? null : day),
                    child: Container(
                      margin: const EdgeInsets.all(1),
                      padding: const EdgeInsets.all(2),
                      decoration: BoxDecoration(color: isSelected ? Theme.of(context).colorScheme.primary.withValues(alpha: 0.08) : null, borderRadius: BorderRadius.circular(8), border: isSelected ? Border.all(color: Theme.of(context).colorScheme.primary.withValues(alpha: 0.3)) : null),
                      child: Opacity(
                        opacity: inMonth ? 1 : 0.3,
                        child: Column(
                          children: [
                            Container(
                              width: 18,
                              height: 18,
                              alignment: Alignment.center,
                              decoration: BoxDecoration(shape: BoxShape.circle, color: isToday ? Theme.of(context).colorScheme.primary : null),
                              child: Text('${day.day}', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: isToday ? Colors.white : null)),
                            ),
                            const SizedBox(height: 2),
                            Wrap(spacing: 1, alignment: WrapAlignment.center, children: [for (final r in dayRes.take(4)) Container(width: 5, height: 5, decoration: BoxDecoration(shape: BoxShape.circle, color: _gpuColors[r.gpuId]))]),
                          ],
                        ),
                      ),
                    ),
                  );
                },
              ),
            ],
          ),
        ),
        if (_selectedDay != null) ...[
          const SizedBox(height: 10),
          GlassCard(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('${_fmtMdWeekday(_selectedDay!)} 예약 현황', style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 13)),
                const SizedBox(height: 8),
                if (_reservationsForDay(_selectedDay!).isEmpty)
                  const Padding(padding: EdgeInsets.symmetric(vertical: 12), child: Center(child: Text('예약 없음', style: TextStyle(color: Colors.grey))))
                else
                  for (final r in _reservationsForDay(_selectedDay!))
                    Padding(
                      padding: const EdgeInsets.only(bottom: 6),
                      child: Row(children: [
                        Container(width: 4, height: 32, color: _gpuColors[r.gpuId]),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text('GPU #${r.gpuId}', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 12, color: _gpuColors[r.gpuId])),
                              Text('${r.fullName ?? '—'} · ${r.studentId ?? '—'}', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                              Text('${_fmtMd(r.start)} – ${_fmtMd(r.end)}', style: const TextStyle(fontSize: 10, color: Colors.grey)),
                            ],
                          ),
                        ),
                      ]),
                    ),
              ],
            ),
          ),
        ],
      ],
    );
  }

  Widget _gpuLegend(int id) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 2),
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(color: _gpuColors[id]!.withValues(alpha: 0.12), border: Border.all(color: _gpuColors[id]!.withValues(alpha: 0.3)), borderRadius: BorderRadius.circular(20)),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        Container(width: 5, height: 5, decoration: BoxDecoration(shape: BoxShape.circle, color: _gpuColors[id])),
        const SizedBox(width: 4),
        Text('GPU #$id', style: TextStyle(fontSize: 9, fontWeight: FontWeight.w900, color: _gpuColors[id])),
      ]),
    );
  }
}

class _StatsBar extends StatelessWidget {
  const _StatsBar({required this.hours});
  final Map<int, double> hours;

  @override
  Widget build(BuildContext context) {
    final max = hours.values.fold(1.0, (a, b) => a > b ? a : b);
    return GlassCard(
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('GPU 점유율 (최근 30일)', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: Colors.grey.shade600, letterSpacing: 1)),
          const SizedBox(height: 10),
          for (final id in [1, 2, 3, 4])
            Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: Row(children: [
                SizedBox(width: 46, child: Text('GPU $id', style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: Colors.grey))),
                Expanded(child: ClipRRect(borderRadius: BorderRadius.circular(6), child: LinearProgressIndicator(value: (hours[id] ?? 0) / max, minHeight: 10, backgroundColor: Colors.grey.withValues(alpha: 0.15)))),
                SizedBox(width: 40, child: Text('${hours[id] ?? 0}h', textAlign: TextAlign.right, style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: Colors.grey))),
              ]),
            ),
        ],
      ),
    );
  }
}

class _ReservationCard extends StatelessWidget {
  const _ReservationCard({required this.reservation, required this.now, required this.password, required this.expanded, required this.onToggle, required this.onCancel, required this.onEndSession});
  final _Reservation reservation;
  final DateTime now;
  final String? password;
  final bool expanded;
  final VoidCallback onToggle;
  final VoidCallback onCancel;
  final VoidCallback onEndSession;

  @override
  Widget build(BuildContext context) {
    final r = reservation;
    final isStarted = !now.isBefore(r.start);
    final isEnded = now.isAfter(r.end);
    final isApproved = r.status == 'approved';
    final isRejected = r.status == 'rejected';
    final isPending = r.status == 'pending';
    final canStart = isApproved && isStarted && !isEnded;

    String label;
    if (isRejected) {
      label = 'Access Denied';
    } else if (isApproved && !isStarted) {
      label = 'Waiting';
    } else if (isApproved && isEnded) {
      label = 'Session Ended';
    } else if (isApproved) {
      label = expanded ? 'Close Guide' : 'Start Session';
    } else {
      label = 'Under Review';
    }

    return GlassCard(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(children: [
                      Text('GPU #${r.gpuId}', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16, color: Theme.of(context).colorScheme.primary)),
                      const SizedBox(width: 8),
                      _statusBadge(isPending, isRejected, isApproved, isStarted, isEnded),
                    ]),
                    const SizedBox(height: 4),
                    Text('${_fmtDateTime(r.start)} → ${_fmtDateTime(r.end)}', style: const TextStyle(fontSize: 11, color: Colors.grey)),
                  ],
                ),
              ),
              if (isPending || (isApproved && !isStarted)) IconButton(icon: const Icon(Icons.delete_outline, size: 18, color: Colors.grey), onPressed: onCancel),
              ElevatedButton(onPressed: canStart ? onToggle : null, child: Text(label, style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w900))),
            ],
          ),
          if (expanded && canStart) ...[
            const Divider(height: 24),
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(color: Colors.grey.withValues(alpha: 0.06), borderRadius: BorderRadius.circular(14)),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(children: [Icon(Icons.key, size: 14, color: Theme.of(context).colorScheme.primary), const SizedBox(width: 6), const Text('Access Credentials', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 12))]),
                  const SizedBox(height: 10),
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(color: Theme.of(context).colorScheme.surface, borderRadius: BorderRadius.circular(10)),
                    child: Row(children: [
                      Expanded(child: Text(password ?? '비밀번호 준비 중...', style: TextStyle(fontFamily: 'monospace', fontWeight: FontWeight.w900, fontSize: 15, color: password != null ? Colors.blue : Colors.grey))),
                      if (password != null)
                        IconButton(
                          icon: const Icon(Icons.copy, size: 16),
                          onPressed: () async {
                            await Clipboard.setData(ClipboardData(text: password!));
                            if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('클립보드에 복사됐습니다.')));
                          },
                        ),
                    ]),
                  ),
                  const SizedBox(height: 8),
                  const Text('※ 이 비밀번호는 예약된 시간에만 유효하며, 세션 종료 후 자동 무효화됩니다.', style: TextStyle(fontSize: 9, color: Colors.grey, fontStyle: FontStyle.italic)),
                  const SizedBox(height: 10),
                  OutlinedButton.icon(onPressed: () => launchUrl(Uri.parse('http://10.138.24.219:800${r.gpuId}'), mode: LaunchMode.externalApplication), icon: const Icon(Icons.open_in_new, size: 14), label: const Text('Open Jupyter Notebook')),
                  const SizedBox(height: 8),
                  SizedBox(width: double.infinity, child: ElevatedButton.icon(style: ElevatedButton.styleFrom(backgroundColor: Colors.red, foregroundColor: Colors.white), onPressed: onEndSession, icon: const Icon(Icons.stop_circle_outlined, size: 16), label: const Text('사용 중단'))),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _statusBadge(bool pending, bool rejected, bool approved, bool started, bool ended) {
    if (pending) return _badge('Pending', Colors.amber);
    if (rejected) return _badge('Rejected', Colors.red);
    if (approved && !started) return _badge('Upcoming', Colors.blue);
    if (approved && started && !ended) return _badge('Active Now', Colors.green);
    if (approved && ended) return _badge('Finished', Colors.grey);
    return const SizedBox.shrink();
  }

  Widget _badge(String label, Color color) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
        decoration: BoxDecoration(color: color.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(8)),
        child: Text(label, style: TextStyle(fontSize: 9, fontWeight: FontWeight.w900, color: color)),
      );
}

// ─── Daily booking (GPU #1) ─────────────────────────────────────────────────

const _durationPresets = [('1시간', 1), ('3시간', 3), ('6시간', 6), ('12시간', 12), ('1일', 24), ('2일', 48), ('3일', 72), ('7일', 168)];

class _DailyBookingCard extends StatefulWidget {
  const _DailyBookingCard({super.key, required this.gpuId, required this.isApproved, required this.onBooked});
  final int gpuId;
  final bool isApproved;
  final VoidCallback onBooked;

  @override
  State<_DailyBookingCard> createState() => _DailyBookingCardState();
}

class _DailyBookingCardState extends State<_DailyBookingCard> {
  late DateTime _selectedDate = DateTime(DateTime.now().year, DateTime.now().month, DateTime.now().day);
  late int _selectedHour = (DateTime.now().hour + 1).clamp(0, 23);
  int _durationHours = 3;
  bool _submitting = false;
  List<_Reservation> _approved = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final now = DateTime.now();
    final rows = await Supabase.instance.client.from('reservations').select('id, gpu_id, user_id, start_time, end_time, status').eq('gpu_id', widget.gpuId).eq('status', 'approved').gte('end_time', now.toIso8601String()).order('start_time');
    if (mounted) setState(() => _approved = (rows as List).map((r) => _Reservation.fromRow(r as Map<String, dynamic>)).toList());
  }

  DateTime get _start => DateTime(_selectedDate.year, _selectedDate.month, _selectedDate.day, _selectedHour);
  DateTime get _end => _start.add(Duration(hours: _durationHours));

  Future<void> _submit() async {
    if (!widget.isApproved) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('학번 또는 이름 확인이 필요해 예약할 수 없습니다. 프로필에서 정보를 확인해 주세요.')));
      return;
    }
    if (!_start.isAfter(DateTime.now())) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('시작 시간은 현재 시간보다 늦어야 합니다.')));
      return;
    }
    final user = Supabase.instance.client.auth.currentUser;
    if (user == null) return;
    setState(() => _submitting = true);
    try {
      final conflict = _approved.any((r) => _start.isBefore(r.end) && _end.isAfter(r.start));
      if (conflict) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('해당 시간에는 이미 확정된 예약이 있습니다.')));
        return;
      }
      await Supabase.instance.client.from('reservations').insert({'gpu_id': widget.gpuId, 'user_id': user.id, 'user_email': user.email, 'start_time': _start.toIso8601String(), 'end_time': _end.toIso8601String(), 'status': 'pending'});
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('GPU #${widget.gpuId} 예약 신청이 완료되었습니다!')));
      setState(() => _durationHours = 3);
      widget.onBooked();
      _load();
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('예약 실패: $e')));
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final next14 = List.generate(14, (i) => today.add(Duration(days: i)));

    return GlassCard(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [Text('GPU #${widget.gpuId}', style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 16, fontStyle: FontStyle.italic)), const Spacer(), _readyBadge()]),
          const Text('RTX5000', style: TextStyle(fontSize: 10, color: Colors.grey, fontWeight: FontWeight.w900)),
          const SizedBox(height: 14),
          const Text('사용 시작일', style: TextStyle(fontSize: 9, fontWeight: FontWeight.w900, color: Colors.grey)),
          SizedBox(
            height: 52,
            child: ListView(
              scrollDirection: Axis.horizontal,
              children: [
                for (var i = 0; i < next14.length; i++)
                  Padding(
                    padding: const EdgeInsets.only(right: 6),
                    child: _pill(
                      label: i == 0 ? '오늘' : (i == 1 ? '내일' : _weekdaysMon[next14[i].weekday - 1]),
                      sub: _fmtMd(next14[i]),
                      selected: next14[i] == _selectedDate,
                      onTap: () => setState(() => _selectedDate = next14[i]),
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 10),
          const Text('시작 시각', style: TextStyle(fontSize: 9, fontWeight: FontWeight.w900, color: Colors.grey)),
          SizedBox(
            height: 40,
            child: ListView(
              scrollDirection: Axis.horizontal,
              children: [
                for (var h = 0; h < 24; h++)
                  Padding(
                    padding: const EdgeInsets.only(right: 6),
                    child: ChoiceChip(label: Text('${h.toString().padLeft(2, '0')}:00', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w900)), selected: _selectedHour == h, onSelected: (_) => setState(() => _selectedHour = h)),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 10),
          const Text('사용 시간 (최대 7일)', style: TextStyle(fontSize: 9, fontWeight: FontWeight.w900, color: Colors.grey)),
          Wrap(spacing: 6, runSpacing: 6, children: [for (final p in _durationPresets) ChoiceChip(label: Text(p.$1, style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w900)), selected: _durationHours == p.$2, onSelected: (_) => setState(() => _durationHours = p.$2))]),
          const SizedBox(height: 10),
          Container(
            padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 10),
            decoration: BoxDecoration(color: Colors.grey.withValues(alpha: 0.08), borderRadius: BorderRadius.circular(10)),
            child: Center(child: Text('${_fmtMdWeekday(_start)} ${_start.hour.toString().padLeft(2, '0')}:00 → ${_fmtMdWeekday(_end)} ${_end.hour.toString().padLeft(2, '0')}:00', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold))),
          ),
          const SizedBox(height: 14),
          SizedBox(width: double.infinity, child: ElevatedButton(onPressed: _submitting ? null : _submit, child: Text(_submitting ? '신청 중...' : '예약 신청하기'))),
        ],
      ),
    );
  }

  Widget _readyBadge() => Container(padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3), decoration: BoxDecoration(color: Colors.green.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(8)), child: const Text('Ready', style: TextStyle(fontSize: 9, fontWeight: FontWeight.w900, color: Colors.green)));

  Widget _pill({required String label, required String sub, required bool selected, required VoidCallback onTap}) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        width: 56,
        padding: const EdgeInsets.symmetric(vertical: 6),
        decoration: BoxDecoration(borderRadius: BorderRadius.circular(12), border: Border.all(color: selected ? Theme.of(context).colorScheme.primary : Colors.grey.withValues(alpha: 0.3)), color: selected ? Theme.of(context).colorScheme.primary : null),
        child: Column(children: [
          Text(label, style: TextStyle(fontSize: 9, fontWeight: FontWeight.bold, color: selected ? Colors.white70 : Colors.grey)),
          Text(sub, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w900, color: selected ? Colors.white : null)),
        ]),
      ),
    );
  }
}

// ─── Weekly booking (GPU #2-4) ──────────────────────────────────────────────

class _WeeklyBookingCard extends StatefulWidget {
  const _WeeklyBookingCard({super.key, required this.gpuId, required this.isApproved, required this.onBooked});
  final int gpuId;
  final bool isApproved;
  final VoidCallback onBooked;

  @override
  State<_WeeklyBookingCard> createState() => _WeeklyBookingCardState();
}

class _WeeklyBookingCardState extends State<_WeeklyBookingCard> {
  final List<DateTime> _selectedWeeks = [];
  bool _submitting = false;
  List<_Reservation> _approved = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final rows = await Supabase.instance.client.from('reservations').select('id, gpu_id, user_id, start_time, end_time, status').eq('gpu_id', widget.gpuId).eq('status', 'approved').gte('end_time', DateTime.now().toIso8601String()).order('start_time');
    if (mounted) {
      setState(() {
        _approved = (rows as List).map((r) => _Reservation.fromRow(r as Map<String, dynamic>)).toList();
        _selectedWeeks.clear();
      });
    }
  }

  DateTime _mondayOf(DateTime d) => DateTime(d.year, d.month, d.day).subtract(Duration(days: d.weekday - 1));
  DateTime _sundayOf(DateTime mon) => mon.add(const Duration(days: 6, hours: 23, minutes: 59, seconds: 59));

  ({bool taken, DateTime availableFrom}) _weekAvailability(DateTime mon, DateTime sun) {
    final overlapping = _approved.where((r) => r.start.isBefore(sun) && r.end.isAfter(mon)).toList();
    if (overlapping.isEmpty) return (taken: false, availableFrom: mon);
    var latestEnd = mon;
    for (final r in overlapping) {
      if (r.end.isAfter(latestEnd)) latestEnd = r.end;
    }
    final availableFrom = latestEnd.isAfter(mon) ? latestEnd : mon;
    return (taken: !availableFrom.isBefore(sun), availableFrom: availableFrom);
  }

  Future<void> _submit() async {
    if (!widget.isApproved) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('학번 또는 이름 확인이 필요해 예약할 수 없습니다. 프로필에서 정보를 확인해 주세요.')));
      return;
    }
    if (_selectedWeeks.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('주차를 선택해 주세요.')));
      return;
    }
    final user = Supabase.instance.client.auth.currentUser;
    if (user == null) return;
    setState(() => _submitting = true);
    try {
      final sorted = [..._selectedWeeks]..sort();
      final groups = <({DateTime start, DateTime end})>[];
      var groupStart = _mondayOf(sorted[0]);
      var groupEnd = _sundayOf(groupStart);
      for (var i = 1; i < sorted.length; i++) {
        final prevMon = _mondayOf(sorted[i - 1]);
        final curMon = _mondayOf(sorted[i]);
        if (curMon.difference(prevMon).inDays == 7) {
          groupEnd = _sundayOf(curMon);
        } else {
          groups.add((start: groupStart, end: groupEnd));
          groupStart = _mondayOf(sorted[i]);
          groupEnd = _sundayOf(groupStart);
        }
      }
      groups.add((start: groupStart, end: groupEnd));

      final records = <Map<String, dynamic>>[];
      for (final g in groups) {
        var adjustedStart = g.start;
        final overlappingAtStart = _approved.where((r) => !r.start.isAfter(adjustedStart) && r.end.isAfter(adjustedStart));
        for (final r in overlappingAtStart) {
          if (r.end.isAfter(adjustedStart)) adjustedStart = r.end;
        }
        if (!adjustedStart.isBefore(g.end)) {
          ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('${_fmtMd(g.start)} 주는 남은 기간이 없습니다.')));
          return;
        }
        final conflict = _approved.any((r) => adjustedStart.isBefore(r.end) && g.end.isAfter(r.start));
        if (conflict) {
          ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('${_fmtMd(g.start)} 주에는 이미 확정된 예약이 있습니다.')));
          return;
        }
        records.add({'gpu_id': widget.gpuId, 'user_id': user.id, 'user_email': user.email, 'start_time': adjustedStart.toIso8601String(), 'end_time': g.end.toIso8601String(), 'status': 'pending'});
      }
      await Supabase.instance.client.from('reservations').insert(records);
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('GPU #${widget.gpuId} ${_selectedWeeks.length}주(${records.length}건) 예약 신청이 완료되었습니다!')));
      widget.onBooked();
      _load();
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('예약 실패: $e')));
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final weeks = List.generate(8, (i) {
      final mon = _mondayOf(DateTime.now().add(Duration(days: i * 7)));
      return (mon: mon, sun: _sundayOf(mon), idx: i);
    });

    return GlassCard(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            Text('GPU #${widget.gpuId}', style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 16, fontStyle: FontStyle.italic)),
            const Spacer(),
            Container(padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3), decoration: BoxDecoration(color: Colors.deepPurple.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(8)), child: const Text('WEEKLY', style: TextStyle(fontSize: 9, fontWeight: FontWeight.w900, color: Colors.deepPurple))),
          ]),
          const Text('RTX5000 · 주 단위 예약', style: TextStyle(fontSize: 10, color: Colors.grey, fontWeight: FontWeight.w900)),
          const SizedBox(height: 12),
          const Text('예약할 주차 선택', style: TextStyle(fontSize: 9, fontWeight: FontWeight.w900, color: Colors.grey)),
          const SizedBox(height: 6),
          for (final w in weeks) ...[_weekRow(w.mon, w.sun, w.idx), const SizedBox(height: 6)],
          const SizedBox(height: 8),
          SizedBox(width: double.infinity, child: ElevatedButton(onPressed: (_submitting || _selectedWeeks.isEmpty) ? null : _submit, child: Text(_submitting ? '신청 중...' : (_selectedWeeks.isEmpty ? '주차를 선택하세요' : '${_selectedWeeks.length}주 예약 신청하기')))),
        ],
      ),
    );
  }

  Widget _weekRow(DateTime mon, DateTime sun, int idx) {
    final availability = _weekAvailability(mon, sun);
    final partial = !availability.taken && availability.availableFrom.isAfter(mon);
    final isSelected = _selectedWeeks.any((d) => d == mon);
    return InkWell(
      onTap: availability.taken ? null : () => setState(() => isSelected ? _selectedWeeks.remove(mon) : _selectedWeeks.add(mon)),
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(12),
          color: availability.taken ? Colors.grey.withValues(alpha: 0.06) : (isSelected ? Theme.of(context).colorScheme.primary.withValues(alpha: 0.08) : null),
          border: Border.all(color: isSelected ? Theme.of(context).colorScheme.primary : Colors.grey.withValues(alpha: 0.25)),
        ),
        child: Opacity(
          opacity: availability.taken ? 0.5 : 1,
          child: Row(children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('${_fmtMd(mon)} – ${_fmtMdWeekday(sun)}', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w900)),
                  Text(idx == 0 ? '이번 주' : '$idx주 후', style: const TextStyle(fontSize: 9, color: Colors.grey)),
                  if (partial) Text('${_fmtMd(availability.availableFrom)} ${availability.availableFrom.hour.toString().padLeft(2, '0')}:${availability.availableFrom.minute.toString().padLeft(2, '0')}부터 신청 가능', style: const TextStyle(fontSize: 9, color: Colors.amber, fontWeight: FontWeight.bold)),
                ],
              ),
            ),
            Icon(availability.taken ? Icons.lock_outline : (isSelected ? Icons.check_circle : Icons.chevron_right), size: 16, color: availability.taken ? Colors.grey : (isSelected ? Theme.of(context).colorScheme.primary : Colors.grey)),
          ]),
        ),
      ),
    );
  }
}

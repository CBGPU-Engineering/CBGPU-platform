import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../core/api_config.dart';
import '../../core/glass.dart';
import '../../core/segmented_tabs.dart';

const _days = ['월', '화', '수', '목', '금'];
const _maxPeriod = 7;

const _subjectColors = [
  Color(0xFF3B82F6),
  Color(0xFF10B981),
  Color(0xFF8B5CF6),
  Color(0xFFF59E0B),
  Color(0xFFF43F5E),
  Color(0xFF0EA5E9),
];

Color _subjectColor(String name) {
  if (name.isEmpty) return _subjectColors[0];
  final h = name.codeUnits.fold<int>(0, (a, c) => a + c);
  return _subjectColors[h % _subjectColors.length];
}

// The timetable edge function's response already includes `teacher` and
// `changed` per cell (comcigan tracks real-time substitutions), but the
// client was only reading `subject` and silently dropping both — so no
// teacher name ever showed, and a live 보강/결강 change never got flagged.
class _Cell {
  const _Cell(this.subject, this.teacher, this.changed);
  final String subject;
  final String teacher;
  final bool changed;
}

/// grade(1자리)+class(1자리)+number(2자리) 학번 형식 — 교사는 로그인용 아이디로 이
/// 필드를 쓰기도 해서, 4자리 숫자이고 학년이 1~3일 때만 학생으로 간주한다.
({int grade, int cls})? _parseStudentGradeClass(String? studentId) {
  if (studentId == null || !RegExp(r'^\d{4}$').hasMatch(studentId)) return null;
  final grade = int.parse(studentId[0]);
  final cls = int.parse(studentId[1]);
  if (grade < 1 || grade > 3 || cls < 1) return null;
  return (grade: grade, cls: cls);
}

class TimetableScreen extends StatefulWidget {
  const TimetableScreen({super.key});

  @override
  State<TimetableScreen> createState() => _TimetableScreenState();
}

class _TimetableScreenState extends State<TimetableScreen> {
  int _grade = 1;
  int _cls = 1;
  List<int> _grades = [1, 2, 3];
  List<int> _classes = [1, 2, 3, 4];
  // grid[weekday][period] = cell
  Map<int, Map<int, _Cell>> _grid = {};
  Map<int, Map<int, String>> _draft = {};
  bool _editing = false;
  bool _loading = true;
  bool _saving = false;
  bool _isAdmin = false;
  String _source = 'comcigan';
  String? _error;
  bool _initialized = false;

  int get _todayWeekday {
    final d = DateTime.now().weekday; // 1=Mon .. 7=Sun
    return d >= 1 && d <= 5 ? d - 1 : -1;
  }

  @override
  void initState() {
    super.initState();
    _init();
  }

  Future<void> _init() async {
    final user = Supabase.instance.client.auth.currentUser;
    if (user != null) {
      final profile = await Supabase.instance.client
          .from('profiles')
          .select('student_id, is_admin')
          .eq('id', user.id)
          .maybeSingle();
      if (mounted) setState(() => _isAdmin = profile?['is_admin'] == true);
      final own = _parseStudentGradeClass(profile?['student_id'] as String?);
      if (own != null) {
        setState(() {
          _grade = own.grade;
          _cls = own.cls;
        });
      }
    }
    if (_initialized) return;
    _initialized = true;
    await _loadComcigan(_grade, _cls);
  }

  Future<void> _loadComcigan(int grade, int cls, {bool refresh = false}) async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final res = await http
          .get(
            Uri.parse(
              '${ApiConfig.functionsUrl}/timetable?grade=$grade&class=$cls${refresh ? '&refresh=1' : ''}',
            ),
          )
          .timeout(const Duration(seconds: 12));
      final body = jsonDecode(res.body) as Map<String, dynamic>;
      if (body['error'] != null) throw Exception(body['error']);

      final grid = <int, Map<int, _Cell>>{};
      final rawGrid = body['grid'] as Map<String, dynamic>? ?? {};
      rawGrid.forEach((wd, periods) {
        final wdInt = int.tryParse(wd);
        if (wdInt == null) return;
        grid[wdInt] = {};
        (periods as Map<String, dynamic>).forEach((p, cell) {
          final pInt = int.tryParse(p);
          if (pInt == null) return;
          final map = cell as Map<String, dynamic>;
          final subject = map['subject'] as String? ?? '';
          if (subject.isNotEmpty) {
            grid[wdInt]![pInt] = _Cell(
              subject,
              map['teacher'] as String? ?? '',
              map['changed'] as bool? ?? false,
            );
          }
        });
      });

      setState(() {
        _grid = grid;
        _source = 'comcigan';
        if ((body['grades'] as List?)?.isNotEmpty ?? false) {
          _grades = (body['grades'] as List).map((e) => e as int).toList();
        }
        if ((body['classes'] as List?)?.isNotEmpty ?? false) {
          _classes = (body['classes'] as List).map((e) => e as int).toList();
        }
      });
    } catch (e) {
      setState(() => _error = e.toString().replaceFirst('Exception: ', ''));
      await _loadManual(grade, cls);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _loadManual(int grade, int cls) async {
    final data = await Supabase.instance.client
        .from('timetable')
        .select('weekday, period, subject')
        .eq('grade', grade)
        .eq('class_num', cls);
    final grid = <int, Map<int, _Cell>>{};
    for (final row in data) {
      final wd = row['weekday'] as int;
      grid.putIfAbsent(wd, () => {});
      grid[wd]![row['period'] as int] = _Cell(
        row['subject'] as String? ?? '',
        '',
        false,
      );
    }
    setState(() {
      _grid = grid;
      _source = 'manual';
    });
  }

  void _switchTo(int grade, int cls) {
    if (_editing) return;
    setState(() {
      _grade = grade;
      _cls = cls;
    });
    _loadComcigan(grade, cls);
  }

  void _startEdit() {
    setState(() {
      _draft = {
        for (final e in _grid.entries)
          e.key: {
            for (final e2 in e.value.entries) e2.key: e2.value.subject,
          },
      };
      _editing = true;
    });
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    final rows = [
      for (var wd = 0; wd < 5; wd++)
        for (var p = 1; p <= _maxPeriod; p++)
          {
            'grade': _grade,
            'class_num': _cls,
            'weekday': wd,
            'period': p,
            'subject': _draft[wd]?[p] ?? '',
          },
    ];
    try {
      await Supabase.instance.client
          .from('timetable')
          .upsert(rows, onConflict: 'grade,class_num,weekday,period');
      setState(() {
        _grid = {
          for (var wd = 0; wd < 5; wd++)
            wd: {
              for (var p = 1; p <= _maxPeriod; p++)
                if ((_draft[wd]?[p] ?? '').isNotEmpty)
                  p: _Cell(_draft[wd]![p]!, '', false),
            },
        };
        _editing = false;
      });
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text('저장됐습니다.')));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('저장 실패: $e')));
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AmbientBackground(
      child: Align(
        alignment: Alignment.topCenter,
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 928),
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 32, 16, 112),
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          '시간표',
                          style: TextStyle(
                            fontSize: 30,
                            fontWeight: FontWeight.w900,
                            fontStyle: FontStyle.italic,
                            letterSpacing: -0.8,
                          ),
                        ),
                        Text.rich(
                          TextSpan(
                            text: '충북과학고등학교 · ',
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.bold,
                              color: Theme.of(
                                context,
                              ).colorScheme.onSurface.withValues(alpha: 0.5),
                              letterSpacing: 0.7,
                            ),
                            children: [
                              TextSpan(
                                text: _source == 'comcigan'
                                    ? '컴시간 알리미'
                                    : '수동 데이터',
                                style: TextStyle(
                                  color: _source == 'comcigan'
                                      ? Colors.green
                                      : Colors.amber.shade700,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                  if (!_editing)
                    IconButton(
                      icon: const Icon(Icons.refresh, size: 18),
                      onPressed: _loading
                          ? null
                          : () => _loadComcigan(_grade, _cls, refresh: true),
                    ),
                  if (_isAdmin && !_editing)
                    TextButton.icon(
                      onPressed: _startEdit,
                      icon: const Icon(Icons.edit, size: 14),
                      label: const Text('직접 편집'),
                    ),
                  if (_isAdmin && _editing) ...[
                    IconButton(
                      icon: const Icon(Icons.close, size: 18),
                      onPressed: () => setState(() => _editing = false),
                    ),
                    ElevatedButton.icon(
                      onPressed: _saving ? null : _save,
                      icon: const Icon(Icons.save, size: 14),
                      label: Text(_saving ? '저장 중...' : '저장'),
                    ),
                  ],
                ],
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  AppSegmentedTabs<int>(
                    value: _grade,
                    onChanged: (g) => _switchTo(g, _cls),
                    items: [
                      for (final g in _grades)
                        AppTabItem(
                          value: g,
                          builder: (active) => Text(
                            '$g학년',
                            style: const TextStyle(
                              fontWeight: FontWeight.w900,
                              fontSize: 12,
                            ),
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(width: 8),
                  AppSegmentedTabs<int>(
                    value: _cls,
                    onChanged: (c) => _switchTo(_grade, c),
                    items: [
                      for (final c in _classes)
                        AppTabItem(
                          value: c,
                          builder: (active) => Text(
                            '$c반',
                            style: const TextStyle(
                              fontWeight: FontWeight.w900,
                              fontSize: 12,
                            ),
                          ),
                        ),
                    ],
                  ),
                ],
              ),
              if (_error != null && _source == 'manual') ...[
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.amber.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: Colors.amber.withValues(alpha: 0.3),
                    ),
                  ),
                  child: Text(
                    '컴시간 연결 실패 — 수동 데이터를 표시합니다.\n$_error',
                    style: TextStyle(
                      fontSize: 11,
                      color: Colors.amber.shade800,
                    ),
                  ),
                ),
              ],
              const SizedBox(height: 16),
              if (_loading)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 64),
                  child: Center(child: CircularProgressIndicator()),
                )
              else
                GlassCard(
                  padding: const EdgeInsets.all(12),
                  child: SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    child: Table(
                      defaultColumnWidth: const FixedColumnWidth(72),
                      columnWidths: const {0: FixedColumnWidth(28)},
                      children: [
                        TableRow(
                          children: [
                            const SizedBox(),
                            for (var i = 0; i < _days.length; i++)
                              Padding(
                                padding: const EdgeInsets.symmetric(
                                  vertical: 6,
                                ),
                                child: Column(
                                  children: [
                                    Text(
                                      _days[i],
                                      style: TextStyle(
                                        fontSize: 11,
                                        fontWeight: FontWeight.w900,
                                        color: _todayWeekday == i
                                            ? Theme.of(
                                                context,
                                              ).colorScheme.primary
                                            : Colors.grey,
                                      ),
                                    ),
                                    if (_todayWeekday == i)
                                      Text(
                                        '오늘',
                                        style: TextStyle(
                                          fontSize: 8,
                                          color: Theme.of(context)
                                              .colorScheme
                                              .primary
                                              .withValues(alpha: 0.7),
                                        ),
                                      ),
                                  ],
                                ),
                              ),
                          ],
                        ),
                        for (var p = 1; p <= _maxPeriod; p++)
                          TableRow(
                            children: [
                              Center(
                                child: Text(
                                  '$p',
                                  style: const TextStyle(
                                    fontSize: 10,
                                    fontWeight: FontWeight.w900,
                                    color: Colors.grey,
                                  ),
                                ),
                              ),
                              for (var di = 0; di < _days.length; di++)
                                _buildCell(context, di, p),
                            ],
                          ),
                      ],
                    ),
                  ),
                ),
              const SizedBox(height: 12),
              Wrap(
                alignment: WrapAlignment.center,
                spacing: 8,
                runSpacing: 4,
                children: [
                  Text(
                    '컴시간 알리미 자동 연동 · 실패 시 수동 데이터 표시${_isAdmin ? ' · 직접 편집 가능' : ''}',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 10,
                      color: Theme.of(
                        context,
                      ).colorScheme.onSurface.withValues(alpha: 0.5),
                    ),
                  ),
                  if (_source == 'comcigan')
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Container(
                          width: 8,
                          height: 8,
                          decoration: const BoxDecoration(
                            color: Colors.amber,
                            shape: BoxShape.circle,
                          ),
                        ),
                        const SizedBox(width: 4),
                        Text(
                          '실시간 보강/결강 변경',
                          style: TextStyle(
                            fontSize: 10,
                            color: Theme.of(
                              context,
                            ).colorScheme.onSurface.withValues(alpha: 0.5),
                          ),
                        ),
                      ],
                    ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildCell(BuildContext context, int weekday, int period) {
    final isToday = _todayWeekday == weekday;
    if (_editing) {
      return Padding(
        padding: const EdgeInsets.all(2),
        child: SizedBox(
          height: 56,
          child: TextField(
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold),
            controller:
                TextEditingController(text: _draft[weekday]?[period] ?? '')
                  ..selection = TextSelection.collapsed(
                    offset: (_draft[weekday]?[period] ?? '').length,
                  ),
            decoration: const InputDecoration(
              hintText: '과목',
              contentPadding: EdgeInsets.symmetric(horizontal: 4),
            ),
            onChanged: (v) => _draft.putIfAbsent(weekday, () => {})[period] = v,
          ),
        ),
      );
    }
    final cell = _grid[weekday]?[period];
    final subject = cell?.subject ?? '';
    final teacher = cell?.teacher ?? '';
    final changed = cell?.changed ?? false;
    return Padding(
      padding: const EdgeInsets.all(2),
      child: Container(
        height: 60,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: subject.isEmpty
              ? Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.03)
              : Theme.of(context).colorScheme.surface,
          borderRadius: BorderRadius.circular(10),
          // A live substitution/cancellation (실시간 보강/결강 변경) gets an
          // amber ring instead of the usual faint today-highlight — this
          // data was already coming back from the edge function but was
          // discarded before it ever reached this widget.
          border: changed
              ? Border.all(color: Colors.amber, width: 1.5)
              : (isToday && subject.isNotEmpty
                    ? Border.all(
                        color: Theme.of(
                          context,
                        ).colorScheme.primary.withValues(alpha: 0.2),
                      )
                    : null),
        ),
        child: subject.isEmpty
            ? null
            : Stack(
                children: [
                  Positioned(
                    left: 0,
                    top: 4,
                    bottom: 4,
                    child: Container(width: 3, color: _subjectColor(subject)),
                  ),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 6),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(
                          subject,
                          textAlign: TextAlign.center,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w900,
                            color: _subjectColor(subject),
                          ),
                        ),
                        if (teacher.isNotEmpty)
                          Text(
                            teacher,
                            textAlign: TextAlign.center,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              fontSize: 9,
                              color: Theme.of(
                                context,
                              ).colorScheme.onSurface.withValues(alpha: 0.6),
                            ),
                          ),
                      ],
                    ),
                  ),
                ],
              ),
      ),
    );
  }
}


import 'dart:async';
import 'dart:convert';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../core/glass.dart';
import '../../core/segmented_tabs.dart';

class ToolsScreen extends StatefulWidget {
  const ToolsScreen({super.key});

  @override
  State<ToolsScreen> createState() => _ToolsScreenState();
}

class _ToolsScreenState extends State<ToolsScreen> {
  int _tab = 0;

  @override
  Widget build(BuildContext context) {
    return AmbientBackground(
      child: Align(
        alignment: Alignment.topCenter,
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 544),
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 40, 16, 112),
            children: [
              const Text(
                '도구',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 30,
                  fontWeight: FontWeight.w900,
                  fontStyle: FontStyle.italic,
                  letterSpacing: -0.8,
                ),
              ),
              const SizedBox(height: 4),
              const Text(
                '공부 도우미',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontWeight: FontWeight.bold,
                  color: Colors.grey,
                  fontSize: 12,
                  letterSpacing: 1.0,
                ),
              ),
              const SizedBox(height: 32),
              Center(
                child: AppSegmentedTabs<int>(
                  value: _tab,
                  onChanged: (v) => setState(() => _tab = v),
                  items: [
                    AppTabItem(
                      value: 0,
                      builder: (active) => _ToolTabLabel(
                        '⏱ 포모도로',
                        '집중 타이머',
                        active: active,
                      ),
                    ),
                    AppTabItem(
                      value: 1,
                      builder: (active) => _ToolTabLabel(
                        '📅 D-day',
                        '목표일까지',
                        active: active,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 32),
              _tab == 0 ? const _Pomodoro() : const _DDayCounter(),
            ],
          ),
        ),
      ),
    );
  }
}

class _ToolTabLabel extends StatelessWidget {
  const _ToolTabLabel(this.title, this.description, {this.active = false});
  final String title;
  final String description;
  final bool active;
  @override
  Widget build(BuildContext context) => Column(
    mainAxisSize: MainAxisSize.min,
    children: [
      Text(title),
      Text(
        description,
        style: TextStyle(
          fontSize: 9,
          fontWeight: FontWeight.w500,
          color: active ? Colors.white70 : Colors.grey,
        ),
      ),
    ],
  );
}

// ─── Pomodoro ───────────────────────────────────────────────────────────────

class _Preset {
  const _Preset(this.label, this.work, this.rest);
  final String label;
  final int work;
  final int rest;
}

const _presets = [
  _Preset('집중 25', 25, 5),
  _Preset('집중 50', 50, 10),
  _Preset('짧게 15', 15, 3),
];

class _Pomodoro extends StatefulWidget {
  const _Pomodoro();
  @override
  State<_Pomodoro> createState() => _PomodoroState();
}

class _PomodoroState extends State<_Pomodoro> {
  int _preset = 0;
  String _phase = 'work';
  late int _secs = _presets[0].work * 60;
  bool _running = false;
  int _cycles = 0;
  Timer? _timer;

  _Preset get _cfg => _presets[_preset];
  int get _total => (_phase == 'work' ? _cfg.work : _cfg.rest) * 60;

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  // Web version uses the browser Notification API. There's no equivalent
  // cross-platform system-notification API without adding a platform-setup
  // heavy plugin (flutter_local_notifications) for a nice-to-have timer
  // beep, so a snackbar stands in for the desktop notification here.
  void _notify(String msg) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
  }

  void _toggle() {
    if (_running) {
      _timer?.cancel();
      setState(() => _running = false);
      return;
    }
    setState(() => _running = true);
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      setState(() {
        if (_secs <= 1) {
          if (_phase == 'work') {
            _notify('휴식 시간! 5분간 쉬세요 🎉');
            _phase = 'rest';
            _secs = _cfg.rest * 60;
          } else {
            _notify('집중 시간! 다시 시작하세요 💪');
            _cycles++;
            _phase = 'work';
            _secs = _cfg.work * 60;
          }
        } else {
          _secs--;
        }
      });
    });
  }

  void _reset() {
    _timer?.cancel();
    setState(() {
      _running = false;
      _phase = 'work';
      _secs = _cfg.work * 60;
    });
  }

  void _selectPreset(int i) {
    _timer?.cancel();
    setState(() {
      _running = false;
      _preset = i;
      _phase = 'work';
      _secs = _presets[i].work * 60;
    });
  }

  @override
  Widget build(BuildContext context) {
    final pct = _secs / _total;
    final mm = (_secs ~/ 60).toString().padLeft(2, '0');
    final ss = (_secs % 60).toString().padLeft(2, '0');
    final color = _phase == 'work'
        ? const Color(0xFF6366F1)
        : const Color(0xFF22C55E);

    return Column(
      children: [
        Wrap(
          spacing: 6,
          alignment: WrapAlignment.center,
          children: [
            for (var i = 0; i < _presets.length; i++)
              ChoiceChip(
                label: Text(
                  _presets[i].label,
                  style: const TextStyle(
                    fontWeight: FontWeight.w900,
                    fontSize: 11,
                  ),
                ),
                selected: _preset == i,
                onSelected: (_) => _selectPreset(i),
              ),
          ],
        ),
        const SizedBox(height: 24),
        SizedBox(
          width: 200,
          height: 200,
          child: Stack(
            alignment: Alignment.center,
            children: [
              CustomPaint(
                size: const Size(200, 200),
                painter: _RingPainter(pct: pct, color: color),
              ),
              Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    '$mm:$ss',
                    style: const TextStyle(
                      fontSize: 34,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  Text(
                    _phase == 'work' ? '집중' : '휴식',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w900,
                      color: color,
                      letterSpacing: 1,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    '$_cycles 사이클 완료',
                    style: const TextStyle(fontSize: 10, color: Colors.grey),
                  ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 20),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            ElevatedButton.icon(
              onPressed: _toggle,
              icon: Icon(_running ? Icons.pause : Icons.play_arrow, size: 16),
              label: Text(_running ? '일시정지' : (_secs == _total ? '시작' : '계속')),
            ),
            const SizedBox(width: 8),
            IconButton.outlined(
              onPressed: _reset,
              icon: const Icon(Icons.restart_alt, size: 18),
            ),
          ],
        ),
      ],
    );
  }
}

class _RingPainter extends CustomPainter {
  _RingPainter({required this.pct, required this.color});
  final double pct;
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = (size.width - 12) / 2;
    final track = Paint()
      ..color = Colors.grey.withValues(alpha: 0.2)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 10;
    canvas.drawCircle(center, radius, track);

    final arc = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 10
      ..strokeCap = StrokeCap.round;
    canvas.drawArc(
      Rect.fromCircle(center: center, radius: radius),
      -math.pi / 2,
      2 * math.pi * pct.clamp(0, 1),
      false,
      arc,
    );
  }

  @override
  bool shouldRepaint(covariant _RingPainter oldDelegate) =>
      oldDelegate.pct != pct || oldDelegate.color != color;
}

// ─── D-day ──────────────────────────────────────────────────────────────────

class _DDay {
  _DDay({
    required this.id,
    required this.label,
    required this.date,
    required this.emoji,
  });
  final String id;
  final String label;
  final DateTime date;
  final String emoji;

  Map<String, dynamic> toJson() => {
    'id': id,
    'label': label,
    'date': date.toIso8601String(),
    'emoji': emoji,
  };
  factory _DDay.fromJson(Map<String, dynamic> j) => _DDay(
    id: j['id'],
    label: j['label'],
    date: DateTime.parse(j['date']),
    emoji: j['emoji'],
  );
}

const _emojis = ['📅', '🎯', '📝', '🏆', '💡', '🔬', '📚', '⚡', '🚀', '❤️'];
const _ddayPrefsKey = 'cbgpu_dday';

class _DDayCounter extends StatefulWidget {
  const _DDayCounter();
  @override
  State<_DDayCounter> createState() => _DDayCounterState();
}

class _DDayCounterState extends State<_DDayCounter> {
  final _labelController = TextEditingController();
  DateTime? _date;
  String _emoji = '📅';
  List<_DDay> _items = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _labelController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_ddayPrefsKey);
    if (raw == null) return;
    final list = (jsonDecode(raw) as List)
        .map((e) => _DDay.fromJson(e))
        .toList();
    if (mounted) setState(() => _items = list);
  }

  Future<void> _persist() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(
      _ddayPrefsKey,
      jsonEncode(_items.map((e) => e.toJson()).toList()),
    );
  }

  void _add() {
    if (_labelController.text.trim().isEmpty || _date == null) return;
    setState(() {
      _items = [
        ..._items,
        _DDay(
          id: DateTime.now().millisecondsSinceEpoch.toString(),
          label: _labelController.text.trim(),
          date: _date!,
          emoji: _emoji,
        ),
      ];
      _labelController.clear();
      _date = null;
    });
    _persist();
  }

  void _remove(String id) {
    setState(() => _items = _items.where((x) => x.id != id).toList());
    _persist();
  }

  ({String label, Color color}) _diff(DateTime date) {
    final d = (date.difference(DateTime.now()).inHours / 24).ceil();
    if (d == 0) {
      return (label: 'D-Day!', color: Theme.of(context).colorScheme.primary);
    }
    if (d > 0) {
      return (label: 'D-$d', color: Theme.of(context).colorScheme.onSurface);
    }
    return (label: '+${-d}일 지남', color: Colors.grey);
  }

  Future<void> _pickDate() async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      firstDate: DateTime(now.year - 1),
      lastDate: DateTime(now.year + 5),
      initialDate: _date ?? now,
    );
    if (picked != null) setState(() => _date = picked);
  }

  @override
  Widget build(BuildContext context) {
    final sorted = [..._items]..sort((a, b) => a.date.compareTo(b.date));

    return ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: 420),
      child: Column(
        children: [
          GlassCard(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Wrap(
                  spacing: 4,
                  children: [
                    for (final e in _emojis)
                      InkWell(
                        borderRadius: BorderRadius.circular(8),
                        onTap: () => setState(() => _emoji = e),
                        child: Container(
                          width: 32,
                          height: 32,
                          alignment: Alignment.center,
                          decoration: BoxDecoration(
                            color: _emoji == e
                                ? Theme.of(
                                    context,
                                  ).colorScheme.primary.withValues(alpha: 0.2)
                                : null,
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Text(e, style: const TextStyle(fontSize: 16)),
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: _labelController,
                  style: const TextStyle(fontWeight: FontWeight.bold),
                  decoration: const InputDecoration(
                    hintText: '이벤트 이름 (예: 수학 기말고사)',
                  ),
                  onSubmitted: (_) => _add(),
                ),
                const SizedBox(height: 8),
                InkWell(
                  onTap: _pickDate,
                  child: InputDecorator(
                    decoration: const InputDecoration(),
                    child: Text(
                      _date == null
                          ? '날짜 선택'
                          : '${_date!.year}.${_date!.month}.${_date!.day}',
                      style: const TextStyle(fontWeight: FontWeight.bold),
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                ElevatedButton.icon(
                  onPressed:
                      (_labelController.text.trim().isEmpty || _date == null)
                      ? null
                      : _add,
                  icon: const Icon(Icons.add, size: 16),
                  label: const Text('추가'),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          if (sorted.isEmpty)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 24),
              child: Text(
                'D-day 일정을 추가해 보세요.',
                style: TextStyle(color: Colors.grey),
              ),
            )
          else
            for (final item in sorted) ...[
              _DDayRow(
                item: item,
                diff: _diff(item.date),
                onDelete: () => _remove(item.id),
              ),
              const SizedBox(height: 8),
            ],
        ],
      ),
    );
  }
}

class _DDayRow extends StatelessWidget {
  const _DDayRow({
    required this.item,
    required this.diff,
    required this.onDelete,
  });
  final _DDay item;
  final ({String label, Color color}) diff;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) {
    const weekdays = ['월', '화', '수', '목', '금', '토', '일'];
    final dateStr =
        '${item.date.month}월 ${item.date.day}일 (${weekdays[item.date.weekday - 1]})';
    return GlassCard(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      child: Row(
        children: [
          Text(item.emoji, style: const TextStyle(fontSize: 22)),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  item.label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontWeight: FontWeight.w900,
                    fontSize: 13,
                  ),
                ),
                Text(
                  dateStr,
                  style: const TextStyle(fontSize: 10, color: Colors.grey),
                ),
              ],
            ),
          ),
          Text(
            diff.label,
            style: TextStyle(fontWeight: FontWeight.w900, color: diff.color),
          ),
          IconButton(
            icon: const Icon(Icons.delete_outline, size: 16),
            color: Colors.grey,
            onPressed: onDelete,
          ),
        ],
      ),
    );
  }
}

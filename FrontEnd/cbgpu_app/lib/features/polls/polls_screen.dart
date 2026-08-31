import 'dart:math';

import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../core/glass.dart';

String _uid() =>
    Random().nextInt(1 << 32).toRadixString(36) +
    DateTime.now().microsecondsSinceEpoch.toRadixString(36);

const _qTypes = [
  ('choice', '객관식 (단일)', Icons.radio_button_checked),
  ('checkbox', '체크박스 (복수)', Icons.check_box),
  ('dropdown', '드롭다운', Icons.arrow_drop_down_circle),
  ('text', '단답형', Icons.short_text),
  ('paragraph', '장문형', Icons.notes),
  ('scale', '선형 배율', Icons.star_outline),
];

class _QOption {
  _QOption({required this.id, required this.text});
  final String id;
  String text;
  Map<String, dynamic> toJson() => {'id': id, 'text': text};
  factory _QOption.fromJson(Map<String, dynamic> j) =>
      _QOption(id: j['id'], text: j['text'] ?? '');
}

class _ShowIf {
  _ShowIf({required this.questionId, required this.value});
  String questionId;
  String value;
}

class _Question {
  _Question({
    required this.id,
    required this.pollId,
    required this.orderNum,
    required this.type,
    this.title = '',
    this.description = '',
    this.required = false,
    List<_QOption>? options,
    this.min,
    this.max,
    this.minLabel,
    this.maxLabel,
    this.showIf,
  });
  String id;
  String pollId;
  int orderNum;
  String type;
  String title;
  String description;
  bool required;
  List<_QOption> options = [];
  int? min;
  int? max;
  String? minLabel;
  String? maxLabel;
  _ShowIf? showIf;

  factory _Question.fromRow(Map<String, dynamic> r) {
    final config = r['config'] as Map<String, dynamic>? ?? {};
    final showIfRaw = config['showIf'] as Map<String, dynamic>?;
    return _Question(
      id: r['id'] as String,
      pollId: r['poll_id'] as String,
      orderNum: r['order_num'] as int? ?? 0,
      type: r['type'] as String? ?? 'text',
      title: r['title'] as String? ?? '',
      description: r['description'] as String? ?? '',
      required: r['required'] as bool? ?? false,
      options:
          (r['options'] as List?)
              ?.map((o) => _QOption.fromJson(o as Map<String, dynamic>))
              .toList() ??
          [],
      min: config['min'] as int?,
      max: config['max'] as int?,
      minLabel: config['minLabel'] as String?,
      maxLabel: config['maxLabel'] as String?,
      showIf: showIfRaw != null
          ? _ShowIf(
              questionId: showIfRaw['questionId'],
              value: showIfRaw['value'] ?? '',
            )
          : null,
    );
  }

  Map<String, dynamic> toRow() => {
    'poll_id': pollId,
    'order_num': orderNum,
    'type': type,
    'title': title,
    'description': description,
    'required': required,
    'options': options.map((o) => o.toJson()).toList(),
    'config': {
      if (min != null) 'min': min,
      if (max != null) 'max': max,
      if (minLabel != null) 'minLabel': minLabel,
      if (maxLabel != null) 'maxLabel': maxLabel,
      if (showIf != null)
        'showIf': {'questionId': showIf!.questionId, 'value': showIf!.value},
    },
  };
}

class _Poll {
  _Poll({
    required this.id,
    required this.title,
    required this.description,
    this.endsAt,
    required this.isActive,
    required this.showResults,
  });
  final String id;
  final String title;
  final String description;
  final DateTime? endsAt;
  final bool isActive;
  final bool showResults;

  bool get isClosed =>
      !isActive || (endsAt != null && endsAt!.isBefore(DateTime.now()));

  factory _Poll.fromRow(Map<String, dynamic> r) => _Poll(
    id: r['id'] as String,
    title: r['title'] as String? ?? '',
    description: r['description'] as String? ?? '',
    endsAt: r['ends_at'] != null
        ? DateTime.tryParse(r['ends_at'] as String)
        : null,
    isActive: r['is_active'] as bool? ?? true,
    showResults: r['show_results'] as bool? ?? true,
  );
}

String? _fmtDate(DateTime? d) {
  if (d == null) return null;
  const months = [
    '1월',
    '2월',
    '3월',
    '4월',
    '5월',
    '6월',
    '7월',
    '8월',
    '9월',
    '10월',
    '11월',
    '12월',
  ];
  return '${months[d.month - 1]} ${d.day}일 ${d.hour.toString().padLeft(2, '0')}:${d.minute.toString().padLeft(2, '0')}';
}

bool _isVisible(_Question q, Map<String, dynamic> answers) {
  final si = q.showIf;
  if (si == null) return true;
  final v = answers[si.questionId];
  if (v is List) return v.contains(si.value);
  return (v?.toString() ?? '') == si.value;
}

// ─── main screen ────────────────────────────────────────────────────────────

sealed class _View {}

class _ListView extends _View {}

class _FormView extends _View {
  _FormView(this.poll, this.questions);
  final _Poll poll;
  final List<_Question> questions;
}

class _ResultsView extends _View {
  _ResultsView(this.poll, this.questions);
  final _Poll poll;
  final List<_Question> questions;
}

class _BuilderView extends _View {
  _BuilderView([this.poll]);
  final _Poll? poll;
}

class PollsScreen extends StatefulWidget {
  const PollsScreen({super.key});
  @override
  State<PollsScreen> createState() => _PollsScreenState();
}

class _PollsScreenState extends State<PollsScreen> {
  List<_Poll> _polls = [];
  List<String> _myResponses = [];
  _View _view = _ListView();
  bool _loading = true;
  bool _dbMissing = false;
  bool _isAdmin = false;
  String _tab = 'active';

  String? get _userId => Supabase.instance.client.auth.currentUser?.id;

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
          .select('is_admin')
          .eq('id', user.id)
          .maybeSingle();
      if (mounted) setState(() => _isAdmin = profile?['is_admin'] == true);
    }
    _load();
  }

  Future<void> _load() async {
    try {
      final rows = await Supabase.instance.client
          .from('polls')
          .select('*')
          .order('created_at', ascending: false)
          .limit(500);
      final polls = (rows as List)
          .map((r) => _Poll.fromRow(r as Map<String, dynamic>))
          .toList();
      List<String> myResponses = [];
      if (_userId != null) {
        final resps = await Supabase.instance.client
            .from('poll_responses')
            .select('poll_id')
            .eq('user_id', _userId as Object);
        myResponses = (resps as List)
            .map((r) => r['poll_id'] as String)
            .toList();
      }
      if (!mounted) return;
      setState(() {
        _polls = polls;
        _myResponses = myResponses;
        _loading = false;
      });
    } catch (e) {
      if (e.toString().contains('does not exist')) {
        if (mounted) {
          setState(() {
            _dbMissing = true;
            _loading = false;
          });
        }
        return;
      }
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<List<_Question>> _loadQuestions(String pollId) async {
    final rows = await Supabase.instance.client
        .from('poll_questions')
        .select('*')
        .eq('poll_id', pollId)
        .order('order_num');
    return (rows as List)
        .map((r) => _Question.fromRow(r as Map<String, dynamic>))
        .toList();
  }

  Future<void> _openPoll(_Poll poll) async {
    final questions = await _loadQuestions(poll.id);
    if (!mounted) return;
    if (_myResponses.contains(poll.id) || poll.isClosed) {
      setState(() => _view = _ResultsView(poll, questions));
    } else {
      setState(() => _view = _FormView(poll, questions));
    }
  }

  Future<void> _closePoll(String id) async {
    await Supabase.instance.client
        .from('polls')
        .update({'is_active': false})
        .eq('id', id);
    _snack('마감됐습니다.');
    _load();
  }

  Future<void> _deletePoll(String id) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('투표를 삭제하시겠습니까?'),
        content: const Text('투표와 모든 응답이 영구적으로 삭제됩니다.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('취소'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('삭제', style: TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    await Supabase.instance.client.from('polls').delete().eq('id', id);
    _snack('삭제됐습니다.');
    _load();
  }

  void _snack(String msg) {
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
    }
  }

  @override
  Widget build(BuildContext context) {
    final view = _view;
    if (view is _BuilderView) {
      return _PollBuilderScreen(
        poll: view.poll,
        onSaved: () {
          _load();
          setState(() => _view = _ListView());
        },
        onBack: () => setState(() => _view = _ListView()),
      );
    }
    if (view is _FormView) {
      return _PollFormScreen(
        poll: view.poll,
        questions: view.questions,
        onSubmitted: () {
          _load();
          setState(() => _view = _ResultsView(view.poll, view.questions));
        },
        onBack: () => setState(() => _view = _ListView()),
      );
    }
    if (view is _ResultsView) {
      return _PollResultsScreen(
        poll: view.poll,
        questions: view.questions,
        onBack: () => setState(() => _view = _ListView()),
      );
    }

    if (_dbMissing) {
      return const AmbientBackground(
        child: Center(
          child: Padding(
            padding: EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text('⚠️', style: TextStyle(fontSize: 40)),
                SizedBox(height: 8),
                Text(
                  'DB 설정 필요',
                  style: TextStyle(fontWeight: FontWeight.w900, fontSize: 18),
                ),
                SizedBox(height: 4),
                Text(
                  'supabase_polls_migration.sql을 실행해 주세요.',
                  style: TextStyle(color: Colors.grey),
                  textAlign: TextAlign.center,
                ),
              ],
            ),
          ),
        ),
      );
    }

    bool isActiveTab(_Poll p) =>
        p.isActive && (p.endsAt == null || !p.endsAt!.isBefore(DateTime.now()));
    final shown = _polls
        .where((p) => _tab == 'active' ? isActiveTab(p) : p.isClosed)
        .toList();

    return AmbientBackground(
      child: Align(
        alignment: Alignment.topCenter,
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 704),
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 32, 16, 112),
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  const Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '투표',
                          style: TextStyle(
                            fontSize: 30,
                            fontWeight: FontWeight.w900,
                            fontStyle: FontStyle.italic,
                            letterSpacing: -0.8,
                          ),
                        ),
                        SizedBox(height: 4),
                        Text(
                          '학교 행사 · 대회 · 설문',
                          style: TextStyle(
                            fontWeight: FontWeight.bold,
                            color: Colors.grey,
                            fontSize: 12,
                            letterSpacing: 1.0,
                          ),
                        ),
                      ],
                    ),
                  ),
                  if (_isAdmin)
                    ElevatedButton.icon(
                      onPressed: () => setState(() => _view = _BuilderView()),
                      icon: const Icon(Icons.add, size: 16),
                      label: const Text('투표 만들기'),
                    ),
                ],
              ),
              const SizedBox(height: 24),
              Row(
                children: [
                  ChoiceChip(
                    label: Text('진행 중 (${_polls.where(isActiveTab).length})'),
                    selected: _tab == 'active',
                    onSelected: (_) => setState(() => _tab = 'active'),
                  ),
                  const SizedBox(width: 6),
                  ChoiceChip(
                    label: Text(
                      '마감 (${_polls.where((p) => p.isClosed).length})',
                    ),
                    selected: _tab == 'closed',
                    onSelected: (_) => setState(() => _tab = 'closed'),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              if (_loading)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 64),
                  child: Center(child: CircularProgressIndicator()),
                )
              else if (shown.isEmpty)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 48),
                  child: Center(
                    child: Text(
                      _tab == 'active' ? '진행 중인 투표가 없습니다.' : '마감된 투표가 없습니다.',
                      style: const TextStyle(color: Colors.grey),
                    ),
                  ),
                )
              else
                for (final poll in shown) ...[
                  _PollListCard(
                    poll: poll,
                    voted: _myResponses.contains(poll.id),
                    isAdmin: _isAdmin,
                    onTap: () => _openPoll(poll),
                    onResults: () => _openPoll(poll),
                    onEdit: () => setState(() => _view = _BuilderView(poll)),
                    onClose: () => _closePoll(poll.id),
                    onDelete: () => _deletePoll(poll.id),
                  ),
                  const SizedBox(height: 10),
                ],
            ],
          ),
        ),
      ),
    );
  }
}

class _PollListCard extends StatelessWidget {
  const _PollListCard({
    required this.poll,
    required this.voted,
    required this.isAdmin,
    required this.onTap,
    required this.onResults,
    required this.onEdit,
    required this.onClose,
    required this.onDelete,
  });
  final _Poll poll;
  final bool voted;
  final bool isAdmin;
  final VoidCallback onTap;
  final VoidCallback onResults;
  final VoidCallback onEdit;
  final VoidCallback onClose;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) {
    final closed = poll.isClosed;
    return GlassCard(
      padding: const EdgeInsets.all(14),
      child: InkWell(
        onTap: onTap,
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Wrap(
                    spacing: 6,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    children: [
                      Text(
                        poll.title,
                        style: const TextStyle(
                          fontWeight: FontWeight.w900,
                          fontSize: 14,
                        ),
                      ),
                      if (voted) _badge('참여완료', Colors.green),
                      if (closed) _badge('마감', Colors.grey),
                    ],
                  ),
                  if (poll.description.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.only(top: 2),
                      child: Text(
                        poll.description,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 11,
                          color: Colors.grey,
                        ),
                      ),
                    ),
                  if (poll.endsAt != null)
                    Padding(
                      padding: const EdgeInsets.only(top: 2),
                      child: Text(
                        '~${_fmtDate(poll.endsAt)}',
                        style: const TextStyle(
                          fontSize: 10,
                          color: Colors.grey,
                        ),
                      ),
                    ),
                ],
              ),
            ),
            if ((voted || closed) && poll.showResults)
              IconButton(
                icon: const Icon(Icons.bar_chart, size: 16),
                onPressed: onResults,
                visualDensity: VisualDensity.compact,
              ),
            if (isAdmin) ...[
              IconButton(
                icon: const Icon(Icons.edit_outlined, size: 16),
                onPressed: onEdit,
                visualDensity: VisualDensity.compact,
              ),
              if (poll.isActive && !closed)
                IconButton(
                  icon: const Icon(
                    Icons.lock_outline,
                    size: 16,
                    color: Colors.amber,
                  ),
                  onPressed: onClose,
                  visualDensity: VisualDensity.compact,
                ),
              IconButton(
                icon: const Icon(
                  Icons.delete_outline,
                  size: 16,
                  color: Colors.red,
                ),
                onPressed: onDelete,
                visualDensity: VisualDensity.compact,
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _badge(String label, Color color) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
    decoration: BoxDecoration(
      color: color.withValues(alpha: 0.15),
      borderRadius: BorderRadius.circular(8),
    ),
    child: Text(
      label,
      style: TextStyle(fontSize: 9, fontWeight: FontWeight.w900, color: color),
    ),
  );
}

// ─── QuestionInput (taking a poll) ──────────────────────────────────────────

class _QuestionInput extends StatelessWidget {
  const _QuestionInput({
    required this.q,
    required this.value,
    required this.onChange,
  });
  final _Question q;
  final dynamic value;
  final ValueChanged<dynamic> onChange;

  @override
  Widget build(BuildContext context) {
    switch (q.type) {
      case 'choice':
      case 'dropdown':
        return Column(
          children: [
            for (final o in q.options)
              _optionTile(
                context,
                o.text,
                value == o.id,
                () => onChange(o.id),
                false,
              ),
          ],
        );
      case 'checkbox':
        final sel = value is List ? List<String>.from(value) : <String>[];
        return Column(
          children: [
            for (final o in q.options)
              _optionTile(
                context,
                o.text,
                sel.contains(o.id),
                () => onChange(
                  sel.contains(o.id)
                      ? sel.where((x) => x != o.id).toList()
                      : [...sel, o.id],
                ),
                true,
              ),
          ],
        );
      case 'text':
        return TextField(
          controller: TextEditingController(text: value is String ? value : ''),
          decoration: const InputDecoration(hintText: '답변을 입력하세요'),
          onChanged: onChange,
        );
      case 'paragraph':
        return TextField(
          controller: TextEditingController(text: value is String ? value : ''),
          maxLines: 4,
          decoration: const InputDecoration(hintText: '답변을 입력하세요'),
          onChanged: onChange,
        );
      case 'scale':
        final min = q.min ?? 1;
        final max = q.max ?? 5;
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Wrap(
              spacing: 8,
              children: [
                for (var n = min; n <= max; n++)
                  _scaleButton(context, n, value == n, () => onChange(n)),
              ],
            ),
            if ((q.minLabel ?? '').isNotEmpty || (q.maxLabel ?? '').isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 6),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      q.minLabel ?? '',
                      style: const TextStyle(fontSize: 10, color: Colors.grey),
                    ),
                    Text(
                      q.maxLabel ?? '',
                      style: const TextStyle(fontSize: 10, color: Colors.grey),
                    ),
                  ],
                ),
              ),
          ],
        );
      default:
        return const SizedBox.shrink();
    }
  }

  Widget _optionTile(
    BuildContext context,
    String text,
    bool selected,
    VoidCallback onTap,
    bool isCheckbox,
  ) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: selected
                  ? Theme.of(context).colorScheme.primary
                  : Colors.grey.withValues(alpha: 0.3),
            ),
            color: selected
                ? Theme.of(context).colorScheme.primary.withValues(alpha: 0.06)
                : null,
          ),
          child: Row(
            children: [
              Icon(
                isCheckbox
                    ? (selected
                          ? Icons.check_box
                          : Icons.check_box_outline_blank)
                    : (selected
                          ? Icons.radio_button_checked
                          : Icons.radio_button_off),
                size: 18,
                color: selected
                    ? Theme.of(context).colorScheme.primary
                    : Colors.grey,
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  text,
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _scaleButton(
    BuildContext context,
    int n,
    bool selected,
    VoidCallback onTap,
  ) {
    return InkWell(
      borderRadius: BorderRadius.circular(10),
      onTap: onTap,
      child: Container(
        width: 40,
        height: 40,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(10),
          color: selected
              ? Theme.of(context).colorScheme.primary
              : Colors.grey.withValues(alpha: 0.1),
          border: Border.all(
            color: selected
                ? Theme.of(context).colorScheme.primary
                : Colors.grey.withValues(alpha: 0.3),
          ),
        ),
        child: Text(
          '$n',
          style: TextStyle(
            fontWeight: FontWeight.w900,
            color: selected ? Colors.white : null,
          ),
        ),
      ),
    );
  }
}

// ─── ResultChart ────────────────────────────────────────────────────────────

class _ResultChart extends StatelessWidget {
  const _ResultChart({required this.q, required this.allAnswers});
  final _Question q;
  final List<Map<String, dynamic>> allAnswers;

  @override
  Widget build(BuildContext context) {
    final values = allAnswers
        .where((a) => a['question_id'] == q.id)
        .map((a) => a['value'])
        .toList();
    final total = values.length;

    if (q.type == 'text' || q.type == 'paragraph') {
      final texts = values
          .where((v) => v != null && v.toString().isNotEmpty)
          .map((v) => v.toString())
          .toList();
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            '$total개 응답',
            style: TextStyle(
              fontSize: 9,
              fontWeight: FontWeight.w900,
              color: Colors.grey.shade600,
              letterSpacing: 1,
            ),
          ),
          for (final t in texts.take(20))
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: Colors.grey.withValues(alpha: 0.08),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text(t, style: const TextStyle(fontSize: 12)),
              ),
            ),
          if (texts.length > 20)
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text(
                '+${texts.length - 20}개 더...',
                style: const TextStyle(fontSize: 11, color: Colors.grey),
              ),
            ),
        ],
      );
    }

    if (q.type == 'scale') {
      final nums = values
          .map((v) => v is num ? v.toInt() : int.tryParse('$v'))
          .whereType<int>()
          .toList();
      final avg = nums.isEmpty
          ? '-'
          : (nums.reduce((a, b) => a + b) / nums.length).toStringAsFixed(1);
      final min = q.min ?? 1;
      final max = q.max ?? 5;
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text.rich(
            TextSpan(
              text: '$total개 응답 · 평균 ',
              style: TextStyle(
                fontSize: 9,
                fontWeight: FontWeight.w900,
                color: Colors.grey.shade600,
              ),
              children: [
                TextSpan(
                  text: avg,
                  style: TextStyle(
                    color: Theme.of(context).colorScheme.primary,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              for (var n = min; n <= max; n++)
                Expanded(
                  child: Builder(
                    builder: (context) {
                      final cnt = nums.where((v) => v == n).length;
                      final pct = total == 0 ? 0 : (cnt / total * 100).round();
                      return Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 2),
                        child: Column(
                          children: [
                            SizedBox(
                              height: 60,
                              child: Align(
                                alignment: Alignment.bottomCenter,
                                child: FractionallySizedBox(
                                  heightFactor: pct / 100,
                                  child: Container(
                                    decoration: BoxDecoration(
                                      color: Theme.of(
                                        context,
                                      ).colorScheme.primary,
                                      borderRadius: BorderRadius.circular(6),
                                    ),
                                  ),
                                ),
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              '$n',
                              style: const TextStyle(
                                fontSize: 10,
                                fontWeight: FontWeight.w900,
                              ),
                            ),
                            Text(
                              '$pct%',
                              style: const TextStyle(
                                fontSize: 9,
                                color: Colors.grey,
                              ),
                            ),
                          ],
                        ),
                      );
                    },
                  ),
                ),
            ],
          ),
        ],
      );
    }

    final countMap = <String, int>{};
    for (final v in values) {
      final ids = v is List ? v : [v];
      for (final id in ids) {
        if (id != null) {
          countMap[id.toString()] = (countMap[id.toString()] ?? 0) + 1;
        }
      }
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          '$total개 응답',
          style: TextStyle(
            fontSize: 9,
            fontWeight: FontWeight.w900,
            color: Colors.grey.shade600,
            letterSpacing: 1,
          ),
        ),
        for (final o in q.options) ...[
          Builder(
            builder: (context) {
              final cnt = countMap[o.id] ?? 0;
              final pct = total == 0 ? 0 : (cnt / total * 100).round();
              return Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          o.text,
                          style: const TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        Text(
                          '$cnt명 ($pct%)',
                          style: const TextStyle(
                            fontSize: 11,
                            color: Colors.grey,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(4),
                      child: LinearProgressIndicator(
                        value: pct / 100,
                        minHeight: 6,
                        backgroundColor: Colors.grey.withValues(alpha: 0.15),
                      ),
                    ),
                  ],
                ),
              );
            },
          ),
        ],
      ],
    );
  }
}

// ─── PollForm (taking) ──────────────────────────────────────────────────────

class _PollFormScreen extends StatefulWidget {
  const _PollFormScreen({
    required this.poll,
    required this.questions,
    required this.onSubmitted,
    required this.onBack,
  });
  final _Poll poll;
  final List<_Question> questions;
  final VoidCallback onSubmitted;
  final VoidCallback onBack;

  @override
  State<_PollFormScreen> createState() => _PollFormScreenState();
}

class _PollFormScreenState extends State<_PollFormScreen> {
  final Map<String, dynamic> _answers = {};
  bool _submitting = false;

  Future<void> _submit() async {
    final visible = widget.questions
        .where((q) => _isVisible(q, _answers))
        .toList();
    for (final q in visible) {
      if (!q.required) continue;
      final v = _answers[q.id];
      final empty = v == null || v == '' || (v is List && v.isEmpty);
      if (empty) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              '"${q.title.isEmpty ? '질문' : q.title}" 은(는) 필수 항목입니다',
            ),
          ),
        );
        return;
      }
    }
    setState(() => _submitting = true);
    try {
      final resp = await Supabase.instance.client
          .from('poll_responses')
          .insert({
            'poll_id': widget.poll.id,
            'user_id': Supabase.instance.client.auth.currentUser!.id,
          })
          .select()
          .single();
      final rows = visible
          .map(
            (q) => {
              'response_id': resp['id'],
              'question_id': q.id,
              'value': _answers[q.id],
            },
          )
          .toList();
      if (rows.isNotEmpty) {
        await Supabase.instance.client.from('poll_answers').insert(rows);
      }
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text('제출됐습니다!')));
        widget.onSubmitted();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('$e')));
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final closed = widget.poll.isClosed;
    final visible = widget.questions
        .where((q) => _isVisible(q, _answers))
        .toList();
    return AmbientBackground(
      child: ListView(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 100),
        children: [
          Row(
            children: [
              IconButton(
                icon: const Icon(Icons.arrow_back),
                onPressed: widget.onBack,
              ),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      widget.poll.title,
                      style: const TextStyle(
                        fontWeight: FontWeight.w900,
                        fontSize: 18,
                      ),
                    ),
                    if (widget.poll.description.isNotEmpty)
                      Text(
                        widget.poll.description,
                        style: const TextStyle(
                          fontSize: 12,
                          color: Colors.grey,
                        ),
                      ),
                    if (widget.poll.endsAt != null)
                      Text(
                        '마감: ${_fmtDate(widget.poll.endsAt)}',
                        style: const TextStyle(
                          fontSize: 10,
                          color: Colors.grey,
                        ),
                      ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          for (var i = 0; i < visible.length; i++) ...[
            GlassCard(
              padding: const EdgeInsets.all(18),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text.rich(
                    TextSpan(
                      text: '${i + 1}. ${visible[i].title}',
                      style: const TextStyle(
                        fontWeight: FontWeight.w900,
                        fontSize: 13,
                      ),
                      children: [
                        if (visible[i].required)
                          const TextSpan(
                            text: ' *',
                            style: TextStyle(color: Colors.red),
                          ),
                      ],
                    ),
                  ),
                  if (visible[i].description.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.only(top: 2),
                      child: Text(
                        visible[i].description,
                        style: const TextStyle(
                          fontSize: 11,
                          color: Colors.grey,
                        ),
                      ),
                    ),
                  const SizedBox(height: 10),
                  if (!closed)
                    _QuestionInput(
                      q: visible[i],
                      value: _answers[visible[i].id],
                      onChange: (v) =>
                          setState(() => _answers[visible[i].id] = v),
                    )
                  else
                    const Text(
                      '마감된 투표입니다.',
                      style: TextStyle(
                        fontStyle: FontStyle.italic,
                        color: Colors.grey,
                      ),
                    ),
                ],
              ),
            ),
            const SizedBox(height: 10),
          ],
          if (!closed) ...[
            const SizedBox(height: 8),
            SizedBox(
              height: 48,
              child: ElevatedButton(
                onPressed: _submitting ? null : _submit,
                child: Text(_submitting ? '제출 중...' : '제출하기'),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

// ─── PollResults ────────────────────────────────────────────────────────────

class _PollResultsScreen extends StatefulWidget {
  const _PollResultsScreen({
    required this.poll,
    required this.questions,
    required this.onBack,
  });
  final _Poll poll;
  final List<_Question> questions;
  final VoidCallback onBack;

  @override
  State<_PollResultsScreen> createState() => _PollResultsScreenState();
}

class _PollResultsScreenState extends State<_PollResultsScreen> {
  List<Map<String, dynamic>> _allAnswers = [];
  int _resCount = 0;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final responses = await Supabase.instance.client
        .from('poll_responses')
        .select('id')
        .eq('poll_id', widget.poll.id);
    final ids = (responses as List).map((r) => r['id']).toList();
    List<Map<String, dynamic>> answers = [];
    if (ids.isNotEmpty) {
      final raw = await Supabase.instance.client
          .from('poll_answers')
          .select('question_id, value')
          .inFilter('response_id', ids);
      answers = (raw as List).cast<Map<String, dynamic>>();
    }
    if (mounted) {
      setState(() {
        _resCount = ids.length;
        _allAnswers = answers;
        _loading = false;
      });
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
                onPressed: widget.onBack,
              ),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '${widget.poll.title} — 결과',
                      style: const TextStyle(
                        fontWeight: FontWeight.w900,
                        fontSize: 16,
                      ),
                    ),
                    Text(
                      '총 $_resCount명 응답',
                      style: const TextStyle(fontSize: 11, color: Colors.grey),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          if (_loading)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 48),
              child: Center(child: CircularProgressIndicator()),
            )
          else
            for (var i = 0; i < widget.questions.length; i++) ...[
              GlassCard(
                padding: const EdgeInsets.all(18),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '${i + 1}. ${widget.questions[i].title}',
                      style: const TextStyle(
                        fontWeight: FontWeight.w900,
                        fontSize: 13,
                      ),
                    ),
                    const SizedBox(height: 10),
                    _ResultChart(
                      q: widget.questions[i],
                      allAnswers: _allAnswers,
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 10),
            ],
        ],
      ),
    );
  }
}

// ─── PollBuilder ────────────────────────────────────────────────────────────

class _PollBuilderScreen extends StatefulWidget {
  const _PollBuilderScreen({
    this.poll,
    required this.onSaved,
    required this.onBack,
  });
  final _Poll? poll;
  final VoidCallback onSaved;
  final VoidCallback onBack;

  @override
  State<_PollBuilderScreen> createState() => _PollBuilderScreenState();
}

class _PollBuilderScreenState extends State<_PollBuilderScreen> {
  late final _titleController = TextEditingController(
    text: widget.poll?.title ?? '',
  );
  late final _descController = TextEditingController(
    text: widget.poll?.description ?? '',
  );
  DateTime? _endsAt;
  late bool _showResults = widget.poll?.showResults ?? true;
  List<_Question> _questions = [];
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _endsAt = widget.poll?.endsAt;
    if (widget.poll != null) _loadQuestions();
  }

  Future<void> _loadQuestions() async {
    final rows = await Supabase.instance.client
        .from('poll_questions')
        .select('*')
        .eq('poll_id', widget.poll!.id)
        .order('order_num');
    if (mounted) {
      setState(
        () => _questions = (rows as List)
            .map((r) => _Question.fromRow(r as Map<String, dynamic>))
            .toList(),
      );
    }
  }

  void _addQuestion(String type) {
    final hasOptions = ['choice', 'checkbox', 'dropdown'].contains(type);
    setState(() {
      _questions = [
        ..._questions,
        _Question(
          id: _uid(),
          pollId: widget.poll?.id ?? '',
          orderNum: _questions.length,
          type: type,
          options: hasOptions
              ? [_QOption(id: _uid(), text: ''), _QOption(id: _uid(), text: '')]
              : [],
          min: type == 'scale' ? 1 : null,
          max: type == 'scale' ? 5 : null,
          minLabel: type == 'scale' ? '매우 낮음' : null,
          maxLabel: type == 'scale' ? '매우 높음' : null,
        ),
      ];
    });
  }

  void _moveQuestion(int idx, int dir) {
    setState(() {
      final next = [..._questions];
      final tmp = next[idx];
      next[idx] = next[idx + dir];
      next[idx + dir] = tmp;
      for (var i = 0; i < next.length; i++) {
        next[i].orderNum = i;
      }
      _questions = next;
    });
  }

  Future<void> _pickEndsAt() async {
    final now = DateTime.now();
    final date = await showDatePicker(
      context: context,
      firstDate: now.subtract(const Duration(days: 1)),
      lastDate: DateTime(now.year + 3),
      initialDate: _endsAt ?? now,
    );
    if (date == null || !mounted) return;
    final time = await showTimePicker(
      context: context,
      initialTime: TimeOfDay.fromDateTime(_endsAt ?? now),
    );
    if (time == null) return;
    setState(
      () => _endsAt = DateTime(
        date.year,
        date.month,
        date.day,
        time.hour,
        time.minute,
      ),
    );
  }

  Future<void> _save() async {
    if (_titleController.text.trim().isEmpty) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('제목을 입력하세요')));
      return;
    }
    setState(() => _saving = true);
    try {
      String pollId;
      if (widget.poll == null) {
        final row = await Supabase.instance.client
            .from('polls')
            .insert({
              'title': _titleController.text.trim(),
              'description': _descController.text.trim(),
              'ends_at': _endsAt?.toIso8601String(),
              'is_active': true,
              'show_results': _showResults,
              'created_by': Supabase.instance.client.auth.currentUser?.id,
            })
            .select()
            .single();
        pollId = row['id'] as String;
      } else {
        pollId = widget.poll!.id;
        await Supabase.instance.client
            .from('polls')
            .update({
              'title': _titleController.text.trim(),
              'description': _descController.text.trim(),
              'ends_at': _endsAt?.toIso8601String(),
              'show_results': _showResults,
            })
            .eq('id', pollId);
        await Supabase.instance.client
            .from('poll_questions')
            .delete()
            .eq('poll_id', pollId);
      }
      if (_questions.isNotEmpty) {
        final rows = _questions.asMap().entries.map((e) {
          final q = e.value
            ..pollId = pollId
            ..orderNum = e.key;
          return q.toRow();
        }).toList();
        await Supabase.instance.client.from('poll_questions').insert(rows);
      }
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text('저장됐습니다!')));
        widget.onSaved();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('$e')));
      }
    } finally {
      if (mounted) setState(() => _saving = false);
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
                onPressed: widget.onBack,
              ),
              Text(
                widget.poll != null ? '투표 편집' : '새 투표 만들기',
                style: const TextStyle(
                  fontWeight: FontWeight.w900,
                  fontSize: 18,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          GlassCard(
            padding: const EdgeInsets.all(18),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                TextField(
                  controller: _titleController,
                  style: const TextStyle(
                    fontWeight: FontWeight.w900,
                    fontSize: 16,
                  ),
                  decoration: const InputDecoration(hintText: '투표 제목 *'),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: _descController,
                  decoration: const InputDecoration(hintText: '설명 (선택)'),
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: InkWell(
                        onTap: _pickEndsAt,
                        child: InputDecorator(
                          decoration: const InputDecoration(labelText: '마감일'),
                          child: Text(
                            _endsAt == null
                                ? '설정 안 함'
                                : _fmtDate(_endsAt) ?? '',
                            style: const TextStyle(fontSize: 12),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Column(
                      children: [
                        Switch(
                          value: _showResults,
                          onChanged: (v) => setState(() => _showResults = v),
                        ),
                        const Text(
                          '결과 공개',
                          style: TextStyle(
                            fontSize: 9,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          for (var i = 0; i < _questions.length; i++) ...[
            _QuestionBuilderCard(
              q: _questions[i],
              idx: i,
              total: _questions.length,
              prevQs: _questions.sublist(0, i),
              onChange: (nq) => setState(() => _questions[i] = nq),
              onDelete: () => setState(() => _questions.removeAt(i)),
              onMoveUp: i > 0 ? () => _moveQuestion(i, -1) : null,
              onMoveDown: i < _questions.length - 1
                  ? () => _moveQuestion(i, 1)
                  : null,
            ),
            const SizedBox(height: 8),
          ],
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              border: Border.all(
                color: Colors.grey.withValues(alpha: 0.3),
                style: BorderStyle.solid,
              ),
              borderRadius: BorderRadius.circular(16),
            ),
            child: Column(
              children: [
                Text(
                  '질문 추가',
                  style: TextStyle(
                    fontSize: 9,
                    fontWeight: FontWeight.w900,
                    color: Colors.grey.shade600,
                    letterSpacing: 1,
                  ),
                ),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  alignment: WrapAlignment.center,
                  children: [
                    for (final t in _qTypes)
                      ActionChip(
                        avatar: Icon(t.$3, size: 14),
                        label: Text(
                          t.$2,
                          style: const TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                        onPressed: () => _addQuestion(t.$1),
                      ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          Row(
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              OutlinedButton(onPressed: widget.onBack, child: const Text('취소')),
              const SizedBox(width: 8),
              ElevatedButton(
                onPressed: _saving ? null : _save,
                child: Text(_saving ? '저장 중...' : '저장하기'),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _QuestionBuilderCard extends StatefulWidget {
  const _QuestionBuilderCard({
    required this.q,
    required this.idx,
    required this.total,
    required this.prevQs,
    required this.onChange,
    required this.onDelete,
    required this.onMoveUp,
    required this.onMoveDown,
  });
  final _Question q;
  final int idx;
  final int total;
  final List<_Question> prevQs;
  final ValueChanged<_Question> onChange;
  final VoidCallback onDelete;
  final VoidCallback? onMoveUp;
  final VoidCallback? onMoveDown;

  @override
  State<_QuestionBuilderCard> createState() => _QuestionBuilderCardState();
}

class _QuestionBuilderCardState extends State<_QuestionBuilderCard> {
  bool _open = true;

  @override
  Widget build(BuildContext context) {
    final q = widget.q;
    final hasOptions = ['choice', 'checkbox', 'dropdown'].contains(q.type);
    final isScale = q.type == 'scale';
    final icon = _qTypes
        .firstWhere((t) => t.$1 == q.type, orElse: () => _qTypes[0])
        .$3;
    final showIfCandidates = widget.prevQs
        .where(
          (p) =>
              ['choice', 'checkbox', 'dropdown'].contains(p.type) &&
              p.options.isNotEmpty,
        )
        .toList();

    return GlassCard(
      padding: EdgeInsets.zero,
      child: Column(
        children: [
          InkWell(
            onTap: () => setState(() => _open = !_open),
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Row(
                children: [
                  Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      IconButton(
                        icon: const Icon(Icons.keyboard_arrow_up, size: 14),
                        onPressed: widget.onMoveUp,
                        visualDensity: VisualDensity.compact,
                        padding: EdgeInsets.zero,
                        constraints: const BoxConstraints(
                          minWidth: 24,
                          minHeight: 20,
                        ),
                      ),
                      IconButton(
                        icon: const Icon(Icons.keyboard_arrow_down, size: 14),
                        onPressed: widget.onMoveDown,
                        visualDensity: VisualDensity.compact,
                        padding: EdgeInsets.zero,
                        constraints: const BoxConstraints(
                          minWidth: 24,
                          minHeight: 20,
                        ),
                      ),
                    ],
                  ),
                  Icon(icon, size: 14, color: Colors.grey),
                  const SizedBox(width: 6),
                  Text(
                    '${widget.idx + 1}.',
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w900,
                      color: Colors.grey.shade600,
                    ),
                  ),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      q.title.isEmpty ? '(제목 없음)' : q.title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 13,
                      ),
                    ),
                  ),
                  if (q.required)
                    const Padding(
                      padding: EdgeInsets.only(right: 6),
                      child: Text(
                        '필수',
                        style: TextStyle(
                          fontSize: 9,
                          color: Colors.red,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                    ),
                  IconButton(
                    icon: const Icon(
                      Icons.delete_outline,
                      size: 16,
                      color: Colors.grey,
                    ),
                    onPressed: widget.onDelete,
                    visualDensity: VisualDensity.compact,
                  ),
                ],
              ),
            ),
          ),
          if (_open)
            Padding(
              padding: const EdgeInsets.fromLTRB(14, 0, 14, 14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Divider(),
                  Wrap(
                    spacing: 4,
                    runSpacing: 4,
                    children: [
                      for (final t in _qTypes)
                        ChoiceChip(
                          avatar: Icon(t.$3, size: 12),
                          label: Text(
                            t.$2,
                            style: const TextStyle(
                              fontSize: 9,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                          selected: q.type == t.$1,
                          onSelected: (_) => widget.onChange(
                            _Question(
                              id: q.id,
                              pollId: q.pollId,
                              orderNum: q.orderNum,
                              type: t.$1,
                              title: q.title,
                              description: q.description,
                              required: q.required,
                              options:
                                  [
                                    'choice',
                                    'checkbox',
                                    'dropdown',
                                  ].contains(t.$1)
                                  ? (q.options.isEmpty
                                        ? [
                                            _QOption(id: _uid(), text: ''),
                                            _QOption(id: _uid(), text: ''),
                                          ]
                                        : q.options)
                                  : [],
                              min: t.$1 == 'scale' ? 1 : null,
                              max: t.$1 == 'scale' ? 5 : null,
                              minLabel: t.$1 == 'scale' ? '매우 낮음' : null,
                              maxLabel: t.$1 == 'scale' ? '매우 높음' : null,
                            ),
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  TextField(
                    controller: TextEditingController(text: q.title),
                    decoration: const InputDecoration(hintText: '질문 제목 *'),
                    style: const TextStyle(fontWeight: FontWeight.bold),
                    onChanged: (v) => q.title = v,
                  ),
                  const SizedBox(height: 6),
                  TextField(
                    controller: TextEditingController(text: q.description),
                    decoration: const InputDecoration(hintText: '질문 설명 (선택)'),
                    onChanged: (v) => q.description = v,
                  ),
                  if (hasOptions) ...[
                    const SizedBox(height: 10),
                    Text(
                      '선택지',
                      style: TextStyle(
                        fontSize: 9,
                        fontWeight: FontWeight.w900,
                        color: Colors.grey.shade600,
                      ),
                    ),
                    for (var i = 0; i < q.options.length; i++)
                      Padding(
                        padding: const EdgeInsets.only(top: 6),
                        child: Row(
                          children: [
                            Expanded(
                              child: TextField(
                                controller: TextEditingController(
                                  text: q.options[i].text,
                                ),
                                decoration: InputDecoration(
                                  hintText: '선택지 ${i + 1}',
                                ),
                                onChanged: (v) => q.options[i].text = v,
                              ),
                            ),
                            if (q.options.length > 1)
                              IconButton(
                                icon: const Icon(Icons.close, size: 16),
                                onPressed: () =>
                                    setState(() => q.options.removeAt(i)),
                              ),
                          ],
                        ),
                      ),
                    Padding(
                      padding: const EdgeInsets.only(top: 6),
                      child: OutlinedButton.icon(
                        onPressed: () => setState(
                          () => q.options.add(_QOption(id: _uid(), text: '')),
                        ),
                        icon: const Icon(Icons.add, size: 14),
                        label: const Text('선택지 추가'),
                      ),
                    ),
                  ],
                  if (isScale) ...[
                    const SizedBox(height: 10),
                    Row(
                      children: [
                        Expanded(
                          child: TextField(
                            controller: TextEditingController(
                              text: '${q.min ?? 1}',
                            ),
                            keyboardType: TextInputType.number,
                            decoration: const InputDecoration(labelText: '최솟값'),
                            onChanged: (v) => q.min = int.tryParse(v),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: TextField(
                            controller: TextEditingController(
                              text: '${q.max ?? 5}',
                            ),
                            keyboardType: TextInputType.number,
                            decoration: const InputDecoration(labelText: '최댓값'),
                            onChanged: (v) => q.max = int.tryParse(v),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Row(
                      children: [
                        Expanded(
                          child: TextField(
                            controller: TextEditingController(
                              text: q.minLabel ?? '',
                            ),
                            decoration: const InputDecoration(
                              labelText: '최솟값 라벨',
                            ),
                            onChanged: (v) => q.minLabel = v,
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: TextField(
                            controller: TextEditingController(
                              text: q.maxLabel ?? '',
                            ),
                            decoration: const InputDecoration(
                              labelText: '최댓값 라벨',
                            ),
                            onChanged: (v) => q.maxLabel = v,
                          ),
                        ),
                      ],
                    ),
                  ],
                  if (showIfCandidates.isNotEmpty) ...[
                    const SizedBox(height: 10),
                    Text(
                      '표시 조건',
                      style: TextStyle(
                        fontSize: 9,
                        fontWeight: FontWeight.w900,
                        color: Colors.grey.shade600,
                      ),
                    ),
                    DropdownButton<String>(
                      isExpanded: true,
                      value: q.showIf?.questionId,
                      hint: const Text('항상 표시', style: TextStyle(fontSize: 11)),
                      items: [
                        const DropdownMenuItem(
                          value: null,
                          child: Text('항상 표시', style: TextStyle(fontSize: 11)),
                        ),
                        for (final p in showIfCandidates)
                          DropdownMenuItem(
                            value: p.id,
                            child: Text(
                              p.title.isEmpty ? '(제목 없음)' : p.title,
                              style: const TextStyle(fontSize: 11),
                            ),
                          ),
                      ],
                      onChanged: (v) => setState(
                        () => q.showIf = v == null
                            ? null
                            : _ShowIf(questionId: v, value: ''),
                      ),
                    ),
                    if (q.showIf != null)
                      DropdownButton<String>(
                        isExpanded: true,
                        value: q.showIf!.value.isEmpty ? null : q.showIf!.value,
                        hint: const Text(
                          '선택지 선택',
                          style: TextStyle(fontSize: 11),
                        ),
                        items: [
                          for (final o
                              in widget.prevQs
                                  .firstWhere(
                                    (p) => p.id == q.showIf!.questionId,
                                  )
                                  .options)
                            DropdownMenuItem(
                              value: o.id,
                              child: Text(
                                o.text,
                                style: const TextStyle(fontSize: 11),
                              ),
                            ),
                        ],
                        onChanged: (v) =>
                            setState(() => q.showIf!.value = v ?? ''),
                      ),
                  ],
                  const SizedBox(height: 8),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.end,
                    children: [
                      const Text(
                        '필수',
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                      Switch(
                        value: q.required,
                        onChanged: (v) => setState(() => q.required = v),
                      ),
                    ],
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

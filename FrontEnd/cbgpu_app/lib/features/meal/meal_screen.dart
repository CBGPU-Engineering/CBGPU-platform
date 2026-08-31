import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

import '../../core/api_config.dart';
import '../../core/glass.dart';

class _MealItem {
  _MealItem({required this.type, required this.items, required this.calories});
  final String type;
  final List<String> items;
  final String calories;

  factory _MealItem.fromJson(Map<String, dynamic> json) => _MealItem(
    type: json['type'] as String? ?? '',
    items: (json['items'] as List<dynamic>? ?? [])
        .map((e) => e.toString())
        .toList(),
    calories: json['calories'] as String? ?? '',
  );
}

const _typeIcon = {
  '조식': Icons.wb_twilight,
  '중식': Icons.wb_sunny_outlined,
  '석식': Icons.nightlight_round,
};
const _typeColor = {
  '조식': Color(0xFFFBBF24),
  '중식': Color(0xFFFB923C),
  '석식': Color(0xFF818CF8),
};
const _weekdays = ['일', '월', '화', '수', '목', '금', '토'];

String _fmtDate(DateTime d) =>
    '${d.year}${d.month.toString().padLeft(2, '0')}${d.day.toString().padLeft(2, '0')}';

DateTime _parseYmd(String ymd) => DateTime(
  int.parse(ymd.substring(0, 4)),
  int.parse(ymd.substring(4, 6)),
  int.parse(ymd.substring(6, 8)),
);

class MealScreen extends StatefulWidget {
  const MealScreen({super.key});

  @override
  State<MealScreen> createState() => _MealScreenState();
}

class _MealScreenState extends State<MealScreen> {
  late String _date = _fmtDate(DateTime.now());
  List<_MealItem>? _meals;
  String? _error;
  String? _note;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load(_date);
  }

  Future<void> _load(String date) async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final res = await http
          .get(Uri.parse('${ApiConfig.functionsUrl}/meal?date=$date'))
          .timeout(const Duration(seconds: 10));
      final body = jsonDecode(res.body) as Map<String, dynamic>;
      if (body['error'] != null) {
        setState(() => _error = body['error'] as String);
      } else {
        setState(() {
          _meals = (body['meals'] as List<dynamic>? ?? [])
              .map((e) => _MealItem.fromJson(e as Map<String, dynamic>))
              .toList();
          _note = body['note'] as String?;
        });
      }
    } catch (e) {
      setState(() => _error = '불러오기 실패');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _navigate(int deltaDays) {
    final next = _parseYmd(_date).add(Duration(days: deltaDays));
    setState(() => _date = _fmtDate(next));
    _load(_date);
  }

  @override
  Widget build(BuildContext context) {
    final today = _fmtDate(DateTime.now());
    final d = _parseYmd(_date);
    final dateLabel = '${d.month}월 ${d.day}일';
    final dow = '${_weekdays[d.weekday % 7]}요일';

    return AmbientBackground(
      child: Align(
        alignment: Alignment.topCenter,
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 704),
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 32, 16, 112),
            children: [
              const Text(
                '충북과학고 학교급식',
                style: TextStyle(
                  fontWeight: FontWeight.w900,
                  color: Colors.grey,
                  fontSize: 11,
                  letterSpacing: 1.4,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                '오늘 뭐 나와요?',
                style: TextStyle(
                  fontSize: 30,
                  fontWeight: FontWeight.w900,
                  color: Theme.of(context).colorScheme.onSurface,
                ),
              ),
              const SizedBox(height: 20),
              Row(
                children: [
                  _RoundIconButton(
                    icon: Icons.chevron_left,
                    onTap: () => _navigate(-1),
                  ),
                  Expanded(
                    child: Column(
                      key: ValueKey(_date),
                      children: [
                        Text.rich(
                          TextSpan(
                            text: '$dateLabel ',
                            style: const TextStyle(
                              fontSize: 22,
                              fontWeight: FontWeight.w900,
                            ),
                            children: [
                              TextSpan(
                                text: dow,
                                style: TextStyle(
                                  color: Theme.of(context).colorScheme.onSurface
                                      .withValues(alpha: 0.5),
                                ),
                              ),
                            ],
                          ),
                        ),
                        Text(
                          '${d.year}',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.bold,
                            color: Theme.of(
                              context,
                            ).colorScheme.onSurface.withValues(alpha: 0.4),
                          ),
                        ),
                      ],
                    ),
                  ),
                  _RoundIconButton(
                    icon: Icons.chevron_right,
                    onTap: () => _navigate(1),
                  ),
                ],
              ),
              if (_date != today)
                Center(
                  child: TextButton(
                    onPressed: () {
                      setState(() => _date = today);
                      _load(_date);
                    },
                    child: const Text(
                      '← 오늘로 돌아가기',
                      style: TextStyle(
                        fontWeight: FontWeight.w900,
                        fontSize: 11,
                      ),
                    ),
                  ),
                ),
              const SizedBox(height: 16),
              if (_loading)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 64),
                  child: Center(child: CircularProgressIndicator()),
                )
              else if (_error != null)
                _EmptyState(title: _error!)
              else if (_meals == null || _meals!.isEmpty)
                _EmptyState(
                  title: '급식 정보가 없습니다',
                  sub: _note ?? '주말이나 방학일 수 있습니다',
                )
              else
                for (final meal in _meals!)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 16),
                    child: GlassCard(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Row(
                                children: [
                                  Container(
                                    width: 44,
                                    height: 44,
                                    decoration: BoxDecoration(
                                      color:
                                          (_typeColor[meal.type] ??
                                                  Theme.of(
                                                    context,
                                                  ).colorScheme.primary)
                                              .withValues(alpha: 0.14),
                                      shape: BoxShape.circle,
                                    ),
                                    child: Icon(
                                      _typeIcon[meal.type] ?? Icons.restaurant,
                                      color:
                                          _typeColor[meal.type] ??
                                          Theme.of(context).colorScheme.primary,
                                    ),
                                  ),
                                  const SizedBox(width: 12),
                                  Text(
                                    meal.type,
                                    style: const TextStyle(
                                      fontSize: 18,
                                      fontWeight: FontWeight.w900,
                                    ),
                                  ),
                                ],
                              ),
                              if (meal.calories.isNotEmpty)
                                Text(
                                  meal.calories,
                                  style: TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.bold,
                                    color: Theme.of(context)
                                        .colorScheme
                                        .onSurface
                                        .withValues(alpha: 0.5),
                                  ),
                                ),
                            ],
                          ),
                          const SizedBox(height: 16),
                          Wrap(
                            spacing: 16,
                            runSpacing: 4,
                            children: [
                              for (final item in meal.items)
                                SizedBox(
                                  width:
                                      (MediaQuery.of(context).size.width - 90) /
                                      2,
                                  child: Text(
                                    '· $item',
                                    style: const TextStyle(
                                      fontSize: 13,
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ),
            ],
          ),
        ),
      ),
    );
  }
}

class _RoundIconButton extends StatelessWidget {
  const _RoundIconButton({required this.icon, required this.onTap});
  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GlassCard(
      radius: 100,
      padding: EdgeInsets.zero,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          customBorder: const CircleBorder(),
          onTap: onTap,
          child: SizedBox(width: 48, height: 48, child: Icon(icon)),
        ),
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState({required this.title, this.sub});
  final String title;
  final String? sub;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 64),
      alignment: Alignment.center,
      decoration: BoxDecoration(
        border: Border.all(color: Theme.of(context).dividerColor, width: 2),
        borderRadius: BorderRadius.circular(24),
      ),
      child: Column(
        children: [
          Icon(
            Icons.restaurant_outlined,
            size: 40,
            color: Theme.of(
              context,
            ).colorScheme.onSurface.withValues(alpha: 0.3),
          ),
          const SizedBox(height: 12),
          Text(title, style: const TextStyle(fontWeight: FontWeight.w900)),
          if (sub != null) ...[
            const SizedBox(height: 4),
            Text(
              sub!,
              style: TextStyle(
                fontSize: 12,
                color: Theme.of(
                  context,
                ).colorScheme.onSurface.withValues(alpha: 0.5),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:url_launcher/url_launcher.dart';

import '../../core/api_config.dart';
import '../../core/glass.dart';
import '../../core/segmented_tabs.dart';
import 'graveyard_data.dart';

class FeedScreen extends StatefulWidget {
  const FeedScreen({super.key});
  @override
  State<FeedScreen> createState() => _FeedScreenState();
}

class _FeedScreenState extends State<FeedScreen> {
  String _tab = 'school';

  @override
  Widget build(BuildContext context) {
    return AmbientBackground(
      child: Align(
        alignment: Alignment.topCenter,
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 704),
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 40, 16, 112),
            children: [
              const Text(
                'Feed',
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
                'AI 학습 대기 중 읽을거리',
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
                child: AppSegmentedTabs<String>(
                  value: _tab,
                  onChanged: (v) => setState(() => _tab = v),
                  items: [
                    AppTabItem(
                      value: 'school',
                      builder: const _TabLabelBuilder(
                        '🏫 학교 소식',
                        '충북과학고 공지',
                      ).call,
                    ),
                    AppTabItem(
                      value: 'news',
                      builder: const _TabLabelBuilder(
                        '📡 Tech News',
                        'AI · Hacking · Embedded',
                      ).call,
                    ),
                    AppTabItem(
                      value: 'graveyard',
                      builder: const _TabLabelBuilder(
                        '🪦 Graveyard',
                        '서비스 장례식',
                      ).call,
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 32),
              switch (_tab) {
                'school' => const _SchoolNewsView(),
                'news' => const _TechNewsView(),
                _ => const _GraveyardView(),
              },
            ],
          ),
        ),
      ),
    );
  }
}

/// Wraps `_TabLabel` as a `Widget Function(bool active)` so it can be used
/// as an `AppTabItem.builder` — the two-line 학교소식/Tech News/Graveyard
/// labels don't need the active flag to look different, they're just laid
/// out with a title + small description line.
class _TabLabelBuilder {
  const _TabLabelBuilder(this.title, this.description);
  final String title;
  final String description;
  Widget call(bool active) => _TabLabel(title, description, active: active);
}

class _TabLabel extends StatelessWidget {
  const _TabLabel(this.title, this.description, {this.active = false});
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

Future<void> _open(String url) async {
  final uri = Uri.tryParse(url);
  if (uri != null) await launchUrl(uri, mode: LaunchMode.externalApplication);
}

const _rfc822Months = {
  'Jan': 1, 'Feb': 2, 'Mar': 3, 'Apr': 4, 'May': 5, 'Jun': 6,
  'Jul': 7, 'Aug': 8, 'Sep': 9, 'Oct': 10, 'Nov': 11, 'Dec': 12,
};

/// RSS `<pubDate>` fields are RFC 822/1123 ("Fri, 28 Aug 2026 00:00:00
/// GMT"), which `DateTime.tryParse` (ISO 8601 only) can't read — it silently
/// returns null, and the old fallback then just substring'd the raw string,
/// showing the literal RFC text ("Fri, 28 Au...") instead of a date. The web
/// version doesn't have this bug because JS's `new Date(str)` parses RFC 822
/// natively.
DateTime? _parseAnyDate(String d) {
  final iso = DateTime.tryParse(d);
  if (iso != null) return iso;
  final m = RegExp(
    r'(\d{1,2})\s+(\w{3})\s+(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})',
  ).firstMatch(d);
  if (m == null) return null;
  final month = _rfc822Months[m.group(2)];
  if (month == null) return null;
  return DateTime(
    int.parse(m.group(3)!),
    month,
    int.parse(m.group(1)!),
    int.parse(m.group(4)!),
    int.parse(m.group(5)!),
    int.parse(m.group(6)!),
  );
}

String _fmtDate(String d) {
  if (d.isEmpty) return '';
  final dt = _parseAnyDate(d);
  if (dt == null) return d.length >= 10 ? d.substring(0, 10) : d;
  return '${dt.year}.${dt.month.toString().padLeft(2, '0')}.${dt.day.toString().padLeft(2, '0')}';
}

String _ago(String d) {
  final dt = _parseAnyDate(d);
  if (dt == null) return '';
  final ms = DateTime.now().difference(dt).inMilliseconds;
  final h = (ms / 3600000).floor();
  if (h >= 24) return '${(h / 24).floor()}d';
  if (h >= 1) return '${h}h';
  return '${(ms / 60000).floor()}m';
}

// ─── School News ────────────────────────────────────────────────────────────

class _NewsItem {
  _NewsItem({
    required this.title,
    required this.link,
    required this.pubDate,
    required this.author,
  });
  final String title;
  final String link;
  final String pubDate;
  final String author;
}

class _SchoolNewsView extends StatefulWidget {
  const _SchoolNewsView();
  @override
  State<_SchoolNewsView> createState() => _SchoolNewsViewState();
}

class _SchoolNewsViewState extends State<_SchoolNewsView> {
  String _tab = 'notice';
  List<_NewsItem> _items = [];
  bool _loading = false;
  String? _error;
  DateTime? _updated;

  static const _tabs = [
    ('notice', '공지사항'),
    ('letter', '가정통신문'),
    ('schedule', '학사일정'),
  ];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final res = await http
          .get(Uri.parse('${ApiConfig.functionsUrl}/school-news?type=$_tab'))
          .timeout(const Duration(seconds: 12));
      final body = jsonDecode(res.body) as Map<String, dynamic>;
      if (body['error'] != null) throw Exception(body['error']);
      setState(() {
        _items = (body['items'] as List)
            .map(
              (r) => _NewsItem(
                title: r['title'] ?? '',
                link: r['link'] ?? '',
                pubDate: r['pubDate'] ?? '',
                author: r['author'] ?? '',
              ),
            )
            .toList();
        _updated = DateTime.now();
      });
    } catch (_) {
      setState(() => _error = '공지를 불러오지 못했습니다.');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            Expanded(
              child: AppSegmentedTabs<String>(
                value: _tab,
                onChanged: (v) {
                  setState(() => _tab = v);
                  _load();
                },
                items: [
                  for (final t in _tabs)
                    AppTabItem(
                      value: t.$1,
                      builder: (active) => Text(
                        t.$2,
                        style: const TextStyle(
                          fontWeight: FontWeight.w900,
                          fontSize: 11,
                          letterSpacing: 1,
                        ),
                      ),
                    ),
                ],
              ),
            ),
            if (_updated != null)
              Text(
                '${_updated!.hour.toString().padLeft(2, '0')}:${_updated!.minute.toString().padLeft(2, '0')}',
                style: const TextStyle(fontSize: 9, color: Colors.grey),
              ),
            IconButton(
              icon: const Icon(Icons.refresh, size: 16),
              onPressed: _loading ? null : _load,
            ),
            IconButton(
              icon: const Icon(Icons.open_in_new, size: 14),
              onPressed: () => _open('https://school.cbe.go.kr/cbs-h/M010401'),
            ),
          ],
        ),
        if (_error != null)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 8),
            child: Text(
              _error!,
              style: const TextStyle(
                color: Colors.red,
                fontWeight: FontWeight.bold,
                fontSize: 12,
              ),
            ),
          ),
        if (_loading)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 40),
            child: Center(child: CircularProgressIndicator()),
          )
        else ...[
          for (var i = 0; i < _items.length; i++) ...[
            _newsRow(i + 1, _items[i].title, _items[i].link, [
              if (_items[i].author.isNotEmpty) _items[i].author,
              if (_items[i].pubDate.isNotEmpty) _fmtDate(_items[i].pubDate),
            ]),
            const SizedBox(height: 6),
          ],
          if (_items.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Center(
                child: Text.rich(
                  TextSpan(
                    text: '출처: ',
                    style: const TextStyle(fontSize: 10, color: Colors.grey),
                    children: [
                      TextSpan(
                        text: '충북과학고등학교 홈페이지',
                        style: const TextStyle(
                          fontWeight: FontWeight.bold,
                          fontSize: 10,
                          color: Colors.grey,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
        ],
      ],
    );
  }
}

// Web: "flex gap-3 items-start p-3 rounded-xl border border-border/40
// hover:bg-muted/40 ... " — a flat, dense, borderless-fill row (no `bg-card`,
// so no glass). Wrapping every row in a GlassCard turned this into a stack
// of separated frosted panels instead of a dense list.
Widget _newsRow(int index, String title, String link, List<String> meta) {
  return SolidTintCard(
    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
    radius: 12,
    tint: 0,
    child: InkWell(
      onTap: () => _open(link),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 20,
            child: Text(
              '$index',
              textAlign: TextAlign.right,
              style: const TextStyle(
                fontSize: 10,
                color: Colors.grey,
                fontWeight: FontWeight.w900,
              ),
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.bold,
                  ),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
                if (meta.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: Text(
                      meta.join(' · '),
                      style: const TextStyle(fontSize: 10, color: Colors.grey),
                    ),
                  ),
              ],
            ),
          ),
          const Icon(Icons.open_in_new, size: 12, color: Colors.grey),
        ],
      ),
    ),
  );
}

// ─── Tech News ──────────────────────────────────────────────────────────────

class _Category {
  const _Category(this.id, this.label, this.hn, this.google, [this.googleLang]);
  final String id;
  final String label;
  final String hn;
  final String google;
  final String? googleLang;
}

const _categories = [
  _Category(
    'ai',
    'AI / LLM',
    'LLM GPT Claude artificial intelligence machine learning agent 2025',
    'AI LLM ChatGPT Claude machine learning 2025',
  ),
  _Category(
    'security',
    'Security',
    'hacking CVE exploit vulnerability malware ransomware zero-day',
    'CVE vulnerability exploit hacking cybersecurity 2025',
  ),
  _Category(
    'embedded',
    'Embedded',
    'embedded firmware microcontroller IoT RTOS ESP32 RISC-V bare-metal',
    'embedded systems firmware microcontroller IoT RTOS 2025',
  ),
  _Category(
    'research',
    'Research',
    'arxiv paper preprint neural network deep learning research',
    'machine learning research paper arxiv preprint 2025',
  ),
  _Category(
    'oss',
    'Open Source',
    'open source release github rust golang typescript new version',
    'open source release new version programming 2025',
  ),
  _Category(
    'kr',
    '한국 IT',
    'korea samsung naver kakao hyundai kia',
    '인공지능 한국 스타트업 삼성 네이버 카카오 IT',
    'ko',
  ),
];

class _HnStory {
  _HnStory({
    required this.title,
    this.url,
    required this.points,
    required this.comments,
    required this.createdAt,
    required this.id,
  });
  final String id;
  final String title;
  final String? url;
  final int points;
  final int comments;
  final String createdAt;
}

class _GnItem {
  _GnItem({
    required this.title,
    required this.link,
    required this.pubDate,
    required this.source,
  });
  final String title;
  final String link;
  final String pubDate;
  final String source;
}

class _TechNewsView extends StatefulWidget {
  const _TechNewsView();
  @override
  State<_TechNewsView> createState() => _TechNewsViewState();
}

class _TechNewsViewState extends State<_TechNewsView> {
  String _cat = 'ai';
  String _src = 'google';
  List<_HnStory> _hn = [];
  List<_GnItem> _gn = [];
  bool _loading = false;
  String? _error;
  DateTime? _refreshed;
  Timer? _autoRefresh;

  @override
  void initState() {
    super.initState();
    _load();
    _autoRefresh = Timer.periodic(const Duration(minutes: 5), (_) => _load());
  }

  @override
  void dispose() {
    _autoRefresh?.cancel();
    super.dispose();
  }

  Future<void> _load() async {
    final cfg = _categories.firstWhere((c) => c.id == _cat);
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      if (_src == 'hn') {
        final res = await http
            .get(
              Uri.parse(
                'https://hn.algolia.com/api/v1/search_by_date?query=${Uri.encodeComponent(cfg.hn)}&tags=story&hitsPerPage=50',
              ),
            )
            .timeout(const Duration(seconds: 12));
        final body = jsonDecode(res.body) as Map<String, dynamic>;
        _hn = (body['hits'] as List)
            .map(
              (h) => _HnStory(
                id: h['objectID'],
                title: h['title'] ?? '',
                url: h['url'],
                points: h['points'] ?? 0,
                comments: h['num_comments'] ?? 0,
                createdAt: h['created_at'] ?? '',
              ),
            )
            .toList();
      } else {
        final res = await http
            .get(
              Uri.parse(
                '${ApiConfig.functionsUrl}/news?q=${Uri.encodeComponent(cfg.google)}&hl=${cfg.googleLang ?? 'en-US'}',
              ),
            )
            .timeout(const Duration(seconds: 12));
        final body = jsonDecode(res.body) as Map<String, dynamic>;
        _gn = (body['items'] as List)
            .map(
              (r) => _GnItem(
                title: r['title'] ?? '',
                link: r['link'] ?? '',
                pubDate: r['pubDate'] ?? '',
                source: r['source'] ?? '',
              ),
            )
            .toList();
      }
      _refreshed = DateTime.now();
    } catch (_) {
      _error = _src == 'hn'
          ? 'Hacker News를 불러오지 못했습니다.'
          : 'Google News를 불러오지 못했습니다.';
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final total = _src == 'hn' ? _hn.length : _gn.length;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Wrap(
          spacing: 4,
          runSpacing: 4,
          children: [
            for (final c in _categories)
              ChoiceChip(
                label: Text(
                  c.label,
                  style: const TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                selected: _cat == c.id,
                onSelected: (_) {
                  setState(() => _cat = c.id);
                  _load();
                },
              ),
          ],
        ),
        const SizedBox(height: 8),
        Row(
          children: [
            SegmentedButton<String>(
              segments: const [
                ButtonSegment(value: 'google', label: Text('🔍 Google')),
                ButtonSegment(value: 'hn', label: Text('🔶 HN')),
              ],
              selected: {_src},
              onSelectionChanged: (s) {
                setState(() => _src = s.first);
                _load();
              },
              showSelectedIcon: false,
            ),
            const SizedBox(width: 8),
            if (total > 0)
              Text(
                '$total건',
                style: const TextStyle(fontSize: 10, color: Colors.grey),
              ),
            const Spacer(),
            if (_refreshed != null)
              Text(
                '${_refreshed!.hour.toString().padLeft(2, '0')}:${_refreshed!.minute.toString().padLeft(2, '0')}',
                style: const TextStyle(fontSize: 9, color: Colors.grey),
              ),
            IconButton(
              icon: const Icon(Icons.refresh, size: 16),
              onPressed: _loading ? null : _load,
            ),
          ],
        ),
        if (_error != null)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 8),
            child: Text(
              _error!,
              style: const TextStyle(
                color: Colors.red,
                fontWeight: FontWeight.bold,
                fontSize: 12,
              ),
            ),
          ),
        if (_loading)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 40),
            child: Center(child: CircularProgressIndicator()),
          )
        else if (total == 0 && _error == null)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 32),
            child: Center(
              child: Text('결과가 없습니다.', style: TextStyle(color: Colors.grey)),
            ),
          )
        else if (_src == 'hn')
          for (var i = 0; i < _hn.length; i++) ...[
            _newsRow(
              i + 1,
              _hn[i].title,
              _hn[i].url ?? 'https://news.ycombinator.com/item?id=${_hn[i].id}',
              [
                '▲${_hn[i].points}',
                '💬${_hn[i].comments}',
                _ago(_hn[i].createdAt),
              ],
            ),
            const SizedBox(height: 6),
          ]
        else
          for (var i = 0; i < _gn.length; i++) ...[
            _newsRow(i + 1, _gn[i].title, _gn[i].link, [
              if (_gn[i].source.isNotEmpty) _gn[i].source,
              _ago(_gn[i].pubDate),
            ]),
            const SizedBox(height: 6),
          ],
        if (total > 0)
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Center(
              child: Text(
                _src == 'hn'
                    ? 'Via Hacker News'
                    : '🔍 Google News · 5분마다 자동 갱신',
                style: const TextStyle(fontSize: 10, color: Colors.grey),
              ),
            ),
          ),
      ],
    );
  }
}

// ─── Graveyard ──────────────────────────────────────────────────────────────

class _GraveyardView extends StatefulWidget {
  const _GraveyardView();
  @override
  State<_GraveyardView> createState() => _GraveyardViewState();
}

class _GraveyardViewState extends State<_GraveyardView> {
  String _filter = '';

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final sorted = [...graveyard]
      ..sort(
        (a, b) => DateTime(
          b.year,
          b.month,
          b.day,
        ).compareTo(DateTime(a.year, a.month, a.day)),
      );
    final todayMatches = sorted
        .where((s) => s.month == now.month && s.day == now.day)
        .toList();
    final List<DeadService> featured;
    final String label;
    final List<DeadService> rest;
    if (todayMatches.isNotEmpty) {
      featured = todayMatches;
      label = '${now.month}월 ${now.day}일 — 오늘의 장례식';
      rest = sorted
          .where((s) => !(s.month == now.month && s.day == now.day))
          .toList();
    } else {
      featured = [sorted.first];
      label = '가장 최근에 떠난 서비스';
      rest = sorted.skip(1).toList();
    }
    final filtered = _filter.isEmpty
        ? rest
        : rest
              .where(
                (s) =>
                    s.name.toLowerCase().contains(_filter.toLowerCase()) ||
                    s.category.toLowerCase().contains(_filter.toLowerCase()) ||
                    s.desc.toLowerCase().contains(_filter.toLowerCase()) ||
                    '${s.year}'.contains(_filter),
              )
              .toList();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Center(child: Text('🪦', style: TextStyle(fontSize: 40))),
        const SizedBox(height: 4),
        const Center(
          child: Text(
            'Digital Cemetery',
            style: TextStyle(fontWeight: FontWeight.w900, fontSize: 18),
          ),
        ),
        Center(
          child: Text(
            '우리가 사랑했던 서비스들의 안식처 · ${graveyard.length}위 안장',
            style: const TextStyle(fontSize: 11, color: Colors.grey),
          ),
        ),
        const SizedBox(height: 20),
        _FuneralAltar(services: featured, label: label),
        const SizedBox(height: 24),
        Row(
          children: [
            Text(
              'In Memoriam (${filtered.length})',
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w900,
                color: Colors.grey.shade600,
                letterSpacing: 1,
              ),
            ),
            const Spacer(),
            SizedBox(
              width: 130,
              height: 32,
              child: TextField(
                decoration: const InputDecoration(
                  hintText: '검색...',
                  isDense: true,
                ),
                style: const TextStyle(fontSize: 11),
                onChanged: (v) => setState(() => _filter = v),
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        for (final s in filtered) ...[
          _TombstoneCard(s: s),
          const SizedBox(height: 6),
        ],
      ],
    );
  }
}

class _MemorialPortrait extends StatelessWidget {
  const _MemorialPortrait({required this.s, this.large = false});
  final DeadService s;
  final bool large;

  @override
  Widget build(BuildContext context) {
    final w = large ? 180.0 : 150.0;
    final h = large ? 220.0 : 190.0;
    return Column(
      children: [
        Container(
          width: w,
          height: h,
          padding: const EdgeInsets.all(7),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [Color(0xFF111111), Color(0xFF1E1E1E), Color(0xFF111111)],
            ),
            borderRadius: BorderRadius.circular(6),
            boxShadow: const [
              BoxShadow(
                color: Colors.black87,
                blurRadius: 20,
                offset: Offset(0, 6),
              ),
            ],
          ),
          child: Container(
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [
                  Color(0xFF241E14),
                  Color(0xFF1A1510),
                  Color(0xFF241E14),
                ],
              ),
              border: Border.all(color: Colors.white.withValues(alpha: 0.06)),
              borderRadius: BorderRadius.circular(3),
            ),
            child: Stack(
              alignment: Alignment.center,
              children: [
                Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(
                      s.emoji ?? '🪦',
                      style: TextStyle(fontSize: large ? 48 : 38),
                    ),
                    const SizedBox(height: 6),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 8),
                      child: Text(
                        s.name,
                        textAlign: TextAlign.center,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          color: Colors.white70,
                          fontSize: 10,
                          fontWeight: FontWeight.w900,
                          letterSpacing: 0.5,
                        ),
                      ),
                    ),
                    Text(
                      '${s.born ?? '??'} — ${s.year}',
                      style: const TextStyle(
                        color: Color(0xB4B49650),
                        fontSize: 9,
                      ),
                    ),
                  ],
                ),
                Positioned(
                  child: Transform.rotate(
                    angle: -0.73,
                    child: Container(
                      width: w * 1.4,
                      height: 13,
                      color: Colors.black.withValues(alpha: 0.88),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 8),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 5),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [Color(0xFF2A2010), Color(0xFF1A1508)],
            ),
            border: Border.all(color: const Color(0x40B49638)),
            borderRadius: BorderRadius.circular(3),
          ),
          child: Column(
            children: [
              Text(
                s.name.toUpperCase(),
                textAlign: TextAlign.center,
                style: const TextStyle(
                  color: Color(0xE6DCB964),
                  fontSize: 10,
                  fontWeight: FontWeight.w900,
                  letterSpacing: 1,
                ),
              ),
              Text(
                '${s.month.toString().padLeft(2, '0')}.${s.day.toString().padLeft(2, '0')}.${s.year}',
                style: const TextStyle(color: Color(0xA6966028), fontSize: 9),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _FuneralAltar extends StatelessWidget {
  const _FuneralAltar({required this.services, required this.label});
  final List<DeadService> services;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(20, 28, 20, 32),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [Color(0xFF0A0A0A), Color(0xFF0F0D09), Color(0xFF0A0A0A)],
        ),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0x26B49638)),
      ),
      child: Column(
        children: [
          const Text(
            '✦ ✦ ✦',
            style: TextStyle(color: Color(0x80B49638), fontSize: 10),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            textAlign: TextAlign.center,
            style: const TextStyle(
              color: Color(0xD9DCB964),
              fontSize: 13,
              fontWeight: FontWeight.w900,
              letterSpacing: 3,
            ),
          ),
          const SizedBox(height: 2),
          const Text(
            '✦ ✦ ✦',
            style: TextStyle(color: Color(0x80B49638), fontSize: 10),
          ),
          const SizedBox(height: 16),
          const Text('🌸🌸🌸🌺🌸🌸🌸', style: TextStyle(fontSize: 16)),
          const SizedBox(height: 16),
          Wrap(
            spacing: 20,
            runSpacing: 16,
            alignment: WrapAlignment.center,
            children: [
              for (final s in services)
                _MemorialPortrait(s: s, large: services.length == 1),
            ],
          ),
          const SizedBox(height: 20),
          const Text('🕯️  🧵🧵🧵  🕯️', style: TextStyle(fontSize: 22)),
          const SizedBox(height: 16),
          const Text('🌸🌸🌸🌺🌸🌸🌸', style: TextStyle(fontSize: 13)),
          for (final s in services)
            Container(
              margin: const EdgeInsets.only(top: 16),
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.02),
                border: Border.all(color: const Color(0x1AB49638)),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Wrap(
                    crossAxisAlignment: WrapCrossAlignment.center,
                    spacing: 6,
                    children: [
                      Text(
                        s.emoji ?? '🪦',
                        style: const TextStyle(fontSize: 18),
                      ),
                      Text(
                        s.name,
                        style: const TextStyle(
                          color: Color(0xE6DCC896),
                          fontSize: 13,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 8,
                          vertical: 2,
                        ),
                        decoration: BoxDecoration(
                          color: const Color(0x14B49638),
                          border: Border.all(color: const Color(0x26B49638)),
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: Text(
                          s.category,
                          style: const TextStyle(
                            fontSize: 9,
                            color: Color(0xB3966028),
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Text(
                    s.desc,
                    style: const TextStyle(
                      color: Color(0xBFB4AA96),
                      fontSize: 12,
                      height: 1.5,
                    ),
                  ),
                  Container(
                    margin: const EdgeInsets.only(top: 10),
                    padding: const EdgeInsets.only(top: 10),
                    decoration: const BoxDecoration(
                      border: Border(top: BorderSide(color: Color(0x14B49638))),
                    ),
                    child: Text(
                      '"${s.epitaph ?? ''}"',
                      style: const TextStyle(
                        color: Color(0x80A08C64),
                        fontSize: 11,
                        fontStyle: FontStyle.italic,
                      ),
                    ),
                  ),
                  if (s.born != null)
                    Padding(
                      padding: const EdgeInsets.only(top: 6),
                      child: Text(
                        '${s.born} — ${s.year} · 향년 ${s.year - s.born!}세',
                        style: const TextStyle(
                          color: Color(0x66826446),
                          fontSize: 9,
                          fontWeight: FontWeight.bold,
                          letterSpacing: 1,
                        ),
                      ),
                    ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

class _TombstoneCard extends StatefulWidget {
  const _TombstoneCard({required this.s});
  final DeadService s;
  @override
  State<_TombstoneCard> createState() => _TombstoneCardState();
}

class _TombstoneCardState extends State<_TombstoneCard> {
  bool _open = false;

  @override
  Widget build(BuildContext context) {
    final s = widget.s;
    // Web: "rounded-2xl border border-border/40 bg-muted/10" — flat muted
    // tint, not glass.
    return SolidTintCard(
      padding: EdgeInsets.zero,
      radius: 18,
      tint: 0.05,
      child: InkWell(
        onTap: () => setState(() => _open = !_open),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(s.emoji ?? '🪦', style: const TextStyle(fontSize: 20)),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Expanded(
                              child: Text(
                                s.name,
                                style: const TextStyle(
                                  fontWeight: FontWeight.w900,
                                  fontSize: 13,
                                ),
                              ),
                            ),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 6,
                                vertical: 2,
                              ),
                              decoration: BoxDecoration(
                                color: Colors.grey.withValues(alpha: 0.15),
                                borderRadius: BorderRadius.circular(10),
                              ),
                              child: Text(
                                s.category,
                                style: const TextStyle(
                                  fontSize: 9,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ),
                          ],
                        ),
                        Text(
                          s.desc,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontSize: 11,
                            color: Colors.grey,
                          ),
                        ),
                        Padding(
                          padding: const EdgeInsets.only(top: 4),
                          child: Text(
                            'RIP ${s.year}${s.born != null ? ' · 향년 ${s.year - s.born!}세' : ''}',
                            style: TextStyle(
                              fontSize: 9,
                              fontWeight: FontWeight.w900,
                              color: Colors.grey.withValues(alpha: 0.5),
                              letterSpacing: 1,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  Icon(
                    _open ? Icons.keyboard_arrow_up : Icons.keyboard_arrow_down,
                    size: 16,
                    color: Colors.grey,
                  ),
                ],
              ),
              if (_open) ...[
                const Divider(height: 24),
                Center(child: _MemorialPortrait(s: s)),
                const SizedBox(height: 10),
                Center(
                  child: Text(
                    '"${s.epitaph ?? ''}"',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 11,
                      fontStyle: FontStyle.italic,
                      color: Colors.grey.withValues(alpha: 0.6),
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

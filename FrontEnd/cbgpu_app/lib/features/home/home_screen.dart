import 'dart:math';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:http/http.dart' as http;
import 'package:supabase_flutter/supabase_flutter.dart';
import 'dart:convert';

import '../../core/admin_state.dart';
import '../../core/glass.dart';
import '../../core/home_widgets.dart';
import '../../core/push_notifications.dart';
import '../../core/theme.dart';

class _Feature {
  const _Feature(this.label, this.icon, this.color, this.route);
  final String label;
  final IconData icon;
  final Color color;

  final String route;
}

// Mirrors FEATURES in the Next.js home page (src/app/page.tsx) — same order,
// same labels, same Tailwind -400 accent colors, Material-icon equivalents
// of the lucide-react icons there.
final _features = [
  _Feature('자습신청', Icons.menu_book_outlined, AppColors.featureBlue, '/study'),
  _Feature(
    '시간표',
    Icons.calendar_month_outlined,
    AppColors.featureIndigo,
    '/timetable',
  ),
  _Feature('급식', Icons.restaurant_outlined, AppColors.featureAmber, '/meal'),
  _Feature('투표', Icons.how_to_vote_outlined, AppColors.featureViolet, '/polls'),
  _Feature('연구노트', Icons.edit_note_outlined, AppColors.featureTeal, '/notes'),
  _Feature('스터디 매칭', Icons.groups_outlined, AppColors.featureSky, '/match'),
  _Feature(
    'GPU 대여',
    Icons.memory_outlined,
    AppColors.featureSlate,
    '/dashboard',
  ),
  _Feature('서버 배포', Icons.dns_outlined, AppColors.featureEmerald, '/server'),
  _Feature(
    '제작',
    Icons.print_outlined,
    AppColors.featureOrange,
    '/manufacturing',
  ),
  _Feature('도구', Icons.build_outlined, AppColors.featureCyan, '/tools'),
  _Feature(
    'Arcade',
    Icons.sports_esports_outlined,
    AppColors.featureViolet,
    '/games',
  ),
  _Feature('Feed', Icons.article_outlined, AppColors.featureBlue, '/feed'),
];

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  String? _fullName;
  String? _avatarUrl;
  String _greeting = '안녕하세요';

  static const _phrases = <List<String>>[
    ['깊은 밤이네요', '아직 안 잤네요', '푹 쉬어요', '조용한 새벽이에요'],
    ['좋은 아침이에요', '활기찬 아침이네요', '상큼한 아침이에요', '잠은 잘 잤나요'],
    ['활기찬 오전이네요', '집중하기 좋은 오전이에요', '오전도 파이팅이에요', '점심까지 얼마 안 남았어요'],
    ['점심 맛있게 드셨나요', '든든하게 챙겨 드세요', '맛있는 시간이네요', '급식 메뉴 확인해봤나요'],
    ['나른한 오후네요', '오후도 힘내봐요', '조금만 더 힘내요', '오후 컨디션은 어때요'],
    ['편안한 저녁이에요', '저녁 시간이 왔네요', '오늘 하루도 고생했어요', '저녁 식사 하셨나요'],
    ['늦은 밤이네요', '오늘 하루도 고생했어요', '슬슬 쉴 시간이에요', '밤이 깊어가네요'],
  ];

  @override
  void initState() {
    super.initState();
    _loadProfile();
    _loadGreeting();
    registerDeviceForPushNotifications();
    refreshAllHomeWidgets();
  }

  int _timeBracket(int hour) {
    if (hour >= 5 && hour < 9) return 1;
    if (hour >= 9 && hour < 12) return 2;
    if (hour >= 12 && hour < 14) return 3;
    if (hour >= 14 && hour < 18) return 4;
    if (hour >= 18 && hour < 21) return 5;
    if (hour >= 21) return 6;
    return 0;
  }

  Future<void> _loadGreeting() async {
    final bracket = _timeBracket(DateTime.now().hour);
    final random = Random();
    if (mounted) {
      setState(
        () => _greeting =
            _phrases[bracket][random.nextInt(_phrases[bracket].length)],
      );
    }
    try {
      final response = await http
          .get(
            Uri.parse(
              'https://api.open-meteo.com/v1/forecast?latitude=36.64&longitude=127.49&current_weather=true',
            ),
          )
          .timeout(const Duration(seconds: 5));
      final code =
          (jsonDecode(response.body)
                  as Map<String, dynamic>)['current_weather']?['weathercode']
              as num?;
      if (code == null || !mounted) return;
      const rain = {
        51,
        53,
        55,
        56,
        57,
        61,
        63,
        65,
        66,
        67,
        80,
        81,
        82,
        95,
        96,
        99,
      };
      const snow = {71, 73, 75, 77, 85, 86};
      if (rain.contains(code.toInt())) {
        setState(
          () => _greeting =
              '비 오는 ${bracket < 3
                  ? '아침'
                  : bracket < 5
                  ? '오후'
                  : '밤'}이에요',
        );
      }
      if (snow.contains(code.toInt())) setState(() => _greeting = '눈이 내리고 있어요');
    } catch (_) {
      // The web version also silently keeps the time-based greeting on failure.
    }
  }

  Future<void> _loadProfile() async {
    final user = Supabase.instance.client.auth.currentUser;
    if (user == null) return;
    final data = await Supabase.instance.client
        .from('profiles')
        .select('full_name, avatar_url, is_admin')
        .eq('id', user.id)
        .maybeSingle();
    if (mounted) {
      setState(() {
        _fullName = data?['full_name'] as String?;
        _avatarUrl = data?['avatar_url'] as String?;
      });
    }
    isAdminNotifier.value = data?['is_admin'] == true;
  }

  @override
  Widget build(BuildContext context) {
    final width = MediaQuery.of(context).size.width;
    final loggedIn = Supabase.instance.client.auth.currentUser != null;
    final columns = width >= 640 ? 4 : 2;
    final horizontalPadding = width >= 768 ? 24.0 : 16.0;

    return AmbientBackground(
      child: Align(
        alignment: Alignment.topCenter,
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 944),
          child: ListView(
            // Extra bottom padding so the last grid row doesn't sit under the
            // floating bottom nav (mirrors the web app's `pb-28` on mobile).
            padding: EdgeInsets.fromLTRB(
              horizontalPadding,
              40,
              horizontalPadding,
              width < 1280 ? 112 : 40,
            ),
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  if (_avatarUrl != null) ...[
                    ClipOval(
                      child: Image.network(
                        _avatarUrl!,
                        width: 64,
                        height: 64,
                        fit: BoxFit.cover,
                        errorBuilder: (_, _, _) =>
                            const SizedBox(width: 64, height: 64),
                      ),
                    ),
                    const SizedBox(width: 16),
                    Container(
                      width: 1,
                      height: 64,
                      color: Theme.of(context).dividerColor,
                    ),
                    const SizedBox(width: 16),
                  ],
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          _fullName != null
                              ? '$_fullName님, $_greeting'
                              : '$_greeting,',
                          style: TextStyle(
                            fontSize: width >= 1024
                                ? 36
                                : width >= 768
                                ? 30
                                : width >= 640
                                ? 24
                                : 20,
                            fontWeight: FontWeight.w900,
                            letterSpacing: -0.8,
                          ),
                        ),
                        Text(
                          '오늘은 뭘 도와드릴까요?',
                          style: TextStyle(
                            fontSize: width >= 1024
                                ? 36
                                : width >= 768
                                ? 30
                                : width >= 640
                                ? 24
                                : 20,
                            fontWeight: FontWeight.w900,
                            color: Theme.of(
                              context,
                            ).colorScheme.onSurface.withValues(alpha: 0.4),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 40),
              GridView.builder(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: _features.length,
                gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: columns,
                  mainAxisSpacing: 12,
                  crossAxisSpacing: 12,
                  childAspectRatio: width >= 640 ? 1.25 : 1.1,
                ),
                itemBuilder: (context, i) {
                  final f = _features[i];
                  return _FeatureCard(
                    feature: f,
                    onTap: () => context.go(f.route),
                  );
                },
              ),
              if (!loggedIn) ...[
                const SizedBox(height: 40),
                Material(
                  color: AppColors.primary,
                  borderRadius: BorderRadius.circular(28),
                  child: InkWell(
                    borderRadius: BorderRadius.circular(28),
                    onTap: () => context.go('/auth/signup'),
                    child: const Padding(
                      padding: EdgeInsets.all(24),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            '아직 계정이 없으신가요?',
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 18,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                          SizedBox(height: 4),
                          Text(
                            '가입하고 학교생활에 필요한 모든 걸 한 곳에서 확인하세요 →',
                            style: TextStyle(
                              color: Color(0xCCFFFFFF),
                              fontSize: 14,
                            ),
                          ),
                        ],
                      ),
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

class _FeatureCard extends StatelessWidget {
  const _FeatureCard({required this.feature, required this.onTap});
  final _Feature feature;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GlassCard(
      radius: 28,
      padding: const EdgeInsets.all(0),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(28),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: feature.color.withValues(alpha: 0.10),
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Icon(feature.icon, color: feature.color, size: 20),
                ),
                const Spacer(),
                Text(
                  feature.label,
                  style: const TextStyle(
                    fontWeight: FontWeight.bold,
                    fontSize: 14,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

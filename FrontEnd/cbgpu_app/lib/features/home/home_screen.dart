import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../core/glass.dart';
import '../../core/push_notifications.dart';
import '../../core/theme.dart';

class _Feature {
  const _Feature(this.label, this.icon, this.color, [this.route]);
  final String label;
  final IconData icon;
  final Color color;
  /// Real route once migrated; falls back to /soon/:label until then.
  final String? route;
}

// Mirrors FEATURES in the Next.js home page (src/app/page.tsx) — same order,
// same labels, same Tailwind -400 accent colors, Material-icon equivalents
// of the lucide-react icons there.
final _features = [
  _Feature('자습신청', Icons.menu_book_outlined, AppColors.featureBlue, '/study'),
  _Feature('시간표', Icons.calendar_month_outlined, AppColors.featureIndigo, '/timetable'),
  _Feature('급식', Icons.restaurant_outlined, AppColors.featureAmber, '/meal'),
  _Feature('투표', Icons.how_to_vote_outlined, AppColors.featureViolet, '/polls'),
  _Feature('연구노트', Icons.edit_note_outlined, AppColors.featureTeal, '/notes'),
  _Feature('스터디 매칭', Icons.groups_outlined, AppColors.featureSky, '/match'),
  _Feature('GPU 대여', Icons.memory_outlined, AppColors.featureSlate, '/dashboard'),
  _Feature('서버 배포', Icons.dns_outlined, AppColors.featureEmerald, '/server'),
  _Feature('제작', Icons.print_outlined, AppColors.featureOrange),
  _Feature('도구', Icons.build_outlined, AppColors.featureCyan, '/tools'),
  _Feature('Arcade', Icons.sports_esports_outlined, AppColors.featureViolet),
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

  @override
  void initState() {
    super.initState();
    _loadProfile();
    registerDeviceForPushNotifications();
  }

  Future<void> _loadProfile() async {
    final user = Supabase.instance.client.auth.currentUser;
    if (user == null) return;
    final data = await Supabase.instance.client
        .from('profiles')
        .select('full_name, avatar_url')
        .eq('id', user.id)
        .maybeSingle();
    if (mounted) {
      setState(() {
        _fullName = data?['full_name'] as String?;
        _avatarUrl = data?['avatar_url'] as String?;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final width = MediaQuery.of(context).size.width;
    final columns = width >= 900 ? 6 : (width >= 600 ? 4 : 3);

    return AmbientBackground(
      child: ListView(
        // Extra bottom padding so the last grid row doesn't sit under the
        // floating bottom nav (mirrors the web app's `pb-28` on mobile).
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 100),
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
                    errorBuilder: (_, _, _) => const SizedBox(width: 64, height: 64),
                  ),
                ),
                const SizedBox(width: 16),
                Container(width: 1, height: 64, color: Theme.of(context).dividerColor),
                const SizedBox(width: 16),
              ],
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      _fullName != null ? '$_fullName님,' : '안녕하세요,',
                      style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w900),
                    ),
                    Text(
                      '오늘은 뭘 도와드릴까요?',
                      style: TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.w900,
                        color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.4),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 24),
          GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: _features.length,
            gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: columns,
              mainAxisSpacing: 12,
              crossAxisSpacing: 12,
              childAspectRatio: 1.1,
            ),
            itemBuilder: (context, i) {
              final f = _features[i];
              return _FeatureCard(feature: f, onTap: () => context.go(f.route ?? '/soon/${Uri.encodeComponent(f.label)}'));
            },
          ),
        ],
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
      radius: 24,
      padding: const EdgeInsets.all(0),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(24),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(color: feature.color.withValues(alpha: 0.14), shape: BoxShape.circle),
                  child: Icon(feature.icon, color: feature.color, size: 22),
                ),
                const Spacer(),
                Text(feature.label, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

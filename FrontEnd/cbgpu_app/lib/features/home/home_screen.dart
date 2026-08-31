import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

class _Feature {
  const _Feature(this.label, this.icon, this.color);
  final String label;
  final IconData icon;
  final Color color;
}

// Mirrors FEATURES in the Next.js home page (src/app/page.tsx) — same order,
// same labels, Material-icon equivalents of the lucide-react icons there.
const _features = [
  _Feature('자습신청', Icons.menu_book_outlined, Colors.blue),
  _Feature('시간표', Icons.calendar_month_outlined, Colors.indigo),
  _Feature('급식', Icons.restaurant_outlined, Colors.amber),
  _Feature('투표', Icons.how_to_vote_outlined, Colors.deepPurple),
  _Feature('연구노트', Icons.edit_note_outlined, Colors.teal),
  _Feature('스터디 매칭', Icons.groups_outlined, Colors.lightBlue),
  _Feature('GPU 대여', Icons.memory_outlined, Colors.blueGrey),
  _Feature('서버 배포', Icons.dns_outlined, Colors.green),
  _Feature('제작', Icons.print_outlined, Colors.orange),
  _Feature('도구', Icons.build_outlined, Colors.cyan),
  _Feature('Arcade', Icons.sports_esports_outlined, Colors.purple),
  _Feature('Feed', Icons.article_outlined, Colors.blue),
];

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  String? _fullName;

  @override
  void initState() {
    super.initState();
    _loadProfile();
  }

  Future<void> _loadProfile() async {
    final user = Supabase.instance.client.auth.currentUser;
    if (user == null) return;
    final data = await Supabase.instance.client
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .maybeSingle();
    if (mounted) setState(() => _fullName = data?['full_name'] as String?);
  }

  @override
  Widget build(BuildContext context) {
    final width = MediaQuery.of(context).size.width;
    final columns = width >= 900 ? 6 : (width >= 600 ? 4 : 3);

    return Scaffold(
      appBar: AppBar(
        title: const Text('CBGPU', style: TextStyle(fontWeight: FontWeight.w900, fontStyle: FontStyle.italic)),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout),
            tooltip: '로그아웃',
            onPressed: () => Supabase.instance.client.auth.signOut(),
          ),
        ],
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            Text(
              _fullName != null ? '$_fullName님,' : '안녕하세요,',
              style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w900),
            ),
            const Text('오늘은 뭘 도와드릴까요?', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w900, color: Colors.grey)),
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
                return _FeatureCard(feature: f, onTap: () => context.go('/soon/${Uri.encodeComponent(f.label)}'));
              },
            ),
          ],
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
    return Card(
      child: InkWell(
        borderRadius: BorderRadius.circular(28),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(color: feature.color.withValues(alpha: 0.12), shape: BoxShape.circle),
                child: Icon(feature.icon, color: feature.color, size: 22),
              ),
              const Spacer(),
              Text(feature.label, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
            ],
          ),
        ),
      ),
    );
  }
}

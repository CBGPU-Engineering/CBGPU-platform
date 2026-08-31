import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'glass.dart';
import 'theme_controller.dart';

// Bundled locally (assets/logo.webp) instead of hotlinking the same
// namu.wiki URL the web app uses — that host doesn't send CORS headers,
// so Flutter Web's canvas-based image loading gets blocked outright
// (a plain <img> tag on the web app doesn't have this restriction).
const _logoAsset = 'assets/logo.webp';

class _NavLink {
  const _NavLink(this.label, this.route);
  final String label;
  final String route;
}

class _NavGroup {
  const _NavGroup(this.label, this.icon, this.links);
  final String label;
  final IconData icon;
  final List<_NavLink> links;
}

// Mirrors Navbar.tsx's GROUPS + PRIMARY_LINKS.
final _primaryLinks = [
  _NavLink('GPU', '/soon/GPU'),
  _NavLink('Server', '/soon/Server'),
  _NavLink('Manufacture', '/soon/Manufacture'),
];

final _groups = [
  _NavGroup('학교생활', Icons.school_outlined, [
    _NavLink('자습신청', '/soon/자습신청'),
    _NavLink('시간표', '/soon/시간표'),
    _NavLink('급식', '/soon/급식'),
    _NavLink('스터디', '/soon/스터디'),
  ]),
  _NavGroup('도구', Icons.build_outlined, [
    _NavLink('노트', '/soon/노트'),
    _NavLink('도구', '/soon/도구'),
    _NavLink('Arcade', '/soon/Arcade'),
  ]),
  _NavGroup('정보', Icons.article_outlined, [
    _NavLink('투표', '/soon/투표'),
    _NavLink('Feed', '/soon/Feed'),
  ]),
];

// Bottom floating tab bar categories — mirrors BOTTOM_CATEGORIES_LEFT/RIGHT.
final _bottomLeft = [
  _NavGroup('학교생활', Icons.school_outlined, _groups[0].links),
  _NavGroup('GPU', Icons.memory_outlined, _primaryLinks),
];
final _bottomRight = [
  _NavGroup('도구', Icons.build_outlined, _groups[1].links),
  _NavGroup('정보', Icons.article_outlined, _groups[2].links),
];

/// Wraps every route the same way the web app's root layout always renders
/// Navbar above {children} — a persistent top bar (logo, theme toggle, menu)
/// on every screen, plus the floating bottom tab bar when signed in (mirrors
/// the web app's `{user && !isLoading && (...)}` gate on the bottom nav).
class AppShell extends StatelessWidget {
  const AppShell({super.key, required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final loggedIn = Supabase.instance.client.auth.currentSession != null;

    return Scaffold(
      appBar: AppBar(
        backgroundColor: Theme.of(context).canvasColor,
        title: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Image.asset(_logoAsset, width: 26, height: 26),
            const SizedBox(width: 8),
            const Text('CBGPU'),
          ],
        ),
        actions: [
          ValueListenableBuilder<ThemeMode>(
            valueListenable: themeModeNotifier,
            builder: (context, mode, _) => IconButton(
              icon: Icon(Theme.of(context).brightness == Brightness.dark ? Icons.dark_mode_outlined : Icons.light_mode_outlined),
              onPressed: () => toggleThemeMode(context),
            ),
          ),
          IconButton(
            icon: const Icon(Icons.menu),
            onPressed: () => _openMenu(context, loggedIn),
          ),
        ],
      ),
      body: Stack(
        children: [
          child,
          if (loggedIn) const Positioned(left: 12, right: 12, bottom: 12, child: _BottomNav()),
        ],
      ),
    );
  }

  void _openMenu(BuildContext context, bool loggedIn) {
    showModalBottomSheet(
      context: context,
      showDragHandle: true,
      builder: (context) => SafeArea(
        child: ListView(
          shrinkWrap: true,
          padding: const EdgeInsets.symmetric(vertical: 8),
          children: [
            if (loggedIn) ...[
              for (final l in _primaryLinks)
                ListTile(title: Text(l.label, style: const TextStyle(fontWeight: FontWeight.w900)), onTap: () => _go(context, l.route)),
              const Divider(),
              for (final g in _groups) ...[
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
                  child: Text(g.label, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: Colors.grey.shade600)),
                ),
                for (final l in g.links)
                  ListTile(title: Text(l.label, style: const TextStyle(fontWeight: FontWeight.bold)), onTap: () => _go(context, l.route)),
              ],
              const Divider(),
              ListTile(
                leading: const Icon(Icons.logout),
                title: const Text('Sign Out', style: TextStyle(fontWeight: FontWeight.bold)),
                onTap: () {
                  Navigator.pop(context);
                  Supabase.instance.client.auth.signOut();
                },
              ),
            ] else ...[
              ListTile(title: const Text('Login', style: TextStyle(fontWeight: FontWeight.w900)), onTap: () => _go(context, '/login')),
              ListTile(title: const Text('Join', style: TextStyle(fontWeight: FontWeight.w900)), onTap: () => _go(context, '/signup')),
            ],
          ],
        ),
      ),
    );
  }

  void _go(BuildContext context, String route) {
    Navigator.pop(context);
    context.go(route);
  }
}

class _BottomNav extends StatefulWidget {
  const _BottomNav();
  @override
  State<_BottomNav> createState() => _BottomNavState();
}

class _BottomNavState extends State<_BottomNav> {
  @override
  Widget build(BuildContext context) {
    return GlassCard(
      radius: 28,
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Expanded(child: Row(mainAxisAlignment: MainAxisAlignment.spaceEvenly, children: _bottomLeft.map(_categoryButton).toList())),
          Transform.translate(
            offset: const Offset(0, -14),
            child: InkWell(
              customBorder: const CircleBorder(),
              onTap: () => context.go('/'),
              child: Container(
                width: 52,
                height: 52,
                decoration: BoxDecoration(color: Theme.of(context).colorScheme.primary, shape: BoxShape.circle),
                child: const Icon(Icons.home_rounded, color: Colors.white),
              ),
            ),
          ),
          Expanded(child: Row(mainAxisAlignment: MainAxisAlignment.spaceEvenly, children: _bottomRight.map(_categoryButton).toList())),
        ],
      ),
    );
  }

  Widget _categoryButton(_NavGroup group) {
    return Builder(
      builder: (context) => InkWell(
        onTap: () => _openCategory(context, group),
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 4, horizontal: 6),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(group.icon, size: 20, color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.6)),
              const SizedBox(height: 2),
              Text(group.label, style: TextStyle(fontSize: 9, fontWeight: FontWeight.w900, color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.6))),
            ],
          ),
        ),
      ),
    );
  }

  void _openCategory(BuildContext context, _NavGroup group) {
    final box = context.findRenderObject() as RenderBox;
    final position = box.localToGlobal(Offset.zero);
    showMenu(
      context: context,
      position: RelativeRect.fromLTRB(position.dx, position.dy - 10, position.dx, position.dy),
      items: [
        for (final l in group.links)
          PopupMenuItem(
            value: l.route,
            child: Text(l.label, style: const TextStyle(fontWeight: FontWeight.bold)),
          ),
      ],
    ).then((route) {
      if (route != null && context.mounted) context.go(route);
    });
  }
}

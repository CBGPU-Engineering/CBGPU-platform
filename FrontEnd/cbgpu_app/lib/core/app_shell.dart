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

// Bottom floating tab bar categories (mobile only) — mirrors
// BOTTOM_CATEGORIES_LEFT/RIGHT. GPU/Server/Manufacture grouped under
// "학교자원" (school resources), not "GPU" — they're not all GPU-related,
// the actual common thread is borrowing a school-owned resource.
final _bottomLeft = [
  _NavGroup('학교생활', Icons.school_outlined, _groups[0].links),
  _NavGroup('학교자원', Icons.memory_outlined, _primaryLinks),
];
final _bottomRight = [
  _NavGroup('도구', Icons.build_outlined, _groups[1].links),
  _NavGroup('정보', Icons.article_outlined, _groups[2].links),
];

/// Wraps every route the same way the web app's root layout always renders
/// Navbar above {children}. Responsive the same way the web navbar is: below
/// the desktop breakpoint it's a hamburger menu + floating bottom tab bar
/// (phone-shaped chrome); at or above it, a horizontal pill nav + account
/// menu in the top bar and no bottom bar — the same split that was missing
/// entirely at first (this app used phone-style chrome at every width).
class AppShell extends StatelessWidget {
  const AppShell({super.key, required this.child});
  final Widget child;

  static const double _desktopBreakpoint = 900;

  @override
  Widget build(BuildContext context) {
    final loggedIn = Supabase.instance.client.auth.currentSession != null;
    final isDesktop = MediaQuery.of(context).size.width >= _desktopBreakpoint;

    return Scaffold(
      appBar: AppBar(
        backgroundColor: Theme.of(context).canvasColor,
        titleSpacing: isDesktop ? 24 : null,
        title: Row(
          children: [
            Image.asset(_logoAsset, width: 26, height: 26),
            const SizedBox(width: 8),
            const Text('CBGPU'),
            if (isDesktop && loggedIn) ...[
              const SizedBox(width: 32),
              for (final l in _primaryLinks) _DesktopLinkButton(label: l.label, onTap: () => context.go(l.route)),
              _DesktopMenuButton(groups: _groups),
            ],
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
          if (!isDesktop)
            IconButton(icon: const Icon(Icons.menu), onPressed: () => _openMobileMenu(context, loggedIn))
          else if (loggedIn)
            const _DesktopAccountButton()
          else ...[
            TextButton(onPressed: () => context.go('/login'), child: const Text('LOGIN')),
            const SizedBox(width: 4),
            FilledButton(onPressed: () => context.go('/signup'), child: const Text('JOIN')),
            const SizedBox(width: 12),
          ],
        ],
      ),
      body: Stack(
        children: [
          child,
          if (!isDesktop && loggedIn) const Positioned(left: 12, right: 12, bottom: 12, child: _BottomNav()),
        ],
      ),
    );
  }

  void _openMobileMenu(BuildContext context, bool loggedIn) {
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

class _DesktopLinkButton extends StatelessWidget {
  const _DesktopLinkButton({required this.label, required this.onTap});
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return TextButton(
      onPressed: onTap,
      style: TextButton.styleFrom(foregroundColor: Theme.of(context).colorScheme.onSurface),
      child: Text(label, style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 12, letterSpacing: 0.5)),
    );
  }
}

/// Desktop equivalent of the mobile bottom sheet's grouped section list —
/// same 학교생활/도구/정보 groups, collapsed into one dropdown (mirrors the
/// web navbar's own "메뉴" dropdown that replaced 3 separate group pills).
class _DesktopMenuButton extends StatelessWidget {
  const _DesktopMenuButton({required this.groups});
  final List<_NavGroup> groups;

  @override
  Widget build(BuildContext context) {
    return PopupMenuButton<String>(
      tooltip: '',
      offset: const Offset(0, 44),
      itemBuilder: (context) => [
        for (int i = 0; i < groups.length; i++) ...[
          if (i > 0) const PopupMenuDivider(height: 8),
          PopupMenuItem<String>(
            enabled: false,
            height: 28,
            child: Text(groups[i].label, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: Colors.grey.shade600)),
          ),
          for (final l in groups[i].links)
            PopupMenuItem<String>(value: l.route, child: Text(l.label, style: const TextStyle(fontWeight: FontWeight.bold))),
        ],
      ],
      onSelected: (route) => context.go(route),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text('메뉴', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 12, letterSpacing: 0.5, color: Theme.of(context).colorScheme.onSurface)),
            const Icon(Icons.arrow_drop_down, size: 18),
          ],
        ),
      ),
    );
  }
}

/// Desktop equivalent of the mobile menu's Sign Out row — a compact account
/// menu instead of a full-name/email block, mirroring the web navbar's own
/// avatar dropdown (which replaced an inline name+email+sign-out button for
/// the same reason: it doesn't fit next to a horizontal nav row).
class _DesktopAccountButton extends StatelessWidget {
  const _DesktopAccountButton();

  @override
  Widget build(BuildContext context) {
    return PopupMenuButton<String>(
      tooltip: '',
      itemBuilder: (context) => [
        const PopupMenuItem(value: 'profile', child: Text('Profile', style: TextStyle(fontWeight: FontWeight.bold))),
        const PopupMenuItem(value: 'signout', child: Text('Sign Out', style: TextStyle(fontWeight: FontWeight.bold, color: Colors.red))),
      ],
      onSelected: (value) {
        if (value == 'signout') Supabase.instance.client.auth.signOut();
        if (value == 'profile') context.go('/soon/Profile');
      },
      child: const Padding(
        padding: EdgeInsets.symmetric(horizontal: 12),
        child: Icon(Icons.account_circle_outlined, size: 28),
      ),
    );
  }
}

class _BottomNav extends StatefulWidget {
  const _BottomNav();
  @override
  State<_BottomNav> createState() => _BottomNavState();
}

class _BottomNavState extends State<_BottomNav> {
  // The raised center button needs to sit OUTSIDE GlassCard's own clip
  // region (it clips to its rounded rect for the blur to work) — putting it
  // inside the card's Row like the web's -mt-7 button clipped its top half
  // clean off. Stack it as a sibling instead, overlapping the card from
  // above, so it's never subject to that ClipRRect.
  static const _buttonSize = 52.0;
  static const _peekAbove = 22.0;

  @override
  Widget build(BuildContext context) {
    return Stack(
      clipBehavior: Clip.none,
      alignment: Alignment.topCenter,
      children: [
        Padding(
          padding: const EdgeInsets.only(top: _peekAbove),
          child: GlassCard(
            radius: 28,
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(child: Row(mainAxisAlignment: MainAxisAlignment.spaceEvenly, children: _bottomLeft.map(_categoryButton).toList())),
                const SizedBox(width: _buttonSize + 12),
                Expanded(child: Row(mainAxisAlignment: MainAxisAlignment.spaceEvenly, children: _bottomRight.map(_categoryButton).toList())),
              ],
            ),
          ),
        ),
        InkWell(
          customBorder: const CircleBorder(),
          onTap: () => context.go('/'),
          child: Container(
            width: _buttonSize,
            height: _buttonSize,
            decoration: BoxDecoration(
              color: Theme.of(context).colorScheme.primary,
              shape: BoxShape.circle,
              border: Border.all(color: Theme.of(context).canvasColor, width: 4),
            ),
            child: const Icon(Icons.home_rounded, color: Colors.white),
          ),
        ),
      ],
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

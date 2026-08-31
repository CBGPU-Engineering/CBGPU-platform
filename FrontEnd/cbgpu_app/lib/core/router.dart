import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'app_shell.dart';
import 'motion.dart';
import '../features/auth/login_screen.dart';
import '../features/auth/signup_screen.dart';
import '../features/home/home_screen.dart';
import '../features/home/coming_soon_screen.dart';
import '../features/meal/meal_screen.dart';
import '../features/contact/contact_screen.dart';
import '../features/timetable/timetable_screen.dart';
import '../features/tools/tools_screen.dart';
import '../features/match/match_screen.dart';

final router = GoRouter(
  initialLocation: '/',
  refreshListenable: GoRouterRefreshStream(Supabase.instance.client.auth.onAuthStateChange),
  redirect: (context, state) {
    final loggedIn = Supabase.instance.client.auth.currentSession != null;
    final loggingInRoute = state.matchedLocation == '/login' || state.matchedLocation == '/signup';

    if (!loggedIn && !loggingInRoute) return '/login';
    if (loggedIn && loggingInRoute) return '/';
    return null;
  },
  routes: [
    ShellRoute(
      builder: (context, state, child) => AppShell(child: child),
      routes: [
        GoRoute(path: '/login', pageBuilder: (context, state) => springPage(state: state, child: const LoginScreen())),
        GoRoute(path: '/signup', pageBuilder: (context, state) => springPage(state: state, child: const SignupScreen())),
        GoRoute(path: '/', pageBuilder: (context, state) => springPage(state: state, child: const HomeScreen())),
        GoRoute(path: '/meal', pageBuilder: (context, state) => springPage(state: state, child: const MealScreen())),
        GoRoute(path: '/timetable', pageBuilder: (context, state) => springPage(state: state, child: const TimetableScreen())),
        GoRoute(path: '/tools', pageBuilder: (context, state) => springPage(state: state, child: const ToolsScreen())),
        GoRoute(path: '/match', pageBuilder: (context, state) => springPage(state: state, child: const MatchScreen())),
        GoRoute(path: '/contact', pageBuilder: (context, state) => springPage(state: state, child: const ContactScreen())),
        // Mirrors the web app's /schedule, which is just `redirect('/dashboard')` —
        // no actual page. Points at the GPU placeholder until Dashboard is ported,
        // same as the web app currently points at Dashboard.
        GoRoute(path: '/schedule', redirect: (context, state) => '/soon/GPU'),
        GoRoute(
          path: '/soon/:label',
          pageBuilder: (context, state) =>
              springPage(state: state, child: ComingSoonScreen(label: state.pathParameters['label'] ?? '')),
        ),
      ],
    ),
  ],
);

/// go_router's [refreshListenable] wants a [Listenable]; Supabase gives us a
/// [Stream] of auth events instead — this bridges the two so route guards
/// re-evaluate on sign-in/sign-out.
class GoRouterRefreshStream extends ChangeNotifier {
  GoRouterRefreshStream(Stream<dynamic> stream) {
    notifyListeners();
    _subscription = stream.asBroadcastStream().listen((_) => notifyListeners());
  }

  late final StreamSubscription<dynamic> _subscription;

  @override
  void dispose() {
    _subscription.cancel();
    super.dispose();
  }
}

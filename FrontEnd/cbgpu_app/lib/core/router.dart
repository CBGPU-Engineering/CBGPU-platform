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
import '../features/profile/profile_screen.dart';
import '../features/notes/notes_screen.dart';
import '../features/feed/feed_screen.dart';
import '../features/polls/polls_screen.dart';
import '../features/study/study_screen.dart';
import '../features/dashboard/dashboard_screen.dart';
import '../features/server/server_screen.dart';
import '../features/admin/admin_screen.dart';
import '../features/admin/admin_study_token_screen.dart';
import '../features/games/arcade_screen.dart';

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
        GoRoute(path: '/profile', pageBuilder: (context, state) => springPage(state: state, child: const ProfileScreen())),
        GoRoute(path: '/notes', pageBuilder: (context, state) => springPage(state: state, child: const NotesScreen())),
        GoRoute(path: '/feed', pageBuilder: (context, state) => springPage(state: state, child: const FeedScreen())),
        GoRoute(path: '/polls', pageBuilder: (context, state) => springPage(state: state, child: const PollsScreen())),
        GoRoute(path: '/study', pageBuilder: (context, state) => springPage(state: state, child: const StudyScreen())),
        GoRoute(path: '/dashboard', pageBuilder: (context, state) => springPage(state: state, child: const DashboardScreen())),
        GoRoute(path: '/server', pageBuilder: (context, state) => springPage(state: state, child: const ServerListScreen())),
        GoRoute(path: '/server/new', pageBuilder: (context, state) => springPage(state: state, child: const ServerNewScreen())),
        GoRoute(path: '/server/:id', pageBuilder: (context, state) => springPage(state: state, child: ServerDetailScreen(id: state.pathParameters['id']!))),
        GoRoute(path: '/admin', pageBuilder: (context, state) => springPage(state: state, child: const AdminScreen())),
        GoRoute(path: '/admin/study', pageBuilder: (context, state) => springPage(state: state, child: const AdminStudyTokenScreen())),
        GoRoute(path: '/arcade', pageBuilder: (context, state) => springPage(state: state, child: const ArcadeScreen())),
        GoRoute(path: '/contact', pageBuilder: (context, state) => springPage(state: state, child: const ContactScreen())),
        // Mirrors the web app's /schedule, which is just `redirect('/dashboard')` —
        // no actual page. Points at the GPU placeholder until Dashboard is ported,
        // same as the web app currently points at Dashboard.
        GoRoute(path: '/schedule', redirect: (context, state) => '/dashboard'),
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

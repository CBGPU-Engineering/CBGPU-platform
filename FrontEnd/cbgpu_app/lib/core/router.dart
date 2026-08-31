import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'app_shell.dart';
import 'motion.dart';
import '../features/auth/login_screen.dart';
import '../features/auth/signup_screen.dart';
import '../features/auth/forgot_password_screen.dart';
import '../features/auth/reset_password_screen.dart';
import '../features/auth/auth_callback_screen.dart';
import '../features/home/home_screen.dart';
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
import '../features/manufacturing/manufacturing_screen.dart';
import '../features/manufacturing/print_new_screen.dart';
import '../features/manufacturing/laser_new_screen.dart';
import '../features/manufacturing/print_detail_screen.dart';
import '../features/manufacturing/laser_detail_screen.dart';

final router = GoRouter(
  initialLocation: '/',
  refreshListenable: GoRouterRefreshStream(
    Supabase.instance.client.auth.onAuthStateChange,
  ),
  redirect: (context, state) {
    final loggedIn = Supabase.instance.client.auth.currentSession != null;
    final authRoute =
        state.matchedLocation == '/login' ||
        state.matchedLocation == '/signup' ||
        state.matchedLocation.startsWith('/auth/');
    final publicRoute =
        authRoute ||
        state.matchedLocation == '/' ||
        state.matchedLocation == '/contact';
    final resetRoute = state.matchedLocation == '/auth/reset-password';

    if (!loggedIn && !publicRoute) return '/auth/login';
    // A recovery link creates an authenticated recovery session before this
    // route renders. It must stay on the reset screen instead of being sent
    // home like an already signed-in visitor opening login/signup.
    if (loggedIn && authRoute && !resetRoute) return '/';
    return null;
  },
  routes: [
    ShellRoute(
      builder: (context, state, child) => AppShell(child: child),
      routes: [
        GoRoute(
          path: '/login',
          pageBuilder: (context, state) =>
              springPage(state: state, child: const LoginScreen()),
        ),
        GoRoute(
          path: '/signup',
          pageBuilder: (context, state) =>
              springPage(state: state, child: const SignupScreen()),
        ),
        GoRoute(
          path: '/auth/login',
          pageBuilder: (context, state) =>
              springPage(state: state, child: const LoginScreen()),
        ),
        GoRoute(
          path: '/auth/signup',
          pageBuilder: (context, state) =>
              springPage(state: state, child: const SignupScreen()),
        ),
        GoRoute(
          path: '/auth/forgot-password',
          pageBuilder: (context, state) =>
              springPage(state: state, child: const ForgotPasswordScreen()),
        ),
        GoRoute(
          path: '/auth/reset-password',
          pageBuilder: (context, state) =>
              springPage(state: state, child: const ResetPasswordScreen()),
        ),
        GoRoute(
          path: '/auth/callback',
          pageBuilder: (context, state) =>
              springPage(state: state, child: const AuthCallbackScreen()),
        ),
        GoRoute(
          path: '/',
          pageBuilder: (context, state) =>
              springPage(state: state, child: const HomeScreen()),
        ),
        GoRoute(
          path: '/meal',
          pageBuilder: (context, state) =>
              springPage(state: state, child: const MealScreen()),
        ),
        GoRoute(
          path: '/timetable',
          pageBuilder: (context, state) =>
              springPage(state: state, child: const TimetableScreen()),
        ),
        GoRoute(
          path: '/tools',
          pageBuilder: (context, state) =>
              springPage(state: state, child: const ToolsScreen()),
        ),
        GoRoute(
          path: '/match',
          pageBuilder: (context, state) =>
              springPage(state: state, child: const MatchScreen()),
        ),
        GoRoute(
          path: '/profile',
          pageBuilder: (context, state) =>
              springPage(state: state, child: const ProfileScreen()),
        ),
        GoRoute(
          path: '/notes',
          pageBuilder: (context, state) =>
              springPage(state: state, child: const NotesScreen()),
        ),
        GoRoute(
          path: '/feed',
          pageBuilder: (context, state) =>
              springPage(state: state, child: const FeedScreen()),
        ),
        GoRoute(
          path: '/polls',
          pageBuilder: (context, state) =>
              springPage(state: state, child: const PollsScreen()),
        ),
        GoRoute(
          path: '/study',
          pageBuilder: (context, state) =>
              springPage(state: state, child: const StudyScreen()),
        ),
        GoRoute(
          path: '/dashboard',
          pageBuilder: (context, state) =>
              springPage(state: state, child: const DashboardScreen()),
        ),
        GoRoute(
          path: '/server',
          pageBuilder: (context, state) =>
              springPage(state: state, child: const ServerListScreen()),
        ),
        GoRoute(
          path: '/server/new',
          pageBuilder: (context, state) =>
              springPage(state: state, child: const ServerNewScreen()),
        ),
        GoRoute(
          path: '/server/:id',
          pageBuilder: (context, state) => springPage(
            state: state,
            child: ServerDetailScreen(id: state.pathParameters['id']!),
          ),
        ),
        GoRoute(
          path: '/admin',
          pageBuilder: (context, state) =>
              springPage(state: state, child: const AdminScreen()),
        ),
        GoRoute(
          path: '/admin/study',
          pageBuilder: (context, state) =>
              springPage(state: state, child: const AdminStudyTokenScreen()),
        ),
        GoRoute(
          path: '/games',
          pageBuilder: (context, state) =>
              springPage(state: state, child: const ArcadeScreen()),
        ),
        GoRoute(path: '/arcade', redirect: (context, state) => '/games'),
        GoRoute(
          path: '/manufacturing',
          pageBuilder: (context, state) =>
              springPage(state: state, child: const ManufacturingScreen()),
        ),
        GoRoute(
          path: '/manufacturing/print/new',
          pageBuilder: (context, state) =>
              springPage(state: state, child: const PrintNewScreen()),
        ),
        GoRoute(
          path: '/manufacturing/laser/new',
          pageBuilder: (context, state) =>
              springPage(state: state, child: const LaserNewScreen()),
        ),
        GoRoute(
          path: '/manufacturing/print/:id',
          pageBuilder: (context, state) => springPage(
            state: state,
            child: PrintDetailScreen(id: state.pathParameters['id']!),
          ),
        ),
        GoRoute(
          path: '/manufacturing/laser/:id',
          pageBuilder: (context, state) => springPage(
            state: state,
            child: LaserDetailScreen(id: state.pathParameters['id']!),
          ),
        ),
        GoRoute(
          path: '/contact',
          pageBuilder: (context, state) =>
              springPage(state: state, child: const ContactScreen()),
        ),
        // Mirrors the web app's /schedule, which redirects to the GPU dashboard.
        GoRoute(path: '/schedule', redirect: (context, state) => '/dashboard'),
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

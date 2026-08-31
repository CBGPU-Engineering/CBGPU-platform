import 'package:flutter/foundation.dart';

/// Whether the signed-in user is an admin, used to conditionally show the
/// Admin nav link — mirrors the web navbar's isAdmin-gated Admin link.
/// Populated by HomeScreen's profile load (the first screen after login),
/// same lightweight ValueNotifier pattern as theme_controller.dart.
final isAdminNotifier = ValueNotifier<bool>(false);

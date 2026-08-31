import 'package:flutter/material.dart';

/// The web app has an explicit light/dark toggle independent of the OS
/// setting (see ThemeToggle in Navbar.tsx) — this mirrors that instead of
/// just following ThemeMode.system.
final themeModeNotifier = ValueNotifier<ThemeMode>(ThemeMode.system);

void toggleThemeMode(BuildContext context) {
  final isDark = Theme.of(context).brightness == Brightness.dark;
  themeModeNotifier.value = isDark ? ThemeMode.light : ThemeMode.dark;
}

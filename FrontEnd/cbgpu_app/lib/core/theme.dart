import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// Matches the Next.js site's brand (oklch(0.6 0.18 250) primary, bold
/// uppercase "font-black" type, big rounded corners). Noto Sans KR isn't
/// decorative here — it's required: the default Material fonts have no
/// Hangul glyphs on Linux desktop, so every Korean label would render as
/// tofu boxes without it.
class AppTheme {
  static const _primary = Color(0xFF2E6FE0);

  static ThemeData light() => _base(Brightness.light, const Color(0xFFF6F7FA), Colors.white);
  static ThemeData dark() => _base(Brightness.dark, const Color(0xFF171717), const Color(0xFF262626));

  static ThemeData _base(Brightness brightness, Color background, Color card) {
    final scheme = ColorScheme.fromSeed(
      seedColor: _primary,
      brightness: brightness,
      surface: card,
    );
    final textTheme = GoogleFonts.notoSansKrTextTheme(
      brightness == Brightness.dark ? ThemeData.dark().textTheme : ThemeData.light().textTheme,
    );

    return ThemeData(
      useMaterial3: true,
      brightness: brightness,
      colorScheme: scheme,
      scaffoldBackgroundColor: background,
      textTheme: textTheme,
      appBarTheme: AppBarTheme(
        backgroundColor: background,
        foregroundColor: scheme.onSurface,
        elevation: 0,
        centerTitle: false,
      ),
      cardTheme: CardThemeData(
        color: card,
        elevation: 0,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(28)),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: card,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: BorderSide.none,
        ),
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: scheme.primary,
          foregroundColor: scheme.onPrimary,
          minimumSize: const Size.fromHeight(52),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          textStyle: const TextStyle(fontWeight: FontWeight.w900, letterSpacing: 0.5),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: scheme.primary,
          textStyle: const TextStyle(fontWeight: FontWeight.w900),
        ),
      ),
    );
  }
}

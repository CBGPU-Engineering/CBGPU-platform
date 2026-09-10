import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// Exact colors from the web app's globals.css (oklch tokens converted to
/// sRGB hex via a real browser's canvas — not eyeballed), so this isn't just
/// "in the same ballpark" but the literal same palette as the site.
class AppColors {
  static const primary = Color(0xFF0082E6);

  static const lightBackground = Color(0xFFF5F7F9);
  static const lightCard = Color(0xFFFFFFFF);
  static const lightForeground = Color(0xFF0A0A0A);
  static const lightMuted = Color(0xFFF0F2F4);
  static const lightMutedForeground = Color(0xFF737373);
  static const lightBorder = Color(0xFFE9EBEE);

  static const darkBackground = Color(0xFF0A0A0A);
  static const darkCard = Color(0xFF171717);
  static const darkForeground = Color(0xFFFAFAFA);
  static const darkMuted = Color(0xFF262626);
  static const darkMutedForeground = Color(0xFFB4B4B4);
  static const darkBorder = Color(0x26FFFFFF);

  // Same Tailwind -400 palette as FEATURES in the Next.js home page.
  static const featureBlue = Color(0xFF60A5FA);
  static const featureIndigo = Color(0xFF818CF8);
  static const featureAmber = Color(0xFFFBBF24);
  static const featureViolet = Color(0xFFA78BFA);
  static const featureTeal = Color(0xFF2DD4BF);
  static const featureSky = Color(0xFF38BDF8);
  static const featureSlate = Color(0xFF94A3B8);
  static const featureEmerald = Color(0xFF34D399);
  static const featureOrange = Color(0xFFFB923C);
  static const featureCyan = Color(0xFF22D3EE);

  // The web's --success token (oklch(0.6 0.16 145) light / oklch(0.65 0.16
  // 145) dark), converted via the OKLab math by hand rather than measured
  // off a rendered canvas like the rest of this file — close enough for a
  // 10%-alpha badge tint, but flag it if it ever needs pixel-exact matching.
  static const lightSuccess = Color(0xFF31983D);
  static const darkSuccess = Color(0xFF43A84C);

  // The web's Badge "warning" variant hardcodes Tailwind amber (not a CSS
  // token): bg-amber-500/10 text-amber-600 dark:text-amber-400.
  static const warningBg = Color(0xFFF59E0B); // amber-500
  static const lightWarningText = Color(0xFFD97706); // amber-600
  static const darkWarningText = featureAmber; // amber-400
}

class AppTheme {
  static ThemeData light() => _base(
    brightness: Brightness.light,
    background: AppColors.lightBackground,
    card: AppColors.lightCard,
    foreground: AppColors.lightForeground,
    muted: AppColors.lightMuted,
    mutedForeground: AppColors.lightMutedForeground,
    border: AppColors.lightBorder,
  );

  static ThemeData dark() => _base(
    brightness: Brightness.dark,
    background: AppColors.darkBackground,
    card: AppColors.darkCard,
    foreground: AppColors.darkForeground,
    muted: AppColors.darkMuted,
    mutedForeground: AppColors.darkMutedForeground,
    border: AppColors.darkBorder,
  );

  static ThemeData _base({
    required Brightness brightness,
    required Color background,
    required Color card,
    required Color foreground,
    required Color muted,
    required Color mutedForeground,
    required Color border,
  }) {
    final scheme = ColorScheme(
      brightness: brightness,
      primary: AppColors.primary,
      onPrimary: Colors.white,
      secondary: muted,
      onSecondary: foreground,
      surface: card,
      onSurface: foreground,
      error: const Color(0xFFE7402B),
      onError: Colors.white,
      outline: border,
    );

    // The web app never actually loads a custom font — its --font-sans CSS
    // variable is unused shadcn boilerplate, so every visitor just sees their
    // own OS's default UI font. To match that (rather than invent a look the
    // site doesn't have), keep Flutter's default family and only fall back to
    // Noto Sans KR for the Hangul glyphs the default font is missing —
    // instead of forcing Noto Sans KR onto Latin text too, which reads as a
    // different, more distinctive typeface than the site actually uses.
    final base = brightness == Brightness.dark
        ? ThemeData.dark()
        : ThemeData.light();
    final notoFamily = GoogleFonts.notoSansKr().fontFamily;
    final textTheme = base.textTheme.apply(
      bodyColor: foreground,
      displayColor: foreground,
      fontFamilyFallback: notoFamily != null ? [notoFamily] : null,
    );

    return ThemeData(
      useMaterial3: true,
      brightness: brightness,
      colorScheme: scheme,
      scaffoldBackgroundColor: Colors.transparent,
      canvasColor: background,
      textTheme: textTheme,
      dividerColor: border,
      appBarTheme: AppBarTheme(
        backgroundColor: Colors.transparent,
        foregroundColor: foreground,
        elevation: 0,
        centerTitle: false,
        titleTextStyle: textTheme.titleLarge?.copyWith(
          fontWeight: FontWeight.w900,
          fontStyle: FontStyle.italic,
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: card,
        isDense: true,
        hintStyle: TextStyle(color: mutedForeground),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: BorderSide(color: border),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: BorderSide(color: border),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: BorderSide(color: AppColors.primary, width: 2),
        ),
        // shadcn Input is h-8 with px-2.5. Keep Flutter fields on the same
        // compact baseline instead of the Material default's 48px control.
        contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.primary,
          foregroundColor: Colors.white,
          // Never use Size.fromHeight here: it sets width to infinity. As a
          // global style that made every button inside a Row consume all
          // horizontal space and squeezed adjacent Korean headings into a
          // one-character-wide vertical column.
          minimumSize: const Size(0, 48),
          visualDensity: VisualDensity.standard,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(10),
          ),
          textStyle: const TextStyle(
            fontWeight: FontWeight.w900,
            letterSpacing: 1,
            fontSize: 13,
          ),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: AppColors.primary,
          textStyle: const TextStyle(fontWeight: FontWeight.w900),
        ),
      ),
      // The site's filter/tab pills never have a checkmark — Material's
      // ChoiceChip default (showCheckmark: true) was clipping several
      // screens' short, tightly-sized labels (e.g. "전체" -> "전") because
      // the checkmark area doesn't reserve its own space cleanly at these
      // custom font sizes. A single theme-level default fixes every
      // ChoiceChip in the app at once instead of each screen repeating
      // `showCheckmark: false`.
      chipTheme: const ChipThemeData(showCheckmark: false),
    );
  }
}

/// Small-caps-ish uppercase field label matching the web app's
/// `text-[10px] font-black uppercase text-muted-foreground` pattern —
/// used above inputs instead of Material's floating labelText.
class FieldLabel extends StatelessWidget {
  const FieldLabel(this.text, {super.key, this.icon, this.color});
  final String text;
  // Most screens use the muted-grey default (`text-muted-foreground`), but a
  // handful — profile's name/student-id/password fields — use
  // `text-primary` plus a small leading icon (UserCircle2/Hash/Lock) on the
  // web. Optional rather than a new default so those other screens don't
  // change.
  final IconData? icon;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final resolvedColor =
        color ?? Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.5);
    return Padding(
      padding: const EdgeInsets.only(left: 4, bottom: 6),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 11, color: resolvedColor),
            const SizedBox(width: 4),
          ],
          Text(
            text.toUpperCase(),
            style: TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.w900,
              letterSpacing: 1.2,
              color: resolvedColor,
            ),
          ),
        ],
      ),
    );
  }
}

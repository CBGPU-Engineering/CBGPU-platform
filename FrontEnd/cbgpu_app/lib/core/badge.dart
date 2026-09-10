import 'package:flutter/material.dart';

import 'theme.dart';

enum AppBadgeVariant { primary, success, warning, danger, muted }

/// Ports the web app's shared `Badge` component (src/components/ui/badge.tsx)
/// pixel-for-pixel: a fully-rounded pill, 10px/w900/uppercase/widest-tracked
/// text, with a 10%-alpha tinted background and solid-color text per variant.
/// Screens previously reimplemented this ad hoc (borderRadius 8, no
/// uppercase, no letterSpacing) — this replaces those local `_badge()`
/// helpers so every status pill looks the same across the app.
class AppBadge extends StatelessWidget {
  const AppBadge(
    this.label, {
    super.key,
    this.variant = AppBadgeVariant.primary,
    this.icon,
  });

  final String label;
  final AppBadgeVariant variant;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final scheme = Theme.of(context).colorScheme;
    final (Color bg, Color fg) = switch (variant) {
      AppBadgeVariant.primary => (
        AppColors.primary.withValues(alpha: 0.1),
        AppColors.primary,
      ),
      AppBadgeVariant.success => (
        (dark ? AppColors.darkSuccess : AppColors.lightSuccess).withValues(
          alpha: 0.1,
        ),
        dark ? AppColors.darkSuccess : AppColors.lightSuccess,
      ),
      AppBadgeVariant.warning => (
        AppColors.warningBg.withValues(alpha: 0.1),
        dark ? AppColors.darkWarningText : AppColors.lightWarningText,
      ),
      AppBadgeVariant.danger => (
        scheme.error.withValues(alpha: 0.1),
        scheme.error,
      ),
      AppBadgeVariant.muted => (
        scheme.secondary,
        scheme.onSurface.withValues(alpha: 0.6),
      ),
    };

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(999)),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 10, color: fg),
            const SizedBox(width: 4),
          ],
          Text(
            label.toUpperCase(),
            style: TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.w900,
              letterSpacing: 1.5,
              color: fg,
            ),
          ),
        ],
      ),
    );
  }
}

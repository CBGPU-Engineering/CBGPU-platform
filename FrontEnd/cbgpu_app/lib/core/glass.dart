import 'dart:ui';

import 'package:flutter/material.dart';

/// The single top glow from the web app's body background (globals.css:
/// radial-gradient(ellipse 80% 50% at 50% -10%, primary/0.12|0.2, transparent 70%)).
/// Wrap a Scaffold's body with this so every screen has the same ambient wash
/// the CSS glass utilities were designed to catch.
class AmbientBackground extends StatelessWidget {
  const AmbientBackground({super.key, required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Stack(
      fit: StackFit.expand,
      children: [
        Container(color: Theme.of(context).canvasColor),
        Positioned(
          top: -200,
          left: -100,
          right: -100,
          height: 500,
          child: DecoratedBox(
            decoration: BoxDecoration(
              gradient: RadialGradient(
                colors: [
                  const Color(0xFF0082E6).withValues(alpha: isDark ? 0.20 : 0.12),
                  const Color(0xFF0082E6).withValues(alpha: 0),
                ],
                stops: const [0.0, 1.0],
              ),
            ),
          ),
        ),
        child,
      ],
    );
  }
}

/// Frosted-glass content container matching the web app's `--card` token:
/// translucent background + backdrop blur + saturation boost + soft
/// specular highlight at the top edge. High enough opacity that text never
/// fights with whatever's blurred behind it (same lesson as the CSS version).
class GlassCard extends StatelessWidget {
  const GlassCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(24),
    this.radius = 28,
    this.borderWidth = 1,
    this.borderColor,
  });

  final Widget child;
  final EdgeInsets padding;
  final double radius;
  /// Web varies this per-section (a near-invisible `ring-1 ring-foreground/5`
  /// on hero/profile cards vs a visible `border-2` on the dashboard calendar
  /// panel) — GlassCard used to hardcode a single 1px `dividerColor` border
  /// everywhere, making every card read with the same "hard edge" regardless
  /// of what the web actually does for that section.
  final double borderWidth;
  final Color? borderColor;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final base = Theme.of(context).colorScheme.surface;
    final border = borderColor ?? Theme.of(context).dividerColor;

    return ClipRRect(
      borderRadius: BorderRadius.circular(radius),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
        child: Container(
          padding: padding,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(radius),
            border: Border.all(color: border, width: borderWidth),
            // Spread across the full height (not just the top 40%) — on a
            // short, wide element like the bottom nav bar, concentrating the
            // transition into a small pixel band read as an odd stripe
            // rather than an ambient sheen. Full-height + a lower peak alpha
            // looks consistent whether the card is short or tall.
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [
                Colors.white.withValues(alpha: isDark ? 0.05 : 0.28),
                base.withValues(alpha: isDark ? 0.78 : 0.82),
              ],
            ),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: isDark ? 0.4 : 0.06),
                blurRadius: 24,
                offset: const Offset(0, 8),
              ),
            ],
          ),
          child: child,
        ),
      ),
    );
  }
}

/// Flat container for the web's deliberately non-glass elements — anything
/// that uses `border border-border/40`, `bg-muted/10`, `bg-muted/20`, etc.
/// rather than the `bg-card` class that triggers the site's auto-glass CSS
/// rule. No blur, no drop shadow: `GlassCard` had been used for these too
/// (list rows, stat bars, empty-state placeholders), which turned web's
/// dense, borderless-fill lists into stacks of separated frosted panels.
class SolidTintCard extends StatelessWidget {
  const SolidTintCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(16),
    this.radius = 18,
    this.tint = 0.06,
    this.bordered = true,
  });

  final Widget child;
  final EdgeInsets padding;
  final double radius;
  /// Background alpha over the theme's onSurface color — matches web's
  /// bg-muted/10 (~0.06 effective) through bg-muted/20 (~0.1) range.
  final double tint;
  final bool bordered;

  @override
  Widget build(BuildContext context) {
    final onSurface = Theme.of(context).colorScheme.onSurface;
    return Container(
      padding: padding,
      decoration: BoxDecoration(
        color: onSurface.withValues(alpha: tint),
        borderRadius: BorderRadius.circular(radius),
        border: bordered
            ? Border.all(color: Theme.of(context).dividerColor)
            : null,
      ),
      child: child,
    );
  }
}

/// Ports the web's recurring empty-state pattern: a dashed-border,
/// muted-tint card with a big emoji and a message — used everywhere a list
/// can legitimately be empty (reservations, jobs, feed, etc.), which the
/// Flutter port had mostly reduced to a bare centered grey `Text(...)`.
/// Flutter's `Border` has no dashed style, so a plain 2px border stands in.
class EmptyStateCard extends StatelessWidget {
  const EmptyStateCard({super.key, this.emoji, required this.message});
  final String? emoji;
  final String message;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(vertical: 32, horizontal: 16),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: Theme.of(context).dividerColor, width: 2),
        color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.04),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (emoji != null) ...[
            Text(emoji!, style: const TextStyle(fontSize: 52)),
            const SizedBox(height: 12),
          ],
          Text(
            message,
            textAlign: TextAlign.center,
            style: TextStyle(
              color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.6),
              fontSize: 13,
            ),
          ),
        ],
      ),
    );
  }
}
